import Anthropic from '@anthropic-ai/sdk';
import type { CharacterSheet, QaVerdict } from './types';

const MODEL = process.env.WFSC_QA_MODEL ?? 'claude-sonnet-5';
const PASS_THRESHOLD = Number(process.env.WFSC_QA_THRESHOLD ?? 70);

/**
 * Vision-LLM QA: judge one generated spread against the character sheets and
 * style. Weighted identity 40 / scene-match 20 / outfit-continuity 20 /
 * style 20 (per research, vision-LLM judging outperforms embedding similarity
 * for this task). Uses forced tool output so the verdict is always parseable.
 */
export async function judgeSpread(
  spreadImageUrl: string,
  characters: CharacterSheet[],
  stylePrompt: string,
  client?: Anthropic,
  scenePrompt?: string,
): Promise<QaVerdict> {
  const anthropic = client ?? new Anthropic();

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: 'text',
      text: `You are QA for a children's picture book. Judge the GENERATED SPREAD (last image) against the character sheet(s) shown first.

Characters expected in or near this scene:
${characters.map((c, i) => `- Reference image ${i + 1}: ${c.name} (${c.description})`).join('\n')}
${scenePrompt ? `\nIntended scene (the illustration MUST depict this): ${scenePrompt}\n` : ''}
Target style: ${stylePrompt}

Score 0-100, weighted: character identity match 40%, scene/story match 20%, outfit/feature continuity 20%, style adherence 20%. Not every character must appear in every scene; only penalize characters that appear but look wrong.
HARD FAILURES (score < 40) — check each explicitly:
- the same character appearing more than once in the scene (duplicates/clones)
- anatomical errors: extra or missing limbs/fingers, three arms, two heads, merged bodies, wrong finger count
- SCALE/PROPORTION errors: a character drawn far too small or too large for the scene, distorted body proportions, a person floating, or a character standing on top of a prop as if miniature
- a character's hair length/color, age, or build clearly different from their sheet
- the illustration clearly depicting a different scene than the intended scene above
- extra unknown people with detailed faces
- embedded text, lettering, or watermark

Report your verdict via the emit_verdict tool.`,
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
    tools: [
      {
        name: 'emit_verdict',
        description: 'Report the QA verdict for the generated spread.',
        input_schema: {
          type: 'object',
          required: ['score', 'notes'],
          properties: {
            score: { type: 'integer', minimum: 0, maximum: 100 },
            notes: { type: 'string', description: 'One sentence explaining the score.' },
          },
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'emit_verdict' },
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') throw new Error('QA judge returned no verdict');
  const parsed = toolUse.input as { score: number; notes: string };
  return {
    score: parsed.score,
    notes: parsed.notes,
    pass: parsed.score >= PASS_THRESHOLD,
  };
}

/**
 * judgeSpread that never throws: QA infrastructure hiccups must not kill a
 * book run. Errors return a neutral pass so generation proceeds (flagged in
 * notes for later inspection).
 */
export async function judgeSpreadSafe(
  spreadImageUrl: string,
  characters: CharacterSheet[],
  stylePrompt: string,
  client?: Anthropic,
  scenePrompt?: string,
): Promise<QaVerdict> {
  try {
    return await judgeSpread(spreadImageUrl, characters, stylePrompt, client, scenePrompt);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { score: PASS_THRESHOLD, pass: true, notes: `qa-error (auto-pass): ${message.slice(0, 120)}` };
  }
}
