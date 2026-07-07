/**
 * One-time Shopify store setup (idempotent):
 * 1. Verify client-credentials token grant
 * 2. Ensure a Storefront API access token exists (prints it for .env)
 * 3. Ensure the "Personalized Storybook" product with Softcover €49 /
 *    Hardcover €69 variants exists (prints variant GIDs for .env)
 *
 * Run: node --env-file=.env scripts/shopify-setup.mjs
 * Prints NO secrets except the storefront token (which is public-facing by design).
 */
const API_VERSION = '2026-01';
const shop = process.env.SHOPIFY_SHOP_DOMAIN;
const clientId = process.env.SHOPIFY_CLIENT_ID;
const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
if (!shop || !clientId || !clientSecret) {
  console.error('Missing SHOPIFY_SHOP_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET');
  process.exit(1);
}

const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
});
if (!tokenRes.ok) {
  console.error(`Token grant FAILED (${tokenRes.status}): ${await tokenRes.text()}`);
  process.exit(1);
}
const { access_token } = await tokenRes.json();
console.log('✓ Client credentials grant works');

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

// --- Storefront token -------------------------------------------------------
const existingTokens = await admin(
  `{ shop { name currencyCode storefrontAccessTokens(first: 10) { nodes { title accessToken } } } }`,
);
console.log(`✓ Connected to shop: ${existingTokens.shop.name} (currency ${existingTokens.shop.currencyCode})`);
let storefrontToken = existingTokens.shop.storefrontAccessTokens.nodes.find(
  (t) => t.title === 'wfsc-studio',
)?.accessToken;
if (!storefrontToken) {
  try {
    const created = await admin(
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
    console.warn(`! Storefront token skipped: ${err.message}`);
  }
} else {
  console.log('✓ Storefront token already exists');
}
if (storefrontToken) console.log(`SHOPIFY_STOREFRONT_TOKEN=${storefrontToken}`);

// --- Product + variants ------------------------------------------------------
const HANDLE = 'personalized-storybook';
const existing = await admin(
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
  const result = await admin(
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
          '<p>A one-of-a-kind illustrated storybook made from your own memory: your photos, your story, your style. 32 pages, square 21.6 cm, printed in premium full color.</p>',
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
