import { useState, useCallback, useRef } from "react";
import { ClientModal } from "./components/ClientSelector";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import { TogglSettingsModal } from "./components/TogglIntegration";
import { useInvoiceState } from "./hooks/useInvoiceState";
import { useClients } from "./hooks/useClients";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useToggl } from "./hooks/useToggl";
import { exportPdf } from "./utils/exportPdf";
import type { Client } from "./types";

export default function App() {
  const { clients, addClient, updateClient } = useClients();
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    () => clients[0] ?? null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [togglModalOpen, setTogglModalOpen] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [panelWidth, setPanelWidth] = useState(420);
  const dragging = useRef(false);

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
    mergeLineItems,
  } = useInvoiceState(selectedClient?.id ?? "");

  const { savedInvoices, saveInvoice, deleteInvoice } = useLocalStorage();

  const toggl = useToggl();

  const handleTogglSync = useCallback(() => {
    if (!selectedClient || !invoice.serviceMonth) return;
    const togglClientId = toggl.config.clientMap[selectedClient.id];
    const existingDates = new Set(
      invoice.lineItems.map((li) => li.date).filter(Boolean)
    );
    toggl.fetchEntries(invoice.serviceMonth, togglClientId, existingDates);
  }, [selectedClient, invoice.serviceMonth, invoice.lineItems, toggl]);

  const handleTogglImport = useCallback(() => {
    const items = toggl.toLineItems(toggl.pendingEntries);
    mergeLineItems(items);
    toggl.clearPending();
  }, [toggl, mergeLineItems]);

  const handleExportPdf = useCallback(async () => {
    if (!selectedClient) return;
    setExporting(true);
    try {
      const filename = invoice.invoiceNumber || "invoice";
      await exportPdf(
        { invoice, client: selectedClient, totalHours, balanceDue },
        filename
      );
    } finally {
      setExporting(false);
    }
  }, [invoice, selectedClient, totalHours, balanceDue]);

  const handleSave = useCallback(() => {
    if (!selectedClient) return;
    saveInvoice(invoice, selectedClient);
  }, [invoice, selectedClient, saveInvoice]);

  const handleSelectClient = useCallback(
    (client: Client) => {
      setSelectedClient(client);
      resetInvoice(client.id);
    },
    [resetInvoice]
  );

  const handleClientCreated = useCallback(
    (client: Client) => {
      setSelectedClient(client);
      resetInvoice(client.id);
    },
    [resetInvoice]
  );

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startW = panelWidth;

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const newW = Math.min(Math.max(startW + ev.clientX - startX, 320), 700);
      setPanelWidth(newW);
    }
    function onUp() {
      dragging.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [panelWidth]);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left: Input form */}
      <div className="shrink-0 bg-white overflow-hidden" style={{ width: panelWidth }}>
        <InvoiceForm
          invoice={invoice}
          client={selectedClient}
          clients={clients}
          updateField={updateField}
          addLineItem={addLineItem}
          removeLineItem={removeLineItem}
          updateLineItem={updateLineItem}
          onSelectClient={handleSelectClient}
          onOpenCreateClient={() => {
            setEditingClient(null);
            setModalOpen(true);
          }}
          onOpenEditClient={(client) => {
            setEditingClient(client);
            setModalOpen(true);
          }}
          savedInvoices={savedInvoices}
          onLoad={loadInvoice}
          onDelete={deleteInvoice}
          togglEnabled={toggl.config.enabled && toggl.tokenValid === true}
          togglFetching={toggl.fetching}
          togglHasFetched={toggl.hasFetched}
          togglPending={toggl.pendingEntries}
          onTogglSync={handleTogglSync}
          onTogglImport={handleTogglImport}
          onOpenTogglSettings={() => setTogglModalOpen(true)}
        />
      </div>

      {/* Resize handle */}
      <div
        className="w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-brand/40 active:bg-brand/60 transition-colors"
        onMouseDown={handleDragStart}
      />

      {/* Right: Preview + actions */}
      <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
        {selectedClient ? (
          <>
            {/* Preview */}
            <div className="shadow-lg rounded-lg overflow-hidden">
              <InvoicePreview
                invoice={invoice}
                client={selectedClient}
                totalHours={totalHours}
                balanceDue={balanceDue}
              />
            </div>
            {/* Actions */}
            <div className="flex gap-2 mt-4 w-[595px]">
              <button
                className="flex-1 bg-brand text-white font-semibold rounded-lg px-4 py-2.5 text-sm hover:bg-brand/90 transition-colors disabled:opacity-50"
                onClick={handleExportPdf}
                disabled={exporting}
              >
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
              <button
                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-dark hover:bg-white transition-colors"
                onClick={handleSave}
              >
                Save
              </button>
              <button
                className="border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-500 hover:bg-white transition-colors"
                onClick={() => resetInvoice()}
              >
                New Invoice
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Select or create a client to preview the invoice
          </div>
        )}
      </div>

      {/* Client modal (create / edit) */}
      <ClientModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={addClient}
        onCreated={handleClientCreated}
        onUpdate={(id, partial) => {
          updateClient(id, partial);
          // Refresh selectedClient if it was the one being edited
          if (selectedClient?.id === id) {
            setSelectedClient((prev) => (prev ? { ...prev, ...partial } : prev));
          }
        }}
        editClient={editingClient}
      />

      {/* Toggl settings modal */}
      <TogglSettingsModal
        open={togglModalOpen}
        onClose={() => setTogglModalOpen(false)}
        config={toggl.config}
        updateConfig={toggl.updateConfig}
        validating={toggl.validating}
        tokenValid={toggl.tokenValid}
        validateToken={toggl.validateToken}
        togglClients={toggl.togglClients}
        clients={clients}
      />
    </div>
  );
}
