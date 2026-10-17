import json
from typing import Any
import pandas as pd
import numpy as np

class ProfileService:
    @staticmethod
    def profile_dataframe(df: pd.DataFrame) -> tuple[list[dict[str, Any]], list[dict[str, Any]], float]:
        columns_profile = []
        quality_issues = []
        
        total_rows = len(df)
        total_cells = total_rows * len(df.columns) if total_rows > 0 else 1
        total_null_cells = 0
        total_invalid_cells = 0

        for col_name in df.columns:
            series = df[col_name]
            null_count = int(series.isnull().sum())
            total_null_cells += null_count
            distinct_count = int(series.nunique(dropna=True))
            
            dtype_str = str(series.dtype)
            min_val, max_val, mean_val, median_val, std_val = None, None, None, None, None
            histogram = None

            if pd.api.types.is_numeric_dtype(series):
                valid_num = series.dropna()
                if not valid_num.empty:
                    min_val = str(round(float(valid_num.min()), 4))
                    max_val = str(round(float(valid_num.max()), 4))
                    mean_val = round(float(valid_num.mean()), 4)
                    median_val = round(float(valid_num.median()), 4)
                    std_val = round(float(valid_num.std()), 4) if len(valid_num) > 1 else 0.0
                    
                    # Generate 10-bin histogram
                    try:
                        counts, bin_edges = np.histogram(valid_num, bins=min(10, max(2, distinct_count)))
                        histogram = {
                            "bins": [round(float(b), 2) for b in bin_edges],
                            "counts": [int(c) for c in counts]
                        }
                    except Exception:
                        histogram = None

                # Quality checks for numerics
                negative_count = int((valid_num < 0).sum()) if not valid_num.empty else 0
                if negative_count > 0 and col_name.lower() in ["price", "unitprice"]:
                    quality_issues.append({
                        "severity": "critical",
                        "rule_type": "invalid_numeric_range",
                        "column_name": col_name,
                        "message": f"Column '{col_name}' contains {negative_count} negative values, which violates unit price constraints.",
                        "affected_rows": negative_count,
                        "sample_records_json": json.dumps(df[series < 0].head(5).to_dict(orient="records"), default=str)
                    })
                    total_invalid_cells += negative_count
                elif negative_count > 0 and col_name.lower() in ["quantity"]:
                    # In retail, negative quantity often represents returns/cancellations
                    quality_issues.append({
                        "severity": "warning",
                        "rule_type": "negative_quantities",
                        "column_name": col_name,
                        "message": f"Column '{col_name}' contains {negative_count} negative items (likely returns or cancelled orders).",
                        "affected_rows": negative_count,
                        "sample_records_json": json.dumps(df[series < 0].head(5).to_dict(orient="records"), default=str)
                    })

            elif pd.api.types.is_datetime64_any_dtype(series):
                valid_dates = series.dropna()
                if not valid_dates.empty:
                    min_val = str(valid_dates.min())
                    max_val = str(valid_dates.max())
            else:
                # String / Categorical
                valid_str = series.dropna().astype(str)
                if not valid_str.empty:
                    top_vals = valid_str.value_counts().head(5).to_dict()
                    histogram = {"top_values": top_vals}

            # Check for missing values
            if null_count > 0:
                null_pct = (null_count / total_rows) * 100 if total_rows > 0 else 0
                severity = "critical" if null_pct > 25 else "warning" if null_pct > 5 else "info"
                quality_issues.append({
                    "severity": severity,
                    "rule_type": "missing_values",
                    "column_name": col_name,
                    "message": f"Column '{col_name}' has {null_count} missing values ({round(null_pct, 2)}% of dataset).",
                    "affected_rows": null_count,
                    "sample_records_json": json.dumps(df[series.isnull()].head(5).to_dict(orient="records"), default=str)
                })

            columns_profile.append({
                "name": col_name,
                "data_type": dtype_str,
                "null_count": null_count,
                "distinct_count": distinct_count,
                "min_value": min_val,
                "max_value": max_val,
                "mean_value": mean_val,
                "median_value": median_val,
                "std_dev": std_val,
                "histogram_json": json.dumps(histogram) if histogram else None
            })

        # Duplicate row check
        duplicate_rows = int(df.duplicated().sum())
        if duplicate_rows > 0:
            quality_issues.append({
                "severity": "warning",
                "rule_type": "duplicate_rows",
                "column_name": None,
                "message": f"Dataset contains {duplicate_rows} duplicate rows across all columns.",
                "affected_rows": duplicate_rows,
                "sample_records_json": json.dumps(df[df.duplicated()].head(5).to_dict(orient="records"), default=str)
            })

        # Explainable Quality Score Formula:
        # Completeness (40%), Validity (30%), Uniqueness (30%)
        completeness_score = max(0.0, 100.0 - (total_null_cells / total_cells * 100.0))
        validity_score = max(0.0, 100.0 - (total_invalid_cells / (total_rows or 1) * 100.0))
        uniqueness_score = max(0.0, 100.0 - (duplicate_rows / (total_rows or 1) * 100.0))
        
        overall_score = round(0.40 * completeness_score + 0.30 * validity_score + 0.30 * uniqueness_score, 1)

        return columns_profile, quality_issues, overall_score

profile_service = ProfileService()
