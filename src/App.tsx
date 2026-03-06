import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type DragEvent,
} from "react";
import { ClientModal, ClientPicker } from "./components/ClientSelector";
import CompanySettingsModal from "./components/CompanySettingsModal";
import InvoiceForm from "./components/InvoiceForm";
import InvoicePreview from "./components/InvoicePreview";
import {
  DEFAULT_MINIMAX_MODEL,
  fetchAiConfig,
  fetchAiConfigSecret,
  saveAiConfig,
} from "./hooks/useAiRewrite";
import { useCompanySettings } from "./hooks/useCompanySettings";
import { createDefaultInvoice, useInvoiceState } from "./hooks/useInvoiceState";
import { useClients } from "./hooks/useClients";
import { useInvoices } from "./hooks/useInvoices";
import { useToggl } from "./hooks/useToggl";
import { resolveAssetUrl } from "./utils/assets";
import { exportPdf } from "./utils/exportPdf";
import type { Client, CompanySettings, InvoiceRecord } from "./types";

function PencilIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="m16.5 3.5 4 4L7 21l-4 1 1-4Z" />
    </svg>
  );
}

function Trash2Icon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function SettingsIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export default function App() {
  const { clients, addClient, updateClient } = useClients();
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    () => clients[0] ?? null
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const [exporting, setExporting] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [renamingInvoice, setRenamingInvoice] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [companySettingsOpen, setCompanySettingsOpen] = useState(false);
  const [companySettingsSaving, setCompanySettingsSaving] = useState(false);
  const [initialMinimaxApiKey, setInitialMinimaxApiKey] = useState("");
  const [initialMinimaxModel, setInitialMinimaxModel] = useState(
    DEFAULT_MINIMAX_MODEL
  );
  const [clearEntriesConfirmOpen, setClearEntriesConfirmOpen] = useState(false);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [invoiceSaveStatus, setInvoiceSaveStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const [invoiceSaveError, setInvoiceSaveError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<InvoiceRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRecord | null>(null);
  const [draggingInvoiceId, setDraggingInvoiceId] = useState<string | null>(null);
  const [dragOverInvoiceId, setDragOverInvoiceId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [secondaryPanelCollapsed, setSecondaryPanelCollapsed] = useState(false);
  const lastSavedSnapshotRef = useRef("");
  const autoSaveSeqRef = useRef(0);

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

  const {
    settings: companySettings,
    loading: companySettingsLoading,
    save: saveCompanySettings,
  } = useCompanySettings();

  const {
    invoices,
    createInvoice,
    updateInvoice,
    deleteInvoice: deleteStoredInvoice,
    renameInvoice,
    reorderInvoices,
  } = useInvoices(selectedClient?.id ?? null);

  const toggl = useToggl();
  const companyLogoUrl = resolveAssetUrl(companySettings.companyLogoDataUrl);

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

  const handleTogglClientFilterChange = useCallback(
    (togglClientId?: number) => {
      if (!selectedClient) return;
      const nextClientMap = { ...toggl.config.clientMap };
      if (togglClientId == null) {
        delete nextClientMap[selectedClient.id];
      } else {
        nextClientMap[selectedClient.id] = togglClientId;
      }
      toggl.updateConfig({ clientMap: nextClientMap });
      toggl.clearPending();
    },
    [selectedClient, toggl]
  );

  const handleExportPdf = useCallback(async () => {
    if (!selectedClient) return;
    setExporting(true);
    try {
      const filename = invoice.invoiceNumber || "invoice";
      await exportPdf(
        {
          invoice,
          client: selectedClient,
          companySettings,
          totalHours,
          balanceDue,
        },
        filename
      );
    } finally {
      setExporting(false);
    }
  }, [balanceDue, companySettings, invoice, selectedClient, totalHours]);

  const handleClearAllEntries = useCallback(() => {
    setClearEntriesConfirmOpen(true);
  }, []);

  const handleConfirmClearAllEntries = useCallback(() => {
    updateField("lineItems", []);
    setClearEntriesConfirmOpen(false);
  }, [updateField]);

  const handleSelectClient = useCallback(
    (client: Client) => {
      setSelectedClient(client);
      setActiveInvoiceId(null);
      setIsInvoiceOpen(false);
      setRenameTarget(null);
      setDeleteTarget(null);
      setClearEntriesConfirmOpen(false);
      setInvoiceSaveStatus("saved");
      setInvoiceSaveError(null);
      lastSavedSnapshotRef.current = "";
      resetInvoice(client.id);
    },
    [resetInvoice]
  );

  const handleClientCreated = useCallback(
    (client: Client) => {
      setSelectedClient(client);
      setActiveInvoiceId(null);
      setIsInvoiceOpen(false);
      setRenameTarget(null);
      setDeleteTarget(null);
      setClearEntriesConfirmOpen(false);
      setInvoiceSaveStatus("saved");
      setInvoiceSaveError(null);
      lastSavedSnapshotRef.current = "";
      resetInvoice(client.id);
    },
    [resetInvoice]
  );

  const handleMonthSelect = useCallback(
    (startMonth: string, endMonth?: string) => {
      updateField("serviceMonth", startMonth);
      updateField("serviceMonthEnd", endMonth);
    },
    [updateField]
  );

  const handleCreateInvoice = useCallback(() => {
    if (!selectedClient || creatingInvoice) return;
    const draft = createDefaultInvoice(selectedClient.id);
    setCreatingInvoice(true);
    void (async () => {
      try {
        const created = await createInvoice(draft);
        setActiveInvoiceId(created.id);
        setIsInvoiceOpen(true);
        loadInvoice(created.data);
        lastSavedSnapshotRef.current = JSON.stringify(created.data);
        setInvoiceSaveStatus("saved");
        setInvoiceSaveError(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to create invoice.";
        window.alert(message);
      } finally {
        setCreatingInvoice(false);
      }
    })();
  }, [createInvoice, creatingInvoice, loadInvoice, selectedClient]);

  const handleOpenInvoice = useCallback(
    (record: InvoiceRecord) => {
      setActiveInvoiceId(record.id);
      setIsInvoiceOpen(true);
      loadInvoice(record.data);
      lastSavedSnapshotRef.current = JSON.stringify(record.data);
      setInvoiceSaveStatus("saved");
      setInvoiceSaveError(null);
    },
    [loadInvoice]
  );

  const getReferenceName = useCallback((record: InvoiceRecord): string => {
    return (
      record.referenceName?.trim() ||
      record.data.invoiceNumber?.trim() ||
      "Untitled Invoice"
    );
  }, []);

  const openRenameDialog = useCallback(
    (record: InvoiceRecord) => {
      setRenameTarget(record);
      setRenameValue(getReferenceName(record));
    },
    [getReferenceName]
  );

  const openDeleteDialog = useCallback((record: InvoiceRecord) => {
    setDeleteTarget(record);
  }, []);

  const handleConfirmRename = useCallback(() => {
    if (!renameTarget || renamingInvoice) return;
    const nextName = renameValue.trim();
    if (!nextName) {
      window.alert("Invoice name cannot be empty.");
      return;
    }
    setRenamingInvoice(true);
    void (async () => {
      try {
        await renameInvoice(renameTarget.id, nextName);
        setRenameTarget(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to rename invoice.";
        window.alert(message);
      } finally {
        setRenamingInvoice(false);
      }
    })();
  }, [renameInvoice, renameTarget, renameValue, renamingInvoice]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget || deletingInvoice) return;
    setDeletingInvoice(true);
    void (async () => {
      try {
        await deleteStoredInvoice(deleteTarget.id);
        if (activeInvoiceId === deleteTarget.id && selectedClient) {
          setActiveInvoiceId(null);
          setIsInvoiceOpen(false);
          setInvoiceSaveStatus("saved");
          setInvoiceSaveError(null);
          lastSavedSnapshotRef.current = "";
          resetInvoice(selectedClient.id);
        }
        setDeleteTarget(null);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete invoice.";
        window.alert(message);
      } finally {
        setDeletingInvoice(false);
      }
    })();
  }, [
    activeInvoiceId,
    deleteStoredInvoice,
    deleteTarget,
    deletingInvoice,
    resetInvoice,
    selectedClient,
  ]);

  const handleInvoiceDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, id: string) => {
      if (invoices.length <= 1) return;
      setDraggingInvoiceId(id);
      setDragOverInvoiceId(id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", id);
    },
    [invoices.length]
  );

  const handleInvoiceDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const handleInvoiceDrop = useCallback(
    (targetId: string) => {
      if (!draggingInvoiceId || draggingInvoiceId === targetId) {
        setDraggingInvoiceId(null);
        setDragOverInvoiceId(null);
        return;
      }
      const orderedIds = invoices.map((inv) => inv.id);
      const from = orderedIds.indexOf(draggingInvoiceId);
      const to = orderedIds.indexOf(targetId);
      if (from < 0 || to < 0) {
        setDraggingInvoiceId(null);
        setDragOverInvoiceId(null);
        return;
      }
      const nextOrder = [...orderedIds];
      const [movedId] = nextOrder.splice(from, 1);
      nextOrder.splice(to, 0, movedId);
      setDraggingInvoiceId(null);
      setDragOverInvoiceId(null);
      void reorderInvoices(nextOrder).catch((error) => {
        const message =
          error instanceof Error ? error.message : "Failed to reorder invoices.";
        window.alert(message);
      });
    },
    [draggingInvoiceId, invoices, reorderInvoices]
  );

  const handleInvoiceDragEnd = useCallback(() => {
    setDraggingInvoiceId(null);
    setDragOverInvoiceId(null);
  }, []);

  const openCompanySettings = useCallback(() => {
    setCompanySettingsOpen(true);
    void (async () => {
      try {
        const [apiKey, aiConfig] = await Promise.all([
          fetchAiConfigSecret(),
          fetchAiConfig(),
        ]);
        setInitialMinimaxApiKey(apiKey);
        setInitialMinimaxModel(aiConfig.model || DEFAULT_MINIMAX_MODEL);
      } catch {
        setInitialMinimaxApiKey("");
        setInitialMinimaxModel(DEFAULT_MINIMAX_MODEL);
      }
    })();
  }, []);

  const handleSaveCompanySettings = useCallback(
    async ({
      settings,
      togglApiToken,
      minimaxApiKey,
      minimaxModel,
    }: {
      settings: CompanySettings;
      togglApiToken: string;
      minimaxApiKey: string;
      minimaxModel: string;
    }) => {
      setCompanySettingsSaving(true);
      try {
        await saveCompanySettings(settings);

        if (togglApiToken !== toggl.config.apiToken) {
          toggl.updateConfig({ apiToken: togglApiToken });
          if (togglApiToken) {
            await toggl.validateToken(togglApiToken);
          }
        }

        const nextApiKey = minimaxApiKey.trim();
        const nextModel = minimaxModel.trim() || DEFAULT_MINIMAX_MODEL;
        const aiChanged =
          nextApiKey !== initialMinimaxApiKey || nextModel !== initialMinimaxModel;
        if (aiChanged) {
          if (!nextApiKey) {
            throw new Error("MiniMax API key is required.");
          }
          const saved = await saveAiConfig(nextApiKey, { model: nextModel });
          setInitialMinimaxApiKey(nextApiKey);
          setInitialMinimaxModel(saved.model || nextModel);
        }

        setCompanySettingsOpen(false);
      } finally {
        setCompanySettingsSaving(false);
      }
    },
    [
      initialMinimaxApiKey,
      initialMinimaxModel,
      saveCompanySettings,
      toggl,
    ]
  );

  useEffect(() => {
    if (!selectedClient || !isInvoiceOpen || !activeInvoiceId) return;

    const payload = { ...invoice, clientId: selectedClient.id };
    const nextSnapshot = JSON.stringify(payload);
    if (nextSnapshot === lastSavedSnapshotRef.current) {
      if (invoiceSaveStatus !== "error") {
        setInvoiceSaveStatus("saved");
      }
      return;
    }

    setInvoiceSaveStatus("saving");
    setInvoiceSaveError(null);

    const seq = ++autoSaveSeqRef.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          await updateInvoice(activeInvoiceId, payload);
          if (autoSaveSeqRef.current !== seq) return;
          lastSavedSnapshotRef.current = nextSnapshot;
          setInvoiceSaveStatus("saved");
          setInvoiceSaveError(null);
        } catch (error) {
          if (autoSaveSeqRef.current !== seq) return;
          const message =
            error instanceof Error ? error.message : "Auto-save failed.";
          setInvoiceSaveStatus("error");
          setInvoiceSaveError(message);
        }
      })();
    }, 600);

    return () => window.clearTimeout(timer);
  }, [
    activeInvoiceId,
    invoice,
    invoiceSaveStatus,
    isInvoiceOpen,
    selectedClient,
    updateInvoice,
  ]);

  return (
    <div className="flex h-screen flex-col bg-[#f5f7f2]">
      {/* Top nav */}
      <header className="h-14 shrink-0 border-b border-[#d6ddd5] bg-[#f8faf6] px-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-[14px] font-semibold text-[#1f2f28] tracking-[0.02em]">
            Bone&apos;s Invoicer
          </h1>
          <div className="w-[280px] max-w-[36vw]">
            <ClientPicker
              clients={clients}
              selectedClient={selectedClient}
              compact
              showAddress={false}
              onSelect={handleSelectClient}
              onOpenCreate={() => {
                setEditingClient(null);
                setModalOpen(true);
              }}
              onOpenEdit={(client) => {
                setEditingClient(client);
                setModalOpen(true);
              }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {companyLogoUrl && (
            <img
              src={companyLogoUrl}
              alt=""
              className="h-5 w-5 rounded-[3px] object-cover border border-[#d6ddd5] bg-white"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="text-[12px] tracking-[0.01em] text-[#4f5d55] whitespace-nowrap truncate">
            {companySettings.companyName}
          </div>
          <button
            type="button"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md text-[#6c7870] hover:bg-[#edf2ed] hover:text-[#2f5168] transition-colors"
            onClick={openCompanySettings}
            title="Open settings"
            aria-label="Open settings"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      {/* Primary side panel | Secondary side panel | Preview */}
      <div className="flex-1 min-h-0 flex">
        {/* Primary side panel */}
        <aside
          className={`shrink-0 border-r border-[#d6ddd5] bg-[#f8faf6] overflow-x-hidden transition-all duration-200 flex flex-col ${
            sidebarCollapsed ? "w-[40px]" : "w-[250px]"
          }`}
        >
          {sidebarCollapsed ? (
            <div className="flex-1" />
          ) : (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              <button
                type="button"
                className="h-9 rounded-lg border border-[#d3ddd3] bg-white/85 text-[12px] font-medium text-[#2f5168] hover:bg-white transition-colors"
                onClick={handleCreateInvoice}
                disabled={!selectedClient || creatingInvoice}
              >
                {creatingInvoice ? "Creating..." : "+ New Invoice"}
              </button>
              <div className="flex flex-col gap-1.5">
                {invoices.length === 0 ? (
                  <div className="px-3 py-2 text-[11px] text-[#6f7a73] border border-[#dce4da] bg-white/90 rounded-xl">
                    No invoices yet.
                  </div>
                ) : (
                  invoices.map((inv) => {
                    const isActive = inv.id === activeInvoiceId;
                    return (
                      <div
                        key={inv.id}
                        className={`group flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors ${
                          isActive
                            ? "bg-[#eef3f0] border-[#d6e1d8]"
                            : "bg-white/90 border-[#dce4da] hover:bg-[#f4f8f4]"
                        } ${
                          dragOverInvoiceId === inv.id && draggingInvoiceId !== inv.id
                            ? "border-[#8ea59a]"
                            : ""
                        }`}
                        draggable={invoices.length > 1}
                        onDragStart={(event) => handleInvoiceDragStart(event, inv.id)}
                        onDragOver={handleInvoiceDragOver}
                        onDragEnter={() => {
                          if (draggingInvoiceId) setDragOverInvoiceId(inv.id);
                        }}
                        onDrop={() => handleInvoiceDrop(inv.id)}
                        onDragEnd={handleInvoiceDragEnd}
                      >
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left"
                          onClick={() => handleOpenInvoice(inv)}
                        >
                          <div className="text-[12px] text-[#24332c] truncate">
                            {getReferenceName(inv)}
                          </div>
                          <div className="text-[10px] text-[#7b8780]">
                            {inv.updatedAt.slice(0, 10)}
                          </div>
                        </button>
                        <div
                          className={`flex items-center gap-1 transition-opacity ${
                            isActive
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                          }`}
                        >
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#6c7870] hover:bg-[#e8eeeb] hover:text-[#254a63] transition-colors"
                            onClick={() => openRenameDialog(inv)}
                            aria-label={`Rename ${getReferenceName(inv)}`}
                            title="Rename invoice"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#6c7870] hover:bg-[#f4e7e4] hover:text-[#8a2d2d] transition-colors"
                            onClick={() => openDeleteDialog(inv)}
                            aria-label={`Delete ${getReferenceName(inv)}`}
                            title="Delete invoice"
                          >
                            <Trash2Icon />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
          {/* Collapse/expand toggle at bottom */}
          <div className="shrink-0 border-t border-[#d6ddd5] flex items-center px-1.5 py-2">
            <button
              type="button"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#6f7a73] hover:text-[#2f5168] hover:bg-[#e8eeeb] transition-colors"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {sidebarCollapsed
                  ? <polyline points="9 18 15 12 9 6" />
                  : <polyline points="15 18 9 12 15 6" />}
              </svg>
            </button>
          </div>
        </aside>

        {/* Secondary side panel */}
        <aside
          className={`shrink-0 border-r border-[#d6ddd5] bg-[#f8faf6] overflow-x-hidden transition-all duration-200 flex flex-col ${
            secondaryPanelCollapsed ? "w-[40px]" : "w-[430px]"
          }`}
        >
          {secondaryPanelCollapsed ? (
            <div className="flex-1" />
          ) : isInvoiceOpen ? (
            <InvoiceForm
              invoice={invoice}
              updateField={updateField}
              onMonthSelect={handleMonthSelect}
              togglConfigEnabled={toggl.config.enabled}
              togglFetching={toggl.fetching}
              togglClients={toggl.togglClients}
              selectedTogglClientId={
                selectedClient
                  ? toggl.config.clientMap[selectedClient.id]
                  : undefined
              }
              togglPending={toggl.pendingEntries}
              togglError={toggl.syncError}
              importedTogglKeys={importedTogglKeys}
              onTogglToggle={() => toggl.updateConfig({ enabled: !toggl.config.enabled })}
              onTogglClientChange={handleTogglClientFilterChange}
              onTogglSync={handleTogglSync}
              onTogglImportEntry={handleTogglImportEntry}
              onTogglImportAll={handleTogglImportAll}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[12px] text-[#6f7a73] px-8 text-center">
              Select an existing invoice or click + New Invoice to start editing.
            </div>
          )}
          <div className="shrink-0 border-t border-[#d6ddd5] flex items-center px-1.5 py-2">
            <button
              type="button"
              className="h-7 w-7 inline-flex items-center justify-center rounded-md text-[#6f7a73] hover:text-[#2f5168] hover:bg-[#e8eeeb] transition-colors"
              onClick={() => setSecondaryPanelCollapsed(!secondaryPanelCollapsed)}
              title={
                secondaryPanelCollapsed
                  ? "Expand secondary panel"
                  : "Collapse secondary panel"
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {secondaryPanelCollapsed ? (
                  <polyline points="9 18 15 12 9 6" />
                ) : (
                  <polyline points="15 18 9 12 15 6" />
                )}
              </svg>
            </button>
          </div>
        </aside>

        {/* Preview area */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[#e6e6e6]">
          <div className="flex-1 overflow-auto p-8 flex flex-col items-center bg-[#f0f0f0]">
          {selectedClient && isInvoiceOpen && (
            <div className="w-[595px] mb-4 flex justify-center">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] border ${
                  invoiceSaveStatus === "saving"
                    ? "bg-[#eef3ef] text-[#4f5d55] border-[#d7e0d5]"
                    : invoiceSaveStatus === "error"
                      ? "bg-[#f7ecea] text-[#8a2d2d] border-[#ebc9c5]"
                      : "bg-[#edf3ef] text-[#2f6a4b] border-[#d5e4db]"
                }`}
                title={invoiceSaveError ?? undefined}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    invoiceSaveStatus === "saving"
                      ? "bg-[#6b7b73] animate-pulse"
                      : invoiceSaveStatus === "error"
                        ? "bg-[#a83d3d]"
                        : "bg-[#2f6a4b]"
                  }`}
                  aria-hidden="true"
                />
                <span>
                  {invoiceSaveStatus === "saving"
                    ? "Saving changes..."
                    : invoiceSaveStatus === "error"
                      ? "Auto-save failed"
                      : "All changes saved"}
                </span>
              </div>
            </div>
          )}
          {selectedClient && isInvoiceOpen ? (
            <InvoicePreview
              invoice={invoice}
              client={selectedClient}
              companySettings={companySettings}
              totalHours={totalHours}
              balanceDue={balanceDue}
              updateField={updateField}
              addLineItem={addLineItem}
              removeLineItem={removeLineItem}
              updateLineItem={updateLineItem}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select or create a client to preview the invoice
            </div>
          )}
        </div>
        {/* Floating bottom action toolbar */}
        {selectedClient && isInvoiceOpen && (
          <div className="absolute inset-x-0 bottom-5 z-20 pointer-events-none flex justify-center px-4">
            <div
              className="pointer-events-auto w-fit bg-[rgba(87,94,85,0.24)] border border-[rgba(255,255,255,0.24)] backdrop-blur-[38px] backdrop-saturate-[1.35] shadow-[0_12px_30px_rgba(35,49,42,0.14)] rounded-[999px] px-2.5 py-2 flex items-center gap-2"
              style={{
                backdropFilter: "blur(38px) saturate(1.35)",
                WebkitBackdropFilter: "blur(38px) saturate(1.35)",
              }}
            >
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
      </div>

      {/* Clear all entries dialog */}
      {clearEntriesConfirmOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(19,28,24,0.42)] px-4">
          <div className="w-full max-w-md rounded-xl border border-[#d6ddd5] bg-[#f8faf6] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
            <h2 className="text-[15px] font-semibold text-[#1f2f28]">Clear All Entries</h2>
            <p className="mt-1 text-[12px] text-[#5f6c65]">
              This will remove all imported and manual entries from the current invoice.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="h-9 px-4 rounded-lg border border-[#d3ddd3] text-[12px] text-[#415049] hover:bg-[#eef3ef] transition-colors"
                onClick={() => setClearEntriesConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-[#8a2d2d] text-white text-[12px] font-medium hover:bg-[#6f2323] transition-colors"
                onClick={handleConfirmClearAllEntries}
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}

      <CompanySettingsModal
        open={companySettingsOpen}
        loading={companySettingsLoading}
        saving={companySettingsSaving}
        initialSettings={companySettings}
        initialTogglToken={toggl.config.apiToken}
        initialMinimaxApiKey={initialMinimaxApiKey}
        initialMinimaxModel={initialMinimaxModel}
        onClose={() => setCompanySettingsOpen(false)}
        onSave={handleSaveCompanySettings}
      />

      {/* Rename invoice dialog */}
      {renameTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(19,28,24,0.42)] px-4">
          <div className="w-full max-w-md rounded-xl border border-[#d6ddd5] bg-[#f8faf6] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
            <h2 className="text-[15px] font-semibold text-[#1f2f28]">Rename Invoice</h2>
            <p className="mt-1 text-[12px] text-[#5f6c65]">
              This name is for internal reference only and will not appear on the invoice.
            </p>
            <form
              className="mt-3 flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmRename();
              }}
            >
              <input
                className="h-10 rounded-lg border border-[#d7e0d5] bg-white px-3 text-[13px] text-[#22332b] outline-none focus:border-[#31566f]"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Invoice name"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg border border-[#d3ddd3] text-[12px] text-[#415049] hover:bg-[#eef3ef] transition-colors"
                  onClick={() => setRenameTarget(null)}
                  disabled={renamingInvoice}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[#31566f] text-white text-[12px] font-medium hover:bg-[#274a60] transition-colors disabled:opacity-60"
                  disabled={renamingInvoice}
                >
                  {renamingInvoice ? "Saving..." : "Save name"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete invoice dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(19,28,24,0.42)] px-4">
          <div className="w-full max-w-md rounded-xl border border-[#d6ddd5] bg-[#f8faf6] p-4 shadow-[0_16px_40px_rgba(15,23,42,0.18)]">
            <h2 className="text-[15px] font-semibold text-[#1f2f28]">Delete Invoice</h2>
            <p className="mt-1 text-[12px] text-[#5f6c65]">
              Delete &ldquo;{getReferenceName(deleteTarget)}&rdquo;? This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="h-9 px-4 rounded-lg border border-[#d3ddd3] text-[12px] text-[#415049] hover:bg-[#eef3ef] transition-colors"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingInvoice}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-[#8a2d2d] text-white text-[12px] font-medium hover:bg-[#6f2323] transition-colors disabled:opacity-60"
                onClick={handleConfirmDelete}
                disabled={deletingInvoice}
              >
                {deletingInvoice ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

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

    </div>
  );
}
