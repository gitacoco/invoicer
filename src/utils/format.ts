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

/**
 * Given start month "YYYY-MM" and optional end month "YYYY-MM",
 * return the last day of the end month as "YYYY-MM-DD".
 */
export function servicePeriodEnd(
  serviceMonth: string,
  serviceMonthEnd?: string
): string {
  const targetMonth = serviceMonthEnd || serviceMonth;
  if (!targetMonth) return "";
  const [year, month] = targetMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${targetMonth}-${String(lastDay).padStart(2, "0")}`;
}
