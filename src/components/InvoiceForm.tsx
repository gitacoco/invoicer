import { useState } from "react";
import type { InvoiceData, SavedInvoice, Client } from "../types";
import { ClientPicker } from "./ClientSelector";
import type { AggregatedEntry } from "../hooks/useToggl";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface Props {
  invoice: InvoiceData;
  client: Client | null;
  clients: Client[];
  updateField: <K extends keyof InvoiceData>(
    field: K,
    value: InvoiceData[K]
  ) => void;
  onSelectClient: (client: Client) => void;
  onOpenCreateClient: () => void;
  onOpenEditClient: (client: Client) => void;
  onMonthSelect: (startMonth: string, endMonth?: string) => void;
  savedInvoices: SavedInvoice[];
  onLoad: (data: InvoiceData) => void;
  onDelete: (key: string) => void;
  // Toggl integration
  togglConfigEnabled: boolean;
  togglEnabled: boolean;
  togglFetching: boolean;
  togglHasFetched: boolean;
  togglPending: AggregatedEntry[];
  togglError?: string | null;
  togglTokenValid: boolean | null;
  togglValidating: boolean;
  importedTogglKeys: Set<string>;
  onTogglToggle: () => void;
  onTogglSync: () => void;
  onTogglImportEntry: (entryKey: string) => void;
  onTogglImportAll: () => void;
  onOpenTogglSettings: () => void;
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
        className="border border-[#d7e0d5] rounded-lg px-3 py-2 text-[13px] outline-none focus:border-brand focus:ring-0 transition-colors bg-white"
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
              className={`border rounded-[2px] py-1.5 text-[11px] font-medium transition-colors ${
                isBoundary
                  ? "bg-[#2f5168] border-[#2f5168] text-white"
                  : isWithinRange
                    ? "bg-[#e7eef0] border-[#d2dde3] text-[#2e3f47]"
                  : "bg-[#f8fbf7] border-[#dde7dd] text-[#68756e] hover:bg-[#eef4ee]"
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
  client,
  clients,
  updateField,
  onSelectClient,
  onOpenCreateClient,
  onOpenEditClient,
  onMonthSelect,
  savedInvoices,
  onLoad,
  onDelete,
  togglConfigEnabled,
  togglEnabled,
  togglFetching,
  togglHasFetched,
  togglPending,
  togglError,
  togglTokenValid,
  togglValidating,
  importedTogglKeys,
  onTogglToggle,
  onTogglSync,
  onTogglImportEntry,
  onTogglImportAll,
  onOpenTogglSettings,
}: Props) {
  const unimportedCount = togglPending.filter(
    (entry) => !importedTogglKeys.has(entry.key)
  ).length;
  const connectionLabel = !togglConfigEnabled
    ? "Disabled"
    : togglValidating
      ? "Checking..."
      : togglTokenValid === true
        ? "Connected"
        : togglTokenValid === false
          ? "Invalid Token"
          : "Not Connected";
  const connectionTone = !togglConfigEnabled
    ? "bg-[#eff3ef] text-[#738077]"
    : togglValidating
      ? "bg-[#f3efe3] text-[#8a6a2b]"
      : togglTokenValid === true
        ? "bg-[#e8f0ea] text-[#2f6a4b]"
      : togglTokenValid === false
          ? "bg-[#f5e8e6] text-[#8a2d2d]"
          : "bg-[#eff3ef] text-[#738077]";
  const infoMessage = !togglConfigEnabled
    ? "Enable Toggl Track to fetch entries."
    : togglConfigEnabled && togglTokenValid !== true && !togglValidating
      ? "Open settings to connect your Toggl API token."
      : togglEnabled && togglHasFetched && togglPending.length === 0 && !togglFetching
        ? "No entries found in this service period."
        : null;

  return (
    <div className="flex flex-col gap-5 p-5 h-full overflow-y-auto bg-[#f8faf6]">
      <h2
        className="text-[18px] font-semibold text-[#1f2f28]"
        style={{ fontFamily: "var(--font-editorial)" }}
      >
        Invoice Builder
      </h2>

      {/* Client picker */}
      <ClientPicker
        clients={clients}
        selectedClient={client}
        onSelect={onSelectClient}
        onOpenCreate={onOpenCreateClient}
        onOpenEdit={onOpenEditClient}
      />

      {/* Service period */}
      <CollapsibleSection label="Service Period">
        <MonthGrid
          selectedStartMonth={invoice.serviceMonth}
          selectedEndMonth={invoice.serviceMonthEnd}
          onSelect={onMonthSelect}
        />
      </CollapsibleSection>

      {/* Saved invoices */}
      {savedInvoices.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Saved Invoices</SectionLabel>
          <div className="flex flex-col border border-[#dce4da] bg-white/90 rounded-xl overflow-hidden">
            {savedInvoices.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between border-b border-[#e8efe6] last:border-b-0 px-3 py-2 text-[12px]"
              >
                <button
                  className="text-left text-[#24332c] hover:text-brand transition-colors flex-1 truncate"
                  onClick={() => onLoad(s.data)}
                >
                  {s.label}
                </button>
                <button
                  className="text-[#7e8a83] hover:text-[#8a2d2d] ml-2 text-[11px] transition-colors"
                  onClick={() => onDelete(s.key)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${connectionTone}`}>
              {connectionLabel}
            </span>
            <button
              type="button"
              className="ml-auto h-6 w-6 inline-flex items-center justify-center rounded-md border border-[#d7e0d5] text-[#7b8a82] hover:text-[#2f5168] hover:bg-[#eef4ee] transition-colors"
              onClick={onOpenTogglSettings}
              title="Toggl settings"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.5 1.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.3a5.52 5.52 0 0 1 1.63.67l.21-.21a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1 0 1.06l-.21.21c.28.5.5 1.05.67 1.63h.3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-.3a5.52 5.52 0 0 1-.67 1.63l.21.21a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0l-.21-.21a5.52 5.52 0 0 1-1.63.67v.3a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-.3a5.52 5.52 0 0 1-1.63-.67l-.21.21a.75.75 0 0 1-1.06 0L2.54 12.4a.75.75 0 0 1 0-1.06l.21-.21a5.52 5.52 0 0 1-.67-1.63h-.3a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 .75-.75h.3c.17-.58.39-1.13.67-1.63l-.21-.21a.75.75 0 0 1 0-1.06L3.6 2.54a.75.75 0 0 1 1.06 0l.21.21A5.52 5.52 0 0 1 6.5 2.08v-.33ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="currentColor"/>
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="h-7 px-2 rounded-lg border border-[#d7e0d5] bg-[#f4f8f4] text-[#2f5168] text-[10px] font-medium hover:bg-[#e9f0e9] transition-colors disabled:bg-[#eff3ef] disabled:border-[#e1e8e1] disabled:text-[#95a29a] disabled:cursor-not-allowed"
              disabled={!togglEnabled || togglFetching}
              onClick={onTogglSync}
            >
              {togglFetching ? "Syncing..." : "Sync"}
            </button>
            <button
              type="button"
              className="h-7 px-2 rounded-lg bg-[#2f5168] text-white text-[10px] font-medium hover:bg-[#233e50] transition-colors disabled:bg-[#b8c3ba] disabled:cursor-not-allowed"
              disabled={!togglEnabled || togglFetching || unimportedCount === 0}
              onClick={onTogglImportAll}
            >
              Import all
            </button>
            <span className="ml-auto text-[10px] text-[#6f7f75]">
              {togglPending.length} fetched / {unimportedCount} pending
            </span>
          </div>

          {togglError && (
            <div className="text-[10px] text-red-700 bg-[#f5e8e6] border border-[#e7c2bf] rounded-md px-2 py-0.5">
              {togglError}
            </div>
          )}

          {infoMessage && (
            <div className="text-[10px] text-[#6e7d74] bg-[#f2f6f1] border border-[#dde7dd] rounded-md px-2 py-0.5">
              {infoMessage}
            </div>
          )}
        </div>

        {togglEnabled && togglPending.length > 0 && (
          <div className="flex flex-col gap-2">
            {togglPending.map((entry) => {
              const imported = importedTogglKeys.has(entry.key);
              return (
                <div
                  key={entry.key}
                  className="bg-white/90 border border-[#dde7dd] rounded-lg px-3 py-2 grid grid-cols-[96px_minmax(0,1fr)_56px_auto] items-center gap-2"
                >
                  <div className="text-[11px] text-dark font-medium">
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

                  {imported ? (
                    <span className="text-[10px] px-2 py-1 bg-[#eef3ef] text-[#5e6c63] border border-[#d8e1d8] rounded-md justify-self-end whitespace-nowrap">
                      Imported
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="text-[10px] px-2 py-1 bg-[#2f5168] text-white rounded-md hover:bg-[#233e50] transition-colors justify-self-end whitespace-nowrap"
                      onClick={() => onTogglImportEntry(entry.key)}
                    >
                      Import
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
