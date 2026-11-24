import Link from "next/link";
import { notFound } from "next/navigation";
import { PdfPreview } from "@/components/PdfPreview";
import { StatusBadge } from "@/components/StatusBadge";
import { Timeline } from "@/components/Timeline";
import { CHECKED, checkResults, checkSummary } from "@/lib/checks";
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
  const checks = CHECKED.includes(inv.status) ? checkResults(inv, lines.length) : null;
  const failed = checks?.filter((c) => c.state === "fail").length ?? 0;

  const fields: [string, string, string | null][] = [
    ["vendor_name", inv.vendor_name_raw ?? "-", null],
    ["invoice_number", inv.invoice_number ?? "-", "font-mono"],
    ["invoice_date", date(inv.invoice_date), null],
    ["due_date", date(inv.due_date), null],
    ["po_number", inv.po_number ?? "none", "font-mono"],
    ["currency", inv.currency ?? "-", null],
    ["subtotal", money(inv.subtotal), "font-mono tabular-nums"],
    ["tax", money(inv.tax), "font-mono tabular-nums"],
    ["total", money(inv.total, inv.currency), "font-mono tabular-nums font-semibold"],
  ];

  return (
    <div className="space-y-8">
      <Link href="/#invoices" className="text-sm underline hover:text-pen">
        &larr; Back to the ledger
      </Link>

      {fresh && (
        <p className="m-0 border border-edge bg-white px-5 py-3">
          <span className="font-hand text-2xl text-pass">Done!</span>{" "}
          <span className="text-ink-2">
            Here&apos;s what the system found.{OPEN.includes(inv.status) && " It's now waiting for approval in Slack."}
          </span>
        </p>
      )}
      {existing && (
        <p className="m-0 border border-edge bg-white px-5 py-3 text-ink-2">
          <span className="font-hand text-2xl text-pen">Seen this one before.</span> This exact file was already
          processed, so here&apos;s the earlier result. The system never processes the same file twice.
        </p>
      )}

      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-5">
        <div className="min-w-0">
          <h1 className="m-0 font-serif text-4xl font-medium tracking-tight">{inv.vendor_name_raw ?? "Unknown vendor"}</h1>
          <p className="m-0 mt-2 text-sm text-muted">
            <span className="font-mono text-ink-2">{inv.invoice_number}</span> · received {dateTime(inv.created_at)}
            {inv.source === "upload" && inv.expires_at && ` · demo upload, deleted ${dateTime(inv.expires_at)}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <StatusBadge status={inv.status} />
          <p className="m-0 font-mono text-2xl tabular-nums">
            <span className={failed ? "rounded-full border-2 border-pen px-2" : ""}>{money(inv.total, inv.currency)}</span>
          </p>
        </div>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="overflow-hidden border border-edge bg-white">
          {pdf ? <PdfPreview url={pdf} /> : <p className="p-10 text-center text-muted">The PDF is no longer available.</p>}
        </section>

        <div className="space-y-8">
          <section aria-labelledby="checks-heading">
            <h2 id="checks-heading" className="m-0 font-serif text-2xl font-medium">
              The margin notes
            </h2>
            {checks ? (
              <>
                <p className="m-0 mt-1 text-sm text-muted">
                  {checkSummary(checks)}
                </p>
                <ol className="m-0 mt-4 list-none border-t border-ink p-0">
                  {checks.map((c) => (
                    <li key={c.label} className="flex items-baseline gap-3 border-b border-rule py-2">
                      <span
                        aria-hidden="true"
                        className={`w-4 shrink-0 font-mono ${c.state === "pass" ? "text-pass" : c.state === "fail" ? "text-pen" : "text-rule"}`}
                      >
                        {c.state === "pass" ? "✓" : c.state === "fail" ? "✗" : "–"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-[15px]">
                          {c.label}
                          <span className="sr-only">: {c.state === "pass" ? "passed" : c.state === "fail" ? "failed" : "skipped"}</span>
                        </span>
                        <span
                          className={`block font-hand text-xl leading-tight ${
                            c.state === "fail" ? "text-pen" : c.state === "pass" ? "text-ink-2" : "text-muted"
                          }`}
                        >
                          {c.note}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="m-0 mt-2 text-muted">Not checked yet.</p>
            )}

            <div className="mt-4 space-y-1 text-sm text-ink-2">
              {OPEN.includes(inv.status) && <p className="m-0">Waiting for someone to approve or reject it in Slack.</p>}
              {inv.decided_by && (
                <p className="m-0">
                  {inv.status === "rejected" ? "Rejected" : "Approved"} by {inv.decided_by} on {dateTime(inv.decided_at)}.
                </p>
              )}
              {inv.xero_url && (
                <p className="m-0">
                  <a href={inv.xero_url} target="_blank" rel="noreferrer" className="font-medium underline hover:text-pen">
                    Open the bill in Xero &rarr;
                  </a>
                  <span className="ml-1 text-xs text-muted">(needs access to the demo company)</span>
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="read-heading">
            <h2 id="read-heading" className="m-0 font-serif text-2xl font-medium">
              What the AI read
            </h2>
            <dl className="m-0 mt-3 border-t border-ink text-[15px]">
              {fields.map(([key, value, style]) => {
                const score = confidence[key];
                return (
                  <div key={key} className="flex items-center justify-between gap-3 border-b border-rule py-2">
                    <dt className="text-muted">{FIELD_LABELS[key]}</dt>
                    <dd className="m-0 flex items-center gap-2 text-right">
                      <span className={style ?? ""}>{value}</span>
                      {typeof score === "number" && (
                        <span
                          title={`AI confidence ${score.toFixed(2)}`}
                          className={`font-mono text-[11px] ${score >= 0.8 ? "text-muted" : "font-medium text-warn"}`}
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
            <section aria-labelledby="lines-heading">
              <h2 id="lines-heading" className="m-0 font-serif text-2xl font-medium">
                Line items <span className="font-mono text-base text-muted">({lines.length})</span>
              </h2>
              <div className="mt-3 max-h-72 overflow-y-auto border-t border-ink">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {lines.map((li) => (
                      <tr key={li.id} className="border-b border-dotted border-rule">
                        <td className="py-2 pr-2">{li.description}</td>
                        <td className="whitespace-nowrap py-2 text-right font-mono text-xs text-muted">
                          {li.unit_price !== null && `${li.quantity} × ${money(li.unit_price)}`}
                        </td>
                        <td className="whitespace-nowrap py-2 pl-3 text-right font-mono tabular-nums">{money(li.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="m-0 mb-3 font-serif text-2xl font-medium">
              History
            </h2>
            <Timeline events={events} />
          </section>
        </div>
      </div>
    </div>
  );
}
