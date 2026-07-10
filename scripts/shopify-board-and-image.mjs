/**
 * 1. Add a "Board book" value to the Format option + a €39 board variant
 *    (inventory untracked + CONTINUE, so it never reads "sold out").
 * 2. Give the shared product a cover image so the hosted Shopify checkout
 *    isn't imageless. (Per-book covers can't appear in Shopify's hosted
 *    checkout with a single shared product — our own /cart sheet already
 *    shows the real cover via enrichCart.)
 *
 * Run: node --env-file=.env scripts/shopify-board-and-image.mjs
 * Prints SHOPIFY_VARIANT_BOARD for .env + Vercel.
 */
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';

const API_VERSION = '2026-01';
const shop = process.env.SHOPIFY_SHOP_DOMAIN;
const HANDLE = 'personalized-storybook';

const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'client_credentials',
    client_id: process.env.SHOPIFY_CLIENT_ID,
    client_secret: process.env.SHOPIFY_CLIENT_SECRET,
  }),
});
if (!tokenRes.ok) throw new Error(`token grant ${tokenRes.status}: ${await tokenRes.text()}`);
const { access_token } = await tokenRes.json();

async function admin(query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': access_token },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

const { productByHandle: product } = await admin(
  `query($handle: String!) {
    productByHandle(handle: $handle) {
      id
      featuredMedia { id }
      options { id name optionValues { id name } }
      variants(first: 20) { nodes { id title price } }
    }
  }`,
  { handle: HANDLE },
);
if (!product) throw new Error('Product not found');
const format = product.options.find((o) => o.name === 'Format');
console.log('current variants:', product.variants.nodes.map((v) => v.title).join(', '));

// 1. Add the "Board book" option value if missing.
const hasBoard = format.optionValues.some((v) => v.name === 'Board book');
if (!hasBoard) {
  const r = await admin(
    `mutation($productId: ID!, $option: OptionUpdateInput!, $add: [OptionValueCreateInput!]) {
      productOptionUpdate(productId: $productId, option: $option, optionValuesToAdd: $add) {
        userErrors { field message }
      }
    }`,
    { productId: product.id, option: { id: format.id }, add: [{ name: 'Board book' }] },
  );
  const e = r.productOptionUpdate.userErrors;
  if (e.length) throw new Error(JSON.stringify(e));
  console.log('✓ added "Board book" option value');
}

// 2. Create the board variant (if missing).
let boardVariant = product.variants.nodes.find((v) => v.title.toLowerCase().includes('board'));
if (!boardVariant) {
  const r = await admin(
    `mutation($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants { id title price }
        userErrors { field message }
      }
    }`,
    {
      productId: product.id,
      variants: [
        {
          optionValues: [{ optionName: 'Format', name: 'Board book' }],
          price: '39.00',
          inventoryPolicy: 'CONTINUE',
          inventoryItem: { tracked: false },
        },
      ],
    },
  );
  const e = r.productVariantsBulkCreate.userErrors;
  if (e.length) throw new Error(JSON.stringify(e));
  boardVariant = r.productVariantsBulkCreate.productVariants[0];
  console.log('✓ created Board book variant');
}
console.log(`SHOPIFY_VARIANT_BOARD=${boardVariant.id}  (€${boardVariant.price})`);

// 3. Product image, if none yet. Upload a generic book photo to a public URL first.
if (!product.featuredMedia) {
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const bytes = await readFile(
    '/Users/thomasragger/Desktop/personal-lab/wfsc-website/archive/book-mockups/Gemini_Generated_Image_aeutghaeutghaeut.png',
  );
  await db.storage.from('renders').upload('product/personalized-storybook.png', bytes, {
    contentType: 'image/png',
    upsert: true,
  });
  const imageUrl = db.storage.from('renders').getPublicUrl('product/personalized-storybook.png').data.publicUrl;
  const r = await admin(
    `mutation($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { alt status }
        mediaUserErrors { field message }
      }
    }`,
    {
      productId: product.id,
      media: [{ originalSource: imageUrl, alt: 'A Warm Fuzzy Story Club book', mediaContentType: 'IMAGE' }],
    },
  );
  const e = r.productCreateMedia.mediaUserErrors;
  if (e.length) throw new Error(JSON.stringify(e));
  console.log('✓ product image set');
} else {
  console.log('✓ product already has an image');
}
console.log('Done.');
