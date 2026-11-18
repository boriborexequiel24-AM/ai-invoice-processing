import type { Metadata } from "next";
import { Caveat, JetBrains_Mono, Newsreader, Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "The Invoice Desk | AI accounts payable demo",
  description:
    "Upload an invoice and watch it get read by AI, checked like an accountant would, approved in Slack and posted to Xero. A portfolio demo by Exequiel Boribor.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${publicSans.variable} ${newsreader.variable} ${jetbrainsMono.variable} ${caveat.variable} min-h-screen font-sans`}
      >
        <div className="bg-ink font-mono text-xs text-paper">
          <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-5 gap-y-1 px-4 py-2 sm:px-6">
            <span>LIVE DEMO · FAKE INVOICES · XERO DEMO COMPANY</span>
            <a href="https://workwithzeki.vercel.app" target="_blank" rel="noreferrer" className="hover:underline">
              BUILT BY EXEQUIEL BORIBOR
            </a>
          </div>
        </div>

        <header className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-b-[3px] border-double border-ink pb-4 pt-5">
            <Link href="/" className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-serif text-3xl font-semibold tracking-tight sm:text-[34px]">The Invoice Desk</span>
              <span className="font-mono text-[13px] text-muted">accounts payable, automated</span>
            </Link>
            <nav className="flex gap-5 text-[15px] [&_a]:underline [&_a:hover]:text-pen">
              <Link href="/#try">Try it</Link>
              <Link href="/#invoices">All invoices</Link>
              <Link href="/#how">How it works</Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t-[3px] border-double border-ink pt-5 text-[13px] text-muted">
            <span>All invoices, vendors and amounts are fake. Approved samples post to a Xero demo company.</span>
            <span className="flex gap-4 [&_a]:underline [&_a:hover]:text-pen">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
