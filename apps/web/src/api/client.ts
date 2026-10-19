const API_BASE = "/api/v1";

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ColumnProfile {
  id: string;
  name: string;
  data_type: string;
  null_count: number;
  distinct_count: number;
  min_value?: string;
  max_value?: string;
  mean_value?: number;
  median_value?: number;
  std_dev?: number;
  histogram_json?: string;
}

export interface QualityIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  rule_type: string;
  column_name?: string;
  message: string;
  affected_rows: number;
  sample_records_json?: string;
  created_at: string;
}

export interface Dataset {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  format: string;
  row_count: number;
  column_count: number;
  status: string;
  quality_score: number;
  table_name: string;
  file_checksum?: string;
  rows_read?: number;
  rows_inserted?: number;
  rows_rejected?: number;
  processing_duration_ms?: number;
  created_at: string;
  updated_at: string;
  columns: ColumnProfile[];
  quality_issues: QualityIssue[];
}

export interface QueryResult {
  execution_id: string;
  status: "success" | "error";
  columns: string[];
  column_types: string[];
  rows: any[][];
  row_count: number;
  duration_ms: number;
  is_truncated: boolean;
  error?: string;
}

export interface SavedQuery {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  sql_text: string;
  created_at: string;
}

export interface QueryHistoryItem {
  id: string;
  sql_text: string;
  duration_ms: number;
  row_count: number;
  status: string;
  error_message?: string;
  created_at: string;
}

export interface Metric {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  sql_definition: string;
  grain: string;
  unit: string;
  time_dimension?: string;
  exclusions?: string;
  limitations?: string;
  created_at: string;
}

export interface Widget {
  id: string;
  dashboard_id: string;
  title: string;
  widget_type: string;
  sql_query: string;
  config_json?: string;
  order_index: number;
}

export interface Dashboard {
  id: string;
  workspace_id: string;
  name: string;
  description?: string;
  created_at: string;
  widgets: Widget[];
}

export interface Insight {
  id: string;
  dataset_id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  metric_name?: string;
  baseline_value?: number;
  observed_value?: number;
  relative_change_pct?: number;
  evidence_query: string;
  status: string;
  created_at: string;
}

export interface Report {
  id: string;
  workspace_id: string;
  title: string;
  business_question: string;
  executive_summary: string;
  methodology: string;
  findings: string;
  recommendations: string;
  content_json?: string;
  created_at: string;
}

export const api = {
  getHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },
  getWorkspaces: async (): Promise<Workspace[]> => {
    const res = await fetch(`${API_BASE}/workspaces`);
    return res.json();
  },
  getDatasets: async (workspaceId?: string): Promise<Dataset[]> => {
    const url = workspaceId ? `${API_BASE}/datasets?workspace_id=${workspaceId}` : `${API_BASE}/datasets`;
    const res = await fetch(url);
    return res.json();
  },
  getDataset: async (id: string): Promise<Dataset> => {
    const res = await fetch(`${API_BASE}/datasets/${id}`);
    return res.json();
  },
  uploadDataset: async (formData: FormData): Promise<Dataset> => {
    const res = await fetch(`${API_BASE}/datasets/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Upload failed");
    }
    return res.json();
  },
  executeQuery: async (workspaceId: string, sql: string, limit = 500): Promise<QueryResult> => {
    const res = await fetch(`${API_BASE}/queries/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, sql, limit }),
    });
    return res.json();
  },
  getQueryHistory: async (workspaceId?: string): Promise<QueryHistoryItem[]> => {
    const url = workspaceId ? `${API_BASE}/queries/history?workspace_id=${workspaceId}` : `${API_BASE}/queries/history`;
    const res = await fetch(url);
    return res.json();
  },
  getSavedQueries: async (workspaceId?: string): Promise<SavedQuery[]> => {
    const url = workspaceId ? `${API_BASE}/saved-queries?workspace_id=${workspaceId}` : `${API_BASE}/saved-queries`;
    const res = await fetch(url);
    return res.json();
  },
  saveQuery: async (workspaceId: string, name: string, sql_text: string, description?: string): Promise<SavedQuery> => {
    const res = await fetch(`${API_BASE}/saved-queries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, name, sql_text, description }),
    });
    return res.json();
  },
  getMetrics: async (workspaceId?: string): Promise<Metric[]> => {
    const url = workspaceId ? `${API_BASE}/metrics?workspace_id=${workspaceId}` : `${API_BASE}/metrics`;
    const res = await fetch(url);
    return res.json();
  },
  createMetric: async (data: Omit<Metric, "id" | "created_at">): Promise<Metric> => {
    const res = await fetch(`${API_BASE}/metrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getDashboards: async (workspaceId?: string): Promise<Dashboard[]> => {
    const url = workspaceId ? `${API_BASE}/dashboards?workspace_id=${workspaceId}` : `${API_BASE}/dashboards`;
    const res = await fetch(url);
    return res.json();
  },
  getInsights: async (datasetId?: string): Promise<Insight[]> => {
    const url = datasetId ? `${API_BASE}/insights?dataset_id=${datasetId}` : `${API_BASE}/insights`;
    const res = await fetch(url);
    return res.json();
  },
  reviewInsight: async (insightId: string, status: "verified" | "dismissed"): Promise<Insight> => {
    const res = await fetch(`${API_BASE}/insights/${insightId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return res.json();
  },
  getReports: async (workspaceId?: string): Promise<Report[]> => {
    const url = workspaceId ? `${API_BASE}/reports?workspace_id=${workspaceId}` : `${API_BASE}/reports`;
    const res = await fetch(url);
    return res.json();
  },
  createReport: async (data: Omit<Report, "id" | "created_at" | "updated_at">): Promise<Report> => {
    const res = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  getModelLineage: async () => {
    const res = await fetch(`${API_BASE}/models/lineage`);
    return res.json();
  },
  getIngestionRuns: async (datasetId: string): Promise<IngestionRun[]> => {
    const res = await fetch(`${API_BASE}/datasets/${datasetId}/ingestion-runs`);
    return res.json();
  },
  getAIProfileSummary: async (datasetId: string): Promise<AIProfileSummary> => {
    const res = await fetch(`${API_BASE}/ai/profile-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: datasetId }),
    });
    return res.json();
  },
  nlToSql: async (workspaceId: string, question: string, datasetId?: string): Promise<NLToSqlResult> => {
    const res = await fetch(`${API_BASE}/ai/nl-to-sql`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: workspaceId, question, dataset_id: datasetId, execute: true }),
    });
    return res.json();
  },
};

export interface IngestionRun {
  id: string;
  dataset_id?: string;
  source_id: string;
  source_name: string;
  original_filename: string;
  file_checksum?: string;
  start_time: string;
  completion_time?: string;
  status: string;
  rows_read: number;
  rows_inserted: number;
  rows_updated: number;
  rows_rejected: number;
  error_details?: string;
  detected_schema?: string;
  processing_duration_ms: number;
  created_at: string;
}

export interface AIProfileSummary {
  dataset_id: string;
  dataset_name: string;
  quality_score: number;
  health_grade: string;
  executive_summary: string;
  key_observations: string[];
  risk_factors: string[];
  recommended_transformations: string[];
  deterministic_metrics: Record<string, any>;
  provider: string;
  ai_disclaimer: string;
}

export interface NLToSqlResult {
  question: string;
  dataset_id: string;
  table_name: string;
  generated_sql: string;
  validation_status: string;
  explanation: string;
  suggested_visualization: string;
  data_limitations?: string;
  query_result?: QueryResult;
  provider: string;
}

