"""End-to-end test: a file whose processing failed can be sent again, within limits.

Runs against the live intake webhook. It makes one real AI call, posts one Slack
message, and leaves nothing behind: its rows are marked as expired uploads, which
hides them from the dashboard, and the hourly cleanup workflow deletes them
together with their PDFs and the Slack message. Nothing can reach Xero.

Covers:
  - a file that keeps failing      -> 502 three times, then 429, on one invoice row
  - a failed file that now works   -> 200 on the same row, old line items replaced
  - the same file once more        -> 409, as before

Usage (from the project root):
    .venv/Scripts/python.exe scripts/test_intake_retry.py
"""

from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from eval_extraction import SAMPLES  # noqa: E402
from test_n8n_intake import load_env, supabase, upload  # noqa: E402

TRIES = 3  # MAX_TRIES_PER_DAY in build_n8n_workflow.py
GOOD_SAMPLE = "02-clean-brightline.pdf"


def find(env: dict, file_hash: str) -> list[dict]:
    _, rows = supabase(env, "GET", "/rest/v1/invoices?select=id,status,invoice_line_items(description),"
                                   f"invoice_events(step)&file_hash=eq.{file_hash}")
    return rows or []


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
        finally:
            for file_hash in hashes:
                supabase(env, "PATCH", f"/rest/v1/invoices?file_hash=eq.{file_hash}", {"expires_at": "2026-01-01T00:00:00Z"})
            print("  Test rows marked as expired. The hourly cleanup deletes them.")

    print(f"\n{sum(results)}/{len(results)} checks passed.")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
