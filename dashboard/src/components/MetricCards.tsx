import type { Metrics } from "@/lib/invoices";

/** Live numbers across every invoice, as a ruled ledger line. */
export function MetricCards({ metrics }: { metrics: Metrics }) {
  const cards = [
    { label: "invoices processed", value: String(metrics.processed) },
    { label: "waiting for approval", value: String(metrics.waiting) },
    { label: "flagged with problems", value: String(metrics.flagged) },
    { label: "posted to Xero", value: String(metrics.posted) },
    {
      label: metrics.avgCostUsd === null ? "average AI read" : `average AI read, about $${metrics.avgCostUsd.toFixed(4)} each`,
      value: metrics.avgSeconds === null ? "-" : `${metrics.avgSeconds.toFixed(1)}s`,
    },
  ];
  return (
    <dl className="m-0 grid grid-cols-2 border-y border-ink sm:grid-cols-5">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={`px-3 py-4 ${i > 0 ? "sm:border-l sm:border-rule" : ""} ${i % 2 === 1 ? "border-l border-rule sm:border-l" : ""} ${
            i >= 2 ? "border-t border-rule sm:border-t-0" : ""
          }`}
        >
          <dt className="text-[13px] text-muted">{card.label}</dt>
          <dd className="m-0 mt-1 font-mono text-[26px] tabular-nums">{card.value}</dd>
        </div>
      ))}
    </dl>
  );
}
