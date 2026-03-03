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
    <div className="flex h-screen bg-[#f5f7f2]">
      {/* Left: Input form */}
      <div
        className="shrink-0 bg-[#f8faf6] border-r border-[#e2e7de] overflow-hidden"
        style={{ width: panelWidth }}
      >
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
        className="w-1 shrink-0 cursor-col-resize bg-[#e1e6dc] hover:bg-[#ccd5c8] active:bg-[#b8c4b5] transition-colors"
        onMouseDown={handleDragStart}
      />

      {/* Right: Preview + actions */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-[#f4f7f2]">
        <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
          {selectedClient ? (
            <div className="shadow-[0_10px_24px_rgba(15,23,42,0.10)] border border-[#dce2d8] rounded-xl overflow-hidden">
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
          <div className="absolute inset-x-0 bottom-5 z-20 pointer-events-none flex justify-center px-4">
            <div className="pointer-events-auto w-fit bg-[rgba(218,225,214,0.68)] backdrop-blur-xl border border-[rgba(191,202,188,0.85)] shadow-[0_12px_30px_rgba(35,49,42,0.14)] rounded-[999px] px-2.5 py-2 flex items-center gap-2">
              <button
                className="h-10 border border-[rgba(178,191,176,0.95)] bg-[rgba(241,245,239,0.72)] rounded-[999px] px-6 text-[13px] font-medium tracking-[0.01em] text-[#24322d] hover:bg-[rgba(245,248,243,0.92)] transition-colors"
                onClick={handleSave}
              >
                Save
              </button>
              <button
                className="h-10 border border-[rgba(178,191,176,0.95)] bg-[rgba(241,245,239,0.72)] rounded-[999px] px-6 text-[13px] font-medium tracking-[0.01em] text-[#4e5c56] hover:bg-[rgba(245,248,243,0.92)] hover:text-[#7b2f2f] transition-colors"
                onClick={handleClearAllEntries}
              >
                Clear all entries
              </button>
              <button
                className="h-10 bg-[#31566f] text-white font-semibold rounded-[999px] px-7 text-[13px] tracking-[0.01em] hover:bg-[#26495f] transition-colors disabled:opacity-50 min-w-[148px]"
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
