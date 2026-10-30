# CoinPoker Dashboard

A local-first poker analytics dashboard for CoinPoker hand histories. Import one or more `.txt` exports to explore your results, All-in EV, playing statistics, and breakdowns by day, month, stakes, and position.

**[Open the dashboard](https://rostickkin.github.io/coinpoker-dashboard/)**

Your hand history is processed on your device and never uploaded. Poker analysis requires no account, backend, or server database. Optional project statistics use a separate collector for visit/import counts only, with a usage-sharing switch.

![CoinPoker Dashboard with statistics, results chart, daily breakdown and data coverage](docs/images/demo.png)

## Features

- Multiple-file picker and drag-and-drop import with shared deduplication, progress tracking, and cancellation. Split exports are combined into one database.
- Net Won, EV Net Won, bb/100, EV bb/100, hand count, estimated playing hours, Hands/hour, and $/hour in cards and tables.
- VPIP, PFR, 3Bet, WTSD, W$SD, WWSF, rake attribution, and Splash Fee, including Rake bb/100 and Splash Fee bb/100 in all tables.
- Interactive Net Won, Showdown, Non-Showdown, and All-in EV chart with zoom, pan, and line toggles.
- Global filters for dates, stakes, position, player count, game type, ante in BB, and Splash category. Players offers HU through 6-max, plus 7-max through 10-max when present in the database. Positions use EP, MP, CO, BU, SB, BB (the heads-up button is BU).
- Days, Months, Limits, and Positions tables with sorting, draggable columns, and row-to-filter navigation. Limits groups stakes by ante amount, such as NL200 (0.32); clicking a row selects both stakes and ante.
- Currency (`₮`) and big-blind (`BB`) display modes.
- Top 10 hands under the analysis tables, following global filters and including wins, losses and folds. Rank by Hero Net Won or Pot, highest or lowest first, in `₮` or `BB` independently of the display unit. Defaults to Hero's biggest losses first (most negative Net Won). A gold **S** badge marks Splash and Mega Splash; the Splash-only checkbox filters this block independently.
- Compact cards and action histories: R raise, B bet, C call, X check, F fold, AI all-in; Hero actions are underlined and action tooltips show the player and original sizing.
- Click a hand to open the in-page replayer with action playback, street navigation, stack/pot updates and recorded card reveals. The document icon opens a visual history with starting stacks, boards and actions by street, highlighted Hero actions, and showdown cards and net results. Original text and copying remain available. Escape, the backdrop and the close button dismiss either modal.
- Data Quality / Coverage panel showing duplicates, conflicts, parsing errors, EV coverage, and unavailable facts.
- Compact CoinPoker Dashboard Statistics row at the bottom for visits, estimated unique browsers, completed imports, hands processed, imported files and processed bytes. Counters require the optional collector; unavailable data is shown as `—`.

## Getting started

1. Open the website and click **Load / Update Database**, or drop one or more CoinPoker `.txt` exports onto the page. Select all parts of a split export together.
2. Wait for parsing to finish. Basic results become available while All-in EV is still being calculated.
3. Apply filters; use Ctrl/Cmd-click to select multiple stakes or positions.
4. Explore the chart and tables. Clicking a table row applies the corresponding global filter.
5. Expand **Data Quality / Coverage** to inspect calculation coverage and exclusion reasons.

The default game filter is **NLH**. Select **Game Type → All** to include BombPot hands. **Clear filters** and **Reset filters** (beside **Reset columns** below the chart) restore the default NLH selection.

Hand data lives in the tab's memory: reload the page and select your files again. Only interface preferences are saved in `localStorage`. Cancelling a replacement import preserves the previous completed database.

Hand review keeps byte ranges into the selected files and loads only the requested hands, with at most 20 parsed review hands cached. The original files remain on your device. Unknown cards stay hidden; hand diagnostics remain available inside the viewer when source information is ambiguous.

## Architecture

The application uses **React 19**, **TypeScript**, **Apache ECharts**, and **Vite**. A **Web Worker** handles parsing, normalization, equity calculations, filtering, and aggregation separately from the interface thread. The production build is a static website.

```mermaid
flowchart TD
    A[Local CoinPoker .txt files] --> B[Streaming file reader]
    B --> C[Worker: scanner and parser]
    C --> D[Action and contribution normalization]
    D --> E[Pot layers, Hero facts and sessions]
    E --> F[Deduplicated in-memory database]
    F --> G[Initial dashboard]
    F --> H[Exact All-in EV calculation]
    H --> I[Filtering and aggregation]
    J[React filter controls] --> I
    I --> K[Metric cards, ECharts and tables]
```

| Directory | Responsibility |
| --- | --- |
| `src/ui/` | React interface, chart, tables, filters, and Worker orchestration |
| `src/parser/` | Streaming line/hand scanners and CoinPoker parser |
| `src/normalize/` | Action normalization and contribution ledger |
| `src/pots/` | Main-pot and side-pot reconstruction |
| `src/metrics/` | Hero facts, statistics, aggregation, and session estimation |
| `src/equity/` | Hand evaluator, exhaustive board enumeration, and All-in EV |
| `src/special/` | Splash rules and separate promotion accounting |
| `src/import/` | Import pipeline, canonicalization, deduplication, and conflicts |
| `src/core/` | Integer money and rational arithmetic |
| `tests/` | Calculation, scenario, aggregation, and browser tests |
| `scripts/` | Optional local validation and research reports |

## Optional project statistics

The site can send a random browser ID and minimal visit/import summaries to a Cloudflare Worker backed by D1. It never sends history contents, filenames, source hashes, poker identifiers or financial results. **Share usage statistics** can be switched off in the Project Statistics section. The UI version and build date come from the deployed build.

The collector is independent of poker analysis; timeouts, offline operation and exhausted analytics quotas do not block imports. The original repository's Pages workflow supplies its public collector URL; forks default to no collector. To configure your own collector on the Free plan, see [workers/statistics/README.md](workers/statistics/README.md). Leave `VITE_STATS_API_URL` empty locally for local-only analysis and an unavailable statistics section.

## How calculations work

The Worker reads each selected file in chunks, computes its SHA-256 fingerprint, and splits it into hands. Deduplication is shared across the entire selection; hands are then combined into one chronological database. Parsing preserves actions and diagnostics; normalization reconstructs monetary contributions. Duplicate hands are skipped, while conflicting versions of the same hand ID are counted without overwriting the accepted version. Pot layers, Hero facts, and sessions are then built, and hands are ordered by their recorded timestamps.

Core monetary values use integer cents (`BigInt`); EV uses rational numbers. Currency-to-BB conversion is performed per hand using that hand's own big blind. Percentages retain their numerator, eligible denominator, and exclusion counts. Unavailable facts remain explicitly unavailable instead of becoming zero.

Rake bb/100 and Splash Fee bb/100 are 100 times the sum of Hero's attributed charge divided by each hand's own BB, divided by the number of hands with available attribution and a positive BB. Known zero charges count; unavailable charges are excluded.

All-in EV exhaustively enumerates legal board completions with exact hand evaluation. It does not use Monte Carlo or assumed opponent ranges. When an adjustment cannot be reconstructed reliably, the primary EV result retains the actual outcome for that part of the hand and records the reason. Consequently, the EV line can include actual-result fallback.

Net Won represents Hero's poker cash flows and excludes separately received Splash rewards. Sessions split at gaps greater than 30 minutes; hours are estimated session spans. Timestamps preserve the calendar values written in the export.

See [CORE_METHODS.md](CORE_METHODS.md) for detailed calculation policies.

## Limitations

- Designed for CoinPoker text exports; other rooms' formats are not supported.
- Exact EV requires sufficient card, contribution, and commission-allocation information. Ambiguous hands may be partially adjusted or use actual fallback.
- BombPot preflop statistics, positions, and simultaneous-board EV are unsupported.
- **Splash Received** uses an estimated average 50:50 distribution: half of the cash drop goes to the pot, half is shared equally among players marked as dealt in. Explicit table/date ratios can override the estimate. Known shares are summed even when some hands lack pot-winner data; coverage records the number of incomplete hands. `—` means no share can be calculated; no Splash events gives zero.
- Hours estimate session duration rather than precise active time. Hours grouped by stakes and ante can overlap. Hands/hour divides filtered hand count by filtered hours; $/hour divides filtered poker Net Won in currency by filtered hours. Both rates remain unavailable when hours are zero.
- Large imports and exhaustive equity calculations need time and device memory. A modern desktop browser is recommended.

## Local development

Requires **Node.js 24.21 or later** and npm.

```bash
npm ci
npm run dev
```

Open the local address printed by Vite.

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

`dist/` contains the static application and its Worker assets. Serve it over HTTP using `npm run preview` or a static host.

## GitHub Pages deployment

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) checks types, runs tests, builds the application, and deploys `dist/` whenever changes are pushed to `main`. It can also be started manually from **Actions**.

In **Settings → Pages → Source**, select **GitHub Actions**. The build sets `VITE_BASE_PATH` to `/<repository-name>/`; local development defaults to `/`. The workflow derives the repository name automatically, so asset and Worker URLs also work under a Pages project subdirectory.

Private hand histories, research exports, and local hosting metadata are excluded from Git. Public test fixtures use anonymized identifiers. The website opens with a file upload screen; the README screenshot shows an example after import.

## Optional research and browser validation

`npm run validate` and `npm run report` depend on local research files in the unpublished `analysis/` directory. Override the validator's source path with:

```bash
npm run validate -- --source="C:/path/history.txt"
```

Run `npm run test:e2e` with installed Google Chrome to check imports, filters, tables, preferences, and recovery using the anonymized fixtures. The full-dataset regression is skipped unless `COINPOKER_SOURCE` points to the original private reference export; it is not part of public CI. Core tests, type checking, and production builds do not require a personal hand history.

Browser tests start their own server on port `5175` and do not reuse an existing development server. Set `COINPOKER_TEST_PORT` to choose a different port.

Set `COINPOKER_STRESS_HANDS=350000` and run `npm run test:e2e -- import-scale.spec.ts` for an optional synthetic volume check with four split files (100k + 100k + 100k + 50k hands). It checks parsing, combined totals, chart reconciliation, and ante selection without expensive equity candidates. Generated histories stay in the ignored `test-results/` directory.
