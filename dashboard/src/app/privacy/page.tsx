import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy | Invoice Processing demo",
  description: "What happens to a PDF you upload to this demo, what is stored, and how long it is kept.",
};

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy"
      updated="14 November 2026"
      intro="This is a public demo, not a product. Everything below describes what the system actually does with what you give it."
    >
      <Section title="If you upload a PDF">
        <ul>
          <li>The file is stored in a private bucket. It is not browsable, and it opens only through links that expire.</li>
          <li>Its contents are sent to the OpenAI API, which reads the invoice and returns the fields.</li>
          <li>
            The fields it reads (vendor, invoice number, dates, currency, line items and totals) are shown on this
            dashboard, which anyone can read.
          </li>
          <li>A message about it is posted to a private Slack channel, where the approval buttons live.</li>
          <li>
            Within 24 hours an automatic job deletes all of it: the file, the extracted data, the history and the Slack
            message.
          </li>
          <li>Uploads are never posted to the accounting system. Only the built-in samples go that far.</li>
        </ul>
        <p className="font-medium text-slate-900">
          So please do not upload a real invoice, or any document with someone else&apos;s details on it. The sample
          invoices show the same thing with made-up data.
        </p>
      </Section>

      <Section title="What else is stored">
        <ul>
          <li>
            A salted SHA-256 hash of your IP address, used only to count the 5 invoices a day each visitor gets. Your
            actual IP address is never written down, and the hash cannot be turned back into it. It is deleted along with
            the invoice.
          </li>
          <li>No account, no sign-in, no email address.</li>
          <li>This site sets no cookies and runs no analytics or tracking scripts.</li>
        </ul>
      </Section>

      <Section title="Who else sees it">
        <p>The demo is built out of ordinary services, and an upload passes through these:</p>
        <ul>
          <li><strong>OpenAI</strong> reads the PDF and returns the fields.</li>
          <li><strong>Supabase</strong> holds the database and the file, until it is deleted.</li>
          <li><strong>Vercel</strong> hosts this site and keeps the usual server request logs.</li>
          <li><strong>n8n</strong>, self-hosted, runs the steps in between.</li>
          <li><strong>Slack</strong> receives the approval message in a private channel.</li>
          <li><strong>Xero</strong> receives approved sample invoices only, in a demo company holding no real accounts.</li>
        </ul>
        <p>Each handles the data under its own terms. Nothing is sold, shared or used for advertising.</p>
      </Section>

      <Section title="Invoices arriving by email">
        <p>
          The system can also pick up invoices from a mailbox its owner controls. It processes only messages that the
          owner labels by hand, one at a time. There is no address you can email, and no mail is read automatically.
        </p>
      </Section>

      <Section title="Getting something removed">
        <p>
          Anything you upload disappears on its own within 24 hours. If you want it gone sooner, or you have a question
          about any of this, get in touch through{" "}
          <a className="text-brand-600 underline" href="https://workwithzeki.vercel.app" target="_blank" rel="noreferrer">
            workwithzeki.vercel.app
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
