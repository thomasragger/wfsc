/**
 * Renders a JSON-LD structured-data <script>. Server-only, additive: drop it
 * anywhere in a page's JSX without touching surrounding markup or copy.
 *
 * `productJsonLd` builds a schema.org Product for a personalized book. Price is
 * an AggregateOffer spanning the format range (board €39 to hardcover €69).
 */

const PRICE_LOW = "39";
const PRICE_HIGH = "69";
const PRICE_CURRENCY = "EUR";

type JsonLdData = Record<string, unknown>;

export function JsonLd({ data }: { data: JsonLdData }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is a trusted, server-built object, not user HTML.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function productJsonLd({
  name,
  description,
  image,
  url,
}: {
  name: string;
  description?: string | null;
  image?: string | null;
  url?: string;
}): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(url ? { url } : {}),
    brand: { "@type": "Brand", name: "Warm Fuzzy Story Club" },
    category: "Personalized children's book",
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: PRICE_CURRENCY,
      lowPrice: PRICE_LOW,
      highPrice: PRICE_HIGH,
      offerCount: 3,
      availability: "https://schema.org/InStock",
    },
  };
}
