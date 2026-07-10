import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import { repoRoot } from '../lib/paths.ts';
import { flagBool, flagStr } from '../lib/args.ts';
import { parseSeedStyles } from '../lib/seed-styles.ts';

const TARGET = join(repoRoot, 'packages', 'pipeline', 'src', 'styles.ts');

function render(styles: { id: string; stylePrompt: string }[]): string {
  const entries = styles
    .map(
      (s) =>
        `  ${JSON.stringify(s.id)}: {\n` +
        `    id: ${JSON.stringify(s.id)},\n` +
        `    stylePrompt:\n      ${JSON.stringify(s.stylePrompt)},\n` +
        `  },`,
    )
    .join('\n');
  return (
    `import type { StyleDef } from './types';\n\n` +
    `/**\n` +
    ` * Built-in style prompts for the offline CLI harness.\n` +
    ` *\n` +
    ` * AUTO-GENERATED from supabase/seed.sql by \`wfsc-admin codegen-styles\`.\n` +
    ` * supabase/seed.sql is the single source of truth; do NOT hand-edit this\n` +
    ` * file. Re-run the codegen after changing the styles seed.\n` +
    ` */\n` +
    `export const BUILTIN_STYLES: Record<string, Omit<StyleDef, 'referenceImageUrls'>> = {\n` +
    `${entries}\n` +
    `};\n`
  );
}

async function run(args: import('../lib/args.ts').ParsedArgs): Promise<void> {
  const seedPath = flagStr(args, 'seed');
  const styles = await parseSeedStyles(seedPath);
  const output = render(styles);
  const target = flagStr(args, 'out', TARGET);

  if (flagBool(args, 'check')) {
    const current = await readFile(target, 'utf8').catch(() => '');
    if (current.trim() === output.trim()) {
      console.log(`OK: ${target} is in sync with seed.sql (${styles.length} styles).`);
      return;
    }
    console.error(`OUT OF SYNC: ${target} does not match seed.sql. Run: wfsc-admin codegen-styles`);
    process.exitCode = 1;
    return;
  }

  await writeFile(target, output);
  console.log(`Wrote ${styles.length} styles to ${target}`);
}

export const codegenStyles: Command = {
  name: 'codegen-styles',
  summary: 'Regenerate packages/pipeline/src/styles.ts from supabase/seed.sql.',
  usage: 'codegen-styles [--check] [--seed <seed.sql>] [--out <styles.ts>]',
  run,
};
