const STEPS = [
  { title: "Arrives", text: "By email label or upload here. A file it has seen before is skipped." },
  { title: "Read by AI", text: "Vendor, dates, line items and totals, with a confidence score for each." },
  { title: "Twelve checks", text: "Math, duplicates, PO match, known vendor, currency." },
  { title: "A person approves", text: "One click in Slack, two if anything was flagged." },
  { title: "Posted to Xero", text: "As a bill, with the PDF attached." },
];

const NUMERALS = ["I.", "II.", "III.", "IV.", "V."];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-6">
      <h2 className="m-0 mb-4 font-serif text-3xl font-medium sm:text-[32px]">The route every invoice takes</h2>
      <ol className="m-0 grid list-none gap-y-4 border-t border-ink p-0 sm:grid-cols-5">
        {STEPS.map((step, i) => (
          <li key={step.title} className="pr-4 pt-4">
            <div className="font-mono text-xs text-pen">{NUMERALS[i]}</div>
            <div className="mt-1.5 font-semibold">{step.title}</div>
            <p className="m-0 mt-1 text-sm text-ink-2">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
