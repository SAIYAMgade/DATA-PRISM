# DATAPRISM: Security Architecture & Sandbox Controls

## 1. Threat Model & Principles
- All user-supplied input (uploaded files, column names, SQL statements) is treated as untrusted.
- Client requests must never execute arbitrary shell commands or unvalidated filesystem reads.

## 2. SQL Execution Sandbox
- User-submitted queries run via DuckDB connections restricted to read-only views of verified datasets.
- Destructive and structural SQL statements (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `ATTACH`, `COPY`, `EXPORT`, `PRAGMA`) are strictly rejected by parser and execution controls.
- Hard resource bounds:
  - Query execution timeout: configurable, default 30 seconds.
  - Query result truncation: max 1,000 rows returned per HTTP response.

## 3. Storage & Ingestion Security
- Uploaded files are assigned cryptographic UUID filenames in a dedicated, isolated storage directory (`data/uploads`).
- Path traversal sequences (`../`, `..\`) are stripped and rejected.
- File extensions and magic headers are validated for CSV and Parquet formats.
- Upload file size limits (50 MB default) enforced before processing.

## 4. API & Authentication
- Role-based authorization per workspace (Owner, Editor, Viewer).
- Secrets are excluded from version control and accessed only through environment variables.
