<p align="center">
  <img src="public/images/logo.png" alt="FairOrder" width="200" />
</p>

**Open-source canteen ordering system — operators sign up, import menus via AI extraction, and get a live QR-scannable menu page.**

Guests scan, order, kitchen prepares. Self-host in one command with Docker Compose.

---

## Features

### For Operators
- **Magic Link Auth** — Passwordless login via email, no passwords to manage
- **AI Menu Import** — Upload a photo or paste a URL, AI extracts structured menu data (Google Gemini via Vercel AI SDK)
- **Optional Prepayment** — Stripe or PayPal for pay-before-pickup, or cash at the till
- **Pickup Time Slots** — Guests choose a 15-minute pickup window; operators cap orders per slot to smooth kitchen load
- **Analytics Dashboard** — Orders/day, revenue/day, popular items, peak hours — plus day-end reports with print and CSV export
- **Order-Ready Notifications** — Optional email notification when an order is marked READY
- **3-Step Onboarding** — Location setup, menu import, QR code — live in minutes
- **Multi-Location** — One account, many locations

### For Guests
- **Public Menu Page** — Each location gets a shareable URL (`/your-location`) showing the live menu with search, dietary filters, and allergen display
- **QR Code Ordering** — Scan to view the menu and place orders, no app required
- **No App Required** — Works in any mobile browser

### For Kitchens
- **Kitchen Display** — Token-authenticated display at `/display/:token` for wall-mounted screens, shows requested pickup time
- **Order Workflow** — Simple status progression from received to pickup

### Order Workflow
```
┌─────────┐    ┌───────────┐    ┌─────────┐    ┌───────────┐
│ PENDING │ ─→ │ PREPARING │ ─→ │  READY  │ ─→ │ COMPLETED │
└─────────┘    └───────────┘    └─────────┘    └───────────┘
                                      │
                                      └─→ CANCELLED
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript (strict mode) |
| **Database** | PostgreSQL + Prisma v7 |
| **Styling** | Tailwind CSS v4, Radix UI, shadcn/ui |
| **Auth** | Magic link (passwordless, httpOnly cookies) |
| **AI** | Vercel AI SDK + Google Gemini (structured output) |
| **Email** | Pluggable: Plunk, SMTP, or Console |
| **Payment** | Pluggable: Stripe, PayPal, or Cash (auto-detected from API keys) |
| **Testing** | Vitest |

---

## Getting Started

### Docker (recommended)

The fastest way to get FairOrder running — one command starts the app, database, and image storage:

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
docker compose up
```

Open [http://localhost:3000](http://localhost:3000). The database is automatically migrated and seeded with demo data.

**What starts:**

| Service | Port | Description |
|---------|------|-------------|
| `app` | 3000 | Next.js app (auto-migrates and seeds on startup) |
| `db` | 5432 | PostgreSQL 16 |
| `minio` | 9000/9001 | S3-compatible image storage (API / Console) |
| `mailpit` | 8025 | Email UI — all emails (magic links, notifications) appear here |
| `cron` | — | Runs payment verification sweep every 2 minutes |

Open [http://localhost:8025](http://localhost:8025) to see captured emails (magic links for login, order notifications, etc.).

### Local Setup (pnpm)

Use this if you prefer running Node.js directly, want faster hot-reload, or need to work without Docker.

**Prerequisites:** Node.js 22+, pnpm, PostgreSQL running locally

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
pnpm install
cp .env.example .env        # Edit DATABASE_URL if your PostgreSQL differs
pnpm db:generate
pnpm db:migrate:local       # Run database migrations
pnpm db:seed                # Seed demo data (optional)
pnpm dev:local
```

All external services default to no-config development mode — no API keys needed. Emails log to the terminal, payments default to cash, and AI menu extraction returns mock data. See `.env.example` for the full list of configuration options.

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:local` | Start dev server (plain .env — contributors) |
| `pnpm dev` | Start dev server (dotenvx — maintainers) |
| `pnpm build:local` | Production build (plain .env) |
| `pnpm start:local` | Start production server (plain .env) |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest test suite |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate:local` | Run database migrations (contributors) |
| `pnpm db:seed` | Seed demo data (idempotent) |

---

## Project Structure

```
fairorder/
├── app/
│   ├── (auth)/           # Login, register, verify-email
│   ├── (onboarding)/     # 3-step wizard: setup, menu-import, complete
│   ├── [slug]/           # Public menu page (guest-facing, no auth)
│   ├── display/[token]/  # Kitchen display (token-authenticated)
│   ├── dashboard/        # Operator admin panel
│   └── api/              # REST API routes
├── components/
│   ├── ui/               # shadcn/ui design system (0px radius)
│   ├── auth/             # Magic link forms
│   ├── dashboard/        # Nav, menu manager, order list, import
│   ├── display/          # Kitchen display components
│   ├── onboarding/       # Setup form, AI menu import, QR display
│   └── public/           # Public menu page, payment form
├── emails/
│   ├── magic-link.tsx    # Magic link email template (react-email)
│   └── order-ready.tsx   # Order-ready notification template
├── lib/
│   ├── auth.ts           # Session management
│   ├── db.ts             # Prisma client
│   ├── email.ts          # Email provider (plunk/smtp/console)
│   ├── payment.ts        # Payment provider (stripe/paypal/cash)
│   ├── menu-extraction.ts # AI menu extraction (gemini/console)
│   ├── menu-crawler.ts   # URL crawler for menu import
│   ├── storage.ts        # Image upload
│   ├── magic-link.ts     # Token creation & verification
│   └── utils.ts          # cn() helper
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Demo data
├── __tests__/            # Vitest test suite
└── public/               # Static assets
```

---

## Database Schema

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│     User     │       │   Location   │──────<│   Category   │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id           │──────<│ id           │       │ id           │
│ email        │       │ name         │       │ name         │
│ name         │       │ slug         │       │ sortOrder    │
└──────────────┘       │ timezone     │       │ isActive     │
       │               │ adminToken   │       └──────────────┘
       │               │ displayToken │              │
┌──────────────┐       │ paymentOn    │       ┌──────────────┐
│   Session    │       └──────────────┘       │   MenuItem   │
├──────────────┤              │               ├──────────────┤
│ id           │              │               │ id           │
│ token        │              │               │ name         │
│ expiresAt    │              │               │ price        │
└──────────────┘              │               │ isAvailable  │
                              │               └──────────────┘
                       ┌──────────────┐              │
                       │    Order     │──────<┌──────────────┐
                       ├──────────────┤       │  OrderItem   │
                       │ orderNumber  │       ├──────────────┤
                       │ customerName │       │ quantity     │
                       │ status       │       │ unitPrice    │
                       │ pickupTime   │       │ notes        │
                       │ paymentMethod│       └──────────────┘
                       │ paymentStatus│
                       └──────────────┘
```

---

## Email Providers

Configure via `EMAIL_PROVIDER` environment variable:

| Provider | Use case | Required env vars |
|----------|----------|-------------------|
| `console` | Development (default) | None |
| `smtp` | Self-hosting | `SMTP_HOST`, `SMTP_FROM` |
| `plunk` | Hosted version | `PLUNK_API_KEY` |

## Payment Providers

Payment providers are auto-detected from API keys. Per-location `acceptedPayments` controls which methods guests see.

| Provider | Use case | Required env vars |
|----------|----------|-------------------|
| `cash` | Default — pay at the till | None |
| `stripe` | Card payments (also supports PayPal via Stripe Dashboard) | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| `paypal` | Native PayPal payments (no Stripe required) | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` |

## Menu Extraction Providers

Configure via `MENU_EXTRACTION_PROVIDER` environment variable:

| Provider | Use case | Required env vars |
|----------|----------|-------------------|
| `console` | Development (default) | None |
| `gemini` | Production — AI extracts menus from images and URLs | `GEMINI_API_KEY` |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines. This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

---

## Security

See [SECURITY.md](SECURITY.md) for vulnerability disclosure policy.

---

## License

[AGPL-3.0](LICENSE)

---

<p align="center">
  <sub>Built with TypeScript</sub>
</p>
