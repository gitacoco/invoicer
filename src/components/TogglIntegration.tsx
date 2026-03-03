import { useState, useEffect } from "react";
import type { Client, TogglConfig, TogglClient } from "../types";
import type { AggregatedEntry } from "../hooks/useToggl";

/* ── Toggl Settings Panel (shown in a modal) ── */

interface SettingsProps {
  open: boolean;
  onClose: () => void;
  config: TogglConfig;
  updateConfig: (partial: Partial<TogglConfig>) => void;
  validating: boolean;
  tokenValid: boolean | null;
  validateToken: (token: string) => Promise<void>;
  togglClients: TogglClient[];
  clients: Client[];
}

export function TogglSettingsModal({
  open,
  onClose,
  config,
  updateConfig,
  validating,
  tokenValid,
  validateToken,
  togglClients,
  clients,
}: SettingsProps) {
  const [tokenDraft, setTokenDraft] = useState(config.apiToken);

  useEffect(() => {
    if (open) setTokenDraft(config.apiToken);
  }, [open, config.apiToken]);

  // Re-validate on open if we already have a token
  useEffect(() => {
    if (open && config.apiToken && tokenValid === null) {
      validateToken(config.apiToken);
    }
  }, [open, config.apiToken, tokenValid, validateToken]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-[440px] max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
        <h3 className="text-base font-bold text-dark">Toggl Track Settings</h3>

        {/* API Token */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-gray-500">API Token</span>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 font-mono"
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              placeholder="Paste your Toggl API token"
            />
            <button
              className="shrink-0 bg-brand text-white rounded-lg px-3 py-2 text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50"
              disabled={!tokenDraft.trim() || validating}
              onClick={async () => {
                const t = tokenDraft.trim();
                updateConfig({ apiToken: t });
                await validateToken(t);
              }}
            >
              {validating ? "Verifying..." : "Connect"}
            </button>
          </div>
        </div>

        {/* Client mapping */}
        {tokenValid && togglClients.length > 0 && (
          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Client Mapping
            </span>
            <p className="text-[11px] text-gray-500">
              Map each Invoice Builder client to a Toggl Track client.
              Only time entries from matched projects will be imported.
            </p>
            {clients.map((c) => (
              <label key={c.id} className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">{c.name}</span>
                <select
                  className="appearance-none border border-gray-200 rounded-lg px-3 pr-8 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%236b7280%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M4.5%206l3.5%203.5L11.5%206%22%20stroke%3D%22%236b7280%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat"
                  value={config.clientMap[c.id] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const newMap = { ...config.clientMap };
                    if (val) {
                      newMap[c.id] = Number(val);
                    } else {
                      delete newMap[c.id];
                    }
                    updateConfig({ clientMap: newMap });
                  }}
                >
                  <option value="">— Not mapped —</option>
                  {togglClients.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      {tc.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        <button
          className="mt-2 self-end px-4 py-2.5 text-sm text-gray-500 hover:text-dark transition-colors"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* ── Toggl Sync Prompt (inline in InvoiceForm) ── */

interface SyncProps {
  enabled: boolean;
  fetching: boolean;
  hasFetched: boolean;
  pendingEntries: AggregatedEntry[];
  error?: string | null;
  onSync: () => void;
  onImport: () => void;
}

export function TogglSyncPrompt({
  enabled,
  fetching,
  hasFetched,
  pendingEntries,
  error,
  onSync,
  onImport,
}: SyncProps) {
  if (!enabled) return null;

  if (fetching) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-purple-600 px-1">
        <span>Syncing from Toggl...</span>
      </div>
    );
  }

  if (!hasFetched) {
    return (
      <div className="flex flex-col gap-1 px-1">
        <button
          className="text-[11px] text-purple-600 hover:text-purple-800 transition-colors text-left"
          onClick={onSync}
        >
          Sync from Toggl Track
        </button>
        {error && <span className="text-[10px] text-red-500">{error}</span>}
      </div>
    );
  }

  if (pendingEntries.length > 0) {
    return (
      <div className="flex flex-col gap-1.5 bg-purple-50 rounded-lg px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-purple-700">
            <strong>{pendingEntries.length}</strong> new{" "}
            {pendingEntries.length === 1 ? "entry" : "entries"} from Toggl
          </span>
          <div className="flex items-center gap-2">
            <button
              className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
              onClick={onSync}
            >
              Refresh
            </button>
            <button
              className="bg-purple-600 text-white rounded px-2 py-0.5 text-[11px] font-semibold hover:bg-purple-700 transition-colors"
              onClick={onImport}
            >
              Import
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-gray-400">Up to date</span>
        <button
          className="text-[10px] text-purple-600 hover:text-purple-800 transition-colors"
          onClick={onSync}
        >
          Sync again
        </button>
      </div>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}
