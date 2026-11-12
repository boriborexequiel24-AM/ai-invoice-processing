"""Generate the fake sample invoices used to test and demo the system.

Creates one PDF per test case in sample-invoices/ plus expected.json, which
lists the values printed on each invoice and the status and flags the
system should give it.

All companies, people and numbers are made up.

Usage (from the project root):
    .venv/Scripts/python.exe scripts/generate_sample_invoices.py
"""

from __future__ import annotations

import io
import json
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

import fitz  # PyMuPDF, used to turn a PDF into a "scanned" image
from PIL import Image, ImageFilter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, LETTER
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "sample-invoices"

BILL_TO = [
    "Real Work Systems Demo Co.",
    "Attn: Accounts Payable",
    "200 Market Street, Suite 410",
    "Austin, TX 78701",
    "ap@realworkdemo.example",
]

# Must match supabase/seed.sql.
PO_AMOUNTS = {
    "PO-1001": Decimal("1240.50"),
    "PO-1002": Decimal("3875.00"),
    "PO-1003": Decimal("950.00"),
    "PO-1004": Decimal("612.80"),
    "PO-1005": Decimal("2210.00"),
    "PO-1006": Decimal("480.00"),
    "PO-1007": Decimal("1200.00"),
    "PO-1008": Decimal("1089.00"),
    "PO-1009": Decimal("11378.88"),
    "PO-1010": Decimal("2904.00"),
}


@dataclass
class Vendor:
    name: str
    address: list[str]
    email: str
    phone: str
    accent: str
    tax_id: str | None = None
    tax_label: str = "Sales tax"
    european: bool = False  # A4 paper, DD.MM.YYYY dates, 1.234,56 € amounts


VENDORS = {
    "northwind": Vendor(
        "Northwind Office Supply",
        ["1450 Commerce Blvd", "Columbus, OH 43215"],
        "billing@northwind-office.example",
        "(614) 555-0142",
        "#1F4E79",
    ),
    "brightline": Vendor(
        "Brightline Logistics",
        ["88 Terminal Road", "Joliet, IL 60436"],
        "ar@brightline-logistics.example",
        "(815) 555-0177",
        "#C0392B",
    ),
    "cedar": Vendor(
        "Cedar & Pine Cleaning",
        ["312 Elm Street", "Austin, TX 78704"],
        "accounts@cedarpine.example",
        "(512) 555-0119",
        "#2E7D32",
    ),
    "atlas": Vendor(
        "Atlas Cloud Hosting",
        ["500 Data Center Way", "Ashburn, VA 20147"],
        "invoices@atlascloud.example",
        "(703) 555-0190",
        "#5B2C83",
        tax_id="EIN 84-1234567",
    ),
    "harbor": Vendor(
        "Harbor Print Co.",
        ["27 Wharf Street", "Portland, ME 04101"],
        "hello@harborprint.example",
        "(207) 555-0163",
        "#00796B",
    ),
    "quantum": Vendor(
        "Quantum Desk Rentals",
        ["9 Industrial Park Dr", "Round Rock, TX 78664"],
        "billing@quantumdesk.example",
        "(737) 555-0108",
        "#E67E22",
    ),
    "lindqvist": Vendor(
        "Lindqvist Design Studio",
        ["Kungsgatan 14", "111 43 Stockholm", "Sweden"],
        "faktura@lindqvist.example",
        "+46 8 555 012 34",
        "#263238",
        tax_id="VAT SE556677889901",
        tax_label="VAT 21%",
        european=True,
    ),
}


@dataclass
class Case:
    file: str
    description: str
    vendor_key: str
    number: str
    issued: date
    lines: list[tuple[str, Decimal, Decimal]]  # (description, quantity, unit price)
    tax: Decimal
    po: str | None
    currency: str = "USD"
    terms_days: int = 30
    printed_subtotal: Decimal | None = None  # set to print a wrong subtotal
    printed_total: Decimal | None = None  # set to print a wrong total
    note: str | None = None
    scanned: bool = False
    expected_status: str = "ready_for_approval"
    expected_flags: list[str] = field(default_factory=list)

    @property
    def vendor(self) -> Vendor:
        return VENDORS[self.vendor_key]

    @property
    def line_sum(self) -> Decimal:
        return sum((q * p for _, q, p in self.lines), Decimal("0"))

    @property
    def subtotal(self) -> Decimal:
        return self.printed_subtotal if self.printed_subtotal is not None else self.line_sum

    @property
    def total(self) -> Decimal:
        return self.printed_total if self.printed_total is not None else self.subtotal + self.tax

    @property
    def due(self) -> date:
        return self.issued + timedelta(days=self.terms_days)


def d(value: str) -> Decimal:
    return Decimal(value)


def multi_page_lines() -> list[tuple[str, Decimal, Decimal]]:
    """Print jobs for two events, long enough to run onto a second page."""
    products = [
        ("Flyer A5, 1,000 pcs", "89.00"),
        ("Poster 24x36 in", "6.50"),
        ("Roll-up banner", "145.00"),
        ("Table cover, printed", "118.00"),
        ("Lanyard with badge", "2.40"),
        ("Tote bag, 1 color", "4.15"),
        ("Brochure tri-fold, 500 pcs", "132.00"),
        ("Sticker sheet", "0.85"),
        ("Postcard 4x6, 500 pcs", "58.00"),
        ("Booklet 16 pages", "3.20"),
        ("Foam board sign", "34.00"),
        ("Event program", "1.95"),
        ("Name tent card", "0.60"),
        ("Wristband, printed", "0.45"),
        ("Menu card, laminated", "2.75"),
        ("Folder with pocket", "1.80"),
    ]
    quantities = [3, 40, 4, 2, 250, 120, 2, 400, 3, 150, 6, 300, 200, 500, 60, 150]
    lines = []
    for event in ("Spring Expo", "Partner Summit"):
        for (name, price), qty in zip(products, quantities):
            lines.append((f"{name} ({event})", Decimal(qty), Decimal(price)))
    return lines


def build_cases() -> list[Case]:
    northwind_lines = [
        ("Copy paper, letter, 10-ream case", d("20"), d("32.50")),
        ("Ink cartridge set, CMYK", d("6"), d("54.75")),
        ("Desk organizer, mesh", d("12"), d("14.00")),
    ]
    multi_lines = multi_page_lines()
    multi_sum = sum((q * p for _, q, p in multi_lines), Decimal("0"))
    multi_tax = (multi_sum * Decimal("0.08")).quantize(Decimal("0.01"))

    return [
        Case(
            "01-clean-northwind.pdf",
            "Clean invoice. Matches PO-1001 exactly.",
            "northwind", "NW-20418", date(2026, 10, 6),
            northwind_lines, d("94.00"), "PO-1001",
        ),
        Case(
            "02-clean-brightline.pdf",
            "Clean invoice, no tax (freight). Matches PO-1002.",
            "brightline", "BL-7781", date(2026, 10, 9),
            [
                ("LTL freight, Chicago IL to Dallas TX", d("1"), d("2450.00")),
                ("Liftgate service", d("1"), d("175.00")),
                ("Pallet storage (pallet-days)", d("25"), d("50.00")),
            ],
            d("0.00"), "PO-1002", terms_days=15,
        ),
        Case(
            "03-clean-cedar.pdf",
            "Clean invoice for a service. Matches PO-1003.",
            "cedar", "CP-0932", date(2026, 10, 14),
            [
                ("Office deep clean, October", d("1"), d("720.00")),
                ("Interior window cleaning", d("1"), d("160.00")),
                ("Cleaning supplies", d("1"), d("70.00")),
            ],
            d("0.00"), "PO-1003",
        ),
        Case(
            "04-clean-atlas.pdf",
            "Clean invoice with tax. Matches PO-1004.",
            "atlas", "AC-2026-1104", date(2026, 10, 1),
            [
                ("Cloud VM, 4 vCPU / 16 GB, monthly", d("2"), d("189.00")),
                ("Block storage, 500 GB", d("1"), d("85.00")),
                ("Managed backups", d("1"), d("104.40")),
            ],
            d("45.40"), "PO-1004",
        ),
        Case(
            "05-duplicate-of-01.pdf",
            "Same invoice as 01 sent again as a reminder. Different file, same vendor and invoice number.",
            "northwind", "NW-20418", date(2026, 10, 6),
            northwind_lines, d("94.00"), "PO-1001",
            note="REMINDER: This invoice is now due. Please disregard if already paid.",
            expected_status="flagged", expected_flags=["duplicate"],
        ),
        Case(
            "06-math-error-harbor.pdf",
            "Line items add up to 2,165.00 but the printed subtotal is 2,045.00.",
            "harbor", "HP-5512", date(2026, 10, 20),
            [
                ("Brochure, tri-fold, full color", d("2000"), d("0.75")),
                ("Business cards, box of 500", d("10"), d("54.50")),
                ("Design proof and setup", d("1"), d("120.00")),
            ],
            d("165.00"), "PO-1005", printed_subtotal=d("2045.00"),
            expected_status="flagged", expected_flags=["line_items_mismatch"],
        ),
        Case(
            "07-wrong-total-cedar.pdf",
            "Subtotal 450.00 plus tax 30.00 should be 480.00, but the printed total is 520.00.",
            "cedar", "CP-0957", date(2026, 10, 27),
            [
                ("Carpet cleaning, main office", d("1"), d("380.00")),
                ("Upholstery cleaning, lobby chairs", d("2"), d("35.00")),
            ],
            d("30.00"), "PO-1006", printed_total=d("520.00"),
            expected_status="flagged", expected_flags=["total_mismatch", "po_amount_exceeded"],
        ),
        Case(
            "08-missing-po-northwind.pdf",
            "Known vendor, correct math, but no PO number on the invoice.",
            "northwind", "NW-20455", date(2026, 11, 2),
            [
                ("Whiteboard markers, 4-pack", d("30"), d("2.80")),
                ("Sticky notes, 12-pack", d("40"), d("3.85")),
                ("Stapler, heavy duty", d("4"), d("14.10")),
            ],
            d("24.00"), None,
            expected_status="flagged", expected_flags=["missing_po"],
        ),
        Case(
            "09-over-po-brightline.pdf",
            "Total 1,560.00 is 30% over PO-1007 (1,200.00).",
            "brightline", "BL-7804", date(2026, 11, 3),
            [
                ("FTL freight, Joliet IL to Memphis TN", d("1"), d("1150.00")),
                ("Fuel surcharge", d("1"), d("230.00")),
                ("Driver detention (hours)", d("2"), d("90.00")),
            ],
            d("0.00"), "PO-1007", terms_days=15,
            expected_status="flagged", expected_flags=["po_amount_exceeded"],
        ),
        Case(
            "10-unknown-vendor.pdf",
            "Vendor is not in the vendor list and there is no PO.",
            "quantum", "QDR-118", date(2026, 11, 4),
            [
                ("Standing desk rental, monthly", d("6"), d("45.00")),
                ("Delivery and setup", d("1"), d("60.00")),
            ],
            d("26.40"), None,
            expected_status="flagged", expected_flags=["unknown_vendor", "missing_po"],
        ),
        Case(
            "11-blurry-scan-atlas.pdf",
            "Correct invoice, but saved as a blurry, slightly tilted scan with no text layer.",
            "atlas", "AC-2026-1172", date(2026, 11, 1),
            [
                ("Dedicated server, 32 cores, monthly", d("1"), d("899.00")),
                ("Load balancer, monthly", d("1"), d("109.00")),
            ],
            d("81.00"), "PO-1008", scanned=True,
            expected_status="ready_for_approval or needs_review",
        ),
        Case(
            "12-multi-page-harbor.pdf",
            "Correct invoice with 32 line items across two pages. Matches PO-1009.",
            "harbor", "HP-5590", date(2026, 11, 5),
            multi_lines, multi_tax, "PO-1009",
        ),
        Case(
            "13-euro-lindqvist.pdf",
            "Correct invoice in EUR with European number and date formats. Matches PO-1010.",
            "lindqvist", "LDS-2026-044", date(2026, 10, 30),
            [
                ("Brand identity package", d("1"), d("1800.00")),
                ("Logo revision rounds", d("4"), d("150.00")),
            ],
            d("504.00"), "PO-1010", currency="EUR",
        ),
    ]


# ---------- Formatting ----------

def money(amount: Decimal, case: Case) -> str:
    if case.vendor.european:
        text = f"{amount:,.2f}".replace(",", " ").replace(".", ",").replace(" ", ".")
        return f"{text} €"
    return f"${amount:,.2f}"


def fmt_date(value: date, case: Case) -> str:
    if case.vendor.european:
        return value.strftime("%d.%m.%Y")
    return value.strftime("%b %d, %Y")


def fmt_qty(qty: Decimal) -> str:
    return f"{qty:,.0f}" if qty == qty.to_integral() else f"{qty:,}"


# ---------- PDF rendering ----------

def render_pdf(case: Case) -> bytes:
    vendor = case.vendor
    accent = colors.HexColor(vendor.accent)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4 if vendor.european else LETTER,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=18 * mm,
        title=f"Invoice {case.number}", author=vendor.name,
    )
    width = doc.width

    small = ParagraphStyle("small", fontName="Helvetica", fontSize=9, leading=12)
    small_right = ParagraphStyle("small_right", parent=small, alignment=2)
    vendor_style = ParagraphStyle("vendor", fontName="Helvetica-Bold", fontSize=17, leading=21, textColor=accent)
    title_style = ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=24, leading=28, alignment=2)
    label = ParagraphStyle("label", parent=small, fontName="Helvetica-Bold", textColor=accent)
    note_style = ParagraphStyle("note", parent=small, textColor=colors.HexColor("#B71C1C"), fontName="Helvetica-Bold")

    story = []

    # Header: vendor on the left, INVOICE and details on the right
    vendor_block = [Paragraph(vendor.name, vendor_style)]
    contact = vendor.address + [vendor.email, vendor.phone] + ([vendor.tax_id] if vendor.tax_id else [])
    vendor_block += [Paragraph(line.replace("&", "&amp;"), small) for line in contact]

    meta_rows = [
        ("Invoice no.", case.number),
        ("Invoice date", fmt_date(case.issued, case)),
        ("Due date", fmt_date(case.due, case)),
        ("Terms", f"Net {case.terms_days}"),
    ]
    if case.po:
        meta_rows.append(("PO number", case.po))
    meta_rows.append(("Currency", case.currency))
    meta_table = Table(
        [[Paragraph(k, small_right), Paragraph(f"<b>{v}</b>", small_right)] for k, v in meta_rows],
        colWidths=[28 * mm, 34 * mm],
    )
    meta_table.setStyle(TableStyle([("BOTTOMPADDING", (0, 0), (-1, -1), 1), ("TOPPADDING", (0, 0), (-1, -1), 1)]))
    right_block = [Paragraph("INVOICE", title_style), Spacer(1, 3 * mm), meta_table]

    header = Table([[vendor_block, right_block]], colWidths=[width * 0.55, width * 0.45])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (1, 0), (1, 0), "RIGHT")]))
    story += [header, Spacer(1, 8 * mm)]

    # Bill to
    story.append(Paragraph("BILL TO", label))
    story += [Paragraph(line, small) for line in BILL_TO]
    story.append(Spacer(1, 7 * mm))

    # Line items (header row repeats on every page)
    rows = [["Description", "Qty", "Unit price", "Amount"]]
    for desc, qty, price in case.lines:
        rows.append([Paragraph(desc.replace("&", "&amp;"), small), fmt_qty(qty), money(price, case), money(qty * price, case)])
    items = Table(rows, colWidths=[width * 0.52, width * 0.1, width * 0.18, width * 0.2], repeatRows=1)
    items.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), accent),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F6F8")]),
        ("LINEBELOW", (0, -1), (-1, -1), 0.6, colors.HexColor("#B0BEC5")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [items, Spacer(1, 5 * mm)]

    # Totals
    totals = Table(
        [
            ["Subtotal", money(case.subtotal, case)],
            [vendor.tax_label, money(case.tax, case)],
            ["Total", money(case.total, case)],
            ["Amount due", money(case.total, case)],
        ],
        colWidths=[35 * mm, 35 * mm],
        hAlign="RIGHT",
    )
    totals.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 2), (-1, 3), "Helvetica-Bold"),
        ("LINEABOVE", (0, 2), (-1, 2), 0.8, colors.black),
        ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#ECEFF1")),
    ]))
    story += [totals, Spacer(1, 8 * mm)]

    if case.note:
        story += [Paragraph(case.note, note_style), Spacer(1, 4 * mm)]

    payment = (
        "Payment by bank transfer to IBAN SE45 5000 0000 0583 9825 7466. Please quote the invoice number."
        if vendor.european
        else f"Pay by ACH or check, made payable to {vendor.name.rstrip('.')}. Please include the invoice number with your payment."
    )
    story += [Paragraph("PAYMENT", label), Paragraph(payment.replace("&", "&amp;"), small)]
    story += [Spacer(1, 3 * mm), Paragraph(f"Questions? Contact {vendor.email}", small)]

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.grey)
        canvas.drawString(document.leftMargin, 10 * mm, f"{vendor.name}  |  Invoice {case.number}")
        canvas.drawRightString(document.pagesize[0] - document.rightMargin, 10 * mm, f"Page {document.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buffer.getvalue()


def make_scanned(pdf_bytes: bytes) -> bytes:
    """Turn a clean PDF into a low-quality scan: image only, tilted, blurred, grayscale."""
    source = fitz.open(stream=pdf_bytes, filetype="pdf")
    pages = []
    for page in source:
        pix = page.get_pixmap(dpi=110)
        image = Image.frombytes("RGB", (pix.width, pix.height), pix.samples).convert("L")
        image = image.rotate(1.3, resample=Image.BICUBIC, expand=False, fillcolor=255)
        image = image.filter(ImageFilter.GaussianBlur(0.9))
        # JPEG round trip adds compression artifacts like a cheap scanner
        jpeg = io.BytesIO()
        image.save(jpeg, format="JPEG", quality=30)
        pages.append(Image.open(io.BytesIO(jpeg.getvalue())).convert("RGB"))
    out = io.BytesIO()
    pages[0].save(out, format="PDF", save_all=True, append_images=pages[1:], resolution=110)
    return out.getvalue()


# ---------- Checks and output ----------

def check_case(case: Case) -> None:
    """Make sure each invoice has exactly the problems it is meant to have."""
    flags = set(case.expected_flags)
    if "line_items_mismatch" not in flags:
        assert case.line_sum == case.subtotal, f"{case.file}: line items do not add up"
    if "total_mismatch" not in flags:
        assert case.subtotal + case.tax == case.total, f"{case.file}: total does not add up"
    if case.po and not flags & {"po_amount_exceeded"}:
        assert case.total == PO_AMOUNTS[case.po], f"{case.file}: total {case.total} != {case.po}"
    assert case.tax >= 0, f"{case.file}: negative tax"


def expected_entry(case: Case) -> dict:
    return {
        "file": case.file,
        "description": case.description,
        "expected_status": case.expected_status,
        "expected_flags": case.expected_flags,
        "printed": {
            "vendor_name": case.vendor.name,
            "invoice_number": case.number,
            "invoice_date": case.issued.isoformat(),
            "due_date": case.due.isoformat(),
            "po_number": case.po,
            "currency": case.currency,
            "subtotal": str(case.subtotal),
            "tax": str(case.tax),
            "total": str(case.total),
            "line_items": [
                {"description": desc, "quantity": str(qty), "unit_price": str(price), "amount": str(qty * price)}
                for desc, qty, price in case.lines
            ],
        },
    }


def main() -> None:
    OUTPUT_DIR.mkdir(exist_ok=True)
    cases = build_cases()
    for case in cases:
        check_case(case)
        pdf = render_pdf(case)
        if case.scanned:
            pdf = make_scanned(pdf)
        (OUTPUT_DIR / case.file).write_bytes(pdf)
        print(f"  {case.file:<32} {case.vendor.name:<26} total {case.total:>9}  {case.expected_status}")

    expected = {"generated_by": "scripts/generate_sample_invoices.py", "invoices": [expected_entry(c) for c in cases]}
    (OUTPUT_DIR / "expected.json").write_text(json.dumps(expected, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(cases)} invoices and expected.json to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
