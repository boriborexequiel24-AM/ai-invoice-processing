import { money } from "./format";
import type { Invoice } from "./types";

// The 12 checks from the Postgres function validate_invoice (docs/validation.md),
// turned into the red-pen notes the dashboard shows. Every result comes from
// the flags and confidence scores stored on the invoice: nothing is guessed here.

export type CheckResult = { label: string; state: "pass" | "fail" | "skip"; note: string };

const PO_CODES = ["po_not_found", "po_closed", "po_vendor_mismatch", "currency_mismatch", "po_amount_exceeded"];

/** Statuses where validation has run, so the check results mean something. */
export const CHECKED = ["ready_for_approval", "needs_review", "flagged", "approved", "rejected", "posted"];

export function checkResults(inv: Invoice): CheckResult[] {
  const flags = inv.flags ?? [];
  const flag = (code: string) => flags.find((f) => f.code === code);
  const noPo = Boolean(flag("missing_po"));
  const unsure = Object.entries(inv.confidence ?? {}).filter(([, score]) => typeof score === "number" && score < 0.8);
  const lowest = Object.values(inv.confidence ?? {}).filter((s): s is number => typeof s === "number");

  const one = (label: string, code: string, passNote: string, skipped = false): CheckResult => {
    const f = flag(code);
    if (f) return { label, state: "fail", note: f.message };
    if (skipped) return { label, state: "skip", note: "no PO to check against" };
    return { label, state: "pass", note: passNote };
  };

  return [
    one("Vendor, number and total found", "missing_required_field", "all three are on it"),
    one("Known vendor", "unknown_vendor", "on the vendor list"),
    one("Line items add up", "line_items_mismatch", inv.subtotal !== null ? `they come to ${money(inv.subtotal)}` : "they match the subtotal"),
    one(
      "Subtotal plus tax equals total",
      "total_mismatch",
      inv.subtotal !== null && inv.tax !== null && inv.total !== null
        ? `${money(inv.subtotal)} + ${money(inv.tax)} = ${money(inv.total)}`
        : "it adds up",
    ),
    one("Not a duplicate", "duplicate", "never seen before"),
    one("Has a PO number", "missing_po", inv.po_number ? `${inv.po_number}` : "it has one"),
    one("PO exists", "po_not_found", "it's on file", noPo),
    one("PO is still open", "po_closed", "still open", noPo),
    one("PO is for this vendor", "po_vendor_mismatch", "same vendor", noPo),
    one("Same currency as the PO", "currency_mismatch", inv.currency ? `both ${inv.currency}` : "they match", noPo),
    one("Within 2% of the PO", "po_amount_exceeded", "within budget", noPo || PO_CODES.slice(0, 4).some((c) => flag(c))),
    unsure.length
      ? { label: "AI sure of every field", state: "fail", note: `unsure about ${unsure.map(([k]) => k.replace(/_/g, " ")).join(", ")}` }
      : {
          label: "AI sure of every field",
          state: "pass",
          note: lowest.length ? `every field ${Math.floor(Math.min(...lowest) * 100)}%+ sure` : "every field 80%+ sure",
        },
  ];
}

