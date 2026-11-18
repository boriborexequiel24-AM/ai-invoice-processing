import Link from "next/link";
import { FILTERS, type FilterKey } from "@/lib/invoices";
import { date, money } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

/** Every invoice, as a ruled ledger with status stamps and the problems in red pen. */
export function InvoiceTable({ invoices, filter }: { invoices: Invoice[]; filter: FilterKey }) {
  return (
    <section id="invoices" className="scroll-mt-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-ink pb-3">
        <h2 className="m-0 font-serif text-3xl font-medium sm:text-[32px]">The ledger</h2>
        <nav className="flex flex-wrap gap-1" aria-label="Filter invoices">
          {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
            <Link
              key={key}
              href={key === "all" ? "/#invoices" : `/?status=${key}#invoices`}
              scroll={false}
              aria-current={key === filter ? "page" : undefined}
              className={`px-2.5 py-1 text-sm ${key === filter ? "bg-ink text-paper" : "text-ink-2 hover:bg-white"}`}
            >
              {FILTERS[key].label}
            </Link>
          ))}
        </nav>
      </div>

      {invoices.length === 0 ? (
        <p className="py-10 text-center font-hand text-2xl text-muted">Nothing here yet. Try a sample above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="font-mono text-xs text-muted">
                <th className="py-3 pr-3 font-normal">VENDOR</th>
                <th className="py-3 pr-3 font-normal">INVOICE</th>
                <th className="py-3 pr-3 font-normal">DUE</th>
                <th className="py-3 pr-3 text-right font-normal">TOTAL</th>
                <th className="py-3 pr-3 font-normal">STATUS</th>
                <th className="py-3 font-normal">WHAT IT FOUND</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-rule align-top hover:bg-white/60">
                  <td className="py-3.5 pr-3">
                    <Link href={`/invoices/${inv.id}`} className="font-semibold underline-offset-4 hover:text-pen hover:underline">
                      {inv.vendor_name_raw ?? "Unknown vendor"}
                    </Link>
                    {inv.source === "upload" && <span className="ml-2 font-hand text-lg text-muted">your upload</span>}
                  </td>
                  <td className="whitespace-nowrap py-3.5 pr-3 font-mono text-[13px] text-ink-2">{inv.invoice_number ?? "-"}</td>
                  <td className="whitespace-nowrap py-3.5 pr-3 text-ink-2">{date(inv.due_date)}</td>
                  <td className="whitespace-nowrap py-3.5 pr-3 text-right font-mono tabular-nums">{money(inv.total, inv.currency)}</td>
                  <td className="py-3.5 pr-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="max-w-xs py-3.5 font-hand text-xl leading-tight text-pen" title={inv.flags?.map((f) => f.message).join("\n")}>
                    {inv.flags?.length ? <span className="line-clamp-2">{inv.flags.map((f) => f.message).join(" ")}</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
