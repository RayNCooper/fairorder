# CLAUDE.md — FairOrder Product App

## Project Overview

Open-source canteen ordering system, built in the open on GitHub. Operators sign up, import menus via AI extraction, and get a live QR-scannable menu page. Guests scan, browse, and order — no app needed. Built as a standalone app sharing the same PostgreSQL database with the private marketing site.

## Built in the Open

FairOrder is developed publicly — code, decisions, and progress are all visible to anyone. This shapes how we write everything:

- **Commit messages & PRs** — Write for someone reading the git log six months from now. Explain *why*, not just *what*. No internal shorthand or ticket references without context.
- **Code comments** — Only where the logic isn't obvious. When you do comment, write for a contributor who just cloned the repo.
- **Documentation** — Keep it contributor-friendly. A developer should be able to go from `git clone` to running the app in under 5 minutes by following the docs.
- **No internal jargon** — Avoid references to internal tools, private channels, or team-specific context. Everything in the repo should make sense to an outside reader.
- **Design decisions** — When making architectural or UX choices, document the reasoning in the PR description. Future contributors (and future us) will thank you.

## Commands

```bash
# ── Local (pnpm) ──
pnpm dev          # Dev server (dotenvx — maintainers)
pnpm dev:local    # Dev server (plain .env — contributors)
pnpm build        # Production build (dotenvx)
pnpm build:local  # Production build (plain .env)
pnpm start        # Start production server (dotenvx)
pnpm start:local  # Start production server (plain .env)
pnpm lint         # Run ESLint
pnpm test         # Run Vitest test suite
pnpm db:generate       # Regenerate Prisma client
pnpm db:migrate        # Run migrations (dotenvx — maintainers)
pnpm db:migrate:local  # Run migrations (plain .env — contributors)
pnpm db:seed           # Seed demo data (idempotent)

# ── Docker ──
docker compose up              # Start app + db + minio + mailpit + cron
docker compose up --build      # Rebuild after code changes
docker compose down -v         # Reset everything (deletes database + uploads)
```

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Database:** PostgreSQL with Prisma ORM v7 (shared with marketing site)
- **UI:** Tailwind CSS v4, Radix UI, shadcn/ui, 0px border-radius
- **Auth:** Hand-rolled magic link auth with httpOnly session cookies
- **Email:** Pluggable via `EMAIL_PROVIDER` env var — plunk (ESP), smtp (nodemailer), console (dev)
- **Payment:** Pluggable, auto-detected from API keys — stripe (Stripe, also supports PayPal via Stripe Dashboard), paypal (native @paypal/paypal-server-sdk), cash (default). Per-location `acceptedPayments` controls which methods are offered.
- **Menu Extraction:** Pluggable via `MENU_EXTRACTION_PROVIDER` env var — gemini (Vercel AI SDK + @ai-sdk/google, structured output via generateObject), console (dev)
- **Env:** dotenvx for maintainers; plain `.env` via `:local` scripts for contributors. See `.env.example`
- **Fonts:** Plus Jakarta Sans (headings/body), JetBrains Mono (numbers/metadata)
- **Package Manager:** pnpm

## Architecture

```
app/
  (auth)/         # Login, register, verify-email (centered, no navbar)
  (onboarding)/   # 3-step wizard (setup, menu-import, complete)
  [slug]/         # Public menu page (guest-facing, no auth)
  order/[token]/  # Live order tracking page (receipt + status, no auth, token-secured)
  display/[token]/ # Kitchen display (token-authenticated)
  dashboard/      # Operator admin (sidebar nav on desktop, bottom tabs on mobile)
  api/auth/       # Magic link, verify, logout, session
  api/locations/  # Location CRUD
  api/categories/ # Category CRUD
  api/menu-items/ # Menu item CRUD + bulk import
  api/orders/     # Order creation, status updates, available time slots, public token lookup
  api/analytics/  # Aggregated analytics + day-end reports
  api/payment/    # Payment intent creation, capture (PayPal), status verification
  api/cron/       # Background jobs (payment sweep)
  api/menu-extraction/ # AI menu extraction (image + URL)
  api/health/     # Health check endpoint
components/
  auth/           # Magic link form, auth feedback
  dashboard/      # Nav, menu manager, order list, settings, menu import, analytics charts
  display/        # Kitchen display (real-time order board)
  onboarding/     # Setup form, AI menu import, QR complete
  public/         # Public menu page, payment form
  ui/             # shadcn/ui components
emails/
  magic-link.tsx  # Magic link email template (react-email)
  order-confirmation.tsx # Order confirmation with itemized receipt
  order-ready.tsx # Order-ready notification template (with order page link)
lib/
  auth.ts         # Session management (create, get, delete, cookies)
  db.ts           # Prisma client singleton
  email.ts        # Email sending (pluggable: plunk/smtp/console)
  payment.ts      # Payment processing (pluggable: stripe/paypal/cash, auto-detected from API keys)
  menu-extraction.ts # AI menu extraction (pluggable: gemini/console)
  menu-crawler.ts # URL crawler for menu extraction
  storage.ts      # Image upload (local filesystem)
  magic-link.ts   # Magic link token creation and verification
  utils.ts        # cn() helper
prisma/
  schema.prisma   # Standalone schema (User, Session, Location, Menu, Orders)
  seed.ts         # Idempotent demo data seeder
docker-compose.yml    # App + PostgreSQL + MinIO + Mailpit + cron
Dockerfile            # Multi-stage build (deps → build → runtime)
docker-entrypoint.sh  # Startup: wait for db → migrate → seed → start
```

## Design System

- **Background:** #FAFAF8 warm stone
- **Primary:** #16A34A green, 0px radius
- **Border radius:** 0px everywhere
- **Typography:** Plus Jakarta Sans 800 (headings), JetBrains Mono for numbers/metadata
- **Feedback:** Left-border 3px alerts (green=success, amber=info, red=error)
- **Status badges:** PENDING amber, PREPARING blue, READY green — JetBrains Mono 11px uppercase

## Code Style

- TypeScript strict mode
- Use `cn()` from `lib/utils.ts` for conditional class names
- German locale, informal "du" form
- No FairCup/Mehrweg references
