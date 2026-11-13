import Link from "next/link";
import { FILTERS, type FilterKey } from "@/lib/invoices";
import { date, money } from "@/lib/format";
import type { Invoice } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export function InvoiceTable({ invoices, filter }: { invoices: Invoice[]; filter: FilterKey }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold">Invoices</h2>
        <nav className="flex flex-wrap gap-1">
          {(Object.keys(FILTERS) as FilterKey[]).map((key) => (
            <Link
              key={key}
              href={key === "all" ? "/" : `/?status=${key}`}
              scroll={false}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                key === filter ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {FILTERS[key].label}
            </Link>
          ))}
        </nav>
      </div>

      {invoices.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-500">No invoices here yet. Try a sample above.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="px-4 py-2 font-medium">Vendor</th>
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Problems</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/invoices/${inv.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                      {inv.vendor_name_raw ?? "Unknown vendor"}
                    </Link>
                    {inv.source === "upload" && <span className="ml-2 text-xs text-slate-400">your upload</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{inv.invoice_number ?? "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{date(inv.due_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{money(inv.total, inv.currency)}</td>
                  <td className="px-4 py-3"><StatusBadge status={inv.status} /></td>
                  <td className="max-w-xs truncate px-4 py-3 text-xs text-slate-500" title={inv.flags?.map((f) => f.message).join("\n")}>
                    {inv.flags?.length ? inv.flags.map((f) => f.message).join(" ") : ""}
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
