# Invoicer

A local-first invoice builder for consulting work. It manages client profiles, invoice drafts, PDF exports, optional Toggl Track imports, and AI-assisted line-item rewriting during development.

## Features

- Client profile management with per-client terms, rates, colors, and logo support.
- Invoice editing with live preview and PDF export.
- Local invoice persistence through Vite development middleware.
- Optional Toggl Track sync for importing time entries.
- Optional MiniMax-powered rewrite flow for line-item copy.

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

## Local Data

The app stores local runtime data under `.invoicer/`, which is intentionally ignored by git. Keep real client names, rates, invoice data, bank details, API keys, and private logos out of committed files.

Example client configs live in `src/config/clients/`. Replace them locally or through the app UI for private use.

## Integrations

### Toggl Track

Toggl API tokens are entered in the app and stored locally. You can also set `VITE_TOGGL_API_TOKEN` for local development, but do not commit real tokens.

### AI Rewrite

AI rewrite settings are stored locally in `.invoicer/ai.config.local`. The default provider endpoint is MiniMax-compatible; real API keys should stay local.

## Development

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm audit --audit-level moderate
```

## License

MIT
