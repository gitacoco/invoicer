# Contributing

Thanks for taking the time to improve Invoicer.

## Setup

```bash
pnpm install --frozen-lockfile
pnpm dev
```

## Checks

Run these before opening a pull request:

```bash
pnpm build
pnpm audit --audit-level moderate
```

## Data Safety

Do not commit real invoice data, client contracts, client rates, bank details, tax IDs, API keys, or private logos. Local runtime data belongs in `.invoicer/`, which is ignored by git.

## Pull Requests

- Keep pull requests focused.
- Include screenshots for visible UI changes.
- Document setup or data-shape changes in `README.md`.
