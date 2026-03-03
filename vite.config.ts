import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { promises as fs } from "node:fs";
import path from "node:path";

const AI_CONFIG_FILE = path.join(".invoicer", "ai.config.local");
const INVOICES_DB_FILE = path.join(".invoicer", "db", "invoices.json");
const COMPANY_SETTINGS_FILE = path.join(
  ".invoicer",
  "db",
  "company-settings.json"
);
const DEFAULT_AI_BASE_URL = "https://api.minimax.io/v1";
const DEFAULT_AI_MODEL = "MiniMax-M2.5";

interface LocalAiConfig {
  provider: "minimax";
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface PublicAiConfig {
  provider: "minimax";
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
}

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
  companyAddress: "123 Example Street\nSan Francisco, CA 94105",
  contactEmail: "billing@example.com",
  ein: "00-0000000",
  guidanceLanguage:
    "Use these details to send ACH transfers to Example Studio LLC's checking account.",
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

function sortInvoicesDesc(invoices: StoredInvoiceRecord[]): StoredInvoiceRecord[] {
  return [...invoices].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function normalizeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeBaseUrl(value: unknown): string {
  const raw = normalizeText(value, DEFAULT_AI_BASE_URL);
  return raw.replace(/\/+$/, "");
}

function readBody(req: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function toLocalAiConfig(raw: unknown): LocalAiConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const apiKey = typeof obj.apiKey === "string" ? obj.apiKey.trim() : "";
  if (!apiKey) return null;
  return {
    provider: "minimax",
    apiKey,
    baseUrl: normalizeBaseUrl(obj.baseUrl),
    model: normalizeText(obj.model, DEFAULT_AI_MODEL),
  };
}

async function readAiConfig(root: string): Promise<LocalAiConfig | null> {
  const abs = path.resolve(root, AI_CONFIG_FILE);
  try {
    const raw = await fs.readFile(abs, "utf8");
    return toLocalAiConfig(JSON.parse(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeAiConfig(root: string, config: LocalAiConfig): Promise<void> {
  const abs = path.resolve(root, AI_CONFIG_FILE);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(config, null, 2) + "\n", "utf8");
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

function toPublicAiConfig(config: LocalAiConfig | null): PublicAiConfig {
  return {
    provider: "minimax",
    hasApiKey: Boolean(config?.apiKey),
    baseUrl: config?.baseUrl ?? DEFAULT_AI_BASE_URL,
    model: config?.model ?? DEFAULT_AI_MODEL,
  };
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const error = obj.error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybe = (error as Record<string, unknown>).message;
    if (typeof maybe === "string") return maybe;
  }
  const message = obj.message;
  if (typeof message === "string") return message;
  return null;
}

function extractRequestId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as Record<string, unknown>;
  const requestId = obj.request_id;
  return typeof requestId === "string" && requestId.trim()
    ? requestId.trim()
    : null;
}

function formatUpstreamError(
  payload: unknown,
  rawBody: string,
  statusCode: number,
  requestIdHeader: string | null
): string {
  const msg =
    extractErrorMessage(payload) || rawBody.slice(0, 160) || `HTTP ${statusCode}`;
  const requestId = extractRequestId(payload) || requestIdHeader;
  const isBalanceError =
    statusCode === 429 &&
    (msg.includes("1008") || msg.toLowerCase().includes("insufficient balance"));
  const balanceHint = isBalanceError
    ? " Hint: this key's billing bucket has no quota now. If this is a Coding Plan key, check active subscription and 5-hour prompt quota; if it's Pay-as-you-go, check balance under the same key/account."
    : "";
  return requestId
    ? `${msg}${balanceHint} (request_id: ${requestId})`
    : `${msg}${balanceHint}`;
}

function extractAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const obj = payload as {
    choices?: Array<{
      message?: {
        content?: unknown;
        text?: unknown;
      };
    }>;
  };
  const message = obj.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed || null;
  }
  if (content && typeof content === "object") {
    const text = (content as Record<string, unknown>).text;
    if (typeof text === "string") {
      const trimmed = text.trim();
      return trimmed || null;
    }
  }
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const t = (part as Record<string, unknown>).text;
          return typeof t === "string" ? t : "";
        }
        return "";
      })
      .join("")
      .trim();
    return joined || null;
  }
  if (typeof message?.text === "string") {
    const trimmed = message.text.trim();
    return trimmed || null;
  }
  return null;
}

function normalizeRewriteOutput(text: string): string {
  const withoutThink = text.replace(/<think>[\s\S]*?(<\/think>|$)/gi, " ");
  const cleaned = withoutThink
    .replace(/\*\*/g, "")
    .replace(/\r/g, "")
    .trim();
  if (!cleaned) return "";

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 && line !== "---" && !/^if you can share more details/i.test(line)
    );

  if (lines.length === 0) return "";

  const first = lines[0].replace(/^[-*]\s+/, "").trim();
  return first;
}

async function callMinimaxChat(
  config: LocalAiConfig,
  text: string,
  strict: boolean
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response: Response | null = null;
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: strict ? 0 : 0.2,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content: strict
              ? "Rewrite invoice service descriptions. Return exactly one concise plain-text line. The rewritten line must start with a past-tense verb. Do not output <think> tags, reasoning, markdown, bullets, or explanations."
              : "Rewrite invoice service descriptions. Keep factual meaning. Output exactly one concise plain-text line only. The rewritten line must start with a past-tense verb. No markdown, bullets, options, labels, or explanations.",
          },
          {
            role: "user",
            content: strict
              ? `Return one rewritten invoice line only:\n${text}`
              : `Rewrite into one invoice line:\n${text}`,
          },
        ],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response) {
    throw new Error("MiniMax request failed before receiving a response.");
  }

  const rawBody = await response.text();
  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const requestIdHeader = response.headers.get("x-minimax-request-id");
    const upstreamError = formatUpstreamError(
      payload,
      rawBody,
      response.status,
      requestIdHeader
    );
    throw new Error(`MiniMax API error: ${upstreamError}`);
  }

  const rewrittenText = extractAssistantText(payload);
  const normalized = rewrittenText ? normalizeRewriteOutput(rewrittenText) : "";
  if (!normalized) {
    throw new Error("MiniMax returned an empty rewrite result.");
  }
  return normalized;
}

async function minimaxRewrite(config: LocalAiConfig, text: string): Promise<string> {
  try {
    return await callMinimaxChat(config, text, false);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("MiniMax returned an empty rewrite result.")
    ) {
      return await callMinimaxChat(config, text, true);
    }
    throw error;
  }
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
        if (req.method !== "POST") {
          next();
          return;
        }
        try {
          const body = await readBody(req);
          const parsed = JSON.parse(body) as {
            clients?: Array<Record<string, unknown>>;
          };
          const clients = Array.isArray(parsed.clients) ? parsed.clients : [];

          const clientsDir = path.resolve(server.config.root, "src/config/clients");
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
          res.end(JSON.stringify({ ok: true, count: written.size }));
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
            const invoices = sortInvoicesDesc(
              clientId
                ? db.invoices.filter((inv) => inv.clientId === clientId)
                : db.invoices
            );
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
            db.invoices.push(record);
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

      server.middlewares.use("/__invoicer/ai-config", async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "POST") {
          next();
          return;
        }

        try {
          if (req.method === "GET") {
            const parsedUrl = new URL(req.url ?? "/", "http://localhost");
            const includeSecret =
              parsedUrl.searchParams.get("includeSecret") === "1";
            const config = await readAiConfig(server.config.root);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            const publicConfig = toPublicAiConfig(config);
            const fullConfig = includeSecret
              ? { ...publicConfig, apiKey: config?.apiKey ?? "" }
              : publicConfig;
            res.end(JSON.stringify({ ok: true, config: fullConfig }));
            return;
          }

          const body = await readBody(req);
          const parsed = JSON.parse(body) as Record<string, unknown>;
          const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
          if (!apiKey) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "API key is required." }));
            return;
          }

          const config: LocalAiConfig = {
            provider: "minimax",
            apiKey,
            baseUrl: normalizeBaseUrl(parsed.baseUrl),
            model: normalizeText(parsed.model, DEFAULT_AI_MODEL),
          };
          await writeAiConfig(server.config.root, config);

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, config: toPublicAiConfig(config) }));
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

      server.middlewares.use("/__invoicer/ai-rewrite", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        try {
          const body = await readBody(req);
          const parsed = JSON.parse(body) as Record<string, unknown>;
          const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
          if (!text) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "Text is required for rewrite." }));
            return;
          }

          const config = await readAiConfig(server.config.root);
          if (!config?.apiKey) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: false,
                error:
                  "MiniMax API key is missing. Add it first via AI Rewrite settings.",
              })
            );
            return;
          }

          const rewrittenText = await minimaxRewrite(config, text);

          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true, rewrittenText }));
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            })
          );
        }
      });
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
