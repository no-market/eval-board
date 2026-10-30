import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../build/build.js';

const fixtures = new URL('./fixtures/', import.meta.url).pathname;
const REAL = '2026-10-30T165731-google-gemini-2.5-flash-google-gemini-2.5-flash';
const PROMO = '20261030T183542318891-promo';

async function runsDir(files) {
  const root = await mkdtemp(join(tmpdir(), 'eval-board-'));
  const runs = join(root, 'runs');
  await mkdir(runs);
  for (const name of files) await copyFile(join(fixtures, name), join(runs, name));
  return { runs, out: join(root, 'dist') };
}

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

test('a valid run is indexed with the numbers the table needs', async () => {
  const { runs, out } = await runsDir(['schema.json', `${REAL}.json`]);
  await build({ runsDir: runs, outDir: out });
  const index = await readJson(join(out, 'index.json'));
  assert.deepEqual(index.runs, [
    {
      run: REAL,
      file: `${REAL}.json`,
      flow: 'receipt-lines',
      date: '2026-10-30T16:57:31.175075Z',
      commit: '27e9b49710a39b391b194187719b1fc625d17117',
      flowVersion: 'V1',
      models: { read: 'google/gemini-2.5-flash', chooseKinds: 'google/gemini-2.5-flash' },
      receipts: 3,
      failed: 0,
      lines: 45,
      errors: { count: 4, share: 0.08888888888888889 },
      warnings: { count: 22, share: 0.4888888888888889 },
      seconds: { median: 14.892434632000004, p95: 21.660589302000005 },
      costUsd: 0.005538366666666667,
    },
  ]);
});

test('the page, its script and styles and a copy of each run are written', async () => {
  const { runs, out } = await runsDir(['schema.json', `${REAL}.json`]);
  await build({ runsDir: runs, outDir: out });
  const written = await readdir(out);
  for (const name of ['index.html', 'styles.css', 'main.js', 'index.json']) {
    assert.ok(written.includes(name), `${name} is written`);
  }
  assert.deepEqual(
    await readJson(join(out, 'runs', `${REAL}.json`)),
    await readJson(join(fixtures, `${REAL}.json`)),
  );
});

test('runs are indexed newest first', async () => {
  const { runs, out } = await runsDir(['schema.json', `${REAL}.json`]);
  const later = await readJson(join(fixtures, `${REAL}.json`));
  later.date = '2026-10-31T09:00:00Z';
  await writeFile(join(runs, 'a-later-run.json'), JSON.stringify(later));
  await build({ runsDir: runs, outDir: out });
  const index = await readJson(join(out, 'index.json'));
  assert.deepEqual(index.runs.map((r) => r.run), ['a-later-run', REAL]);
});

test('a run that does not fit the schema fails with its file name', async () => {
  const { runs, out } = await runsDir(['schema.json', `${REAL}.json`]);
  const broken = await readJson(join(fixtures, `${REAL}.json`));
  delete broken.numbers;
  await writeFile(join(runs, 'broken-run.json'), JSON.stringify(broken));
  await assert.rejects(build({ runsDir: runs, outDir: out }), /broken-run\.json/);
});

test('a promo run is checked and left out of the index', async () => {
  const { runs, out } = await runsDir(['schema.json', `${REAL}.json`, `${PROMO}.json`]);
  await build({ runsDir: runs, outDir: out });
  const index = await readJson(join(out, 'index.json'));
  assert.deepEqual(index.runs.map((r) => r.run), [REAL]);

  const broken = await readJson(join(fixtures, `${PROMO}.json`));
  delete broken.cases;
  await writeFile(join(runs, 'broken-promo.json'), JSON.stringify(broken));
  await assert.rejects(build({ runsDir: runs, outDir: out }), /broken-promo\.json/);
});

test('no runs and no schema build the empty site', async () => {
  const { runs, out } = await runsDir([]);
  await build({ runsDir: runs, outDir: out });
  assert.deepEqual(await readJson(join(out, 'index.json')), { runs: [] });
  assert.ok((await readdir(out)).includes('index.html'));
});
