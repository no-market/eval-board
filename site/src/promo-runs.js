// What the site knows of a promo run, shared by the promo views: its chains
// and their models and strategies, and its numbers per page. Each works on an
// index entry (see build/summarise-promo.js): `configs` by chain, and numbers
// ({ pages, promos, errors, costUsd, knownCostUsd, … }) in total and by chain.
import { shortModel } from './format.js';

// `Aldi` for `aldi`.
export function chainName(chain) {
  return chain[0].toUpperCase() + chain.slice(1);
}

// The chains of `runs`, each once, in alphabetical order.
export function chainsOf(runs) {
  return [...new Set(runs.flatMap((run) => Object.keys(run.byChain)))].sort();
}

// `gemini-2.5-flash` when every chain has that model, else each chain's:
// `aldi gemini-2.5-flash · biedronka claude-haiku-5.5`; without providers.
export function modelsLine(configs) {
  const models = Object.entries(configs).map(([chain, { model }]) => [chain, shortModel(model)]);
  if (new Set(models.map(([, model]) => model)).size === 1) return models[0][1];
  return models.map(([chain, model]) => `${chain} ${model}`).join(' · ');
}

// `aldi text · biedronka image`: each chain's strategy.
export function strategiesLine(configs) {
  return Object.entries(configs).map(([chain, { strategy }]) => `${chain} ${strategy}`).join(' · ');
}

// Cost per page in US dollars, from numbers in total or of a chain:
// { usd, priced }, `priced` false when some calls weren't priced and `usd`
// is the priced part only; null without pages.
export function costPerPage({ costUsd, knownCostUsd, pages }) {
  if (!pages) return null;
  if (costUsd !== null && costUsd !== undefined) return { usd: costUsd / pages, priced: true };
  return { usd: knownCostUsd / pages, priced: false };
}
