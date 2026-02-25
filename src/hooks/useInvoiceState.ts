import { useState, useCallback, useMemo } from "react";
import type { InvoiceData, LineItem } from "../types";

let nextId = 1;
function generateId(): string {
  return `item-${Date.now()}-${nextId++}`;
}

function getDefaultInvoice(): InvoiceData {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return {
    clientName: "",
    clientAddress: "",
    invoiceNumber: `INV-${year}${month}`,
    issuedDate: now.toISOString().split("T")[0],
    paymentDueDate: new Date(now.getTime() + 30 * 86400000)
      .toISOString()
      .split("T")[0],
    servicePeriodStart: "",
    servicePeriodEnd: "",
    lineItems: [{ id: generateId(), date: "", service: "", hours: 0 }],
    hourlyRate: 150,
  };
}

export function useInvoiceState(initial?: InvoiceData) {
  const [invoice, setInvoice] = useState<InvoiceData>(
    initial ?? getDefaultInvoice
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

  const resetInvoice = useCallback(() => {
    setInvoice(getDefaultInvoice());
  }, []);

  const loadInvoice = useCallback((data: InvoiceData) => {
    setInvoice(data);
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
  };
}
