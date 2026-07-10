import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import Replicate from 'replicate';
import { requireEnv } from './env.ts';

/** Service-role Supabase client (server-side, full access). */
export function createDb(): SupabaseClient {
  requireEnv('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
  return createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
}

export function createAnthropic(): Anthropic {
  requireEnv('ANTHROPIC_API_KEY');
  return new Anthropic();
}

export function createReplicate(): Replicate {
  requireEnv('REPLICATE_API_TOKEN');
  return new Replicate();
}
