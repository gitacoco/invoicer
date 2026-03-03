import { useState } from "react";
import type { InvoiceData, TogglClient } from "../types";
import type { AggregatedEntry } from "../hooks/useToggl";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  invoice: InvoiceData;
  updateField: <K extends keyof InvoiceData>(
    field: K,
    value: InvoiceData[K]
  ) => void;
  onMonthSelect: (startMonth: string, endMonth?: string) => void;
  // Toggl integration
  togglConfigEnabled: boolean;
  togglFetching: boolean;
  togglClients: TogglClient[];
  selectedTogglClientId?: number;
  togglPending: AggregatedEntry[];
  togglError?: string | null;
  importedTogglKeys: Set<string>;
  onTogglToggle: () => void;
  onTogglClientChange: (togglClientId?: number) => void;
  onTogglSync: () => void;
  onTogglImportEntry: (entryKey: string) => void;
  onTogglImportAll: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f7a73] mb-1">
      {children}
    </h3>
  );
}

function CollapsibleSection({
  label,
  children,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6f7a73] hover:text-[#23352d] transition-colors"
        onClick={() => setOpen(!open)}
      >
        {label}
        <span
          className={`text-[9px] transition-transform ${open ? "rotate-90" : ""}`}
        >
          &#9654;
        </span>
      </button>
      {open && <div className="flex flex-col gap-3">{children}</div>}
    </div>
  );
}

function Input({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-gray-500">{label}</span>
      <input
        className="h-8 border border-[#d7e0d5] rounded-lg px-3 text-[13px] outline-none focus:border-brand focus:ring-0 transition-colors bg-white"
        {...props}
      />
    </label>
  );
}

function MonthGrid({
  selectedStartMonth,
  selectedEndMonth,
  onSelect,
}: {
  selectedStartMonth: string;
  selectedEndMonth?: string;
  onSelect: (startMonth: string, endMonth?: string) => void;
}) {
  const [selYear] = selectedStartMonth.split("-").map(Number);
  const [displayYear, setDisplayYear] = useState(selYear || new Date().getFullYear());

  return (
    <div className="flex flex-col gap-1.5 border border-[#dce4da] bg-white/80 rounded-xl p-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-[#7f8d85] hover:text-[#2f5168] transition-colors px-1 text-sm"
          onClick={() => setDisplayYear((y) => y - 1)}
        >
          &#8249;
        </button>
        <span className="text-[12px] font-semibold text-[#1f2e28]">{displayYear}</span>
        <button
          type="button"
          className="text-[#7f8d85] hover:text-[#2f5168] transition-colors px-1 text-sm"
          onClick={() => setDisplayYear((y) => y + 1)}
        >
          &#8250;
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {MONTH_LABELS.map((name, i) => {
          const monthNum = i + 1;
          const monthStr = `${displayYear}-${String(monthNum).padStart(2, "0")}`;
          const rangeStart = selectedStartMonth;
          const rangeEnd = selectedEndMonth || selectedStartMonth;
          const isWithinRange = monthStr >= rangeStart && monthStr <= rangeEnd;
          const isBoundary =
            monthStr === rangeStart || monthStr === rangeEnd;

          const handleSelect = () => {
            const hasRange = Boolean(selectedEndMonth && selectedEndMonth !== selectedStartMonth);
            if (!hasRange) {
              if (monthStr < selectedStartMonth) {
                onSelect(monthStr, selectedStartMonth);
                return;
              }
              if (monthStr > selectedStartMonth) {
                onSelect(selectedStartMonth, monthStr);
                return;
              }
              onSelect(monthStr);
              return;
            }

            if (monthStr < rangeStart) {
              onSelect(monthStr, rangeEnd);
              return;
            }
            if (monthStr > rangeEnd) {
              onSelect(rangeStart, monthStr);
              return;
            }
            // Clicking inside the current range resets to a single month.
            onSelect(monthStr);
          };

          return (
            <button
              key={i}
              type="button"
              className={`rounded-[6px] py-1.5 text-[11px] font-medium transition-colors ${
                isBoundary
                  ? "bg-[#2f5168] text-white"
                  : isWithinRange
                    ? "bg-[#e7eef0] text-[#2e3f47]"
                  : "bg-[#f8fbf7] text-[#4f5d55] hover:bg-[#eef4ee]"
              }`}
              onClick={handleSelect}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function InvoiceForm({
  invoice,
  updateField,
  onMonthSelect,
  togglConfigEnabled,
  togglFetching,
  togglClients,
  selectedTogglClientId,
  togglPending,
  togglError,
  importedTogglKeys,
  onTogglToggle,
  onTogglClientChange,
  onTogglSync,
  onTogglImportEntry,
  onTogglImportAll,
}: Props) {
  const unimportedCount = togglPending.filter(
    (entry) => !importedTogglKeys.has(entry.key)
  ).length;
  const clientFilterDisabled =
    !togglConfigEnabled || togglFetching || togglClients.length === 0;

  return (
    <div className="flex flex-col gap-5 p-5 h-full overflow-y-auto bg-[#f8faf6]">
      {/* Service period */}
      <CollapsibleSection label="Service Period">
        <MonthGrid
          selectedStartMonth={invoice.serviceMonth}
          selectedEndMonth={invoice.serviceMonthEnd}
          onSelect={onMonthSelect}
        />
      </CollapsibleSection>

      {/* Invoice details (collapsible) */}
      <CollapsibleSection label="Invoice Details">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Invoice Number"
            value={invoice.invoiceNumber}
            onChange={(e) => updateField("invoiceNumber", e.target.value)}
            placeholder="INV-202601"
          />
          <Input
            label="Issued Date"
            type="date"
            value={invoice.issuedDate}
            onChange={(e) => updateField("issuedDate", e.target.value)}
          />
        </div>
      </CollapsibleSection>

      {/* Toggl entries */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Toggl Entries</SectionLabel>

        <div className="border border-[#dce4da] bg-white/90 rounded-xl px-2.5 py-2 flex flex-col gap-1.5 shadow-[0_6px_14px_rgba(15,23,42,0.04)]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={togglConfigEnabled}
              onClick={onTogglToggle}
              className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
                togglConfigEnabled ? "bg-[#2f5168]" : "bg-[#c8d3c9]"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                  togglConfigEnabled ? "translate-x-[13px]" : "translate-x-0.5"
                }`}
              />
            </button>
            <span className="text-[11px] font-medium text-[#23352d]">Toggl Track</span>
            <div
              className={`ml-1 h-6 min-w-0 flex-1 inline-flex items-stretch rounded-md border overflow-hidden ${
                clientFilterDisabled
                  ? "border-[#e1e8e1] bg-[#eff3ef]"
                  : "border-[#d7e0d5] bg-[#f8fbf8]"
              }`}
            >
              <span className="pointer-events-none select-none inline-flex items-center px-2 text-[10px] text-[#6f7f75] border-r border-[#d7e0d5] bg-[#eef3ef]">
                Client
              </span>
              <select
                className="h-full min-w-0 flex-1 bg-transparent px-2 text-[11px] text-[#2f5168] outline-none disabled:text-[#95a29a]"
                value={
                  selectedTogglClientId == null ? "" : String(selectedTogglClientId)
                }
                onChange={(e) => {
                  const value = e.target.value;
                  onTogglClientChange(value ? Number(value) : undefined);
                }}
                disabled={clientFilterDisabled}
                aria-label="Filter by Toggl client"
                title="Filter by Toggl client before syncing"
              >
                <option value="">
                  {togglClients.length === 0 ? "No Toggl clients" : "All clients"}
                </option>
                {togglClients.map((client) => (
                  <option key={client.id} value={String(client.id)}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-[#d7e0d5] text-[#7b8a82] hover:text-[#2f5168] hover:bg-[#eef4ee] transition-colors disabled:bg-[#eff3ef] disabled:text-[#95a29a] disabled:border-[#e1e8e1] disabled:cursor-not-allowed"
              disabled={!togglConfigEnabled || togglFetching}
              onClick={onTogglSync}
              title={togglFetching ? "Syncing..." : "Sync from Toggl"}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.5 8a5.5 5.5 0 1 1-1.68-3.96" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M13.5 3.5v3h-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {togglConfigEnabled && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-[#6f7f75]">
                {togglPending.length} fetched / {unimportedCount} pending
              </span>
              <button
                type="button"
                className="h-6 px-2 rounded-md bg-transparent text-[#2f5168] text-[10px] font-medium hover:bg-[#e6eeea] transition-colors disabled:text-[#95a29a] disabled:bg-transparent disabled:cursor-not-allowed"
                disabled={!togglConfigEnabled || togglFetching || unimportedCount === 0}
                onClick={onTogglImportAll}
              >
                Import all
              </button>
            </div>
          )}

          {togglError && (
            <div className="text-[10px] text-red-700 bg-[#f5e8e6] border border-[#e7c2bf] rounded-md px-2 py-0.5">
              {togglError}
            </div>
          )}
        </div>

        {togglConfigEnabled && togglPending.length > 0 && (
          <div className="border border-[#dde7dd] rounded-lg overflow-hidden bg-white/90">
            {togglPending.map((entry) => {
              const imported = importedTogglKeys.has(entry.key);
              return (
                <div
                  key={entry.key}
                  className="flex items-stretch border-b border-[#e1e9e1] last:border-b-0"
                >
                  <div className="min-w-0 flex-1 grid grid-cols-[90px_minmax(0,1fr)_54px] items-center gap-1.5 px-3 py-2">
                    <div className="text-[11px] text-[#1f2e28] font-medium">
                      {entry.date}
                    </div>

                    <div
                      className="text-[11px] text-gray-600 truncate"
                      title={entry.descriptions.join(", ") || "No description"}
                    >
                      {entry.descriptions.join(", ") || "No description"}
                    </div>

                    <div className="text-[11px] text-gray-500 text-right">
                      {entry.hours.toFixed(2)}h
                    </div>
                  </div>

                  <div className="shrink-0 w-fit border-l border-[#dfe8de] px-2 py-2 flex items-center justify-center">
                    {imported ? (
                      <span className="inline-flex h-6 w-[9ch] items-center justify-center text-[10px] bg-[#eef3ef] text-[#5e6c63] border border-[#d8e1d8] rounded-md whitespace-nowrap">
                        Imported
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex h-6 w-[9ch] items-center justify-center text-[10px] bg-[#2f5168] text-white rounded-md hover:bg-[#233e50] transition-colors whitespace-nowrap"
                        onClick={() => onTogglImportEntry(entry.key)}
                      >
                        Import
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
