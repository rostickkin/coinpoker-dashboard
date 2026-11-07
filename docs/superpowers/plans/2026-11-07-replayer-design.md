# Replayer design implementation plan

> Execute natively in this session using superpowers:executing-plans. Implementation is already authorized by the user.

**Goal:** Implement the approved poker-table prototype and working hand navigation, units and independent text windows.

**Architecture:** Retain the review model and existing formatted history. Extract replay presentation into a focused component and stylesheet; pass previous/next-hand callbacks from TopHands. Render formatted history into a same-origin popup using a React portal and owner-document-aware window utilities.

**Tech Stack:** Existing React 19, TypeScript, Vite, CSS and Playwright; no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-07-replayer-design.md`

## Global constraints

Local edits only, no GitHub actions. Preserve pre-existing edits in `docs/images/demo.png`, `tests/core.test.ts` and `AGENTS.md`. Do not change calculation or parsing semantics.

## Review focus

- Fold removes all cards and backward stepping restores them at the earlier frame.
- Replay units stay independent from dashboard units and apply to every replay amount.
- Navigation follows ranking, resets playback and disables at list boundaries.
- Popup closing, main-window closing and popup blocking preserve a usable replayer.
- Dense tables, multiple boards and narrow viewports keep wagers and controls accessible.

### Task 1: Cover approved behaviour

- [x] Add browser coverage for positional labels, folded cards, unit conversions and distinct navigation icons; run to observe failure on the incumbent UI.
- [x] Cover previous/next hand, independent Text popup, preserved action position and popup failure.

### Task 2: Implement presentation and controls

- [x] Add `src/ui/ReplayTable.tsx` and `src/ui/replayer.css`; update `HandReview.tsx` and `ReviewCards.tsx` for the approved table, controls, units and canonical action labels.
- [x] Update `TopHands.tsx` to pass navigation callbacks for the current ordered list, retaining replay unit selection across hand changes.
- [x] Add popup support and adapt dialog, resize and screenshot utilities to their owning document/window.

### Task 3: Verify and present locally

- [x] Update incumbent browser assertions affected by the intentional Text/navigation/name changes. Run typecheck, unit suite, production build and hand-review browser suites.
- [x] Inspect desktop and mobile captures against the approved prototype. Batch any required visual fixes, then confirm once.
- [x] Review the final diff, update relevant documentation and provide a running local URL for review.

Final verification: TypeScript and Vite build pass; unit suite 128/128; final production browser suite 11/11, including 10-player tables, three boards, playback/fold restoration and independent popup lifetime. Local Vite server responds HTTP 200 at `http://127.0.0.1:5173/`.

Independent review found one P2 mobile wager/wordmark overlap. A geometric regression reproduced it (RED), the compact wager/dealer layout was corrected, and the final suite passed (GREEN). The reviewer confirmed that single visual finding resolved. No other correctness or privacy blockers were found. Final captures are kept locally in `analysis/replayer-review/final-desktop.png`, `final-mobile.png` and `final-text-window.png`. Nothing was published or committed.

## Follow-up after local review

- [x] Enlarge hole/community cards; add replay-only classic patterned backs and Hero position labels.
- [x] Anchor the bottom wager above the cards; resolve collisions using measured card, nameplate, centre-content and marker bounds on viewport/frame/unit changes.
- [x] Separate visible historical Splash/Mega Splash funding from ordinary Pot; cover currencies, backward playback and final payout state.
- [x] Verify desktop, intermediate and mobile layouts, dense tables and all prior history-window controls.

Follow-up verification: typecheck and production build pass; unit suite 128/128; final production browser suite 13/13. Independent source review of replay labels, card-back API, drop display and marker placement found no blockers. Captures: `analysis/replayer-review/followup-hero-{1440,900,390}.png` and `followup-splash-{1440,900,390}.png`. Changes remained local through implementation handoff. The user subsequently authorized GitHub Pages deployment of the approved changes; unrelated local demo-image and core-test edits are excluded from publication.
