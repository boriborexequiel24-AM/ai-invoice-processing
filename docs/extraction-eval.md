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

## The retry setting that cost three calls per invoice

For a while the AI step took about 18 seconds in n8n but about 3 seconds running the same request from a laptop. The obvious suspect was the network path from the server, and that was wrong.

Timing outbound requests from the server settled it: OpenAI answered a connection in 263ms, and a small API call took 1.5s, the same as from a laptop. Sending the exact invoice payload from the server took 3.4s. So the request was never slow.

The difference was the node's own `retryOnFail` setting. n8n runs a node `maxTries` times **even when the call succeeds**, which these measurements from the server show plainly:

| Node setting | Time |
|---|---|
| No retry | 3.6s |
| 2 tries, 3s apart | 9.5s |
| 3 tries, no wait | 13.3s |
| 3 tries, 3s apart (what the workflow had) | 16.0s |

Every invoice was making three OpenAI calls instead of one: roughly five times slower, and three times the cost. Removing the setting brought the AI step to **4.1s** and the cost to one call.

Retrying is still handled, just not there. A failure drops to the workflow's error branch, which records the reason and alerts. In the email workflow, a failed hand-over simply keeps the Gmail label, so the next run picks the message up again.

The lesson worth keeping: a per-node retry that re-runs a paid API call is expensive in both senses, and n8n's does not wait for a failure to do it.

**Limits of this test:** 13 generated invoices is a small set. Real invoices with handwriting, stamps or unusual layouts will be harder, which is why low-confidence reads go to manual review.
