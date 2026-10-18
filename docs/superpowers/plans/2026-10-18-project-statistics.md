# Project Statistics Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user explicitly requested implementation in the current chat; continue inline.

**Goal:** Add the approved six-card project statistics section and a deployable Free-plan Workers/D1 collector.

**Architecture:** Share a strictly validated event/aggregate protocol between the browser and Worker. A bounded client sends visit and successful-import events independently of poker analysis; D1 triggers atomically update public counters with event deduplication.

**Tech Stack:** Existing React/TypeScript/Vite, Cloudflare Workers/D1, Wrangler, Node test runner and SQLite, Playwright/Chrome.

**Spec:** `docs/superpowers/specs/2026-10-18-project-statistics-design.md`.

## Global Constraints

- Keep histories, names, hashes and financial information on-device.
- Preserve existing user changes; do not publish or commit unrelated files.
- Stay compatible with GitHub Pages and Node 24.21.0; default to the Free Cloudflare plan.
- Use unavailable states instead of fake counters; telemetry failures cannot break imports.
- No account or privileged credential in the browser.

## Review Focus

- Simultaneous/retried and conflicting event IDs must not inflate aggregates.
- Cancelled/replaced/failed imports must never count as successful imports.
- Storage failures, opt-out during a request, malformed API data and timeouts must be isolated.
- Session reloads and inactivity boundaries must preserve visit counting.
- Narrow screens and an unconfigured deployment must remain useful and readable.

## Tasks

### 1. Protocol and transactional collector

Files: `src/statistics/protocol.ts`, `workers/statistics/src/index.ts`, `workers/statistics/migrations/0001_statistics.sql`, `tests/statistics-api.test.ts`.

Interfaces: strict `UsageEvent`, `ProjectTotals`, event validation, Worker `fetch(request, env)`, a minimal structural D1 interface.

- [x] Write/run failing tests for strict input validation, private-field rejection, aggregate totals, repeat/conflicting events, allowed origins, expiry, rate limits, and unavailable D1.
- [x] Implement the protocol, SQL trigger-based aggregation and transactional deduplication; test against real SQLite.
- [x] Verify targeted tests and type checking.

### 2. Browser collection

Files: `src/statistics/client.ts`, `tests/statistics-client.test.ts`.

Interfaces: `createStatisticsClient`, `start`, `activity`, `recordImport`, `flush`, `setSharing`, `subscribe`, `getSnapshot`.

- [x] Write/run failing tests for session reloads/inactivity, minimal import payloads, persistent event IDs, retry bounds, storage failure, opt-out, malformed totals and disabled configuration.
- [x] Implement a bounded persistent queue and independent totals loading; all network failures are contained.
- [x] Verify targeted tests.

### 3. Cards and successful-import integration

Files: `src/ui/ProjectStatistics.tsx`, `src/ui/main.tsx`, `src/ui/worker.ts`, `src/ui/style.css`, `src/vite-env.d.ts`, `vite.config.ts`, `tests/browser/project-statistics.spec.ts`, `playwright.config.ts`.

- [x] Write/run browser tests for unavailable and populated values, session reload, opt-out, one successful combined import, and failed/cancelled imports.
- [x] Add responsive Cards UI and build metadata; hook collection to the staging Worker's successful completion using only import totals.
- [x] Verify browser tests and desktop/mobile screenshots.

### 4. Deployment and final checks

Files: `workers/statistics/wrangler.jsonc`, `workers/statistics/README.md`, `.env.example`, `.gitignore`, `package.json`, `package-lock.json`, `.github/workflows/pages.yml`, `README.md`, `tsconfig.json`.

- [x] Add Wrangler commands, local D1 migration/verification and configurable Pages API URL; document Free-plan setup and exact metric semantics/privacy.
- [x] Run the full unit suite, type check, production build, browser tests and local Worker/D1 smoke test.
- [x] Review the complete diff and fix material findings; report deployment status accurately.

## Verification and deployment record

- 116 unit tests passed, including 16 statistics API/client tests. Type checking and the production build passed. The existing Vite large-chunk advisory remains.
- Full browser suite: 14 passed, 3 intentional skips (private dataset, optional stress test, unconfigured case in the configured run). The unconfigured case passed separately. After the final retry fix, all 4 configured statistics browser tests passed again.
- Captures at 1440, 390 and 320 pixels inspected; no horizontal overflow in the empty dashboard or statistics section.
- Real local Wrangler/D1 HTTP smoke: visit + import + retry produced deltas of exactly one visit, one import and one million hands; scheduled cleanup returned 200.
- Fresh independent review found one material issue: an exhausted event blocked later imports. A failing recovery regression was added, the queue now skips exhausted events while retaining them for reload, and the reviewer confirmed the fix.
- Cloudflare login completed with account/user read, Workers and D1 scopes. Credentials remain in Wrangler's global user configuration outside this repository. Runtime state and local environment files are ignored by Git; current generated client JavaScript contains no credential markers.
- D1 created and remote migration applied. Worker deployed at `https://coinpoker-statistics.coinpoker-dashboard.workers.dev`, version `05ed1973-2c4d-42a3-a931-a1fedce1b7d1`, with daily pruning. Public GET /statistics returned 200, correct CORS/cache headers and six zero counters. No synthetic events were inserted remotely.
- The original repository's Pages workflow defaults to this public URL; forks default to no collector. Frontend changes remain local on `codex/project-statistics` and need publication to GitHub Pages. Existing user changes to the core tests, demo image, favicon assets and output were preserved.
