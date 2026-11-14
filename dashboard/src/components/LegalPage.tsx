import Link from "next/link";

// Shared shell for the privacy and terms pages: a readable column with plain headings.

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <article className="max-w-2xl space-y-8 [&_a]:text-brand-600 [&_li]:text-slate-600 [&_p]:text-slate-600 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-slate-500">Last updated {updated}</p>
        <p>{intro}</p>
      </header>

      {children}

      <footer className="border-t border-slate-200 pt-6 text-sm">
        <Link href="/" className="text-brand-600 hover:underline">
          Back to the demo
        </Link>
      </footer>
    </article>
  );
}
