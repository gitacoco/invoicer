# Invoicer

A local-first invoice builder for consulting work. It manages client profiles, invoice drafts, PDF exports, and optional Toggl Track imports.

## Features

- Client profile management with per-client terms, rates, colors, and logo support.
- Invoice editing with live preview and PDF export.
- Local invoice persistence through Vite development middleware.
- Vercel deployment support through Serverless Functions and Vercel Blob.
- Optional Toggl Track sync for importing time entries.

## Getting Started

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Build the production bundle:

```bash
pnpm build
```

Preview the production bundle:

```bash
pnpm preview
```

## Deploying to Vercel

The production app uses Vercel Functions for:

- `__invoicer/clients`
- `__invoicer/invoices`
- `__invoicer/company-settings`
- `toggl-api/*`

Persistent production data is stored in Vercel Blob:

- private JSON blobs for clients, invoices, and company settings
- public logo blobs for client and company logos

Before deploying, create a Vercel Blob store and connect it to this Vercel project. Vercel will provide Blob credentials through project environment variables such as `BLOB_STORE_ID`/`VERCEL_OIDC_TOKEN` or `BLOB_READ_WRITE_TOKEN`.

For local Vercel testing with the real Blob store:

```bash
vercel env pull .env.local
vercel dev
```

For normal local development:

```bash
pnpm dev
```

`pnpm dev` keeps using local `.invoicer/` data and the Vite dev proxy/middleware.

Build and verify before deployment:

```bash
pnpm install --frozen-lockfile
pnpm build
vercel build --yes
```

This app contains invoice history, bank details, and private client data. Use Vercel Deployment Protection or another access-control layer before exposing it on a public production domain.

## Local Data

The app stores local development runtime data under `.invoicer/`, which is intentionally ignored by git. Production deployments store runtime data in Vercel Blob. Keep real client names, rates, invoice data, bank details, API keys, and private logos out of committed files.

Example client configs live in `src/config/clients/`. Replace them locally or through the app UI for private use.

## Integrations

### Toggl Track

Toggl API tokens are entered in the app and stored locally. You can also set `VITE_TOGGL_API_TOKEN` for local development, but do not commit real tokens.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm audit --audit-level moderate
```

## License

MIT
