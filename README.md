# FairOrder

Open-source canteen ordering system. Operators sign up, import menus via OCR, and get a live QR-scannable menu page. Guests scan, order, kitchen prepares.

**Self-host in 1 command:**

```bash
docker compose up
```

## Features

- **Magic link auth** — passwordless login via email
- **OCR menu import** — upload a photo of your menu, get structured data (Tesseract.js, 100% client-side)
- **QR code ordering** — each location gets a scannable menu page
- **Kitchen display** — wall-mounted screen for order management
- **Multi-location** — one account, many locations
- **Self-hostable** — Docker compose, bring your own database and SMTP

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL + Prisma v7 |
| UI | Tailwind CSS v4, Radix UI, shadcn/ui |
| Auth | Magic link (passwordless, httpOnly cookies) |
| OCR | Tesseract.js (client-side WASM, German) |
| Email | Pluggable: Plunk, SMTP, or Console |
| Testing | Vitest |

## Quick Start

### Docker (recommended)

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
docker compose up
```

Open http://localhost:3000. Database is migrated and seeded automatically.

### Manual

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
pnpm install
cp .env.example .env    # Edit DATABASE_URL
pnpm db:generate
pnpm db:push
pnpm db:seed
pnpm dev:local
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for full setup details.

## Architecture

```
app/
  (auth)/         # Login, register, verify-email
  (onboarding)/   # 3-step wizard: setup, menu-import, complete
  dashboard/      # Operator admin panel
  api/            # REST API routes
components/
  ui/             # shadcn/ui design system (0px radius)
  auth/           # Magic link forms
  dashboard/      # Nav, menu manager, order list
  onboarding/     # Setup form, OCR import, QR display
lib/
  auth.ts         # Session management
  db.ts           # Prisma client
  email.ts        # Email provider (plunk/smtp/console)
  magic-link.ts   # Token creation & verification
prisma/
  schema.prisma   # Database schema
  seed.ts         # Demo data
```

## Email Providers

Configure via `EMAIL_PROVIDER` environment variable:

| Provider | Use case | Required env vars |
|----------|----------|-------------------|
| `console` | Development (default) | None |
| `smtp` | Self-hosting | `SMTP_HOST`, `SMTP_FROM` |
| `plunk` | Hosted version | `PLUNK_API_KEY` |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.

## License

[AGPL-3.0](LICENSE)
