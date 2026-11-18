import { FlaggedExample } from "@/components/FlaggedExample";
import { HowItWorks } from "@/components/HowItWorks";
import { InvoiceTable } from "@/components/InvoiceTable";
import { MarkedUpInvoice } from "@/components/MarkedUpInvoice";
import { MetricCards } from "@/components/MetricCards";
import { TryIt } from "@/components/TryIt";
import { env } from "@/lib/env";
import { getMetrics, getShowcase, isFilterKey, listInvoices } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = isFilterKey(status) ? status : "all";
  const [invoices, metrics, showcase] = await Promise.all([listInvoices(filter), getMetrics(), getShowcase()]);

  return (
    <div className="space-y-14">
      <section className="mx-auto max-w-4xl text-center">
        <h1 className="m-0 font-serif text-[40px] font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]">
          It reads every invoice the way a careful accountant would.{" "}
          <em className="text-pen">In 15 seconds.</em>
        </h1>
        <p className="mx-auto mb-0 mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">
          {showcase.clean
            ? "Here's one it checked. The red notes are what it found, field by field, before sending it to a person in Slack for approval and on to Xero."
            : "AI reads the PDF, twelve checks catch what a careful clerk would, a person approves it in Slack, and the bill lands in Xero with the PDF attached."}
        </p>
      </section>

      {showcase.clean && <MarkedUpInvoice {...showcase.clean} />}

      <section id="try" className="grid scroll-mt-6 items-start gap-10 lg:grid-cols-[1.4fr_1fr]">
        <TryIt maxFileMb={env.maxFileMb()} />
        {showcase.flagged && <FlaggedExample invoice={showcase.flagged} />}
      </section>

      <MetricCards metrics={metrics} />
      <InvoiceTable invoices={invoices} filter={filter} />
      <HowItWorks />
    </div>
  );
}
