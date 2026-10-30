# Changelog

## 0.4.1 — 2026-10-30

### Added

- Project spade logo beside the dashboard heading, spanning both title lines with responsive sizing.

## 0.4.0 — 2026-10-30

### Added

- Visual hand history with starting stacks, street-by-street boards and actions, Hero highlighting, and showdown cards and net results.
- Independent ₮ / BB switch in Hand History for actions, bets, street pots and results, including blinds, antes and Splash drops.
- Net Won and Pot rankings in both directions, in currency or BB, with an independent Splash-only checkbox.

### Changed

- Top 10 hands includes wins and losses and defaults to Hero's biggest losses first (most negative Net Won).
- Cards use four suit background colors and rank labels without suit symbols throughout hand review and the Top 10 table.
- Winning hand histories are available for replay and formatted/original viewing.
- Top 10 controls update independently of the results chart and analysis tables.

## 0.3.1 — 2026-10-30

### Changed

- Top 10 losing hands ranks by Hero's Net Won, with the biggest losses first in currency or BB.

### Added

- Gold S badges beside Splash and Mega Splash hands in the losing-hands table.

## 0.3.0 — 2026-10-27

### Added

- Top 10 losing hands below the analysis tables, following current filters. Rank pots independently in currency or BB while keeping the selected display unit.
- Compact Hero cards, boards and action histories with Hand2Note-style notation.
- In-page hand replayer with stacks, pot, dealer, board reveals, action playback and street navigation, including returned bets and multiple boards.
- Formatted and original hand history in a separate modal with clipboard copying.

### Changed

- Hand review loads source slices locally on demand to keep memory bounded for large imports.
