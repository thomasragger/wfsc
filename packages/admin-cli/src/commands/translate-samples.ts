import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagBool, flagStr } from '../lib/args.ts';
import { createDb, createAnthropic } from '../lib/clients.ts';

/**
 * Translate the showcase sample books (books.is_sample = true) so a German
 * visitor sees the whole book in German: title, dedication greeting and every
 * spread. Unlike the catalog `translate` command (one row = one call), a book
 * is translated in ONE coherent Claude call so character voice, rhythm and
 * recurring phrases stay consistent across spreads.
 *
 * Overlay shape mirrors 0012_i18n.sql: base columns stay English; the German
 * text lands in books.translations.de.{title,greeting} and each spread's
 * book_spreads.translations.de.text. Readers overlay it via
 * apps/studio/src/lib/i18n-content.ts for is_sample books only.
 */

const LOCALE_NAMES: Record<string, string> = {
  de: 'German',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
};

interface SpreadRow {
  id: string;
  position: number;
  text: string | null;
  translations: Record<string, Record<string, string>> | null;
}

interface BookRow {
  id: string;
  title: string | null;
  greeting: string | null;
  translations: Record<string, Record<string, string>> | null;
}

interface BookTranslation {
  title: string;
  greeting?: string;
  spreads: { position: number; text: string }[];
}

async function translateBook(
  anthropic: import('@anthropic-ai/sdk').default,
  model: string,
  localeName: string,
  isGerman: boolean,
  book: { title: string; greeting: string | null; spreads: { position: number; text: string }[] },
): Promise<BookTranslation> {
  const hasGreeting = !!(book.greeting && book.greeting.trim());
  const properties: Record<string, unknown> = {
    title: { type: 'string', description: 'The translated book title.' },
    spreads: {
      type: 'array',
      description: 'Every spread, keyed by its position, with the translated text.',
      items: {
        type: 'object',
        required: ['position', 'text'],
        properties: {
          position: { type: 'integer' },
          text: { type: 'string' },
        },
      },
    },
  };
  const required = ['title', 'spreads'];
  if (hasGreeting) {
    properties.greeting = { type: 'string', description: 'The translated dedication.' };
    required.push('greeting');
  }

  const payload = {
    title: book.title,
    ...(hasGreeting ? { greeting: book.greeting } : {}),
    spreads: book.spreads,
  };

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    system:
      `You translate personalized illustrated children's books for Warm Fuzzy Story Club into ${localeName}. ` +
      `Translate the ENTIRE book as one coherent story: keep the read-aloud rhythm, the playful sound-words, and the warm, cozy picture-book voice across every spread, and keep recurring phrases consistent. ` +
      (isGerman
        ? `Use the informal du-Form throughout, natural for reading aloud to a small child. Spell umlauts correctly (ä ö ü ß). `
        : '') +
      `Keep every character name, place name and proper noun exactly as written. Preserve line breaks and the length feel of each piece of text. Do not add or drop spreads. Return ONLY the translation via the tool.`,
    messages: [
      {
        role: 'user',
        content: `Translate this whole children's book into ${localeName}:\n${JSON.stringify(payload, null, 2)}`,
      },
    ],
    tools: [
      {
        name: 'emit_translation',
        description: 'Emit the full translated book: title, optional greeting, and every spread by position.',
        input_schema: { type: 'object', required, properties } as never,
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
  return input as BookTranslation;
}

async function run(args: ParsedArgs): Promise<void> {
  const locale = flagStr(args, 'locale', 'de');
  const localeName = LOCALE_NAMES[locale] ?? locale;
  const model = flagStr(args, 'model', 'claude-opus-4-8');
  const force = flagBool(args, 'force');
  const dryRun = flagBool(args, 'dry-run');

  const db = createDb();
  const anthropic = dryRun ? null : createAnthropic();

  const { data: booksData, error } = await db
    .from('books')
    .select('id, title, greeting, translations')
    .eq('is_sample', true)
    .order('created_at');
  if (error) throw new Error(error.message);
  const books = (booksData ?? []) as BookRow[];
  console.log(`▸ translating ${books.length} sample books into ${localeName}…`);

  let translated = 0;
  let skipped = 0;
  for (const book of books) {
    const overlay = book.translations?.[locale];
    if (!force && overlay?.title && overlay.title.trim()) {
      skipped++;
      continue;
    }

    const { data: spreadsData, error: sErr } = await db
      .from('book_spreads')
      .select('id, position, text, translations')
      .eq('book_id', book.id)
      .order('position');
    if (sErr) {
      console.log(`  ✗ ${book.title}: ${sErr.message}`);
      continue;
    }
    const spreads = (spreadsData ?? []) as SpreadRow[];
    const textSpreads = spreads.filter((s) => s.text && s.text.trim());

    if (dryRun) {
      console.log(`  · would translate "${book.title}" (${textSpreads.length} spreads${book.greeting ? ' + greeting' : ''})`);
      translated++;
      continue;
    }

    try {
      const out = await translateBook(anthropic!, model, localeName, locale === 'de', {
        title: book.title ?? '',
        greeting: book.greeting,
        spreads: textSpreads.map((s) => ({ position: s.position, text: s.text as string })),
      });

      // Book row: title + greeting overlay.
      const bookFields: Record<string, string> = { title: out.title };
      if (out.greeting && book.greeting) bookFields.greeting = out.greeting;
      const bookMerged = {
        ...(book.translations ?? {}),
        [locale]: { ...(book.translations?.[locale] ?? {}), ...bookFields },
      };
      const { error: upErr } = await db.from('books').update({ translations: bookMerged }).eq('id', book.id);
      if (upErr) throw new Error(upErr.message);

      // Each spread by position.
      const byPos = new Map(out.spreads.map((s) => [s.position, s.text]));
      let missed = 0;
      for (const s of textSpreads) {
        const text = byPos.get(s.position);
        if (!text || !text.trim()) {
          missed++;
          continue;
        }
        const merged = {
          ...(s.translations ?? {}),
          [locale]: { ...(s.translations?.[locale] ?? {}), text },
        };
        const { error: spErr } = await db.from('book_spreads').update({ translations: merged }).eq('id', s.id);
        if (spErr) throw new Error(`spread ${s.position}: ${spErr.message}`);
      }
      translated++;
      console.log(`  ✓ ${out.title} (${textSpreads.length - missed}/${textSpreads.length} spreads${missed ? `, ${missed} missing` : ''})`);
    } catch (err) {
      console.log(`  ✗ ${book.title}: ${String(err).slice(0, 160)}`);
    }
  }

  console.log(`\nDone. Translated ${translated}, skipped ${skipped} (already done).`);
}

export const translateSamples: Command = {
  name: 'translate-samples',
  summary: 'Translate each sample book coherently (title, greeting, all spreads) into translations.<locale> (idempotent).',
  usage: 'translate-samples [--locale de] [--force] [--model claude-opus-4-8] [--dry-run]',
  run,
};
