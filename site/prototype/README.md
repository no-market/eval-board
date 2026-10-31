# PROTOTYPE: promos tab (throwaway)

Roadmap ticket: Promos tab on the Eval board (`.scratch/mvp/issues/49-promos-tab-on-the-eval-board.md` in no-market/roadmap).

    cd site && node build.mjs prototype/runs prototype/dist && (cd prototype/dist && python3 -m http.server 8765)

Open http://localhost:8765/?variant=A#/promo-extraction and flip variants with ← → or the bar.
`runs/` holds the real runs plus six `-rescored-v5` copies: the old runs' real predictions
re-scored with `promo-core-text-v5` on today's 8 pages by `rescore.py` (run from no-market/backend
with `PYTHONPATH=. uv run python <path>/rescore.py <eval-board runs> <out>`). Never published.
