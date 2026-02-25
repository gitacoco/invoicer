import type { InvoiceData, LineItem, SavedInvoice } from "../types";

interface Props {
  invoice: InvoiceData;
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
  onSave: () => void;
  onExportPdf: () => void;
  onReset: () => void;
  savedInvoices: SavedInvoice[];
  onLoad: (data: InvoiceData) => void;
  onDelete: (key: string) => void;
  exporting: boolean;
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
  updateField,
  addLineItem,
  removeLineItem,
  updateLineItem,
  onSave,
  onExportPdf,
  onReset,
  savedInvoices,
  onLoad,
  onDelete,
  exporting,
}: Props) {
  return (
    <div className="flex flex-col gap-6 p-6 h-full overflow-y-auto">
      <h2 className="text-lg font-bold text-dark">Invoice Builder</h2>

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

      {/* Client info */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Client Information</SectionLabel>
        <Input
          label="Client Name"
          value={invoice.clientName}
          onChange={(e) => updateField("clientName", e.target.value)}
          placeholder="e.g. Acme Consulting"
        />
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500">Client Address</span>
          <textarea
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 transition-colors resize-none"
            rows={3}
            value={invoice.clientAddress}
            onChange={(e) => updateField("clientAddress", e.target.value)}
            placeholder={"1302 El Camino Real\nSuite 100\nSan Francisco, CA 94105"}
          />
        </label>
      </div>

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
          <Input
            label="Payment Due"
            type="date"
            value={invoice.paymentDueDate}
            onChange={(e) => updateField("paymentDueDate", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Service Period Start"
            type="date"
            value={invoice.servicePeriodStart}
            onChange={(e) => updateField("servicePeriodStart", e.target.value)}
          />
          <Input
            label="Service Period End"
            type="date"
            value={invoice.servicePeriodEnd}
            onChange={(e) => updateField("servicePeriodEnd", e.target.value)}
          />
        </div>
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

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-2 sticky bottom-0 bg-white pt-3 pb-1 border-t border-gray-100">
        <button
          className="bg-brand text-white font-semibold rounded-lg px-4 py-2.5 text-sm hover:bg-brand/90 transition-colors disabled:opacity-50"
          onClick={onExportPdf}
          disabled={exporting}
        >
          {exporting ? "Exporting..." : "Export PDF"}
        </button>
        <div className="flex gap-2">
          <button
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm text-dark hover:bg-gray-50 transition-colors"
            onClick={onSave}
          >
            Save
          </button>
          <button
            className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
            onClick={onReset}
          >
            New Invoice
          </button>
        </div>
      </div>
    </div>
  );
}
