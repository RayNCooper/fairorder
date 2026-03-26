# Contributing to FairOrder

Thanks for your interest in contributing! This guide covers setup, code style, and how to submit changes.

## Development Setup

There are two ways to run FairOrder locally: **Docker** (recommended — everything runs in one command) or **pnpm** (if you prefer running Node.js directly). Both are fully supported development flows.

### Option A: Docker (recommended)

Docker Compose starts all services — app, database, image storage, and a background payment verification cron. No local dependencies beyond Docker.

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
docker compose up
```

Open http://localhost:3000. The database is automatically migrated and seeded with demo data.

**What runs:**

| Service | Port(s) | What it does |
|---------|---------|--------------|
| `app` | 3000 | Next.js app — auto-runs migrations and seeds on every start |
| `db` | 5432 | PostgreSQL 16 (data persists in a Docker volume) |
| `minio` | 9000 (API), 9001 (console) | S3-compatible image storage for menu item photos |
| `minio-setup` | — | One-shot init: creates the image bucket and sets public read |
| `cron` | — | Runs `GET /api/cron/verify-payments` every 2 minutes |

**Email testing:** [Mailpit](https://mailpit.axe.dev/) starts automatically at http://localhost:8025 — every email the app sends (magic links, order notifications) appears there. No extra flags needed.

**Rebuilding after code changes:** Docker mounts nothing — it builds from the Dockerfile. After pulling new changes or modifying code:

```bash
docker compose up --build
```

**Resetting the database:** Delete the Docker volume to start fresh:

```bash
docker compose down -v && docker compose up
```

### Option B: Local Setup (pnpm)

Use this flow if you prefer faster hot-reload, need to debug server-side code, or want to avoid Docker.

**Prerequisites:** Node.js 22+, pnpm, PostgreSQL running locally

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
pnpm install
cp .env.example .env        # Edit DATABASE_URL to point to your PostgreSQL
pnpm db:generate
pnpm db:migrate:local       # Run database migrations
pnpm db:seed                # Seed demo location + menu (optional)
pnpm dev:local              # Starts without dotenvx
```

All external services default to **no-config development mode** — no API keys needed:
- **Email** → logs to terminal (`EMAIL_PROVIDER=console`)
- **Payment** → cash at the till (no payment API keys needed)
- **Menu extraction** → returns mock data (`MENU_EXTRACTION_PROVIDER=console`)
- **Image storage** → logs to terminal (`STORAGE_PROVIDER=console`)

To enable real providers (Stripe, PayPal, Gemini, SMTP, MinIO), see `.env.example` for the required environment variables.

## Available Commands

| Command | What it does |
|---------|-------------|
| `pnpm dev:local` | Dev server with plain .env file (for contributors) |
| `pnpm dev` | Dev server with dotenvx (for maintainers with .env.keys) |
| `pnpm build:local` | Production build with plain .env |
| `pnpm start:local` | Start production server with plain .env |
| `pnpm test` | Run test suite (Vitest) |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm lint` | Run ESLint |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate:local` | Run migrations (contributors, plain .env) |
| `pnpm db:migrate` | Run migrations (maintainers, dotenvx) |
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

### Payment (auto-detected from API keys)
- `cash` — Pay at the till (default when no payment API keys are set)
- `stripe` — Card payments, also supports PayPal via Stripe Dashboard (requires `STRIPE_SECRET_KEY`)
- `paypal` — Native PayPal payments without Stripe (requires `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`)

### Menu Extraction (`MENU_EXTRACTION_PROVIDER`)
- `console` — Returns mock data (default in development)
- `gemini` — Google Gemini AI via Vercel AI SDK (requires `GEMINI_API_KEY`)

For local development, all providers default to their no-config mode — no API keys needed.
