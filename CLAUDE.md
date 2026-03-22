# CLAUDE.md — FairOrder Product App

## Project Overview

Open-source canteen product app. Operators sign up, import menus via OCR, and get a live QR-scannable menu page. Built as a separate app sharing the same PostgreSQL database with the private marketing site.

## Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build (includes prisma generate)
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm db:generate  # Regenerate Prisma client
pnpm db:migrate   # Run migrations (dev)
pnpm db:push      # Push schema to DB without migration
```

## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Database:** PostgreSQL with Prisma ORM v7 (shared with marketing site)
- **UI:** Tailwind CSS v4, Radix UI, shadcn/ui, 0px border-radius
- **Auth:** Hand-rolled magic link auth with httpOnly session cookies
- **Env:** dotenvx encrypted `.env` + `.env.production` committed to git; `.env.keys` gitignored
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
components/
  auth/           # Magic link form, auth feedback
  dashboard/      # Nav component
  onboarding/     # Setup form
  ui/             # shadcn/ui components
lib/
  auth.ts         # Session management (create, get, delete, cookies)
  db.ts           # Prisma client singleton
  email.ts        # Plunk email sending
  magic-link.ts   # Magic link token creation and verification
  utils.ts        # cn() helper
prisma/
  schema.prisma   # Extended schema (User, Session + shared models)
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
