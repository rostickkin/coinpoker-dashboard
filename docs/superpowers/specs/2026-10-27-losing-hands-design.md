# Losing hands review

Approved direction: the interactive mockup reviewed in this chat on 2026-10-27.

Add Top 10 losing hands after the analysis table and before coverage. Use current global filters and financially available Net Won < 0, including folds. Rank by total pot before charges, independently in currency or BB, with exact comparisons. The global display unit changes displayed amounts only.

Show Hero cards, position, time, stakes, actions and boards in one compact line. R/B/C/X/F follow Hand2Note notation; underline Hero. Tooltips explain player and sizing. Showdowns and special hands must not invent unknown cards or actions.

Click a row to open an in-page modal replayer matching the mockup. Include seats, stacks, dealer, current pot, board reveals, action log, previous/next, play/pause, street jumps and payouts. Reveal opponent cards only when shown or at summary if the source only records them there. Support multiple boards and returned bets.

A separate document icon opens formatted and original text in a modal, with copy and a switch to replay. Close via Escape, backdrop or close button; restore focus. Hand history stays local.

Implementation choice: keep the current React/Worker architecture. Index byte ranges in the original File objects and load a bounded set of review details on demand. Retaining parsed trees for every hand would increase memory use; reparsing whole files on each click would delay review.

No dependencies or calculation-policy changes. Existing unrelated local edits are preserved. Publish the verified change to the existing GitHub Pages deployment as requested.
