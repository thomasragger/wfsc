import Anthropic from '@anthropic-ai/sdk';
import type { CharacterSheet, QaVerdict } from './types';

const MODEL = process.env.WFSC_QA_MODEL ?? 'claude-sonnet-5';
const PASS_THRESHOLD = Number(process.env.WFSC_QA_THRESHOLD ?? 70);

/**
 * Vision-LLM QA: judge one generated spread against the character sheets and
 * style. Weighted identity 50 / outfit-continuity 30 / style 20 (per research,
 * vision-LLM judging outperforms embedding similarity for this task).
 */
export async function judgeSpread(
  spreadImageUrl: string,
  characters: CharacterSheet[],
  stylePrompt: string,
  client?: Anthropic,
): Promise<QaVerdict> {
  const anthropic = client ?? new Anthropic();

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'text',
      text: `You are QA for a children's picture book. Judge the GENERATED SPREAD (last image) against the character sheet(s) shown first.

Characters expected in or near this scene:
${characters.map((c, i) => `- Reference image ${i + 1}: ${c.name} (${c.description})`).join('\n')}

Target style: ${stylePrompt}

Score 0-100, weighted: character identity match 50%, outfit/feature continuity 30%, style adherence 20%. Not every character must appear in every scene; only penalize characters that appear but look wrong. Also fail (score < 40) for: extra unknown people with faces, garbled anatomy, embedded text or lettering, watermark.

Respond with JSON only: {"score": <int>, "notes": "<one sentence>"}`,
    },
    ...characters.map(
      (c): Anthropic.ContentBlockParam => ({
        type: 'image',
        source: { type: 'url', url: c.sheetUrl },
      }),
    ),
    { type: 'image', source: { type: 'url', url: spreadImageUrl } },
  ];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{ role: 'user', content }],
  });

  const text = response.content.find((c) => c.type === 'text');
  if (!text || text.type !== 'text') throw new Error('QA judge returned no text');
  const match = text.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`QA judge returned unparseable output: ${text.text.slice(0, 200)}`);
  const parsed = JSON.parse(match[0]) as { score: number; notes: string };
  return {
    score: parsed.score,
    notes: parsed.notes,
    pass: parsed.score >= PASS_THRESHOLD,
  };
}
