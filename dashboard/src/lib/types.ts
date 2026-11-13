export type InvoiceStatus =
  | "received"
  | "extracting"
  | "extracted"
  | "ready_for_approval"
  | "needs_review"
  | "flagged"
  | "approved"
  | "rejected"
  | "posted"
  | "failed";

export type Flag = { code: string; message: string };

export type Invoice = {
  id: string;
  source: "upload" | "sample" | "email";
  status: InvoiceStatus;
  file_name: string | null;
  vendor_name_raw: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  po_number: string | null;
  confidence: Record<string, number> | null;
  flags: Flag[] | null;
  xero_url: string | null;
  decided_by: string | null;
  decided_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type LineItem = {
  id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price: number | null;
  amount: number;
};

export type InvoiceEvent = {
  id: number;
  step: string;
  actor: string;
  details: Record<string, unknown> | null;
  created_at: string;
};
