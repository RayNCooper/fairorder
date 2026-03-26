# Changelog

All notable changes to the FairOrder product app are documented in this file.

## [0.5.4.0] - 2026-03-27

### Added
- VAT handling with integer-cent math (lib/vat.ts) — net + vat === gross invariant, validated rates (0%, 7%, 19%)
- Digital receipt on order confirmation screen with per-rate VAT breakdown (Bonpflicht compliance)
- Receipt email template with VAT breakdown, legal footer, payment method
- Impressum page (auto-generated from operator legal info, DDG § 5)
- Datenschutzerklarung page (DSGVO-compliant privacy policy)
- Legal info settings section in operator dashboard (company name, address, phone, USt-IdNr, responsible person)
- Bookkeeping export API (CSV with VAT columns, auth-protected, date-filterable)
- GDPR anonymization API (nulls personal data while retaining financial records for GoBD)
- Allergen exclusion filter on public menu (LMIV compliance — hides items containing selected allergens)
- Category-level VAT rate field (schema-ready for per-category defaults)
- VAT rate selector (0%/7%/19%) in menu item editor
- "Alle Preise inkl. MwSt." footer with Impressum/Datenschutz links on public menu
- 11 VAT unit tests including rounding invariant (all amounts 1-10000 at 7% and 19%)
- 6 export integration tests (auth, validation, CSV format, empty state)
- eslint-plugin-jsx-a11y for continuous accessibility enforcement
- PayPal payment support — operators can now accept PayPal alongside card payments and cash
- Two ways to offer PayPal: natively via PayPal SDK, or through Stripe's automatic payment methods (zero-config)
- Dedicated `/api/payment/capture` endpoint for PayPal's server-side capture flow
- PayPal button in guest checkout with `shape: "rect"` matching 0px border-radius design system
- Mobile redirect recovery — PayPal payments survive full-page redirects on mobile Safari via sessionStorage
- "Bestellung aufgegeben" pending screen for PayPal compliance holds (PENDING capture status)
- PayPal toggle in operator dashboard settings (only visible when PayPal API keys are configured)
- `centsToDecimal()` helper for PayPal's decimal amount format
- Capture endpoint tests (validation, auth gate, idempotency, PENDING status)

### Changed
- Renamed taxRate to vatRate throughout codebase (correct German terminology, mapped to existing DB column)
- OrderItem now stores pre-computed netAmountCents and vatAmountCents (GoBD immutable records)
- Order.cancelledAt and cancellationReason fields for soft cancellation (no hard deletes)
- Allergen filter logic inverted: dietary tags use AND-include, allergens use AND-exclude
- CSV export sanitizes cell values to prevent spreadsheet formula injection
- GDPR anonymize uses case-insensitive email matching
- Payment providers now auto-detected from API keys — `PAYMENT_PROVIDER` env var deprecated (still honored as fallback)
- `createPaymentIntent()` and `verifyPayment()` accept optional `method` parameter for caller-driven routing
- `PaymentMethodSelector` refactored with `PaymentOptionButton` component, supports 3 methods (cash/stripe/paypal)
- Stripe PaymentIntent creation now includes `automatic_payment_methods: { enabled: true }` for broader payment method support
- Cron sweep now selects `paymentMethod` from orders and passes it to `verifyPayment()` for correct provider routing
- `isStripeEnabled()` simplified — checks `STRIPE_SECRET_KEY` directly instead of `PAYMENT_PROVIDER` env var

## [0.5.3.0] - 2026-03-27

### Added
- MwSt tax rate tracking on menu items — 7% for food (default), 19% for beverages
- Tax rate selector (7%/19% toggle) in dashboard menu item editor
- Tax breakdown in analytics API — net revenue and tax amount per rate
- AI menu extraction auto-classifies items as food (7%) or beverage (19%)
- OrderItem stores baked-in tax rate at order creation time for audit trail

## [0.5.2.0] - 2026-03-27

### Added
- Live order tracking page at `/order/[token]` — serves as both receipt and real-time status tracker
- Unique 12-char crypto token per order for shareable, bookmarkable order URLs
- Order confirmation email with itemized receipt and tracking link (sent on order creation)
- Order-ready email now includes a link to the order tracking page
- Skeleton loading state for order page (prevents blank screen after redirect)
- Friendly 404 page for invalid order tokens
- "Nochmal bestellen" (re-order) button on completed orders
- Contact message + menu link on cancelled orders
- SWR-powered live status polling (10s interval, stops on terminal states)
- PII filtering on public order API — customerEmail, customerNote, paymentIntentId excluded
- `robots: noindex` on order pages to prevent search indexing
- 9 new tests covering order token lookup, PII filtering, and email templates (166 → 175 total)

### Changed
- Guest checkout now redirects to `/order/[token]` instead of showing inline success screen
- `router.replace` used for redirect (back button doesn't return to stale checkout)
- Order creation API returns filtered response (excludes PII fields)
- Stripe payment success uses `useRef` backup for token to prevent race condition

## [0.5.1.0] - 2026-03-26

### Added
- Configurable order time slots — operators pick 5/10/15/20/25/30 minute intervals (was hardcoded 15)
- Multiple opening hours per day — support for lunch/dinner splits and break periods
- Feature toggle cards — side-by-side preorder and payment cards with visual dependency chain
- Confirmation dialogs when disabling preorders or payments (destructive actions only)
- Server-side operating hours validation — rejects malformed times, overlapping ranges, close-before-open
- Server-side preorder→payment enforcement — disabling preorders auto-disables payment

### Changed
- Settings page reorganized: feature toggles (immediate-save) separated from sub-settings (deferred-save)
- Payment card disabled with overlay when preorders are off
- Slot interval selector replaces hardcoded 15-minute window in both display and capacity enforcement
- Operating hours editor supports add/remove time ranges with smart defaults and overlap detection

### Fixed
- Order capacity check used hardcoded 15-minute buckets regardless of configured interval
- Operating hours validation accepted malformed time strings (NaN bypass)
- Adding a time slot past 23:00 could generate invalid 24:00+ times

## [0.5.0.1] - 2026-03-25

### Fixed
- `docker compose up` now works without setting `CRON_SECRET` — defaults to a dev value
- Magic link emails now work out of the box in Docker — Mailpit always starts (no `--profile mail` needed)
- Docker entrypoint no longer hangs — replaced `pg_isready` (missing in Alpine) with Node.js TCP check
- Prisma CLI now works in Docker runtime — fixed pnpm symlink resolution for `@prisma/engines`
- Database seed runs in Docker — added `tsx` as a dependency for TypeScript seed execution
- Init migration now matches schema — added missing `maxOrdersPerSlot` and `customerEmail` columns

### Added
- `pnpm db:migrate:local` command for contributors (runs without dotenvx)
- `tsx` as a dev dependency (needed for Docker seed and consistent local tooling)
- `restart: unless-stopped` on the Docker app service for resilience
- `prisma.config.ts` copied into Docker runtime image

### Changed
- Dockerfile copies full `node_modules` from deps stage (fixes pnpm symlink issues in runtime)
- `prisma.config.ts` uses optional `dotenv/config` import (works in Docker where dotenv isn't hoisted)
- README, CONTRIBUTING, and CLAUDE.md rewritten for contributor-friendly setup with Docker and pnpm paths

## [0.5.0.0] - 2026-03-25

### Added
- Guests can choose a pickup time — 15-minute windows generated from operating hours
- Operators can cap orders per time slot (`maxOrdersPerSlot`) to smooth kitchen load
- Order-ready email notifications — guests optionally leave their email at checkout and get notified when their order is READY
- Analytics dashboard — orders/day, revenue/day, popular items, peak hours (powered by Recharts)
- Day-end report with print and CSV export
- react-email templates with inline FairOrder logo (magic link + order ready)
- 30 new tests covering all new code paths (136 → 166 total)
- Available time slots API (`GET /api/orders/available-slots`)
- Analytics API (`GET /api/analytics`) with date range support
- Day report API (`GET /api/analytics/day-report`)

### Fixed
- Dashboard overview showed hardcoded "0" for today's orders — now queries actual count
- Analytics page loaded all orders into memory — replaced with aggregate SQL queries
- Replaced `$queryRawUnsafe` with safe `$queryRaw` tagged template literal

### Changed
- Email builders (`buildMagicLinkEmail`, `buildOrderReadyEmail`) are now async (react-email `render()`)
- Kitchen display shows requested pickup time on order cards

## [0.4.0.0] - 2026-03-23

### Added
- Stripe payment integration (pluggable via `PAYMENT_PROVIDER`)
- AI menu extraction from images and URLs (Gemini via Vercel AI SDK)
- Enhanced public menu with search, dietary filters, allergen display
- Image upload for menu items with magic byte validation
- Payment verification cron sweep

## [0.3.0.0] - 2026-03-22

### Added
- Image upload with secure file validation
- Interactive kitchen display with real-time order board (3-column workflow)
- Public ordering flow (cart, checkout, payment)
- Atomic order creation with sequential numbering

## [0.2.0.0] - 2026-03-21

### Added
- Public menu page with QR-scannable URLs
- Kitchen display (token-authenticated)
- QA auth fixes (email validation, mobile login centering)

### Fixed
- Vercel deploy issues (db connection, plunk email, OCR, empty state)

## [0.1.0.0] - 2026-03-20

### Added
- Initial open-source release
- Magic link authentication with session management
- Location management with operating hours
- Menu management (categories, items, sorting)
- 3-step onboarding wizard
- Operator dashboard with sidebar/bottom-tab navigation
