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

export const STATUS: Record<InvoiceStatus, { label: string; tone: string }> = {
  received: { label: "Received", tone: "bg-slate-100 text-slate-700 ring-slate-200" },
  extracting: { label: "Reading", tone: "bg-slate-100 text-slate-700 ring-slate-200" },
  extracted: { label: "Checking", tone: "bg-slate-100 text-slate-700 ring-slate-200" },
  ready_for_approval: { label: "Ready for approval", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  needs_review: { label: "Needs review", tone: "bg-amber-50 text-amber-800 ring-amber-200" },
  flagged: { label: "Flagged", tone: "bg-red-50 text-red-700 ring-red-200" },
  approved: { label: "Approved", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  rejected: { label: "Rejected", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
  posted: { label: "Posted to Xero", tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  failed: { label: "Failed", tone: "bg-red-50 text-red-700 ring-red-200" },
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
