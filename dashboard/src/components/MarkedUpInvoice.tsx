import Link from "next/link";
import { checkResults } from "@/lib/checks";
import { date, money } from "@/lib/format";
import type { Invoice, LineItem } from "@/lib/types";

// The home page centrepiece: a real sample invoice that passed, drawn as a
// paper invoice, with red-pen notes in the margins saying what each check
// found. The notes and their ticks come from checkResults(), so they are the
// invoice's real results, not decoration.

const MAX_LINES = 6;

function Note({ children, side }: { children: React.ReactNode; side: "left" | "right" }) {
  return (
    <p className={`m-0 font-hand text-[26px] leading-tight text-pen ${side === "left" ? "lg:text-right" : ""}`}>{children}</p>
  );
}

export function MarkedUpInvoice({
  invoice: inv,
  lines,
  seconds,
}: {
  invoice: Invoice;
  lines: LineItem[];
  seconds: number | null;
}) {
  const checks = checkResults(inv, lines.length);
  // A margin note: its own wording with a tick if every check behind it passed,
  // otherwise whatever the first one that didn't pass had to say.
  const note = (text: string, ...labels: string[]) => {
    const missed = checks.find((c) => labels.includes(c.label) && c.state !== "pass");
    return missed ? missed.note : `${text} ✓`;
  };
  const passNote = (label: string) => checks.find((c) => c.label === label)?.note ?? "";
  const shown = lines.slice(0, MAX_LINES);
  const scores = Object.values(inv.confidence ?? {}).filter((s): s is number => typeof s === "number");
  const lowest = scores.length ? Math.floor(Math.min(...scores) * 100) : null;
  const passed = checks.filter((c) => c.state === "pass").length;

  return (
    <section aria-labelledby="checked-heading">
      <h2 id="checked-heading" className="sr-only">
        An invoice the system checked
      </h2>
      <div className="flex flex-col items-stretch justify-center gap-5 lg:flex-row">
        <div className="flex flex-col justify-around gap-4 lg:w-52 lg:shrink-0">
          <Note side="left">
            {note("known vendor", "Known vendor")} <span className="hidden lg:inline">&rarr;</span>
          </Note>
          <Note side="left">
            {note(`lines add up to ${money(inv.subtotal)}`, "Line items add up")} <span className="hidden lg:inline">&rarr;</span>
          </Note>
          <Note side="left">
            {note(passNote("Not a duplicate"), "Not a duplicate")} <span className="hidden lg:inline">&rarr;</span>
          </Note>
        </div>

        <article className="min-w-0 flex-1 border border-edge bg-white px-6 py-8 sm:px-9 lg:max-w-[600px]">
          <div className="flex flex-wrap justify-between gap-4">
            <div className="min-w-0">
              <p className="m-0 inline-block rounded-full border-2 border-pen px-3 py-0.5 font-serif text-2xl font-semibold sm:text-[28px]">
                {inv.vendor_name_raw}
              </p>
            </div>
            <dl className="m-0 text-right font-mono text-[13px] leading-7">
              <div>
                INVOICE <span className="underline decoration-pen decoration-2">{inv.invoice_number}</span>
              </div>
              <div>Issued {date(inv.invoice_date)}</div>
              <div>Due {date(inv.due_date)}</div>
              <div>
                PO <span className="bg-mark px-1">{inv.po_number}</span>
              </div>
            </dl>
          </div>

          <table className="mt-7 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink text-left font-mono text-xs text-muted">
                <th className="py-2 font-normal">DESCRIPTION</th>
                <th className="py-2 text-right font-normal">QTY</th>
                <th className="py-2 text-right font-normal">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {shown.map((l) => (
                <tr key={l.id} className="border-b border-dotted border-rule">
                  <td className="py-2.5 pr-3">{l.description}</td>
                  <td className="py-2.5 text-right">{l.quantity}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{money(l.amount)}</td>
                </tr>
              ))}
              {lines.length > MAX_LINES && (
                <tr className="border-b border-dotted border-rule text-muted">
                  <td className="py-2.5" colSpan={3}>
                    + {lines.length - MAX_LINES} more lines
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="ml-auto mt-3 max-w-64 font-mono text-sm leading-8">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(inv.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span className="tabular-nums">{money(inv.tax)}</span>
            </div>
            <div className="flex justify-between border-t-2 border-ink font-medium">
              <span>TOTAL {inv.currency}</span>
              <span className="rounded-full border-2 border-pen px-2 tabular-nums">{money(inv.total)}</span>
            </div>
          </div>

          <Link href={`/invoices/${inv.id}`} className="mt-6 inline-block text-sm underline hover:text-pen">
            See everything it read on this invoice
          </Link>
        </article>

        <div className="flex flex-col justify-around gap-4 lg:w-52 lg:shrink-0">
          <Note side="right">
            <span className="hidden lg:inline">&larr; </span>
            {note(`${inv.po_number} is open, same vendor`, "PO exists", "PO is still open", "PO is for this vendor")}
          </Note>
          <Note side="right">
            <span className="hidden lg:inline">&larr; </span>
            {note(passNote("Subtotal plus tax equals total"), "Subtotal plus tax equals total")}
          </Note>
          <Note side="right">
            <span className="hidden lg:inline">&larr; </span>
            {note("within 2% of the PO", "Within 2% of the PO")}
          </Note>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 border-y border-ink py-4 font-mono text-sm">
        {seconds !== null && <span>READ IN {seconds.toFixed(1)}s</span>}
        <span>{passed} OF 12 CHECKS PASSED</span>
        {lowest !== null && <span>EVERY FIELD {lowest}%+ SURE</span>}
        <span className="bg-ink px-3 py-1.5 text-paper">
          {inv.status === "posted" ? "POSTED TO XERO" : inv.status === "approved" ? "APPROVED IN SLACK" : "SENT TO SLACK FOR APPROVAL"}
        </span>
      </div>
    </section>
  );
}
