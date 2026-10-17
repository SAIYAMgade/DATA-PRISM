# DATAPRISM: Product Specification
**Product Tagline:** See the data. Understand the signal. Make better decisions.

## 1. Product Overview
DATAPRISM is an analytics workspace that connects the entire data-to-decision lifecycle:
1. **Data Ingestion:** Upload CSV and Parquet files with conservative schema inference and normalization.
2. **Data Profiling & Quality:** Real column statistics (cardinality, quantiles, distributions) and configurable data quality checks with explainable scoring formulas.
3. **SQL Workbench:** Fast, secure, read-only SQL exploration powered by embedded DuckDB and PostgreSQL. Enforces execution timeouts, bounded result sets, and syntax guards.
4. **Analytical Modeling & Lineage:** Clean modeling layers (staging, intermediate, marts) with verified dependency tracking.
5. **Metric Catalog & Governance:** Authoritative metric definitions with explicit grain, calculation rules, exclusions, and limitations.
6. **Interactive Dashboard Builder:** Dynamic dashboard editor supporting Line, Bar, Scatter, Area, Heatmap, and KPI cards with coordinated date, categorical, and numeric filters.
7. **Insight Discovery Engine:** Deterministic, statistical detection of anomalies, period-over-period shifts, and category concentrations with reproducible query evidence.
8. **Decision Reports:** Markdown & structured executive reports linking business questions, key metrics, charts, findings, and evidence.

## 2. Personas & Workflows
- **Analytics Engineer / Data Engineer:** Ingests raw data, validates quality rules, configures models, and governs metric definitions.
- **Data Analyst:** Explores tables with the SQL Workbench, builds widgets, and investigates statistical anomalies.
- **Business Stakeholder / Decision Maker:** Consumes interactive dashboards, reviews flagged insights, and reads verified decision reports.
