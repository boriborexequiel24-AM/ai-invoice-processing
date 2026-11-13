const STEPS = [
  { title: "An invoice arrives", text: "Someone uploads a PDF, or another system sends one in." },
  { title: "AI reads it", text: "Vendor, dates, line items and totals, with a confidence score for each." },
  { title: "12 checks", text: "Math, duplicates, PO match, known vendor, currency." },
  { title: "Slack approval", text: "A person approves or rejects with one click." },
  { title: "Xero bill", text: "Approved invoices become bills, with the PDF attached." },
];

export function HowItWorks() {
  return (
    <ol className="grid gap-3 sm:grid-cols-5">
      {STEPS.map((step, i) => (
        <li key={step.title} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">{i + 1}</span>
            <span className="text-sm font-semibold">{step.title}</span>
          </div>
          <p className="text-sm leading-snug text-slate-600">{step.text}</p>
        </li>
      ))}
    </ol>
  );
}
