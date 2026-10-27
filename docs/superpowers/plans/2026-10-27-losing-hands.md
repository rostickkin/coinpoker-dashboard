# Losing Hands Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for sequential implementation and one final review.

**Goal:** Review the ten largest losing pots by currency or BB directly below the dashboard tables.

**Architecture:** Add exact top-ten selection to queries. Index source byte ranges during import and request bounded review details from the active Worker. Build replay frames from parser tokens and normalized ledger snapshots; render them with React in accessible modals.

**Tech Stack:** Existing React 19, TypeScript, Vite, Node tests and Playwright.

**Spec:** ../specs/2026-10-27-losing-hands-design.md

## Global Constraints

- No dependencies or calculation-policy changes.
- Current filters and Net Won < 0; pot before charges.
- Independent currency/BB ranking and display units.
- Modal overlays, local histories, source timestamps preserved.

## Review Focus

- UTF-8 BOM, CRLF and split byte chunks: source slices must identify the right hand.
- Mixed stakes: BB sorting must select a different top ten when appropriate.
- Returns, side pots and repeated awards: frames must preserve exact amounts.
- Multiple boards and unknown cards: replay must reveal only recorded information.
- Import replacement, stale replies, keyboard focus and untrusted names: no stale or unsafe rendering.

## Tasks

### 1. Source index and selection

Files: src/parser/scanner.ts, src/ui/data.ts, src/review/selection.ts, tests/review.test.ts.

- [x] Add failing tests for source byte slices, filtering and exact top-ten rankings.
- [x] Record physical byte ranges on SourceLine; expose totalPot in Fact.
- [x] Implement rankLosingHands(facts): {currency, bb}, bounded to ten each.
- [x] Verify Node tests.

### 2. Replay model and Worker details

Files: src/review/model.ts, src/ui/worker.ts, tests/review.test.ts.

- [x] Add failing tests for board reveals, hidden cards, returns, payouts and multiple boards.
- [x] Implement buildReview(ProcessedHand): ReviewHand with compact events and replay frames.
- [x] Index accepted losing hands to File byte ranges; handle request-scoped details with a bounded cache.
- [x] Verify model tests and existing calculations.

### 3. UI and browser behavior

Files: src/ui/LosingHands.tsx, src/ui/HandReview.tsx, src/ui/hand-review.css, src/ui/main.tsx, tests/browser/hand-review.spec.ts.

- [x] Add browser tests for sort/display independence, filters, both modals, steps and safe text rendering.
- [x] Add compact history/cards, request lifecycle, table and persisted ranking preference.
- [x] Add accessible modal replay and formatted/raw history.
- [x] Run typecheck, Node tests, build and relevant/full browser suite.

### 4. Publish

- [x] Review the whole change and resolve material findings.
- [x] Update README, version and changelog; commit only task-owned changes.
- [ ] Publish through GitHub and wait for Pages workflow completion.
- [ ] Check the live deployed feature and report the URL and validation.
