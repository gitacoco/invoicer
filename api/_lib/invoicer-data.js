import { createHash } from "node:crypto";
import { DEFAULT_CLIENTS, DEFAULT_COMPANY_SETTINGS } from "./defaults.js";
import { readJsonStore, writeJsonStore, writePublicBlob } from "./storage.js";

const CLIENTS_STORE_KEY = "invoicer/data/clients.json";
const INVOICES_STORE_KEY = "invoicer/data/invoices.json";
const COMPANY_SETTINGS_STORE_KEY = "invoicer/data/company-settings.json";

function isObjectRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidNetTerms(value) {
  return value === 15 || value === 30 || value === 45 || value === 60;
}

export function sanitizeId(input) {
  const clean = String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return clean || "client";
}

function normalizePlainText(value, fallback, max = 300) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return (normalized || fallback).slice(0, max);
}

function normalizeMultilineText(value, fallback, max = 800) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\r/g, "").trim();
  return (normalized || fallback).slice(0, max);
}

function normalizeLogoUrl(value) {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  if (normalized.startsWith("/")) return normalized.slice(0, 800);
  if (normalized.startsWith("data:image/")) return normalized.slice(0, 8_000_000);
  if (/^https?:\/\//i.test(normalized)) return normalized.slice(0, 2000);
  return undefined;
}

export function extFromMime(mime) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  if (mime === "image/webp") return "webp";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

function parseImageDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  const bytes = Buffer.from(match[2], "base64");
  return {
    bytes,
    mime: match[1],
    ext: extFromMime(match[1]),
    hash: createHash("sha256").update(bytes).digest("hex").slice(0, 16),
  };
}

export function normalizeClient(raw) {
  if (!isObjectRecord(raw)) return null;
  if (
    typeof raw.id !== "string" ||
    typeof raw.name !== "string" ||
    typeof raw.address !== "string" ||
    typeof raw.themeColor !== "string" ||
    typeof raw.hourlyRate !== "number" ||
    !isValidNetTerms(raw.netTerms)
  ) {
    return null;
  }
  return {
    id: sanitizeId(raw.id),
    name: raw.name.trim().slice(0, 160),
    address: raw.address.replace(/\r/g, "").trim().slice(0, 800),
    logoDataUrl: normalizeLogoUrl(raw.logoDataUrl),
    themeColor: raw.themeColor.trim().slice(0, 32),
    hourlyRate: raw.hourlyRate,
    netTerms: raw.netTerms,
  };
}

export function normalizeClients(rawClients) {
  const clients = Array.isArray(rawClients) ? rawClients : [];
  const unique = [];
  const seen = new Set();
  for (const raw of clients) {
    const client = normalizeClient(raw);
    if (!client || seen.has(client.id)) continue;
    seen.add(client.id);
    unique.push(client);
  }
  return unique.sort((a, b) => a.name.localeCompare(b.name));
}

export async function persistClientLogos(clients) {
  const persisted = [];
  for (const client of clients) {
    const next = { ...client };
    const image = parseImageDataUrl(next.logoDataUrl);
    if (image) {
      const safeId = sanitizeId(next.id);
      const key = `invoicer/logos/client-logos/${safeId}-${image.hash}.${image.ext}`;
      next.logoDataUrl = await writePublicBlob(key, image.bytes, image.mime);
    }
    persisted.push(next);
  }
  return persisted;
}

export async function readClients() {
  const stored = await readJsonStore(CLIENTS_STORE_KEY, null);
  if (!stored) return normalizeClients(DEFAULT_CLIENTS);
  return normalizeClients(stored.clients);
}

export async function writeClients(clients) {
  const normalized = normalizeClients(await persistClientLogos(clients));
  await writeJsonStore(CLIENTS_STORE_KEY, { clients: normalized });
  return normalized;
}

export function toStoredInvoiceRecord(raw) {
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

export function normalizeInvoiceData(raw) {
  if (!isObjectRecord(raw)) return null;
  if (typeof raw.clientId !== "string" || !raw.clientId.trim()) return null;
  if (typeof raw.invoiceNumber !== "string") return null;
  if (typeof raw.issuedDate !== "string") return null;
  if (typeof raw.serviceMonth !== "string") return null;
  if (!Array.isArray(raw.lineItems)) return null;
  return raw;
}

export function normalizeReferenceName(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

export function invoicesForClientInDisplayOrder(invoices, clientId) {
  return clientId
    ? invoices.filter((invoice) => invoice.clientId === clientId)
    : [...invoices];
}

export function insertInvoiceAtClientTop(invoices, record) {
  const next = [...invoices];
  const firstClientIndex = next.findIndex(
    (invoice) => invoice.clientId === record.clientId
  );
  if (firstClientIndex < 0) {
    next.unshift(record);
    return next;
  }
  next.splice(firstClientIndex, 0, record);
  return next;
}

export function reorderClientInvoices(invoices, clientId, orderedIds) {
  const existingClientInvoices = invoices.filter(
    (invoice) => invoice.clientId === clientId
  );
  const byId = new Map(existingClientInvoices.map((invoice) => [invoice.id, invoice]));
  const seen = new Set();
  const normalizedOrder = [];

  for (const id of orderedIds) {
    if (!byId.has(id) || seen.has(id)) continue;
    seen.add(id);
    normalizedOrder.push(id);
  }

  const reorderedClientInvoices = [
    ...normalizedOrder.map((id) => byId.get(id)).filter(Boolean),
    ...existingClientInvoices.filter((invoice) => !seen.has(invoice.id)),
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

export async function readInvoicesDb() {
  const stored = await readJsonStore(INVOICES_STORE_KEY, { invoices: [] });
  const list = Array.isArray(stored.invoices) ? stored.invoices : [];
  return {
    invoices: list.map(toStoredInvoiceRecord).filter(Boolean),
  };
}

export async function writeInvoicesDb(db) {
  await writeJsonStore(INVOICES_STORE_KEY, {
    invoices: Array.isArray(db.invoices) ? db.invoices : [],
  });
}

export function normalizeCompanySettings(raw) {
  const obj = isObjectRecord(raw) ? raw : {};
  return {
    companyName: normalizePlainText(
      obj.companyName,
      DEFAULT_COMPANY_SETTINGS.companyName,
      120
    ),
    companyLogoDataUrl: normalizeLogoUrl(obj.companyLogoDataUrl),
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

export async function persistCompanyLogo(settings) {
  const next = { ...settings };
  const image = parseImageDataUrl(next.companyLogoDataUrl);
  if (!image) return next;
  const key = `invoicer/logos/company-logos/company-logo-${image.hash}.${image.ext}`;
  next.companyLogoDataUrl = await writePublicBlob(key, image.bytes, image.mime);
  return next;
}

export async function readCompanySettings() {
  const stored = await readJsonStore(COMPANY_SETTINGS_STORE_KEY, null);
  return normalizeCompanySettings(stored ?? DEFAULT_COMPANY_SETTINGS);
}

export async function writeCompanySettings(settings) {
  const normalized = normalizeCompanySettings(await persistCompanyLogo(settings));
  await writeJsonStore(COMPANY_SETTINGS_STORE_KEY, normalized);
  return normalized;
}
