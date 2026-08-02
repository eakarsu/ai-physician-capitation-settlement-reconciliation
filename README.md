# Physician Capitation Settlement Reconciliation

Rebuild capitation settlements from member months and contract factors to recover missed revenue and unsupported deductions.

**Primary buyer:** Medical groups, IPAs, and health plans. **Evidence:** contracts, member months, risk cells, age-sex factors, retro eligibility, carve-outs, encounters, stop-loss, withholds, settlements, and payments.

Full local application built with React, Vite, Express, PostgreSQL, and OpenRouter. Includes 15 domain-specific capabilities, 105 custom AI workbench fields, three scenario-fill controls per feature, operational registers, workflow transitions, analytics, professional AI decision briefs, audit history, and at least 15 PostgreSQL records per capability.

## Domain capabilities

- Contract rate library
- Member month ingestion
- Risk cell mapping
- Age sex factor calculation
- Retro eligibility reconciliation
- Carve-out validation
- Encounter completeness
- Stop-loss recovery
- Withhold calculation
- Quality pool allocation
- Risk corridor settlement
- Payment statement matching
- Variance dispute workflow
- Cash reconciliation
- Group plan analytics

Run `./start.sh`, then open <http://127.0.0.1:4657>. API: `5657`.

Administrator: `runtime-admin@example.com` / `LocalDemo!2026`. Operator and reviewer credential buttons are available on the login page.
