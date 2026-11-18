import Link from "next/link";
import { money } from "@/lib/format";
import type { Invoice } from "@/lib/types";

/** A real flagged invoice, with its total circled and the system's own warning in red pen. */
export function FlaggedExample({ invoice: inv }: { invoice: Invoice }) {
  const flag = (inv.flags ?? [])[0];
  return (
    <article className="rotate-1 border border-edge bg-white p-6">
      <p className="m-0 font-mono text-xs text-muted">WHAT A FLAGGED ONE LOOKS LIKE</p>
      <p className="m-0 mt-2 font-serif text-[22px]">{inv.vendor_name_raw ?? "Unknown vendor"}</p>
      <p className="m-0 font-mono text-xs text-muted">{inv.invoice_number}</p>
      <div className="mt-4 flex justify-between font-mono">
        <span>TOTAL {inv.currency}</span>
        <span className="rounded-full border-2 border-pen px-2 tabular-nums">{money(inv.total)}</span>
      </div>
      {flag && <p className="m-0 mt-4 font-hand text-[26px] leading-tight text-pen">{flag.message}</p>}
      <p className="m-0 mt-4 text-[13px] text-muted">
        In Slack, a flagged invoice needs an extra &ldquo;are you sure?&rdquo; click to approve.{" "}
        <Link href={`/invoices/${inv.id}`} className="underline hover:text-pen">
          Open it
        </Link>
      </p>
    </article>
  );
}
