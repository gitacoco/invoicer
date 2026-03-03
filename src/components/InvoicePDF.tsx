import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { InvoiceData, Client } from "../types";
import {
  formatCurrency,
  formatDate,
  formatHours,
  computePaymentDueDate,
  servicePeriodStart,
  servicePeriodEnd,
} from "../utils/format";

/* ── Register Inter font for vector PDF ── */

const INTER_BASE =
  "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-";

Font.register({
  family: "Inter",
  fonts: [
    { src: `${INTER_BASE}400-normal.ttf`, fontWeight: 400 },
    { src: `${INTER_BASE}500-normal.ttf`, fontWeight: 500 },
    { src: `${INTER_BASE}600-normal.ttf`, fontWeight: 600 },
    { src: `${INTER_BASE}700-normal.ttf`, fontWeight: 700 },
  ],
});

/* ── Colors (matching index.css theme) ── */

const COLORS = {
  dark: "#121722",
  muted: "#60737d",
  link: "#334bc8",
  divider: "#f2f5f9",
};

/** Blend a hex color at 10% opacity over white */
function hexToLightBg(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r * 0.1 + 255 * 0.9);
  const lg = Math.round(g * 0.1 + 255 * 0.9);
  const lb = Math.round(b * 0.1 + 255 * 0.9);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

/* ── Styles ── */

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    color: COLORS.dark,
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 10,
    flexDirection: "column",
    justifyContent: "space-between",
  },

  /* Header */
  header: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "column",
  },
  headerTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  invoiceTitle: { fontSize: 32, fontWeight: 700 },
  invoiceNumLabel: { fontSize: 10, color: COLORS.muted, marginBottom: 0 },
  invoiceNumValue: { fontSize: 13, fontWeight: 700 },
  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  sectionLabel: {
    fontSize: 10,
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  clientNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  clientLogo: {
    width: 16,
    height: 16,
    borderRadius: 2,
    marginRight: 4,
    objectFit: "cover",
  },
  clientName: { fontSize: 14, fontWeight: 600 },
  clientAddress: { fontSize: 10 },
  dateBlock: {
    flexDirection: "column",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 10,
    color: COLORS.muted,
    textTransform: "uppercase",
    marginBottom: 0,
  },
  dateValue: { fontSize: 10, fontWeight: 600 },

  /* Table */
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  tableHeaderText: { fontSize: 10, color: COLORS.muted },
  colDate: { width: 80 },
  colService: { flex: 1 },
  colHours: { width: 41, textAlign: "right" },
  tableBody: {
    flexDirection: "column",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  cellDate: { width: 80, fontSize: 11, fontWeight: 500 },
  cellService: { flex: 1, fontSize: 11, color: COLORS.muted },
  cellHours: { width: 41, fontSize: 11, textAlign: "right" },

  /* Summary */
  summaryWrap: {
    alignItems: "flex-end",
    paddingLeft: 10,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    borderRadius: 1,
    width: "100%",
  },
  summaryBox: {
    width: 282,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: { fontSize: 10, color: COLORS.muted },
  summaryValue: { fontSize: 10, color: COLORS.muted },
  balanceDue: {
    width: 282,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  balanceLabel: { fontSize: 12, fontWeight: 600, color: "#ffffff" },
  balanceValue: { fontSize: 16, fontWeight: 700, color: "#ffffff" },

  /* Footer */
  footer: { paddingHorizontal: 20, paddingTop: 12 },
  footerRow: { flexDirection: "row" },
  footerCol: { flex: 1, flexDirection: "column" },
  companyName: { fontSize: 14, fontWeight: 700, marginBottom: 8 },
  footerText: { fontSize: 10 },
  footerEmail: { fontSize: 10, color: COLORS.link, marginTop: 8 },
  footerMuted: { fontSize: 10, color: COLORS.muted },
  paymentTitle: { fontSize: 12, fontWeight: 600, marginBottom: 8 },
  paymentDesc: {
    fontSize: 10,
    color: COLORS.muted,
    marginBottom: 8,
    lineHeight: 1.4,
  },
  paymentGrid: {
    flexDirection: "row",
    marginBottom: 6,
  },
  paymentCol: {
    width: 110,
    flexDirection: "column",
    marginRight: 36,
  },
  paymentColWide: { flexDirection: "column" },
  einRow: { flexDirection: "row", marginTop: 8 },
});

/* ── Component ── */

interface Props {
  invoice: InvoiceData;
  client: Client;
  totalHours: number;
  balanceDue: number;
}

export default function InvoicePDF({
  invoice,
  client,
  totalHours,
  balanceDue,
}: Props) {
  const themeColor = client.themeColor || "#006b51";
  const lightBg = hexToLightBg(themeColor);
  const paymentDueDate = computePaymentDueDate(
    invoice.issuedDate,
    client.netTerms
  );
  const periodStart = servicePeriodStart(invoice.serviceMonth);
  const periodEnd = servicePeriodEnd(
    invoice.serviceMonth,
    invoice.serviceMonthEnd
  );

  const visibleItems = invoice.lineItems.filter(
    (item) => item.date || item.service || item.hours
  );

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ── Top content ── */}
        <View>
          {/* Header */}
          <View style={[s.header, { backgroundColor: lightBg }]}>
            {/* Title row */}
            <View style={s.headerTitleRow}>
              <Text style={s.invoiceTitle}>Invoice</Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.invoiceNumLabel}>Invoice Number</Text>
                <Text style={s.invoiceNumValue}>
                  {invoice.invoiceNumber || "INV-XXXXXX"}
                </Text>
              </View>
            </View>

            {/* Billing info */}
            <View style={s.billingRow}>
              {/* Bill To */}
              <View>
                <Text style={s.sectionLabel}>Bill To</Text>
                <View style={s.clientNameRow}>
                  {client.logoDataUrl && (
                    <Image src={client.logoDataUrl} style={s.clientLogo} />
                  )}
                  <Text style={s.clientName}>
                    {client.name || "Client Name"}
                  </Text>
                </View>
                <Text style={s.clientAddress}>
                  {client.address || "Client Address"}
                </Text>
              </View>

              {/* Dates */}
              <View style={{ alignItems: "flex-end" }}>
                <View style={s.dateBlock}>
                  <Text style={s.dateLabel}>Issued on</Text>
                  <Text style={s.dateValue}>
                    {formatDate(invoice.issuedDate)}
                  </Text>
                </View>
                <View style={s.dateBlock}>
                  <Text style={s.dateLabel}>Payment Due</Text>
                  <Text style={s.dateValue}>
                    {formatDate(paymentDueDate)}
                  </Text>
                </View>
                <View style={[s.dateBlock, { marginBottom: 0 }]}>
                  <Text style={s.dateLabel}>Service Period</Text>
                  <Text style={s.dateValue}>
                    {periodStart && periodEnd
                      ? `${periodStart} to ${periodEnd}`
                      : "\u2014"}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Line items table */}
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, s.colDate]}>Date</Text>
            <Text style={[s.tableHeaderText, s.colService]}>Service</Text>
            <Text style={[s.tableHeaderText, s.colHours]}>Hours</Text>
          </View>
          <View style={s.tableBody}>
            {visibleItems.map((item) => (
              <View key={item.id} style={s.tableRow}>
                <Text style={[s.cellDate, s.colDate]}>{item.date}</Text>
                <Text style={[s.cellService, s.colService]}>
                  {item.service}
                </Text>
                <Text style={[s.cellHours, s.colHours]}>
                  {formatHours(item.hours)}
                </Text>
              </View>
            ))}
          </View>

          {/* Summary */}
          <View style={s.summaryWrap}>
            <View style={s.divider} />
            <View style={s.summaryBox}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Total Hours</Text>
                <Text style={s.summaryValue}>{formatHours(totalHours)}</Text>
              </View>
            </View>
            <View style={[s.divider, { width: 282 }]} />
            <View style={s.summaryBox}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Hourly Rate</Text>
                <Text style={s.summaryValue}>
                  {formatCurrency(client.hourlyRate)}
                </Text>
              </View>
            </View>
            <View style={[s.balanceDue, { backgroundColor: themeColor }]}>
              <Text style={s.balanceLabel}>Balance Due</Text>
              <Text style={s.balanceValue}>{formatCurrency(balanceDue)}</Text>
            </View>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={s.footer}>
          <View style={s.footerRow}>
            {/* Company details */}
            <View style={s.footerCol}>
              <Text style={s.companyName}>
                Example Studio{"\n"}LLC
              </Text>
              <Text style={s.footerText}>123 Example Street</Text>
              <Text style={s.footerText}>San Francisco, CA 94105</Text>
              <Text style={s.footerEmail}>
                billing@example.com
              </Text>
              <View style={s.einRow}>
                <Text style={s.footerMuted}>EIN </Text>
                <Text style={s.footerText}>00-0000000</Text>
              </View>
            </View>

            {/* Payment instructions */}
            <View style={s.footerCol}>
              <Text style={s.paymentTitle}>Payment Instructions</Text>
              <Text style={s.paymentDesc}>
                Use these details to send ACH transfers to Example Studio Design &
                Consulting LLC's checking account.
              </Text>
              <View style={s.paymentGrid}>
                <View style={s.paymentCol}>
                  <Text style={s.footerMuted}>Routing number</Text>
                  <Text style={[s.footerText, { fontWeight: 500 }]}>
                    000000000
                  </Text>
                </View>
                <View style={s.paymentColWide}>
                  <Text style={s.footerMuted}>Account number</Text>
                  <Text style={[s.footerText, { fontWeight: 500 }]}>
                    000000000000
                  </Text>
                </View>
              </View>
              <View style={s.paymentGrid}>
                <View style={s.paymentCol}>
                  <Text style={s.footerMuted}>Receiving bank</Text>
                  <Text style={s.footerText}>Example Bank</Text>
                </View>
                <View style={s.paymentColWide}>
                  <Text style={s.footerMuted}>Bank address</Text>
                  <Text style={s.footerText}>100 Bank Street</Text>
                  <Text style={s.footerText}>San Francisco, CA 94105</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
