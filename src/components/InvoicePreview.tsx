import { forwardRef } from "react";
import type { InvoiceData } from "../types";
import { formatCurrency, formatDate, formatHours } from "../utils/format";

interface Props {
  invoice: InvoiceData;
  totalHours: number;
  balanceDue: number;
}

const InvoicePreview = forwardRef<HTMLDivElement, Props>(
  ({ invoice, totalHours, balanceDue }, ref) => {
    return (
      <div
        ref={ref}
        className="bg-white flex flex-col justify-between w-[595px] min-h-[842px] py-[10px] px-[10px] font-sans text-dark"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {/* Top content */}
        <div className="flex flex-col gap-2 w-full">
          {/* Header */}
          <div className="bg-brand-light rounded-[12px] px-5 py-4 flex flex-col gap-5">
            {/* Title row */}
            <div className="flex items-start justify-between">
              <h1 className="text-[32px] font-bold leading-8 capitalize text-dark">
                Invoice
              </h1>
              <div className="flex flex-col gap-1 items-end text-right">
                <span className="text-[10px] text-muted">Invoice Number</span>
                <span className="text-[13px] font-bold text-dark">
                  {invoice.invoiceNumber || "INV-XXXXXX"}
                </span>
              </div>
            </div>

            {/* Billing info */}
            <div className="flex items-start justify-between">
              {/* Bill to */}
              <div className="flex flex-col gap-2 items-start">
                <span className="text-[10px] text-muted uppercase">
                  Bill To
                </span>
                <div className="flex flex-col gap-2">
                  <span className="text-[14px] font-semibold text-dark">
                    {invoice.clientName || "Client Name"}
                  </span>
                  <div className="text-[10px] text-dark whitespace-pre-line">
                    {invoice.clientAddress || "Client Address"}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="flex flex-col gap-3 items-end text-[10px] text-right">
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-muted uppercase">Issued on</span>
                  <span className="font-semibold text-dark">
                    {formatDate(invoice.issuedDate)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-muted uppercase">Payment Due</span>
                  <span className="font-semibold text-dark">
                    {formatDate(invoice.paymentDueDate)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-muted uppercase">Service Period</span>
                  <span className="font-semibold text-dark">
                    {invoice.servicePeriodStart && invoice.servicePeriodEnd
                      ? `${invoice.servicePeriodStart} to ${invoice.servicePeriodEnd}`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Line items table */}
          <div className="flex flex-col w-full">
            {/* Table header */}
            <div className="flex gap-3 px-5 pt-2 text-[10px] text-muted">
              <span className="w-[80px] shrink-0">Date</span>
              <span className="flex-1">Service</span>
              <span className="w-[41px] shrink-0 text-right">Hours</span>
            </div>

            {/* Line items */}
            <div className="flex flex-col gap-[5px] px-5 pt-2">
              {invoice.lineItems
                .filter((item) => item.date || item.service || item.hours)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-3 items-start text-[11px]"
                  >
                    <span className="w-[80px] shrink-0 font-medium text-dark">
                      {item.date}
                    </span>
                    <span className="flex-1 text-muted">{item.service}</span>
                    <span className="w-[41px] shrink-0 text-right text-dark">
                      {formatHours(item.hours)}
                    </span>
                  </div>
                ))}
            </div>
          </div>

          {/* Summary */}
          <div className="flex flex-col items-end pl-[10px] w-full">
            <div className="bg-divider h-px rounded-sm w-full" />
            <div className="flex flex-col gap-2 px-5 py-2 rounded-bl-[12px] rounded-br-[12px] rounded-tr-[12px] w-[282px]">
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] text-muted">Total Hours</span>
                <span className="text-[10px] text-muted">
                  {formatHours(totalHours)}
                </span>
              </div>
              <div className="bg-divider h-px rounded-sm w-full" />
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] text-muted">Hourly Rate</span>
                <span className="text-[10px] text-muted">
                  {formatCurrency(invoice.hourlyRate)}
                </span>
              </div>
            </div>
            {/* Balance due */}
            <div className="bg-brand rounded-[8px] px-5 py-3 w-[282px]">
              <div className="flex items-center justify-between w-full">
                <span className="text-[12px] font-semibold text-white">
                  Balance Due
                </span>
                <span className="text-[16px] font-bold text-white">
                  {formatCurrency(balanceDue)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Payment Info */}
        <div className="flex flex-col gap-3 pt-3 px-5 overflow-hidden">
          <div className="flex gap-3 w-full">
            {/* Company details */}
            <div className="flex-1 flex flex-col gap-2">
              <div className="text-[14px] font-bold text-dark">
                <div>Example Studio</div>
                <div>Design &amp; Consulting</div>
              </div>
              <div className="text-[10px] text-dark">
                <div>123 Example Street</div>
                <div>San Francisco, CA 94105</div>
              </div>
              <span className="text-[10px] text-link">
                billing@example.com
              </span>
              <div className="flex gap-1 text-[10px]">
                <span className="text-muted">EIN</span>
                <span className="text-dark">00-0000000</span>
              </div>
            </div>

            {/* Payment instructions */}
            <div className="flex-1 flex flex-col gap-2">
              <span className="text-[12px] font-semibold text-dark">
                Payment Instructions
              </span>
              <p className="text-[10px] text-muted m-0">
                Use these details to send ACH transfers to Example Studio Design
                &amp; Consulting LLC's checking account.
              </p>
              <div className="flex gap-9 text-[10px]">
                <div className="flex flex-col gap-0.5 w-[110px]">
                  <span className="text-muted">Routing number</span>
                  <span className="font-medium text-dark">000000000</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Account number</span>
                  <span className="font-medium text-dark">000000000000</span>
                </div>
              </div>
              <div className="flex gap-9 text-[10px]">
                <div className="flex flex-col gap-0.5 w-[110px]">
                  <span className="text-muted">Receiving bank</span>
                  <span className="text-dark">Example Bank</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Bank address</span>
                  <div className="text-dark">
                    <div>100 Bank Street</div>
                    <div>San Francisco, CA 94105</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

InvoicePreview.displayName = "InvoicePreview";

export default InvoicePreview;
