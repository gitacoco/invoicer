import { useState } from "react";
import type { InvoiceData, LineItem, SavedInvoice, Client } from "../types";
import { ClientPicker } from "./ClientSelector";
import { TogglSyncPrompt } from "./TogglIntegration";
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
  addLineItem: () => void;
  removeLineItem: (id: string) => void;
  updateLineItem: (
    id: string,
    field: keyof LineItem,
    value: string | number
  ) => void;
  onSelectClient: (client: Client) => void;
  onOpenCreateClient: () => void;
  onOpenEditClient: (client: Client) => void;
  onMonthSelect: (month: string) => void;
  savedInvoices: SavedInvoice[];
  onLoad: (data: InvoiceData) => void;
  onDelete: (key: string) => void;
  // Toggl integration
  togglConfigEnabled: boolean;
  togglEnabled: boolean;
  togglFetching: boolean;
  togglHasFetched: boolean;
  togglPending: AggregatedEntry[];
  onTogglToggle: () => void;
  onTogglSync: () => void;
  onTogglImport: () => void;
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
  selectedMonth,
  onSelect,
}: {
  selectedMonth: string;
  onSelect: (month: string) => void;
}) {
  const [selYear, selMon] = selectedMonth.split("-").map(Number);
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
          const isSelected = displayYear === selYear && monthNum === selMon;
          return (
            <button
              key={i}
              type="button"
              className={`rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                isSelected
                  ? "bg-brand text-white"
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              }`}
              onClick={() => onSelect(monthStr)}
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
  addLineItem,
  removeLineItem,
  updateLineItem,
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
  onTogglToggle,
  onTogglSync,
  onTogglImport,
  onOpenTogglSettings,
}: Props) {
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
        selectedMonth={invoice.serviceMonth}
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

      {/* Line items */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Line Items</SectionLabel>
        {/* Toggl toggle + settings */}
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
          <span className="text-[11px] text-gray-500 flex-1">Toggl Track</span>
          {togglConfigEnabled && (
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 transition-colors"
              onClick={onOpenTogglSettings}
              title="Toggl settings"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.5 1.75a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 .75.75v.3a5.52 5.52 0 0 1 1.63.67l.21-.21a.75.75 0 0 1 1.06 0l1.06 1.06a.75.75 0 0 1 0 1.06l-.21.21c.28.5.5 1.05.67 1.63h.3a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-.75.75h-.3a5.52 5.52 0 0 1-.67 1.63l.21.21a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06 0l-.21-.21a5.52 5.52 0 0 1-1.63.67v.3a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1-.75-.75v-.3a5.52 5.52 0 0 1-1.63-.67l-.21.21a.75.75 0 0 1-1.06 0L2.54 12.4a.75.75 0 0 1 0-1.06l.21-.21a5.52 5.52 0 0 1-.67-1.63h-.3a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 .75-.75h.3c.17-.58.39-1.13.67-1.63l-.21-.21a.75.75 0 0 1 0-1.06L3.6 2.54a.75.75 0 0 1 1.06 0l.21.21A5.52 5.52 0 0 1 6.5 2.08v-.33ZM8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" fill="currentColor"/>
              </svg>
            </button>
          )}
        </div>
        <TogglSyncPrompt
          enabled={togglEnabled}
          fetching={togglFetching}
          hasFetched={togglHasFetched}
          pendingEntries={togglPending}
          onSync={onTogglSync}
          onImport={onTogglImport}
        />
        {invoice.lineItems.map((item, i) => (
          <div
            key={item.id}
            className="flex flex-col gap-2 bg-gray-50 rounded-lg p-3 relative group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-medium">
                #{i + 1}
              </span>
              {invoice.lineItems.length > 1 && (
                <button
                  className="text-[10px] text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeLineItem(item.id)}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <input
                type="date"
                className="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-brand"
                value={item.date}
                onChange={(e) =>
                  updateLineItem(item.id, "date", e.target.value)
                }
              />
              <input
                type="number"
                step="0.01"
                min="0"
                className="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-brand w-full"
                value={item.hours || ""}
                onChange={(e) =>
                  updateLineItem(
                    item.id,
                    "hours",
                    parseFloat(e.target.value) || 0
                  )
                }
                placeholder="Hours"
              />
            </div>
            <input
              className="border border-gray-200 rounded-md px-2 py-1.5 text-[11px] outline-none focus:border-brand w-full"
              value={item.service}
              onChange={(e) =>
                updateLineItem(item.id, "service", e.target.value)
              }
              placeholder="Service description"
            />
          </div>
        ))}
        <button
          className="border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-brand hover:text-brand transition-colors"
          onClick={addLineItem}
        >
          + Add Line Item
        </button>

      </div>

    </div>
  );
}
