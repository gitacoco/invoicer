import { useState } from "react";
import type { InvoiceData, Client, LineItem, CompanySettings } from "../types";
import {
  formatCurrency,
  formatDate,
  formatHours,
  computePaymentDueDate,
  servicePeriodStart,
  servicePeriodEnd,
} from "../utils/format";
import { resolveAssetUrl } from "../utils/assets";

interface Props {
  invoice: InvoiceData;
  client: Client;
  companySettings: CompanySettings;
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
  finalizeLineItemDate?: (id: string) => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


const SINGLE_PAGE_CAPACITY = 21;
const FIRST_MULTI_PAGE_CAPACITY = 27;
const MIDDLE_PAGE_CAPACITY = 27;
const LAST_PAGE_CAPACITY = 22;
const SERVICE_CHARS_PER_LINE = 62;
const EXTRA_LINE_HEIGHT_WEIGHT = 0.52;
const LETTER_PAGE_WIDTH = 612;
const LETTER_PAGE_HEIGHT = 792;

function getHoursColumnWidth(items: LineItem[]): string {
  const maxValueChars = items.reduce(
    (maxChars, item) => Math.max(maxChars, formatHours(item.hours).length),
    0
  );
  return `calc(${Math.max(4, maxValueChars)}ch + 4px)`;
}

function estimateWrappedLineCount(text: string, charsPerLine: number): number {
  const source = text.trim();
  if (!source) return 1;

  const charVisualWidth = (char: string): number => {
    if (/[\u2E80-\uA4CF\uAC00-\uD7AF\uF900-\uFAFF\uFE10-\uFE6F\uFF00-\uFFEF]/.test(char)) {
      return 1.8;
    }
    if (/\s/.test(char)) return 0.6;
    return 1;
  };

  const measureLine = (line: string) =>
    Array.from(line).reduce((sum, char) => sum + charVisualWidth(char), 0);

  return source.split("\n").reduce((sum, line) => {
    const normalizedLine = line.trim();
    if (!normalizedLine) return sum + 1;
    const visualWidth = measureLine(normalizedLine);
    return sum + Math.max(1, Math.ceil(visualWidth / charsPerLine));
  }, 0);
}

function estimateLineItemHeightUnits(item: LineItem): number {
  const serviceLineCount = estimateWrappedLineCount(
    item.service || "",
    SERVICE_CHARS_PER_LINE
  );
  return 1 + (serviceLineCount - 1) * EXTRA_LINE_HEIGHT_WEIGHT;
}

function paginateLineItems<T>(
  items: T[],
  getItemHeightUnits: (item: T) => number,
  singlePageCapacity: number,
  firstMultiPageCapacity: number,
  middlePageCapacity: number,
  lastPageCapacity: number
): T[][] {
  if (items.length === 0) return [[]];

  const weights = items.map(getItemHeightUnits);
  const prefixSums = [0];
  for (const weight of weights) {
    prefixSums.push(prefixSums[prefixSums.length - 1] + weight);
  }

  const sumRange = (start: number, end: number) => prefixSums[end] - prefixSums[start];

  if (sumRange(0, items.length) <= singlePageCapacity) return [items];

  const pages: T[][] = [];
  let cursor = 0;

  while (cursor < items.length) {
    const capacity = pages.length === 0 ? firstMultiPageCapacity : middlePageCapacity;
    let end = cursor;
    let used = 0;

    while (end < items.length) {
      const nextWeight = weights[end];
      if (used + nextWeight > capacity && end > cursor) break;

      used += nextWeight;
      end += 1;

      const remaining = sumRange(end, items.length);
      if (remaining > 0 && remaining <= lastPageCapacity) {
        break;
      }
    }

    if (end === cursor) {
      end = cursor + 1;
    }

    pages.push(items.slice(cursor, end));
    cursor = end;

    const remaining = sumRange(cursor, items.length);
    if (remaining > 0 && remaining <= lastPageCapacity) {
      pages.push(items.slice(cursor));
      break;
    }
  }

  const getPageWeight = (pageItems: T[]) =>
    pageItems.reduce((sum, pageItem) => sum + getItemHeightUnits(pageItem), 0);

  for (let pageIndex = 0; pageIndex < pages.length - 1; pageIndex += 1) {
    const currentCapacity =
      pageIndex === 0 ? firstMultiPageCapacity : middlePageCapacity;
    let currentWeight = getPageWeight(pages[pageIndex]);

    while (pages[pageIndex + 1].length > 1) {
      const nextItem = pages[pageIndex + 1][0];
      const nextWeight = getItemHeightUnits(nextItem);
      if (currentWeight + nextWeight > currentCapacity) {
        break;
      }
      pages[pageIndex].push(nextItem);
      pages[pageIndex + 1].shift();
      currentWeight += nextWeight;
    }

    if (pages[pageIndex + 1].length === 0) {
      pages.splice(pageIndex + 1, 1);
      pageIndex -= 1;
    }
  }

  return pages;
}

export default function InvoicePreview({
  invoice,
  client,
  companySettings,
  totalHours,
  balanceDue,
  updateField,
  addLineItem,
  removeLineItem,
  updateLineItem,
  finalizeLineItemDate,
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
  const lineItemGridTemplate = `80px minmax(0,1fr) ${getHoursColumnWidth(
    visibleItems
  )}`;
  const pagedItems = paginateLineItems(
    visibleItems,
    estimateLineItemHeightUnits,
    SINGLE_PAGE_CAPACITY,
    FIRST_MULTI_PAGE_CAPACITY,
    MIDDLE_PAGE_CAPACITY,
    LAST_PAGE_CAPACITY
  );
  const companyNameLines = companySettings.companyName
    .replace(/Example Studio(?!\n)/, "Example Studio\n")
    .split("\n")
    .filter((line) => line.trim());
  const clientLogoUrl = resolveAssetUrl(client.logoDataUrl);
  const companyLogoUrl = resolveAssetUrl(companySettings.companyLogoDataUrl);

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
    <div className="flex flex-col gap-4">
      {pagedItems.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === pagedItems.length - 1;
        const hasPagination = pagedItems.length > 1;

        return (
          <div
            key={`invoice-preview-page-${pageIndex}`}
            className="shadow-[0_10px_24px_rgba(15,23,42,0.10)] border border-[#dce2d8] rounded-xl overflow-hidden"
          >
            <div
              className={`bg-white flex flex-col px-[10px] font-sans text-dark ${
                hasPagination ? (isLastPage ? "pb-[24px]" : "pb-[40px]") : "pb-[80px]"
              } ${
                isFirstPage ? "pt-[10px]" : "pt-[24px]"
              }`}
              style={{
                fontFamily: "'Inter', sans-serif",
                width: `${LETTER_PAGE_WIDTH}px`,
                height: `${LETTER_PAGE_HEIGHT}px`,
              }}
            >
              <div className="flex flex-col gap-2 w-full">
                {isFirstPage && (
                  <div
                    className="rounded-[12px] px-5 py-4 flex flex-col gap-5"
                    style={{ backgroundColor: hexToRgba(themeColor, 0.1) }}
                  >
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

                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-2 items-start">
                        <span className="text-[10px] text-muted uppercase">
                          Bill To
                        </span>
                        <div className="flex flex-col gap-2">
                          <div className="flex gap-1 items-center">
                            {clientLogoUrl && (
                              <img
                                src={clientLogoUrl}
                                alt=""
                                className="w-4 h-4 rounded-[2px] object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
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
                )}

                <div className="flex flex-col w-full">
                  {!isFirstPage && (
                    <div className="px-5 pt-1 text-[10px] uppercase tracking-[0.03em] text-[#75827a]">
                      Continued from previous page
                    </div>
                  )}
                  <div
                    className={`grid gap-3 px-5 text-[10px] text-muted items-center ${
                      isFirstPage ? "pt-2" : "pt-3"
                    }`}
                    style={{ gridTemplateColumns: lineItemGridTemplate }}
                  >
                    <span>Date</span>
                    <span>Service</span>
                    <span className="text-right">Hours</span>
                  </div>

                  <div className="flex flex-col gap-[5px] px-5 pt-2">
                    {pageItems.map((item) => {
                      const isServiceEditing = editingKey === `li-${item.id}-service`;

                      return (
                        <div
                          key={item.id}
                          className="relative grid gap-3 items-start text-[11px] group"
                          style={{ gridTemplateColumns: lineItemGridTemplate }}
                        >
                          {editingKey === `li-${item.id}-date` ? (
                            <input
                              autoFocus
                              type="date"
                              className="w-full font-medium text-dark border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand"
                              value={item.date}
                              onChange={(e) =>
                                updateLineItem?.(item.id, "date", e.target.value)
                              }
                              onBlur={() => {
                                finalizeLineItemDate?.(item.id);
                                setEditingKey(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") {
                                  e.currentTarget.blur();
                                }
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              className="font-medium text-dark text-left rounded hover:bg-gray-100 transition-colors"
                              onClick={() => setEditingKey(`li-${item.id}-date`)}
                            >
                              {item.date || "—"}
                            </button>
                          )}

                          {isServiceEditing ? (
                            <div className="relative min-w-0">
                              <textarea
                                autoFocus
                                rows={Math.max(2, (item.service.match(/\n/g)?.length ?? 0) + 1)}
                                className="w-full text-muted rounded px-1 py-0.5 outline-none min-w-0 leading-[1.35] resize-y border border-gray-200 bg-white focus:border-brand"
                                value={item.service}
                                onChange={(e) =>
                                  updateLineItem?.(item.id, "service", e.target.value)
                                }
                                onBlur={() => setEditingKey(null)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    setEditingKey(null);
                                  }
                                }}
                              />
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="w-full text-muted text-left rounded hover:bg-gray-100 transition-colors min-w-0 whitespace-pre-wrap break-words leading-[1.35]"
                              onClick={() => {
                                setEditingKey(`li-${item.id}-service`);
                              }}
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
                              className="justify-self-end w-auto min-w-0 text-right text-dark border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                width: `${Math.max(
                                  4,
                                  String(item.hours || "").length || 0
                                ) + 1}ch`,
                              }}
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
                              className="justify-self-end inline-flex text-right text-dark rounded hover:bg-gray-100 transition-colors"
                              onClick={() => setEditingKey(`li-${item.id}-hours`)}
                            >
                              {item.hours ? formatHours(item.hours) : "—"}
                            </button>
                          )}

                          {removeLineItem && visibleItems.length > 1 && (
                            <button
                              type="button"
                              className="absolute -right-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-gray-400 hover:text-red-500 transition-opacity"
                              onClick={() => removeLineItem(item.id)}
                              title="Remove row"
                            >
                              x
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {addLineItem && isLastPage && (
                      <button
                        type="button"
                        className="grid gap-3 items-center text-[11px] rounded hover:bg-gray-100 transition-colors text-left"
                        style={{ gridTemplateColumns: lineItemGridTemplate }}
                        onClick={addLineItem}
                      >
                        <span className="text-brand font-medium">+ Add</span>
                        <span aria-hidden="true" />
                        <span aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {!isLastPage && (
                    <div className="px-5 pt-4 text-[10px] uppercase tracking-[0.03em] text-[#75827a]">
                      Continued on next page
                    </div>
                  )}
                </div>

                {isLastPage && (
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
                )}
              </div>

              {isLastPage && (
                <div className="mt-auto flex flex-col gap-3 pt-3 px-5 overflow-hidden">
                  <div className="flex w-full items-start justify-between">
                    <div className="w-[200px] shrink-0 flex flex-col gap-2">
                      <div className="flex items-start gap-2 mb-4">
                        {companyLogoUrl && (
                          <img
                            src={companyLogoUrl}
                            alt=""
                            className="w-[34px] h-[34px] rounded-[4px] object-cover border border-[#d7e0d5] bg-white"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        )}
                        <div className="text-[14px] font-bold text-dark leading-[1.2]">
                          {(companyNameLines.length > 0
                            ? companyNameLines
                            : [companySettings.companyName]
                          ).map((line, idx) => (
                            <div key={`${line}-${idx}`}>{line}</div>
                          ))}
                        </div>
                      </div>
                      <div className="text-[10px] text-dark">
                        {companySettings.companyAddress
                          .split("\n")
                          .filter((line) => line.trim())
                          .map((line, idx) => (
                            <div key={`${line}-${idx}`}>{line}</div>
                          ))}
                      </div>
                      <span className="text-[10px] text-link">
                        {companySettings.contactEmail}
                      </span>
                      <div className="flex flex-col gap-0.5 text-[10px]">
                        <span className="text-muted">EIN</span>
                        <span className="text-dark">{companySettings.ein}</span>
                      </div>
                    </div>

                    <div className="w-[260px] shrink-0 flex flex-col gap-2">
                      <span className="text-[12px] font-semibold text-dark">
                        Payment Instructions
                      </span>
                      <p className="text-[10px] text-muted m-0">
                        {companySettings.guidanceLanguage}
                      </p>
                      <div className="flex gap-9 text-[10px]">
                        <div className="flex flex-col gap-0.5 w-[110px]">
                          <span className="text-muted">Routing number</span>
                          <span className="font-medium text-dark">
                            {companySettings.routingNumber}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted">Account number</span>
                          <span className="font-medium text-dark">
                            {companySettings.accountNumber}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-9 text-[10px]">
                        <div className="flex flex-col gap-0.5 w-[110px]">
                          <span className="text-muted">Receiving bank</span>
                          <span className="text-dark">{companySettings.receivingBank}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-muted">Bank address</span>
                          <div className="text-dark">
                            {companySettings.bankAddress
                              .split("\n")
                              .filter((line) => line.trim())
                              .map((line, idx) => (
                                <div key={`${line}-${idx}`}>{line}</div>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
