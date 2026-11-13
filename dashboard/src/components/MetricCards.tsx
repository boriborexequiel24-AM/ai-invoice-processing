import type { Metrics } from "@/lib/invoices";

export function MetricCards({ metrics }: { metrics: Metrics }) {
  const cards = [
    { label: "Invoices processed", value: String(metrics.processed) },
    { label: "Waiting for approval", value: String(metrics.waiting) },
    { label: "Flagged with problems", value: String(metrics.flagged) },
    { label: "Posted to Xero", value: String(metrics.posted) },
    {
      label: "Average AI read",
      value: metrics.avgSeconds === null ? "-" : `${metrics.avgSeconds.toFixed(1)}s`,
      hint: metrics.avgCostUsd === null ? undefined : `about $${metrics.avgCostUsd.toFixed(4)} per invoice`,
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <dt className="text-xs font-medium text-slate-500">{card.label}</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</dd>
          {card.hint && <dd className="mt-0.5 text-xs text-slate-500">{card.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
