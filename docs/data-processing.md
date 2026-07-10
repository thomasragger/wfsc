# Data processing inventory

Feeds the privacy policy (workstream O1). What personal data WFSC touches,
where it lives, who processes it, and how it leaves the system.

## Personal data we collect

| Data | Where it lives | Why |
|---|---|---|
| Customer photos (usually of children) | Supabase Storage, PRIVATE `uploads` bucket (`photos/<uuid>.<ext>`), referenced from `book_people.photo_urls` | Source for character sheets |
| Names + roles of book cast | `book_people.name`, `.role` | Story text and character identity |
| Free-text family memory | `books.memory_text` | Story source |
| Dedication text + signature | `books.greeting`, `.greeting_from` | Printed dedication page |
| Customer email | `books.email`, `shopify_orders.raw` | Preview/review/print notifications; order matching |
| Shipping address | `shopify_orders.shipping_address` (+ Shopify itself) | Print fulfillment via Lulu |
| Generated likenesses (character sheets, spread images, print PDFs) | Supabase Storage, PRIVATE `book-assets` bucket (`books/<bookId>/…`) | The product |

Public `renders` bucket holds catalog and sample content only (styles,
template previews, sample books with synthetic casts) — never real customer
data.

## Access model

Private-bucket objects are served exclusively via short-lived signed URLs
(7 days, re-signed on every page render). The book itself is guarded by a
48-hex-char CSPRNG access token; anyone with the link can view the book —
stated in the preview/review emails.

## Sub-processors

| Processor | Data sent | Purpose |
|---|---|---|
| Supabase | everything above | Database + storage |
| Vercel | request data, IP, geo header | Hosting |
| Anthropic (Claude) | memory text, names, character sheet images | Story writing, appearance descriptions, image QA |
| Replicate (nano-banana-pro, seedream, recraft) | customer photos (signed URLs), character sheets, style refs | Character sheets, illustrations, upscaling |
| Shopify | email, address, order data | Checkout, payments, fulfillment records |
| Lulu | name, shipping address, phone, email, print PDFs (signed URLs) | Printing + shipping |
| Resend | email address, book title | Transactional email |
| Inngest | book ids (no personal payloads beyond ids) | Job orchestration |

## Deletion and retention

- **Customer-initiated erasure:** `DELETE /api/books/[token]` removes the
  book, people, spreads, generation jobs, and all storage objects; linked
  order rows are kept for bookkeeping but stripped of PII and unlinked.
  Blocked only while an order is actively in production.
- **Automatic retention purge:** daily Inngest cron (`retention-purge`)
  deletes source photos and character sheets `RETENTION_DAYS` (default 30)
  after a book ships or is cancelled. The finished book stays viewable.
  Stamped in `books.assets_purged_at`.
- **Shopify GDPR webhooks:** `customers/redact` erases all books for the
  customer's email (production-in-flight books are flagged to ops instead);
  `customers/data_request` and `shop/redact` alert ops for manual handling
  (30-day SLA).

## Open items (for the privacy policy / legal review)

- DPA status with each sub-processor; Replicate + Anthropic data-retention
  terms for API inputs.
- EXIF stripping on upload is part of workstream O5 (photos may contain GPS
  data until then).
- Photos are processed by AI models; consent wording in the wizard should say
  this explicitly (O1).
