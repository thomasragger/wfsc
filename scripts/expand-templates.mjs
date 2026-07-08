/**
 * Expand the story template library to ~13 per relationship category using
 * Claude, tagged with occasions + age bands, then generate a preview
 * illustration per new template (nano-banana-pro, brand styles rotated).
 *
 * Idempotent-ish: skips categories that already have >= TARGET templates;
 * preview generation skips templates that already have preview_image_url.
 * Run: node --env-file=.env scripts/expand-templates.mjs [--previews-only]
 */
import { createClient } from '@supabase/supabase-js';
import Replicate from 'replicate';
import Anthropic from '@anthropic-ai/sdk';

const TARGET_PER_CATEGORY = 8;
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic();
const replicate = new Replicate();
const previewsOnly = process.argv.includes('--previews-only');

const { data: occasions } = await db.from('occasion_categories').select('id, name');
const occasionList = occasions.map((o) => o.id);
const { data: styles } = await db.from('styles').select('id, style_prompt, reference_image_urls').order('sort_order');

async function genTemplates(cat, needed, existing) {
  // Stream + finalMessage: avoids the SDK's non-streaming 10-min guard and
  // reliably returns the complete (untruncated) tool output.
  const response = await anthropic.messages.stream({
    model: process.env.WFSC_STORY_MODEL ?? 'claude-sonnet-5',
    max_tokens: 16000,
    messages: [{
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
    }],
    tools: [{
      name: 'emit_templates',
      description: 'Emit the new story templates.',
      input_schema: {
        type: 'object', required: ['templates'],
        properties: { templates: { type: 'array', items: {
          type: 'object',
          required: ['id','title','tagline','description','story_beats','prompt_scaffold','cover_concept','age_min','age_max','occasions'],
          properties: {
            id:{type:'string'}, title:{type:'string'}, tagline:{type:'string'}, description:{type:'string'},
            story_beats:{type:'array',items:{type:'string'}}, prompt_scaffold:{type:'string'}, cover_concept:{type:'string'},
            age_min:{type:'integer'}, age_max:{type:'integer'}, occasions:{type:'array',items:{type:'string'}},
          },
        } } },
      },
    }],
    tool_choice: { type: 'tool', name: 'emit_templates' },
  }).finalMessage();
  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse) throw new Error(`no tool_use (stop=${response.stop_reason})`);
  let input = toolUse.input;
  if (typeof input === 'string') input = JSON.parse(input);
  let templates = input.templates ?? input;
  if (typeof templates === 'string') templates = JSON.parse(templates);
  if (!Array.isArray(templates)) throw new Error(`unexpected shape (stop=${response.stop_reason})`);
  return templates;
}

if (!previewsOnly) {
  const { data: categories } = await db.from('template_categories').select('*').order('sort_order');
  for (const cat of categories) {
    const { data: existing } = await db.from('story_templates').select('id, title').eq('category_id', cat.id);
    const needed = TARGET_PER_CATEGORY - (existing?.length ?? 0);
    if (needed <= 0) { console.log(`✓ ${cat.id}: already ${existing.length}`); continue; }
    console.log(`▸ ${cat.id}: writing ${needed} new templates…`);

    // The model occasionally emits a malformed/odd tool payload — retry a few
    // times before giving up on the category.
    let templates = null;
    for (let attempt = 1; attempt <= 3 && !templates; attempt++) {
      try {
        templates = await genTemplates(cat, needed, existing);
      } catch (err) {
        console.log(`  · ${cat.id}: attempt ${attempt} failed (${String(err).slice(0, 80)})`);
      }
    }
    if (!templates) {
      console.log(`  ✗ ${cat.id}: giving up after 3 attempts`);
      continue;
    }

    let sort = (existing?.length ?? 0) + 1;
    for (const t of templates) {
      const styleId = styles[sort % styles.length].id;
      const { error } = await db.from('story_templates').upsert({
        id: t.id, category_id: cat.id, title: t.title, tagline: t.tagline, description: t.description,
        suggested_style_id: styleId, story_beats: t.story_beats, prompt_scaffold: t.prompt_scaffold,
        cover_concept: t.cover_concept, age_min: t.age_min, age_max: t.age_max,
        occasions: t.occasions.filter((o) => occasionList.includes(o)), sort_order: sort++,
        is_active: true,
      });
      console.log(error ? `  ✗ ${t.id}: ${error.message}` : `  ✓ ${t.id}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Preview illustrations for templates lacking one (sequential, rate-friendly)
// ---------------------------------------------------------------------------
await db.storage.createBucket('renders', { public: true }).catch(() => undefined);
const { data: all } = await db.from('story_templates').select('id, cover_concept, suggested_style_id').is('preview_image_url', null);
console.log(`▸ generating ${all.length} template previews…`);
for (const t of all) {
  const style = styles.find((s) => s.id === t.suggested_style_id) ?? styles[0];
  try {
    const output = await replicate.run('google/nano-banana-pro', {
      input: {
        prompt: `Children's picture-book cover illustration (no text, no title, no lettering): ${t.cover_concept}. Generic charming characters. Style: ${style.style_prompt}. Reserve a quiet area in the upper third.`,
        aspect_ratio: '1:1', output_format: 'png',
        ...(style.reference_image_urls?.length ? { image_input: style.reference_image_urls.slice(0, 1) } : {}),
      },
    });
    const url = typeof output === 'string' ? output : Array.isArray(output) ? String(output[0]) : String(output.url?.() ?? output.url);
    const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
    const path = `template-previews/${t.id}.png`;
    const { error } = await db.storage.from('renders').upload(path, bytes, { contentType: 'image/png', upsert: true });
    if (error) throw new Error(error.message);
    const pub = db.storage.from('renders').getPublicUrl(path).data.publicUrl;
    await db.from('story_templates').update({ preview_image_url: pub }).eq('id', t.id);
    console.log(`  ✓ ${t.id}`);
  } catch (err) {
    console.log(`  ✗ ${t.id}: ${String(err).slice(0, 120)}`);
  }
}
console.log('Template expansion complete.');
