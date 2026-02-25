export function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatHours(hours: number): string {
  return hours.toFixed(2);
}

/** Compute payment due date: issuedDate + netTerms days. Returns "YYYY-MM-DD". */
export function computePaymentDueDate(
  issuedDate: string,
  netTerms: number
): string {
  if (!issuedDate) return "";
  const d = new Date(issuedDate + "T00:00:00");
  d.setDate(d.getDate() + netTerms);
  return d.toISOString().split("T")[0];
}

/** Given "YYYY-MM", return the first day "YYYY-MM-01". */
export function servicePeriodStart(serviceMonth: string): string {
  if (!serviceMonth) return "";
  return `${serviceMonth}-01`;
}

/** Given "YYYY-MM", return the last day of that month "YYYY-MM-DD". */
export function servicePeriodEnd(serviceMonth: string): string {
  if (!serviceMonth) return "";
  const [year, month] = serviceMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${serviceMonth}-${String(lastDay).padStart(2, "0")}`;
}
