# Extraction accuracy test

Run on 2026-11-13 12:21 with `scripts/eval_extraction.py` (reasoning effort: low).
Each invoice is checked on 10 things: vendor, invoice number, both dates, PO number, currency,
subtotal, tax, total, and every line item amount. The answer key is `sample-invoices/expected.json`.

| Model | Accuracy | Perfect invoices | Avg time | Cost per invoice | Errors |
|---|---|---|---|---|---|
| gpt-5.4-nano | 100.0% | 13 / 13 | 4.0s | $0.0006 | 0 |
| gpt-5.4-mini | 100.0% | 13 / 13 | 3.4s | $0.0025 | 0 |

## Misses

None. Every model read every field correctly.

## How the model was chosen

**First round (4 models, all 13 invoices):** gpt-5.4-nano, gpt-4.1-mini, gpt-5.4-mini and gpt-5.5 all scored 100%. gpt-5.5 cost about $0.0145 per invoice, roughly 6 times more than gpt-5.4-mini, for no gain in accuracy. (gpt-5-mini was skipped: it needs a verified OpenAI organization.)

**Problem found:** on invoices with no PO, the cheaper models returned the correct answer (no PO) but gave it a confidence of 0.00 to 0.20. That would have sent clean reads to manual review for the wrong reason. The prompt was updated to say that a correctly returned "not on the invoice" deserves high confidence. After the fix, every field on every invoice scored 0.95 or higher.

**Decision:** use **gpt-5.4-mini**. It was perfect on every invoice, the fastest, and had the steadiest confidence scores. At about $0.0025 per invoice, 1,000 invoices cost around $2.50. gpt-5.4-nano is a cheaper fallback if volume grows.

**End-to-end check (n8n):** all 13 samples were uploaded to the live n8n webhook with `scripts/test_n8n_intake.py`. All 13 were read 10/10 and saved correctly (invoice row, line items, events). Re-uploading the same file returned 409, a non-PDF returned 415, and a wrong secret returned 403.

**Speed note:** the AI call takes about 15 seconds from the n8n server versus about 3 seconds from a laptop, with identical token counts. The extra time is in the network path from the server to OpenAI, not the workflow. To look into later (for example an IPv6 routing delay on the VPS).

**Limits of this test:** 13 generated invoices is a small set. Real invoices with handwriting, stamps or unusual layouts will be harder, which is why low-confidence reads go to manual review.
