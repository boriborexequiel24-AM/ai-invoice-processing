// Copies the sample invoice PDFs from ../sample-invoices into public/samples
// so the dashboard can serve them. Runs automatically before dev and build.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), "..", "sample-invoices");
const target = join(process.cwd(), "public", "samples");

if (!existsSync(source)) {
  console.warn(`copy-samples: ${source} not found, skipping.`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });
const pdfs = readdirSync(source).filter((name) => name.endsWith(".pdf"));
for (const name of pdfs) copyFileSync(join(source, name), join(target, name));
console.log(`copy-samples: copied ${pdfs.length} sample invoices to public/samples`);
