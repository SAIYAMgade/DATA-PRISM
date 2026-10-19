import pytest
from fastapi.testclient import TestClient
from apps.api.app.main import app

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_health(client):
    res = client.get("/api/v1/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "DATAPRISM"
    assert "timestamp" in data
    assert "uptime" in data

def test_root_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["service"] == "DATAPRISM"
    assert "timestamp" in data
    assert "uptime" in data
    assert data["uptime"] >= 0

def test_workspaces_and_datasets(client):
    res = client.get("/api/v1/workspaces")
    assert res.status_code == 200
    workspaces = res.json()
    assert len(workspaces) > 0
    ws_id = workspaces[0]["id"]

    ds_res = client.get(f"/api/v1/datasets?workspace_id={ws_id}")
    assert ds_res.status_code == 200
    datasets = ds_res.json()
    assert len(datasets) > 0
    assert datasets[0]["name"] == "UCI Online Retail II"
    assert datasets[0]["row_count"] == 5000

def test_sql_execution_success(client):
    res = client.get("/api/v1/workspaces")
    ws_id = res.json()[0]["id"]

    ds_res = client.get(f"/api/v1/datasets?workspace_id={ws_id}")
    table_name = ds_res.json()[0]["table_name"]

    query_payload = {
        "workspace_id": ws_id,
        "sql": f"SELECT Country, COUNT(*) AS count FROM {table_name} GROUP BY Country ORDER BY count DESC LIMIT 3"
    }
    q_res = client.post("/api/v1/queries/execute", json=query_payload)
    assert q_res.status_code == 200
    data = q_res.json()
    assert data["status"] == "success"
    assert len(data["columns"]) == 2
    assert len(data["rows"]) == 3

def test_sql_sandbox_prohibits_destructive_queries(client):
    res = client.get("/api/v1/workspaces")
    ws_id = res.json()[0]["id"]

    # Test DROP TABLE
    drop_payload = {
        "workspace_id": ws_id,
        "sql": "DROP TABLE test_table"
    }
    drop_res = client.post("/api/v1/queries/execute", json=drop_payload)
    assert drop_res.status_code == 200
    assert drop_res.json()["status"] == "error"
    assert "security sandbox violation" in drop_res.json()["error"].lower()

    # Test Multi-statement injection
    multi_payload = {
        "workspace_id": ws_id,
        "sql": "SELECT 1; SELECT 2;"
    }
    multi_res = client.post("/api/v1/queries/execute", json=multi_payload)
    assert multi_res.status_code == 200
    assert multi_res.json()["status"] == "error"
    assert "multiple statements are prohibited" in multi_res.json()["error"].lower()

def test_metrics_catalog(client):
    res = client.get("/api/v1/metrics")
    assert res.status_code == 200
    metrics = res.json()
    assert len(metrics) >= 5
    metric_names = [m["name"] for m in metrics]
    assert "Gross Revenue" in metric_names
    assert "Return Rate" in metric_names

def test_insights_detection(client):
    res = client.get("/api/v1/insights")
    assert res.status_code == 200
    insights = res.json()
    assert len(insights) > 0
    # Every insight must have an evidence query
    for ins in insights:
        assert ins["evidence_query"] != ""
        assert ins["title"] != ""

def test_dashboards_and_widgets(client):
    res = client.get("/api/v1/dashboards")
    assert res.status_code == 200
    dashboards = res.json()
    assert len(dashboards) > 0
    assert len(dashboards[0]["widgets"]) > 0

def test_decision_reports(client):
    res = client.get("/api/v1/reports")
    assert res.status_code == 200
    reports = res.json()
    assert len(reports) > 0
    assert "Q4 Commercial Health" in reports[0]["title"]

def test_ai_capabilities(client):
    res = client.get("/api/v1/ai/capabilities")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["sandbox_enforced"] is True
    assert "natural_language_to_sql" in data["features"]
    assert "ai_profile_summary" in data["features"]

def test_ai_profile_summary(client):
    # Fetch default dataset
    ds_res = client.get("/api/v1/datasets")
    assert ds_res.status_code == 200
    datasets = ds_res.json()
    assert len(datasets) > 0
    ds_id = datasets[0]["id"]

    res = client.post("/api/v1/ai/profile-summary", json={"dataset_id": ds_id})
    assert res.status_code == 200
    data = res.json()
    assert data["dataset_id"] == ds_id
    assert "Health" in data["health_grade"] or "Grade" in data["health_grade"]
    assert len(data["key_observations"]) > 0
    assert len(data["recommended_transformations"]) > 0
    assert data["quality_score"] == datasets[0]["quality_score"]
    assert "deterministic_metrics" in data

def test_nl_to_sql_valid_query(client):
    ws_res = client.get("/api/v1/workspaces")
    assert ws_res.status_code == 200
    ws_id = ws_res.json()[0]["id"]

    ds_res = client.get(f"/api/v1/datasets?workspace_id={ws_id}")
    assert ds_res.status_code == 200
    ds_id = ds_res.json()[0]["id"]

    payload = {
        "workspace_id": ws_id,
        "dataset_id": ds_id,
        "question": "What are the top 5 countries by revenue?",
        "execute": True
    }
    res = client.post("/api/v1/ai/nl-to-sql", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["validation_status"] == "valid"
    assert "SELECT" in data["generated_sql"].upper()
    assert "revenue" in data["generated_sql"].lower()
    assert "LIMIT 5" in data["generated_sql"].upper()
    assert data["suggested_visualization"] == "bar"
    assert data["query_result"] is not None
    assert data["query_result"]["status"] == "success"
    assert data["query_result"]["row_count"] == 5

def test_nl_to_sql_product_ranking(client):
    ws_res = client.get("/api/v1/workspaces")
    ws_id = ws_res.json()[0]["id"]

    payload = {
        "workspace_id": ws_id,
        "question": "Show top 3 products by sales",
        "execute": True
    }
    res = client.post("/api/v1/ai/nl-to-sql", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["validation_status"] == "valid"
    assert "product" in data["generated_sql"].lower() or "description" in data["generated_sql"].lower()
    assert data["query_result"]["row_count"] == 3

def test_dataset_ingestion_runs(client):
    ds_res = client.get("/api/v1/datasets")
    assert ds_res.status_code == 200
    datasets = ds_res.json()
    assert len(datasets) > 0
    ds_id = datasets[0]["id"]

    runs_res = client.get(f"/api/v1/datasets/{ds_id}/ingestion-runs")
    assert runs_res.status_code == 200
    runs = runs_res.json()
    # Runs should be a valid list
    assert isinstance(runs, list)


