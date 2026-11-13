import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-semibold">Invoice not found</h1>
      <p className="mt-2 text-sm text-slate-600">It may have been a demo upload that was deleted after 24 hours.</p>
      <Link href="/" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
        Back to all invoices
      </Link>
    </div>
  );
}
