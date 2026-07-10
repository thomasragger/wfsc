import type { Command } from '../lib/command.ts';
import type { ParsedArgs } from '../lib/args.ts';
import { shopifyAdmin } from '../lib/shopify.ts';

interface ShopResult {
  shop: { name: string; currencyCode: string; storefrontAccessTokens: { nodes: { title: string; accessToken: string }[] } };
}
interface ProductResult {
  productByHandle: { id: string; variants: { nodes: { id: string; title: string; price: string }[] } } | null;
}

async function run(_args: ParsedArgs): Promise<void> {
  const { gql } = await shopifyAdmin();
  console.log('✓ Client credentials grant works');

  // --- Storefront token ---
  const existingTokens = await gql<ShopResult>(
    `{ shop { name currencyCode storefrontAccessTokens(first: 10) { nodes { title accessToken } } } }`,
  );
  console.log(`✓ Connected to shop: ${existingTokens.shop.name} (currency ${existingTokens.shop.currencyCode})`);
  let storefrontToken = existingTokens.shop.storefrontAccessTokens.nodes.find((t) => t.title === 'wfsc-studio')?.accessToken;
  if (!storefrontToken) {
    try {
      const created = await gql<{
        storefrontAccessTokenCreate: { storefrontAccessToken: { accessToken: string }; userErrors: { message: string }[] };
      }>(
        `mutation($input: StorefrontAccessTokenInput!) {
          storefrontAccessTokenCreate(input: $input) {
            storefrontAccessToken { accessToken }
            userErrors { field message }
          }
        }`,
        { input: { title: 'wfsc-studio' } },
      );
      const errs = created.storefrontAccessTokenCreate.userErrors;
      if (errs.length) throw new Error(JSON.stringify(errs));
      storefrontToken = created.storefrontAccessTokenCreate.storefrontAccessToken.accessToken;
      console.log('✓ Storefront token created');
    } catch (err) {
      console.warn(`! Storefront token skipped: ${(err as Error).message}`);
    }
  } else {
    console.log('✓ Storefront token already exists');
  }
  if (storefrontToken) console.log(`SHOPIFY_STOREFRONT_TOKEN=${storefrontToken}`);

  // --- Product + variants ---
  const HANDLE = 'personalized-storybook';
  const existing = await gql<ProductResult>(
    `query($handle: String!) {
      productByHandle(handle: $handle) {
        id
        variants(first: 5) { nodes { id title price } }
      }
    }`,
    { handle: HANDLE },
  );

  let product = existing.productByHandle;
  if (!product) {
    const result = await gql<{
      productSet: {
        product: { id: string; variants: { nodes: { id: string; title: string; price: string }[] } };
        userErrors: { message: string }[];
      };
    }>(
      `mutation($input: ProductSetInput!) {
        productSet(input: $input) {
          product { id variants(first: 5) { nodes { id title price } } }
          userErrors { field message }
        }
      }`,
      {
        input: {
          title: 'Personalized Storybook',
          handle: HANDLE,
          status: 'ACTIVE',
          descriptionHtml:
            '<p>A one-of-a-kind illustrated storybook made from your own memory: your photos, your story, your style. 32 pages, square 21.6 cm, printed in premium full color.</p>',
          productOptions: [{ name: 'Format', values: [{ name: 'Softcover' }, { name: 'Hardcover' }] }],
          variants: [
            { optionValues: [{ optionName: 'Format', name: 'Softcover' }], price: '49.00' },
            { optionValues: [{ optionName: 'Format', name: 'Hardcover' }], price: '69.00' },
          ],
        },
      },
    );
    const errs = result.productSet.userErrors;
    if (errs.length) throw new Error(JSON.stringify(errs));
    product = result.productSet.product;
    console.log('✓ Product created (status ACTIVE)');
  } else {
    console.log('✓ Product already exists');
  }
  for (const v of product.variants.nodes) {
    const key = v.title.toLowerCase().includes('hard') ? 'SHOPIFY_VARIANT_HARDCOVER' : 'SHOPIFY_VARIANT_SOFTCOVER';
    console.log(`${key}=${v.id}  (€${v.price})`);
  }
  console.log('Done.');
}

export const shopifySetup: Command = {
  name: 'shopify-setup',
  summary: 'One-time Shopify setup: verify token, ensure storefront token + product variants.',
  usage: 'shopify-setup',
  run,
};
