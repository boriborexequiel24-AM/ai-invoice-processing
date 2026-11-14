import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Invoice Processing | AI accounts payable demo",
  description:
    "Upload an invoice and watch it get read by AI, checked, approved in Slack and posted to Xero. A portfolio demo by Exequiel Boribor.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-600 text-sm font-semibold text-white">IP</span>
              <span>
                <span className="block text-sm font-semibold leading-tight">Invoice Processing</span>
                <span className="block text-xs text-slate-500">AI accounts payable demo</span>
              </span>
            </Link>
            <a
              href="https://workwithzeki.vercel.app"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-slate-600 hover:text-brand-600"
            >
              Built by Exequiel Boribor
            </a>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
        <footer className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-10 text-xs text-slate-500 sm:px-6">
          <span>All invoices, vendors and amounts are fake. Approved invoices post to a Xero demo company.</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-brand-600">Privacy</Link>
            <Link href="/terms" className="hover:text-brand-600">Terms</Link>
          </span>
        </footer>
      </body>
    </html>
  );
}
