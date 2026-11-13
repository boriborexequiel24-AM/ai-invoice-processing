"""Score AI invoice extraction against the sample invoices.

Sends every PDF in sample-invoices/ to one or more OpenAI models, using the
same prompt and JSON schema as the n8n workflow (extraction/), then compares
the result with sample-invoices/expected.json.

Reports, per model: field accuracy, invoices read perfectly, speed and cost.
Writes a summary to docs/extraction-eval.md and raw output to
scripts/eval-results/ (not committed).

Usage (from the project root):
    .venv/Scripts/python.exe scripts/eval_extraction.py --models gpt-5.4-mini gpt-5.4-nano
    .venv/Scripts/python.exe scripts/eval_extraction.py --models gpt-5.4-mini --only 11 13
"""

from __future__ import annotations

import argparse
import base64
import json
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "sample-invoices"
PROMPT = (ROOT / "extraction" / "prompt.md").read_text(encoding="utf-8")
SCHEMA = json.loads((ROOT / "extraction" / "schema.json").read_text(encoding="utf-8"))
RESULTS_DIR = ROOT / "scripts" / "eval-results"
REPORT = ROOT / "docs" / "extraction-eval.md"

# USD per 1M tokens: (input, cached input, output).
# Source: developers.openai.com/api/docs/pricing, standard tier, checked 2026-11-13.
PRICES = {
    "gpt-5.5": (5.00, 0.50, 30.00),
    "gpt-5.4-mini": (0.75, 0.075, 4.50),
    "gpt-5.4-nano": (0.20, 0.02, 1.25),
    "gpt-4.1-mini": (0.40, 0.10, 1.60),
    "gpt-5-mini": (0.25, 0.025, 2.00),
}

SCALAR_FIELDS = [
    "vendor_name", "invoice_number", "invoice_date", "due_date",
    "po_number", "currency", "subtotal", "tax", "total",
]
MONEY_FIELDS = {"subtotal", "tax", "total"}


def load_env() -> dict[str, str]:
    values = {}
    for line in (ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        match = re.match(r"^\s*([A-Z0-9_]+)=(.*)$", line)
        if match:
            values[match.group(1)] = match.group(2).strip().strip('"').strip("'")
    return values


# ---------- Calling OpenAI ----------

def extract(api_key: str, model: str, pdf_path: Path, effort: str) -> dict:
    """Send one PDF to the Responses API and return the parsed result plus usage."""
    pdf_b64 = base64.b64encode(pdf_path.read_bytes()).decode()
    body = {
        "model": model,
        "instructions": PROMPT,
        "input": [{
            "role": "user",
            "content": [
                {"type": "input_file", "filename": pdf_path.name, "file_data": f"data:application/pdf;base64,{pdf_b64}"},
                {"type": "input_text", "text": "Extract the data from this invoice."},
            ],
        }],
        "text": {"format": {"type": "json_schema", "name": "invoice", "schema": SCHEMA, "strict": True}},
    }
    if model.startswith(("gpt-5", "o")):
        body["reasoning"] = {"effort": effort}

    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
    )
    started = time.monotonic()
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                payload = json.loads(response.read())
            break
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")[:500]
            if error.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 ** attempt * 3)
                continue
            raise RuntimeError(f"HTTP {error.code}: {detail}") from None
    seconds = time.monotonic() - started

    text = next(
        part["text"]
        for item in payload["output"] if item.get("type") == "message"
        for part in item["content"] if part.get("type") == "output_text"
    )
    usage = payload.get("usage", {})
    return {"data": json.loads(text), "usage": usage, "seconds": round(seconds, 1)}


def cost_usd(model: str, usage: dict) -> float | None:
    if model not in PRICES:
        return None
    price_in, price_cached, price_out = PRICES[model]
    cached = usage.get("input_tokens_details", {}).get("cached_tokens", 0)
    fresh = usage.get("input_tokens", 0) - cached
    return (fresh * price_in + cached * price_cached + usage.get("output_tokens", 0) * price_out) / 1_000_000


# ---------- Scoring ----------

def normalize_text(value) -> str | None:
    if value is None:
        return None
    return re.sub(r"[^a-z0-9]", "", str(value).lower())


def money_equal(a, b) -> bool:
    if a is None or b is None:
        return a is None and b is None
    return abs(float(a) - float(b)) < 0.005


def score(expected: dict, actual: dict) -> dict:
    """Compare one extraction with the answer key. Returns per-check pass/fail."""
    checks = {}
    for field in SCALAR_FIELDS:
        want, got = expected[field], actual.get(field)
        if field in MONEY_FIELDS:
            checks[field] = money_equal(want, got)
        else:
            checks[field] = normalize_text(want) == normalize_text(got)

    want_items, got_items = expected["line_items"], actual.get("line_items") or []
    checks["line_items"] = len(want_items) == len(got_items) and all(
        money_equal(w["amount"], g.get("amount")) for w, g in zip(want_items, got_items)
    )
    return checks


# ---------- Running ----------

def run_one(api_key: str, model: str, effort: str, case: dict) -> dict:
    pdf = SAMPLES / case["file"]
    try:
        result = extract(api_key, model, pdf, effort)
    except Exception as error:  # report the failure and keep going
        return {"model": model, "file": case["file"], "error": str(error)}
    checks = score(case["printed"], result["data"])
    return {
        "model": model,
        "file": case["file"],
        "checks": checks,
        "passed": sum(checks.values()),
        "total_checks": len(checks),
        "seconds": result["seconds"],
        "usage": result["usage"],
        "cost": cost_usd(model, result["usage"]),
        "min_confidence": min(result["data"]["confidence"].values()),
        "extracted": result["data"],
    }


def summarize(model: str, rows: list[dict]) -> dict:
    ok = [r for r in rows if "error" not in r]
    costs = [r["cost"] for r in ok if r["cost"] is not None]
    return {
        "model": model,
        "invoices": len(rows),
        "errors": len(rows) - len(ok),
        "accuracy": sum(r["passed"] for r in ok) / max(1, sum(r["total_checks"] for r in ok)),
        "perfect": sum(r["passed"] == r["total_checks"] for r in ok),
        "avg_seconds": sum(r["seconds"] for r in ok) / max(1, len(ok)),
        "cost_total": sum(costs) if costs else None,
        "cost_per_invoice": (sum(costs) / len(costs)) if costs else None,
    }


def write_report(summaries: list[dict], rows: list[dict], effort: str) -> None:
    lines = [
        "# Extraction accuracy test",
        "",
        f"Run on {datetime.now():%Y-%m-%d %H:%M} with `scripts/eval_extraction.py` (reasoning effort: {effort}).",
        "Each invoice is checked on 10 things: vendor, invoice number, both dates, PO number, currency,",
        "subtotal, tax, total, and every line item amount. The answer key is `sample-invoices/expected.json`.",
        "",
        "| Model | Accuracy | Perfect invoices | Avg time | Cost per invoice | Errors |",
        "|---|---|---|---|---|---|",
    ]
    for s in summaries:
        cost = f"${s['cost_per_invoice']:.4f}" if s["cost_per_invoice"] is not None else "n/a"
        lines.append(
            f"| {s['model']} | {s['accuracy']:.1%} | {s['perfect']} / {s['invoices']} | "
            f"{s['avg_seconds']:.1f}s | {cost} | {s['errors']} |"
        )
    misses = [r for r in rows if "error" in r or r["passed"] < r["total_checks"]]
    lines += ["", "## Misses", ""]
    if not misses:
        lines.append("None. Every model read every field correctly.")
    for r in misses:
        if "error" in r:
            lines.append(f"- **{r['model']}**, {r['file']}: error ({r['error'][:120]})")
        else:
            failed = ", ".join(k for k, v in r["checks"].items() if not v)
            lines.append(f"- **{r['model']}**, {r['file']}: wrong {failed}")
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--models", nargs="+", required=True)
    parser.add_argument("--only", nargs="*", help="invoice numbers to run, e.g. 11 13")
    parser.add_argument("--effort", default="low", help="reasoning effort for gpt-5 models")
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()

    api_key = load_env().get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is empty in .env")

    cases = json.loads((SAMPLES / "expected.json").read_text(encoding="utf-8"))["invoices"]
    if args.only:
        cases = [c for c in cases if c["file"].split("-")[0] in {n.zfill(2) for n in args.only}]

    jobs = [(m, c) for m in args.models for c in cases]
    print(f"Running {len(jobs)} extractions ({len(args.models)} models x {len(cases)} invoices)...")
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        rows = list(pool.map(lambda job: run_one(api_key, job[0], args.effort, job[1]), jobs))

    summaries = [summarize(m, [r for r in rows if r["model"] == m]) for m in args.models]
    print()
    for s in summaries:
        cost = f"${s['cost_per_invoice']:.4f}/invoice" if s["cost_per_invoice"] is not None else "cost n/a"
        print(f"{s['model']:<16} accuracy {s['accuracy']:6.1%}   perfect {s['perfect']:>2}/{s['invoices']}   "
              f"avg {s['avg_seconds']:5.1f}s   {cost}   errors {s['errors']}")
    for r in rows:
        if "error" in r:
            print(f"  ERROR {r['model']} {r['file']}: {r['error'][:200]}")
        elif r["passed"] < r["total_checks"]:
            print(f"  miss  {r['model']} {r['file']}: " + ", ".join(k for k, v in r["checks"].items() if not v))

    RESULTS_DIR.mkdir(exist_ok=True)
    out = RESULTS_DIR / f"{datetime.now():%Y%m%d-%H%M%S}.json"
    out.write_text(json.dumps({"summaries": summaries, "rows": rows}, indent=2), encoding="utf-8")
    if not args.only:
        write_report(summaries, rows, args.effort)
        print(f"\nReport: {REPORT.relative_to(ROOT)}")
    print(f"Raw results: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
