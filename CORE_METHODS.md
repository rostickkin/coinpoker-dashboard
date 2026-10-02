# Accepted Phase 2A decisions and calculation policies

The user's Phase 2A specification supersedes the proposed Phase 1 conservative irreversible-lock EV and mandatory IndexedDB architecture. Local HH is the source; no source modification, UI, authentication, backend, graph or deployment is part of this implementation.

## Exact accounting and provenance

Money uses BigInt cents, scale 2; grouped thousands are validated. IDs remain strings. EV, currency-to-BB conversion and Splash shares use reduced rational numbers. Only displayed aggregate percentages and bb/100 become floating point. Every source line gets a token, including blanks and unknowns. Unknown syntax and failed line parsing retain line, raw text, ID, code and severity. Malformed hands remain importable with unavailable metric facts. File-level UTF-8 errors and configured line/block size guards fail explicitly.

Raises add `raiseTo - actorPreviousLiveBet`; written raise-by is checked against the old maximum. Ante is not live credit; street transitions reset only once, regardless of FIRST/SECOND labels. ALLIN is an added amount; semantic call/bet/raise/shortRaise and stack exhaustion are derived. RETURN reduces contribution, never awards. The literal ledger remains a diagnostic trace when authoritative paid/live credit is unavailable. Such actions explicitly carry `normalizationStatus` and reasons.

Auto BB equal to header BB is the confirmed ordinary profile; other amounts retain written cents with unknown effective paid/live credit. No summary-balancing repairs. Own Hero cash flows can remain available despite global residuals or opponent cash-out. Hero cash-out is unsupported. Poker Net Won excludes independently received Splash rewards and never subtracts rake/fee twice.

## Metric and time policies

VPIP records voluntary preflop calls/bets/raises/ALLIN additions; blinds, ante, STRADDLE postings and forced all-ins are excluded. A returned voluntary raise remains VPIP/PFR. Known raw voluntary actions can remain valid with ambiguous forced payments. PFR from an ambiguous normalized ALLIN is unavailable.

3Bet counts hand opportunities and made flags, with a full-raise epoch tracking legal reopening. Open/isolation are first raises; squeeze/limp-reraise are third betting levels; cold fourbet is separate. Call-only stack and a sole already-all-in opponent do not create an opportunity. One short raise uses known reopening rights. Multiple short raises or straddle order use an explicit unavailable conservative profile, rather than guessing cumulative reopening.

Logical showdown uses surviving contested eligibility and actual board comparison; SHOWDOWN headings and summary shows alone do not qualify. Muck remains live. Award flags drive W$SD/WWSF, including losing-money ties. Net/SD/NSD use one financial-valid set. Currency-to-BB conversion happens per hand before summing. Aggregators keep numerator, denominator, excluded count and exclusion reasons; empty denominator returns null.

Positions use sorted dealt seats and validate ordinary SB/BB against the button ring. Labels for 2–6 players match the user specification. Missing button/conflicting blinds are unavailable. BombPot positions and preflop statistics are unsupported. Filters cover local date/month, stakes, game, table, player count, position and Splash type. Grouping primitives rebuild counters from facts.

Calendar fields preserve written MSK; a UTC numeric coordinate is used only to subtract local calendar tuples, never to convert timezone. Sessions are built across all tables, split only at gaps greater than 1800 seconds from the running maximum end. Main hours are estimated session spans; observed interval union is diagnostic. Timezone groups are separate. Clipping APIs preserve global session construction before filtering; hours by limit are not additive.

## Pot and tracker EV policies

Effective contribution caps build layers; folded chips remain dead money, folded players cannot win. Equivalent eligible sets merge. Single-contributor excess without RETURN is unavailable. Unknown effective payments or incomplete monetary syntax prohibit authoritative reconstruction. External Splash ownership is separate from player pots.

The first relevant all-in on a layer determines the board snapshot. Matching calls may settle on the same street. Later betting/folding that can change eligibility makes that layer unavailable (`MULTIWAY_FUTURE_ACTION_AMBIGUITY`); its snapshot is never moved to a later board. No opponent ranges, behavioral model, future-card deck removal or Monte Carlo. Preflop calls that exhaust a stack and forced all-ins can qualify. River uncertainty is zero. No contested Hero all-in means actual result.

Exact enumerator uses a direct 5–7-card rank-mask evaluator and all possible board completions. Ties split as exact rational shares. Hole cards revealed at showdown may condition the all-in equity, as in standard trackers; future community cards cannot. Known live players outside a side layer are dead blockers. Folded cards are blockers only if revealed by the snapshot; unrevealed folded/burn cards are marginalized uniformly. A cache key includes all conditioned cards, board and dead cards under a deterministic bijective suit renaming.

`tracker-snapshot-v1` monetary convention is expected fractional share of a fixed net distributable pot. For one pot, `E[payout] = exactEquity * (contributions - handRake - writtenSplashFee)`; omitted fee remains null in raw facts and contributes zero only under the observed supplied export profile. This convention computes standard rational tracker adjustments, not literal cent-by-cent room odd-chip outcomes or a claim of parity with a named commercial tracker.

Side layers with nonzero unknown commission allocation remain unavailable. Zero-fee layers can be adjusted if complete cards reconstruct exact integer payouts for every player and those totals equal recorded collections. No arbitrary fee proportions or award ordering assumptions. Known actual layer payouts are compared to expected layer payouts. Single-pot opponent cash-out does not change Hero's known collections/card result; Hero cash-out remains unsupported.

RIT2/RIT3 are one hand. All boards and repeated/common prefixes are preserved. Expected payout is linear in marginal equity times fixed run portions: independence is unnecessary, and future runout cards are not dead cards. Fixed-total fractional tracker expectation equals equity times total net pot. Recorded run portions and odd-chip distributions are retained, not overwritten. Exact historical room rounding, conditional cent settlement and multi-layer multi-board fee allocation are not claimed. BombPot simultaneous-board EV is unsupported, distinct from RIT.

Main EV result is actual net plus all available adjustments; missing layer adjustments contribute no correction and retain actual outcomes. `evCoverage` distinguishes fully/partially adjusted, actual fallback only, unsupported and not applicable. Strict EV is diagnostic and has its own denominator. Unknown actual Net Won stays unavailable in all comparable financial lines.

## Promotions, attribution and persistence

Splash type comes from explicit SPLASH/MEGA SPLASH tokens, never amount thresholds. Dropped total is known, historical Hero payout is unknown without a confirmed table + date-range ratio. The ratio resolver rejects overlapping conflicts and invalid ratios. Confirmed shared pool divides by seated players; confirmed winner pool divides among distinct award recipients, using rational units. These values stay separate from Poker Net Won.

`handRake` and `handSplashFee` are summary facts. Hero sole ordinary single-pot winner can receive the user-defined full attribution; a Hero with no pot award gets zero. Split/side/multi-board attribution is unavailable. An absent raw fee remains absent, not a fabricated personal Hero fee.

Canonicalization normalizes BOM, line endings and outer blank lines only. Repeated real collections remain real. Unique room+string-ID inserts are synchronous, duplicates skip, conflicts preserve original accepted version and incoming raw content without overwrite. This is a pure store interface, not mandatory IndexedDB or external persistence. Consumers decide durable storage and progress; exact source hash and regression provenance are recorded by the validation CLI.

Node benchmark establishes desktop execution and memory use; it is not a browser or actual Worker benchmark. Runtime memory includes the compact ID hash index, interval list, all-in candidate traces, equity cache, V8 heap and streaming buffers. No complete source string or multiple 131 MB string copies are read.
