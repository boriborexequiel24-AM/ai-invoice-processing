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
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold">Try it</h2>
        <p className="text-sm text-slate-600">
          Pick a sample invoice or upload your own PDF. It takes about 15 seconds.
        </p>
      </div>

      {busy ? (
        <div className="rounded-lg border border-brand-100 bg-brand-50 p-5" aria-live="polite">
          <p className="mb-3 text-sm font-medium text-brand-700">Processing {state.name}</p>
          <ol className="space-y-2">
            {STAGES.map((s, i) => (
              <li key={s.label} className="flex items-center gap-2 text-sm">
                <span
                  className={`size-2.5 rounded-full ${
                    i < stage ? "bg-emerald-500" : i === stage ? "animate-pulse bg-brand-500" : "bg-slate-300"
                  }`}
                />
                <span className={i <= stage ? "text-slate-900" : "text-slate-400"}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FEATURED_SAMPLES.map((s) => (
              <button
                key={s.file}
                type="button"
                onClick={() => trySample(s.file, s.title)}
                className="rounded-lg border border-slate-200 p-3 text-left transition hover:border-brand-500 hover:bg-brand-50"
              >
                <span className="block text-sm font-medium">{s.title}</span>
                <span className="block text-xs text-slate-500">{s.hint}</span>
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
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center ${
              dragging ? "border-brand-500 bg-brand-50" : "border-slate-300"
            }`}
          >
            <p className="text-sm font-medium">Drop a PDF here</p>
            <p className="mb-2 text-xs text-slate-500">or</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
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
            <p className="mt-3 text-xs text-slate-500">
              PDF up to {maxFileMb} MB. Please don&apos;t upload real or sensitive invoices. Uploads are deleted after 24 hours and never sent to Xero.
            </p>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.message}
        </p>
      )}
    </section>
  );
}
