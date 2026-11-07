# Approved replayer design

The user approved implementation after reviewing the final prototype on 2026-11-07.

- Emerald oval felt, layered dark padded rail, plain dark surround. Muted mint `CoinPoker Dashboard` wordmark below the community cards; Pot above them.
- Six-max seats use `Player SB`, `Player BB`, `Player EP`, `Player MP`, `Player CO`, `Player BU` instead of names. Preserve support for other player counts and existing recorded reveals. No avatars. Use the formatted history's coloured rank tiles. Remove both cards immediately after Fold, including Hero's cards.
- Wagers appear inside the felt as red chips with the exact amount below. Stacks use gold numbers. Dealer D stays fully inside the green felt next to the relevant seat.
- Playback: previous hand (double chevron), previous action (single chevron), Play/Pause, next action (single chevron), next hand (double chevron). Hand navigation follows the current Top 10 ordering and disables at the ends. Preserve street navigation, timeline and right action list.
- A compact existing-style `₮ / BB` segmented control sits immediately left of document-icon `Text`. It changes replay stacks, bets, Pot and action amounts together. No Hero-card visibility toggle.
- Text opens this hand's existing formatted history in a separate browser window. The original replayer stays open at its current action. Popup failure must leave a retryable message and preserve the replayer.
- Keep all edits local; do not push, create PRs, or deploy. Preserve unrelated working-tree changes.

Visual reference: final generated prototype `exec-8fae938c-7d91-4c9f-b72e-74ec14b773ae.png` in the chat's generated-images directory. This is a layout reference, not an asset to embed in the application.

## Follow-up requested after local review

- Enlarge hole and community cards. Keep four-colour rank faces, but use a classic patterned back for closed cards in the replayer.
- Replace `Player` with `Hero` for the main player's position label, including action labels.
- Anchor the bottom player's wager above its cards with a measured gap. Account for actual card, plate and centre-content bounds when placing wagers and D, including viewport changes.
- Present the ordinary Pot separately from cumulative visible `SPLASH dropped` / `MEGA SPLASH dropped` funding. The drop is the recorded historical amount, follows the replay unit, appears only after its event and is not counted again in the ordinary Pot. Clamp the ordinary portion at zero after payouts; retain the historical drop label. Do not alter parser, ledger or financial results.

## Publication authorization

The user explicitly requested GitHub deployment after local review. This supersedes the initial local-only restriction for the approved replayer changes. Publish through the existing `main` GitHub Pages workflow; preserve unrelated local demo-image and core-test edits.
