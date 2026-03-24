# Contributing to FairOrder

Thanks for your interest in contributing! This guide covers setup, code style, and how to submit changes.

## Quick Start (Docker)

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
docker compose up
```

Open http://localhost:3000. The database is automatically migrated and seeded with demo data.

To use the email test UI (Mailpit), start with the mail profile:

```bash
docker compose --profile mail up
```

Then open http://localhost:8025 to see captured emails.

## Quick Start (Manual)

Prerequisites: Node.js 22+, pnpm, PostgreSQL

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
pnpm install
cp .env.example .env        # Edit DATABASE_URL to point to your PostgreSQL
pnpm db:generate
pnpm db:migrate             # Run database migrations
pnpm db:seed                # Seed demo location + menu (optional)
pnpm dev:local              # Starts without dotenvx
```

## Development vs Production

| Command | What it does |
|---------|-------------|
| `pnpm dev:local` | Dev server with plain .env file (for contributors) |
| `pnpm dev` | Dev server with dotenvx (for maintainers with .env.keys) |
| `pnpm build:local` | Production build with plain .env |
| `pnpm test` | Run test suite (Vitest) |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate` | Run migrations (applies schema changes safely) |
| `pnpm db:seed` | Seed demo data (idempotent) |

## Code Style

- TypeScript strict mode
- Use `cn()` from `lib/utils.ts` for conditional class names
- German locale for UI text, informal "du" form
- 0px border-radius everywhere (design system)
- Plus Jakarta Sans for text, JetBrains Mono for numbers

## Submitting Changes

1. Fork the repo and create a branch (`feat/your-feature` or `fix/your-fix`)
2. Make your changes
3. Run `pnpm lint && pnpm test` — both must pass
4. Open a Pull Request with a clear description

## Good First Issues

Look for issues labeled `good first issue`. These are scoped, well-described tasks that don't require deep knowledge of the codebase.

## Pluggable Providers

FairOrder uses an adapter pattern for external services. Each provider defaults to a no-config development mode:

### Email (`EMAIL_PROVIDER`)
- `console` — Logs emails to terminal (default in development)
- `smtp` — Any SMTP server (use Mailpit locally, or Sendgrid/SES/etc. in production)
- `plunk` — Plunk ESP API (used by the hosted version)

### Payment (`PAYMENT_PROVIDER`)
- `cash` — Pay at the till (default)
- `stripe` — Stripe prepayment (requires `STRIPE_SECRET_KEY` and related env vars)

### Menu Extraction (`MENU_EXTRACTION_PROVIDER`)
- `console` — Returns mock data (default in development)
- `gemini` — Google Gemini AI via Vercel AI SDK (requires `GEMINI_API_KEY`)

For local development, all providers default to their no-config mode — no API keys needed.
