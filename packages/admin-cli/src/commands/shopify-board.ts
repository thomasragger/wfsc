import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { flagStr } from '../lib/args.ts';
import { createDb } from '../lib/clients.ts';
import { shopifyAdmin } from '../lib/shopify.ts';
import { assetsDir } from '../lib/paths.ts';

const HANDLE = 'personalized-storybook';

interface ProductResult {
  productByHandle: {
    id: string;
    featuredMedia: { id: string } | null;
    options: { id: string; name: string; optionValues: { id: string; name: string }[] }[];
    variants: { nodes: { id: string; title: string; price: string }[] };
  } | null;
}

async function run(args: ParsedArgs): Promise<void> {
  const { gql } = await shopifyAdmin();

  const { productByHandle: product } = await gql<ProductResult>(
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
  if (!format) throw new Error('Format option not found');
  console.log('current variants:', product.variants.nodes.map((v) => v.title).join(', '));

  // 1. Add the "Board book" option value if missing.
  if (!format.optionValues.some((v) => v.name === 'Board book')) {
    const r = await gql<{ productOptionUpdate: { userErrors: { message: string }[] } }>(
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

  // 2. Create the board variant if missing.
  let boardVariant = product.variants.nodes.find((v) => v.title.toLowerCase().includes('board'));
  if (!boardVariant) {
    const r = await gql<{
      productVariantsBulkCreate: { productVariants: { id: string; title: string; price: string }[]; userErrors: { message: string }[] };
    }>(
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

  // 3. Product image, if none yet.
  if (!product.featuredMedia) {
    const imgFile = flagStr(
      args,
      'image',
      join(assetsDir, 'book-mockups', 'Gemini_Generated_Image_aeutghaeutghaeut.png'),
    );
    const db = createDb();
    await db.storage
      .from('renders')
      .upload('product/personalized-storybook.png', await readFile(imgFile), { contentType: 'image/png', upsert: true });
    const imageUrl = db.storage.from('renders').getPublicUrl('product/personalized-storybook.png').data.publicUrl;
    const r = await gql<{ productCreateMedia: { mediaUserErrors: { message: string }[] } }>(
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
}

export const shopifyBoard: Command = {
  name: 'shopify-board',
  summary: 'Add the €39 Board book variant and ensure the shared product has an image.',
  usage: 'shopify-board [--image <file>]',
  run,
};
