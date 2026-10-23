// Offline tests for list filtering, export, and deterministic insights.
// Provider keys are removed before any app module is imported; no provider call is made.
delete process.env.OPENROUTER_API_KEY;
delete process.env.OPENAI_API_KEY;
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const { filterRows, rowsToCsv, buildRecordInsights, deterministicBrief, displayValue } = await import("../featurePack.mjs");

const rows = [
  { id: 1, reference: "REF-1", title: "Alpha case", status: "Open", owner: "Ada", risk: "High", amount: 0, due_date: "2020-01-01", payload: { flag: false } },
  { id: 2, reference: "REF-2", title: "Beta case", status: "Closed", owner: "", risk: "Low", amount: 250, due_date: "2999-01-01", payload: {} },
];

test("search and status/risk filters narrow the main list", () => {
  assert.equal(filterRows(rows, { q: "alpha" }).length, 1);
  assert.equal(filterRows(rows, { status: "Closed" }).length, 1);
  assert.equal(filterRows(rows, { risk: "High" })[0].reference, "REF-1");
  assert.equal(filterRows(rows, {}).length, 2);
});

test("CSV export preserves 0, false, and empty values", () => {
  const csv = rowsToCsv([{ reference: "R0", amount: 0, flag: false, note: "" }]);
  assert.ok(csv.startsWith("reference,amount,flag,note"));
  assert.ok(csv.includes("R0,0,false,"));
  assert.equal(displayValue(false), "No");
  assert.equal(displayValue(0), "0");
  assert.equal(displayValue(""), "Not provided");
});

test("record insights are a labelled deterministic fallback over stored rows", () => {
  const insights = buildRecordInsights(rows, { subject: "Test records" });
  assert.equal(insights.length, 3);
  for (const insight of insights) {
    assert.equal(insight.aiGenerated, false);
    assert.match(insight.label, /Deterministic fallback/);
    assert.ok(insight.sections.length >= 2 && insight.sections.every((s) => s.title && s.detail));
  }
  assert.equal(insights[0].metrics.find((m) => m.label === "Zero-amount records").value, 1);
});

test("analyze fallback brief is offline and labelled aiGenerated:false", () => {
  const brief = deterministicBrief({ title: "Test workflow", inputs: { caseReference: "X" }, rows });
  assert.equal(brief.aiGenerated, false);
  assert.equal(brief.provider, "deterministic-fallback");
  assert.ok(brief.sections.length >= 3);
});

test("server exposes authenticated export and insights routes", () => {
  const server = fs.readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  assert.ok(server.includes("/api/exports/features/"), "export route missing");
  assert.ok(server.includes("/api/features/:id/insights"), "insights route missing");
  const frontend = fs.readFileSync(new URL("../../frontend/src/RecoveryWorkbench.jsx", import.meta.url), "utf8");
  assert.ok(frontend.includes("Export CSV"), "export control missing");
  assert.ok(frontend.includes("Search records") || frontend.includes("Search operational"), "search control missing");
});
