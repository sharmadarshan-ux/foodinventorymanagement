"""
Alerts Router — list and resolve expiry alerts.
"""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.database import get_supabase
from app.models.schemas import AlertResponse, MessageResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get(
    "",
    summary="List alerts",
    description="List all expiry alerts. Optionally filter by resolved status.",
)
async def list_alerts(
    resolved: Optional[bool] = Query(None, description="Filter: true=resolved, false=unresolved"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
):
    try:
        sb = get_supabase()
        query = sb.table("alerts").select("*")

        if resolved is not None:
            query = query.eq("resolved", resolved)
        if risk_level:
            query = query.eq("risk_level", risk_level.upper())

        resp = query.order("created_at", desc=True).execute()
        alerts = resp.data or []
        # Add frontend-compatible alias
        for a in alerts:
            a["item_name"] = a.get("product_name", "")
        return alerts

    except Exception as e:
        logger.error("List alerts error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to list alerts: {e}")


@router.get(
    "/summary",
    summary="Alert summary counts",
)
async def alert_summary():
    """Return counts of unresolved alerts by risk level."""
    try:
        sb = get_supabase()
        resp = sb.table("alerts").select("*").eq("resolved", False).execute()
        alerts = resp.data or []

        counts = {"EXPIRING_SOON": 0, "CRITICAL": 0, "EXPIRED": 0, "total": len(alerts)}
        for a in alerts:
            rl = a.get("risk_level", "")
            if rl in counts:
                counts[rl] += 1

        return counts

    except Exception as e:
        logger.error("Alert summary error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get alert summary: {e}")


@router.post(
    "/resolve/{alert_id}",
    response_model=MessageResponse,
    summary="Resolve an alert",
    description="Mark an alert as resolved (acknowledged by user).",
)
async def resolve_alert(alert_id: str):
    try:
        sb = get_supabase()
        resp = (
            sb.table("alerts")
            .update({
                "resolved": True,
                "resolved_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("id", alert_id)
            .execute()
        )

        if not resp.data:
            raise HTTPException(status_code=404, detail="Alert not found.")

        return MessageResponse(message="Alert resolved successfully.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Resolve alert error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to resolve alert: {e}")
