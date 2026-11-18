import Link from "next/link";

// Shared shell for the privacy and terms pages: a readable column with plain headings.

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="m-0 font-serif text-2xl font-medium text-ink">{title}</h2>
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
    <article className="mx-auto max-w-2xl space-y-8 leading-relaxed [&_a]:underline [&_a:hover]:text-pen [&_li]:text-ink-2 [&_p]:text-ink-2 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
      <header className="space-y-3">
        <h1 className="m-0 font-serif text-5xl font-medium tracking-tight">{title}</h1>
        <p className="font-mono text-xs text-muted">LAST UPDATED {updated.toUpperCase()}</p>
        <p>{intro}</p>
      </header>

      {children}

      <footer className="border-t border-ink pt-6 text-sm">
        <Link href="/" className="underline hover:text-pen">
          Back to the demo
        </Link>
      </footer>
    </article>
  );
}
