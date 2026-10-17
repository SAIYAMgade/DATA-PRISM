# DATAPRISM: Testing Strategy

## Test Layers
1. **Backend Unit Tests (pytest):**
   - Ingestion: CSV and Parquet parsing, schema inference, malformed files.
   - Profiling & Quality: Quantile accuracy, missing count, quality score formula.
   - SQL Security: Rejection of `DROP`, `DELETE`, `ATTACH`, syntax errors, timeout triggers.
   - Insight Engine: Deterministic detection of outlier spikes and category concentrations.
2. **Database Integration Tests:**
   - Persistence of datasets, queries, metrics, dashboards, and reports across restarts.
3. **Frontend Tests & Production Build:**
   - Type-checking with `tsc --noEmit`.
   - Production bundle verification via `vite build`.
4. **End-to-End Verification:**
   - Ingest sample dataset -> profile -> execute SQL -> inspect metrics -> build dashboard -> view insight -> review report.
