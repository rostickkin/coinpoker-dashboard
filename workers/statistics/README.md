# Project statistics collector

The React site stays on GitHub Pages. A separate Cloudflare Worker accepts minimal usage summaries and stores counters in D1. Poker parsing and equity calculation stay on the user's device. Without a configured collector the dashboard still works and the section shows unavailable values.

## Cloudflare setup

Use a Cloudflare account on **Workers Free**. Creating this collector does not require buying a domain or subscribing to Workers Paid. If the account already has other Workers/D1 workloads, their usage shares the account's quotas.

Run from the repository root:

```powershell
npx wrangler login --scopes account:read user:read workers:write workers_scripts:write d1:write
npm run stats:db:create
```

Copy the returned D1 database ID into `database_id` in `workers/statistics/wrangler.jsonc`, replacing the configured database ID. The upstream configuration refers to the original project's database; a fork must use its own. Database IDs and the public Worker URL are not passwords. Keep OAuth credentials and API tokens outside Git and never put them in a `VITE_` variable.

Wrangler OAuth credentials are stored in its global user configuration, outside this repository. The scoped login above requests account information plus Workers and D1 deployment permissions. Downloading or forking the repository does not include that authorization. A fork must create its own collector and replace the D1 ID. `.env.example` intentionally has no collector URL; configure the public URL through the repository's Actions variable or an ignored local `.env.local`. `.env*`, `.dev.vars*` and `.wrangler/` runtime state are excluded from Git, except the empty `.env.example` template.

Check `ALLOWED_ORIGINS`: the production GitHub Pages origin is `https://rostickkin.github.io` (an origin does not include `/coinpoker-dashboard/`). Add additional trusted origins as a comma-separated string only if needed. Use a distinct rate limiter namespace if `8347021` is already used in this Cloudflare account.

```powershell
npm run stats:db:remote
npm run stats:deploy
```

For the original `rostickkin/coinpoker-dashboard` repository, the Pages workflow already defaults to the deployed public collector at `https://coinpoker-statistics.coinpoker-dashboard.workers.dev`. Pushing the site changes to `main` connects it automatically. This fallback is restricted to that exact repository; forks default to no collector.

For a fork or an override, use the resulting `https://coinpoker-statistics.<account>.workers.dev` URL as the GitHub repository **Actions variable** `VITE_STATS_API_URL` under Settings → Secrets and variables → Actions → Variables. Push the site changes or rerun the GitHub Pages workflow so Vite embeds this public URL. Only public configuration belongs in this variable.

Verify the deployment with `GET https://<worker-url>/statistics`: it must return six numeric totals and `startedAt`/`updatedAt`. Then open the GitHub Pages site, verify one visit, import a small `.txt` fixture, and wait up to five minutes for cached public totals to refresh. No Cloudflare token is sent to visitors.

## Local development

```powershell
npm run stats:db:local
npm run stats:dev
```

In a second terminal, copy `.env.example` to `.env.local` and set:

```dotenv
VITE_STATS_API_URL=http://127.0.0.1:8787
```

Run `npm run dev` and open `http://127.0.0.1:5173`. The local Worker command overrides the allowed origin for this address. The local D1 database and Wrangler build output are ignored by Git.

`npm run stats:check` bundles the Worker without deploying it. `npm test` includes API tests against real in-memory SQLite and browser-client tests. To exercise the frontend against a controlled collector in Chrome:

```powershell
$env:COINPOKER_TEST_PORT='5275'
$env:COINPOKER_STATS_API_URL='http://127.0.0.1:5275/__project-statistics'
npm run test:e2e
```

Run `npm run test:e2e -- project-statistics.spec.ts` without those variables to also check the unconfigured state. The mocked endpoint belongs only to browser tests; never configure it on the public deployment.

## Event contract and metric definitions

`POST /events` accepts exactly these fields:

- `schemaVersion: 1`, random UUIDv4 `eventId` and `visitorId`, `type: "visit" | "import"`, ISO UTC `occurredAt`.
- Imports additionally contain positive integers `hands`, `files`, `bytes`.
- No other properties are accepted. Bodies are bounded to 2,048 bytes. Each import is at most 100 million hands, 10,000 files and 100 billion bytes. These bounds limit abusive submissions, not browser parsing.

One successful import increments **Databases Loaded** once, **Hands Processed** by the accepted unique hands within that selection, **Files Imported** by its file count and **Data Processed** by the sum of its file sizes. Duplicate hands within a selection are excluded; a later successful reimport counts again. Dashboard filters, failed imports, cancelled imports and superseded staging workers do not count as successful imports.

**Total Visits** counts sessions, with a new session after 30 minutes of inactivity. Pointer/keyboard activity and returning to the visible page update session activity locally; these interactions do not each generate an event. A reload within the session does not increment visits. Session and visitor state survive reloads when storage is available. **Unique Visitors** estimates browser profiles, not identifiable people. Clearing storage, using another browser or disabled storage affects that estimate. Concurrent tabs and delivery blockers can also affect estimates.

The frontend stores a random browser ID, sharing preference, current session and at most 32 pending minimal events under `coinpoker.statistics.v1`. The **Share usage statistics** switch clears pending events and stops new event submissions. Public totals can still be read. A request already accepted by the server cannot be withdrawn by a later opt-out. Network failure never blocks importing or calculation. Delivery is best effort, with five-second timeouts, at most three attempts per pending event per page lifetime, and retry opportunities on reload, new imports, return to the page or reconnection. There is no continuous polling.

An atomic insert with a unique event ID and SQL triggers applies each event once. Replaying the same event returns success without changing counters. Reusing an ID with a different payload returns 409. D1 stores event summaries plus their payload hash for eight days, then the daily scheduled job removes them. Events older than seven days or over five minutes in the future are rejected. All-time aggregate counters and random visitor IDs are retained. File contents, filenames, source hashes, hand/player identifiers, cards, money results and client IP addresses are not stored in D1.

`GET /statistics` returns only the public aggregate counters with `Cache-Control: public, max-age=300`. Its contract is validated before values are displayed. Missing or failed data is shown as unavailable, never fabricated zeroes. Previously fetched values can remain visible with a stale-state message.

## Limits and abuse handling

The configured edge limiter allows 120 ingestion calls per minute per network address per Cloudflare location. This intentionally coarse limit is a safeguard, not an identity or authenticity proof; shared networks may be throttled. Allowed-origin checks prevent unrelated browser pages from posting but do not authenticate non-browser clients. Request validation, deduplication and rate limiting reduce abuse; public counters remain estimates and cannot be made tamper-proof by placing a secret in frontend JavaScript.

At approximately 1,000 visitors/day and one import each, plan for roughly 3–6k HTTP requests and 10–20k D1 row writes per day including bookkeeping/index work. These are estimates, not load-test measurements. There is one singleton aggregate row, so public reads do not scan event history. Keep the existing indexes and daily pruning. More imports, retries, shared account usage or malicious requests change consumption.

Current Free quotas: 100k Worker requests/day, 100k D1 row writes/day, 5 million D1 row reads/day, 5 GB total D1 storage. A Free D1 database also has a per-database size limit. Check current limits before changing the design: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/). Reaching Free quotas causes rejected operations rather than automatic paid overages; poker analysis remains local and usable.
