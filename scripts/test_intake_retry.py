"""End-to-end test: a file whose processing failed can be sent again, within limits.

Runs against the live intake webhook. It makes two real AI calls, posts one Slack
message, and leaves nothing behind: its rows are marked as expired uploads, which
hides them from the dashboard, and the hourly cleanup workflow deletes them
together with their PDFs and the Slack message. Nothing can reach Xero.

Covers:
  - a file that keeps failing      -> 502 three times, then 429, on one invoice row
  - a failed file that now works   -> 200 on the same row, old line items replaced
  - the same file once more        -> 409, as before
  - the AI's answer can't be saved -> 502 and failed, with the reason in its history
  - a file being read right now    -> 409, left alone
  - a file abandoned halfway       -> tried again on the same row

Usage (from the project root):
    .venv/Scripts/python.exe scripts/test_intake_retry.py
"""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import fitz  # PyMuPDF

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_extraction import SAMPLES  # noqa: E402
from test_n8n_intake import load_env, supabase, upload  # noqa: E402

TRIES = 3  # MAX_TRIES_PER_DAY in build_n8n_workflow.py
GOOD_SAMPLE = "02-clean-brightline.pdf"


def find(env: dict, file_hash: str) -> list[dict]:
    _, rows = supabase(env, "GET", "/rest/v1/invoices?select=id,status,invoice_line_items(description),"
                                   f"invoice_events(step,details)&file_hash=eq.{file_hash}")
    return rows or []


def too_large_invoice() -> bytes:
    """A readable invoice whose total doesn't fit the database column, so saving it fails."""
    doc = fitz.open()
    page = doc.new_page()
    for i, line in enumerate(["INVOICE", "Retry Test Ltd", "Invoice number: RT-" + uuid.uuid4().hex[:8], "Date: 2026-11-01",
                              "Due: 2026-12-01", "Currency: USD", "Service   1 x 99999999999.00   99999999999.00",
                              "Subtotal 99999999999.00", "Tax 0.00", "Total 99999999999.00"]):
        page.insert_text((72, 90 + i * 24), line, fontsize=13)
    return doc.tobytes()


def main() -> None:
    env = load_env()
    results = []
    hashes = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        results.append(ok)
        print(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f"  ({detail})" if detail else ""))

    with tempfile.TemporaryDirectory() as folder:
        def make(name: str, content: bytes) -> tuple[Path, str]:
            path = Path(folder) / name
            path.write_bytes(content)
            hashes.append(hashlib.sha256(content).hexdigest())
            return path, hashes[-1]

        tag = uuid.uuid4().hex.encode()
        try:
            # 1. Passes the %PDF- check, but is no PDF, so the AI call fails every time.
            broken, broken_hash = make("retry-test-broken.pdf", b"%PDF-1.4\nnot really a pdf " + tag)
            replies = [upload(env, broken, source="upload") for _ in range(TRIES + 1)]
            codes = [status for status, _ in replies]
            check("file that keeps failing -> tried three times, then refused", codes == [502] * TRIES + [429], str(codes))
            rows = find(env, broken_hash)
            steps = [e["step"] for e in rows[0]["invoice_events"]] if rows else []
            check("all on one invoice, with every try in its history",
                  len(rows) == 1 and rows[0]["status"] == "failed"
                  and steps.count("received") == TRIES and steps.count("error") == TRIES, f"{len(rows)} row, {steps}")

            # 2. A real invoice whose first try failed after its line items were saved.
            good, good_hash = make("retry-test-good.pdf", (SAMPLES / GOOD_SAMPLE).read_bytes() + b"\n% " + tag + b"\n")
            _, made = supabase(env, "POST", "/rest/v1/invoices", {
                "source": "upload", "status": "failed", "file_path": good_hash + ".pdf", "file_hash": good_hash,
                "file_name": good.name, "expires_at": "2026-01-01T00:00:00Z"})
            old_id = made[0]["id"]
            supabase(env, "POST", "/rest/v1/invoice_line_items",
                     {"invoice_id": old_id, "position": 1, "description": "left over from the failed try", "amount": 1})
            supabase(env, "POST", "/rest/v1/invoice_events", {"invoice_id": old_id, "step": "received", "actor": "system"})

            status, body = upload(env, good, source="upload")
            check("failed file sent again -> processed on the same row", status == 200 and body.get("invoice_id") == old_id,
                  f"HTTP {status}, {body.get('status')}")
            expected = next(c for c in json.loads((SAMPLES / "expected.json").read_text(encoding="utf-8"))["invoices"]
                            if c["file"] == GOOD_SAMPLE)["printed"]["line_items"]
            rows = find(env, good_hash)
            lines = [li["description"] for li in rows[0]["invoice_line_items"]] if rows else []
            check("old line items replaced", len(lines) == len(expected) and "left over from the failed try" not in lines,
                  f"{len(lines)} lines")

            # 3. Now that it worked, the same file is a duplicate again.
            status, body = upload(env, good, source="upload")
            check("same file once more -> 409", status == 409 and body.get("invoice_id") == old_id, f"HTTP {status}")

            # 4. The AI reads it, but the database refuses the numbers.
            large, large_hash = make("retry-test-large.pdf", too_large_invoice())
            status, _ = upload(env, large, source="upload")
            rows = find(env, large_hash)
            errors = [e["details"] for e in rows[0]["invoice_events"] if e["step"] == "error"] if rows else []
            check("answer that can't be saved -> failed, with the reason",
                  status == 502 and rows[0]["status"] == "failed" and len(errors) == 1 and errors[0]["stage"] == "saving"
                  and "overflow" in errors[0]["error"],
                  f"HTTP {status}, {rows and rows[0]['status']}, {errors}")

            # 5. In progress: left alone while fresh, tried again once abandoned. The file is
            # broken, so the retry fails, which is fine: what matters is that it was tried.
            for label, minutes, want_status, want_state in [("being read right now -> 409, left alone", 2, 409, "extracting"),
                                                            ("abandoned halfway -> tried again", 15, 502, "failed")]:
                stuck, stuck_hash = make(f"retry-test-stuck-{minutes}.pdf", b"%PDF-1.4\nnot really a pdf " + tag + str(minutes).encode())
                _, made = supabase(env, "POST", "/rest/v1/invoices", {
                    "source": "upload", "status": "extracting", "file_path": stuck_hash + ".pdf", "file_hash": stuck_hash,
                    "file_name": stuck.name, "expires_at": "2026-01-01T00:00:00Z",
                    "updated_at": (datetime.now(timezone.utc) - timedelta(minutes=minutes)).isoformat()})
                status, body = upload(env, stuck, source="upload")
                rows = find(env, stuck_hash)
                check(label, status == want_status and len(rows) == 1 and rows[0]["status"] == want_state
                      and body.get("invoice_id") == made[0]["id"], f"HTTP {status}, {rows and rows[0]['status']}")
        finally:
            for file_hash in hashes:
                supabase(env, "PATCH", f"/rest/v1/invoices?file_hash=eq.{file_hash}", {"expires_at": "2026-01-01T00:00:00Z"})
            print("  Test rows marked as expired. The hourly cleanup deletes them.")

    print(f"\n{sum(results)}/{len(results)} checks passed.")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
