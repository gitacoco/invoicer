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
    totalHours,
    resetInvoice,
    loadInvoice,
    mergeLineItems,
  };
}
