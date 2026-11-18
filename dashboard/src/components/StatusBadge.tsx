import { STATUS } from "@/lib/format";
import type { InvoiceStatus } from "@/lib/types";

/** The invoice's status as a small rubber stamp. */
export function StatusBadge({ status }: { status: InvoiceStatus }) {
  const { label, tone } = STATUS[status] ?? { label: status, tone: "text-muted border-rule" };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-[3px] border-2 border-double px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide ${tone}`}
    >
      {label}
    </span>
  );
}
