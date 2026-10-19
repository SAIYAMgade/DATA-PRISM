# AI Analyst & Copilot Architecture

DATAPRISM provides an AI-assisted analytics layer designed around analytical correctness, deterministic metadata grounding, and secure execution.

## 1. Design Principles

1. **Deterministic Grounding (Zero Fabrication):**
   - The AI layer NEVER invents column names, schema types, or metric totals.
   - All analytical summaries evaluate verified database column profiles (`null_count`, `distinct_count`, `min_value`, `max_value`, `quality_score`).
   - If an LLM provider is unavailable or unconfigured, the system runs with the internal analytical heuristics engine without breaking.

2. **Sandbox Guardrails for Natural-Language-to-SQL (NL-to-SQL):**
   - User business questions are mapped directly to DuckDB SQL.
   - Before execution, all generated queries must pass `query_service.validate_sql(sql)`:
     - Destructive statements (`DROP`, `DELETE`, `INSERT`, `UPDATE`, `ALTER`, `TRUNCATE`, `CREATE`) are blocked.
     - Filesystem access (`COPY`, `ATTACH`, `EXPORT`, `PRAGMA`) is blocked.
     - Dangerous keywords (`LOAD`, `INSTALL`) are strictly forbidden.
   - Execution limits are enforced to prevent runaway queries.

3. **Multi-Modal Output:**
   - Every NL-to-SQL response returns:
     - The validated DuckDB SQL query.
     - Suggested visualization type (`bar`, `line`, `kpi`, `table`).
     - Plain-language narrative explaining the analytical findings.
     - Explicit data assumptions and limitations.
     - Executed tabular results and duration telemetry.

## 2. API Endpoints

- `GET /api/v1/ai/capabilities`: Returns current AI engine status and supported LLM providers.
- `POST /api/v1/ai/profile-summary`: Generates an AI quality audit and health grade (A/B/C/D) based on column statistics.
- `POST /api/v1/ai/nl-to-sql`: Translates a natural language question into validated SQL and executes it safely in the DuckDB sandbox.

## 3. Provenance & Ingestion Telemetry

- **Source-to-Target Reconciliation:**
  - Every ingestion calculates a SHA-256 file checksum (`file_checksum`).
  - Records execution metrics: `rows_read`, `rows_inserted`, `rows_rejected`, and `processing_duration_ms`.
  - Ingestion run history is persisted in `IngestionRun` records.
