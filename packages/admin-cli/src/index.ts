import { loadEnv } from './lib/env.ts';
import { parseArgs } from './lib/args.ts';
import type { Command } from './lib/command.ts';

import { seed } from './commands/seed.ts';
import { expandTemplates } from './commands/expand-templates.ts';
import { locationTemplates } from './commands/location-templates.ts';
import { letterTitles } from './commands/letter-titles.ts';
import { styleRefs } from './commands/style-refs.ts';
import { sectionMascots } from './commands/section-mascots.ts';
import { templateMockups } from './commands/template-mockups.ts';
import { bookMockups } from './commands/book-mockups.ts';
import { generateSamples } from './commands/generate-samples.ts';
import { importSample } from './commands/import-sample.ts';
import { finalizeSamples } from './commands/finalize-samples.ts';
import { addSampleCast } from './commands/add-sample-cast.ts';
import { restyleSamples } from './commands/restyle-samples.ts';
import { syncShopify } from './commands/sync-shopify.ts';
import { shopifySetup } from './commands/shopify-setup.ts';
import { shopifyBoard } from './commands/shopify-board.ts';
import { luluSetup } from './commands/lulu-setup.ts';
import { codegenStyles } from './commands/codegen-styles.ts';
import { translate } from './commands/translate.ts';

// Grouped for the help output. Order within a group is workflow order.
const GROUPS: { title: string; commands: Command[] }[] = [
  {
    title: 'Catalog',
    commands: [seed, codegenStyles, expandTemplates, locationTemplates, translate],
  },
  {
    title: 'Imagery',
    commands: [styleRefs, letterTitles, templateMockups, bookMockups, sectionMascots],
  },
  {
    title: 'Samples',
    commands: [generateSamples, importSample, finalizeSamples, addSampleCast, restyleSamples],
  },
  {
    title: 'Commerce',
    commands: [shopifySetup, shopifyBoard, syncShopify, luluSetup],
  },
];

const COMMANDS = new Map<string, Command>();
for (const g of GROUPS) for (const c of g.commands) COMMANDS.set(c.name, c);

function printHelp(): void {
  const pad = Math.max(...[...COMMANDS.keys()].map((n) => n.length));
  console.log('wfsc-admin <command> [options]\n');
  console.log('Warm Fuzzy Story Club content-ops CLI. See docs/content-ops.md for the runbook.\n');
  for (const g of GROUPS) {
    console.log(`${g.title}:`);
    for (const c of g.commands) {
      console.log(`  ${c.name.padEnd(pad)}  ${c.summary}`);
    }
    console.log('');
  }
  console.log('Run `wfsc-admin <command> --help` for a command usage line.');
  console.log('Common env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, REPLICATE_API_TOKEN.');
  console.log('Loaded from repo-root .env automatically. State/progress files live in .wfsc-admin/.');
}

async function main(): Promise<void> {
  loadEnv();
  const [name, ...rest] = process.argv.slice(2);

  if (!name || name === '--help' || name === '-h' || name === 'help') {
    printHelp();
    return;
  }

  const command = COMMANDS.get(name);
  if (!command) {
    console.error(`Unknown command: ${name}\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  const args = parseArgs(rest);
  if (args.flags.help === true) {
    console.log(`wfsc-admin ${command.usage ?? command.name}`);
    console.log(command.summary);
    return;
  }

  await command.run(args);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
