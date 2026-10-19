import os
import time
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from fastapi.staticfiles import StaticFiles
from apps.api.app.core.config import settings, SERVER_START_TIME
from apps.api.app.db.session import engine, SessionLocal, Base
from apps.api.app.models.entities import Workspace, Dataset, Metric, SavedQuery, Dashboard, Widget, Report, IngestionRun
from apps.api.app.api.v1.api import router as api_v1_router
from apps.api.app.services.ingest_service import ingest_service
from apps.api.app.services.query_service import query_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    Base.metadata.create_all(bind=engine)

    # Safe column migrations for existing SQLite database
    with engine.connect() as conn:
        for col_name, col_type in [
            ("file_checksum", "VARCHAR(64)"),
            ("rows_read", "INTEGER DEFAULT 0"),
            ("rows_inserted", "INTEGER DEFAULT 0"),
            ("rows_rejected", "INTEGER DEFAULT 0"),
            ("processing_duration_ms", "FLOAT DEFAULT 0.0"),
            ("source_id", "VARCHAR(100)"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE datasets ADD COLUMN {col_name} {col_type}"))
                conn.commit()
            except Exception:
                pass
    
    db = SessionLocal()
    try:
        # 1. Register existing datasets in DuckDB
        for existing_ds in db.query(Dataset).all():
            if Path(existing_ds.file_path).exists():
                query_service.register_dataset(existing_ds.table_name, existing_ds.file_path, existing_ds.format)

        # 2. Seed default workspace and sample dataset if not present
        ws = db.query(Workspace).filter(Workspace.name == "Demo Workspace").first()
        if not ws:
            ws = Workspace(
                name="Demo Workspace",
                description="Default analytics intelligence workspace for retail, finance, and operations analytics."
            )
            db.add(ws)
            db.commit()
            db.refresh(ws)

        sample_csv = settings.SAMPLE_DIR / "online_retail_ii.csv"
        if sample_csv.exists() and not ws.datasets:
            print("Seeding flagship UCI Online Retail II dataset...")
            ds = ingest_service.ingest_file(
                db=db,
                workspace_id=ws.id,
                name="UCI Online Retail II",
                file_path=sample_csv,
                file_format="csv",
                description="Real-world e-commerce non-store transactions (UCI Online Retail II) spanning global orders, cancellations, and products."
            )
            
            # Seed governed metrics
            metrics_data = [
                {
                    "name": "Gross Revenue",
                    "description": "Sum of transaction line values for positive quantity and price.",
                    "sql_definition": f"SUM(CASE WHEN Quantity > 0 AND Price > 0 AND Invoice NOT LIKE 'C%' THEN Quantity * Price ELSE 0 END)",
                    "grain": "Transaction item line",
                    "unit": "GBP (£)",
                    "exclusions": "Cancelled transactions (Invoice LIKE 'C%') and non-positive prices."
                },
                {
                    "name": "Net Revenue",
                    "description": "Total sales revenue net of returns and order cancellations.",
                    "sql_definition": f"SUM(CASE WHEN Price > 0 THEN Quantity * Price ELSE 0 END)",
                    "grain": "Transaction item line",
                    "unit": "GBP (£)",
                    "exclusions": "None (negative quantities deducted directly)."
                },
                {
                    "name": "Active Customers",
                    "description": "Count of distinct registered customer identifiers.",
                    "sql_definition": f"COUNT(DISTINCT CustomerID)",
                    "grain": "Distinct customer",
                    "unit": "Customers",
                    "exclusions": "Guest checkouts where CustomerID is null."
                },
                {
                    "name": "Average Order Value (AOV)",
                    "description": "Average gross transaction value per completed order invoice.",
                    "sql_definition": f"ROUND(SUM(CASE WHEN Quantity > 0 AND Price > 0 AND Invoice NOT LIKE 'C%' THEN Quantity * Price ELSE 0 END) / COUNT(DISTINCT CASE WHEN Quantity > 0 AND Invoice NOT LIKE 'C%' THEN Invoice END), 2)",
                    "grain": "Per Invoice",
                    "unit": "GBP (£) per order",
                    "exclusions": "Cancelled invoices."
                },
                {
                    "name": "Return Rate",
                    "description": "Percentage of transactions marked as cancelled.",
                    "sql_definition": f"ROUND(COUNT(DISTINCT CASE WHEN Invoice LIKE 'C%' THEN Invoice END) * 100.0 / COUNT(DISTINCT Invoice), 2)",
                    "grain": "Invoice percentage",
                    "unit": "%",
                    "exclusions": "None."
                }
            ]
            for m in metrics_data:
                db.add(Metric(workspace_id=ws.id, **m))

            # Seed saved queries
            queries_data = [
                {
                    "name": "Monthly Sales Performance",
                    "description": "Aggregated monthly gross sales and distinct order count.",
                    "sql_text": f"SELECT strftime(CAST(InvoiceDate AS TIMESTAMP), '%Y-%m') AS month, ROUND(SUM(Quantity * Price), 2) AS gross_sales, COUNT(DISTINCT Invoice) AS order_count FROM {ds.table_name} WHERE Quantity > 0 GROUP BY 1 ORDER BY 1"
                },
                {
                    "name": "Top 10 Products by Revenue",
                    "description": "Top revenue-generating catalog items.",
                    "sql_text": f"SELECT Description, StockCode, ROUND(SUM(Quantity * Price), 2) AS total_revenue, SUM(Quantity) AS units_sold FROM {ds.table_name} WHERE Quantity > 0 AND Price > 0 GROUP BY Description, StockCode ORDER BY total_revenue DESC LIMIT 10"
                },
                {
                    "name": "Geographic Market Contribution",
                    "description": "Revenue breakdown across international buyer markets.",
                    "sql_text": f"SELECT Country, ROUND(SUM(Quantity * Price), 2) AS revenue, COUNT(DISTINCT Invoice) AS invoices FROM {ds.table_name} WHERE Quantity > 0 GROUP BY Country ORDER BY revenue DESC LIMIT 10"
                }
            ]
            for q in queries_data:
                db.add(SavedQuery(workspace_id=ws.id, **q))

            # Seed Executive Dashboard
            dash = Dashboard(
                workspace_id=ws.id,
                name="Executive Retail Performance",
                description="Core KPI performance, international sales mix, and daily sales trends."
            )
            db.add(dash)
            db.flush()

            widgets_data = [
                {
                    "title": "Monthly Sales Trend",
                    "widget_type": "line",
                    "sql_query": f"SELECT strftime(CAST(InvoiceDate AS TIMESTAMP), '%Y-%m') AS date, ROUND(SUM(Quantity * Price), 2) AS sales FROM {ds.table_name} WHERE Quantity > 0 GROUP BY 1 ORDER BY 1",
                    "order_index": 0
                },
                {
                    "title": "Revenue by Market",
                    "widget_type": "bar",
                    "sql_query": f"SELECT Country AS country, ROUND(SUM(Quantity * Price), 2) AS revenue FROM {ds.table_name} WHERE Quantity > 0 GROUP BY 1 ORDER BY revenue DESC LIMIT 7",
                    "order_index": 1
                },
                {
                    "title": "Top Products Contribution",
                    "widget_type": "bar",
                    "sql_query": f"SELECT Description AS product, ROUND(SUM(Quantity * Price), 2) AS revenue FROM {ds.table_name} WHERE Quantity > 0 GROUP BY 1 ORDER BY revenue DESC LIMIT 8",
                    "order_index": 2
                },
                {
                    "title": "Order Size vs Price Distribution",
                    "widget_type": "scatter",
                    "sql_query": f"SELECT Price AS price, Quantity AS quantity FROM {ds.table_name} WHERE Quantity > 0 AND Quantity < 100 AND Price < 20 LIMIT 300",
                    "order_index": 3
                }
            ]
            for w in widgets_data:
                db.add(Widget(dashboard_id=dash.id, **w))

            # Seed Decision Report
            db.add(Report(
                workspace_id=ws.id,
                title="Q4 Commercial Health & Margin Optimization Report",
                business_question="What are the primary drivers of revenue growth, and how severely do return rates erode gross margins?",
                executive_summary="The business generated strong top-line sales with international expansion in Western Europe. However, UK transaction concentration remains high (>80%), and order return rates of ~4% require targeted quality intervention.",
                methodology="Extracted 5,000 transaction line records from UCI Online Retail II. Normalized invoice types, isolated cancellations, and calculated gross vs. net contribution.",
                findings="- Top 10 products generate over 35% of total gross sales.\n- UK constitutes the majority market, while Germany and France show the highest order value growth.\n- Cancellations account for £1,200+ in lost line item value.",
                recommendations="1. Introduce automated customer re-engagement for wholesale accounts.\n2. Audit return reasons for top cancelled product codes.\n3. Expand dedicated localization in the French and German markets."
            ))

            db.commit()
    finally:
        db.close()

    yield

app = FastAPI(
    title=settings.APP_NAME,
    description="DATAPRISM: Analytics Workspace (See the data. Understand the signal. Make better decisions.)",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix="/api/v1")

@app.get("/health")
def root_health():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": round(time.time() - SERVER_START_TIME, 2),
        "environment": settings.APP_ENV,
        "query_engine": "DuckDB in-process",
        "metadata_store": "ready"
    }

# Mount frontend if built
dist_dir = Path(__file__).resolve().parent.parent.parent / "web" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=dist_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("apps.api.app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)
