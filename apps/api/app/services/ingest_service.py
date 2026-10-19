import uuid
import re
import time
import hashlib
import json
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone
import pandas as pd
from sqlalchemy.orm import Session
from apps.api.app.core.config import settings
from apps.api.app.models.entities import Dataset, DatasetColumn, QualityIssue, Insight, IngestionRun
from apps.api.app.services.profile_service import profile_service
from apps.api.app.services.query_service import query_service
from apps.api.app.services.insight_service import insight_service

class IngestService:
    @staticmethod
    def calculate_checksum(file_path: Path) -> str:
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                sha256.update(chunk)
        return sha256.hexdigest()

    @staticmethod
    def ingest_file(
        db: Session,
        workspace_id: str,
        name: str,
        file_path: Path,
        file_format: str,
        description: Optional[str] = None,
        source_id: Optional[str] = None
    ) -> Dataset:
        t0 = time.perf_counter()
        start_time = datetime.now(timezone.utc)
        
        # 0. Checksum and Source ID
        file_checksum = IngestService.calculate_checksum(file_path)
        actual_source_id = source_id or f"src_{str(uuid.uuid4())[:8]}"

        # 1. Read file with pandas
        if file_format == "parquet":
            df = pd.read_parquet(file_path)
        elif file_format == "csv":
            df = pd.read_csv(file_path)
        else:
            raise ValueError(f"Unsupported format: {file_format}. Only CSV and Parquet are supported.")

        rows_read = len(df)
        rows_rejected = 0

        # 2. Normalize column names (strip whitespace, sanitize)
        df.columns = [re.sub(r"[^\w]", "_", c.strip()) for c in df.columns]

        # 3. Create sanitized table name for DuckDB
        clean_name = re.sub(r"[^\w]", "_", name.lower())
        table_name = f"ds_{clean_name}_{str(uuid.uuid4())[:8]}"

        # 4. Register with DuckDB query engine
        query_service.register_dataset(table_name, str(file_path), file_format)

        # 5. Run real statistical profiling and quality checks
        col_profiles, quality_issues, quality_score = profile_service.profile_dataframe(df)
        
        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        completion_time = datetime.now(timezone.utc)
        detected_schema = json.dumps({c["name"]: c["data_type"] for c in col_profiles})

        # 6. Save Dataset entity
        dataset = Dataset(
            workspace_id=workspace_id,
            name=name,
            description=description,
            file_path=str(file_path),
            format=file_format,
            row_count=rows_read,
            column_count=len(df.columns),
            status="ready",
            quality_score=quality_score,
            table_name=table_name,
            file_checksum=file_checksum,
            rows_read=rows_read,
            rows_inserted=rows_read,
            rows_rejected=rows_rejected,
            processing_duration_ms=duration_ms,
            source_id=actual_source_id
        )
        db.add(dataset)
        db.flush()

        # 6b. Add IngestionRun record
        ingestion_run = IngestionRun(
            dataset_id=dataset.id,
            source_id=actual_source_id,
            source_name=name,
            original_filename=file_path.name,
            file_checksum=file_checksum,
            start_time=start_time,
            completion_time=completion_time,
            status="completed",
            rows_read=rows_read,
            rows_inserted=rows_read,
            rows_updated=0,
            rows_rejected=rows_rejected,
            error_details=None,
            detected_schema=detected_schema,
            processing_duration_ms=duration_ms
        )
        db.add(ingestion_run)

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
