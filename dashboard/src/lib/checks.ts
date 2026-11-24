import { money } from "./format";
import type { Invoice } from "./types";

// The 12 checks from the Postgres function validate_invoice (docs/validation.md),
// turned into the red-pen notes the dashboard shows. Every result comes from
// the data stored on the invoice: nothing is guessed here. A check with nothing
// to compare raises no flag, so "no flag" alone doesn't mean it passed. The skip
// conditions below are the same ones the function uses.

export type CheckResult = { label: string; state: "pass" | "fail" | "skip"; note: string };

/** Statuses where validation has run, so the check results mean something. */
export const CHECKED = ["ready_for_approval", "needs_review", "flagged", "approved", "rejected", "posted"];

export function checkResults(inv: Invoice, lineCount: number): CheckResult[] {
  const flags = inv.flags ?? [];
  const flag = (code: string) => flags.find((f) => f.code === code);
  const scores = Object.entries(inv.confidence ?? {}).filter(([, score]) => typeof score === "number");
  const unsure = scores.filter(([, score]) => score < 0.8);

  // `skip` says why the check had nothing to work with, or is falsy if it ran.
  const one = (label: string, code: string, passNote: string, skip?: string | false): CheckResult => {
    const f = flag(code);
    if (f) return { label, state: "fail", note: f.message };
    if (skip) return { label, state: "skip", note: skip };
    return { label, state: "pass", note: passNote };
  };

  const noPo = flag("missing_po") ? "no PO to check against" : false;
  const noPoOnFile = noPo || (flag("po_not_found") ? "that PO isn't on file" : false);

  return [
    one("Vendor, number and total found", "missing_required_field", "all three are on it"),
    one("Known vendor", "unknown_vendor", "on the vendor list", inv.vendor_id === null && "no vendor to look up"),
    one(
      "Line items add up",
      "line_items_mismatch",
      `they come to ${money(inv.subtotal)}`,
      (lineCount === 0 && "no line items to add up") || (inv.subtotal === null && "no subtotal to compare with"),
    ),
    one(
      "Subtotal plus tax equals total",
      "total_mismatch",
      inv.tax !== null ? `${money(inv.subtotal)} + ${money(inv.tax)} = ${money(inv.total)}` : "no tax, and they match",
      (inv.subtotal === null && "no subtotal to add up") || (inv.total === null && "no total to compare with"),
    ),
    one(
      "Not a duplicate",
      "duplicate",
      "never seen before",
      (inv.invoice_number === null && "no invoice number to look up") ||
        (inv.vendor_id === null && inv.vendor_name_raw === null && "no vendor to look up"),
    ),
    one("Has a PO number", "missing_po", inv.po_number ?? "it has one"),
    one("PO exists", "po_not_found", "it's on file", noPo),
    one("PO is still open", "po_closed", "still open", noPoOnFile),
    one(
      "PO is for this vendor",
      "po_vendor_mismatch",
      "same vendor",
      noPoOnFile || (inv.vendor_id === null && "vendor not identified"),
    ),
    one("Same currency as the PO", "currency_mismatch", `both ${inv.currency}`, noPoOnFile || (inv.currency === null && "no currency on it")),
    one("Within 2% of the PO", "po_amount_exceeded", "within budget", noPoOnFile || (inv.total === null && "no total to compare with")),
    aiSure(),
  ];

  function aiSure(): CheckResult {
    const label = "AI sure of every field";
    if (!scores.length) return { label, state: "skip", note: "the AI gave no scores" };
    if (unsure.length) return { label, state: "fail", note: `unsure about ${unsure.map(([k]) => k.replace(/_/g, " ")).join(", ")}` };
    return { label, state: "pass", note: `every field ${Math.floor(Math.min(...scores.map(([, s]) => s)) * 100)}%+ sure` };
  }
}

/** One honest line about how the checks went, for above the list. */
export function checkSummary(checks: CheckResult[]): string {
  const count = (state: CheckResult["state"]) => checks.filter((c) => c.state === state).length;
  const [passed, failed, skipped] = [count("pass"), count("fail"), count("skip")];
  const notRun = skipped ? ` ${skipped} couldn't be run.` : "";
  if (failed) return `${failed} of ${checks.length} checks found a problem.${notRun}`;
  return skipped ? `${passed} of ${checks.length} checks passed.${notRun}` : `All ${checks.length} checks passed.`;
}
