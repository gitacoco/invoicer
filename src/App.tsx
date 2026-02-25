import { useRef, useState, useCallback } from "react";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import { useInvoiceState } from "./hooks/useInvoiceState";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { exportPdf } from "./utils/exportPdf";

export default function App() {
  const previewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const {
    invoice,
    updateField,
    addLineItem,
    removeLineItem,
    updateLineItem,
    totalHours,
    balanceDue,
    resetInvoice,
    loadInvoice,
  } = useInvoiceState();

  const { savedInvoices, saveInvoice, deleteInvoice } = useLocalStorage();

  const handleExportPdf = useCallback(async () => {
    if (!previewRef.current) return;
    setExporting(true);
    try {
      const filename = invoice.invoiceNumber || "invoice";
      await exportPdf(previewRef.current, filename);
    } finally {
      setExporting(false);
    }
  }, [invoice.invoiceNumber]);

  const handleSave = useCallback(() => {
    saveInvoice(invoice);
  }, [invoice, saveInvoice]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left: Input form */}
      <div className="w-[420px] shrink-0 bg-white border-r border-gray-200 overflow-hidden">
        <InvoiceForm
          invoice={invoice}
          updateField={updateField}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          updateLineItem={updateLineItem}
          onSave={handleSave}
          onExportPdf={handleExportPdf}
          onReset={resetInvoice}
          savedInvoices={savedInvoices}
          onLoad={loadInvoice}
          onDelete={deleteInvoice}
          exporting={exporting}
        />
      </div>

      {/* Right: Invoice preview */}
      <div className="flex-1 overflow-auto p-8 flex justify-center items-start">
        <div className="shadow-lg rounded-lg overflow-hidden">
          <InvoicePreview
            ref={previewRef}
            invoice={invoice}
            totalHours={totalHours}
            balanceDue={balanceDue}
          />
        </div>
      </div>
    </div>
  );
}
