// Builds the site from the repo's runs/ into site/dist/:
//   npm run build [-- <runs dir> <out dir>]
import { resolve } from 'node:path';
import { build } from './build/build.js';

const here = new URL('.', import.meta.url).pathname;
const [runsDir = resolve(here, '../runs'), outDir = resolve(here, 'dist')] = process.argv.slice(2);

try {
  const { runs } = await build({ runsDir, outDir });
  console.log(`Built ${outDir} with ${runs.length} eval runs.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
