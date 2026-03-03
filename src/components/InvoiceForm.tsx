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
    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
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
        className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-600 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span
          className={`text-[9px] transition-transform ${open ? "rotate-90" : ""}`}
        >
          &#9654;
        </span>
        {label}
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
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors"
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
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="text-gray-400 hover:text-dark transition-colors px-1 text-sm"
          onClick={() => setDisplayYear((y) => y - 1)}
        >
          &#8249;
        </button>
        <span className="text-[12px] font-semibold text-dark">{displayYear}</span>
        <button
          type="button"
          className="text-gray-400 hover:text-dark transition-colors px-1 text-sm"
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
              className={`rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                isBoundary
                  ? "bg-brand text-white"
                  : isWithinRange
                    ? "bg-brand/15 text-dark"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
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

  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-dark">Invoice Builder</h2>

      {/* Client picker */}
      <ClientPicker
        clients={clients}
        selectedClient={client}
        onSelect={onSelectClient}
        onOpenCreate={onOpenCreateClient}
        onOpenEdit={onOpenEditClient}
      />

      {/* Month grid navigation */}
      <MonthGrid
        selectedStartMonth={invoice.serviceMonth}
        selectedEndMonth={invoice.serviceMonthEnd}
        onSelect={onMonthSelect}
      />

      {/* Saved invoices */}
      {savedInvoices.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Saved Invoices</SectionLabel>
          <div className="flex flex-col gap-1">
            {savedInvoices.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm"
              >
                <button
                  className="text-left text-dark hover:text-brand transition-colors flex-1 truncate"
                  onClick={() => onLoad(s.data)}
                >
                  {s.label}
                </button>
                <button
                  className="text-gray-400 hover:text-red-500 ml-2 text-xs transition-colors"
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={togglConfigEnabled}
            onClick={onTogglToggle}
            className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors ${
              togglConfigEnabled ? "bg-purple-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow-sm transform transition-transform mt-0.5 ${
                togglConfigEnabled ? "translate-x-[13px]" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-[11px] text-gray-600">Toggl Track</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              !togglConfigEnabled
                ? "bg-gray-100 text-gray-500"
                : togglValidating
                  ? "bg-amber-100 text-amber-700"
                  : togglTokenValid === true
                    ? "bg-green-100 text-green-700"
                    : togglTokenValid === false
                      ? "bg-red-100 text-red-600"
                      : "bg-gray-100 text-gray-500"
            }`}
          >
            {!togglConfigEnabled
              ? "Disabled"
              : togglValidating
                ? "Checking..."
                : togglTokenValid === true
                  ? "Connected"
                  : togglTokenValid === false
                    ? "Invalid Token"
                    : "Not Connected"}
          </span>
          <button
            type="button"
            className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
            onClick={onOpenTogglSettings}
            title="Toggl settings"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.5 1.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.3a5.52 5.52 0 0 1 1.63.67l.21-.21a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1 0 1.06l-.21.21c.28.5.5 1.05.67 1.63h.3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-.3a5.52 5.52 0 0 1-.67 1.63l.21.21a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0l-.21-.21a5.52 5.52 0 0 1-1.63.67v.3a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-.3a5.52 5.52 0 0 1-1.63-.67l-.21.21a.75.75 0 0 1-1.06 0L2.54 12.4a.75.75 0 0 1 0-1.06l.21-.21a5.52 5.52 0 0 1-.67-1.63h-.3a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 .75-.75h.3c.17-.58.39-1.13.67-1.63l-.21-.21a.75.75 0 0 1 0-1.06L3.6 2.54a.75.75 0 0 1 1.06 0l.21.21A5.52 5.52 0 0 1 6.5 2.08v-.33ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="currentColor"/>
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 px-1">
          <button
            type="button"
            className="text-[11px] text-purple-600 hover:text-purple-800 transition-colors text-left disabled:text-gray-400 disabled:cursor-not-allowed"
            disabled={!togglEnabled || togglFetching}
            onClick={onTogglSync}
          >
            {togglFetching ? "Syncing entries..." : "Sync from Toggl Track"}
          </button>
          <button
            type="button"
            className="text-[10px] px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            disabled={!togglEnabled || togglFetching || unimportedCount === 0}
            onClick={onTogglImportAll}
          >
            Import all
          </button>
          {togglEnabled && togglPending.length > 0 && (
            <span className="text-[10px] text-gray-500">
              {unimportedCount} pending
            </span>
          )}
        </div>

        {togglError && (
          <div className="text-[10px] text-red-500 px-1">{togglError}</div>
        )}

        {!togglConfigEnabled && (
          <div className="text-[11px] text-gray-400 px-1">
            Enable Toggl Track to fetch entries.
          </div>
        )}

        {togglConfigEnabled && togglTokenValid !== true && !togglValidating && (
          <div className="text-[11px] text-gray-500 px-1">
            Open settings to connect your Toggl API token.
          </div>
        )}

        {togglEnabled && togglHasFetched && togglPending.length === 0 && !togglFetching && (
          <div className="text-[11px] text-gray-400 px-1">
            No entries found in this service period.
          </div>
        )}

        {togglEnabled && togglPending.length > 0 && (
          <div className="flex flex-col gap-2">
            {togglPending.map((entry) => {
              const imported = importedTogglKeys.has(entry.key);
              return (
                <div
                  key={entry.key}
                  className="bg-gray-50 rounded-lg p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-dark font-medium">
                      {entry.date}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {entry.hours.toFixed(2)}h
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-600 break-words">
                    {entry.descriptions.join(", ") || "No description"}
                  </div>
                  <div className="flex justify-end">
                    {imported ? (
                      <span className="text-[10px] px-2 py-1 rounded bg-green-100 text-green-700">
                        Imported
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-[10px] px-2 py-1 rounded bg-purple-600 text-white hover:bg-purple-700 transition-colors"
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
