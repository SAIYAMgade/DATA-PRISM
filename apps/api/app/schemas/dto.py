from typing import Any, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# Workspace
class WorkspaceBase(BaseModel):
    name: str
    description: Optional[str] = None

class WorkspaceResponse(WorkspaceBase):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Dataset Column & Quality
class ColumnProfileResponse(BaseModel):
    id: str
    name: str
    data_type: str
    null_count: int
    distinct_count: int
    min_value: Optional[str] = None
    max_value: Optional[str] = None
    mean_value: Optional[float] = None
    median_value: Optional[float] = None
    std_dev: Optional[float] = None
    histogram_json: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class QualityIssueResponse(BaseModel):
    id: str
    severity: str
    rule_type: str
    column_name: Optional[str] = None
    message: str
    affected_rows: int
    sample_records_json: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DatasetResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    format: str
    row_count: int
    column_count: int
    status: str
    quality_score: float
    table_name: str
    created_at: datetime
    updated_at: datetime
    columns: list[ColumnProfileResponse] = []
    quality_issues: list[QualityIssueResponse] = []
    model_config = ConfigDict(from_attributes=True)

# SQL Query
class QueryExecuteRequest(BaseModel):
    workspace_id: str
    sql: str
    limit: Optional[int] = Field(default=500, le=1000)

class QueryExecuteResponse(BaseModel):
    execution_id: str
    status: str
    columns: list[str]
    column_types: list[str]
    rows: list[list[Any]]
    row_count: int
    duration_ms: float
    is_truncated: bool
    error: Optional[str] = None

class SavedQueryCreate(BaseModel):
    workspace_id: str
    name: str
    description: Optional[str] = None
    sql_text: str

class SavedQueryResponse(SavedQueryCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class QueryHistoryResponse(BaseModel):
    id: str
    workspace_id: str
    sql_text: str
    duration_ms: float
    row_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Metrics
class MetricCreate(BaseModel):
    workspace_id: str
    name: str
    description: str
    sql_definition: str
    grain: str
    unit: str = "units"
    time_dimension: Optional[str] = None
    exclusions: Optional[str] = None
    limitations: Optional[str] = None

class MetricResponse(MetricCreate):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

# Dashboards & Widgets
class WidgetCreate(BaseModel):
    title: str
    widget_type: str
    sql_query: str
    config_json: Optional[str] = None
    order_index: int = 0

class WidgetResponse(WidgetCreate):
    id: str
    dashboard_id: str
    model_config = ConfigDict(from_attributes=True)

class DashboardCreate(BaseModel):
    workspace_id: str
    name: str
    description: Optional[str] = None
    widgets: list[WidgetCreate] = []

class DashboardResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    widgets: list[WidgetResponse] = []
    model_config = ConfigDict(from_attributes=True)

# Insights
class InsightResponse(BaseModel):
    id: str
    dataset_id: str
    title: str
    description: str
    severity: str
    category: str
    metric_name: Optional[str] = None
    baseline_value: Optional[float] = None
    observed_value: Optional[float] = None
    relative_change_pct: Optional[float] = None
    evidence_query: str
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class InsightReviewRequest(BaseModel):
    status: str  # verified, dismissed

# Reports
class ReportCreate(BaseModel):
    workspace_id: str
    title: str
    business_question: str
    executive_summary: str
    methodology: str
    findings: str
    recommendations: str
    content_json: Optional[str] = None

class ReportResponse(ReportCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
