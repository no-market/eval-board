import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { flowById } from '../src/flows.js';
import { runChecker } from './check.js';
import { summarise } from './summarise.js';

const SRC = new URL('../src/', import.meta.url).pathname;

// Builds the site from `runsDir` into `outDir`: the page with its script and
// styles, `index.json` (the runs of flows with a tab, newest first) and a copy
// of each indexed run under `runs/`. Throws on a run that doesn't fit schema.json.
export async function build({ runsDir, outDir }) {
  const files = (await readdir(runsDir))
    .filter((name) => name.endsWith('.json') && name !== 'schema.json')
    .sort();

  const runs = [];
  if (files.length > 0) {
    const check = runChecker(await readSchema(runsDir, files.length));
    for (const file of files) {
      const run = await readJson(join(runsDir, file));
      check(file, run);
      if (flowById(run.flow)) runs.push({ file, run });
    }
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
