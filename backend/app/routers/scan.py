"""
Scan Router — POST /api/scan
Upload a product photo → Gemini Vision extraction → return parsed data
for user confirmation (human-in-the-loop: does NOT auto-save).
"""

import logging

from fastapi import APIRouter, File, UploadFile, HTTPException

from app.models.schemas import ScanResult
from app.services.gemini_service import scan_product_label

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scan", tags=["Scan"])


@router.post(
    "",
    response_model=ScanResult,
    summary="Scan a product label",
    description=(
        "Upload a product photo. Gemini Vision extracts the product name, "
        "expiry date (handles 'Best Before X months' format), FSSAI number, "
        "storage instructions, and category. Returns parsed data for user "
        "confirmation — nothing is saved until the user calls the inventory "
        "create endpoint."
    ),
)
async def scan_label(file: UploadFile = File(..., description="Product label photo")):
    """
    Accepts image/jpeg, image/png, image/webp.
    Returns a ScanResult for the frontend to display and let the user confirm/edit.
    """
    # Validate file type
    allowed = ("image/jpeg", "image/png", "image/webp", "image/heic")
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{file.content_type}'. Allowed: {', '.join(allowed)}",
        )

    # Read file bytes
    try:
        image_bytes = await file.read()
    except Exception as e:
        logger.error("Failed to read uploaded file: %s", e)
        raise HTTPException(status_code=400, detail="Failed to read uploaded file.")

    if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=413, detail="File too large. Maximum 10 MB.")

    # Send to Gemini
    try:
        result = await scan_product_label(image_bytes, mime_type=file.content_type)
        return ScanResult(**result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        logger.error("Unexpected scan error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error during label scan.")
