export interface Client {
  id: string;
  name: string;
  address: string;
  logoDataUrl?: string;
  themeColor: string;
}

export interface LineItem {
  id: string;
  date: string;
  service: string;
  hours: number;
}

export type NetTerms = 15 | 30 | 45 | 60;

export interface InvoiceData {
  clientId: string;
  invoiceNumber: string;
  issuedDate: string;
  netTerms: NetTerms;
  serviceMonth: string; // "YYYY-MM" format
  lineItems: LineItem[];
  hourlyRate: number;
}

export interface SavedInvoice {
  key: string;
  label: string;
  data: InvoiceData;
  savedAt: string;
}

/* ── Toggl Track Integration ── */

export interface TogglConfig {
  enabled: boolean;
  apiToken: string;
  /** Map our Client.id → Toggl client id */
  clientMap: Record<string, number>;
}

export interface TogglClient {
  id: number;
  name: string;
}

export interface TogglTimeEntry {
  id: number;
  description: string | null;
  start: string;
  stop: string | null;
  duration: number;
  project_id: number | null;
  workspace_id: number;
}
