<p align="center">
  <img src="public/images/logo.png" alt="FairOrder" width="200" />
</p>

**Open-source canteen ordering system — operators sign up, import menus via OCR, and get a live QR-scannable menu page.**

Guests scan, order, kitchen prepares. Self-host in one command with Docker Compose.

---

## Features

### For Operators
- **Magic Link Auth** — Passwordless login via email, no passwords to manage
- **OCR Menu Import** — Upload a photo of your menu, get structured data (Tesseract.js, 100% client-side)
- **3-Step Onboarding** — Location setup, menu import, QR code — live in minutes
- **Multi-Location** — One account, many locations

### For Guests
- **Public Menu Page** — Each location gets a shareable URL (`/your-location`) showing the live menu
- **QR Code Ordering** — Scan to view the menu and place orders, no app required
- **No App Required** — Works in any mobile browser

### For Kitchens
- **Kitchen Display** — Token-authenticated display at `/display/:token` for wall-mounted screens
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
| **OCR** | Tesseract.js (client-side WASM, German) |
| **Email** | Pluggable: Plunk, SMTP, or Console |
| **Testing** | Vitest |

---

## Getting Started

### Docker (recommended)

```bash
git clone https://github.com/RayNCooper/fairorder.git
cd fairorder
docker compose up
```

Open [http://localhost:3000](http://localhost:3000). Database is migrated and seeded automatically.

### Manual Setup

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

### Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (dotenvx — maintainers) |
| `pnpm dev:local` | Start dev server (plain .env — contributors) |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run Vitest test suite |

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
│   ├── dashboard/        # Nav, menu manager, order list
│   ├── display/          # Kitchen display components
│   └── onboarding/       # Setup form, OCR import, QR display
├── lib/
│   ├── auth.ts           # Session management
│   ├── db.ts             # Prisma client
│   ├── email.ts          # Email provider (plunk/smtp/console)
│   └── magic-link.ts     # Token creation & verification
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Demo data
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
┌──────────────┐       └──────────────┘       ┌──────────────┐
│   Session    │              │               │   MenuItem   │
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
                       └──────────────┘       └──────────────┘
```

---

## Email Providers

Configure via `EMAIL_PROVIDER` environment variable:

| Provider | Use case | Required env vars |
|----------|----------|-------------------|
| `console` | Development (default) | None |
| `smtp` | Self-hosting | `SMTP_HOST`, `SMTP_FROM` |
| `plunk` | Hosted version | `PLUNK_API_KEY` |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup and guidelines.

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
