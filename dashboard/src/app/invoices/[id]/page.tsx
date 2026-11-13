import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfPreview } from "@/components/PdfPreview";
import { StatusBadge } from "@/components/StatusBadge";
import { Timeline } from "@/components/Timeline";
import { date, dateTime, FIELD_LABELS, money } from "@/lib/format";
import { getInvoice, pdfLink } from "@/lib/invoices";

export const dynamic = "force-dynamic";

const OPEN = ["ready_for_approval", "needs_review", "flagged"];

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fresh?: string; existing?: string }>;
}) {
  const { id } = await params;
  const { fresh, existing } = await searchParams;
  const result = await getInvoice(id);
  if (!result) notFound();
  const { invoice: inv, lines, events } = result;
  const pdf = await pdfLink(id);
  const confidence = inv.confidence ?? {};

  const fields: [string, string, string | null][] = [
    ["vendor_name", inv.vendor_name_raw ?? "-", null],
    ["invoice_number", inv.invoice_number ?? "-", "font-mono"],
    ["invoice_date", date(inv.invoice_date), null],
    ["due_date", date(inv.due_date), null],
    ["po_number", inv.po_number ?? "none", "font-mono"],
    ["currency", inv.currency ?? "-", null],
    ["subtotal", money(inv.subtotal), "tabular-nums"],
    ["tax", money(inv.tax), "tabular-nums"],
    ["total", money(inv.total, inv.currency), "tabular-nums font-semibold"],
  ];

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-slate-600 hover:text-brand-600">
        &larr; All invoices
      </Link>

      {fresh && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Done. Here&apos;s what the system found.{OPEN.includes(inv.status) && " It's now waiting for approval in Slack."}
        </p>
      )}
      {existing && (
        <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-700">
          This exact file was already processed, so here&apos;s the earlier result. The system never processes the same file twice.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {inv.vendor_name_raw ?? "Unknown vendor"}
            <span className="ml-2 font-mono text-base font-normal text-slate-500">{inv.invoice_number}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Received {dateTime(inv.created_at)}
            {inv.source === "upload" && inv.expires_at && ` · demo upload, deleted ${dateTime(inv.expires_at)}`}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge status={inv.status} />
          <p className="mt-2 text-2xl font-semibold tabular-nums">{money(inv.total, inv.currency)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {pdf ? (
            <PdfPreview url={pdf} />
          ) : (
            <p className="p-10 text-center text-sm text-slate-500">The PDF is no longer available.</p>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold">Checks</h2>
            {inv.flags?.length ? (
              <ul className="space-y-2">
                {inv.flags.map((f) => (
                  <li key={f.code} className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                    {f.message}
                  </li>
                ))}
              </ul>
            ) : OPEN.includes(inv.status) || ["approved", "posted", "rejected"].includes(inv.status) ? (
              <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">All 12 checks passed.</p>
            ) : (
              <p className="text-sm text-slate-500">Not checked yet.</p>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
              {OPEN.includes(inv.status) && (
                <p className="text-slate-600">Waiting for someone to approve or reject it in Slack.</p>
              )}
              {inv.decided_by && (
                <p className="text-slate-600">
                  {inv.status === "rejected" ? "Rejected" : "Approved"} by {inv.decided_by} on {dateTime(inv.decided_at)}.
                </p>
              )}
              {inv.xero_url && (
                <p className="mt-1">
                  <a href={inv.xero_url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
                    Open the bill in Xero &rarr;
                  </a>
                  <span className="ml-1 text-xs text-slate-500">(needs access to the demo company)</span>
                </p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold">What the AI read</h2>
            <dl className="divide-y divide-slate-100 text-sm">
              {fields.map(([key, value, style]) => {
                const score = confidence[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-slate-500">{FIELD_LABELS[key]}</dt>
                    <dd className="flex items-center gap-2 text-right">
                      <span className={style ?? ""}>{value}</span>
                      {typeof score === "number" && (
                        <span
                          title={`AI confidence ${score.toFixed(2)}`}
                          className={`rounded px-1.5 text-[10px] font-medium ${
                            score >= 0.8 ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {Math.round(score * 100)}%
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>

          {lines.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold">Line items ({lines.length})</h2>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {lines.map((li) => (
                      <tr key={li.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-1.5 pr-2">{li.description}</td>
                        <td className="whitespace-nowrap py-1.5 text-right text-xs text-slate-500">
                          {li.unit_price !== null && `${li.quantity} × ${money(li.unit_price)}`}
                        </td>
                        <td className="whitespace-nowrap py-1.5 pl-3 text-right tabular-nums">{money(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold">History</h2>
            <Timeline events={events} />
          </section>
        </div>
      </div>
    </div>
  );
}
