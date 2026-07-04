import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { promises as fs } from "node:fs";
import path from "node:path";

const INVOICES_DB_FILE = path.join(".invoicer", "db", "invoices.json");
const COMPANY_SETTINGS_FILE = path.join(
  ".invoicer",
  "db",
  "company-settings.json"
);

interface StoredInvoiceRecord {
  id: string;
  clientId: string;
  referenceName?: string;
  createdAt: string;
  updatedAt: string;
  data: Record<string, unknown>;
}

interface InvoicesDb {
  invoices: StoredInvoiceRecord[];
}

interface StoredCompanySettings {
  companyName: string;
  companyLogoDataUrl?: string;
  companyAddress: string;
  contactEmail: string;
  ein: string;
  guidanceLanguage: string;
  routingNumber: string;
  accountNumber: string;
  receivingBank: string;
  bankAddress: string;
}

const DEFAULT_COMPANY_SETTINGS: StoredCompanySettings = {
  companyName: "Example Studio LLC",
  companyAddress: "123 Example Street\nSuite 100\nSan Francisco, CA 94105",
  contactEmail: "billing@example.com",
  ein: "00-0000000",
  guidanceLanguage:
    "Use these placeholder details to send ACH transfers to Example Studio LLC's checking account.",
  routingNumber: "000000000",
  accountNumber: "000000000000",
  receivingBank: "Example Bank",
  bankAddress: "100 Bank Street\nSan Francisco, CA 94105",
};

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

function sanitizeId(input: string): string {
  const clean = input.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return clean || "client";
}

let nextInvoiceId = 1;
function generateInvoiceId(): string {
  return `inv-${Date.now()}-${nextInvoiceId++}`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStoredInvoiceRecord(raw: unknown): StoredInvoiceRecord | null {
  if (!isObjectRecord(raw) || !isObjectRecord(raw.data)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const clientId = typeof raw.clientId === "string" ? raw.clientId : "";
  const referenceName =
    typeof raw.referenceName === "string" ? raw.referenceName : undefined;
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : "";
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : "";
  if (!id || !clientId || !createdAt || !updatedAt) return null;
  return {
    id,
    clientId,
    referenceName,
    createdAt,
    updatedAt,
    data: raw.data,
  };
}

function normalizeInvoiceData(raw: unknown): Record<string, unknown> | null {
  if (!isObjectRecord(raw)) return null;
  if (typeof raw.clientId !== "string" || !raw.clientId.trim()) return null;
  if (typeof raw.invoiceNumber !== "string") return null;
  if (typeof raw.issuedDate !== "string") return null;
  if (typeof raw.serviceMonth !== "string") return null;
  if (!Array.isArray(raw.lineItems)) return null;
  return raw;
}

function normalizeReferenceName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

function normalizePlainText(value: unknown, fallback: string, max = 300): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

function normalizeMultilineText(
  value: unknown,
  fallback: string,
  max = 800
): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\r/g, "").trim();
  return normalized.slice(0, max);
}

function normalizeLogoDataUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.startsWith("/")) return normalized.slice(0, 400);
  if (normalized.startsWith("data:image/")) return normalized.slice(0, 8_000_000);
  return undefined;
}

function normalizeCompanySettings(raw: unknown): StoredCompanySettings {
  const obj = isObjectRecord(raw) ? raw : {};
  return {
    companyName: normalizePlainText(
      obj.companyName,
      DEFAULT_COMPANY_SETTINGS.companyName,
      120
    ),
    companyLogoDataUrl: normalizeLogoDataUrl(obj.companyLogoDataUrl),
    companyAddress: normalizeMultilineText(
      obj.companyAddress,
      DEFAULT_COMPANY_SETTINGS.companyAddress,
      400
    ),
    contactEmail: normalizePlainText(
      obj.contactEmail,
      DEFAULT_COMPANY_SETTINGS.contactEmail,
      160
    ),
    ein: normalizePlainText(obj.ein, DEFAULT_COMPANY_SETTINGS.ein, 80),
    guidanceLanguage: normalizeMultilineText(
      obj.guidanceLanguage,
      DEFAULT_COMPANY_SETTINGS.guidanceLanguage,
      500
    ),
    routingNumber: normalizePlainText(
      obj.routingNumber,
      DEFAULT_COMPANY_SETTINGS.routingNumber,
      64
    ),
    accountNumber: normalizePlainText(
      obj.accountNumber,
      DEFAULT_COMPANY_SETTINGS.accountNumber,
      64
    ),
    receivingBank: normalizePlainText(
      obj.receivingBank,
      DEFAULT_COMPANY_SETTINGS.receivingBank,
      160
    ),
    bankAddress: normalizeMultilineText(
      obj.bankAddress,
      DEFAULT_COMPANY_SETTINGS.bankAddress,
      400
    ),
  };
}

function invoicesForClientInDisplayOrder(
  invoices: StoredInvoiceRecord[],
  clientId?: string | null
): StoredInvoiceRecord[] {
  return clientId
    ? invoices.filter((inv) => inv.clientId === clientId)
    : [...invoices];
}

function insertInvoiceAtClientTop(
  invoices: StoredInvoiceRecord[],
  record: StoredInvoiceRecord
): StoredInvoiceRecord[] {
  const next = [...invoices];
  const firstClientIndex = next.findIndex(
    (inv) => inv.clientId === record.clientId
  );
  if (firstClientIndex < 0) {
    next.unshift(record);
    return next;
  }
  next.splice(firstClientIndex, 0, record);
  return next;
}

function reorderClientInvoices(
  invoices: StoredInvoiceRecord[],
  clientId: string,
  orderedIds: string[]
): {
  nextInvoices: StoredInvoiceRecord[];
  clientInvoices: StoredInvoiceRecord[];
} {
  const existingClientInvoices = invoices.filter((inv) => inv.clientId === clientId);
  const byId = new Map(existingClientInvoices.map((inv) => [inv.id, inv] as const));
  const seen = new Set<string>();
  const normalizedOrder: string[] = [];

  for (const id of orderedIds) {
    if (!byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    normalizedOrder.push(id);
  }

  const reorderedClientInvoices = [
    ...normalizedOrder
      .map((id) => byId.get(id))
      .filter((inv): inv is StoredInvoiceRecord => Boolean(inv)),
    ...existingClientInvoices.filter((inv) => !seen.has(inv.id)),
  ];

  const nextInvoices = [...invoices];
  let clientCursor = 0;
  for (let i = 0; i < nextInvoices.length; i += 1) {
    if (nextInvoices[i].clientId !== clientId) continue;
    nextInvoices[i] = reorderedClientInvoices[clientCursor];
    clientCursor += 1;
  }

  return {
    nextInvoices,
    clientInvoices: reorderedClientInvoices,
  };
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readInvoicesDb(root: string): Promise<InvoicesDb> {
  const abs = path.resolve(root, INVOICES_DB_FILE);
  try {
    const raw = await fs.readFile(abs, "utf8");
    const parsed = JSON.parse(raw) as { invoices?: unknown[] };
    const list = Array.isArray(parsed.invoices) ? parsed.invoices : [];
    const invoices = list
      .map((entry) => toStoredInvoiceRecord(entry))
      .filter((entry): entry is StoredInvoiceRecord => entry !== null);
    return { invoices };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { invoices: [] };
    }
    throw err;
  }
}

async function writeInvoicesDb(root: string, db: InvoicesDb): Promise<void> {
  const abs = path.resolve(root, INVOICES_DB_FILE);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(db, null, 2) + "\n", "utf8");
}

async function readCompanySettings(root: string): Promise<StoredCompanySettings> {
  const abs = path.resolve(root, COMPANY_SETTINGS_FILE);
  try {
    const raw = await fs.readFile(abs, "utf8");
    return normalizeCompanySettings(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_COMPANY_SETTINGS;
    }
    throw err;
  }
}

async function writeCompanySettings(
  root: string,
  settings: StoredCompanySettings
): Promise<void> {
  const abs = path.resolve(root, COMPANY_SETTINGS_FILE);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

function clientRepoPlugin() {
  return {
    name: "invoicer-client-repo-writer",
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          fn: (req: any, res: any, next: () => void) => void | Promise<void>
        ) => void;
      };
      config: { root: string };
    }) {
      server.middlewares.use("/__invoicer/clients", async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "POST") {
          next();
          return;
        }
        try {
          const clientsDir = path.resolve(server.config.root, "src/config/clients");

          if (req.method === "GET") {
            let files: string[] = [];
            try {
              files = await fs.readdir(clientsDir);
            } catch (err) {
              if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
            }
            const clients = (
              await Promise.all(
                files
                  .filter((file) => file.endsWith(".json"))
                  .map(async (file) => {
                    const raw = await fs.readFile(path.resolve(clientsDir, file), "utf8");
                    return JSON.parse(raw);
                  })
              )
            ).sort((a, b) => {
              const aName = typeof a.name === "string" ? a.name : "";
              const bName = typeof b.name === "string" ? b.name : "";
              return aName.localeCompare(bName);
            });
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, clients }));
            return;
          }

          const body = await readBody(req);
          const parsed = JSON.parse(body) as {
            clients?: Array<Record<string, unknown>>;
          };
          const clients = Array.isArray(parsed.clients) ? parsed.clients : [];

          const logosDir = path.resolve(server.config.root, "public/client-logos");
          await fs.mkdir(clientsDir, { recursive: true });
          await fs.mkdir(logosDir, { recursive: true });

          const written = new Set<string>();
          for (const raw of clients) {
            if (!raw || typeof raw !== "object") continue;
            const id = typeof raw.id === "string" ? raw.id : "";
            const safeId = sanitizeId(id);
            if (!safeId) continue;

            const out: Record<string, unknown> = { ...raw };
            if (
              typeof out.logoDataUrl === "string" &&
              out.logoDataUrl.startsWith("data:image/")
            ) {
              const m = out.logoDataUrl.match(
                /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
              );
              if (m) {
                const mime = m[1];
                const base64 = m[2];
                const ext = extFromMime(mime);
                const fileName = `${safeId}.${ext}`;
                const abs = path.resolve(logosDir, fileName);
                await fs.writeFile(abs, Buffer.from(base64, "base64"));
                out.logoDataUrl = `/client-logos/${fileName}`;
              }
            }

            const outPath = path.resolve(clientsDir, `${safeId}.json`);
            await fs.writeFile(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
            written.add(`${safeId}.json`);
          }

          const existing = await fs.readdir(clientsDir);
          await Promise.all(
            existing
              .filter((f) => f.endsWith(".json") && !written.has(f))
              .map((f) => fs.unlink(path.resolve(clientsDir, f)))
          );

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          const persisted = await Promise.all(
            Array.from(written)
              .sort()
              .map(async (file) => {
                const raw = await fs.readFile(path.resolve(clientsDir, file), "utf8");
                return JSON.parse(raw);
              })
          );
          res.end(
            JSON.stringify({
              ok: true,
              clients: persisted.sort((a, b) => {
                const aName = typeof a.name === "string" ? a.name : "";
                const bName = typeof b.name === "string" ? b.name : "";
                return aName.localeCompare(bName);
              }),
              count: written.size,
            })
          );
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        }
      });

      server.middlewares.use("/__invoicer/invoices", async (req, res, next) => {
        const method = req.method ?? "GET";
        if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          next();
          return;
        }

        try {
          const parsedUrl = new URL(req.url ?? "/", "http://localhost");
          const pathname = parsedUrl.pathname || "/";
          const pathSegments = pathname
            .split("/")
            .filter((segment) => segment.length > 0)
            .map((segment) => decodeURIComponent(segment));
          const invoiceId = pathSegments[0] ?? null;
          const subAction = pathSegments[1] ?? null;

          const db = await readInvoicesDb(server.config.root);

          if (method === "GET") {
            if (invoiceId === "client" && subAction) {
              const invoices = invoicesForClientInDisplayOrder(db.invoices, subAction);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, invoices }));
              return;
            }

            if (invoiceId) {
              const match = db.invoices.find((inv) => inv.id === invoiceId);
              if (!match) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Invoice not found." }));
                return;
              }
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, invoice: match }));
              return;
            }

            const clientId = parsedUrl.searchParams.get("clientId");
            const invoices = invoicesForClientInDisplayOrder(db.invoices, clientId);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, invoices }));
            return;
          }

          if (method === "POST") {
            if (invoiceId) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invalid create path." }));
              return;
            }
            const body = await readBody(req);
            const parsed = JSON.parse(body) as Record<string, unknown>;
            const data = normalizeInvoiceData(parsed.data);
            if (!data) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invalid invoice payload." }));
              return;
            }
            const now = new Date().toISOString();
            const invoiceNumber =
              typeof data.invoiceNumber === "string"
                ? data.invoiceNumber.trim()
                : "";
            const record: StoredInvoiceRecord = {
              id: generateInvoiceId(),
              clientId: data.clientId as string,
              referenceName: invoiceNumber || "Untitled Invoice",
              createdAt: now,
              updatedAt: now,
              data,
            };
            db.invoices = insertInvoiceAtClientTop(db.invoices, record);
            await writeInvoicesDb(server.config.root, db);
            res.statusCode = 201;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, invoice: record }));
            return;
          }

          if (method === "PUT") {
            if (!invoiceId) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invoice id is required." }));
              return;
            }
            const idx = db.invoices.findIndex((inv) => inv.id === invoiceId);
            if (idx < 0) {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invoice not found." }));
              return;
            }
            const body = await readBody(req);
            const parsed = JSON.parse(body) as Record<string, unknown>;
            const data = normalizeInvoiceData(parsed.data);
            if (!data) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invalid invoice payload." }));
              return;
            }
            const existing = db.invoices[idx];
            const updated: StoredInvoiceRecord = {
              ...existing,
              clientId: data.clientId as string,
              updatedAt: new Date().toISOString(),
              data,
            };
            db.invoices[idx] = updated;
            await writeInvoicesDb(server.config.root, db);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, invoice: updated }));
            return;
          }

          if (method === "PATCH") {
            if (invoiceId === "reorder" && !subAction) {
              const body = await readBody(req);
              const parsed = JSON.parse(body) as Record<string, unknown>;
              const clientId =
                typeof parsed.clientId === "string" ? parsed.clientId.trim() : "";
              const orderedIds = Array.isArray(parsed.orderedIds)
                ? parsed.orderedIds.filter(
                    (id): id is string => typeof id === "string" && id.trim().length > 0
                  )
                : [];

              if (!clientId) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "clientId is required." }));
                return;
              }

              const { nextInvoices, clientInvoices } = reorderClientInvoices(
                db.invoices,
                clientId,
                orderedIds
              );
              db.invoices = nextInvoices;
              await writeInvoicesDb(server.config.root, db);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, invoices: clientInvoices }));
              return;
            }

            if (!invoiceId || subAction !== "reference-name") {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  error: "Invalid rename path. Expected /:id/reference-name.",
                })
              );
              return;
            }
            const idx = db.invoices.findIndex((inv) => inv.id === invoiceId);
            if (idx < 0) {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invoice not found." }));
              return;
            }
            const body = await readBody(req);
            const parsed = JSON.parse(body) as Record<string, unknown>;
            const referenceName = normalizeReferenceName(parsed.referenceName);
            if (!referenceName) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({ ok: false, error: "Reference name is required." })
              );
              return;
            }
            const existing = db.invoices[idx];
            const updated: StoredInvoiceRecord = {
              ...existing,
              referenceName,
              updatedAt: new Date().toISOString(),
            };
            db.invoices[idx] = updated;
            await writeInvoicesDb(server.config.root, db);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, invoice: updated }));
            return;
          }

          if (method === "DELETE") {
            if (!invoiceId || subAction) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invoice id is required." }));
              return;
            }
            const before = db.invoices.length;
            db.invoices = db.invoices.filter((inv) => inv.id !== invoiceId);
            if (db.invoices.length === before) {
              res.statusCode = 404;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Invoice not found." }));
              return;
            }
            await writeInvoicesDb(server.config.root, db);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true }));
            return;
          }
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        }
      });

      server.middlewares.use(
        "/__invoicer/company-settings",
        async (req, res, next) => {
          const method = req.method ?? "GET";
          if (method !== "GET" && method !== "POST") {
            next();
            return;
          }

          try {
            if (method === "GET") {
              const settings = await readCompanySettings(server.config.root);
              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, settings }));
              return;
            }

            const body = await readBody(req);
            const parsed = JSON.parse(body) as Record<string, unknown>;
            const previousSettings = await readCompanySettings(server.config.root);
            const incoming = isObjectRecord(parsed.settings)
              ? { ...parsed.settings }
              : {};
            if (
              typeof incoming.companyLogoDataUrl === "string" &&
              incoming.companyLogoDataUrl.startsWith("data:image/")
            ) {
              const m = incoming.companyLogoDataUrl.match(
                /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
              );
              if (m) {
                const mime = m[1];
                const base64 = m[2];
                const ext = extFromMime(mime);
                const logosDir = path.resolve(
                  server.config.root,
                  "public/company-logos"
                );
                await fs.mkdir(logosDir, { recursive: true });
                const fileName = `company-logo-${Date.now()}.${ext}`;
                const abs = path.resolve(logosDir, fileName);
                await fs.writeFile(abs, Buffer.from(base64, "base64"));
                incoming.companyLogoDataUrl = `/company-logos/${fileName}`;
              } else {
                incoming.companyLogoDataUrl = undefined;
              }
            }
            const settings = normalizeCompanySettings(incoming);
            if (
              typeof previousSettings.companyLogoDataUrl === "string" &&
              previousSettings.companyLogoDataUrl.startsWith("/company-logos/") &&
              previousSettings.companyLogoDataUrl !== settings.companyLogoDataUrl
            ) {
              const logosDir = path.resolve(server.config.root, "public/company-logos");
              const previousFileName = path.basename(previousSettings.companyLogoDataUrl);
              const previousAbs = path.resolve(logosDir, previousFileName);
              try {
                await fs.unlink(previousAbs);
              } catch (err) {
                if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
              }
            }
            await writeCompanySettings(server.config.root, settings);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, settings }));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error: err instanceof Error ? err.message : String(err),
              })
            );
          }
        }
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), clientRepoPlugin()],
  server: {
    proxy: {
      "/toggl-api": {
        target: "https://api.track.toggl.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/toggl-api/, ""),
      },
    },
  },
});
