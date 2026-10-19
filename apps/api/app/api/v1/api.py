import os
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from apps.api.app.db.session import get_db
from apps.api.app.core.config import settings, SERVER_START_TIME
from apps.api.app.models.entities import (
    Workspace, Dataset, SavedQuery, QueryHistory, Metric, Dashboard, Widget, Insight, Report, IngestionRun
)
from apps.api.app.schemas.dto import (
    WorkspaceResponse, DatasetResponse, IngestionRunResponse,
    QueryExecuteRequest, QueryExecuteResponse,
    SavedQueryCreate, SavedQueryResponse, QueryHistoryResponse,
    MetricCreate, MetricResponse,
    DashboardCreate, DashboardResponse,
    InsightResponse, InsightReviewRequest,
    ReportCreate, ReportResponse,
    AIProfileSummaryRequest, AIProfileSummaryResponse,
    NLToSqlRequest, NLToSqlResponse
)
from apps.api.app.services.ingest_service import ingest_service
from apps.api.app.services.query_service import query_service
from apps.api.app.services.ai_service import ai_service

router = APIRouter()

# 1. Health
@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": round(time.time() - SERVER_START_TIME, 2),
        "environment": settings.APP_ENV,
        "query_engine": "DuckDB in-process",
        "metadata_store": "ready"
    }

# 2. Workspaces
@router.get("/workspaces", response_model=list[WorkspaceResponse])
def get_workspaces(db: Session = Depends(get_db)):
    return db.query(Workspace).all()

# 3. Datasets
@router.get("/datasets", response_model=list[DatasetResponse])
def list_datasets(workspace_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Dataset)
    if workspace_id:
        q = q.filter(Dataset.workspace_id == workspace_id)
    return q.all()

@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: str, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds

@router.get("/datasets/{dataset_id}/ingestion-runs", response_model=list[IngestionRunResponse])
def get_dataset_ingestion_runs(dataset_id: str, db: Session = Depends(get_db)):
    runs = db.query(IngestionRun).filter(IngestionRun.dataset_id == dataset_id).order_by(IngestionRun.created_at.desc()).all()
    return runs

@router.post("/datasets/upload", response_model=DatasetResponse)
async def upload_dataset(
    workspace_id: str = Form(...),
    file: UploadFile = File(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    filename = file.filename or "upload.csv"
    ext = filename.split(".")[-1].lower()
    if ext not in ["csv", "parquet"]:
        raise HTTPException(status_code=400, detail="Only CSV and Parquet files are permitted.")
    
    unique_filename = f"{uuid.uuid4()}_{filename}"
    saved_path = settings.UPLOAD_DIR / unique_filename

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        dataset = ingest_service.ingest_file(
            db=db,
            workspace_id=workspace_id,
            name=Path(filename).stem,
            file_path=saved_path,
            file_format=ext,
            description=description
        )
        return dataset
    except Exception as e:
        if saved_path.exists():
            saved_path.unlink()
        raise HTTPException(status_code=422, detail=f"Failed to ingest dataset: {str(e)}")

# 4. SQL Queries
@router.post("/queries/execute", response_model=QueryExecuteResponse)
def execute_query(req: QueryExecuteRequest, db: Session = Depends(get_db)):
    result = query_service.execute_query(req.sql, limit=req.limit or 500)
    
    # Record history
    history = QueryHistory(
        workspace_id=req.workspace_id,
        sql_text=req.sql,
        duration_ms=result["duration_ms"],
        row_count=result["row_count"],
        status=result["status"],
        error_message=result.get("error")
    )
    db.add(history)
    db.commit()
    
    return result

@router.get("/queries/history", response_model=list[QueryHistoryResponse])
def get_query_history(workspace_id: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    q = db.query(QueryHistory)
    if workspace_id:
        q = q.filter(QueryHistory.workspace_id == workspace_id)
    return q.order_by(QueryHistory.created_at.desc()).limit(limit).all()

@router.get("/saved-queries", response_model=list[SavedQueryResponse])
def get_saved_queries(workspace_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(SavedQuery)
    if workspace_id:
        q = q.filter(SavedQuery.workspace_id == workspace_id)
    return q.order_by(SavedQuery.created_at.desc()).all()

@router.post("/saved-queries", response_model=SavedQueryResponse)
def create_saved_query(req: SavedQueryCreate, db: Session = Depends(get_db)):
    saved = SavedQuery(
        workspace_id=req.workspace_id,
        name=req.name,
        description=req.description,
        sql_text=req.sql_text
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return saved

# 5. Metrics
@router.get("/metrics", response_model=list[MetricResponse])
def get_metrics(workspace_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Metric)
    if workspace_id:
        q = q.filter(Metric.workspace_id == workspace_id)
    return q.all()

@router.post("/metrics", response_model=MetricResponse)
def create_metric(req: MetricCreate, db: Session = Depends(get_db)):
    metric = Metric(
        workspace_id=req.workspace_id,
        name=req.name,
        description=req.description,
        sql_definition=req.sql_definition,
        grain=req.grain,
        unit=req.unit,
        time_dimension=req.time_dimension,
        exclusions=req.exclusions,
        limitations=req.limitations
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric

# 6. Dashboards
@router.get("/dashboards", response_model=list[DashboardResponse])
def get_dashboards(workspace_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Dashboard)
    if workspace_id:
        q = q.filter(Dashboard.workspace_id == workspace_id)
    return q.all()

@router.get("/dashboards/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(dashboard_id: str, db: Session = Depends(get_db)):
    d = db.query(Dashboard).filter(Dashboard.id == dashboard_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return d

@router.post("/dashboards", response_model=DashboardResponse)
def create_dashboard(req: DashboardCreate, db: Session = Depends(get_db)):
    dashboard = Dashboard(
        workspace_id=req.workspace_id,
        name=req.name,
        description=req.description
    )
    db.add(dashboard)
    db.flush()

    for idx, w in enumerate(req.widgets):
        widget = Widget(
            dashboard_id=dashboard.id,
            title=w.title,
            widget_type=w.widget_type,
            sql_query=w.sql_query,
            config_json=w.config_json,
            order_index=idx
        )
        db.add(widget)

    db.commit()
    db.refresh(dashboard)
    return dashboard

# 7. Insights
@router.get("/insights", response_model=list[InsightResponse])
def get_insights(dataset_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Insight)
    if dataset_id:
        q = q.filter(Insight.dataset_id == dataset_id)
    return q.order_by(Insight.created_at.desc()).all()

@router.post("/insights/{insight_id}/review", response_model=InsightResponse)
def review_insight(insight_id: str, req: InsightReviewRequest, db: Session = Depends(get_db)):
    ins = db.query(Insight).filter(Insight.id == insight_id).first()
    if not ins:
        raise HTTPException(status_code=404, detail="Insight not found")
    ins.status = req.status
    db.commit()
    db.refresh(ins)
    return ins

# 8. Reports
@router.get("/reports", response_model=list[ReportResponse])
def get_reports(workspace_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Report)
    if workspace_id:
        q = q.filter(Report.workspace_id == workspace_id)
    return q.order_by(Report.created_at.desc()).all()

@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: str, db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    return r

@router.post("/reports", response_model=ReportResponse)
def create_report(req: ReportCreate, db: Session = Depends(get_db)):
    report = Report(
        workspace_id=req.workspace_id,
        title=req.title,
        business_question=req.business_question,
        executive_summary=req.executive_summary,
        methodology=req.methodology,
        findings=req.findings,
        recommendations=req.recommendations,
        content_json=req.content_json
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report

# 9. Model Lineage View
@router.get("/models/lineage")
def get_model_lineage():
    return {
        "nodes": [
            {"id": "source_raw", "name": "Source: Raw Ingestion", "layer": "raw", "description": "Raw CSV / Parquet ingested stream"},
            {"id": "stg_retail_transactions", "name": "stg_retail_transactions", "layer": "staging", "description": "Normalized column names, cast datatypes, initial null handling"},
            {"id": "int_valid_transactions", "name": "int_valid_transactions", "layer": "intermediate", "description": "Separates cancellations ('C%') and positive sales; computes line_total"},
            {"id": "dim_customers", "name": "dim_customers", "layer": "marts", "description": "Customer dimension with lifetime value and order frequency"},
            {"id": "dim_products", "name": "dim_products", "layer": "marts", "description": "Product dimension with catalog attributes"},
            {"id": "mart_sales_daily", "name": "mart_sales_daily", "layer": "marts", "description": "Aggregated daily net sales, order counts, and cancellation rates"},
            {"id": "mart_product_performance", "name": "mart_product_performance", "layer": "marts", "description": "Aggregated product volume and revenue contribution"}
        ],
        "edges": [
            {"source": "source_raw", "target": "stg_retail_transactions"},
            {"source": "stg_retail_transactions", "target": "int_valid_transactions"},
            {"source": "int_valid_transactions", "target": "dim_customers"},
            {"source": "int_valid_transactions", "target": "dim_products"},
            {"source": "int_valid_transactions", "target": "mart_sales_daily"},
            {"source": "int_valid_transactions", "target": "mart_product_performance"}
        ]
    }

# 10. AI Analytics Copilot & Natural-Language-to-SQL
@router.get("/ai/capabilities")
def get_ai_capabilities():
    return {
        "status": "ready",
        "features": [
            "ai_profile_summary",
            "natural_language_to_sql",
            "statistical_insights",
            "safe_sandbox_execution"
        ],
        "sandbox_enforced": True,
        "default_provider": "builtin-analyst",
        "external_provider_configured": bool(os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY"))
    }

@router.post("/ai/profile-summary", response_model=AIProfileSummaryResponse)
def get_ai_profile_summary(req: AIProfileSummaryRequest, db: Session = Depends(get_db)):
    ds = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ai_service.generate_profile_summary(ds, ds.columns, ds.quality_issues)

@router.post("/ai/nl-to-sql", response_model=NLToSqlResponse)
def natural_language_to_sql(req: NLToSqlRequest, db: Session = Depends(get_db)):
    if req.dataset_id:
        ds = db.query(Dataset).filter(Dataset.id == req.dataset_id).first()
    else:
        ds = db.query(Dataset).filter(Dataset.workspace_id == req.workspace_id).first()
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found in specified workspace")
    metrics = db.query(Metric).filter(Metric.workspace_id == req.workspace_id).all()
    return ai_service.natural_language_to_sql(req.question, ds, metrics, execute=req.execute)

