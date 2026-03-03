import { useState, useCallback, useMemo, useRef } from "react";
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
    resetInvoice,
    loadInvoice,
    mergeLineItems,
  } = useInvoiceState(selectedClient?.id ?? "");

  const hourlyRate = selectedClient?.hourlyRate ?? 0;
  const balanceDue = useMemo(
    () => totalHours * hourlyRate,
    [totalHours, hourlyRate]
  );

  const { savedInvoices, saveInvoice, deleteInvoice } = useLocalStorage();

  const toggl = useToggl();

  const handleTogglSync = useCallback(() => {
    if (!invoice.serviceMonth) return;
    const togglClientId = selectedClient
      ? toggl.config.clientMap[selectedClient.id]
      : undefined;
    toggl.fetchEntries(
      invoice.serviceMonth,
      invoice.serviceMonthEnd,
      togglClientId
    );
  }, [selectedClient, invoice.serviceMonth, invoice.serviceMonthEnd, toggl]);

  const importedTogglKeys = useMemo(
    () => {
      const keys = new Set<string>();
      for (const li of invoice.lineItems) {
        if (!li.togglKey) continue;
        keys.add(li.togglKey);
        // Backward compatibility: old imports used entry-id keys.
        // Current toggl entries are grouped by day and keyed by YYYY-MM-DD.
        if (li.date) keys.add(li.date);
      }
      return keys;
    },
    [invoice.lineItems]
  );

  const handleTogglImportEntry = useCallback(
    (entryKey: string) => {
      if (importedTogglKeys.has(entryKey)) return;
      const entry = toggl.pendingEntries.find((e) => e.key === entryKey);
      if (!entry) return;
      mergeLineItems(toggl.toLineItems([entry]));
    },
    [toggl, mergeLineItems, importedTogglKeys]
  );

  const handleTogglImportAll = useCallback(() => {
    const unimported = toggl.pendingEntries.filter(
      (entry) => !importedTogglKeys.has(entry.key)
    );
    if (unimported.length === 0) return;
    mergeLineItems(toggl.toLineItems(unimported));
  }, [toggl, importedTogglKeys, mergeLineItems]);

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

  const handleClearAllEntries = useCallback(() => {
    const confirmed = window.confirm(
      "Clear all invoice entries? This will remove imported and manual items."
    );
    if (!confirmed) return;
    updateField("lineItems", []);
  }, [updateField]);

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

  const handleMonthSelect = useCallback(
    (startMonth: string, endMonth?: string) => {
      resetInvoice(undefined, startMonth, endMonth);
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
          onSelectClient={handleSelectClient}
          onOpenCreateClient={() => {
            setEditingClient(null);
            setModalOpen(true);
          }}
          onOpenEditClient={(client) => {
            setEditingClient(client);
            setModalOpen(true);
          }}
          onMonthSelect={handleMonthSelect}
          savedInvoices={savedInvoices}
          onLoad={loadInvoice}
          onDelete={deleteInvoice}
          togglConfigEnabled={toggl.config.enabled}
          togglEnabled={toggl.config.enabled && toggl.tokenValid === true}
          togglFetching={toggl.fetching}
          togglHasFetched={toggl.hasFetched}
          togglPending={toggl.pendingEntries}
          togglError={toggl.syncError}
          togglTokenValid={toggl.tokenValid}
          togglValidating={toggl.validating}
          importedTogglKeys={importedTogglKeys}
          onTogglToggle={() => toggl.updateConfig({ enabled: !toggl.config.enabled })}
          onTogglSync={handleTogglSync}
          onTogglImportEntry={handleTogglImportEntry}
          onTogglImportAll={handleTogglImportAll}
          onOpenTogglSettings={() => setTogglModalOpen(true)}
        />
      </div>

      {/* Resize handle */}
      <div
        className="w-1 shrink-0 cursor-col-resize bg-gray-200 hover:bg-brand/40 active:bg-brand/60 transition-colors"
        onMouseDown={handleDragStart}
      />

      {/* Right: Preview + actions */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
          {selectedClient ? (
            <div className="shadow-lg rounded-lg overflow-hidden">
              <InvoicePreview
                invoice={invoice}
                client={selectedClient}
                totalHours={totalHours}
                balanceDue={balanceDue}
                updateField={updateField}
                addLineItem={addLineItem}
                removeLineItem={removeLineItem}
                updateLineItem={updateLineItem}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select or create a client to preview the invoice
            </div>
          )}
        </div>
        {/* Floating bottom action toolbar */}
        {selectedClient && (
          <div className="absolute inset-x-0 bottom-4 z-20 flex justify-center pointer-events-none px-6">
            <div className="pointer-events-auto bg-white/95 backdrop-blur border border-gray-200 shadow-lg rounded-xl px-3 py-2 flex items-center gap-2">
              <button
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-dark hover:bg-gray-50 transition-colors"
                onClick={handleSave}
              >
                Save
              </button>
              <button
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-red-600 transition-colors"
                onClick={handleClearAllEntries}
              >
                Clear all entries
              </button>
              <button
                className="bg-brand text-white font-semibold rounded-lg px-4 py-2 text-sm hover:bg-brand/90 transition-colors disabled:opacity-50 min-w-[140px]"
                onClick={handleExportPdf}
                disabled={exporting}
              >
                {exporting ? "Exporting..." : "Export PDF"}
              </button>
            </div>
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
