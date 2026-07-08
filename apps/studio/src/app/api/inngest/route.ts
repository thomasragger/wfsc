import { serve } from 'inngest/next';

import { inngest } from '@/inngest/client';
import { functions } from '@/inngest/functions';

export const runtime = 'nodejs';
/**
 * Inngest steps execute inside this route's invocations; generation steps
 * (Claude story ~90s, image gen + QA + persist per spread) far exceed
 * Vercel's default function timeout.
 */
export const maxDuration = 300;

export const { GET, POST, PUT } = serve({ client: inngest, functions });
