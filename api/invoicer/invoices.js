import {
  handleError,
  queryValue,
  queryPathSegments,
  readJsonBody,
  requestUrl,
  sendJson,
  sendMethodNotAllowed,
} from "../_lib/http.js";
import {
  insertInvoiceAtClientTop,
  invoicesForClientInDisplayOrder,
  normalizeInvoiceData,
  normalizeReferenceName,
  readInvoicesDb,
  reorderClientInvoices,
  writeInvoicesDb,
} from "../_lib/invoicer-data.js";

let nextInvoiceId = 1;

function generateInvoiceId() {
  return `inv-${Date.now()}-${nextInvoiceId++}`;
}

export default async function handler(req, res) {
  const method = req.method ?? "GET";
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    sendMethodNotAllowed(res, ["GET", "POST", "PUT", "PATCH", "DELETE"]);
    return;
  }

  try {
    const url = requestUrl(req);
    const pathSegments = queryPathSegments(req);
    const invoiceId = pathSegments[0] ?? null;
    const subAction = pathSegments[1] ?? null;
    const db = await readInvoicesDb();

    if (method === "GET") {
      if (invoiceId) {
        const match = db.invoices.find((invoice) => invoice.id === invoiceId);
        if (!match) {
          sendJson(res, 404, { ok: false, error: "Invoice not found." });
          return;
        }
        sendJson(res, 200, { ok: true, invoice: match });
        return;
      }

      const clientId = queryValue(req.query?.clientId) || url.searchParams.get("clientId");
      const invoices = invoicesForClientInDisplayOrder(db.invoices, clientId);
      sendJson(res, 200, { ok: true, invoices });
      return;
    }

    if (method === "POST") {
      if (invoiceId) {
        sendJson(res, 400, { ok: false, error: "Invalid create path." });
        return;
      }
      const body = await readJsonBody(req);
      const data = normalizeInvoiceData(body.data);
      if (!data) {
        sendJson(res, 400, { ok: false, error: "Invalid invoice payload." });
        return;
      }
      const now = new Date().toISOString();
      const invoiceNumber =
        typeof data.invoiceNumber === "string" ? data.invoiceNumber.trim() : "";
      const record = {
        id: generateInvoiceId(),
        clientId: data.clientId,
        referenceName: invoiceNumber || "Untitled Invoice",
        createdAt: now,
        updatedAt: now,
        data,
      };
      db.invoices = insertInvoiceAtClientTop(db.invoices, record);
      await writeInvoicesDb(db);
      sendJson(res, 201, { ok: true, invoice: record });
      return;
    }

    if (method === "PUT") {
      if (!invoiceId) {
        sendJson(res, 400, { ok: false, error: "Invoice id is required." });
        return;
      }
      const idx = db.invoices.findIndex((invoice) => invoice.id === invoiceId);
      if (idx < 0) {
        sendJson(res, 404, { ok: false, error: "Invoice not found." });
        return;
      }
      const body = await readJsonBody(req);
      const data = normalizeInvoiceData(body.data);
      if (!data) {
        sendJson(res, 400, { ok: false, error: "Invalid invoice payload." });
        return;
      }
      const existing = db.invoices[idx];
      const updated = {
        ...existing,
        clientId: data.clientId,
        updatedAt: new Date().toISOString(),
        data,
      };
      db.invoices[idx] = updated;
      await writeInvoicesDb(db);
      sendJson(res, 200, { ok: true, invoice: updated });
      return;
    }

    if (method === "PATCH") {
      if (invoiceId === "reorder" && !subAction) {
        const body = await readJsonBody(req);
        const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
        const orderedIds = Array.isArray(body.orderedIds)
          ? body.orderedIds.filter(
              (id) => typeof id === "string" && id.trim().length > 0
            )
          : [];

        if (!clientId) {
          sendJson(res, 400, { ok: false, error: "clientId is required." });
          return;
        }

        const { nextInvoices, clientInvoices } = reorderClientInvoices(
          db.invoices,
          clientId,
          orderedIds
        );
        db.invoices = nextInvoices;
        await writeInvoicesDb(db);
        sendJson(res, 200, { ok: true, invoices: clientInvoices });
        return;
      }

      if (!invoiceId || subAction !== "reference-name") {
        sendJson(res, 400, {
          ok: false,
          error: "Invalid rename path. Expected /:id/reference-name.",
        });
        return;
      }
      const idx = db.invoices.findIndex((invoice) => invoice.id === invoiceId);
      if (idx < 0) {
        sendJson(res, 404, { ok: false, error: "Invoice not found." });
        return;
      }
      const body = await readJsonBody(req);
      const referenceName = normalizeReferenceName(body.referenceName);
      if (!referenceName) {
        sendJson(res, 400, { ok: false, error: "Reference name is required." });
        return;
      }
      const existing = db.invoices[idx];
      const updated = {
        ...existing,
        referenceName,
        updatedAt: new Date().toISOString(),
      };
      db.invoices[idx] = updated;
      await writeInvoicesDb(db);
      sendJson(res, 200, { ok: true, invoice: updated });
      return;
    }

    if (method === "DELETE") {
      if (!invoiceId || subAction) {
        sendJson(res, 400, { ok: false, error: "Invoice id is required." });
        return;
      }
      const before = db.invoices.length;
      db.invoices = db.invoices.filter((invoice) => invoice.id !== invoiceId);
      if (db.invoices.length === before) {
        sendJson(res, 404, { ok: false, error: "Invoice not found." });
        return;
      }
      await writeInvoicesDb(db);
      sendJson(res, 200, { ok: true });
    }
  } catch (error) {
    handleError(res, error);
  }
}
