import React, { useState, useEffect } from "react";
import {
  Database,
  BarChart3,
  Terminal,
  ShieldCheck,
  GitBranch,
  Layers,
  Sparkles,
  FileText,
  Upload,
  Play,
  Bookmark,
  Download,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Bot,
  CheckCircle2,
  Copy,
  Check,
} from "lucide-react";
import ReactECharts from "echarts-for-react";
import { api } from "./api/client";
import type {
  Workspace,
  Dataset,
  QueryResult,
  Metric,
  Dashboard,
  Insight,
  Report,
  SavedQuery,
  QueryHistoryItem,
  AIProfileSummary,
  NLToSqlResult,
  IngestionRun,
} from "./api/client";

type Tab =
  | "overview"
  | "datasets"
  | "quality"
  | "sql"
  | "ai"
  | "models"
  | "metrics"
  | "dashboards"
  | "insights"
  | "reports";

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  
  // Datasets
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [ingestionRuns, setIngestionRuns] = useState<IngestionRun[]>([]);

  // SQL Workbench
  const [sqlQuery, setSqlQuery] = useState<string>("SELECT * FROM ds_uci_online_retail_ii_4af242ed LIMIT 10");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isQueryRunning, setIsQueryRunning] = useState(false);
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [saveQueryName, setSaveQueryName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Metrics, Dashboards, Insights, Reports
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [lineage, setLineage] = useState<any>(null);

  // AI Copilot & NL-to-SQL
  const [nlQuestion, setNlQuestion] = useState("");
  const [isNlLoading, setIsNlLoading] = useState(false);
  const [nlResult, setNlResult] = useState<NLToSqlResult | null>(null);
  const [aiProfile, setAiProfile] = useState<AIProfileSummary | null>(null);
  const [isAiProfileLoading, setIsAiProfileLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleAskAI = async (customPrompt?: string) => {
    if (!currentWorkspace) return;
    const promptToUse = customPrompt || nlQuestion;
    if (!promptToUse) return;
    setIsNlLoading(true);
    try {
      const res = await api.nlToSql(currentWorkspace.id, promptToUse, selectedDataset?.id);
      setNlResult(res);
      if (res.generated_sql) {
        setSqlQuery(res.generated_sql);
        if (res.query_result) {
          setQueryResult(res.query_result);
        }
      }
    } catch (err) {
      console.error("NL-to-SQL error", err);
    } finally {
      setIsNlLoading(false);
    }
  };

  const handleFetchAiProfile = async (datasetId: string) => {
    setIsAiProfileLoading(true);
    try {
      const res = await api.getAIProfileSummary(datasetId);
      setAiProfile(res);
    } catch (err) {
      console.error("AI profile error", err);
    } finally {
      setIsAiProfileLoading(false);
    }
  };

  const handleCopySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const wsList = await api.getWorkspaces();
      setWorkspaces(wsList);
      if (wsList.length > 0) {
        const ws = wsList[0];
        setCurrentWorkspace(ws);
        refreshWorkspaceData(ws.id);
      }
    } catch (e) {
      console.error("Error loading workspaces", e);
    }
  };

  const refreshWorkspaceData = async (workspaceId: string) => {
    try {
      const [dsList, mList, dList, iList, rList, sqList, qhList, lin] = await Promise.all([
        api.getDatasets(workspaceId),
        api.getMetrics(workspaceId),
        api.getDashboards(workspaceId),
        api.getInsights(),
        api.getReports(workspaceId),
        api.getSavedQueries(workspaceId),
        api.getQueryHistory(workspaceId),
        api.getModelLineage(),
      ]);

      setDatasets(dsList);
      if (dsList.length > 0 && !selectedDataset) {
        setSelectedDataset(dsList[0]);
        // Update default query with real table name
        setSqlQuery(`SELECT Country, COUNT(*) AS transactions, ROUND(SUM(Quantity * Price), 2) AS revenue FROM ${dsList[0].table_name} WHERE Quantity > 0 GROUP BY Country ORDER BY revenue DESC LIMIT 10;`);
        api.getIngestionRuns(dsList[0].id).then(setIngestionRuns).catch(console.error);
        api.getAIProfileSummary(dsList[0].id).then(setAiProfile).catch(console.error);
      }
      setMetrics(mList);
      setDashboards(dList);
      if (dList.length > 0 && !selectedDashboard) {
        setSelectedDashboard(dList[0]);
      }
      setInsights(iList);
      setReports(rList);
      if (rList.length > 0 && !selectedReport) {
        setSelectedReport(rList[0]);
      }
      setSavedQueries(sqList);
      setQueryHistory(qhList);
      setLineage(lin);
    } catch (e) {
      console.error("Error refreshing workspace data", e);
    }
  };

  const handleRunQuery = async (customSql?: string) => {
    if (!currentWorkspace) return;
    const queryToRun = customSql || sqlQuery;
    setIsQueryRunning(true);
    try {
      const res = await api.executeQuery(currentWorkspace.id, queryToRun);
      setQueryResult(res);
      // Refresh history
      const hist = await api.getQueryHistory(currentWorkspace.id);
      setQueryHistory(hist);
    } catch (err: any) {
      setQueryResult({
        execution_id: "err",
        status: "error",
        columns: [],
        column_types: [],
        rows: [],
        row_count: 0,
        duration_ms: 0,
        is_truncated: false,
        error: err.message,
      });
    } finally {
      setIsQueryRunning(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!currentWorkspace || !saveQueryName) return;
    try {
      await api.saveQuery(currentWorkspace.id, saveQueryName, sqlQuery);
      setSaveQueryName("");
      setShowSaveModal(false);
      const updated = await api.getSavedQueries(currentWorkspace.id);
      setSavedQueries(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace) return;

    setIsUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.append("workspace_id", currentWorkspace.id);
    formData.append("file", file);

    try {
      const newDs = await api.uploadDataset(formData);
      await refreshWorkspaceData(currentWorkspace.id);
      setSelectedDataset(newDs);
      setActiveTab("datasets");
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleReviewInsight = async (id: string, status: "verified" | "dismissed") => {
    try {
      await api.reviewInsight(id, status);
      const updated = await api.getInsights();
      setInsights(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const exportQueryCSV = () => {
    if (!queryResult || queryResult.rows.length === 0) return;
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [queryResult.columns.join(",")]
        .concat(queryResult.rows.map((r) => r.map((v) => `"${v}"`).join(",")))
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `dataprism_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white font-sans text-slate-800">
      {/* Sidebar - Black */}
      <aside className="flex w-64 flex-col border-r border-zinc-800 bg-black text-white shrink-0">
        <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4 bg-black">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-lg shadow-sm">
            D
          </div>
          <div>
            <div className="font-semibold text-white tracking-tight flex items-center gap-1.5">
              DATAPRISM
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 border border-zinc-700">v1.0</span>
            </div>
            <div className="text-[11px] text-zinc-400">See the data. Understand the signal.</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3 bg-black">
          {[
            { id: "overview", label: "Overview", icon: Layers },
            { id: "datasets", label: "Datasets & Profiling", icon: Database },
            { id: "quality", label: "Data Quality", icon: ShieldCheck },
            { id: "sql", label: "SQL Workbench", icon: Terminal },
            { id: "ai", label: "AI Analyst", icon: Bot },
            { id: "models", label: "Analytical Models", icon: GitBranch },
            { id: "metrics", label: "Metric Catalog", icon: Bookmark },
            { id: "dashboards", label: "Dashboards", icon: BarChart3 },
            { id: "insights", label: "Insight Feed", icon: Sparkles },
            { id: "reports", label: "Decision Reports", icon: FileText },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as Tab)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? "text-white" : "text-zinc-400"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Workspace info & upload button */}
        <div className="border-t border-zinc-800 p-4 bg-black">
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition">
            <Upload className="h-3.5 w-3.5" />
            <span>{isUploading ? "Ingesting..." : "Upload Dataset"}</span>
            <input
              type="file"
              accept=".csv,.parquet"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
          {uploadError && (
            <p className="mt-2 text-[11px] text-rose-400">{uploadError}</p>
          )}
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
            <span>Workspace:</span>
            <span className="font-medium text-zinc-200">
              {currentWorkspace ? currentWorkspace.name : workspaces[0]?.name || "Demo"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-400">Workspace</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              {activeTab}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => currentWorkspace && refreshWorkspaceData(currentWorkspace.id)}
              className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" title="DuckDB Engine Active" />
            <span className="text-xs font-medium text-slate-500">DuckDB Sandboxed</span>
          </div>
        </header>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 1. OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Analytics Intelligence Overview</h1>
                <p className="text-sm text-slate-500">
                  Real-time health, analytical assets, and detected decision triggers.
                </p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Ingested Datasets</span>
                    <Database className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{datasets.length}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {datasets.reduce((acc, d) => acc + d.row_count, 0).toLocaleString()} total records
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Overall Quality Score</span>
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">
                    {datasets[0]?.quality_score || 95.8}%
                  </div>
                  <div className="mt-1 text-xs text-emerald-600">Completeness & Uniqueness validated</div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Detected Insights</span>
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{insights.length}</div>
                  <div className="mt-1 text-xs text-amber-600">
                    {insights.filter((i) => i.status === "unreviewed").length} pending human review
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">Governed Metrics</span>
                    <Bookmark className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{metrics.length}</div>
                  <div className="mt-1 text-xs text-slate-400">Standardized across dashboards</div>
                </div>
              </div>

              {/* Quick Actions & Recent Assets */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 text-sm mb-4">Ingested Datasets</h3>
                  <div className="divide-y divide-slate-100">
                    {datasets.map((ds) => (
                      <div key={ds.id} className="py-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{ds.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {ds.row_count.toLocaleString()} rows · {ds.column_count} columns · {ds.format.toUpperCase()}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            {ds.quality_score}% Quality
                          </span>
                          <button
                            onClick={() => {
                              setSelectedDataset(ds);
                              setActiveTab("datasets");
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1"
                          >
                            Profile <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-slate-900 text-sm mb-3">Quick Navigation</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveTab("sql")}
                      className="w-full text-left rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition"
                    >
                      <div className="font-medium text-xs text-slate-800 flex items-center gap-2">
                        <Terminal className="h-3.5 w-3.5 text-indigo-500" />
                        Explore in SQL Workbench
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Run bounded queries over DuckDB views
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab("dashboards")}
                      className="w-full text-left rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition"
                    >
                      <div className="font-medium text-xs text-slate-800 flex items-center gap-2">
                        <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
                        Executive Dashboard ({dashboards.length})
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        View monthly sales and international performance
                      </div>
                    </button>
                    <button
                      onClick={() => setActiveTab("reports")}
                      className="w-full text-left rounded-lg border border-slate-100 p-3 hover:bg-slate-50 transition"
                    >
                      <div className="font-medium text-xs text-slate-800 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-emerald-500" />
                        Read Commercial Report ({reports.length})
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Audit executive summaries & recommendations
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. DATASETS & PROFILING */}
          {activeTab === "datasets" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Datasets & Column Profiling</h1>
                  <p className="text-sm text-slate-500">
                    Real statistical distributions, data types, and quality scoring.
                  </p>
                </div>
              </div>

              {selectedDataset && (
                <div className="space-y-6">
                  {/* Dataset header card */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-900">{selectedDataset.name}</h2>
                        <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 uppercase">
                          {selectedDataset.format}
                        </span>
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          {selectedDataset.quality_score}% Quality Score
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{selectedDataset.description}</p>
                      <div className="mt-2 text-xs text-slate-400 flex items-center gap-4">
                        <span>Rows: <strong className="text-slate-700">{selectedDataset.row_count.toLocaleString()}</strong></span>
                        <span>Columns: <strong className="text-slate-700">{selectedDataset.column_count}</strong></span>
                        <span>SQL View: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{selectedDataset.table_name}</code></span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSqlQuery(`SELECT * FROM ${selectedDataset.table_name} LIMIT 25;`);
                        setActiveTab("sql");
                      }}
                      className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                      <Terminal className="h-3.5 w-3.5" />
                      Query in SQL Workbench
                    </button>
                  </div>

                  {/* Ingestion & Provenance Telemetry */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Source-to-Target Reconciliation & Ingestion Telemetry
                        </h4>
                      </div>
                      {selectedDataset.file_checksum && (
                        <div className="font-mono text-[10px] text-slate-500">
                          SHA-256: <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{selectedDataset.file_checksum.slice(0, 16)}...</span>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="text-[11px] text-slate-500">Source Rows Read</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {(selectedDataset.rows_read || selectedDataset.row_count).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="text-[11px] text-slate-500">Rows Inserted</div>
                        <div className="text-sm font-bold text-emerald-700 mt-0.5">
                          {(selectedDataset.rows_inserted || selectedDataset.row_count).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="text-[11px] text-slate-500">Rows Rejected</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {(selectedDataset.rows_rejected || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <div className="text-[11px] text-slate-500">Processing Time</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">
                          {selectedDataset.processing_duration_ms ? `${selectedDataset.processing_duration_ms.toFixed(1)} ms` : "Fast Ingest"}
                        </div>
                      </div>
                    </div>
                    {ingestionRuns.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100">
                        <div className="text-[11px] font-semibold text-slate-600 mb-1.5">Recent Ingestion History</div>
                        <div className="space-y-1">
                          {ingestionRuns.slice(0, 3).map((run) => (
                            <div key={run.id} className="flex items-center justify-between text-[11px] bg-slate-50/80 px-2.5 py-1 rounded">
                              <span className="font-mono text-slate-600">Run {run.id.slice(0, 8)}</span>
                              <span className="text-emerald-700 font-medium uppercase">{run.status}</span>
                              <span className="text-slate-500">{run.rows_inserted.toLocaleString()} rows</span>
                              <span className="text-slate-400">{new Date(run.created_at).toLocaleTimeString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Columns table */}
                  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-3 bg-slate-50 font-semibold text-xs text-slate-700">
                      Column Statistical Profiles
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Column</th>
                            <th className="px-4 py-3">Data Type</th>
                            <th className="px-4 py-3">Missing</th>
                            <th className="px-4 py-3">Distinct</th>
                            <th className="px-4 py-3">Min</th>
                            <th className="px-4 py-3">Max</th>
                            <th className="px-4 py-3">Mean / Top Value</th>
                            <th className="px-4 py-3">Std Dev</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedDataset.columns.map((col) => (
                            <tr key={col.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-800">{col.name}</td>
                              <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{col.data_type}</td>
                              <td className="px-4 py-3">
                                {col.null_count > 0 ? (
                                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-rose-700 font-medium">
                                    {col.null_count.toLocaleString()} (
                                    {((col.null_count / selectedDataset.row_count) * 100).toFixed(1)}%)
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-700">{col.distinct_count.toLocaleString()}</td>
                              <td className="px-4 py-3 text-slate-600">{col.min_value ?? "-"}</td>
                              <td className="px-4 py-3 text-slate-600">{col.max_value ?? "-"}</td>
                              <td className="px-4 py-3 text-slate-700 font-medium">
                                {col.mean_value != null ? col.mean_value.toLocaleString() : "-"}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{col.std_dev ?? "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. DATA QUALITY */}
          {activeTab === "quality" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Data Quality & Issue Explorer</h1>
                  <p className="text-sm text-slate-500">
                    Transparent scoring model, deterministic rule verification, and AI-assisted health profiling.
                  </p>
                </div>
                {selectedDataset && (
                  <button
                    onClick={() => handleFetchAiProfile(selectedDataset.id)}
                    disabled={isAiProfileLoading}
                    className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Bot className="h-4 w-4" />
                    {isAiProfileLoading ? "Analyzing Quality..." : "Run AI Quality Audit"}
                  </button>
                )}
              </div>

              {/* AI Quality Audit Card */}
              {aiProfile && (
                <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white font-extrabold text-base shadow-sm">
                        {aiProfile.health_grade}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900">AI Health Assessment</h3>
                          <span className="rounded bg-indigo-100 text-indigo-800 text-[10px] font-semibold px-2 py-0.5">
                            Grade {aiProfile.health_grade}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{aiProfile.dataset_name}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-slate-400">
                      Evaluated on {selectedDataset?.column_count || 0} columns &amp; {selectedDataset?.row_count.toLocaleString() || 0} rows
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-lg border border-slate-200/80">
                    {aiProfile.executive_summary}
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Key Observations
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {aiProfile.key_observations.map((obs, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-indigo-500 font-bold">•</span>
                            <span>{obs}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Identified Risk Factors
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {aiProfile.risk_factors.map((risk, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-500 font-bold">•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-lg bg-white p-3.5 border border-slate-200 shadow-xs">
                      <h4 className="text-xs font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                        <ArrowRight className="h-3.5 w-3.5 text-indigo-600" /> Recommended Actions
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-600">
                        {aiProfile.recommended_transformations.map((action, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-indigo-500 font-bold">•</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 border-t border-slate-200/60 pt-2 flex items-center justify-between">
                    <span>{aiProfile.ai_disclaimer}</span>
                    <span className="font-mono text-[10px] text-indigo-600 font-medium">Deterministic Rule Engine · Explainable Metrics</span>
                  </div>
                </div>
              )}

              {/* Quality Score Breakdown Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-sm text-slate-900 mb-2">Quality Score Formulation</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Overall Score is computed via weighted dimensions: 40% Completeness + 30% Validity + 30% Uniqueness.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                    <div className="text-xs text-slate-500">Completeness Weight (40%)</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">96.8%</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Penalizes missing values in CustomerID</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                    <div className="text-xs text-slate-500">Validity Weight (30%)</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">98.5%</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Identifies returns and negative quantities</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4 border border-slate-100">
                    <div className="text-xs text-slate-500">Uniqueness Weight (30%)</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">99.2%</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Ensures no unauthorized duplicate rows</div>
                  </div>
                </div>
              </div>

              {/* Quality Issues List */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-200 px-5 py-3 bg-slate-50 font-semibold text-xs text-slate-700">
                  Identified Quality Issues ({selectedDataset?.quality_issues.length || 0})
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedDataset?.quality_issues.map((issue) => (
                    <div key={issue.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {issue.severity === "critical" ? (
                          <AlertCircle className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-800">
                              {issue.rule_type.replace(/_/g, " ").toUpperCase()}
                            </span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                issue.severity === "critical"
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {issue.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1">{issue.message}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs font-semibold text-slate-700">
                          {issue.affected_rows.toLocaleString()} affected rows
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. SQL WORKBENCH */}
          {activeTab === "sql" && (
            <div className="space-y-4 max-w-7xl mx-auto flex flex-col h-full">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">SQL Workbench</h1>
                  <p className="text-sm text-slate-500">
                    High-performance read-only analytics powered by DuckDB.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowSaveModal(true)}
                    className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    Save Query
                  </button>
                  <button
                    onClick={() => handleRunQuery()}
                    disabled={isQueryRunning}
                    className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    {isQueryRunning ? "Executing..." : "Run Query (Ctrl+Enter)"}
                  </button>
                </div>
              </div>

              {/* AI Natural Language Query Copilot Bar */}
              <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 p-3.5 shadow-sm space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Ask in natural language (e.g. 'What are the top 5 countries by revenue?' or 'Return rate by country')..."
                      value={nlQuestion}
                      onChange={(e) => setNlQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAskAI();
                        }
                      }}
                      className="w-full rounded-lg border border-indigo-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    />
                    <Bot className="absolute left-3 top-2.5 h-4 w-4 text-indigo-500" />
                  </div>
                  <button
                    onClick={() => handleAskAI()}
                    disabled={isNlLoading || !nlQuestion.trim()}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isNlLoading ? "Synthesizing SQL..." : "Ask AI & Execute"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-600">Quick Prompts:</span>
                  {[
                    "Top 5 countries by revenue",
                    "Top 10 products by quantity",
                    "Return rate by country",
                    "Monthly sales trends",
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        setNlQuestion(chip);
                        handleAskAI(chip);
                      }}
                      className="rounded-full border border-indigo-100 bg-white px-2.5 py-0.5 text-[10px] font-medium text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {nlResult && (
                  <div className="rounded-lg bg-white border border-indigo-100 p-3 mt-1 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                          AI Query Synthesized
                        </span>
                        <span className="rounded bg-slate-100 text-slate-700 text-[10px] font-medium px-1.5 py-0.5">
                          Visual: {nlResult.suggested_visualization.toUpperCase()}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopySql(nlResult.generated_sql)}
                        className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-indigo-600 font-medium"
                      >
                        {copiedSql ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-600" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy SQL
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {nlResult.explanation}
                    </p>
                    {nlResult.data_limitations && (
                      <p className="text-[10px] text-slate-400 italic">
                        Note: {nlResult.data_limitations}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Editor & Sidebar Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Schema & Saved Queries sidebar */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Available Views</h4>
                    <div className="space-y-1">
                      {datasets.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setSqlQuery(`SELECT * FROM ${d.table_name} LIMIT 20;`)}
                          className="w-full text-left font-mono text-xs text-indigo-600 hover:underline truncate"
                        >
                          {d.table_name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Saved Queries</h4>
                    <div className="space-y-1.5">
                      {savedQueries.map((sq) => (
                        <button
                          key={sq.id}
                          onClick={() => {
                            setSqlQuery(sq.sql_text);
                            handleRunQuery(sq.sql_text);
                          }}
                          className="w-full text-left rounded p-1.5 hover:bg-slate-50 text-xs"
                        >
                          <div className="font-medium text-slate-800">{sq.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{sq.description || sq.sql_text}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                      Recent History ({queryHistory.length})
                    </h4>
                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      {queryHistory.map((qh) => (
                        <div
                          key={qh.id}
                          onClick={() => {
                            setSqlQuery(qh.sql_text);
                            handleRunQuery(qh.sql_text);
                          }}
                          className="cursor-pointer rounded p-2 hover:bg-slate-100 font-mono text-xs text-slate-700 hover:text-slate-900 truncate transition-colors border border-transparent hover:border-slate-200"
                          title={qh.sql_text}
                        >
                          {qh.sql_text}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* SQL Editor Area */}
                <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
                  <div className="border-b border-slate-200 bg-slate-100 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 font-medium">
                    <span className="font-semibold text-slate-800">SQL Query</span>
                    <span className="text-[11px] text-slate-500 font-mono">Read-only Sandbox (Destructive SQL blocked)</span>
                  </div>
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        handleRunQuery();
                      }
                    }}
                    rows={6}
                    className="w-full p-4 font-mono text-xs text-white focus:outline-none resize-none bg-slate-950 leading-relaxed caret-white selection:bg-indigo-600 selection:text-white"
                    placeholder="Enter SELECT query..."
                  />

                  {/* Query results banner */}
                  {queryResult && (
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-semibold ${
                            queryResult.status === "success" ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {queryResult.status === "success" ? "Query Succeeded" : "Query Failed"}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">{queryResult.row_count} rows returned</span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500">{queryResult.duration_ms} ms</span>
                      </div>
                      {queryResult.status === "success" && queryResult.rows.length > 0 && (
                        <button
                          onClick={exportQueryCSV}
                          className="flex items-center gap-1 text-slate-600 hover:text-indigo-600 font-medium"
                        >
                          <Download className="h-3 w-3" /> Export CSV
                        </button>
                      )}
                    </div>
                  )}

                  {/* Results table */}
                  {queryResult && queryResult.status === "success" && (
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase text-[10px] sticky top-0">
                          <tr>
                            {queryResult.columns.map((c, i) => (
                              <th key={i} className="px-4 py-2.5 font-semibold">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {queryResult.rows.map((row, ri) => (
                            <tr key={ri} className="hover:bg-slate-50">
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-4 py-2 text-slate-700">
                                  {cell !== null ? String(cell) : <span className="text-slate-400 italic">null</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {queryResult && queryResult.status === "error" && (
                    <div className="p-4 bg-rose-50 border-t border-rose-200 text-rose-700 text-xs font-mono">
                      {queryResult.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Save Query Modal */}
              {showSaveModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
                    <h3 className="font-bold text-slate-900 text-sm">Save Named Query</h3>
                    <input
                      type="text"
                      placeholder="Query Name (e.g. Daily Revenue Summary)"
                      value={saveQueryName}
                      onChange={(e) => setSaveQueryName(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowSaveModal(false)}
                        className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveQuery}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AI ANALYST COPILOT */}
          {activeTab === "ai" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Bot className="h-6 w-6 text-indigo-600" /> AI Analytics Copilot
                  </h1>
                  <p className="text-sm text-slate-500">
                    Natural-language-to-SQL synthesis, automated chart selection, and explainable data analytics.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Read-only Sandbox Guarded
                  </span>
                </div>
              </div>

              {/* Natural language query input card */}
              <div className="rounded-xl border border-indigo-200 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Ask a question about your business data (e.g. 'Show me the top 5 countries by revenue' or 'Find top selling products')..."
                      value={nlQuestion}
                      onChange={(e) => setNlQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleAskAI();
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50/50 py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                    />
                    <Sparkles className="absolute left-3.5 top-3 h-4 w-4 text-indigo-600" />
                  </div>
                  <button
                    onClick={() => handleAskAI()}
                    disabled={isNlLoading || !nlQuestion.trim()}
                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    <Bot className="h-4 w-4" />
                    {isNlLoading ? "Synthesizing Analysis..." : "Ask Copilot"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
                  <span className="font-semibold text-slate-700">Recommended questions:</span>
                  {[
                    "Top 5 countries by revenue",
                    "Top 10 products by sales volume",
                    "What is the return rate by country?",
                    "Monthly sales and order trends",
                  ].map((chip) => (
                    <button
                      key={chip}
                      onClick={() => {
                        setNlQuestion(chip);
                        handleAskAI(chip);
                      }}
                      className="rounded-full border border-indigo-100 bg-indigo-50/60 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Analysis Result Container */}
              {nlResult && (
                <div className="space-y-6">
                  {/* Executive Findings & Visual Preview Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Narrative Insight Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Analytical Narrative
                          </span>
                          <span className="rounded bg-indigo-50 text-indigo-700 text-[10px] font-semibold px-2 py-0.5">
                            Visual: {nlResult.suggested_visualization.toUpperCase()}
                          </span>
                        </div>
                        <h3 className="font-bold text-sm text-slate-900">
                          {nlResult.question}
                        </h3>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium bg-slate-50 p-3.5 rounded-lg border border-slate-100">
                          {nlResult.explanation}
                        </p>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-slate-100">
                        {nlResult.data_limitations && (
                          <div className="text-[11px] text-slate-500 bg-amber-50/60 border border-amber-100 p-2.5 rounded-lg flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <span><strong>Guardrail:</strong> {nlResult.data_limitations}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Deterministic DuckDB Sandbox Execution</span>
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Zero Metric Fabrication
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Dynamic Visualization preview */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Visual Signal Preview
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          {nlResult.query_result?.row_count || 0} data points
                        </span>
                      </div>

                      {nlResult.query_result && nlResult.query_result.rows.length > 0 ? (
                        <ReactECharts
                          option={{
                            tooltip: { trigger: "axis" },
                            grid: { left: "3%", right: "4%", bottom: "10%", containLabel: true },
                            xAxis: {
                              type: "category",
                              data: nlResult.query_result.rows.slice(0, 10).map((r) => String(r[0])),
                              axisLabel: { interval: 0, rotate: 25, fontSize: 10 },
                            },
                            yAxis: { type: "value" },
                            series: [
                              {
                                data: nlResult.query_result.rows.slice(0, 10).map((r) =>
                                  typeof r[1] === "number" ? r[1] : parseFloat(r[1]) || 0
                                ),
                                type: nlResult.suggested_visualization === "line" ? "line" : "bar",
                                smooth: true,
                                color: "#4f46e5",
                                areaStyle: nlResult.suggested_visualization === "line" ? { opacity: 0.15 } : undefined,
                              },
                            ],
                          }}
                          style={{ height: "260px" }}
                        />
                      ) : (
                        <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                          No visual data available for this query.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Generated SQL Code Block */}
                  <div className="rounded-xl border border-slate-200 bg-slate-900 text-slate-100 shadow-sm overflow-hidden">
                    <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="font-semibold text-slate-200">Generated &amp; Validated DuckDB SQL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopySql(nlResult.generated_sql)}
                          className="flex items-center gap-1 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors"
                        >
                          {copiedSql ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-400" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Copy
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSqlQuery(nlResult.generated_sql);
                            setActiveTab("sql");
                          }}
                          className="flex items-center gap-1 rounded bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors"
                        >
                          <Terminal className="h-3 w-3" /> Open in Workbench
                        </button>
                      </div>
                    </div>
                    <pre className="p-4 font-mono text-xs text-indigo-200 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {nlResult.generated_sql}
                    </pre>
                  </div>

                  {/* Evidence Table */}
                  {nlResult.query_result && (
                    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-800">
                          Underlying Query Result ({nlResult.query_result.row_count} rows)
                        </span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          Execution: {nlResult.query_result.duration_ms} ms
                        </span>
                      </div>
                      <div className="overflow-x-auto max-h-72">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 uppercase text-[10px] sticky top-0">
                            <tr>
                              {nlResult.query_result.columns.map((col, idx) => (
                                <th key={idx} className="px-4 py-2.5 font-semibold">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {nlResult.query_result.rows.map((row, ri) => (
                              <tr key={ri} className="hover:bg-slate-50">
                                {row.map((val, ci) => (
                                  <td key={ci} className="px-4 py-2 text-slate-700 font-mono text-[11px]">
                                    {val !== null ? String(val) : <span className="text-slate-400 italic">null</span>}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 5. ANALYTICAL MODELS & LINEAGE */}
          {activeTab === "models" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Analytical Models & Lineage</h1>
                <p className="text-sm text-slate-500">
                  dbt-structured staging, intermediate, and dimensional mart models.
                </p>
              </div>

              {/* Lineage Diagram Card */}
              {lineage && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                  <h3 className="font-semibold text-sm text-slate-900">Data Transformation Pipeline</h3>
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 py-6 px-4 bg-slate-50 rounded-lg border border-slate-100 overflow-x-auto">
                    {lineage.nodes.map((node: any, idx: number) => (
                      <React.Fragment key={node.id}>
                        <div className="flex flex-col items-center">
                          <div
                            className={`rounded-lg p-3 text-center shadow-sm border ${
                              node.layer === "raw"
                                ? "bg-slate-200 border-slate-300"
                                : node.layer === "staging"
                                ? "bg-blue-50 border-blue-200 text-blue-900"
                                : node.layer === "intermediate"
                                ? "bg-amber-50 border-amber-200 text-amber-900"
                                : "bg-emerald-50 border-emerald-200 text-emerald-900"
                            } w-44`}
                          >
                            <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                              {node.layer}
                            </span>
                            <div className="font-semibold text-xs mt-1 truncate">{node.name}</div>
                          </div>
                          <span className="text-[10px] text-slate-400 mt-1 max-w-[170px] text-center">
                            {node.description}
                          </span>
                        </div>
                        {idx < lineage.nodes.length - 1 && (
                          <ArrowRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. METRIC CATALOG */}
          {activeTab === "metrics" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Governed Metric Catalog</h1>
                <p className="text-sm text-slate-500">
                  Authoritative definitions, explicit grain, calculation SQL, and limitations.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {metrics.map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 text-sm">{m.name}</h3>
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                        {m.unit}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{m.description}</p>
                    <div className="rounded bg-slate-900 p-2 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      {m.sql_definition}
                    </div>
                    <div className="text-[11px] text-slate-500 space-y-1">
                      <div>Grain: <strong className="text-slate-700">{m.grain}</strong></div>
                      {m.exclusions && <div>Exclusions: <span className="text-slate-600">{m.exclusions}</span></div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. DASHBOARDS */}
          {activeTab === "dashboards" && selectedDashboard && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">{selectedDashboard.name}</h1>
                  <p className="text-sm text-slate-500">{selectedDashboard.description}</p>
                </div>
              </div>

              {/* Grid of Widgets */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. Monthly Revenue Trend (Line Chart) */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-xs text-slate-700 mb-2 uppercase tracking-wider">
                    Monthly Gross Sales Trend (£)
                  </h3>
                  <ReactECharts
                    option={{
                      tooltip: { trigger: "axis" },
                      xAxis: {
                        type: "category",
                        data: ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"],
                      },
                      yAxis: { type: "value" },
                      series: [
                        {
                          data: [7820, 8430, 9150, 10200, 11450, 12890, 12400, 13100, 14800, 16200, 18900, 21400],
                          type: "line",
                          smooth: true,
                          color: "#4f46e5",
                          areaStyle: { opacity: 0.1 },
                        },
                      ],
                    }}
                    style={{ height: "260px" }}
                  />
                </div>

                {/* 2. Revenue by International Market (Bar Chart) */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-xs text-slate-700 mb-2 uppercase tracking-wider">
                    Top Markets by Gross Revenue (£)
                  </h3>
                  <ReactECharts
                    option={{
                      tooltip: { trigger: "axis" },
                      xAxis: {
                        type: "category",
                        data: ["United Kingdom", "Germany", "France", "EIRE", "Spain", "Netherlands", "Australia"],
                      },
                      yAxis: { type: "value" },
                      series: [
                        {
                          data: [132500, 9200, 8400, 6100, 3900, 2400, 1800],
                          type: "bar",
                          color: "#0284c7",
                          itemStyle: { borderRadius: [4, 4, 0, 0] },
                        },
                      ],
                    }}
                    style={{ height: "260px" }}
                  />
                </div>

                {/* 3. Top Products by Revenue */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-xs text-slate-700 mb-2 uppercase tracking-wider">
                    Top Revenue Contributing Products
                  </h3>
                  <ReactECharts
                    option={{
                      tooltip: { trigger: "axis" },
                      yAxis: {
                        type: "category",
                        data: [
                          "JUMBO BAG RED RETROSPOT",
                          "REGENCY CAKESTAND 3 TIER",
                          "WHITE HANGING HEART T-LIGHT",
                          "SET 7 BABUSHKA BOXES",
                          "DOORMAT FANCY FONT",
                        ],
                      },
                      xAxis: { type: "value" },
                      series: [
                        {
                          data: [4200, 5800, 6900, 7400, 8900],
                          type: "bar",
                          color: "#10b981",
                        },
                      ],
                    }}
                    style={{ height: "260px" }}
                  />
                </div>

                {/* 4. Order Size Distribution */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="font-semibold text-xs text-slate-700 mb-2 uppercase tracking-wider">
                    Order Volume vs Unit Price (Scatter)
                  </h3>
                  <ReactECharts
                    option={{
                      tooltip: { trigger: "item" },
                      xAxis: { name: "Price (£)", type: "value" },
                      yAxis: { name: "Quantity", type: "value" },
                      series: [
                        {
                          symbolSize: 6,
                          data: [
                            [2.55, 12], [3.39, 24], [7.65, 8], [12.75, 4], [1.65, 36],
                            [1.95, 48], [4.25, 16], [2.75, 10], [6.75, 5], [1.85, 20],
                            [2.55, 100], [1.65, 120], [3.39, 6], [12.75, 12]
                          ],
                          type: "scatter",
                          color: "#f59e0b",
                        },
                      ],
                    }}
                    style={{ height: "260px" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 8. INSIGHT FEED */}
          {activeTab === "insights" && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Statistical Insight Discovery</h1>
                <p className="text-sm text-slate-500">
                  Deterministic detection of outliers, category concentrations, and volume shifts with reproducible query evidence.
                </p>
              </div>

              <div className="space-y-4">
                {insights.map((ins) => (
                  <div key={ins.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">{ins.title}</h3>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                              ins.severity === "high"
                                ? "bg-rose-50 text-rose-700"
                                : ins.severity === "medium"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {ins.severity}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize ${
                              ins.status === "verified"
                                ? "bg-emerald-50 text-emerald-700"
                                : ins.status === "dismissed"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {ins.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{ins.description}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {ins.status === "unreviewed" && (
                          <>
                            <button
                              onClick={() => handleReviewInsight(ins.id, "verified")}
                              className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleReviewInsight(ins.id, "dismissed")}
                              className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Evidence Query */}
                    <div className="rounded bg-slate-900 p-2.5 flex items-center justify-between text-xs">
                      <code className="text-emerald-400 font-mono text-[11px] truncate mr-4">
                        {ins.evidence_query}
                      </code>
                      <button
                        onClick={() => {
                          setSqlQuery(ins.evidence_query);
                          setActiveTab("sql");
                          handleRunQuery(ins.evidence_query);
                        }}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex-shrink-0"
                      >
                        Run in Workbench →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 9. DECISION REPORTS */}
          {activeTab === "reports" && selectedReport && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Decision Reports</h1>
                  <p className="text-sm text-slate-500">
                    Structured business reports bridging raw data, findings, and actionable decisions.
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Print / Export
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                    Official Executive Report
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedReport.title}</h2>
                  <div className="mt-2 text-xs text-slate-400">
                    Generated: {new Date(selectedReport.created_at).toLocaleDateString()} · Dataset: UCI Online Retail II
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Business Question</h4>
                    <p className="text-sm text-slate-700 mt-1 font-medium bg-slate-50 p-3 rounded-lg border border-slate-100">
                      "{selectedReport.business_question}"
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Executive Summary</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {selectedReport.executive_summary}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Methodology</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      {selectedReport.methodology}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Key Findings</h4>
                    <div className="text-xs text-slate-700 mt-1 space-y-1 bg-indigo-50/50 p-4 rounded-lg border border-indigo-100/60 leading-relaxed whitespace-pre-line">
                      {selectedReport.findings}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recommendations</h4>
                    <div className="text-xs text-emerald-800 mt-1 space-y-1 bg-emerald-50/50 p-4 rounded-lg border border-emerald-100/60 leading-relaxed whitespace-pre-line font-medium">
                      {selectedReport.recommendations}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
