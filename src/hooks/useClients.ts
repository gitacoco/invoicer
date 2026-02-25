import { useState, useCallback } from "react";
import type { Client } from "../types";

const STORAGE_KEY = "invoicer-clients";

const DEFAULT_CLIENTS: Client[] = [
  {
    id: "acme-consulting",
    name: "Acme Consulting",
    address: "500 Market Street\nSuite 100\nSan Francisco, CA 94105",
    themeColor: "#006b51",
    hourlyRate: 150,
    netTerms: 30,
  },
];

function loadClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_CLIENTS;
  } catch {
    return DEFAULT_CLIENTS;
  }
}

function saveClients(clients: Client[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
}

let nextId = 1;
function generateClientId(): string {
  return `client-${Date.now()}-${nextId++}`;
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>(loadClients);

  const addClient = useCallback((draft: Omit<Client, "id">): Client => {
    const client: Client = { ...draft, id: generateClientId() };
    setClients((prev) => {
      const next = [...prev, client];
      saveClients(next);
      return next;
    });
    return client;
  }, []);

  const updateClient = useCallback(
    (id: string, partial: Partial<Omit<Client, "id">>) => {
      setClients((prev) => {
        const next = prev.map((c) =>
          c.id === id ? { ...c, ...partial } : c
        );
        saveClients(next);
        return next;
      });
    },
    []
  );

  const deleteClient = useCallback((id: string) => {
    setClients((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveClients(next);
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
