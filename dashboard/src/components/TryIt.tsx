"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FEATURED_SAMPLES } from "@/lib/samples";

const STAGES = [
  { label: "Uploading the PDF", seconds: 3 },
  { label: "Reading it with AI", seconds: 6 },
  { label: "Running 12 checks", seconds: 3 },
  { label: "Posting to Slack for approval", seconds: 3 },
];

type State = { kind: "idle" } | { kind: "working"; name: string } | { kind: "error"; message: string };

export function TryIt({ maxFileMb }: { maxFileMb: number }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });
  const [stage, setStage] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Move through the stages while waiting. The real work happens in n8n; this just shows progress.
  useEffect(() => {
    if (state.kind !== "working") return;
    setStage(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    STAGES.slice(0, -1).forEach((s, i) => {
      elapsed += s.seconds * 1000;
      timers.push(setTimeout(() => setStage(i + 1), elapsed));
    });
    return () => timers.forEach(clearTimeout);
  }, [state.kind]);

  async function send(body: FormData, name: string) {
    setState({ kind: "working", name });
    try {
      const res = await fetch("/api/process", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.invoice_id) {
        router.push(`/invoices/${data.invoice_id}?fresh=1`);
      } else if (res.status === 409 && data.invoice_id) {
        router.push(`/invoices/${data.invoice_id}?existing=1`);
      } else {
        setState({ kind: "error", message: data.message ?? "Something went wrong. Please try again." });
      }
    } catch {
      setState({ kind: "error", message: "Couldn't reach the server. Please try again." });
    }
  }

  function trySample(file: string, title: string) {
    const body = new FormData();
    body.append("sample", file);
    send(body, title);
  }

  function uploadFile(file: File | undefined) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf") {
      setState({ kind: "error", message: "Only PDF files are accepted." });
      return;
    }
    if (file.size > maxFileMb * 1024 * 1024) {
      setState({ kind: "error", message: `Files can be up to ${maxFileMb} MB.` });
      return;
    }
    const body = new FormData();
    body.append("file", file);
    send(body, file.name);
  }

  const busy = state.kind === "working";

  return (
    <div>
      <h2 className="m-0 font-serif text-3xl font-medium sm:text-[34px]">Now hand it a bad one</h2>
      <p className="mb-5 mt-2 text-ink-2">
        Each sample hides a different problem. Pick one and it goes through the real system, in about 15 seconds.
      </p>

      {busy ? (
        <div className="tape-edge border border-t-0 border-edge bg-paper-2 px-5 pb-6 pt-5 font-mono text-[13px] leading-8" aria-live="polite">
          <p className="m-0 mb-2 text-center text-muted">*** PROCESSING {state.name.toUpperCase()} ***</p>
          <ol className="m-0 list-none p-0">
            {STAGES.slice(0, stage + 1).map((s, i) => (
              <li key={s.label} className="print-line flex justify-between gap-4">
                <span>{s.label.toUpperCase()}</span>
                <span className={i < stage ? "text-pass" : "animate-pulse text-muted"}>{i < stage ? "DONE ✓" : "..."}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FEATURED_SAMPLES.map((s) => (
              <button
                key={s.file}
                type="button"
                onClick={() => trySample(s.file, s.title)}
                title={s.hint}
                className="border border-edge bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-ink"
              >
                <span className="block font-serif text-[19px] leading-tight">{s.title}</span>
                <span
                  className={`mt-1 block font-hand text-[22px] leading-tight ${
                    s.expect === "pass" ? "text-pass" : s.expect === "warn" ? "text-warn" : "text-pen"
                  }`}
                >
                  {s.note}
                </span>
              </button>
            ))}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              uploadFile(e.dataTransfer.files[0]);
            }}
            className={`mt-3 flex flex-wrap items-center justify-between gap-3 border border-dashed p-5 ${
              dragging ? "border-ink bg-white" : "border-[#8c8370]"
            }`}
          >
            <span className="font-serif text-[19px]">Or drop your own PDF here</span>
            <span className="min-w-60 flex-1 text-[13px] text-muted">
              Up to {maxFileMb} MB. No real or sensitive invoices please. Uploads are deleted after 24 hours and never sent to Xero.
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-ink px-4 py-2.5 text-sm text-paper hover:bg-ink-2"
            >
              Choose a file
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => uploadFile(e.target.files?.[0])}
            />
          </div>
        </>
      )}

      {state.kind === "error" && (
        <p className="mt-3 border-l-4 border-pen bg-white px-4 py-3 text-sm text-pen" role="alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
