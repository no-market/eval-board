# eval-board

Public eval results of [no-market](https://github.com/no-market): one JSON file
per eval run in `runs/`, with the current `schema.json` beside them.

The backend's `evals.yml` workflow commits the runs here; nothing is edited by
hand. Each run holds a flow version and its model configuration, the scenario,
its metrics (F1, kind-only F1, per-step metrics, latency and cost) and the
lines it was scored on.

Only the founder's own receipts appear here in full.
