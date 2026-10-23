// List filtering, CSV/JSON export, and deterministic record insights.
// This module never calls a provider; record insights are a labelled
// deterministic fallback (aiGenerated:false) computed from stored rows.
export function parseListQuery(query = {}) {
  return {
    q: String(query.q || "").trim().toLowerCase(),
    status: String(query.status || "").trim(),
    risk: String(query.risk || "").trim(),
    workflow: String(query.workflow || query.feature || "").trim(),
    module: String(query.module || "").trim(),
    format: String(query.format || "json").trim().toLowerCase(),
  };
}

export function rowStatus(row) {
  return String(row?.status ?? row?.state ?? "");
}

function haystack(row) {
  let payload = "";
  try { payload = JSON.stringify(row?.payload ?? ""); } catch { payload = ""; }
  return [row?.reference, row?.title, row?.subject, row?.owner, rowStatus(row), row?.risk, payload]
    .map((value) => String(value ?? "")).join(" ").toLowerCase();
}

export function filterRows(rows, query = {}) {
  const { q, status, risk, workflow } = parseListQuery(query);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (workflow && String(row?.workflow_id ?? row?.feature_id ?? "") !== workflow) return false;
    if (status && rowStatus(row) !== status) return false;
    if (risk && String(row?.risk ?? "") !== risk) return false;
    if (q && !haystack(row).includes(q)) return false;
    return true;
  });
}

export function displayValue(value) {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function csvCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") {
    let text = "";
    try { text = JSON.stringify(value); } catch { text = ""; }
    return `"${String(text).replaceAll('"', '""')}"`;
  }
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function rowsToCsv(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const columns = [];
  for (const row of list) for (const key of Object.keys(row || {})) if (!columns.includes(key)) columns.push(key);
  if (!columns.length) return "";
  const lines = [columns.join(",")];
  for (const row of list) lines.push(columns.map((key) => csvCell(row?.[key])).join(","));
  return lines.join("\n") + "\n";
}

export function sendExport(res, rows, format, filename = "records") {
  if (String(format || "json").toLowerCase() === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(rowsToCsv(rows));
  }
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`);
  return res.json({ items: rows });
}

export function summarizeRows(rows, now = new Date()) {
  const list = Array.isArray(rows) ? rows : [];
  const closed = list.filter((row) => ["closed", "approved"].includes(rowStatus(row).toLowerCase())).length;
  const highRisk = list.filter((row) => ["high", "critical"].includes(String(row?.risk || "").toLowerCase())).length;
  const overdue = list.filter((row) => {
    const due = row?.due_date ? new Date(row.due_date) : null;
    return due && !Number.isNaN(due.getTime()) && due < now && !["closed", "approved"].includes(rowStatus(row).toLowerCase());
  }).length;
  const totalAmount = list.reduce((sum, row) => sum + (Number.isFinite(Number(row?.amount)) ? Number(row.amount) : 0), 0);
  return {
    total: list.length,
    open: list.length - closed,
    closed,
    highRisk,
    overdue,
    totalAmount,
    zeroAmount: list.filter((row) => Number(row?.amount) === 0).length,
    missingOwner: list.filter((row) => !String(row?.owner || "").trim()).length,
    missingDue: list.filter((row) => !row?.due_date).length,
  };
}

const FALLBACK_LABEL = "Deterministic fallback — not AI-generated";

export function buildRecordInsights(rows, spec = {}) {
  const stats = summarizeRows(rows);
  const subject = spec.subject || "Operational records";
  const titles = spec.titles || [`${subject} exposure summary`, `${subject} risk and ageing brief`, `${subject} evidence readiness brief`];
  const disclaimer = spec.disclaimer || "Operational summary from stored records only. Validate source evidence before acting.";
  const base = { aiGenerated: false, provider: "deterministic-fallback", label: FALLBACK_LABEL, disclaimer };
  const coverage = [
    { title: "Coverage", detail: `${stats.total} stored record(s) were reviewed for ${subject}; ${stats.open} remain open and ${stats.closed} are approved or closed.` },
    { title: "Value in scope", detail: `Stored amounts total ${stats.totalAmount}; ${stats.zeroAmount} record(s) carry a zero amount and are retained in this count.` },
  ];
  const riskSections = [
    { title: "Risk concentration", detail: `${stats.highRisk} record(s) are High or Critical risk out of ${stats.total} reviewed.` },
    { title: "Ageing", detail: `${stats.overdue} open record(s) are past their due date; ${stats.missingDue} record(s) have no due date recorded.` },
  ];
  const readinessSections = [
    { title: "Ownership completeness", detail: `${stats.missingOwner} record(s) have no owner recorded; every other record retains its stored owner value, including empty and zero values.` },
    { title: "Closure readiness", detail: `${stats.closed} of ${stats.total} record(s) are approved or closed; the remainder need accountable follow-up before closure.` },
  ];
  return [
    { ...base, id: "exposure-summary", title: titles[0],
      metrics: [{ label: "Records reviewed", value: stats.total }, { label: "Open records", value: stats.open }, { label: "Total stored amount", value: stats.totalAmount }, { label: "Zero-amount records", value: stats.zeroAmount }],
      sections: coverage, actions: spec.actions?.[0] || ["Validate the largest stored amounts against source evidence.", "Assign an owner to every open record."] },
    { ...base, id: "risk-ageing", title: titles[1],
      metrics: [{ label: "High or Critical risk", value: stats.highRisk }, { label: "Overdue open records", value: stats.overdue }, { label: "Records without due date", value: stats.missingDue }],
      sections: riskSections, actions: spec.actions?.[1] || ["Review overdue High-risk records first.", "Add a due date where none is recorded."] },
    { ...base, id: "evidence-readiness", title: titles[2],
      metrics: [{ label: "Approved or closed", value: stats.closed }, { label: "Records without owner", value: stats.missingOwner }, { label: "Open records", value: stats.open }],
      sections: readinessSections, actions: spec.actions?.[2] || ["Complete missing owner and due-date fields.", "Retain approval evidence for closed records."] },
  ];
}

export function deterministicBrief({ title, inputs = {}, rows = [], disclaimer } = {}) {
  const stats = summarizeRows(rows);
  const insights = buildRecordInsights(rows, { subject: title || "Workflow", disclaimer });
  return {
    aiGenerated: false, provider: "deterministic-fallback", label: FALLBACK_LABEL,
    headline: `${title || "Workflow"} — deterministic fallback brief`,
    executiveSummary: `OpenRouter is not configured, so this brief was computed deterministically from ${stats.total} stored record(s) without any provider call. Review the labelled sections below and validate source evidence before acting.`,
    risk: stats.highRisk > 0 ? "High" : stats.total > 0 ? "Moderate" : "Low",
    confidence: null,
    metrics: insights[0].metrics,
    sections: [...insights[0].sections, ...insights[1].sections.slice(0, 1)],
    actions: insights.flatMap((item) => item.actions).slice(0, 4),
    inputsReviewed: Object.keys(inputs || {}).length,
    disclaimer: disclaimer || "Operational support only from stored records. Validate source evidence before acting.",
  };
}
