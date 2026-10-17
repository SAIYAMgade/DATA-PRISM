import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from apps.api.app.db.session import Base

def generate_uuid():
    return str(uuid.uuid4())

def utc_now():
    return datetime.now(timezone.utc)

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    datasets = relationship("Dataset", back_populates="workspace", cascade="all, delete-orphan")
    saved_queries = relationship("SavedQuery", back_populates="workspace", cascade="all, delete-orphan")
    metrics = relationship("Metric", back_populates="workspace", cascade="all, delete-orphan")
    dashboards = relationship("Dashboard", back_populates="workspace", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="workspace", cascade="all, delete-orphan")

class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=False)
    format = Column(String(20), nullable=False)  # csv, parquet
    row_count = Column(Integer, default=0)
    column_count = Column(Integer, default=0)
    status = Column(String(30), default="ready")  # uploaded, ingested, profiled, failed
    quality_score = Column(Float, default=100.0)
    table_name = Column(String(100), nullable=False)  # SQL identifier in DuckDB
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    workspace = relationship("Workspace", back_populates="datasets")
    columns = relationship("DatasetColumn", back_populates="dataset", cascade="all, delete-orphan")
    quality_issues = relationship("QualityIssue", back_populates="dataset", cascade="all, delete-orphan")
    insights = relationship("Insight", back_populates="dataset", cascade="all, delete-orphan")

class DatasetColumn(Base):
    __tablename__ = "dataset_columns"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), nullable=False)
    name = Column(String(100), nullable=False)
    data_type = Column(String(50), nullable=False)
    null_count = Column(Integer, default=0)
    distinct_count = Column(Integer, default=0)
    min_value = Column(String(100), nullable=True)
    max_value = Column(String(100), nullable=True)
    mean_value = Column(Float, nullable=True)
    median_value = Column(Float, nullable=True)
    std_dev = Column(Float, nullable=True)
    histogram_json = Column(Text, nullable=True)  # JSON-encoded bins and frequencies

    dataset = relationship("Dataset", back_populates="columns")

class QualityIssue(Base):
    __tablename__ = "quality_issues"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), nullable=False)
    severity = Column(String(20), nullable=False)  # critical, warning, info
    rule_type = Column(String(50), nullable=False) # missing_values, duplicate_keys, negative_values, schema_mismatch
    column_name = Column(String(100), nullable=True)
    message = Column(Text, nullable=False)
    affected_rows = Column(Integer, default=0)
    sample_records_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="quality_issues")

class SavedQuery(Base):
    __tablename__ = "saved_queries"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    sql_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    workspace = relationship("Workspace", back_populates="saved_queries")

class QueryHistory(Base):
    __tablename__ = "query_history"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), nullable=False)
    sql_text = Column(Text, nullable=False)
    duration_ms = Column(Float, default=0.0)
    row_count = Column(Integer, default=0)
    status = Column(String(20), default="success")  # success, error, timeout
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

class Metric(Base):
    __tablename__ = "metrics"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    sql_definition = Column(Text, nullable=False)
    grain = Column(String(100), nullable=False)
    unit = Column(String(50), default="units")
    time_dimension = Column(String(100), nullable=True)
    exclusions = Column(Text, nullable=True)
    limitations = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    workspace = relationship("Workspace", back_populates="metrics")

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    workspace = relationship("Workspace", back_populates="dashboards")
    widgets = relationship("Widget", back_populates="dashboard", cascade="all, delete-orphan")

class Widget(Base):
    __tablename__ = "widgets"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    dashboard_id = Column(String(36), ForeignKey("dashboards.id"), nullable=False)
    title = Column(String(150), nullable=False)
    widget_type = Column(String(50), nullable=False)  # line, bar, stacked_bar, scatter, kpi, table, area
    sql_query = Column(Text, nullable=False)
    config_json = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)

    dashboard = relationship("Dashboard", back_populates="widgets")

class Insight(Base):
    __tablename__ = "insights"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    dataset_id = Column(String(36), ForeignKey("datasets.id"), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(20), default="medium")  # high, medium, low
    category = Column(String(50), nullable=False)    # anomaly, trend, concentration, quality
    metric_name = Column(String(100), nullable=True)
    baseline_value = Column(Float, nullable=True)
    observed_value = Column(Float, nullable=True)
    relative_change_pct = Column(Float, nullable=True)
    evidence_query = Column(Text, nullable=False)
    status = Column(String(20), default="unreviewed")  # unreviewed, verified, dismissed
    created_at = Column(DateTime, default=utc_now)

    dataset = relationship("Dataset", back_populates="insights")

class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    title = Column(String(200), nullable=False)
    business_question = Column(Text, nullable=False)
    executive_summary = Column(Text, nullable=False)
    methodology = Column(Text, nullable=False)
    findings = Column(Text, nullable=False)
    recommendations = Column(Text, nullable=False)
    content_json = Column(Text, nullable=True)  # structured widgets, tables, insight references
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    workspace = relationship("Workspace", back_populates="reports")
