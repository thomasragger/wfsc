import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagBool, flagStr } from '../lib/args.ts';
import { repoRoot } from '../lib/paths.ts';

function connString(): string {
  const conn = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
  if (!conn) {
    throw new Error(
      'Set SUPABASE_DB_URL (or DATABASE_URL) to the Postgres connection string. ' +
        'Apply migrations first with the Supabase CLI, then run seed.',
    );
  }
  return conn;
}

function applyFile(conn: string, file: string, dryRun: boolean): void {
  const argv = ['-v', 'ON_ERROR_STOP=1', conn, '-f', file];
  if (dryRun) {
    console.log(`  would run: psql ${argv.slice(0, 3).join(' ')} -f ${file}`);
    return;
  }
  console.log(`  psql -f ${file}`);
  execFileSync('psql', argv, { stdio: 'inherit' });
}

async function run(args: ParsedArgs): Promise<void> {
  const dryRun = flagBool(args, 'dry-run');
  const conn = dryRun ? 'postgres://<redacted>' : connString();

  if (flagBool(args, 'migrations')) {
    const dir = join(repoRoot, 'supabase', 'migrations');
    const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
    console.log(`Applying ${files.length} migrations from ${dir}`);
    for (const f of files) applyFile(conn, join(dir, f), dryRun);
  }

  const seedFile = flagStr(args, 'file', join(repoRoot, 'supabase', 'seed.sql'));
  if (!existsSync(seedFile) && !dryRun) throw new Error(`Seed file not found: ${seedFile}`);
  console.log(`Applying seed: ${seedFile}`);
  applyFile(conn, seedFile, dryRun);
  console.log('Seed complete.');
}

export const seed: Command = {
  name: 'seed',
  summary: 'Apply supabase/seed.sql (and optionally migrations) to the database via psql.',
  usage: 'seed [--migrations] [--file <seed.sql>] [--dry-run]  (needs SUPABASE_DB_URL / DATABASE_URL)',
  run,
};
