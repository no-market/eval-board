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

// A run of a flow the site has no tab for: the receipt fixture as another flow.
async function otherFlowRun() {
  const run = await readJson(join(fixtures, `${REAL}.json`));
  return { ...run, flow: 'other-flow', numbers: undefined };
}

test('a run of a flow with no tab is left out, unchecked', async () => {
  const { runs, out } = await runsDir(['schema.json', `${REAL}.json`]);
  await writeFile(join(runs, 'other-flow.json'), JSON.stringify(await otherFlowRun()));
  await build({ runsDir: runs, outDir: out });
  const index = await readJson(join(out, 'index.json'));
  assert.deepEqual(index.runs.map((r) => r.run), [REAL]);
  assert.deepEqual(await readdir(join(out, 'runs')), [`${REAL}.json`]);
});

const PROMO_4 = '20261031T132616405937-promo';

test('promo runs are indexed and copied beside receipt lines runs, newest first', async () => {
  const { runs, out } = await runsDir(['schema.json', `${REAL}.json`, `${PROMO}.json`, `${PROMO_4}.json`]);
  await build({ runsDir: runs, outDir: out });
  const index = await readJson(join(out, 'index.json'));
  assert.deepEqual(index.runs.map((r) => [r.run, r.flow]), [
    [PROMO_4, 'promo-extraction'],
    [PROMO, 'promo-extraction'],
    [REAL, 'receipt-lines'],
  ]);
  assert.deepEqual((await readdir(join(out, 'runs'))).sort(), [`${REAL}.json`, `${PROMO}.json`, `${PROMO_4}.json`].sort());
});

test('a promo run with verdicts is indexed with what the promos tab needs', async () => {
  const { runs, out } = await runsDir(['schema.json', `${PROMO_4}.json`]);
  await build({ runsDir: runs, outDir: out });
  const [entry] = (await readJson(join(out, 'index.json'))).runs;
  assert.equal(entry.run, PROMO_4);
  assert.equal(entry.file, `${PROMO_4}.json`);
  assert.equal(entry.date, '2026-10-31T13:26:16.405937Z');
  assert.equal(entry.commit, '6457199dd8883b622c64854a39d2f1c5af817f6f');
  assert.equal(entry.schemaVersion, 4);
  assert.equal(entry.prompt, 'promo-v4');
  assert.deepEqual(entry.evalSet, {
    dataset: 'baseline-10-reviewed-v2-context',
    scorer: 'promo-core-text-v6',
    selection: [
      'aldi-kw44-th-p002',
      'aldi-kw44-th-p003',
      'biedronka-j2givjdmw-p004',
      'biedronka-j2givjdmw-p005',
      'kaufland-gazetka-tygodnia-29-10-2026-04-11-2026-dd4837-p004',
      'kaufland-gazetka-tygodnia-29-10-2026-04-11-2026-dd4837-p005',
      'lidl-gazetka-29-10-czw-kw44-p006',
      'lidl-gazetka-29-10-czw-kw44-p117',
    ],
  });
  assert.deepEqual(entry.configs, {
    aldi: { model: 'google/gemini-2.5-flash', strategy: 'text' },
    biedronka: { model: 'google/gemini-2.5-flash', strategy: 'image' },
    kaufland: { model: 'google/gemini-2.5-flash', strategy: 'positioned_text' },
    lidl: { model: 'google/gemini-2.5-flash', strategy: 'text' },
  });
  assert.deepEqual(entry.totals, {
    pages: 8,
    truth: 22,
    promos: 22,
    errors: { count: 9, share: 0.4090909090909091 },
    warnings: { count: 13, share: 0.5909090909090909 },
    matched: 22,
    missed: 0,
    extra: 0,
    recall: 1,
    precision: 1,
    failedPages: 0,
    seconds: { median: 2.8176800990000004, p95: 4.801742476000001 },
    costUsd: 0.0119463,
    knownCostUsd: 0.0119463,
  });
  assert.deepEqual(Object.keys(entry.byChain), ['aldi', 'biedronka', 'kaufland', 'lidl']);
  assert.deepEqual(entry.byChain.aldi, {
    pages: 2,
    truth: 6,
    promos: 6,
    errors: { count: 4, share: 0.6666666666666666 },
    warnings: { count: 2, share: 0.3333333333333333 },
    matched: 6,
    missed: 0,
    extra: 0,
    recall: 1,
    precision: 1,
    failedPages: 0,
    seconds: { median: 2.8176800990000004, p95: 3.265513515000002 },
    costUsd: 0.0033719099999999997,
    knownCostUsd: 0.0033719099999999997,
  });
});

test('a promo run without verdicts is indexed with no promos, errors or warnings', async () => {
  const { runs, out } = await runsDir(['schema.json', `${PROMO}.json`]);
  await build({ runsDir: runs, outDir: out });
  const [entry] = (await readJson(join(out, 'index.json'))).runs;
  assert.equal(entry.schemaVersion, 3);
  assert.equal(entry.evalSet.scorer, 'promo-identity-exact-v2');
  assert.equal(entry.evalSet.selection.length, 10);
  assert.equal(entry.totals.pages, 10);
  assert.equal(entry.totals.promos, null);
  assert.equal(entry.totals.errors, null);
  assert.equal(entry.totals.warnings, null);
  assert.equal(entry.totals.matched, 20);
  assert.equal(entry.totals.recall, 0.5);
});

test('a promo run that does not fit the schema fails with its file name', async () => {
  const { runs, out } = await runsDir(['schema.json', `${PROMO_4}.json`]);
  const broken = await readJson(join(fixtures, `${PROMO_4}.json`));
  delete broken.cases;
  await writeFile(join(runs, 'broken-promo.json'), JSON.stringify(broken));
  await assert.rejects(build({ runsDir: runs, outDir: out }), /broken-promo\.json doesn't fit schema\.json/);
});

test('every run in the repo’s runs/ fits its schema.json and builds', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eval-board-'));
  const repoRuns = new URL('../../runs/', import.meta.url).pathname;
  const index = await build({ runsDir: repoRuns, outDir: join(root, 'dist') });
  const promoFiles = (await readdir(repoRuns)).filter((name) => name.endsWith('-promo.json'));
  assert.ok(promoFiles.length > 0);
  assert.deepEqual(
    index.runs.filter((r) => r.flow === 'promo-extraction').map((r) => r.file).sort(),
    promoFiles.sort(),
  );
});

test('runs of flows with no tab need no schema', async () => {
  const { runs, out } = await runsDir([]);
  await writeFile(join(runs, 'other-flow.json'), JSON.stringify(await otherFlowRun()));
  await build({ runsDir: runs, outDir: out });
  assert.deepEqual(await readJson(join(out, 'index.json')), { runs: [] });
});

test('no runs and no schema build the empty site', async () => {
  const { runs, out } = await runsDir([]);
  await build({ runsDir: runs, outDir: out });
  assert.deepEqual(await readJson(join(out, 'index.json')), { runs: [] });
  assert.ok((await readdir(out)).includes('index.html'));
});

test('runs without a schema fail, naming the missing schema', async () => {
  const { runs, out } = await runsDir([`${REAL}.json`]);
  await assert.rejects(build({ runsDir: runs, outDir: out }), (error) => {
    assert.match(error.message, /schema\.json/);
    assert.match(error.message, /no schema|missing|not found/i);
    assert.doesNotMatch(error.message, /ENOENT/);
    return true;
  });
});
