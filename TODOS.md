# TODOS

## Deferred from Canteen Operator Expansion (2026-03-23)

- [ ] **Real-time menu updates** — WebSocket push when menu items change (currently relies on page refresh)
- [ ] **Multi-language menus** — Currently German only; i18n for menu display
- [ ] **Recurring subscription payments** — Employee meal plans, prepaid credits (currently one-time prepayment per order only)
- [ ] **PDF menu extraction** — Accept PDF uploads for AI menu extraction (currently image-only; Gemini can handle images)
- [ ] **Headless browser crawling** — Playwright-based crawler for JS-rendered menu pages (currently cheerio for static HTML only; suggest image upload for JS-heavy sites)
- [ ] **Payment refund API** — Programmatic refunds via Stripe API (currently manual via Stripe dashboard)
- [ ] **Menu item nutritional AI analysis** — Use Gemini to estimate calories/macros from item names/descriptions
- [ ] **Automated menu scraping on schedule** — Cron-based re-crawl of online menus to keep items up to date (currently one-shot import only)
- [ ] **Baseline existing databases for Prisma migrations** — Databases created before the migration system (via `db push`) need `prisma migrate resolve --applied 0_init` before they can run new migrations. Add a setup script or document the upgrade path for existing installations.

## Deferred from Marketing Feature Gap (2026-03-25)

Features marketed on fair-order.de that require significant implementation:

- [ ] **Guthabenkonto (prepaid wallet)** — Guest accounts with email+PIN, prepaid balance, top-up via Stripe, wallet payment at checkout. Needs separate GuestAccount + GuestSession + WalletTransaction models (NOT shared with User/Session). Wallet is a paymentMethod value ("wallet"), not a PAYMENT_PROVIDER. Concurrency: SELECT FOR UPDATE + CHECK(balance >= 0). Foundation for parent controls and employer subsidies. See plan: `~/.claude/plans/melodic-stirring-floyd.md` Phase 2.
- [ ] **Kassensystem (POS)** — Unified POS view at `/dashboard/pos` combining walk-in ordering + pre-order queue. Depends on Guthabenkonto for wallet payments. Needs digital receipts, day-end POS reporting.
- [ ] **KI-Vorhersagen (demand forecasting)** — Statistical demand prediction ("Morgen brauchst du ca. X Brötchen"). Requires ≥1 year of order data per pricing page. Start with day-of-week averages + trend adjustment.
- [ ] **Elternkontrolle (parent controls)** — Parent portal for Schulkantinen: view child's balance, set daily budget limits, block specific menu items. Depends on Guthabenkonto.
- [ ] **Arbeitgeberzuschuss (employer subsidies)** — Employer bulk credit via CSV/API for Betriebskantinen meal subsidies. Depends on Guthabenkonto. SubsidyConfig model with Sachbezugswert rules (4.57 EUR/meal, 3.10 EUR tax-free, 7.67 EUR cap, 15 meals/month). Monthly DATEV-compatible payroll export. See plan: `~/.claude/plans/melodic-stirring-floyd.md` Phase 3.
- [ ] **Team/group ordering** — Shared cart for team pre-orders ("Teams bestellen gemeinsam vor dem Meeting"). Needs design thinking for cart-sharing UX.
- [ ] **Tap-to-Pay** — Android/iOS Tap-to-Pay and POS terminal integration via Stripe Terminal API. Depends on Kassensystem.
- [ ] **Guest loyalty / Stammkunden** — Optional guest registration, order history, configurable stamps/loyalty program. Builds on GuestAccount from Guthabenkonto.
- [ ] **Digital receipts** — On-screen and email receipts for both walk-in and pre-order purchases. Natural addition to POS phase.

## Deferred from POS Integration Research (2026-03-27)

Items deferred after autoplan CEO review rejected external POS integration in favor of Guthabenkonto-first strategy. Preserved as reference for when operator demand is proven.

- [ ] **External POS integration (webhook)** — Generic HTTP webhook provider for forwarding orders to external POS systems. Operator provides URL, FairOrder POSTs order JSON on creation/status change. Defer until operator interviews prove demand.
- [ ] **SumUp POS API** — SumUp has the best-documented open API with sandbox. Only build when a paying customer requests it.
- [ ] **Lightspeed K-Series API** — REST API, large German market via Gastrofix acquisition. Partner program required.
- [ ] **ESC/POS kitchen printer** — Network printer for kitchen tickets. High practical value but depends on Kassensystem being built first.
- [ ] **Revenue reconciliation** — Daily/monthly reconciliation between FairOrder orders and external POS records. No external POS to reconcile against yet.
- [ ] **RFID/NFC employee cards** — Integration with GV-specific card systems (Gantner, ventopay, GiroWeb). Requires hardware partnerships and openCashFile standard compatibility.
