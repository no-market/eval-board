import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { flowById } from '../src/flows.js';
import { runChecker } from './check.js';
import { summarise } from './summarise.js';

const SRC = new URL('../src/', import.meta.url).pathname;

// Builds the site from `runsDir` into `outDir`: the page with its script and
// styles, `index.json` (the runs of flows with a tab, newest first) and a copy
// of each indexed run under `runs/`. Only runs of flows with a tab are checked
// against schema.json, and the build throws on one that doesn't fit; a run of
// any other flow is left out unchecked, so a schema.json that knows only the
// flows with a tab still builds.
export async function build({ runsDir, outDir }) {
  const files = (await readdir(runsDir))
    .filter((name) => name.endsWith('.json') && name !== 'schema.json')
    .sort();

  const runs = [];
  for (const file of files) {
    const run = await readJson(join(runsDir, file));
    if (flowById(run.flow)) runs.push({ file, run });
  }
  if (runs.length > 0) {
    const check = runChecker(await readSchema(runsDir, runs.length));
    for (const { file, run } of runs) check(file, run);
  }
  runs.sort((a, b) => Date.parse(b.run.date) - Date.parse(a.run.date));

  await rm(outDir, { recursive: true, force: true });
  await cp(SRC, outDir, { recursive: true });
  await mkdir(join(outDir, 'runs'));
  for (const { file } of runs) await cp(join(runsDir, file), join(outDir, 'runs', file));
  const index = { runs: runs.map(({ file, run }) => summarise(file, run)) };
  await writeFile(join(outDir, 'index.json'), JSON.stringify(index));
  return index;
}

// The runs' schema.json, which every run is checked against: a clear error
// when there are runs but no schema.
async function readSchema(runsDir, runCount) {
  try {
    return await readJson(join(runsDir, 'schema.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const runFiles = runCount === 1 ? '1 run file' : `${runCount} run files`;
    throw new Error(`There is no schema.json in ${runsDir} to check its ${runFiles} against.`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
