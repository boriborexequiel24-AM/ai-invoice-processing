import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { ALLOWED_SAMPLES } from "@/lib/samples";
import { adminClient } from "@/lib/supabase";

// Sends a sample or an uploaded PDF to the n8n intake workflow.
// Runs on the server so the n8n secret never reaches the browser, and enforces the demo limits.

export const runtime = "nodejs";
export const maxDuration = 60;

function reply(status: number, error: string, message: string) {
  return Response.json({ error, message }, { status });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const sample = form.get("sample");
  const file = form.get("file");

  // Visitors are counted by a salted hash of their IP. The raw IP is never stored.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const ipHash = createHash("sha256").update(`${env.ipHashSalt()}:${ip}`).digest("hex");

  let pdf: Blob;
  let fileName: string;
  let source: "sample" | "upload";

  if (typeof sample === "string") {
    if (!ALLOWED_SAMPLES.has(sample)) return reply(400, "unknown_sample", "That sample doesn't exist.");
    const res = await fetch(new URL(`/samples/${sample}`, request.url));
    if (!res.ok) return reply(500, "sample_missing", "The sample file couldn't be loaded.");
    pdf = await res.blob();
    fileName = sample;
    source = "sample";
  } else if (file instanceof File) {
    if (file.size > env.maxFileMb() * 1024 * 1024) {
      return reply(413, "too_large", `Files can be up to ${env.maxFileMb()} MB.`);
    }
    const head = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    if (head !== "%PDF-") return reply(415, "not_pdf", "Only PDF files are accepted.");
    pdf = file;
    fileName = file.name || "invoice.pdf";
    source = "upload";
  } else {
    return reply(400, "no_file", "Choose a sample or a PDF to upload.");
  }

  // Demo limits: per visitor, and a daily cap on public uploads overall.
  const db = adminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: mine } = await db
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("uploader_ip_hash", ipHash)
    .gte("created_at", since);
  if ((mine ?? 0) >= env.uploadsPerIpPerDay()) {
    return reply(429, "rate_limited", `You've reached the demo limit of ${env.uploadsPerIpPerDay()} invoices a day. Try again tomorrow.`);
  }
  if (source === "upload") {
    const { count: today } = await db
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("source", "upload")
      .gte("created_at", since);
    if ((today ?? 0) >= env.dailyUploadCap()) {
      return reply(429, "daily_cap", "The demo has reached its upload limit for today. The samples still work.");
    }
  }

  const body = new FormData();
  body.append("source", source);
  body.append("ip_hash", ipHash);
  body.append("file", pdf, fileName);

  try {
    const res = await fetch(`${env.n8nBaseUrl()}/webhook/invoice-intake`, {
      method: "POST",
      headers: { "x-webhook-secret": env.n8nWebhookSecret() },
      body,
      signal: AbortSignal.timeout(58_000),
    });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch {
    return reply(504, "timeout", "This is taking longer than usual. Check the invoice list in a minute.");
  }
}
