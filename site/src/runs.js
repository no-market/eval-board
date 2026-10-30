// What the site knows of an eval run, shared by the tab, the run page and the
// comparison: its steps and their names, its two models, a failed receipt,
// which of two runs is the older, and where its file is on GitHub.
import { shortModel } from './format.js';

// The steps of a receipt lines run, in order: each its key in the run files,
// its title (`Kind choice`, for a column) and its name in running text
// (`kind choice`).
export const STEPS = [
  { step: 'read', title: 'Reading', name: 'reading' },
  { step: 'choose_kinds', title: 'Kind choice', name: 'kind choice' },
  { step: 'database', title: 'Database', name: 'database' },
];

// A step's name in running text, `kind choice` for `choose_kinds`; a step the
// site doesn't know as it is.
export function stepName(step) {
  return STEPS.find((s) => s.step === step)?.name ?? step;
}

// `gemini-2.5-flash · gemini-2.5-flash`: a run's reading model, then its kind
// choice model, each without its provider.
export function modelPair(readModel, chooseKindsModel) {
  return `${shortModel(readModel)} · ${shortModel(chooseKindsModel)}`;
}

// Whether a receipt (a case of a run file) failed, so has no numbers.
export function failed(receiptCase) {
  return receiptCase.error !== null && receiptCase.error !== undefined;
}

// Two runs (anything with a `date`) as [older, newer]; the first given first
// when they are of the same date.
export function olderFirst(first, second) {
  return Date.parse(first.date) <= Date.parse(second.date) ? [first, second] : [second, first];
}

// The run files on GitHub: their folder, and one run's file by its id.
const REPO_ON_GITHUB = 'https://github.com/no-market/eval-board';
export const runsFolderOnGitHub = `${REPO_ON_GITHUB}/tree/main/runs`;
export const runFileOnGitHub = (id) => `${REPO_ON_GITHUB}/blob/main/runs/${encodeURIComponent(id)}.json`;
