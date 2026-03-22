# CLAUDE.md — FairOrder Product App

## Project Overview

Open-source canteen product app. Operators sign up, import menus via OCR, and get a live QR-scannable menu page. Built as a separate app sharing the same PostgreSQL database with the private marketing site.

## Commands

```bash
pnpm dev          # Dev server (dotenvx — maintainers)
pnpm dev:local    # Dev server (plain .env — contributors)
pnpm build        # Production build (dotenvx)
pnpm build:local  # Production build (plain .env)
pnpm start        # Start production server (dotenvx)
pnpm start:local  # Start production server (plain .env)
pnpm lint         # Run ESLint
pnpm test         # Run Vitest test suite
pnpm db:generate  # Regenerate Prisma client
pnpm db:migrate   # Run migrations (dev)
pnpm db:push      # Push schema to DB without migration
pnpm db:seed      # Seed demo data (idempotent)
```

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Database:** PostgreSQL with Prisma ORM v7 (shared with marketing site)
- **UI:** Tailwind CSS v4, Radix UI, shadcn/ui, 0px border-radius
- **Auth:** Hand-rolled magic link auth with httpOnly session cookies
- **Email:** Pluggable via `EMAIL_PROVIDER` env var — plunk (ESP), smtp (nodemailer), console (dev)
- **Env:** dotenvx for maintainers; plain `.env` via `:local` scripts for contributors. See `.env.example`
- **OCR:** Tesseract.js (client-side, German language pack) — NOT OpenAI Vision
- **Fonts:** Plus Jakarta Sans (headings/body), JetBrains Mono (numbers/metadata)
- **Package Manager:** pnpm

## Architecture

```
app/
  (auth)/         # Login, register, verify-email (centered, no navbar)
  (onboarding)/   # 3-step wizard (setup, menu-import, complete)
  dashboard/      # Operator admin (sidebar nav on desktop, bottom tabs on mobile)
  api/auth/       # Magic link, verify, logout, session
  api/locations/  # Location CRUD
  api/categories/ # Category CRUD
  api/menu-items/ # Menu item CRUD + bulk import
  api/orders/     # Order status updates
  api/health/     # Health check endpoint
components/
  auth/           # Magic link form, auth feedback
  dashboard/      # Nav, menu manager, order list, settings, analytics
  onboarding/     # Setup form, OCR menu import, QR complete
  ui/             # shadcn/ui components
lib/
  auth.ts         # Session management (create, get, delete, cookies)
  db.ts           # Prisma client singleton
  email.ts        # Email sending (pluggable: plunk/smtp/console)
  magic-link.ts   # Magic link token creation and verification
  utils.ts        # cn() helper
prisma/
  schema.prisma   # Standalone schema (User, Session, Location, Menu, Orders)
  seed.ts         # Idempotent demo data seeder
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
