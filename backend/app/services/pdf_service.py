"""
PDF Service — FSSAI Compliance Report Generator.
Uses ReportLab to produce a professional PDF with batch records,
expiry logs, supplier details, and disposal evidence.
"""

import io
import logging
from datetime import date, datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
)

logger = logging.getLogger(__name__)


def _risk_color(risk_level: str) -> colors.Color:
    return {
        "FRESH": colors.HexColor("#22c55e"),
        "EXPIRING_SOON": colors.HexColor("#f59e0b"),
        "CRITICAL": colors.HexColor("#ef4444"),
        "EXPIRED": colors.HexColor("#7f1d1d"),
    }.get(risk_level, colors.gray)


def generate_compliance_report(items: list[dict]) -> bytes:
    """
    Generate an FSSAI compliance PDF report.

    Args:
        items: list of inventory item dicts from Supabase

    Returns:
        PDF file as bytes
    """
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=22,
        spaceAfter=6,
        textColor=colors.HexColor("#1e293b"),
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=11,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=20,
    )
    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=14,
        spaceBefore=16,
        spaceAfter=8,
        textColor=colors.HexColor("#334155"),
    )

    elements = []

    # ── Header ──
    elements.append(Paragraph("FSSAI Compliance Report", title_style))
    elements.append(Paragraph(
        f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')} · "
        f"GEN-016 AI Food Inventory Management System",
        subtitle_style,
    ))

    # ── Summary Stats ──
    elements.append(Paragraph("1. Inventory Summary", section_style))

    total = len(items)
    with_fssai = sum(1 for i in items if i.get("fssai_number"))
    expired = sum(1 for i in items if i.get("risk_level") == "EXPIRED")
    critical = sum(1 for i in items if i.get("risk_level") == "CRITICAL")

    summary_data = [
        ["Metric", "Value"],
        ["Total Items Tracked", str(total)],
        ["Items with FSSAI Number", f"{with_fssai} / {total}"],
        ["Currently Expired", str(expired)],
        ["Critical (≤3 days)", str(critical)],
        ["Compliance Rate", f"{with_fssai / total * 100:.0f}%" if total else "N/A"],
    ]

    summary_table = Table(summary_data, colWidths=[200, 200])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("ALIGN", (1, 0), (1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 12))

    # ── Detailed Item Table ──
    elements.append(Paragraph("2. Product-wise Compliance Details", section_style))

    header = ["Product", "FSSAI No.", "Expiry Date", "Risk Level", "Storage", "Supplier"]
    rows = [header]

    for item in items:
        rows.append([
            item.get("product_name", "—")[:30],
            item.get("fssai_number") or "NOT FOUND",
            str(item.get("expiry_date", "—")),
            item.get("risk_level", "—"),
            (item.get("storage_instructions") or "—")[:40],
            item.get("supplier") or "—",
        ])

    col_widths = [90, 80, 70, 70, 110, 70]
    detail_table = Table(rows, colWidths=col_widths, repeatRows=1)

    # Build conditional row styles for risk-level color coding
    style_commands = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]

    # Color-code the Risk Level column per row
    for i, item in enumerate(items, start=1):
        risk = item.get("risk_level", "")
        rc = _risk_color(risk)
        style_commands.append(("TEXTCOLOR", (3, i), (3, i), rc))
        style_commands.append(("FONTNAME", (3, i), (3, i), "Helvetica-Bold"))

    detail_table.setStyle(TableStyle(style_commands))
    elements.append(detail_table)
    elements.append(Spacer(1, 12))

    # ── Expired / Disposed Items (disposal evidence) ──
    disposed = [i for i in items if i.get("risk_level") == "EXPIRED" or i.get("status") == "DISPOSED"]
    if disposed:
        elements.append(Paragraph("3. Expired / Disposed Items Log", section_style))
        elements.append(Paragraph(
            "The following items have been flagged as expired or disposed. "
            "This section serves as disposal evidence for FSSAI audit purposes.",
            styles["Normal"],
        ))
        elements.append(Spacer(1, 6))

        disp_header = ["Product", "FSSAI No.", "Expiry Date", "Status", "Batch No."]
        disp_rows = [disp_header]
        for item in disposed:
            disp_rows.append([
                item.get("product_name", "—"),
                item.get("fssai_number") or "—",
                str(item.get("expiry_date", "—")),
                item.get("status", "EXPIRED"),
                item.get("batch_number") or "—",
            ])

        disp_table = Table(disp_rows, colWidths=[120, 90, 80, 70, 80], repeatRows=1)
        disp_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7f1d1d")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(disp_table)
        elements.append(Spacer(1, 12))

    # ── Footer ──
    elements.append(Spacer(1, 20))
    elements.append(Paragraph(
        "This report is auto-generated by GEN-016 for FSSAI regulatory compliance. "
        "For discrepancies, contact the system administrator.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8, textColor=colors.gray),
    ))

    # Build PDF
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    logger.info("FSSAI compliance report generated: %d items, %d bytes", total, len(pdf_bytes))
    return pdf_bytes
