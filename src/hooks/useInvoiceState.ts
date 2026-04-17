import { useState, useCallback, useMemo } from "react";
import type { InvoiceData, LineItem } from "../types";

let nextId = 1;
function generateId(): string {
  return `item-${Date.now()}-${nextId++}`;
}

function isBlankLineItem(item: LineItem): boolean {
  return !item.date && !item.service.trim() && (item.hours || 0) === 0;
}

function normalizeLineItems(items: LineItem[]): LineItem[] {
  if (items.length === 1 && isBlankLineItem(items[0])) return [];
  return items;
}

function parseIsoDateToUtcTimestamp(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const utc = Date.UTC(year, month - 1, day);
  const parsed = new Date(utc);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return utc;
}

function sortLineItemsByDate(items: LineItem[]): LineItem[] {
  return items
    .map((item, index) => ({
      item,
      index,
      timestamp: parseIsoDateToUtcTimestamp(item.date),
    }))
    .sort((a, b) => {
      const aHasDate = a.timestamp !== null;
      const bHasDate = b.timestamp !== null;
      if (aHasDate && bHasDate) {
        const aTimestamp = a.timestamp as number;
        const bTimestamp = b.timestamp as number;
        if (aTimestamp !== bTimestamp) return aTimestamp - bTimestamp;
        return a.index - b.index;
      }
      if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

export function createDefaultInvoice(
  clientId: string,
  serviceMonth?: string,
  serviceMonthEnd?: string
): InvoiceData {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  // Default service month is last month
  const lastMonth = new Date(year, now.getMonth() - 1, 1);
  const smYear = lastMonth.getFullYear();
  const smMonth = String(lastMonth.getMonth() + 1).padStart(2, "0");
  return {
    clientId,
    invoiceNumber: `INV-${year}${month}`,
    issuedDate: `${year}-${month}-${String(now.getDate()).padStart(2, "0")}`,
    serviceMonth: serviceMonth ?? `${smYear}-${smMonth}`,
    serviceMonthEnd,
    lineItems: [],
  };
}

export function useInvoiceState(clientId: string) {
  const [invoice, setInvoice] = useState<InvoiceData>(() =>
    createDefaultInvoice(clientId)
  );

  const updateField = useCallback(
    <K extends keyof InvoiceData>(field: K, value: InvoiceData[K]) => {
      setInvoice((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const addLineItem = useCallback(() => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { id: generateId(), date: "", service: "", hours: 0 },
      ],
    }));
  }, []);

  const removeLineItem = useCallback((id: string) => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((item) => item.id !== id),
    }));
  }, []);

  const updateLineItem = useCallback(
    (id: string, field: keyof LineItem, value: string | number) => {
      setInvoice((prev) => ({
        ...prev,
        lineItems: prev.lineItems.map((item) =>
          item.id === id ? { ...item, [field]: value } : item
        ),
      }));
    },
    []
  );

  const finalizeLineItemDate = useCallback((id: string) => {
    setInvoice((prev) => {
      const editedItem = prev.lineItems.find((item) => item.id === id);
      if (!editedItem || parseIsoDateToUtcTimestamp(editedItem.date) === null) {
        return prev;
      }
      return {
        ...prev,
        lineItems: sortLineItemsByDate(prev.lineItems),
      };
    });
  }, []);

  const totalHours = useMemo(
    () => invoice.lineItems.reduce((sum, item) => sum + (item.hours || 0), 0),
    [invoice.lineItems]
  );

  const resetInvoice = useCallback(
    (newClientId?: string, serviceMonth?: string, serviceMonthEnd?: string) => {
      setInvoice(
        createDefaultInvoice(newClientId ?? clientId, serviceMonth, serviceMonthEnd)
      );
    },
    [clientId]
  );

  const loadInvoice = useCallback((data: InvoiceData) => {
    setInvoice({
      ...data,
      lineItems: normalizeLineItems(data.lineItems),
    });
  }, []);

  /** Append new line items (used by Toggl sync) */
  const mergeLineItems = useCallback((newItems: LineItem[]) => {
    setInvoice((prev) => ({
      ...prev,
      lineItems: [...prev.lineItems, ...newItems],
    }));
  }, []);

  return {
    invoice,
    updateField,
    addLineItem,
    removeLineItem,
    updateLineItem,
    finalizeLineItemDate,
    totalHours,
    resetInvoice,
    loadInvoice,
    mergeLineItems,
  };
}
