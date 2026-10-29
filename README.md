# eval-board

Public eval results of [no-market](https://github.com/no-market): one JSON file
per eval run in `runs/`, with the current `schema.json` beside them.

The backend's `evals.yml` workflow commits the runs and exports `schema.json`
here; nothing is edited by hand. In `schema_version` 2, a run is one pair of
models, a reading model and a kind choice model, run end to end on every
reviewed photo in [receipt-samples](https://github.com/no-market/receipt-samples),
in date order, with every seed product kind stored and the catalog lookup on,
as the bot runs. Only full runs are published; trial runs on the first N
receipts stay out, so published runs compare fairly.

Each scored line is right, a **warning** (the right product kind with a detail
wrong) or an **error** (a purchase of the printed product kind was lost or
wrong, or a purchase was made up). Every error and warning is attributed to
reading, kind choice or database. The **error rate**, the share of scored
lines that are errors, is the number runs are compared by, with the warning
rate beside it. **Failed receipts**, where the flow stopped before writing
anything, are counted separately; their lines count as errors.

Each run records counts and rates in total and by step, seconds per receipt
(median and p95) end to end and by step, and mean cost per receipt in total and
by model step. Time and cost use only receipts that did not fail. The file
also keeps the flow version, the models and their options, per-receipt results
and per-line verdicts, F1, kind-only F1 and the older per-step metrics.

To clear the board, open **Actions → Clear runs → Run workflow**. This manual
workflow has no inputs. It deletes everything in `runs/` except `.gitkeep`,
including `schema.json`, then commits and pushes the deletion to `main` as
`github-actions[bot]`. With nothing to delete, it makes no commit. Git history
keeps the deleted files; the backend publishes the current schema with the
next full run. For the v2 transition, run it once after
[backend Evals V2](https://github.com/no-market/backend/issues/48) is merged,
before publishing v2 runs, so old and new schemas do not mix.

Only the founder's own receipts appear here in full.
