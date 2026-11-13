# Case study copy for workwithzeki.vercel.app

Draft wording for adding this project to the portfolio site. Edit it to sound like you.

Every number here comes from the project's own measurements. The one assumption is the manual baseline (5 to 10 minutes to key in an invoice by hand), which is an industry rule of thumb, not something measured here. Say so, or drop it, rather than presenting it as a client result.

---

## For the project card

**Title:** AI Invoice Processing (Accounts Payable)

**Category:** AI Workflow · Finance Operations

**Tools:** n8n · OpenAI · Supabase · Slack · Xero · Next.js

**Description (short):**
An invoice PDF goes in and a bill in Xero comes out. AI reads the invoice, 12 checks catch the problems a person would catch, and a one-click approval in Slack is the only human step. Live demo you can try with your own PDF.

**Metric to show:** `About 20 seconds per invoice, at roughly a quarter of a cent in AI cost`

**Links:** Live demo · Code on GitHub

---

## For the full case study page

### The problem
Accounts payable is the same handful of steps on every invoice: read the PDF, type the vendor, number, dates and totals into the accounting system, check the figures add up, check it is not a repeat, check it matches the purchase order, then chase someone for approval. It is slow, it is easy to get wrong, and the cost of a mistake is real money leaving the business.

### What I built
A system that does all of that except the approval, which stays with a person.

1. **The invoice arrives.** A PDF is uploaded on the dashboard. The system fingerprints the file, so the same invoice is never processed twice.
2. **AI reads it.** The vendor, invoice number, dates, currency, line items and totals come back in a fixed format, with a confidence score on every field. The AI is told to copy what is printed and never fix the numbers, so the checks still catch a bad invoice.
3. **Twelve checks run.** Do the line items add up? Does subtotal plus tax equal the total? Has this invoice number come from this vendor before? Does the purchase order exist, is it still open, is it the right vendor, the right currency, and is the invoice within 2% of it? Is the vendor one we know? Was the AI sure?
4. **A person decides.** The invoice lands in Slack with the totals and any problems written in plain English, and Approve and Reject buttons. Anything flagged needs a second confirming click.
5. **The bill is created.** Approved invoices become bills in Xero with the original PDF attached, and the Slack message updates with a link to the bill.

Everything is logged, so each invoice has a timeline from arrival to posted.

### Why it can be trusted
This is the part worth talking about with clients.

- **The AI accuracy was measured, not assumed.** I built 13 test invoices covering the awkward cases: an exact duplicate, line items that do not add up, a wrong total, a missing purchase order, an invoice 30% over its PO, an unknown vendor, a blurry scan with no text layer, a 32-line invoice over two pages, and a euro invoice with European date and number formats. Then I scored four OpenAI models against an answer key. The one I picked read all 13 perfectly.
- **Testing found a real bug.** On invoices with no purchase order, the cheaper models gave the correct answer but rated their own confidence near zero, which would have sent clean invoices to manual review for no reason. Fixing the instructions brought every field to 95% confidence or higher.
- **Approvals cannot be faked.** Every button click is checked against Slack's signature and rejected if it is more than five minutes old. Clicking twice changes nothing.
- **Failures stay visible.** When Xero refused a euro bill because the demo company has no euro set up, the approval was kept, the reason was saved in readable form, and the team got an alert. Nothing failed silently.

### Results
| | |
|---|---|
| Field accuracy on the test set | 13 of 13 invoices, every field |
| Time per invoice | About 20 seconds, then a one-click approval |
| AI cost per invoice | About $0.0025, so roughly $2.50 per 1,000 |
| Checks applied | 12, each with a plain-English reason |
| Human steps | One: approve or reject |

For comparison, keying an invoice in by hand and checking it is usually a 5 to 10 minute job. That figure is a general industry rule of thumb, not a measurement from this project.

### Built with
n8n for the workflows, the OpenAI API for reading invoices, Supabase for the database and file storage, a Slack app for approvals, the Xero API for the bills, and a Next.js dashboard on Vercel.

### Try it
The demo is public. Pick one of the sample invoices, or upload your own PDF and watch it go through. Uploads are limited, deleted after 24 hours, and never posted to the accounting system.
