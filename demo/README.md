# Demo assets

**`interval-demo.mp4`** — 1m42s, 1280x720, narrated. A real Playwright session driving the
live deployment at https://fearless-swordfish-992.convex.site, not a motion graphic. Captions
are burned in and the narration is on the same timeline.

**`screenshots/`**

| File | Shows |
|---|---|
| `1-board.png` | The board, red at the top, with the live counts and the sponsor pipeline |
| `2-approval-gate-refusal.png` | The backend refusing to send an unapproved item, with the reason |
| `3-verified-citation.png` | A guideline fetched by Firecrawl, with the sentence the threshold came from |
| `4-threshold-table.png` | The threshold table, two rows each for glucose and temperature |
| `5-red-checkin-and-fixed-reply.png` | A red check-in and the fixed safety string that went back |

Regenerate either with `node scripts/record-demo.mjs` or `node scripts/shots.mjs`.
