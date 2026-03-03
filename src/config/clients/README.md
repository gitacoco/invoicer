# Client Config Files

Put one JSON file per client in this folder.

Required fields:
- `id` (string, unique)
- `name` (string)
- `address` (string, `\n` for line breaks)
- `themeColor` (hex color, e.g. `#006b51`)
- `hourlyRate` (number)
- `netTerms` (`15`, `30`, `45`, `60`)

Optional fields:
- `logoDataUrl` (string)
  - recommended: a repo path like `"/client-logos/acme.png"`
  - supported: `data:image/...;base64,...` (dev server will convert to file path on save)

Example:

```json
{
  "id": "acme",
  "name": "Acme Inc.",
  "address": "123 Main St\nSan Francisco, CA 94105",
  "themeColor": "#445566",
  "hourlyRate": 180,
  "netTerms": 30
}
```
