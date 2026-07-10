import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagStr } from '../lib/args.ts';
import { createDb } from '../lib/clients.ts';
import { shopifyAdmin, type ShopifyAdmin } from '../lib/shopify.ts';
import { requireEnv } from '../lib/env.ts';

const DEFINITIONS = [
  {
    type: 'wfsc_category',
    name: 'WFSC Category',
    fields: [
      { key: 'name', name: 'Name', type: 'single_line_text_field' },
      { key: 'tagline', name: 'Tagline', type: 'single_line_text_field' },
      { key: 'image_url', name: 'Image URL', type: 'url' },
      { key: 'sort', name: 'Sort order', type: 'number_integer' },
    ],
  },
  {
    type: 'wfsc_template',
    name: 'WFSC Story Template',
    fields: [
      { key: 'title', name: 'Title', type: 'single_line_text_field' },
      { key: 'tagline', name: 'Tagline', type: 'single_line_text_field' },
      { key: 'description', name: 'Description', type: 'multi_line_text_field' },
      { key: 'category', name: 'Category handle', type: 'single_line_text_field' },
      { key: 'beats', name: 'Story beats (JSON)', type: 'json' },
      { key: 'sort', name: 'Sort order', type: 'number_integer' },
    ],
  },
  {
    type: 'wfsc_sample_book',
    name: 'WFSC Sample Book',
    fields: [
      { key: 'title', name: 'Title', type: 'single_line_text_field' },
      { key: 'category', name: 'Category handle', type: 'single_line_text_field' },
      { key: 'style_name', name: 'Illustration style', type: 'single_line_text_field' },
      { key: 'cover_url', name: 'Cover URL', type: 'url' },
      { key: 'template_id', name: 'Template id', type: 'single_line_text_field' },
      { key: 'greeting', name: 'Dedication', type: 'multi_line_text_field' },
      { key: 'spreads', name: 'Spreads (JSON)', type: 'json' },
      { key: 'sort', name: 'Sort order', type: 'number_integer' },
    ],
  },
] as const;

async function upsert(sf: ShopifyAdmin, type: string, handle: string, fields: Record<string, unknown>): Promise<void> {
  const result = await sf.gql<{ metaobjectUpsert: { userErrors: { message: string }[] } }>(
    `mutation($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
      metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
        metaobject { id handle }
        userErrors { field message }
      }
    }`,
    {
      handle: { type, handle },
      metaobject: {
        fields: Object.entries(fields)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([key, value]) => ({ key, value: String(value) })),
        capabilities: { publishable: { status: 'ACTIVE' } },
      },
    },
  );
  const errs = result.metaobjectUpsert.userErrors;
  if (errs.length) throw new Error(`${type}/${handle}: ${JSON.stringify(errs)}`);
}

async function run(args: ParsedArgs): Promise<void> {
  requireEnv('STUDIO_URL');
  const studioUrl = flagStr(args, 'studio-url', process.env.STUDIO_URL as string).replace(/\/$/, '');
  const sf = await shopifyAdmin();
  const db = createDb();

  // 1. Definitions (create if missing).
  const existingDefs = await sf.gql<{ metaobjectDefinitions: { nodes: { type: string; id: string }[] } }>(
    `{ metaobjectDefinitions(first: 50) { nodes { type id } } }`,
  );
  const existingTypes = new Set(existingDefs.metaobjectDefinitions.nodes.map((d) => d.type));

  for (const def of DEFINITIONS) {
    if (existingTypes.has(def.type)) {
      console.log(`✓ definition ${def.type} exists`);
      continue;
    }
    const result = await sf.gql<{ metaobjectDefinitionCreate: { userErrors: { message: string }[] } }>(
      `mutation($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition { type }
          userErrors { field message }
        }
      }`,
      {
        definition: {
          type: def.type,
          name: def.name,
          access: { storefront: 'PUBLIC_READ' },
          capabilities: { publishable: { enabled: true } },
          fieldDefinitions: def.fields.map((f) => ({ key: f.key, name: f.name, type: f.type })),
        },
      },
    );
    const errs = result.metaobjectDefinitionCreate.userErrors;
    if (errs.length) throw new Error(`${def.type}: ${JSON.stringify(errs)}`);
    console.log(`✓ definition ${def.type} created`);
  }

  // 2. Entries from Supabase.
  const { data: categories } = await db.from('template_categories').select('*').order('sort_order');
  for (const c of ((categories ?? []) as { id: string; name: string; tagline: string; sort_order: number }[])) {
    await upsert(sf, 'wfsc_category', c.id, {
      name: c.name,
      tagline: c.tagline,
      image_url: `${studioUrl}/categories/${c.id}.jpg`,
      sort: c.sort_order,
    });
    console.log(`✓ category ${c.id}`);
  }

  const { data: templates } = await db.from('story_templates').select('*').eq('is_active', true).order('sort_order');
  for (const t of ((templates ?? []) as {
    id: string;
    title: string;
    tagline: string;
    description: string;
    category_id: string;
    story_beats: unknown;
    sort_order: number;
  }[])) {
    await upsert(sf, 'wfsc_template', t.id, {
      title: t.title,
      tagline: t.tagline,
      description: t.description,
      category: t.category_id,
      beats: JSON.stringify(t.story_beats),
      sort: t.sort_order,
    });
    console.log(`✓ template ${t.id}`);
  }

  const { data: samples } = await db
    .from('books')
    .select('*, book_spreads(*), styles(name), story_templates(category_id)')
    .eq('is_sample', true);
  let sort = 0;
  for (const b of ((samples ?? []) as {
    title: string;
    cover_image_url: string | null;
    template_id: string | null;
    greeting: string | null;
    book_spreads?: { position: number; text: string; layout: string; image_url: string | null }[];
    styles?: { name: string } | null;
    story_templates?: { category_id: string } | null;
  }[])) {
    const category = b.story_templates?.category_id ?? 'kids';
    const spreads = (b.book_spreads ?? [])
      .sort((x, y) => x.position - y.position)
      .map((s) => ({ position: s.position, text: s.text, layout: s.layout, image: s.image_url }));
    await upsert(sf, 'wfsc_sample_book', category, {
      title: b.title,
      category,
      style_name: b.styles?.name,
      cover_url: b.cover_image_url,
      template_id: b.template_id,
      greeting: b.greeting,
      spreads: JSON.stringify(spreads),
      sort: sort++,
    });
    console.log(`✓ sample ${category}: ${b.title}`);
  }

  console.log('Sync complete.');
}

export const syncShopify: Command = {
  name: 'sync-shopify',
  summary: 'Sync categories, templates and sample books from Supabase into Shopify metaobjects.',
  usage: 'sync-shopify [--studio-url <url>]  (defaults to STUDIO_URL)',
  run,
};
