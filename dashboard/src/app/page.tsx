import { HowItWorks } from "@/components/HowItWorks";
import { InvoiceTable } from "@/components/InvoiceTable";
import { MetricCards } from "@/components/MetricCards";
import { TryIt } from "@/components/TryIt";
import { env } from "@/lib/env";
import { getMetrics, isFilterKey, listInvoices } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = isFilterKey(status) ? status : "all";
  const [invoices, metrics] = await Promise.all([listInvoices(filter), getMetrics()]);

  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">From PDF to approved bill, automatically.</h1>
        <p className="mt-3 text-slate-600">
          Invoices are read by AI, checked against purchase orders and the vendor list, sent to Slack for a one-click
          approval, and posted to Xero. Every step is logged, and anything unusual is flagged in plain English.
        </p>
      </section>

      <HowItWorks />
      <TryIt maxFileMb={env.maxFileMb()} />
      <MetricCards metrics={metrics} />
      <InvoiceTable invoices={invoices} filter={filter} />
    </div>
  );
}
