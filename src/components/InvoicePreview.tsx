import { useEffect, useRef, useState } from "react";
import type { InvoiceData, Client, LineItem, CompanySettings } from "../types";
import {
  fetchAiConfig,
  rewriteServiceText,
  saveAiConfig,
} from "../hooks/useAiRewrite";
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
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error) return /abort/i.test(error.message);
  return false;
}

function EyeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6A3 3 0 0 0 12 15a3 3 0 0 0 2.4-4.4" />
      <path d="M9.9 5.1A10.7 10.7 0 0 1 12 5c7 0 11 7 11 7a21.8 21.8 0 0 1-5.2 5.9" />
      <path d="M6.2 6.2A21.6 21.6 0 0 0 1 12s4 7 11 7a10.9 10.9 0 0 0 2.1-.2" />
    </svg>
  );
}

function StopIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RetryIcon({ className = "h-2.5 w-2.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 3v6h-6" />
      <path d="M20.5 14a8 8 0 1 1-2.2-8.5L21 9" />
    </svg>
  );
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
}: Props) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [aiConfigLoaded, setAiConfigLoaded] = useState(false);
  const [aiHasApiKey, setAiHasApiKey] = useState(false);
  const [aiConfigLoading, setAiConfigLoading] = useState(false);
  const [aiKeyDraft, setAiKeyDraft] = useState("");
  const [aiSavingKey, setAiSavingKey] = useState(false);
  const [aiRewritingItemId, setAiRewritingItemId] = useState<string | null>(
    null
  );
  const [aiSuggestion, setAiSuggestion] = useState<{
    itemId: string;
    text: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiKeyForItemId, setShowAiKeyForItemId] = useState<string | null>(
    null
  );
  const [showInlineAiKey, setShowInlineAiKey] = useState(false);
  const rewriteAbortRef = useRef<AbortController | null>(null);

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
  const companyNameLines = companySettings.companyName
    .replace(/Example Studio(?!\n)/, "Example Studio\n")
    .split("\n")
    .filter((line) => line.trim());
  const clientLogoUrl = resolveAssetUrl(client.logoDataUrl);
  const companyLogoUrl = resolveAssetUrl(companySettings.companyLogoDataUrl);

  useEffect(() => {
    return () => {
      rewriteAbortRef.current?.abort();
      rewriteAbortRef.current = null;
    };
  }, []);

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

  const loadAiConfigIfNeeded = async (): Promise<boolean> => {
    if (aiConfigLoaded) return aiHasApiKey;
    setAiConfigLoading(true);
    try {
      const config = await fetchAiConfig();
      setAiConfigLoaded(true);
      setAiHasApiKey(config.hasApiKey);
      return config.hasApiKey;
    } catch (error) {
      setAiError(getErrorMessage(error, "Failed to load AI settings."));
      return false;
    } finally {
      setAiConfigLoading(false);
    }
  };

  const handleAiRewrite = async (item: LineItem) => {
    if (aiRewritingItemId === item.id) {
      rewriteAbortRef.current?.abort();
      return;
    }

    const source = item.service.trim();
    if (!source) {
      setAiError("Please enter service text before rewriting.");
      return;
    }
    setAiSuggestion(null);
    setAiError(null);
    const hasApiKey = await loadAiConfigIfNeeded();
    if (!hasApiKey) {
      setShowInlineAiKey(false);
      setShowAiKeyForItemId(item.id);
      setAiError("Enter your MiniMax API key once to enable rewrite.");
      return;
    }
    setShowAiKeyForItemId(null);
    rewriteAbortRef.current?.abort();
    const controller = new AbortController();
    rewriteAbortRef.current = controller;
    setAiRewritingItemId(item.id);
    try {
      const rewritten = await rewriteServiceText(source, {
        signal: controller.signal,
      });
      setAiSuggestion({ itemId: item.id, text: rewritten });
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setAiError(getErrorMessage(error, "AI rewrite failed."));
    } finally {
      if (rewriteAbortRef.current === controller) {
        rewriteAbortRef.current = null;
      }
      setAiRewritingItemId((prev) => (prev === item.id ? null : prev));
    }
  };

  const handleSaveAiKey = async (item: LineItem) => {
    const apiKey = aiKeyDraft.trim();
    let controller: AbortController | null = null;
    if (!apiKey) {
      setAiError("API key cannot be empty.");
      return;
    }
    setAiSavingKey(true);
    setAiError(null);
    try {
      await saveAiConfig(apiKey);
      setAiConfigLoaded(true);
      setAiHasApiKey(true);
      setAiKeyDraft("");
      setShowAiKeyForItemId(null);
      const source = item.service.trim();
      if (!source) return;
      rewriteAbortRef.current?.abort();
      controller = new AbortController();
      rewriteAbortRef.current = controller;
      setAiRewritingItemId(item.id);
      const rewritten = await rewriteServiceText(source, {
        signal: controller.signal,
      });
      setAiSuggestion({ itemId: item.id, text: rewritten });
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }
      setAiError(getErrorMessage(error, "AI rewrite failed."));
    } finally {
      if (controller && rewriteAbortRef.current === controller) {
        rewriteAbortRef.current = null;
      }
      setAiRewritingItemId(null);
      setAiSavingKey(false);
    }
  };

  const clearAiUi = () => {
    setShowAiKeyForItemId(null);
    setShowInlineAiKey(false);
    setAiSuggestion(null);
    setAiError(null);
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
          <div className="grid grid-cols-[80px_minmax(0,1fr)_56px] gap-3 px-5 pt-2 text-[10px] text-muted items-center">
            <span>Date</span>
            <span>Service</span>
            <span className="text-right">Hours</span>
          </div>

          {/* Line items */}
          <div className="flex flex-col gap-[5px] px-5 pt-2">
            {visibleItems.map((item) => {
              const isServiceEditing = editingKey === `li-${item.id}-service`;
              const isRewriting = aiRewritingItemId === item.id;
              const showApiKeyPrompt = showAiKeyForItemId === item.id;
              const suggestionForItem =
                aiSuggestion?.itemId === item.id ? aiSuggestion.text : null;
              const hasAiPanel = Boolean(
                showApiKeyPrompt || suggestionForItem || aiError
              );

              return (
                <div
                  key={item.id}
                  className="relative grid grid-cols-[80px_minmax(0,1fr)_56px] gap-3 items-start text-[11px] group"
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
                      className="font-medium text-dark text-left rounded hover:bg-gray-100 transition-colors"
                      onClick={() => setEditingKey(`li-${item.id}-date`)}
                    >
                      {item.date || "—"}
                    </button>
                  )}

                  {isServiceEditing ? (
                    <div className="relative min-w-0" data-ai-editor={item.id}>
                      <input
                        autoFocus
                        className={`w-full text-muted rounded px-1 py-0.5 outline-none min-w-0 ${
                          isRewriting
                            ? "ai-rewrite-input--rewriting"
                            : "border border-gray-200 bg-white focus:border-brand"
                        }`}
                        value={item.service}
                        onChange={(e) =>
                          updateLineItem?.(item.id, "service", e.target.value)
                        }
                        onBlur={() => {
                          window.requestAnimationFrame(() => {
                            const active = document.activeElement as HTMLElement | null;
                            if (active?.closest(`[data-ai-editor=\"${item.id}\"]`)) {
                              return;
                            }
                            setEditingKey(null);
                            clearAiUi();
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setEditingKey(null);
                            clearAiUi();
                          }
                        }}
                      />
                      {!hasAiPanel && (
                        <div className="absolute left-0 top-full mt-1 z-10">
                          <button
                            type="button"
                            className="h-6 px-2 border border-[#cfd7cc] rounded-md text-[10px] font-medium text-[#2f5168] bg-white hover:bg-[#eef3ec] transition-colors inline-flex items-center gap-1"
                            onClick={() => {
                              void handleAiRewrite(item);
                            }}
                            disabled={!isRewriting && (aiSavingKey || aiConfigLoading)}
                          >
                            {isRewriting ? (
                              <>
                                <StopIcon className="h-2.5 w-2.5" />
                                Rewriting
                              </>
                            ) : aiConfigLoading ? (
                              "Loading..."
                            ) : (
                              "AI Rewrite"
                            )}
                          </button>
                        </div>
                      )}

                      {hasAiPanel && (
                        <div className="absolute left-0 right-0 top-full mt-1 z-20 border border-[#dbe3d8] bg-white/92 backdrop-blur-[2px] rounded-md p-2 shadow-[0_12px_28px_rgba(20,35,30,0.18),0_3px_10px_rgba(20,35,30,0.1)]">
                          {showApiKeyPrompt && (
                            <div className="flex flex-col gap-2">
                              <div className="text-[10px] text-[#5d6761]">
                                Enter MiniMax API key (saved locally on this
                                machine).
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type={showInlineAiKey ? "text" : "password"}
                                  className="flex-1 border border-gray-200 rounded px-1.5 py-1 text-[10px] outline-none focus:border-brand"
                                  value={aiKeyDraft}
                                  onChange={(e) => setAiKeyDraft(e.target.value)}
                                  placeholder="sk-..."
                                />
                                <button
                                  type="button"
                                  className="h-7 w-7 inline-flex items-center justify-center border border-[#cfd7cc] rounded-md text-[#5d6761] bg-white hover:bg-[#eef3ec] transition-colors"
                                  onClick={() => setShowInlineAiKey((prev) => !prev)}
                                  aria-label={showInlineAiKey ? "Hide API key" : "Show API key"}
                                  title={showInlineAiKey ? "Hide API key" : "Show API key"}
                                >
                                  {showInlineAiKey ? <EyeOffIcon /> : <EyeIcon />}
                                </button>
                                <button
                                  type="button"
                                  className="h-7 px-2 border border-[#cfd7cc] rounded-md text-[10px] font-medium text-[#2f5168] bg-white hover:bg-[#eef3ec] transition-colors disabled:opacity-60"
                                  onClick={() => {
                                    void handleSaveAiKey(item);
                                  }}
                                  disabled={aiSavingKey}
                                >
                                  {aiSavingKey ? "Saving..." : "Save key"}
                                </button>
                              </div>
                            </div>
                          )}

                          {suggestionForItem && (
                            <div className="flex flex-col gap-2">
                              <div className="text-[12px] text-[#1f2a27]">
                                {suggestionForItem}
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  className="h-6 px-2 border border-[#cfd7cc] rounded-md text-[10px] text-[#5d6761] hover:bg-[#f2f5f1] transition-colors"
                                  onClick={() => {
                                    setAiSuggestion(null);
                                    setAiError(null);
                                  }}
                                >
                                  Cancel
                                </button>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="h-6 px-2 border border-[#cfd7cc] rounded-md text-[10px] text-[#5d6761] hover:bg-[#f2f5f1] transition-colors disabled:opacity-60 inline-flex items-center gap-1"
                                    onClick={() => {
                                      void handleAiRewrite(item);
                                    }}
                                    disabled={isRewriting || aiSavingKey || aiConfigLoading}
                                  >
                                    <RetryIcon />
                                    {isRewriting ? "Trying..." : "Try again"}
                                  </button>
                                  <button
                                    type="button"
                                    className="h-6 px-2 rounded-md text-[10px] font-medium bg-[#2f5168] text-white hover:bg-[#233e50] transition-colors"
                                    onClick={() => {
                                      updateLineItem?.(
                                        item.id,
                                        "service",
                                        suggestionForItem
                                      );
                                      setAiSuggestion(null);
                                    }}
                                  >
                                    Replace
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {aiError && (
                            <div className="text-[12px] text-[#a22f2f] mt-2">
                              {aiError}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="text-muted text-left rounded hover:bg-gray-100 transition-colors min-w-0 truncate"
                      onClick={() => {
                        setEditingKey(`li-${item.id}-service`);
                        clearAiUi();
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
                      className="w-full text-right text-dark border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-brand"
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
                      className="text-right text-dark rounded hover:bg-gray-100 transition-colors"
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

            {addLineItem && (
              <button
                type="button"
                className="grid grid-cols-[80px_minmax(0,1fr)_56px] gap-3 items-center text-[11px] rounded hover:bg-gray-100 transition-colors text-left"
                onClick={addLineItem}
              >
                <span className="text-brand font-medium">+ Add</span>
                <span aria-hidden="true" />
                <span aria-hidden="true" />
              </button>
            )}
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
        <div className="flex w-full items-start justify-between">
          {/* Company details */}
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
            <span className="text-[10px] text-link">{companySettings.contactEmail}</span>
            <div className="flex flex-col gap-0.5 text-[10px]">
              <span className="text-muted">EIN</span>
              <span className="text-dark">{companySettings.ein}</span>
            </div>
          </div>

          {/* Payment instructions */}
          <div className="w-[260px] shrink-0 flex flex-col gap-2">
            <span className="text-[12px] font-semibold text-dark">
              Payment Instructions
            </span>
            <p className="text-[10px] text-muted m-0">{companySettings.guidanceLanguage}</p>
            <div className="flex gap-9 text-[10px]">
              <div className="flex flex-col gap-0.5 w-[110px]">
                <span className="text-muted">Routing number</span>
                <span className="font-medium text-dark">{companySettings.routingNumber}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-muted">Account number</span>
                <span className="font-medium text-dark">{companySettings.accountNumber}</span>
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
    </div>
  );
}
