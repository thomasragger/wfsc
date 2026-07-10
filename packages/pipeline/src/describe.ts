import Anthropic from '@anthropic-ai/sdk';
import type { PersonInput } from './types';

const MODEL = process.env.WFSC_QA_MODEL ?? 'claude-sonnet-5';

/**
 * Build the "appearance lock" for a person from their character sheet: a short
 * paragraph reused verbatim in every spread prompt so identity descriptions
 * never drift between pages.
 */
export async function describeCharacter(
  person: PersonInput,
  sheetUrl: string,
  client?: Anthropic,
): Promise<string> {
  const anthropic = client ?? new Anthropic();
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 200,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is the character sheet for ${person.name}${person.role ? ` (${person.role})` : ''} in a children's picture book. Write ONE sentence locking their appearance for illustration prompts. Lead with their HAIRSTYLE (length, shape, colour) and their exact OUTFIT — these are the primary recognizable anchors and must be described precisely — then approximate age and any distinguishing features. No name, no style words, just the visual description. NEVER mention any text, letters, logos or words printed on clothing — describe garments by color and type only (mentioning lettering makes image models render text). No quotation marks in your answer. Example: a 5-year-old girl with curly red pigtails, rosy cheeks, and yellow dungarees over a striped shirt.`,
          },
          { type: 'image', source: { type: 'url', url: sheetUrl } },
        ],
      },
    ],
  });
  const text = response.content.find((c) => c.type === 'text');
  if (!text || text.type !== 'text') throw new Error('describeCharacter returned no text');
  return text.text.trim().replace(/^["']|["']$/g, '');
}
