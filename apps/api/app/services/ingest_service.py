import uuid
import re
from pathlib import Path
from typing import Optional
import pandas as pd
from sqlalchemy.orm import Session
from apps.api.app.core.config import settings
from apps.api.app.models.entities import Dataset, DatasetColumn, QualityIssue, Insight
from apps.api.app.services.profile_service import profile_service
from apps.api.app.services.query_service import query_service
from apps.api.app.services.insight_service import insight_service

class IngestService:
    @staticmethod
    def ingest_file(
        db: Session,
        workspace_id: str,
        name: str,
        file_path: Path,
        file_format: str,
        description: Optional[str] = None
    ) -> Dataset:
        # 1. Read file with pandas
        if file_format == "parquet":
            df = pd.read_parquet(file_path)
        elif file_format == "csv":
            df = pd.read_csv(file_path)
        else:
            raise ValueError(f"Unsupported format: {file_format}. Only CSV and Parquet are supported.")

        # 2. Normalize column names (strip whitespace, sanitize)
        df.columns = [re.sub(r"[^\w]", "_", c.strip()) for c in df.columns]

        # 3. Create sanitized table name for DuckDB
        clean_name = re.sub(r"[^\w]", "_", name.lower())
        table_name = f"ds_{clean_name}_{str(uuid.uuid4())[:8]}"

        # 4. Register with DuckDB query engine
        query_service.register_dataset(table_name, str(file_path), file_format)

        # 5. Run real statistical profiling and quality checks
        col_profiles, quality_issues, quality_score = profile_service.profile_dataframe(df)

        # 6. Save Dataset entity
        dataset = Dataset(
            workspace_id=workspace_id,
            name=name,
            description=description,
            file_path=str(file_path),
            format=file_format,
            row_count=len(df),
            column_count=len(df.columns),
            status="ready",
            quality_score=quality_score,
            table_name=table_name
        )
        db.add(dataset)
        db.flush()

        # 7. Add Column profiles
        for cp in col_profiles:
            col_record = DatasetColumn(
                dataset_id=dataset.id,
                name=cp["name"],
                data_type=cp["data_type"],
                null_count=cp["null_count"],
                distinct_count=cp["distinct_count"],
                min_value=cp["min_value"],
                max_value=cp["max_value"],
                mean_value=cp["mean_value"],
                median_value=cp["median_value"],
                std_dev=cp["std_dev"],
                histogram_json=cp["histogram_json"]
            )
            db.add(col_record)

        # 8. Add Quality issues
        for qi in quality_issues:
            issue_record = QualityIssue(
                dataset_id=dataset.id,
                severity=qi["severity"],
                rule_type=qi["rule_type"],
                column_name=qi["column_name"],
                message=qi["message"],
                affected_rows=qi["affected_rows"],
                sample_records_json=qi["sample_records_json"]
            )
            db.add(issue_record)

        # 9. Run Insight discovery
        detected_insights = insight_service.detect_insights(df, dataset.id, table_name)
        for ins in detected_insights:
            insight_record = Insight(
                dataset_id=dataset.id,
                title=ins["title"],
                description=ins["description"],
                severity=ins["severity"],
                category=ins["category"],
                metric_name=ins["metric_name"],
                baseline_value=ins["baseline_value"],
                observed_value=ins["observed_value"],
                relative_change_pct=ins["relative_change_pct"],
                evidence_query=ins["evidence_query"],
                status=ins["status"]
            )
            db.add(insight_record)

        db.commit()
        db.refresh(dataset)
        return dataset

ingest_service = IngestService()
