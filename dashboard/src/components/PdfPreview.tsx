"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Draws each PDF page onto a canvas with PDF.js. Embedded PDF viewers (iframe)
 * don't work on many phones, so this keeps the preview working everywhere.
 */
export function PdfPreview({ url }: { url: string }) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const doc = await pdfjs.getDocument(url).promise;
        const container = pagesRef.current;
        if (!container || cancelled) return;
        container.replaceChildren();

        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block h-auto w-full border-b border-slate-100 last:border-0";
          canvas.setAttribute("aria-label", `Invoice page ${n} of ${doc.numPages}`);
          container.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport }).promise;
          if (cancelled) return;
        }
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-500">
        <span>Original PDF</span>
        <a href={url} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">
          Open PDF &rarr;
        </a>
      </div>
      {state === "loading" && <p className="p-10 text-center text-sm text-slate-500">Loading the PDF…</p>}
      {state === "error" && (
        <p className="p-10 text-center text-sm text-slate-500">
          The preview couldn&apos;t load. Use &ldquo;Open PDF&rdquo; above.
        </p>
      )}
      <div ref={pagesRef} className="max-h-[780px] overflow-y-auto" />
    </div>
  );
}
