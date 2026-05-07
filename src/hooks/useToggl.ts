import { useState, useCallback, useEffect } from "react";
import type { TogglConfig, TogglClient, TogglTimeEntry, LineItem } from "../types";

const STORAGE_KEY = "invoicer-toggl";
// Use Vite dev proxy to avoid CORS; in production you'd need your own proxy
const BASE_URL = "/toggl-api/api/v9";
const TOGGL_TIME_ZONE = "America/Los_Angeles";

const ENV_TOKEN = import.meta.env.VITE_TOGGL_API_TOKEN as string | undefined;

function loadConfig(): TogglConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fall through to default
  }
  // Bootstrap from .env.local if localStorage is empty
  if (ENV_TOKEN) {
    const initial: TogglConfig = { enabled: true, apiToken: ENV_TOKEN, clientMap: {} };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  return { enabled: false, apiToken: "", clientMap: {} };
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
  key: string;
  date: string; // YYYY-MM-DD
  hours: number;
  descriptions: string[];
}

const TOGGL_TZ_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: TOGGL_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getTogglTimeZoneParts(date: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts: Partial<Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>> =
    {};

  for (const part of TOGGL_TZ_FORMATTER.formatToParts(date)) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute" ||
      part.type === "second"
    ) {
      parts[part.type] = Number(part.value);
    }
  }

  return {
    year: parts.year ?? 0,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

/**
 * Convert a clock time in `TOGGL_TIME_ZONE` into an exact UTC instant.
 * Iteration handles daylight-saving transitions around midnight boundaries.
 */
function timeZoneDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = target;

  for (let i = 0; i < 4; i++) {
    const localParts = getTogglTimeZoneParts(new Date(candidate));
    const represented = Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
      localParts.second
    );
    const diff = target - represented;
    if (diff === 0) return new Date(candidate);
    candidate += diff;
  }

  return new Date(candidate);
}

function toTogglApiBoundaryTimestamp(year: number, month: number, day: number): string {
  const utc = timeZoneDateTimeToUtc(year, month, day, 0, 0, 0);
  return utc.toISOString();
}

function toTogglDateKey(dateTime: string): string {
  const d = new Date(dateTime);
  if (Number.isNaN(d.getTime())) {
    return dateTime.slice(0, 10);
  }
  const parts = getTogglTimeZoneParts(d);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function isWithinServicePeriod(dateKey: string, startKey: string, endKey: string): boolean {
  return dateKey >= startKey && dateKey <= endKey;
}

/** Group raw Toggl entries by day into one importable row per date. */
function aggregateByDate(entries: TogglTimeEntry[]): AggregatedEntry[] {
  const map = new Map<string, { seconds: number; descs: string[] }>();

  for (const e of entries) {
    if (e.duration < 0) continue; // skip running timers
    const date = toTogglDateKey(e.start);
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
      key: date,
      date,
      hours: Math.round((seconds / 3600) * 100) / 100,
      descriptions: [...new Set(descs)],
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
  const [syncError, setSyncError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!config.apiToken) {
      setTokenValid(null);
      setWorkspaceId(null);
      setTogglClients([]);
      return;
    }
    if (tokenValid === null && !validating) {
      void validateToken(config.apiToken);
    }
  }, [config.apiToken, tokenValid, validating, validateToken]);

  /** Fetch time entries for a service month range */
  const fetchEntries = useCallback(
    async (
      serviceMonth: string,
      serviceMonthEnd: string | undefined,
      togglClientId: number | undefined
    ) => {
      if (!config.apiToken) {
        setSyncError("Missing Toggl API token. Open settings and connect.");
        return;
      }
      setFetching(true);
      setPendingEntries([]);
      setSyncError(null);
      try {
        // serviceMonth/serviceMonthEnd are "YYYY-MM"
        const [startYear, startMonth] = serviceMonth.split("-").map(Number);
        const rangeEnd = serviceMonthEnd || serviceMonth;
        const [endYear, endMonth] = rangeEnd.split("-").map(Number);
        const startKey = `${startYear}-${pad2(startMonth)}-01`;
        const endDay = new Date(endYear, endMonth, 0).getDate();
        const endInclusiveKey = `${rangeEnd}-${pad2(endDay)}`;

        // Query Toggl using explicit RFC3339 boundaries aligned to LA local midnight.
        const startDate = toTogglApiBoundaryTimestamp(startYear, startMonth, 1);
        const nextMonth = new Date(endYear, endMonth, 1);
        const endDate = toTogglApiBoundaryTimestamp(
          nextMonth.getFullYear(),
          nextMonth.getMonth() + 1,
          nextMonth.getDate()
        );

        const params = new URLSearchParams({
          start_date: startDate,
          end_date: endDate,
        });
        const url = `${BASE_URL}/me/time_entries?${params.toString()}`;

        const res = await fetch(url, {
          headers: authHeaders(config.apiToken),
        });
        if (!res.ok) {
          setSyncError(`Sync failed (${res.status}). Check token and try again.`);
          return;
        }

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

        const periodAligned = filtered.filter((e) =>
          isWithinServicePeriod(toTogglDateKey(e.start), startKey, endInclusiveKey)
        );

        const rows = aggregateByDate(periodAligned);
        setPendingEntries(rows);
        setHasFetched(true);
      } catch {
        setSyncError("Sync failed due to a network or proxy issue.");
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
      service: e.descriptions.join(", "),
      hours: e.hours,
      togglKey: e.key,
    }));
  }, []);

  const clearPending = useCallback(() => {
    setPendingEntries([]);
    setHasFetched(false);
    setSyncError(null);
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
    syncError,
    fetchEntries,
    toLineItems,
    clearPending,
  };
}
