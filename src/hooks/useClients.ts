import { useState, useCallback } from "react";
import type { Client } from "../types";

const REPO_CLIENT_MODULES = import.meta.glob("../config/clients/*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

function isValidNetTerms(v: unknown): v is 15 | 30 | 45 | 60 {
  return v === 15 || v === 30 || v === 45 || v === 60;
}

function toClient(raw: unknown, source: string): Client | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.id !== "string" ||
    typeof obj.name !== "string" ||
    typeof obj.address !== "string" ||
    typeof obj.themeColor !== "string" ||
    typeof obj.hourlyRate !== "number" ||
    !isValidNetTerms(obj.netTerms)
  ) {
    console.warn(`[clients] Invalid client config skipped: ${source}`);
    return null;
  }
  return {
    id: obj.id,
    name: obj.name,
    address: obj.address,
    logoDataUrl: typeof obj.logoDataUrl === "string" ? obj.logoDataUrl : undefined,
    themeColor: obj.themeColor,
    hourlyRate: obj.hourlyRate,
    netTerms: obj.netTerms,
  };
}

function loadClientsFromRepo(): Client[] {
  const parsed = Object.entries(REPO_CLIENT_MODULES)
    .map(([source, raw]) => toClient(raw, source))
    .filter((c): c is Client => c !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
  const unique: Client[] = [];
  const seen = new Set<string>();
  for (const client of parsed) {
    if (seen.has(client.id)) {
      console.warn(`[clients] Duplicate client id skipped: ${client.id}`);
      continue;
    }
    seen.add(client.id);
    unique.push(client);
  }
  return unique;
}

async function persistClientsToRepo(clients: Client[]): Promise<void> {
  try {
    const res = await fetch("/__invoicer/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clients }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[clients] failed to persist configs:", text);
    }
  } catch (err) {
    console.error("[clients] failed to persist configs:", err);
  }
}

let nextId = 1;
function generateClientId(): string {
  return `client-${Date.now()}-${nextId++}`;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>(loadClientsFromRepo);

  const addClient = useCallback((draft: Omit<Client, "id">): Client => {
    const client: Client = { ...draft, id: generateClientId() };
    setClients((prev) => {
      const next = [...prev, client];
      void persistClientsToRepo(next);
      return next;
    });
    return client;
  }, []);

  const updateClient = useCallback(
    (id: string, partial: Partial<Omit<Client, "id">>) => {
      setClients((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, ...partial } : c));
        void persistClientsToRepo(next);
        return next;
      });
    },
    []
  );

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== id);
      void persistClientsToRepo(next);
      return next;
    });
  }, []);

  const getClient = useCallback(
    (id: string): Client | undefined => {
      return clients.find((c) => c.id === id);
    },
    [clients]
  );

  return { clients, addClient, updateClient, deleteClient, getClient };
}
