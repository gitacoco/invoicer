import type { InvoiceData, LineItem, SavedInvoice, Client, NetTerms } from "../types";
import { ClientPicker } from "./ClientSelector";
import { TogglSyncPrompt } from "./TogglIntegration";
import type { AggregatedEntry } from "../hooks/useToggl";

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
  savedInvoices: SavedInvoice[];
  onLoad: (data: InvoiceData) => void;
  onDelete: (key: string) => void;
  // Toggl integration
  togglEnabled: boolean;
  togglFetching: boolean;
  togglHasFetched: boolean;
  togglPending: AggregatedEntry[];
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
  savedInvoices,
  onLoad,
  onDelete,
  togglEnabled,
  togglFetching,
  togglHasFetched,
  togglPending,
  onTogglSync,
  onTogglImport,
  onOpenTogglSettings,
}: Props) {
  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-dark">Invoice Builder</h2>
        <button
          className="text-[11px] text-gray-400 hover:text-brand transition-colors"
          onClick={onOpenTogglSettings}
        >
          Integration
        </button>
      </div>

      {/* Client picker */}
      <ClientPicker
        clients={clients}
        selectedClient={client}
        onSelect={onSelectClient}
        onOpenCreate={onOpenCreateClient}
        onOpenEdit={onOpenEditClient}
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

      {/* Invoice meta */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Invoice Details</SectionLabel>
        <Input
          label="Invoice Number"
          value={invoice.invoiceNumber}
          onChange={(e) => updateField("invoiceNumber", e.target.value)}
          placeholder="INV-CR-202601"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Issued Date"
            type="date"
            value={invoice.issuedDate}
            onChange={(e) => updateField("issuedDate", e.target.value)}
          />
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-gray-500">Payment Terms</span>
            <select
              className="appearance-none border border-gray-200 rounded-lg px-3 pr-8 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.5%206l3.5%203.5L11.5%206%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat"
              value={invoice.netTerms}
              onChange={(e) =>
                updateField("netTerms", Number(e.target.value) as NetTerms)
              }
            >
              <option value={15}>Net 15</option>
              <option value={30}>Net 30</option>
              <option value={45}>Net 45</option>
              <option value={60}>Net 60</option>
            </select>
          </label>
        </div>
        <Input
          label="Service Month"
          type="month"
          value={invoice.serviceMonth}
          onChange={(e) => updateField("serviceMonth", e.target.value)}
        />
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Line Items</SectionLabel>
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

        {/* Toggl sync prompt */}
        <TogglSyncPrompt
          enabled={togglEnabled}
          fetching={togglFetching}
          hasFetched={togglHasFetched}
          pendingEntries={togglPending}
          onSync={onTogglSync}
          onImport={onTogglImport}
        />
      </div>

      {/* Hourly Rate */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Rate</SectionLabel>
        <Input
          label="Hourly Rate ($)"
          type="number"
          min="0"
          value={invoice.hourlyRate || ""}
          onChange={(e) =>
            updateField("hourlyRate", parseFloat(e.target.value) || 0)
          }
        />
      </div>

    </div>
  );
}
