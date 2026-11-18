import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="m-0 font-hand text-3xl text-pen">Not in the ledger.</p>
      <h1 className="m-0 mt-2 font-serif text-4xl font-medium">Invoice not found</h1>
      <p className="mt-3 text-ink-2">It may have been a demo upload that was deleted after 24 hours.</p>
      <Link href="/" className="mt-4 inline-block underline hover:text-pen">
        Back to the Invoice Desk
      </Link>
    </div>
  );
}
