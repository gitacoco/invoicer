export interface LineItem {
  id: string;
  date: string;
  service: string;
  hours: number;
}

export interface InvoiceData {
  clientName: string;
  clientAddress: string;
  invoiceNumber: string;
  issuedDate: string;
  paymentDueDate: string;
  servicePeriodStart: string;
  servicePeriodEnd: string;
  lineItems: LineItem[];
  hourlyRate: number;
}

export interface SavedInvoice {
  key: string;
  label: string;
  data: InvoiceData;
  savedAt: string;
}
