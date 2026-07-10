import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagBool, flagStr } from '../lib/args.ts';
import { createDb, createAnthropic, createReplicate } from '../lib/clients.ts';
import { toUrl, fetchBytes, upload } from '../lib/images.ts';
import { env } from '../lib/env.ts';

interface GenTemplate {
  id: string;
  title: string;
  tagline: string;
  description: string;
  story_beats: string[];
  prompt_scaffold: string;
  cover_concept: string;
  age_min: number;
  age_max: number;
  occasions: string[];
}

async function run(args: ParsedArgs): Promise<void> {
  const target = Number(flagStr(args, 'target', '8'));
  const previewsOnly = flagBool(args, 'previews-only');
  const db = createDb();
  const replicate = createReplicate();
  const anthropic = createAnthropic();

  const { data: occasions } = await db.from('occasion_categories').select('id, name');
  const occasionList = (occasions ?? []).map((o) => o.id as string);
  const { data: stylesData } = await db
    .from('styles')
    .select('id, style_prompt, reference_image_urls')
    .order('sort_order');
  const styles = (stylesData ?? []) as { id: string; style_prompt: string; reference_image_urls: string[] | null }[];

  async function genTemplates(
    cat: { id: string; name: string; tagline: string },
    needed: number,
    existing: { title: string }[],
  ): Promise<GenTemplate[]> {
    const response = await anthropic.messages
      .stream({
        model: env('WFSC_STORY_MODEL', 'claude-sonnet-5'),
        max_tokens: 16000,
        messages: [
          {
            role: 'user',
            content: `You are the content lead of Warm Fuzzy Story Club: personalized illustrated children's books made from a family's real memory. Write ${needed} NEW story templates for the category "${cat.name}" (${cat.tagline}).

Existing templates in this category (do NOT duplicate their themes): ${existing.map((e) => e.title).join('; ') || 'none'}.

Each template is a reusable narrative skeleton a family adapts with their own memory. Cover a diverse range: everyday moments, adventures, seasons/holidays, milestones, quiet emotional moments. Vary target ages across templates (some 0-2, some 2-5, some 4-8).

Return via the emit_templates tool. Rules per template:
- id: kebab-case slug, unique, descriptive
- title: warm, specific (max 6 words)
- tagline: one evocative line
- description: 1-2 sentences inviting the customer's own memory
- story_beats: EXACTLY 10 ordered beats (short phrases) forming a satisfying arc ending on togetherness
- prompt_scaffold: 1-2 sentences of tone/POV guidance for the story writer
- cover_concept: one visual sentence for the cover illustration
- age_min / age_max: target listener age band (integers 0-8)
- occasions: 1-3 tags from exactly this list: ${occasionList.join(', ')}`,
          },
        ],
        tools: [
          {
            name: 'emit_templates',
            description: 'Emit the new story templates.',
            input_schema: {
              type: 'object',
              required: ['templates'],
              properties: {
                templates: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'title', 'tagline', 'description', 'story_beats', 'prompt_scaffold', 'cover_concept', 'age_min', 'age_max', 'occasions'],
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      tagline: { type: 'string' },
                      description: { type: 'string' },
                      story_beats: { type: 'array', items: { type: 'string' } },
                      prompt_scaffold: { type: 'string' },
                      cover_concept: { type: 'string' },
                      age_min: { type: 'integer' },
                      age_max: { type: 'integer' },
                      occasions: { type: 'array', items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'emit_templates' },
      })
      .finalMessage();
    const toolUse = response.content.find((c) => c.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') throw new Error(`no tool_use (stop=${response.stop_reason})`);
    let input = toolUse.input as unknown;
    if (typeof input === 'string') input = JSON.parse(input);
    let templates = (input as { templates?: unknown }).templates ?? input;
    if (typeof templates === 'string') templates = JSON.parse(templates);
    if (!Array.isArray(templates)) throw new Error(`unexpected shape (stop=${response.stop_reason})`);
    return templates as GenTemplate[];
  }

  if (!previewsOnly) {
    const { data: categories } = await db.from('template_categories').select('*').order('sort_order');
    for (const cat of (categories ?? []) as { id: string; name: string; tagline: string }[]) {
      const { data: existing } = await db.from('story_templates').select('id, title').eq('category_id', cat.id);
      const existingRows = (existing ?? []) as { id: string; title: string }[];
      const needed = target - existingRows.length;
      if (needed <= 0) {
        console.log(`✓ ${cat.id}: already ${existingRows.length}`);
        continue;
      }
      console.log(`▸ ${cat.id}: writing ${needed} new templates…`);

      let templates: GenTemplate[] | null = null;
      for (let attempt = 1; attempt <= 3 && !templates; attempt++) {
        try {
          templates = await genTemplates(cat, needed, existingRows);
        } catch (err) {
          console.log(`  · ${cat.id}: attempt ${attempt} failed (${String(err).slice(0, 80)})`);
        }
      }
      if (!templates) {
        console.log(`  ✗ ${cat.id}: giving up after 3 attempts`);
        continue;
      }

      let sort = existingRows.length + 1;
      for (const t of templates) {
        const styleId = styles[sort % styles.length].id;
        const { error } = await db.from('story_templates').upsert({
          id: t.id,
          category_id: cat.id,
          title: t.title,
          tagline: t.tagline,
          description: t.description,
          suggested_style_id: styleId,
          story_beats: t.story_beats,
          prompt_scaffold: t.prompt_scaffold,
          cover_concept: t.cover_concept,
          age_min: t.age_min,
          age_max: t.age_max,
          occasions: t.occasions.filter((o) => occasionList.includes(o)),
          sort_order: sort++,
          is_active: true,
        });
        console.log(error ? `  ✗ ${t.id}: ${error.message}` : `  ✓ ${t.id}`);
      }
    }
  }

  // Preview illustrations for templates lacking one (sequential, rate-friendly).
  await db.storage.createBucket('renders', { public: true }).catch(() => undefined);
  const { data: all } = await db
    .from('story_templates')
    .select('id, cover_concept, suggested_style_id')
    .is('preview_image_url', null);
  const allRows = (all ?? []) as { id: string; cover_concept: string; suggested_style_id: string }[];
  console.log(`▸ generating ${allRows.length} template previews…`);
  for (const t of allRows) {
    const style = styles.find((s) => s.id === t.suggested_style_id) ?? styles[0];
    try {
      const output = await replicate.run('google/nano-banana-pro', {
        input: {
          prompt: `Children's picture-book cover illustration (no text, no title, no lettering): ${t.cover_concept}. Generic charming characters. Style: ${style.style_prompt}. Reserve a quiet area in the upper third.`,
          aspect_ratio: '1:1',
          output_format: 'png',
          ...(style.reference_image_urls?.length ? { image_input: style.reference_image_urls.slice(0, 1) } : {}),
        },
      });
      const bytes = await fetchBytes(toUrl(output));
      const pub = await upload(db, 'renders', `template-previews/${t.id}.png`, bytes, 'image/png');
      await db.from('story_templates').update({ preview_image_url: pub }).eq('id', t.id);
      console.log(`  ✓ ${t.id}`);
    } catch (err) {
      console.log(`  ✗ ${t.id}: ${String(err).slice(0, 120)}`);
    }
  }
  console.log('Template expansion complete.');
}

export const expandTemplates: Command = {
  name: 'expand-templates',
  summary: 'Write new story templates per category via Claude, then generate previews.',
  usage: 'expand-templates [--target 8] [--previews-only]',
  run,
};
