import { useState } from "react";
import type { InvoiceData, Client, LineItem } from "../types";
import {
  formatCurrency,
  formatDate,
  formatHours,
  computePaymentDueDate,
  servicePeriodStart,
  servicePeriodEnd,
} from "../utils/format";

interface Props {
  invoice: InvoiceData;
  client: Client;
  totalHours: number;
  balanceDue: number;
  updateField?: <K extends keyof InvoiceData>(
    field: K,
    value: InvoiceData[K]
  ) => void;
  addLineItem?: () => void;
  removeLineItem?: (id: string) => void;
  updateLineItem?: (
    id: string,
    field: keyof LineItem,
    value: string | number
  ) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function InvoicePreview({
  invoice,
  client,
  totalHours,
  balanceDue,
  updateField,
  addLineItem,
  removeLineItem,
  updateLineItem,
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const themeColor = client.themeColor || "#006b51";
  const paymentDueDate = computePaymentDueDate(
    invoice.issuedDate,
    client.netTerms
  );
  const periodStart = servicePeriodStart(invoice.serviceMonth);
  const periodEnd = servicePeriodEnd(
    invoice.serviceMonth,
    invoice.serviceMonthEnd
  );
  const visibleItems = invoice.lineItems;

  const setStartMonth = (nextStart: string) => {
    if (!updateField || !nextStart) return;
    const prevStart = invoice.serviceMonth;
    updateField("serviceMonth", nextStart);
    if (invoice.serviceMonthEnd && invoice.serviceMonthEnd < nextStart) {
      updateField("serviceMonthEnd", prevStart);
    }
  };

  const setEndMonth = (nextEnd: string) => {
    if (!updateField) return;
    if (!nextEnd || nextEnd === invoice.serviceMonth) {
      updateField("serviceMonthEnd", undefined);
      return;
    }
    if (nextEnd < invoice.serviceMonth) {
      const prevStart = invoice.serviceMonth;
      updateField("serviceMonth", nextEnd);
      updateField("serviceMonthEnd", prevStart);
      return;
    }
    updateField("serviceMonthEnd", nextEnd);
  };

  return (
    <div
      className="bg-white flex flex-col justify-between w-[595px] min-h-[842px] pt-[10px] pb-[16px] px-[10px] font-sans text-dark"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Top content */}
      <div className="flex flex-col gap-2 w-full">
        {/* Header */}
        <div
          className="rounded-[12px] px-5 py-4 flex flex-col gap-5"
          style={{ backgroundColor: hexToRgba(themeColor, 0.1) }}
        >
          {/* Title row */}
          <div className="flex items-start justify-between">
            <h1 className="text-[32px] font-bold leading-8 capitalize text-dark">
              Invoice
            </h1>
            <div className="flex flex-col gap-0 items-end text-right">
              <span className="text-[10px] text-muted">Invoice Number</span>
              {editingKey === "invoiceNumber" ? (
                <input
                  autoFocus
                  className="text-[13px] font-bold text-dark bg-white/80 border border-gray-200 rounded px-1 py-0.5 text-right outline-none focus:border-brand"
                  value={invoice.invoiceNumber}
                  onChange={(e) =>
                    updateField?.("invoiceNumber", e.target.value)
                  }
                  onBlur={() => setEditingKey(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === "Escape") {
                      setEditingKey(null);
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="text-[13px] font-bold text-dark rounded px-1 -mx-1 hover:bg-white/60 transition-colors"
                  onClick={() => setEditingKey("invoiceNumber")}
                >
                  {invoice.invoiceNumber || "INV-XXXXXX"}
                </button>
              )}
            </div>
          </div>

          {/* Billing info */}
          <div className="flex items-start justify-between">
            {/* Bill to */}
            <div className="flex flex-col gap-2 items-start">
              <span className="text-[10px] text-muted uppercase">
                Bill To
              </span>
              <div className="flex flex-col gap-2">
                <div className="flex gap-1 items-center">
                  {client.logoDataUrl && (
                    <img
                      src={client.logoDataUrl}
                      alt=""
                      className="w-4 h-4 rounded-[2px] object-cover"
                    />
                  )}
                  <span className="text-[14px] font-semibold text-dark">
                    {client.name || "Client Name"}
                  </span>
                </div>
                <div className="text-[10px] text-dark whitespace-pre-line">
                  {client.address || "Client Address"}
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="flex flex-col gap-3 items-end text-[10px] text-right">
              <div className="flex flex-col gap-0 items-end">
                <span className="text-muted uppercase">Issued on</span>
                {editingKey === "issuedDate" ? (
                  <input
                    autoFocus
                    type="date"
                    className="font-semibold text-dark bg-white/80 border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand"
                    value={invoice.issuedDate}
                    onChange={(e) => updateField?.("issuedDate", e.target.value)}
                    onBlur={() => setEditingKey(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setEditingKey(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="font-semibold text-dark rounded px-1 -mx-1 hover:bg-white/60 transition-colors"
                    onClick={() => setEditingKey("issuedDate")}
                  >
                    {formatDate(invoice.issuedDate)}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0 items-end">
                <span className="text-muted uppercase">Payment Due</span>
                <span className="font-semibold text-dark">
                  {formatDate(paymentDueDate)}
                </span>
              </div>
              <div className="flex flex-col gap-0 items-end">
                <span className="text-muted uppercase">Service Period</span>
                {editingKey === "servicePeriod" ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="month"
                      className="font-semibold text-dark bg-white/80 border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand"
                      value={invoice.serviceMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                    />
                    <span className="text-muted">to</span>
                    <input
                      type="month"
                      className="font-semibold text-dark bg-white/80 border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand"
                      value={invoice.serviceMonthEnd || invoice.serviceMonth}
                      onChange={(e) => setEndMonth(e.target.value)}
                    />
                    <button
                      type="button"
                      className="text-[10px] text-gray-500 hover:text-dark"
                      onClick={() => setEditingKey(null)}
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="font-semibold text-dark rounded px-1 -mx-1 hover:bg-white/60 transition-colors"
                    onClick={() => setEditingKey("servicePeriod")}
                  >
                    {periodStart && periodEnd
                      ? `${periodStart} to ${periodEnd}`
                      : "—"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Line items table */}
        <div className="flex flex-col w-full">
          {/* Table header */}
          <div className="flex gap-3 px-5 pt-2 text-[10px] text-muted items-center">
            <span className="w-[80px] shrink-0">Date</span>
            <span className="flex-1">Service</span>
            <span className="w-[41px] shrink-0 text-right">Hours</span>
            {addLineItem && (
              <button
                type="button"
                className="text-[10px] text-brand hover:underline ml-2"
                onClick={addLineItem}
              >
                + Add
              </button>
            )}
          </div>

          {/* Line items */}
          <div className="flex flex-col gap-[5px] px-5 pt-2">
            {visibleItems.map((item) => (
              <div key={item.id} className="flex gap-3 items-start text-[11px] group">
                {editingKey === `li-${item.id}-date` ? (
                  <input
                    autoFocus
                    type="date"
                    className="w-[112px] shrink-0 font-medium text-dark border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand"
                    value={item.date}
                    onChange={(e) =>
                      updateLineItem?.(item.id, "date", e.target.value)
                    }
                    onBlur={() => setEditingKey(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setEditingKey(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="w-[80px] shrink-0 font-medium text-dark text-left rounded px-1 -mx-1 hover:bg-gray-100 transition-colors"
                    onClick={() => setEditingKey(`li-${item.id}-date`)}
                  >
                    {item.date || "—"}
                  </button>
                )}

                {editingKey === `li-${item.id}-service` ? (
                  <input
                    autoFocus
                    className="flex-1 text-muted border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand min-w-0"
                    value={item.service}
                    onChange={(e) =>
                      updateLineItem?.(item.id, "service", e.target.value)
                    }
                    onBlur={() => setEditingKey(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setEditingKey(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="flex-1 text-muted text-left rounded px-1 -mx-1 hover:bg-gray-100 transition-colors min-w-0 truncate"
                    onClick={() => setEditingKey(`li-${item.id}-service`)}
                  >
                    {item.service || "Service description"}
                  </button>
                )}

                {editingKey === `li-${item.id}-hours` ? (
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    min="0"
                    className="w-[52px] shrink-0 text-right text-dark border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand"
                    value={item.hours || ""}
                    onChange={(e) =>
                      updateLineItem?.(
                        item.id,
                        "hours",
                        parseFloat(e.target.value) || 0
                      )
                    }
                    onBlur={() => setEditingKey(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") {
                        setEditingKey(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    className="w-[41px] shrink-0 text-right text-dark rounded px-1 -mx-1 hover:bg-gray-100 transition-colors"
                    onClick={() => setEditingKey(`li-${item.id}-hours`)}
                  >
                    {item.hours ? formatHours(item.hours) : "—"}
                  </button>
                )}

                {removeLineItem && visibleItems.length > 1 && (
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-400 hover:text-red-500 transition-opacity"
                    onClick={() => removeLineItem(item.id)}
                    title="Remove row"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-col items-end pl-[10px] w-full">
          <div className="bg-divider h-px rounded-sm w-full" />
          <div className="flex flex-col gap-2 px-5 py-2 rounded-bl-[12px] rounded-br-[12px] rounded-tr-[12px] w-[282px]">
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] text-muted">Total Hours</span>
              <span className="text-[10px] text-muted">
                {formatHours(totalHours)}
              </span>
            </div>
            <div className="bg-divider h-px rounded-sm w-full" />
            <div className="flex items-center justify-between w-full">
              <span className="text-[10px] text-muted">Hourly Rate</span>
              <span className="text-[10px] text-muted">
                {formatCurrency(client.hourlyRate)}
              </span>
            </div>
          </div>
          {/* Balance due */}
          <div
            className="rounded-[8px] px-5 py-3 w-[282px]"
            style={{ backgroundColor: themeColor }}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-[12px] font-semibold text-white">
                Balance Due
              </span>
              <span className="text-[16px] font-bold text-white">
                {formatCurrency(balanceDue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Payment Info */}
      <div className="flex flex-col gap-3 pt-3 px-5 overflow-hidden">
        <div className="flex gap-3 w-full">
          {/* Company details */}
          <div className="flex-1 flex flex-col gap-2">
            <div className="text-[14px] font-bold text-dark">
              <div>Example Studio</div>
              <div>Design &amp; Consulting</div>
            </div>
            <div className="text-[10px] text-dark">
              <div>123 Example Street</div>
              <div>San Francisco, CA 94105</div>
            </div>
            <span className="text-[10px] text-link">
              billing@example.com
            </span>
            <div className="flex gap-1 text-[10px]">
              <span className="text-muted">EIN</span>
              <span className="text-dark">00-0000000</span>
            </div>
          </div>

          {/* Payment instructions */}
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-[12px] font-semibold text-dark">
              Payment Instructions
            </span>
            <p className="text-[10px] text-muted m-0">
              Use these details to send ACH transfers to Example Studio Design
              &amp; Consulting LLC's checking account.
            </p>
            <div className="flex gap-9 text-[10px]">
              <div className="flex flex-col gap-0.5 w-[110px]">
                <span className="text-muted">Routing number</span>
                <span className="font-medium text-dark">000000000</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted">Account number</span>
                <span className="font-medium text-dark">000000000000</span>
              </div>
            </div>
            <div className="flex gap-9 text-[10px]">
              <div className="flex flex-col gap-0.5 w-[110px]">
                <span className="text-muted">Receiving bank</span>
                <span className="text-dark">Example Bank</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted">Bank address</span>
                <div className="text-dark">
                  <div>100 Bank Street</div>
                  <div>San Francisco, CA 94105</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
