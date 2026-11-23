"""End-to-end test for workflow 2 (Slack approval + Xero).

Sends button clicks to the approval webhook exactly like Slack does, signed
with the Slack signing secret, then checks the database. Run
scripts/test_n8n_intake.py --reset first so the sample invoices exist and have
Slack messages.

Covers:
  - approve a clean invoice        -> posted to Xero, PDF attached, bill totals the invoice
  - approve a flagged invoice      -> posted to Xero ("approve anyway"), and the bill totals
                                      the invoice even though its own line items don't add up
  - approve a EUR invoice          -> posted to Xero, or a clear Xero error if EUR isn't enabled
  - reject an invoice              -> rejected, nothing sent to Xero
  - approve a public demo upload   -> approved, not sent to Xero
  - click again on a decided one   -> no change
  - forged request (bad signature) -> ignored
  - every approval run finished    -> none died in a node after the bill was created

The last two kinds of check are here because the database can look right while
the run went wrong. A bill posted for the wrong amount and a Slack message that
never got updated both leave a perfectly correct invoices row behind, which is
how two real bugs survived an earlier version of this test.

Usage (from the project root):
    .venv/Scripts/python.exe scripts/test_approval.py
"""

from __future__ import annotations

import hashlib
import hmac
import json
import sys
import time
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_n8n_intake import http, load_env, supabase  # noqa: E402

TEST_USER = {"id": "U_TEST_SCRIPT", "username": "test-script", "name": "test-script"}
APPROVAL_WORKFLOW_NAME = "Invoice Processing | 2. Approval + Xero"


def click(env: dict, inv: dict, action: str, secret: str | None = None) -> int:
    """Send a signed Slack button click for one invoice."""
    payload = {
        "type": "block_actions",
        "user": TEST_USER,
        "channel": {"id": inv.get("slack_channel")},
        "message": {"ts": inv.get("slack_message_ts")},
        "actions": [{"action_id": f"{action}_invoice", "value": inv["id"], "type": "button"}],
    }
    body = "payload=" + urllib.parse.quote_plus(json.dumps(payload))
    timestamp = str(int(time.time()))
    signing_secret = secret if secret is not None else env["SLACK_SIGNING_SECRET"]
    signature = "v0=" + hmac.new(signing_secret.encode(), f"v0:{timestamp}:{body}".encode(), hashlib.sha256).hexdigest()
    status, _ = http(
        "POST",
        env["N8N_BASE_URL"].rstrip("/") + "/webhook/invoice-slack-actions",
        {
            "Content-Type": "application/x-www-form-urlencoded",
            "X-Slack-Request-Timestamp": timestamp,
            "X-Slack-Signature": signature,
        },
        body.encode(),
    )
    return status


def load(env: dict, file_name: str) -> dict:
    _, rows = supabase(env, "GET", f"/rest/v1/invoices?select=*&source=eq.sample&file_name=eq.{file_name}")
    if not rows:
        raise SystemExit(f"{file_name} not found. Run scripts/test_n8n_intake.py --reset first.")
    return rows[0]


def wait_for(env: dict, invoice_id: str, done: set[str], timeout: int = 90) -> dict:
    """Poll until the invoice reaches one of the given statuses (or time runs out)."""
    deadline = time.time() + timeout
    while True:
        _, rows = supabase(env, "GET", f"/rest/v1/invoices?select=*,invoice_events(step,details,created_at)&id=eq.{invoice_id}")
        row = rows[0]
        if row["status"] in done or time.time() > deadline:
            return row
        time.sleep(2)


def last_error(row: dict) -> str:
    errors = [e for e in row["invoice_events"] if e["step"] == "error"]
    return errors[-1]["details"].get("error", "")[:200] if errors else ""


def bill_total(row: dict) -> float | None:
    """What Xero said the bill came to, as recorded by the 'posted' step."""
    for event in row["invoice_events"]:
        if event["step"] == "posted" and (event["details"] or {}).get("bill_total") is not None:
            return float(event["details"]["bill_total"])
    return None


def n8n(env: dict, path: str):
    """Read from the n8n API. The workflow id is looked up by name, never hard-coded."""
    status, body = http(
        "GET",
        env["N8N_BASE_URL"].rstrip("/") + "/api/v1" + path,
        {"X-N8N-API-KEY": env["N8N_API_KEY"], "Accept": "application/json"},
    )
    if status != 200:
        raise SystemExit(f"n8n API GET {path} failed: HTTP {status} {json.dumps(body)[:200]}")
    return body


def failed_runs(env: dict, since: datetime) -> list[dict]:
    """Approval runs that ended in error since `since`, with the node that stopped each one."""
    workflow = next((w for w in n8n(env, "/workflows?limit=250")["data"] if w["name"] == APPROVAL_WORKFLOW_NAME), None)
    if not workflow:
        raise SystemExit(f'Workflow "{APPROVAL_WORKFLOW_NAME}" is not in n8n. Deploy it first.')
    runs = []
    for run in n8n(env, f"/executions?workflowId={workflow['id']}&status=error&limit=50")["data"]:
        if datetime.fromisoformat(run["startedAt"].replace("Z", "+00:00")) < since:
            continue
        detail = n8n(env, f"/executions/{run['id']}?includeData=true")
        node = ((detail.get("data") or {}).get("resultData") or {}).get("lastNodeExecuted")
        runs.append({"id": run["id"], "node": node or "an unknown node"})
    return runs


def main() -> None:
    env = load_env()
    started = datetime.now(timezone.utc)
    results = []

    def check(label: str, ok: bool, detail: str = "") -> None:
        results.append(ok)
        print(f"  {'PASS' if ok else 'FAIL'}  {label}" + (f"  ({detail})" if detail else ""))

    def check_bill(label: str, row: dict) -> None:
        """The bill in Xero has to come to the invoice's own total, to the cent."""
        posted, total = bill_total(row), row["total"]
        ok = posted is not None and total is not None and abs(posted - float(total)) < 0.005
        check(label, ok, f"bill {posted}, invoice {total}")

    # 1. Clean invoice -> Xero
    inv = load(env, "01-clean-northwind.pdf")
    click(env, inv, "approve")
    row = wait_for(env, inv["id"], {"posted"})
    attached = any(e["step"] == "posted" and e["details"].get("pdf_attached") for e in row["invoice_events"])
    check("approve clean invoice -> posted to Xero", row["status"] == "posted" and bool(row["xero_bill_id"]),
          f"status {row['status']}, PDF attached: {attached}" + (f", error: {last_error(row)}" if row["status"] != "posted" else ""))
    check_bill("clean invoice -> bill totals the invoice", row)

    # 2. Flagged invoice, approved anyway -> Xero. This one's line items come to 2,165.00
    # against a printed total of 2,210.00, so a bill built from the parts would be wrong.
    inv = load(env, "06-math-error-harbor.pdf")
    click(env, inv, "approve")
    row = wait_for(env, inv["id"], {"posted"})
    check("approve flagged invoice anyway -> posted to Xero", row["status"] == "posted", f"status {row['status']}")
    check_bill("invoice whose lines don't add up -> bill still totals the invoice", row)

    # 3. EUR invoice -> Xero (may fail if the demo company has no EUR; the error must be recorded)
    inv = load(env, "13-euro-lindqvist.pdf")
    click(env, inv, "approve")
    row = wait_for(env, inv["id"], {"posted"}, timeout=60)
    if row["status"] == "posted":
        check("approve EUR invoice -> posted to Xero", True)
        check_bill("EUR invoice -> bill totals the invoice", row)
    else:
        err = last_error(row)
        check("approve EUR invoice -> Xero error recorded, approval kept", row["status"] == "approved" and bool(err), err)

    # 4. Reject -> no Xero
    inv = load(env, "08-missing-po-northwind.pdf")
    click(env, inv, "reject")
    row = wait_for(env, inv["id"], {"rejected"})
    check("reject invoice -> rejected, not sent to Xero", row["status"] == "rejected" and not row["xero_bill_id"],
          f"status {row['status']}, decided by {row['decided_by']}")

    # 5. Public demo upload -> approved but never sent to Xero
    inv = load(env, "03-clean-cedar.pdf")
    supabase(env, "PATCH", f"/rest/v1/invoices?id=eq.{inv['id']}", {"source": "upload"})
    click(env, dict(inv, source="upload"), "approve")
    row = wait_for(env, inv["id"], {"approved", "posted"})
    time.sleep(5)
    row = wait_for(env, inv["id"], {"approved"}, timeout=1)
    supabase(env, "PATCH", f"/rest/v1/invoices?id=eq.{inv['id']}", {"source": "sample"})
    check("approve demo upload -> approved, not sent to Xero", row["status"] == "approved" and not row["xero_bill_id"],
          f"status {row['status']}")

    # 6. Second click on an already decided invoice -> no change
    inv = load(env, "08-missing-po-northwind.pdf")
    click(env, inv, "approve")
    time.sleep(8)
    row = wait_for(env, inv["id"], {"rejected"}, timeout=1)
    check("second click on decided invoice -> no change", row["status"] == "rejected", f"status {row['status']}")

    # 7. Forged request -> ignored
    inv = load(env, "02-clean-brightline.pdf")
    click(env, inv, "reject", secret="not-the-real-secret")
    time.sleep(8)
    row = wait_for(env, inv["id"], {"ready_for_approval"}, timeout=1)
    check("forged request (bad signature) -> ignored", row["status"] == "ready_for_approval", f"status {row['status']}")

    # 8. Nothing may fail quietly. An approval can create the bill, attach the PDF and mark
    # the invoice posted, then die in a later node, leaving the database looking correct.
    failures = failed_runs(env, started)
    check("every approval run finished", not failures,
          "; ".join(f"run {f['id']} stopped in {f['node']}" for f in failures) or "none")

    print(f"\n{sum(results)}/{len(results)} checks passed.")


if __name__ == "__main__":
    main()
