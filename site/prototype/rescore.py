# PROTOTYPE, throwaway: re-score old promo runs' real predictions with today's scorer.
import json, sys
from pathlib import Path
from evals.promo_corpus import load_corpus
from evals.promos import PromoRun, PromoCase, score, totals, verdicts, collected, SCORER_VERSION
from evals.promos import Offer
src, out = Path(sys.argv[1]), Path(sys.argv[2])
corpus = collected(load_corpus(Path("datasets/promos")), {"lidl","aldi","kaufland","biedronka"})
by_id = {c.id: c for c in corpus.eligible_cases}
for path in sorted(src.glob("*-promo.json")):
    raw = json.loads(path.read_text())
    if raw["schema_version"] == 4: continue
    raw["schema_version"] = 3
    run = PromoRun.model_validate(raw)
    cases = []
    for old in run.cases:
        if old.id not in by_id: continue
        new = score(by_id[old.id], old.predictions)
        if not new.unscored: new.promos = verdicts(new)
        new.usage, new.seconds, new.failed, new.failure = old.usage, old.seconds, old.failed, old.failure
        cases.append(new)
    chains = sorted({c.chain for c in cases}); leaflets = sorted({c.chain+":"+c.leaflet_id for c in cases})
    newrun = run.model_copy(update=dict(schema_version=4, scorer_version=SCORER_VERSION, dataset_revision=corpus.revision,
        selection=[c.id for c in cases], eligible=[c.id for c in corpus.eligible_cases], full=True, excluded=corpus.excluded,
        cases=cases, totals=totals(cases), by_chain={ch: totals([c for c in cases if c.chain==ch]) for ch in chains},
        by_leaflet={k: totals([c for c in cases if c.chain+":"+c.leaflet_id==k]) for k in leaflets}))
    (out/path.name).write_text(newrun.model_dump_json(indent=1))
    t = newrun.totals
    print(path.name, run.config.model, run.config.version, run.scorer_version, '->', t.promos, t.errors, t.warnings, t.cost_usd)
