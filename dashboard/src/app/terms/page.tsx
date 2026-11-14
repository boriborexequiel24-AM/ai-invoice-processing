import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms | Invoice Processing demo",
  description: "The terms for using this public demo: what it is, the limits, and what not to upload.",
};

export default function Terms() {
  return (
    <LegalPage
      title="Terms of use"
      updated="14 November 2026"
      intro="This site is a free portfolio demo built by Exequiel Boribor. Using it means you are happy with the following."
    >
      <Section title="What this is">
        <p>
          A working demonstration of an invoice processing system, published so people can see how it behaves. It is not
          a product, it is not for sale, and it is not accounting software. Nothing it produces is advice of any kind,
          and no real bills are filed anywhere: approved sample invoices go to a Xero demo company holding fake accounts.
        </p>
      </Section>

      <Section title="What not to upload">
        <p>
          Do not upload a real invoice, anything confidential, or any document containing another person&apos;s details.
          What you upload is read by AI and the results are published on a page anyone can see, so treat an upload as
          publishing it.
        </p>
        <p>Do not upload anything unlawful, or anything you do not have the right to share.</p>
      </Section>

      <Section title="The limits">
        <ul>
          <li>PDF files only, up to 5 MB each.</li>
          <li>5 invoices per visitor per day, and a cap on total uploads per day.</li>
          <li>Everything you upload is deleted automatically within 24 hours.</li>
        </ul>
        <p>
          These exist to keep a public demo affordable to run. Please do not work around them or use the demo for
          automated or bulk processing.
        </p>
      </Section>

      <Section title="Your content stays yours">
        <p>
          Uploading something does not give away any rights to it. You are simply allowing the demo to process it so it
          can show you the result, after which it is deleted. See the{" "}
          <a className="underline" href="/privacy">
            privacy page
          </a>{" "}
          for the detail.
        </p>
      </Section>

      <Section title="No guarantees">
        <p>
          The demo is offered as it is. It may be slow, unavailable, or changed without notice, and the AI can read an
          invoice wrong. Do not rely on it for anything that matters. To the extent the law allows, no liability is
          accepted for any loss arising from using it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          These terms may change as the demo does. The date at the top says when they last did.
        </p>
      </Section>
    </LegalPage>
  );
}
