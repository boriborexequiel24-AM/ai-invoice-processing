import { dateTime, STEP_LABELS } from "@/lib/format";
import type { InvoiceEvent } from "@/lib/types";

/** One plain-English line about what happened at each step. */
function describe(event: InvoiceEvent): string | null {
  const d = event.details ?? {};
  switch (event.step) {
    case "received":
      return `${d.file_name ?? "File"} (${Math.round(Number(d.size_bytes ?? 0) / 1024)} KB, ${d.source})`;
    case "extracted":
      return `${d.model} in ${d.seconds}s, cost $${Number(d.cost_usd ?? 0).toFixed(4)}, lowest confidence ${Number(d.min_confidence ?? 0).toFixed(2)}`;
    case "validated": {
      const flags = Array.isArray(d.flags) ? d.flags.length : 0;
      return flags ? `${flags} problem${flags > 1 ? "s" : ""} found` : "All checks passed";
    }
    case "approved":
    case "rejected":
      return `by ${event.actor.replace(/^slack:/, "")} in Slack`;
    case "posted":
      return d.pdf_attached ? "Bill created with the PDF attached" : "Bill created";
    case "error":
      return `${d.stage ?? "processing"}: ${String(d.error ?? "unknown error")}`;
    default:
      return null;
  }
}

export function Timeline({ events }: { events: InvoiceEvent[] }) {
  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="relative flex gap-3">
          <span
            className={`mt-1.5 size-2.5 shrink-0 rounded-full ${event.step === "error" ? "bg-red-500" : "bg-brand-500"}`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">{STEP_LABELS[event.step] ?? event.step}</p>
            {describe(event) && <p className="break-words text-xs text-slate-600">{describe(event)}</p>}
            <p className="text-xs text-slate-400">{dateTime(event.created_at)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
