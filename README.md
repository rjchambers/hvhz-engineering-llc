# HVHZ Engineering

Roof engineering and field-testing platform for South Florida's High Velocity
Hurricane Zone — online ordering, dispatch, field data capture, and PE-sealed
report delivery for roofing contractors.

**Production:** [hvhz.us](https://hvhz.us)

## Stack

- **Frontend:** Vite · React · TypeScript · Tailwind CSS · shadcn/ui
- **Backend:** Supabase (Postgres + RLS, Auth, Storage, Edge Functions)
- **Payments:** Stripe Checkout
- **Email:** Resend (sending domain `workorder.hvhz.us`)

## Development

```sh
bun install        # or: npm install
bun run dev        # start the dev server
bun run test       # vitest suite (fastener engine + calculations)
bun run build      # production build
bun run lint       # eslint
```

## Project layout

| Path | Purpose |
|---|---|
| `src/pages` | Route pages: public site, client portal, tech, PE, and admin consoles |
| `src/components` | Shared UI, order-flow forms, and wizard steps |
| `src/lib` | Domain logic — fastener engine (RAS 117/128, TAS), drainage calc, wind calc |
| `src/utils/reports` | Sealed-report PDF generation |
| `supabase/functions` | Edge functions: checkout, Stripe webhook, dispatch emails, PDF signing |
| `supabase/migrations` | Database schema, RLS policies, and indexes |

## Deploying edge functions

Functions deploy separately from the frontend:

```sh
supabase functions deploy <function-name> --project-ref <project-ref>
```

Required secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`RESEND_API_KEY` (optional `ADMIN_EMAIL`, `APP_URL`).

## Roles

`client` (contractors placing orders) · `technician` (field work) ·
`engineer` (PE review + sealing) · `admin` (dispatch + operations).
