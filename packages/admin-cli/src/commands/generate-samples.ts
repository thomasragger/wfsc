import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagBool, flagStr } from '../lib/args.ts';
import { createDb } from '../lib/clients.ts';
import { repoRoot, sampleConfigsDir } from '../lib/paths.ts';
import { importSampleBook } from './import-sample.ts';

// config-basename | category-slug | template-id
const DEFAULT_SAMPLES = [
  's-beach-treasure|mums|beach-treasure',
  's-dads-toolbox|dads|dads-tiny-toolbox-helper',
  's-whale-watching|mums|whale-watching',
  's-golf-grandpa|grandparents|golf-with-grandpa',
  's-grandmas-garden|grandparents|grandmas-garden-of-seasons',
  's-rainy-day-fort|siblings|rainy-day-fort',
];

async function run(args: ParsedArgs): Promise<void> {
  const skipImport = flagBool(args, 'skip-import');
  const only = flagStr(args, 'only');
  const onlySet = only ? new Set(only.split(',').map((s) => s.trim())) : null;
  const samples = DEFAULT_SAMPLES.filter((e) => !onlySet || onlySet.has(e.split('|')[0]));

  // Sample-generation defaults, overridable from the ambient environment.
  const childEnv = {
    ...process.env,
    WFSC_MODEL_SPREAD: process.env.WFSC_MODEL_SPREAD ?? 'google/nano-banana-pro',
    WFSC_SPREAD_CONCURRENCY: process.env.WFSC_SPREAD_CONCURRENCY ?? '2',
    WFSC_MAX_RETRIES: process.env.WFSC_MAX_RETRIES ?? '3',
  };

  const db = skipImport ? null : createDb();

  for (const entry of samples) {
    const [cfg, slug, tpl] = entry.split('|');
    const configPath = join(sampleConfigsDir, `${cfg}.json`);
    const outDir = join(sampleConfigsDir, `generated-${cfg}`);
    console.log(`=== GENERATE: ${cfg} (${tpl}) ===`);
    try {
      execFileSync('pnpm', ['--filter', '@wfsc/pipeline', 'generate-book', configPath, outDir], {
        cwd: repoRoot,
        stdio: 'inherit',
        env: childEnv,
      });
    } catch {
      console.log(`!!! GENERATE FAILED: ${cfg}`);
      continue;
    }
    if (skipImport || !db) continue;
    console.log(`=== IMPORT: ${cfg} -> ${slug} / ${tpl} ===`);
    try {
      await importSampleBook(db, outDir, slug, tpl);
    } catch (err) {
      console.log(`!!! IMPORT FAILED: ${cfg}: ${String(err).slice(0, 160)}`);
    }
  }
  console.log('=== ALL SAMPLES DONE ===');
}

export const generateSamples: Command = {
  name: 'generate-samples',
  summary: 'Generate the showcase sample books via the pipeline, then import each as a public sample.',
  usage: 'generate-samples [--only cfg1,cfg2] [--skip-import]',
  run,
};
