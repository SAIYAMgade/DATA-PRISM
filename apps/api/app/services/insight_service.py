from typing import Any
import pandas as pd
import numpy as np

class InsightService:
    @staticmethod
    def detect_insights(df: pd.DataFrame, dataset_id: str, table_name: str) -> list[dict[str, Any]]:
        insights = []
        
        # Check if dataset has retail/transaction shape (Quantity, Price, CustomerID, Country)
        cols_lower = {c.lower(): c for c in df.columns}
        has_qty = "quantity" in cols_lower
        has_price = "price" in cols_lower or "unitprice" in cols_lower
        has_country = "country" in cols_lower
        has_invoice = "invoice" in cols_lower or "invoiceno" in cols_lower

        if has_qty and has_price:
            qty_col = cols_lower["quantity"]
            price_col = cols_lower["price"] if "price" in cols_lower else cols_lower["unitprice"]
            
            # 1. Negative quantity (returns) impact insight
            returns_df = df[df[qty_col] < 0]
            total_rows = len(df)
            if not returns_df.empty and total_rows > 0:
                return_count = len(returns_df)
                return_rate = round((return_count / total_rows) * 100, 2)
                if return_rate > 1.0:
                    insights.append({
                        "dataset_id": dataset_id,
                        "title": f"Significant Return/Cancellation Volume ({return_rate}%)",
                        "description": f"Detected {return_count} return/cancellation transactions ({return_rate}% of all entries). These distort standard gross revenue totals if unhandled.",
                        "severity": "high" if return_rate > 5.0 else "medium",
                        "category": "anomaly",
                        "metric_name": "Return Rate",
                        "baseline_value": 1.0,
                        "observed_value": return_rate,
                        "relative_change_pct": round(return_rate - 1.0, 2),
                        "evidence_query": f"SELECT COUNT(*) AS return_count, ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM {table_name}), 2) AS return_rate_pct FROM {table_name} WHERE {qty_col} < 0",
                        "status": "unreviewed"
                    })

            # Calculate line total
            valid_sales = df[(df[qty_col] > 0) & (df[price_col] > 0)].copy()
            if not valid_sales.empty:
                valid_sales["line_total"] = valid_sales[qty_col] * valid_sales[price_col]
                total_rev = valid_sales["line_total"].sum()

                # 2. Geographic / Category Concentration
                if has_country and total_rev > 0:
                    country_col = cols_lower["country"]
                    country_rev = valid_sales.groupby(country_col)["line_total"].sum().sort_values(ascending=False)
                    top_country = country_rev.index[0]
                    top_country_share = round((country_rev.iloc[0] / total_rev) * 100, 2)
                    
                    if top_country_share > 50.0:
                        insights.append({
                            "dataset_id": dataset_id,
                            "title": f"High Geographic Concentration in {top_country} ({top_country_share}%)",
                            "description": f"A single market ({top_country}) contributes {top_country_share}% of all gross revenue. Regional market shifts in this geography represent a primary business driver.",
                            "severity": "medium",
                            "category": "concentration",
                            "metric_name": "Market Share",
                            "baseline_value": 20.0,
                            "observed_value": top_country_share,
                            "relative_change_pct": round(top_country_share - 20.0, 2),
                            "evidence_query": f"SELECT {country_col}, ROUND(SUM({qty_col} * {price_col}), 2) AS revenue, ROUND(SUM({qty_col} * {price_col}) * 100.0 / {round(total_rev, 2)}, 2) AS share_pct FROM {table_name} WHERE {qty_col} > 0 AND {price_col} > 0 GROUP BY {country_col} ORDER BY revenue DESC LIMIT 5",
                            "status": "unreviewed"
                        })

                # 3. High Value Outlier Transaction Detection
                median_line = valid_sales["line_total"].median()
                q75 = valid_sales["line_total"].quantile(0.75)
                q25 = valid_sales["line_total"].quantile(0.25)
                iqr = q75 - q25
                outlier_threshold = q75 + (3 * iqr) if iqr > 0 else median_line * 5
                
                outliers = valid_sales[valid_sales["line_total"] > outlier_threshold]
                if len(outliers) > 0:
                    outlier_rev = outliers["line_total"].sum()
                    outlier_share = round((outlier_rev / total_rev) * 100, 2)
                    insights.append({
                        "dataset_id": dataset_id,
                        "title": f"Outlier High-Value Purchases ({len(outliers)} transactions, {outlier_share}% of revenue)",
                        "description": f"Detected {len(outliers)} transactions exceeding the statistical threshold (> £{round(outlier_threshold, 2)}). These represent bulk wholesale orders.",
                        "severity": "info",
                        "category": "anomaly",
                        "metric_name": "Outlier Revenue Share",
                        "baseline_value": 0.0,
                        "observed_value": outlier_share,
                        "relative_change_pct": outlier_share,
                        "evidence_query": f"SELECT * FROM {table_name} WHERE {qty_col} * {price_col} > {round(outlier_threshold, 2)} ORDER BY {qty_col} * {price_col} DESC LIMIT 10",
                        "status": "unreviewed"
                    })

        return insights

insight_service = InsightService()
