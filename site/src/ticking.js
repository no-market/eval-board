// Ticking runs to compare, by a row’s box on the tab or a point on the
// chart. The ticked runs are a list of run ids in the order they were ticked,
// at most two; nothing here touches the page.
import { olderFirst } from './runs.js';

// The ticked runs after ticking `run`: a ticked run is unticked, any other is
// added, and a third replaces the oldest tick of the two.
export function tick(ticked, run) {
  if (ticked.includes(run)) return ticked.filter((id) => id !== run);
  return [...ticked, run].slice(-2);
}

// The two ticked runs among `runs` (index entries) as [A, B], A the older,
// or null unless two of them are ticked.
export function tickedPair(ticked, runs) {
  const pair = runs.filter((run) => ticked.includes(run.run));
  if (pair.length !== 2) return null;
  return olderFirst(...pair);
}
