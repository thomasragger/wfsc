import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagBool, flagStr } from '../lib/args.ts';
import { createDb, createAnthropic } from '../lib/clients.ts';

/**
 * Catalog tables carrying a `translations` jsonb column and the customer-facing
 * fields worth translating. Base columns stay English (the fallback); the
 * overlay lives at translations["<locale>"] and is applied by
 * apps/studio/src/lib/i18n-content.ts.
 */
const TABLES: Record<string, string[]> = {
  styles: ['name', 'description'],
  template_categories: ['name', 'tagline'],
  occasion_categories: ['name', 'tagline'],
  story_templates: ['title', 'tagline', 'description'],
};

const LOCALE_NAMES: Record<string, string> = {
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
};

type Row = Record<string, unknown> & { id: string; translations?: Record<string, Record<string, string>> | null };

/** True if the locale overlay already covers every requested field non-empty. */
function alreadyDone(row: Row, locale: string, fields: string[]): boolean {
  const overlay = row.translations?.[locale];
  if (!overlay) return false;
  return fields.every((f) => {
    // Only require a translation for fields the base row actually has.
    const base = row[f];
    if (base === null || base === undefined || base === '') return true;
    const v = overlay[f];
    return typeof v === 'string' && v.trim() !== '';
  });
}

async function translateFields(
  anthropic: import('@anthropic-ai/sdk').default,
  model: string,
  localeName: string,
  fields: Record<string, string>,
): Promise<Record<string, string>> {
  const keys = Object.keys(fields);
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2000,
    system:
      `You translate short marketing copy for Warm Fuzzy Story Club, a brand that turns family memories into personalized illustrated children's books. ` +
      `Translate into ${localeName}. Voice: warm, cozy, plain-spoken and friendly, never corporate. For German use the informal du-Form. ` +
      `Keep names, product names and proper nouns intact. Preserve the tone and length feel of each field. Return ONLY the translations via the tool.`,
    messages: [
      {
        role: 'user',
        content: `Translate these fields into ${localeName}:\n${JSON.stringify(fields, null, 2)}`,
      },
    ],
    tools: [
      {
        name: 'emit_translation',
        description: 'Emit the translated fields, keyed identically to the input.',
        input_schema: {
          type: 'object',
          required: keys,
          properties: Object.fromEntries(keys.map((k) => [k, { type: 'string' }])),
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'emit_translation' },
  });
  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error(`no tool_use (stop=${response.stop_reason})`);
  }
  let input = toolUse.input as unknown;
  if (typeof input === 'string') input = JSON.parse(input);
  return input as Record<string, string>;
}

async function run(args: ParsedArgs): Promise<void> {
  const locale = flagStr(args, 'locale', 'de');
  const localeName = LOCALE_NAMES[locale] ?? locale;
  const model = flagStr(args, 'model', 'claude-opus-4-8');
  const force = flagBool(args, 'force');
  const dryRun = flagBool(args, 'dry-run');
  const only = flagStr(args, 'tables');
  const limit = flagStr(args, 'limit');
  const maxRows = limit ? Number(limit) : Infinity;

  const tables = only ? only.split(',').map((t) => t.trim()).filter(Boolean) : Object.keys(TABLES);
  for (const t of tables) {
    if (!TABLES[t]) throw new Error(`Unknown table '${t}'. Known: ${Object.keys(TABLES).join(', ')}`);
  }

  const db = createDb();
  const anthropic = dryRun ? null : createAnthropic();

  let translated = 0;
  let skipped = 0;
  for (const table of tables) {
    const fields = TABLES[table];
    const { data, error } = await db
      .from(table)
      .select(['id', ...fields, 'translations'].join(', '));
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as unknown as Row[];
    console.log(`\n[${table}] ${rows.length} rows, locale ${locale}`);

    for (const row of rows) {
      if (translated >= maxRows) break;
      if (!force && alreadyDone(row, locale, fields)) {
        skipped++;
        continue;
      }
      const source: Record<string, string> = {};
      for (const f of fields) {
        const v = row[f];
        if (typeof v === 'string' && v.trim() !== '') source[f] = v;
      }
      if (!Object.keys(source).length) {
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(`  · would translate ${row.id}: ${Object.keys(source).join(', ')}`);
        translated++;
        continue;
      }
      try {
        const out = await translateFields(anthropic!, model, localeName, source);
        const existing = (row.translations ?? {}) as Record<string, Record<string, string>>;
        const merged = {
          ...existing,
          [locale]: { ...(existing[locale] ?? {}), ...out },
        };
        const { error: upErr } = await db.from(table).update({ translations: merged }).eq('id', row.id);
        if (upErr) throw new Error(upErr.message);
        translated++;
        console.log(`  ✓ ${row.id}`);
      } catch (err) {
        console.log(`  ✗ ${row.id}: ${String(err).slice(0, 160)}`);
      }
    }
  }

  console.log(`\nDone. Translated ${translated}, skipped ${skipped} (already done).`);
}

export const translate: Command = {
  name: 'translate',
  summary: 'Fill the translations jsonb column for catalog rows via Anthropic (idempotent).',
  usage: 'translate [--locale de] [--force] [--tables a,b] [--model claude-opus-4-8] [--limit N] [--dry-run]',
  run,
};
