import { useState, useCallback, useMemo } from "react";
import type { InvoiceData, LineItem } from "../types";

let nextId = 1;
function generateId(): string {
  return `item-${Date.now()}-${nextId++}`;
}

function getDefaultInvoice(clientId: string): InvoiceData {
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
    netTerms: 30,
    serviceMonth: `${smYear}-${smMonth}`,
    lineItems: [{ id: generateId(), date: "", service: "", hours: 0 }],
    hourlyRate: 150,
  };
}

export function useInvoiceState(clientId: string) {
  const [invoice, setInvoice] = useState<InvoiceData>(() =>
    getDefaultInvoice(clientId)
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

  const balanceDue = useMemo(
    () => totalHours * invoice.hourlyRate,
    [totalHours, invoice.hourlyRate]
  );

  const resetInvoice = useCallback(
    (newClientId?: string) => {
      setInvoice(getDefaultInvoice(newClientId ?? clientId));
    },
    [clientId]
  );

  const loadInvoice = useCallback((data: InvoiceData) => {
    setInvoice(data);
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
    balanceDue,
    resetInvoice,
    loadInvoice,
    mergeLineItems,
  };
}
