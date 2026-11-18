import type { InvoiceStatus } from "./types";

export function money(value: number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined) return "-";
  const amount = Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${amount} ${currency}` : amount;
}

export function date(value: string | null | undefined): string {
  if (!value) return "-";
  // Plain dates (YYYY-MM-DD) are shown as-is in the invoice's calendar, not shifted by time zone.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

// Status labels, drawn as small rubber stamps (see StatusBadge).
export const STATUS: Record<InvoiceStatus, { label: string; tone: string }> = {
  received: { label: "Received", tone: "text-muted border-rule" },
  extracting: { label: "Reading", tone: "text-muted border-rule" },
  extracted: { label: "Checking", tone: "text-muted border-rule" },
  ready_for_approval: { label: "Ready for approval", tone: "text-pass border-pass" },
  needs_review: { label: "Needs review", tone: "text-warn border-warn" },
  flagged: { label: "Flagged", tone: "text-pen border-pen" },
  approved: { label: "Approved", tone: "text-ink border-ink" },
  rejected: { label: "Rejected", tone: "text-muted border-muted" },
  posted: { label: "Posted to Xero", tone: "text-ink border-ink bg-mark" },
  failed: { label: "Failed", tone: "text-pen border-pen" },
};

/** Plain-English labels for the history timeline. */
export const STEP_LABELS: Record<string, string> = {
  received: "File received",
  extracted: "Read by AI",
  validated: "Checked",
  approved: "Approved",
  rejected: "Rejected",
  posted: "Posted to Xero",
  error: "Error",
};

export const FIELD_LABELS: Record<string, string> = {
  vendor_name: "Vendor",
  invoice_number: "Invoice number",
  invoice_date: "Invoice date",
  due_date: "Due date",
  po_number: "PO number",
  currency: "Currency",
  subtotal: "Subtotal",
  tax: "Tax",
  total: "Total",
  line_items: "Line items",
};
