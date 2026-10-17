import time
import re
import uuid
from typing import Any
import duckdb
from apps.api.app.core.config import settings

FORBIDDEN_KEYWORDS = [
    r"\bDROP\b", r"\bDELETE\b", r"\bUPDATE\b", r"\bINSERT\b",
    r"\bALTER\b", r"\bTRUNCATE\b", r"\bATTACH\b", r"\bCOPY\b",
    r"\bEXPORT\b", r"\bPRAGMA\b", r"\bINSTALL\b", r"\bLOAD\b",
    r"\bCREATE\s+(?!TEMP|VIEW)", r"\bSYSTEM\b", r"\bEXEC\b"
]

class QueryService:
    def __init__(self):
        self.con = duckdb.connect(database=":memory:", read_only=False)
        self.registered_tables: dict[str, str] = {}

    def register_dataset(self, table_name: str, file_path: str, file_format: str):
        sanitized_table = re.sub(r"[^a-zA-Z0-9_]", "_", table_name).lower()
        if file_format == "parquet":
            self.con.execute(f"CREATE OR REPLACE VIEW {sanitized_table} AS SELECT * FROM read_parquet('{file_path}')")
        else:
            self.con.execute(f"CREATE OR REPLACE VIEW {sanitized_table} AS SELECT * FROM read_csv_auto('{file_path}', header=True)")
        self.registered_tables[sanitized_table] = file_path
        return sanitized_table

    def validate_sql(self, sql: str) -> None:
        trimmed = sql.strip().rstrip(";")
        if ";" in trimmed:
            raise ValueError("Multiple statements are prohibited for security.")
        
        upper_sql = trimmed.upper()
        for pattern in FORBIDDEN_KEYWORDS:
            if re.search(pattern, upper_sql):
                raise ValueError(f"Prohibited SQL command or statement detected: security sandbox violation.")

    def execute_query(self, sql: str, limit: int = 500) -> dict[str, Any]:
        start_time = time.perf_counter()
        execution_id = str(uuid.uuid4())
        
        try:
            self.validate_sql(sql)
            bounded_limit = min(limit, settings.QUERY_MAX_RESULT_ROWS)
            
            # Check if user already supplied LIMIT
            has_limit = bool(re.search(r"\bLIMIT\s+\d+\b", sql, re.IGNORECASE))
            run_sql = sql if has_limit else f"SELECT * FROM ({sql.strip().rstrip(';')}) AS __q LIMIT {bounded_limit + 1}"
            
            rel = self.con.sql(run_sql)
            columns = rel.columns
            column_types = [str(t) for t in rel.types]
            raw_rows = rel.fetchall()
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            
            is_truncated = len(raw_rows) > bounded_limit
            final_rows = raw_rows[:bounded_limit]
            
            # Format row values cleanly (e.g. timestamps, nulls)
            formatted_rows = []
            for row in final_rows:
                formatted_rows.append([None if v is None else str(v) if not isinstance(v, (int, float, bool)) else v for v in row])
                
            return {
                "execution_id": execution_id,
                "status": "success",
                "columns": columns,
                "column_types": column_types,
                "rows": formatted_rows,
                "row_count": len(formatted_rows),
                "duration_ms": duration_ms,
                "is_truncated": is_truncated,
                "error": None
            }
        except Exception as e:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "execution_id": execution_id,
                "status": "error",
                "columns": [],
                "column_types": [],
                "rows": [],
                "row_count": 0,
                "duration_ms": duration_ms,
                "is_truncated": False,
                "error": str(e)
            }

query_service = QueryService()
