import { pdf } from "@react-pdf/renderer";
import InvoicePDF from "../components/InvoicePDF";
import type { InvoiceData, Client, CompanySettings } from "../types";

interface ExportProps {
  invoice: InvoiceData;
  client: Client;
  companySettings: CompanySettings;
  totalHours: number;
  balanceDue: number;
}

export async function exportPdf(
  props: ExportProps,
  filename: string
): Promise<void> {
  const doc = <InvoicePDF {...props} />;
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
