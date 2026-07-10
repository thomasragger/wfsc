import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { repoRoot } from './paths.ts';

export interface SeedStyle {
  id: string;
  stylePrompt: string;
}

/**
 * Split a SQL VALUES body into its top-level `(...)` row tuples, respecting
 * single-quoted strings (with '' escapes) so commas/parens inside prompts do
 * not confuse the split.
 */
function splitRows(body: string): string[] {
  const rows: string[] = [];
  let depth = 0;
  let inStr = false;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === "'") {
        if (body[i + 1] === "'") i++; // escaped quote
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") { inStr = true; continue; }
    if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && start >= 0) {
        rows.push(body.slice(start, i));
        start = -1;
      }
    }
  }
  return rows;
}

/** Split a single row tuple into its top-level comma-separated SQL literals. */
function splitFields(row: string): string[] {
  const fields: string[] = [];
  let inStr = false;
  let start = 0;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (inStr) {
      if (ch === "'") {
        if (row[i + 1] === "'") i++;
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") { inStr = true; continue; }
    if (ch === ',') {
      fields.push(row.slice(start, i).trim());
      start = i + 1;
    }
  }
  fields.push(row.slice(start).trim());
  return fields;
}

/** Unwrap a single-quoted SQL string literal (undoing '' escapes). */
function unquote(literal: string): string {
  const t = literal.trim();
  if (t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  return t;
}

/**
 * Parse the `insert into styles (id, name, description, style_prompt,
 * sort_order) values (...)` block out of seed.sql. This is the single source of
 * truth for BUILTIN_STYLES.
 */
export async function parseSeedStyles(seedPath?: string): Promise<SeedStyle[]> {
  const path = seedPath ?? join(repoRoot, 'supabase', 'seed.sql');
  const sql = await readFile(path, 'utf8');
  const match = sql.match(
    /insert\s+into\s+styles\s*\(\s*id\s*,\s*name\s*,\s*description\s*,\s*style_prompt\s*,\s*sort_order\s*\)\s*values([\s\S]*?)on\s+conflict/i,
  );
  if (!match) throw new Error(`Could not find styles insert block in ${path}`);
  const rows = splitRows(match[1]);
  const styles: SeedStyle[] = [];
  for (const row of rows) {
    const fields = splitFields(row);
    if (fields.length < 4) continue;
    styles.push({ id: unquote(fields[0]), stylePrompt: unquote(fields[3]) });
  }
  if (!styles.length) throw new Error('No style rows parsed from seed.sql');
  return styles;
}
