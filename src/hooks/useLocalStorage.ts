import { useState, useCallback } from "react";
import type { InvoiceData, SavedInvoice, Client } from "../types";

const STORAGE_KEY = "invoicer-saved";

function loadAll(): SavedInvoice[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAll(invoices: SavedInvoice[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices));
}

export function useLocalStorage() {
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>(loadAll);

  const saveInvoice = useCallback((data: InvoiceData, client: Client) => {
    const key = data.invoiceNumber || `draft-${Date.now()}`;
    const label = `${data.invoiceNumber} - ${client.name || "Untitled"}`;
    const entry: SavedInvoice = {
      key,
      label,
      data,
      savedAt: new Date().toISOString(),
    };

    setSavedInvoices((prev) => {
      const filtered = prev.filter((s) => s.key !== key);
      const next = [entry, ...filtered];
      saveAll(next);
      return next;
    });
  }, []);

  const deleteInvoice = useCallback((key: string) => {
    setSavedInvoices((prev) => {
      const next = prev.filter((s) => s.key !== key);
      saveAll(next);
      return next;
    });
  }, []);

  return { savedInvoices, saveInvoice, deleteInvoice };
}
