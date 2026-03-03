import { useCallback, useEffect, useState } from "react";
import type { InvoiceData, InvoiceRecord } from "../types";

interface InvoiceListResponse {
  ok: boolean;
  invoices?: InvoiceRecord[];
  error?: string;
}

interface InvoiceOneResponse {
  ok: boolean;
  invoice?: InvoiceRecord;
  error?: string;
}

interface RenameInvoiceResponse {
  ok: boolean;
  invoice?: InvoiceRecord;
  error?: string;
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useInvoices(clientId: string | null) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!clientId) {
      setInvoices([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/__invoicer/invoices?clientId=${encodeURIComponent(clientId)}`
      );
      const payload = await parseJsonSafe<InvoiceListResponse>(res);
      if (!res.ok || !payload?.ok || !Array.isArray(payload.invoices)) {
        throw new Error(payload?.error || "Failed to load invoices.");
      }
      setInvoices(payload.invoices);
    } catch (error) {
      console.error("[invoices] failed to load:", error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createInvoice = useCallback(async (data: InvoiceData): Promise<InvoiceRecord> => {
    const res = await fetch("/__invoicer/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const payload = await parseJsonSafe<InvoiceOneResponse>(res);
    if (!res.ok || !payload?.ok || !payload.invoice) {
      throw new Error(payload?.error || "Failed to create invoice.");
    }
    const created = payload.invoice;
    setInvoices((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
    return created;
  }, []);

  const updateInvoice = useCallback(
    async (id: string, data: InvoiceData): Promise<InvoiceRecord> => {
      const res = await fetch(`/__invoicer/invoices/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const payload = await parseJsonSafe<InvoiceOneResponse>(res);
      if (!res.ok || !payload?.ok || !payload.invoice) {
        throw new Error(payload?.error || "Failed to update invoice.");
      }
      const updated = payload.invoice;
      setInvoices((prev) => {
        const next = prev.map((i) => (i.id === id ? updated : i));
        next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return next;
      });
      return updated;
    },
    []
  );

  const deleteInvoice = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/__invoicer/invoices/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const payload = await parseJsonSafe<{ ok?: boolean; error?: string }>(res);
    if (!res.ok || !payload?.ok) {
      throw new Error(payload?.error || "Failed to delete invoice.");
    }
    setInvoices((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const renameInvoice = useCallback(
    async (id: string, referenceName: string): Promise<InvoiceRecord> => {
      const res = await fetch(
        `/__invoicer/invoices/${encodeURIComponent(id)}/reference-name`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referenceName }),
        }
      );
      const payload = await parseJsonSafe<RenameInvoiceResponse>(res);
      if (!res.ok || !payload?.ok || !payload.invoice) {
        throw new Error(payload?.error || "Failed to rename invoice.");
      }
      const updated = payload.invoice;
      setInvoices((prev) => {
        const next = prev.map((i) => (i.id === id ? updated : i));
        next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return next;
      });
      return updated;
    },
    []
  );

  return {
    invoices,
    loading,
    refresh,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    renameInvoice,
  };
}
