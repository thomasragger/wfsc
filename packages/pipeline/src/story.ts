import Anthropic from '@anthropic-ai/sdk';
import { StorySchema, type PersonInput, type Story } from './types';

const MODEL = process.env.WFSC_STORY_MODEL ?? 'claude-sonnet-5';

export interface StoryRequest {
  memoryText: string;
  people: PersonInput[];
  /** Optional template scaffolding from story_templates. */
  template?: {
    title: string;
    storyBeats: string[];
    promptScaffold?: string | null;
    coverConcept?: string | null;
  };
  spreadCount?: number; // default 14
  language?: string; // default 'English'
}

const SYSTEM = `You are the head writer at Warm Fuzzy Story Club. You turn a family's real memory into a warm, read-aloud children's picture book. Rules:
- Write for reading aloud to ages 2-6: short sentences, rhythm, gentle humor, concrete sensory details.
- Use the real names and real details from the memory. Never invent facts that contradict it.
- Each spread's "text" is 2-4 short sentences.
- Each spread's "illustration_prompt" describes ONLY the scene, action, setting, mood and composition. NEVER describe what the people look like (identity comes from reference images). Refer to people by their NAME in UPPERCASE.
- Every illustration_prompt must note where quiet copy space should remain (matching "copy_space").
- Vary layouts for pacing; use "full-bleed-overlay" for 2-3 big emotional moments.
- The final spread lands on togetherness and love, not on the activity.`;

export async function generateStory(req: StoryRequest, client?: Anthropic): Promise<Story> {
  const anthropic = client ?? new Anthropic();
  const spreadCount = req.spreadCount ?? 14;

  const peopleList = req.people
    .map((p) => `- ${p.name}${p.role ? ` (${p.role})` : ''}`)
    .join('\n');

  const templateBlock = req.template
    ? `\nUse this story template as the narrative skeleton (adapt beats to the real memory, merge or drop beats as needed):
Template: ${req.template.title}
Beats:\n${req.template.storyBeats.map((b, i) => `${i + 1}. ${b}`).join('\n')}
${req.template.promptScaffold ? `Guidance: ${req.template.promptScaffold}` : ''}`
    : '';

  const prompt = `Write a ${spreadCount}-spread picture book in ${req.language ?? 'English'}.

The real memory, in the family's own words:
"""
${req.memoryText}
"""

People in the story:
${peopleList}
${templateBlock}

Return the complete book via the emit_story tool.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
    tools: [
      {
        name: 'emit_story',
        description: 'Emit the finished picture book as structured data.',
        input_schema: {
          type: 'object',
          required: ['title', 'cover_prompt', 'spreads'],
          properties: {
            title: { type: 'string' },
            cover_prompt: { type: 'string' },
            spreads: {
              type: 'array',
              items: {
                type: 'object',
                required: ['text', 'illustration_prompt', 'copy_space', 'layout'],
                properties: {
                  text: { type: 'string' },
                  illustration_prompt: { type: 'string' },
                  copy_space: { type: 'string' },
                  layout: {
                    type: 'string',
                    enum: ['text-left', 'text-right', 'full-bleed-overlay', 'text-bottom'],
                  },
                },
              },
            },
          },
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'emit_story' },
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Story generation returned no structured output');
  }
  return StorySchema.parse(toolUse.input);
}
