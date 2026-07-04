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
const DEFAULT_AI_MODEL = "MiniMax-M2.1-highspeed";
const MINIMAX_MODEL_FALLBACK_ORDER = [
  "MiniMax-M2.1",
  "MiniMax-M2.5-highspeed",
  "MiniMax-M2.5",
  "MiniMax-M2",
] as const;
const REWRITE_MAX_COMPLETION_TOKENS = 320;
const REWRITE_RETRY_MAX_COMPLETION_TOKENS = 800;
const REWRITE_FINAL_MAX_COMPLETION_TOKENS = 1200;

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
  const obj = payload as Record<string, unknown>;
  const asTrimmed = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
  };

  const isReasoningRecord = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    const type = asTrimmed(record.type)?.toLowerCase() ?? "";
    const role = asTrimmed(record.role)?.toLowerCase() ?? "";
    return (
      type.includes("reason") ||
      type.includes("think") ||
      role.includes("reason") ||
      "reasoning_content" in record ||
      "thinking" in record
    );
  };

  const fromContent = (content: unknown): string | null => {
    const direct = asTrimmed(content);
    if (direct) return direct;
    if (Array.isArray(content)) {
      const joined = content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") {
            const record = part as Record<string, unknown>;
            if (isReasoningRecord(record)) return "";
            return (
              asTrimmed(record.output_text) ||
              asTrimmed(record.text) ||
              asTrimmed(record.content) ||
              ""
            );
          }
          return "";
        })
        .join("")
        .trim();
      return joined || null;
    }
    if (content && typeof content === "object") {
      const record = content as Record<string, unknown>;
      if (isReasoningRecord(record)) return null;
      return (
        asTrimmed(record.output_text) ||
        asTrimmed(record.text) ||
        asTrimmed(record.content)
      );
    }
    return null;
  };

  const firstChoice = Array.isArray(obj.choices) ? obj.choices[0] : undefined;
  const firstChoiceRecord =
    firstChoice && typeof firstChoice === "object"
      ? (firstChoice as Record<string, unknown>)
      : null;
  const message =
    firstChoiceRecord?.message && typeof firstChoiceRecord.message === "object"
      ? (firstChoiceRecord.message as Record<string, unknown>)
      : null;

  const candidates: Array<string | null> = [
    fromContent(message?.content),
    asTrimmed(message?.text),
    asTrimmed(firstChoiceRecord?.text),
    fromContent(firstChoiceRecord?.content),
    asTrimmed(obj.output_text),
    asTrimmed(obj.reply),
    asTrimmed(obj.text),
  ];

  const dataObj =
    obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>)
      : null;
  if (dataObj) {
    const nestedChoice = Array.isArray(dataObj.choices) ? dataObj.choices[0] : undefined;
    const nestedChoiceRecord =
      nestedChoice && typeof nestedChoice === "object"
        ? (nestedChoice as Record<string, unknown>)
        : null;
    const nestedMessage =
      nestedChoiceRecord?.message &&
      typeof nestedChoiceRecord.message === "object"
        ? (nestedChoiceRecord.message as Record<string, unknown>)
        : null;
    candidates.push(fromContent(nestedMessage?.content));
    candidates.push(asTrimmed(nestedMessage?.text));
    candidates.push(asTrimmed(nestedChoiceRecord?.text));
    candidates.push(asTrimmed(dataObj.output_text));
    candidates.push(asTrimmed(dataObj.reply));
    candidates.push(asTrimmed(dataObj.text));
  }

  return candidates.find((c): c is string => Boolean(c)) ?? null;
}

function sanitizeRewriteOutput(text: string): string {
  return text
    .replace(/<think>[\s\S]*?(<\/think>|$)/gi, " ")
    .replace(/<\/?think>/gi, " ")
    .trim();
}

function isReasoningOverflowResponse(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const obj = payload as Record<string, unknown>;
  const choice0 = Array.isArray(obj.choices) ? obj.choices[0] : null;
  const finishReason =
    choice0 && typeof choice0 === "object"
      ? (choice0 as Record<string, unknown>).finish_reason
      : null;
  const usage =
    obj.usage && typeof obj.usage === "object"
      ? (obj.usage as Record<string, unknown>)
      : null;
  const completionTokens =
    usage && typeof usage.completion_tokens === "number"
      ? usage.completion_tokens
      : null;
  const details =
    usage?.completion_tokens_details &&
    typeof usage.completion_tokens_details === "object"
      ? (usage.completion_tokens_details as Record<string, unknown>)
      : null;
  const reasoningTokens =
    details && typeof details.reasoning_tokens === "number"
      ? details.reasoning_tokens
      : null;

  return (
    finishReason === "length" &&
    completionTokens !== null &&
    reasoningTokens !== null &&
    completionTokens > 0 &&
    completionTokens === reasoningTokens
  );
}

function isModelNotSupportedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    /\b2061\b/.test(msg) ||
    msg.includes("not support model") ||
    msg.includes("unsupported model")
  );
}

async function callMinimaxChat(
  config: LocalAiConfig,
  text: string,
  strict: boolean,
  modelOverride?: string,
  maxCompletionTokens = REWRITE_MAX_COMPLETION_TOKENS,
  promptMode: "default" | "final_only" = "default"
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
        model: modelOverride ?? config.model,
        reasoning_split: true,
        temperature: strict ? 0 : 0.2,
        max_completion_tokens: maxCompletionTokens,
        messages: [
          {
            role: "system",
            content: strict
              ? promptMode === "final_only"
                ? "Return one final invoice line only. No reasoning. No tags. No markdown. Output plain text only."
                : "Rewrite invoice service descriptions. Return exactly one concise plain-text line in this format: <PastTenseVerb> <NounPhrase>. The first word MUST be a past-tense action verb (for example: Designed, Reviewed, Coordinated, Resolved, Completed, Met). The tone MUST be professional and suitable for a consulting agency service list on an invoice. Choose the most appropriate action verb from the task context and do not default to 'Delivered' unless actual delivery is explicitly described. Never copy the input verbatim. Keep factual meaning. Output line text only with no <think> tags, reasoning, markdown, bullets, labels, or explanations."
              : promptMode === "final_only"
              ? "Return one concise invoice line only. Output plain text only."
              : "Rewrite invoice service descriptions into exactly one concise plain-text line in this format: <PastTenseVerb> <NounPhrase>. Start with one past-tense action verb, then the task noun phrase. Use a professional consulting agency service-list tone suitable for invoice line items. Choose a context-appropriate verb and avoid defaulting to 'Delivered' unless delivery is explicitly mentioned. Never copy the input verbatim. Keep factual meaning. No markdown, bullets, options, labels, or explanations.",
          },
          {
            role: "user",
            content: strict
              ? promptMode === "final_only"
                ? `Service description: ${text}\nReturn final output only.`
                : `Rewrite this service description into one invoice line only: ${text}`
              : promptMode === "final_only"
              ? `Service description: ${text}\nReturn final output only.`
              : `Rewrite this service description into one invoice line: ${text}`,
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
  const raw =
    typeof rewrittenText === "string"
      ? sanitizeRewriteOutput(rewrittenText)
      : "";
  if (!raw) {
    if (isReasoningOverflowResponse(payload)) {
      throw new Error(
        "MiniMax returned an empty rewrite result (reasoning token overflow)."
      );
    }
    throw new Error("MiniMax returned an empty rewrite result.");
  }
  return raw;
}

async function callMinimaxWithModelFallback(
  config: LocalAiConfig,
  text: string,
  strict: boolean,
  maxCompletionTokens = REWRITE_MAX_COMPLETION_TOKENS,
  promptMode: "default" | "final_only" = "default"
): Promise<{ rewrittenText: string; modelUsed: string }> {
  const models = [
    config.model,
    ...MINIMAX_MODEL_FALLBACK_ORDER.filter((model) => model !== config.model),
  ];

  let lastModelError: unknown = null;
  for (const model of models) {
    try {
      const rewrittenText = await callMinimaxChat(
        config,
        text,
        strict,
        model,
        maxCompletionTokens,
        promptMode
      );
      return { rewrittenText, modelUsed: model };
    } catch (error) {
      if (isModelNotSupportedError(error)) {
        lastModelError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastModelError instanceof Error) throw lastModelError;
  throw new Error("MiniMax request failed on all configured model fallbacks.");
}

async function minimaxRewrite(
  config: LocalAiConfig,
  text: string
): Promise<{ rewrittenText: string; modelUsed: string }> {
  const isEmptyRewriteError = (error: unknown): boolean =>
    error instanceof Error &&
    error.message.includes("MiniMax returned an empty rewrite result.");
  const attempt = async (
    strict: boolean
  ): Promise<{ rewrittenText: string; modelUsed: string } | null> => {
    try {
      return await callMinimaxWithModelFallback(
        config,
        text,
        strict,
        REWRITE_MAX_COMPLETION_TOKENS,
        "default"
      );
    } catch (error) {
      if (isEmptyRewriteError(error)) {
        try {
          return await callMinimaxWithModelFallback(
            config,
            text,
            true,
            REWRITE_RETRY_MAX_COMPLETION_TOKENS,
            "default"
          );
        } catch (retryError) {
          if (isEmptyRewriteError(retryError)) return null;
          throw retryError;
        }
      }
      throw error;
    }
  };

  const firstCandidate = await attempt(false);
  if (firstCandidate) return firstCandidate;

  const secondCandidate = await attempt(true);
  if (secondCandidate) return secondCandidate;

  // Final rescue pass with a minimal prompt to force only final answer text.
  try {
    const finalOnly = await callMinimaxWithModelFallback(
      config,
      text,
      true,
      REWRITE_FINAL_MAX_COMPLETION_TOKENS,
      "final_only"
    );
    if (finalOnly) return finalOnly;
  } catch (error) {
    if (!isEmptyRewriteError(error)) throw error;
  }

  throw new Error("MiniMax returned an empty rewrite result.");
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
          const existing = await readAiConfig(server.config.root);
          const incomingApiKey =
            typeof parsed.apiKey === "string" ? parsed.apiKey.trim() : "";
          const apiKey = incomingApiKey || existing?.apiKey || "";
          if (!apiKey) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: "API key is required." }));
            return;
          }

          const baseUrl =
            parsed.baseUrl ?? existing?.baseUrl ?? DEFAULT_AI_BASE_URL;
          const model = parsed.model ?? existing?.model ?? DEFAULT_AI_MODEL;

          const config: LocalAiConfig = {
            provider: "minimax",
            apiKey,
            baseUrl: normalizeBaseUrl(baseUrl),
            model: normalizeText(model, DEFAULT_AI_MODEL),
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

          const { rewrittenText, modelUsed } = await minimaxRewrite(config, text);
          if (modelUsed !== config.model) {
            await writeAiConfig(server.config.root, {
              ...config,
              model: modelUsed,
            });
          }

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
