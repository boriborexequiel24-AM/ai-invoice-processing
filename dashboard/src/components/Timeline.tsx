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

/** The invoice's history, printed like a check tape. */
export function Timeline({ events }: { events: InvoiceEvent[] }) {
  return (
    <ol className="tape-edge m-0 list-none border border-t-0 border-edge bg-paper-2 px-5 pb-5 pt-6 font-mono text-[13px]">
      {events.map((event) => (
        <li key={event.id} className="border-b border-dashed border-rule py-2.5 last:border-0">
          <div className="flex flex-wrap justify-between gap-x-4">
            <span className={`font-medium uppercase ${event.step === "error" ? "text-pen" : ""}`}>
              {STEP_LABELS[event.step] ?? event.step}
            </span>
            <span className="text-muted">{dateTime(event.created_at)}</span>
          </div>
          {describe(event) && <p className="m-0 mt-0.5 break-words text-ink-2">{describe(event)}</p>}
        </li>
      ))}
    </ol>
  );
}
