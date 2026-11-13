"""End-to-end test: upload sample invoices to the live n8n webhook.

Each PDF goes through the real workflow (store, dedupe, AI extraction,
validation, save to Supabase). The extracted fields, final status and flags are
scored against sample-invoices/expected.json, and the database rows are checked too.

Usage (from the project root):
    .venv/Scripts/python.exe scripts/test_n8n_intake.py               # all 13 samples
    .venv/Scripts/python.exe scripts/test_n8n_intake.py --only 1 11   # some samples
    .venv/Scripts/python.exe scripts/test_n8n_intake.py --reset       # delete earlier sample runs first
"""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_extraction import ROOT, SAMPLES, load_env, score  # noqa: E402

SECRET_HEADER = "x-webhook-secret"


def http(method: str, url: str, headers: dict, body: bytes | None = None) -> tuple[int, dict | list | None]:
    request = urllib.request.Request(url, data=body, method=method, headers={"User-Agent": "invoice-test/1.0", **headers})
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raw = error.read()
        try:
            return error.code, json.loads(raw)
        except ValueError:
            return error.code, {"raw": raw.decode(errors="replace")[:300]}


def upload(env: dict, pdf: Path, source: str = "sample") -> tuple[int, dict]:
    boundary = uuid.uuid4().hex
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="source"\r\n\r\n{source}\r\n'.encode(),
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{pdf.name}"\r\n'
        f"Content-Type: application/pdf\r\n\r\n".encode(),
        pdf.read_bytes(),
        f"\r\n--{boundary}--\r\n".encode(),
    ]
    return http(
        "POST",
        env["N8N_BASE_URL"].rstrip("/") + "/webhook/invoice-intake",
        {SECRET_HEADER: env["N8N_WEBHOOK_SECRET"], "Content-Type": f"multipart/form-data; boundary={boundary}"},
        b"".join(parts),
    )


def supabase(env: dict, method: str, path: str, body: dict | None = None):
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    return http(
        method,
        env["SUPABASE_URL"].rstrip("/") + path,
        {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"},
        json.dumps(body).encode() if body is not None else None,
    )


def reset(env: dict) -> None:
    """Delete invoices created by earlier test runs (source = sample), including stored PDFs."""
    _, rows = supabase(env, "GET", "/rest/v1/invoices?select=id,file_path&source=eq.sample")
    rows = rows or []
    if rows:
        supabase(env, "DELETE", "/storage/v1/object/" + env.get("SUPABASE_STORAGE_BUCKET", "invoices"),
                 {"prefixes": [r["file_path"] for r in rows]})
        supabase(env, "DELETE", "/rest/v1/invoices?source=eq.sample")
    print(f"Reset: removed {len(rows)} sample invoices.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--only", nargs="*")
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    env = load_env()
    if args.reset:
        reset(env)

    cases = json.loads((SAMPLES / "expected.json").read_text(encoding="utf-8"))["invoices"]
    if args.only:
        cases = [c for c in cases if c["file"].split("-")[0] in {n.zfill(2) for n in args.only}]

    perfect = 0
    for case in cases:
        started = time.monotonic()
        status, body = upload(env, SAMPLES / case["file"])
        seconds = time.monotonic() - started
        if status != 200:
            print(f"  {case['file']:<30} HTTP {status}  {json.dumps(body)[:200]}")
            continue

        checks = score(case["printed"], body["extracted"])
        _, rows = supabase(env, "GET", f"/rest/v1/invoices?select=status,flags,invoice_line_items(count),invoice_events(step)&id=eq.{body['invoice_id']}")
        row = rows[0]
        saved_ok = (
            row["status"] == body["status"]
            and row["invoice_line_items"][0]["count"] == len(case["printed"]["line_items"])
            and {e["step"] for e in row["invoice_events"]} >= {"received", "extracted", "validated"}
        )

        # Status and flags must match the answer key ("a or b" means either is fine).
        allowed = {s.strip() for s in case["expected_status"].split(" or ")}
        got_flags = sorted(f["code"] for f in body["flags"] or [])
        verdict_ok = body["status"] in allowed and got_flags == sorted(case["expected_flags"])

        passed = sum(checks.values())
        perfect += passed == len(checks) and saved_ok and verdict_ok
        misses = ", ".join(k for k, v in checks.items() if not v)
        verdict = body["status"] + (f" [{', '.join(got_flags)}]" if got_flags else "")
        print(f"  {case['file']:<30} {passed}/{len(checks)} fields  db {'ok' if saved_ok else 'WRONG'}  "
              f"{'OK   ' if verdict_ok else 'WRONG'} {verdict:<52} {seconds:4.1f}s"
              + (f"  missed: {misses}" if misses else "")
              + ("" if verdict_ok else f"  expected: {case['expected_status']} {case['expected_flags']}"))

    print(f"\n{perfect}/{len(cases)} invoices extracted, validated and saved correctly.")


if __name__ == "__main__":
    main()
