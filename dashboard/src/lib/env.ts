// Server-side settings. Everything here stays on the server; nothing is sent to the browser.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}. See dashboard/.env.example.`);
  }
  return value;
}

function number(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL").replace(/\/$/, ""),
  supabaseAnonKey: () => required("SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  n8nBaseUrl: () => required("N8N_BASE_URL").replace(/\/$/, ""),
  n8nWebhookSecret: () => required("N8N_WEBHOOK_SECRET"),
  ipHashSalt: () => required("IP_HASH_SALT"),
  uploadsPerIpPerDay: () => number("DEMO_UPLOADS_PER_IP_PER_DAY", 5),
  maxFileMb: () => number("DEMO_MAX_FILE_MB", 5),
  dailyUploadCap: () => number("DEMO_DAILY_UPLOAD_CAP", 100),
};
