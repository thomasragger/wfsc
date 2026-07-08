/**
 * Sync WFSC content from Supabase into Shopify metaobjects so the theme can
 * render real data natively (categories, story templates, sample books with
 * full spreads for the in-theme viewer).
 *
 * Idempotent: definitions are created once, entries upserted by handle.
 * Run: node --env-file=.env scripts/sync-shopify-metaobjects.mjs
 */
import { createClient } from '@supabase/supabase-js';

const API_VERSION = '2026-01';
const shop = process.env.SHOPIFY_SHOP_DOMAIN;

const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'client_credentials',
    client_id: process.env.SHOPIFY_CLIENT_ID,
    client_secret: process.env.SHOPIFY_CLIENT_SECRET,
  }),
});
const { access_token } = await tokenRes.json();

async function gql(query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': access_token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// ---------------------------------------------------------------------------
// 1. Definitions (create if missing)
// ---------------------------------------------------------------------------
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
];

const existingDefs = await gql(
  `{ metaobjectDefinitions(first: 50) { nodes { type id } } }`,
);
const existingTypes = new Set(existingDefs.metaobjectDefinitions.nodes.map((d) => d.type));

for (const def of DEFINITIONS) {
  if (existingTypes.has(def.type)) {
    console.log(`✓ definition ${def.type} exists`);
    continue;
  }
  const result = await gql(
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

// ---------------------------------------------------------------------------
// 2. Entries from Supabase
// ---------------------------------------------------------------------------
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function upsert(type, handle, fields) {
  const result = await gql(
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

// Categories
const { data: categories } = await db.from('template_categories').select('*').order('sort_order');
const categoryImages = {
  mums: 'mums', dads: 'dads', grandparents: 'grandparents',
  siblings: 'siblings', babies: 'babies', kids: 'kids',
};
for (const c of categories ?? []) {
  await upsert('wfsc_category', c.id, {
    name: c.name,
    tagline: c.tagline,
    image_url: `https://wfsc-studio.vercel.app/categories/${categoryImages[c.id] ?? c.id}.jpg`,
    sort: c.sort_order,
  });
  console.log(`✓ category ${c.id}`);
}

// Templates
const { data: templates } = await db.from('story_templates').select('*').eq('is_active', true).order('sort_order');
for (const t of templates ?? []) {
  await upsert('wfsc_template', t.id, {
    title: t.title,
    tagline: t.tagline,
    description: t.description,
    category: t.category_id,
    beats: JSON.stringify(t.story_beats),
    sort: t.sort_order,
  });
  console.log(`✓ template ${t.id}`);
}

// Sample books (with full spreads for the in-theme viewer)
const { data: samples } = await db
  .from('books')
  .select('*, book_spreads(*), styles(name), story_templates(category_id)')
  .eq('is_sample', true);
let sort = 0;
for (const b of samples ?? []) {
  const category = b.story_templates?.category_id ?? 'kids';
  const spreads = (b.book_spreads ?? [])
    .sort((x, y) => x.position - y.position)
    .map((s) => ({ position: s.position, text: s.text, layout: s.layout, image: s.image_url }));
  await upsert('wfsc_sample_book', category, {
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
