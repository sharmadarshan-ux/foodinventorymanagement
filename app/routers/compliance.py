"""
Compliance Router — GET /api/compliance/report
Streams an FSSAI compliance PDF report.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import io

from app.database import get_supabase
from app.services.pdf_service import generate_compliance_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/compliance", tags=["Compliance"])


@router.get(
    "/report",
    summary="Download FSSAI compliance report",
    description=(
        "Generates and streams an FSSAI compliance PDF report containing "
        "batch records, expiry logs, supplier details, and disposal evidence."
    ),
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "FSSAI compliance report PDF",
        }
    },
)
async def download_compliance_report():
    try:
        sb = get_supabase()
        resp = sb.table("inventory_items").select("*").order("expiry_date", desc=False).execute()
        items = resp.data or []

        if not items:
            raise HTTPException(status_code=404, detail="No inventory items found to generate report.")

        pdf_bytes = generate_compliance_report(items)

        filename = f"fssai_compliance_report_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"

        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Compliance report error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to generate compliance report: {e}")
