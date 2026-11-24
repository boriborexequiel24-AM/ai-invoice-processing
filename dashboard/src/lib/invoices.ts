import { adminClient, publicClient } from "./supabase";
import type { Invoice, InvoiceEvent, InvoiceStatus, LineItem } from "./types";

// Only display columns. Internal ones (file path, raw AI output, IP hash) aren't readable with the public key anyway.
const INVOICE_COLUMNS =
  "id,source,status,file_name,vendor_id,vendor_name_raw,invoice_number,invoice_date,due_date,currency," +
  "subtotal,tax,total,po_number,confidence,flags,xero_url,decided_by,decided_at,expires_at,created_at";

export const FILTERS = {
  all: { label: "All", statuses: null },
  open: { label: "Waiting for approval", statuses: ["ready_for_approval", "needs_review", "flagged"] },
  flagged: { label: "Flagged", statuses: ["flagged"] },
  done: { label: "Approved", statuses: ["approved", "posted"] },
  rejected: { label: "Rejected", statuses: ["rejected"] },
} satisfies Record<string, { label: string; statuses: InvoiceStatus[] | null }>;

export type FilterKey = keyof typeof FILTERS;

export function isFilterKey(value: unknown): value is FilterKey {
  return typeof value === "string" && value in FILTERS;
}

export async function listInvoices(filter: FilterKey): Promise<Invoice[]> {
  let query = publicClient().from("invoices").select(INVOICE_COLUMNS).order("created_at", { ascending: false }).limit(100);
  const statuses = FILTERS[filter].statuses;
  if (statuses) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(`Could not load invoices: ${error.message}`);
  return (data ?? []) as unknown as Invoice[];
}

export type Metrics = {
  processed: number;
  waiting: number;
  flagged: number;
  posted: number;
  avgSeconds: number | null;
  avgCostUsd: number | null;
};

// Until 2026-11-13 17:37 UTC a retry setting made every read cost three AI calls
// (docs/extraction-eval.md), so earlier readings don't describe this pipeline.
const READS_SINCE = "2026-11-14T00:00:00Z";
const READS_AVERAGED = 100;

export async function getMetrics(): Promise<Metrics> {
  const db = publicClient();

  // Counted by the database: fetching the rows to count them stops at 1,000.
  const count = async (...statuses: InvoiceStatus[]) => {
    let query = db.from("invoices").select("id", { count: "exact", head: true });
    if (statuses.length) query = query.in("status", statuses);
    const { count: total, error } = await query;
    if (error || total === null) throw new Error(`Could not load metrics: ${error?.message || "no count returned"}`);
    return total;
  };

  const [processed, waiting, flagged, posted, { data: events, error }] = await Promise.all([
    count(),
    count("ready_for_approval", "needs_review"),
    count("flagged"),
    count("posted"),
    db
      .from("invoice_events")
      .select("details,invoices!inner(id)") // the join leaves out expired uploads
      .eq("step", "extracted")
      .gte("created_at", READS_SINCE)
      .order("created_at", { ascending: false })
      .limit(READS_AVERAGED),
  ]);
  if (error) throw new Error(`Could not load metrics: ${error.message}`);

  const reads = (events ?? []).map((e) => e.details as { seconds?: number; cost_usd?: number } | null);
  const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

  return {
    processed,
    waiting,
    flagged,
    posted,
    avgSeconds: average(reads.map((r) => r?.seconds).filter((v): v is number => typeof v === "number")),
    avgCostUsd: average(reads.map((r) => r?.cost_usd).filter((v): v is number => typeof v === "number")),
  };
}

export type Showcase = {
  clean: { invoice: Invoice; lines: LineItem[]; seconds: number | null } | null;
  flagged: Invoice | null;
};

/**
 * Real examples for the home page: the latest sample invoice that passed every
 * check (with its line items and AI read time), and the latest flagged one.
 * Visitor uploads are never used here.
 */
export async function getShowcase(): Promise<Showcase> {
  const db = publicClient();
  const { data } = await db
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .in("source", ["sample", "email"])
    .order("created_at", { ascending: false })
    .limit(40);
  const recent = (data ?? []) as unknown as Invoice[];
  const passed = recent.find(
    (inv) => ["ready_for_approval", "approved", "posted"].includes(inv.status) && !(inv.flags ?? []).length && inv.po_number,
  );
  const flagged =
    recent.find((inv) => inv.status === "flagged" && (inv.flags ?? []).some((f) => f.code === "po_amount_exceeded")) ??
    recent.find((inv) => inv.status === "flagged") ??
    null;

  if (!passed) return { clean: null, flagged };
  const [{ data: lines }, { data: read }] = await Promise.all([
    db.from("invoice_line_items").select("id,position,description,quantity,unit_price,amount").eq("invoice_id", passed.id).order("position"),
    db.from("invoice_events").select("details").eq("invoice_id", passed.id).eq("step", "extracted").limit(1).maybeSingle(),
  ]);
  const seconds = (read?.details as { seconds?: number } | null)?.seconds;
  return {
    clean: { invoice: passed, lines: (lines ?? []) as LineItem[], seconds: typeof seconds === "number" ? seconds : null },
    flagged,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getInvoice(id: string) {
  if (!UUID.test(id)) return null;
  const db = publicClient();
  const { data: invoice } = await db.from("invoices").select(INVOICE_COLUMNS).eq("id", id).maybeSingle();
  if (!invoice) return null;

  const [{ data: lines }, { data: events }] = await Promise.all([
    db.from("invoice_line_items").select("id,position,description,quantity,unit_price,amount").eq("invoice_id", id).order("position"),
    db.from("invoice_events").select("id,step,actor,details,created_at").eq("invoice_id", id).order("created_at"),
  ]);

  return {
    invoice: invoice as unknown as Invoice,
    lines: (lines ?? []) as LineItem[],
    events: (events ?? []) as InvoiceEvent[],
  };
}

/** A short-lived link to the PDF in the private storage bucket. */
export async function pdfLink(id: string): Promise<string | null> {
  const db = adminClient();
  const { data } = await db.from("invoices").select("file_path,expires_at").eq("id", id).maybeSingle();
  if (!data?.file_path) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
  const { data: signed } = await db.storage.from("invoices").createSignedUrl(data.file_path, 60 * 10);
  return signed?.signedUrl ?? null;
}
