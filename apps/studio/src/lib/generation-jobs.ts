import { supabaseAdmin } from './supabase';

/**
 * Cost tracking for the generation pipeline (the `generation_jobs` table).
 * Costs are ESTIMATES (env-tunable per stage) — good enough for budget guards
 * and per-book cost queries; exact provider billing lives with the providers.
 */

export type GenerationStage =
  | 'story'
  | 'character_sheet'
  | 'preview_spread'
  | 'spread'
  | 'regen_spread'
  | 'upscale';

/** Stages incurred before payment — these count against the preview budget. */
const PREVIEW_STAGES: GenerationStage[] = ['story', 'character_sheet', 'preview_spread'];

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Estimated USD per single model call, per stage (image stages are per attempt). */
export const STAGE_COST_USD: Record<GenerationStage, number> = {
  story: num(process.env.WFSC_COST_STORY, 0.1),
  character_sheet: num(process.env.WFSC_COST_CHARACTER, 0.15),
  preview_spread: num(process.env.WFSC_COST_SPREAD, 0.06), // generation + QA judge
  spread: num(process.env.WFSC_COST_SPREAD, 0.06),
  regen_spread: num(process.env.WFSC_COST_SPREAD, 0.06),
  upscale: num(process.env.WFSC_COST_UPSCALE, 0.02),
};

export async function recordGenerationJob(opts: {
  bookId: string;
  stage: GenerationStage;
  status: 'succeeded' | 'failed';
  /** Number of model calls this covers (e.g. QA retry attempts). */
  units?: number;
  subjectId?: string;
  error?: string;
}): Promise<void> {
  const units = opts.units ?? 1;
  const { error } = await supabaseAdmin().from('generation_jobs').insert({
    book_id: opts.bookId,
    stage: opts.stage,
    status: opts.status,
    subject_id: opts.subjectId ?? null,
    error: opts.error ?? null,
    cost_usd: Math.round(STAGE_COST_USD[opts.stage] * units * 10_000) / 10_000,
    finished_at: new Date().toISOString(),
  });
  // Bookkeeping must never break generation.
  if (error) console.error(`recordGenerationJob(${opts.stage}) failed: ${error.message}`);
}

/** Estimated preview (pre-payment) spend since UTC midnight. */
export async function previewSpendTodayUsd(): Promise<number> {
  const midnightUtc = new Date();
  midnightUtc.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin()
    .from('generation_jobs')
    .select('cost_usd')
    .in('stage', PREVIEW_STAGES)
    .gte('created_at', midnightUtc.toISOString());
  if (error) {
    console.error(`previewSpendTodayUsd failed: ${error.message}`);
    return 0; // fail open: a broken budget query must not stop the business
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
}

/** How many regenerations a book has used (customer edit loop cap). */
export async function regenCountForBook(bookId: string): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('generation_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId)
    .eq('stage', 'regen_spread');
  if (error) {
    console.error(`regenCountForBook failed: ${error.message}`);
    return 0;
  }
  return count ?? 0;
}
