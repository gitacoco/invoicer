import { useState, useCallback } from "react";
import type { TogglConfig, TogglClient, TogglTimeEntry, LineItem } from "../types";

const STORAGE_KEY = "invoicer-toggl";
// Use Vite dev proxy to avoid CORS; in production you'd need your own proxy
const BASE_URL = "/toggl-api/api/v9";

function loadConfig(): TogglConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw
      ? JSON.parse(raw)
      : { enabled: false, apiToken: "", clientMap: {} };
  } catch {
    return { enabled: false, apiToken: "", clientMap: {} };
  }
}

function saveConfig(config: TogglConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: "Basic " + btoa(token + ":api_token"),
    "Content-Type": "application/json",
  };
}

export interface AggregatedEntry {
  date: string; // YYYY-MM-DD
  hours: number;
  descriptions: string[];
}

/** Group Toggl entries by date, sum durations, collect descriptions. */
function aggregateByDate(
  entries: TogglTimeEntry[],
  existingDates: Set<string>
): AggregatedEntry[] {
  const map = new Map<string, { seconds: number; descs: string[] }>();

  for (const e of entries) {
    // Skip running timers (negative duration)
    if (e.duration < 0) continue;
    const date = e.start.slice(0, 10); // "YYYY-MM-DD"
    if (existingDates.has(date)) continue;

    const existing = map.get(date);
    if (existing) {
      existing.seconds += e.duration;
      if (e.description) existing.descs.push(e.description);
    } else {
      map.set(date, {
        seconds: e.duration,
        descs: e.description ? [e.description] : [],
      });
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { seconds, descs }]) => ({
      date,
      hours: Math.round((seconds / 3600) * 100) / 100,
      descriptions: [...new Set(descs)], // deduplicate identical descriptions
    }));
}

let nextId = 1;
function generateId(): string {
  return `toggl-${Date.now()}-${nextId++}`;
}

export function useToggl() {
  const [config, setConfig] = useState<TogglConfig>(loadConfig);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [togglClients, setTogglClients] = useState<TogglClient[]>([]);
  const [validating, setValidating] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [fetching, setFetching] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<AggregatedEntry[]>([]);

  const updateConfig = useCallback((partial: Partial<TogglConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...partial };
      saveConfig(next);
      return next;
    });
  }, []);

  /** Validate API token: GET /me → get default_workspace_id, then fetch clients */
  const validateToken = useCallback(async (token: string) => {
    setValidating(true);
    setTokenValid(null);
    try {
      const meRes = await fetch(`${BASE_URL}/me`, {
        headers: authHeaders(token),
      });
      if (!meRes.ok) {
        setTokenValid(false);
        return;
      }
      const me = await meRes.json();
      const wsId = me.default_workspace_id as number;
      setWorkspaceId(wsId);

      // Fetch Toggl clients for the workspace
      const clientsRes = await fetch(
        `${BASE_URL}/workspaces/${wsId}/clients`,
        { headers: authHeaders(token) }
      );
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        // The API might return null for empty client list
        setTogglClients(
          Array.isArray(data)
            ? data.map((c: { id: number; name: string }) => ({
                id: c.id,
                name: c.name,
              }))
            : []
        );
      }
      setTokenValid(true);
    } catch {
      setTokenValid(false);
    } finally {
      setValidating(false);
    }
  }, []);

  /** Fetch time entries for a service month and aggregate by date */
  const fetchEntries = useCallback(
    async (
      serviceMonth: string,
      togglClientId: number | undefined,
      existingDates: Set<string>
    ) => {
      if (!config.apiToken) return;
      setFetching(true);
      setPendingEntries([]);
      try {
        // serviceMonth is "YYYY-MM"
        const [year, month] = serviceMonth.split("-").map(Number);
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        // End date: first day of next month
        const nextMonth = new Date(year, month, 1);
        const endDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-${String(nextMonth.getDate()).padStart(2, "0")}`;

        const url = new URL(`${BASE_URL}/me/time_entries`);
        url.searchParams.set("start_date", startDate);
        url.searchParams.set("end_date", endDate);

        const res = await fetch(url.toString(), {
          headers: authHeaders(config.apiToken),
        });
        if (!res.ok) return;

        const allEntries: TogglTimeEntry[] = await res.json();

        // Filter by Toggl client if mapped
        // The Toggl time entries API doesn't directly filter by client,
        // but entries have project_id. We'd need to cross-reference projects → client.
        // For simplicity, if togglClientId is set, we fetch projects and filter.
        let filtered = allEntries;
        if (togglClientId != null && workspaceId) {
          const projRes = await fetch(
            `${BASE_URL}/workspaces/${workspaceId}/projects`,
            { headers: authHeaders(config.apiToken) }
          );
          if (projRes.ok) {
            const projects: { id: number; client_id: number | null }[] =
              await projRes.json();
            const projectIds = new Set(
              projects
                .filter((p) => p.client_id === togglClientId)
                .map((p) => p.id)
            );
            filtered = allEntries.filter(
              (e) => e.project_id != null && projectIds.has(e.project_id)
            );
          }
        }

        const aggregated = aggregateByDate(filtered, existingDates);
        setPendingEntries(aggregated);
        setHasFetched(true);
      } finally {
        setFetching(false);
      }
    },
    [config.apiToken, workspaceId]
  );

  /** Convert aggregated entries to LineItems */
  const toLineItems = useCallback((entries: AggregatedEntry[]): LineItem[] => {
    return entries.map((e) => ({
      id: generateId(),
      date: e.date,
      service: e.descriptions.join("; "),
      hours: e.hours,
    }));
  }, []);

  const clearPending = useCallback(() => {
    setPendingEntries([]);
    setHasFetched(false);
  }, []);

  return {
    config,
    updateConfig,
    workspaceId,
    togglClients,
    validating,
    tokenValid,
    validateToken,
    fetching,
    hasFetched,
    pendingEntries,
    fetchEntries,
    toLineItems,
    clearPending,
  };
}
