// Sample invoices offered on the dashboard. The PDFs are copied from
// ../sample-invoices into public/samples by scripts/copy-samples.mjs.

export const FEATURED_SAMPLES = [
  { file: "01-clean-northwind.pdf", title: "Clean invoice", hint: "Should pass every check" },
  { file: "06-math-error-harbor.pdf", title: "Math error", hint: "Line items don't add up" },
  { file: "09-over-po-brightline.pdf", title: "Over budget", hint: "30% over its purchase order" },
  { file: "10-unknown-vendor.pdf", title: "Unknown vendor", hint: "Not in the vendor list" },
  { file: "11-blurry-scan-atlas.pdf", title: "Blurry scan", hint: "A photo-quality scan, no text layer" },
  { file: "13-euro-lindqvist.pdf", title: "Euro invoice", hint: "European dates and number formats" },
];

/** Every sample the server route will accept (an allowlist, so no other file can be requested). */
export const ALLOWED_SAMPLES = new Set([
  "01-clean-northwind.pdf",
  "02-clean-brightline.pdf",
  "03-clean-cedar.pdf",
  "04-clean-atlas.pdf",
  "05-duplicate-of-01.pdf",
  "06-math-error-harbor.pdf",
  "07-wrong-total-cedar.pdf",
  "08-missing-po-northwind.pdf",
  "09-over-po-brightline.pdf",
  "10-unknown-vendor.pdf",
  "11-blurry-scan-atlas.pdf",
  "12-multi-page-harbor.pdf",
  "13-euro-lindqvist.pdf",
]);
