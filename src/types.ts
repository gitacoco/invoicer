export interface Client {
  id: string;
  name: string;
  address: string;
  logoDataUrl?: string;
  themeColor: string;
  hourlyRate: number;
  netTerms: NetTerms;
}

export interface LineItem {
  id: string;
  date: string;
  service: string;
  hours: number;
  togglKey?: string;
}

export type NetTerms = 15 | 30 | 45 | 60;

export interface InvoiceData {
  clientId: string;
  invoiceNumber: string;
  issuedDate: string;
  serviceMonth: string; // "YYYY-MM" format
  serviceMonthEnd?: string; // optional end month for a contiguous range
  lineItems: LineItem[];
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
