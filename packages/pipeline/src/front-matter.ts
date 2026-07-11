import Anthropic from '@anthropic-ai/sdk';

/**
 * Inline front-matter suggestions for the create wizard: short title and
 * dedication (Widmung) options grounded in the family's memory. Small, cheap
 * companion to generateStory — same client setup and tool-forced JSON output.
 */

const MODEL = process.env.WFSC_SUGGEST_MODEL ?? 'claude-sonnet-5';

export type FrontMatterKind = 'title' | 'dedication';

export interface FrontMatterSuggestionRequest {
  kind: FrontMatterKind;
  /** The family's memory, in their own words. Personal data — never log it. */
  memoryText: string;
  /** Template the book started from, as a tone/angle hint. */
  templateTitle?: string;
  /** First names of the people in the book. */
  castNames?: string[];
  /** Target listener/reader age. */
  targetAge?: number;
  language?: string; // default 'English'
}

const SYSTEM = `You help parents put the finishing touches on a personalized children's picture book at Warm Fuzzy Story Club. You suggest short front-matter text grounded in the family's real memory. Rules:
- Ground every option in the actual memory and the real names given. Never invent names or facts.
- Write in the requested language, naturally and idiomatically. Never translate literally.
- Titles: at most 6 words each, no quotation marks, capitalization that fits the language. Give three clearly different angles (e.g. the place, the feeling, the running joke).
- Dedications: 1 to 3 short sentences each, warm and personal, like a handwritten note inside a gift. Address the child (or the family) directly. No sign-off line, no quotation marks.
- Never use em dashes.
- Return exactly 3 options via the emit_options tool.`;

export async function generateFrontMatterOptions(
  req: FrontMatterSuggestionRequest,
  client?: Anthropic,
): Promise<string[]> {
  const anthropic = client ?? new Anthropic();

  const castLine = req.castNames?.length
    ? `People in the story:\n${req.castNames.map((n) => `- ${n}`).join('\n')}\n`
    : '';
  const templateLine = req.templateTitle
    ? `The book started from the story idea "${req.templateTitle}".\n`
    : '';
  const ageLine = req.targetAge ? `Target age of the child: ${req.targetAge} years old.\n` : '';
  const ask =
    req.kind === 'title'
      ? 'Suggest 3 book title options.'
      : 'Suggest 3 dedication options for the dedication page at the front of the book.';

  const prompt = `${ask} Write them in ${req.language ?? 'English'}.
${templateLine}${ageLine}${castLine}
The real memory, in the family's own words:
"""
${req.memoryText}
"""

Return the options via the emit_options tool.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    tools: [
      {
        name: 'emit_options',
        description: 'Emit exactly 3 suggestion options.',
        input_schema: {
          type: 'object',
          required: ['options'],
          properties: {
            options: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'emit_options' },
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Suggestion generation returned no structured output');
  }
  // Like generateStory: the model occasionally emits array fields as
  // JSON-encoded strings.
  const input = toolUse.input as Record<string, unknown>;
  let options = input.options;
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch {
      // fall through to the array check below
    }
  }
  if (!Array.isArray(options)) {
    throw new Error('Suggestion generation returned no options');
  }
  const clean = options
    .filter((o): o is string => typeof o === 'string' && o.trim().length > 0)
    .map((o) => o.trim())
    .slice(0, 3);
  if (clean.length === 0) {
    throw new Error('Suggestion generation returned empty options');
  }
  return clean;
}
