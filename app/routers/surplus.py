"""
Surplus Router — Cross-Kitchen Surplus Intelligence Network.
Full notification & transfer system with two-sided flow.
"""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.database import get_supabase
from app.services.surplus_service import (
    detect_surplus_items,
    find_nearby_institutions,
    create_and_notify_match,
    update_match_status,
    run_surplus_matching,
)
from app.services.places_service import (
    discover_and_cache_places,
    mark_place_invited,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Surplus Intelligence"])


# ─────────────────────────────────────────────
# Request/Response Models (local to this router)
# ─────────────────────────────────────────────

class InstitutionCreate(BaseModel):
    name: str = Field(..., description="Institution name")
    type: str = Field(..., description="hostel / canteen / restaurant / ngo / foodbank")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None


class MatchResponse(BaseModel):
    status: str = Field("", description="accepted / declined")
    action: Optional[str] = Field(None, description="accepted / declined (alias for status)")


# ─────────────────────────────────────────────
# Institutions CRUD
# ─────────────────────────────────────────────

@router.post(
    "/api/institutions",
    status_code=201,
    summary="Register an institution",
    description="Register a new institution (hostel, canteen, restaurant, NGO) for surplus matching.",
)
async def create_institution(body: InstitutionCreate):
    try:
        sb = get_supabase()
        resp = sb.table("institutions").insert(body.model_dump()).execute()

        if not resp.data:
            raise HTTPException(status_code=500, detail="Failed to create institution.")

        return resp.data[0]

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create institution error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create institution: {e}")


@router.get(
    "/api/institutions",
    summary="List all institutions",
)
async def list_institutions():
    try:
        sb = get_supabase()
        resp = sb.table("institutions").select("*").order("created_at", desc=False).execute()
        return resp.data or []

    except Exception as e:
        logger.error("List institutions error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to list institutions: {e}")


# ─────────────────────────────────────────────
# Surplus Detection
# ─────────────────────────────────────────────

@router.get(
    "/api/surplus/detect",
    summary="Detect current surplus candidates",
    description=(
        "Scans inventory for surplus items: CRITICAL risk, high quantity, "
        "no recent consumption. Returns candidates with urgency levels."
    ),
)
async def detect_surplus():
    try:
        items = detect_surplus_items()
        # Enrich with frontend-compatible aliases
        for item in items:
            item["name"] = item.get("product_name", "")
            item["entry_date"] = item.get("created_at", "")
            item["fssai_license_no"] = item.get("fssai_number", "")
        # Return plain array — frontend expects InventoryItem[]
        return items
    except Exception as e:
        logger.error("Surplus detection error: %s", e)
        raise HTTPException(status_code=500, detail=f"Surplus detection failed: {e}")


# ─────────────────────────────────────────────
# Notify (full detect → match → notify flow)
# ─────────────────────────────────────────────

@router.post(
    "/api/surplus/notify/{institution_id}",
    summary="Run detect → match → notify for one institution",
    description=(
        "Detects surplus at the given institution, finds nearby matches, "
        "creates surplus_matches, and notifies both sides."
    ),
)
async def notify_surplus(institution_id: str):
    try:
        sb = get_supabase()

        # Verify institution exists
        inst_resp = sb.table("institutions").select("*").eq("id", institution_id).execute()
        if not inst_resp.data:
            raise HTTPException(status_code=404, detail="Institution not found.")

        source_inst = inst_resp.data[0]

        # Get surplus items (optionally filtered by institution_id)
        all_surplus = detect_surplus_items()

        # Filter to items belonging to this institution (or untagged)
        institution_surplus = [
            item for item in all_surplus
            if item.get("institution_id") == institution_id
            or item.get("institution_id") is None
        ]

        if not institution_surplus:
            return {
                "message": "No surplus items found for this institution.",
                "surplus_detected": 0,
                "matches_created": 0,
                "notifications_sent": 0,
            }

        total_matches = 0
        total_notifications = 0

        for item in institution_surplus:
            result = create_and_notify_match(item, source_inst)
            total_matches += result.get("matches_created", 0)
            total_notifications += result.get("notifications_sent", 0)

        return {
            "message": f"Surplus matching complete for {source_inst['name']}.",
            "surplus_detected": len(institution_surplus),
            "matches_created": total_matches,
            "notifications_sent": total_notifications,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Surplus notify error: %s", e)
        raise HTTPException(status_code=500, detail=f"Surplus notification failed: {e}")


# ─────────────────────────────────────────────
# Matches (two-sided view)
# ─────────────────────────────────────────────

@router.get(
    "/api/surplus/matches",
    summary="List surplus matches",
    description=(
        "List all proposed/active matches. Filter by institution_id to see "
        "matches where an institution is either source OR recipient."
    ),
)
async def list_matches(
    institution_id: Optional[str] = Query(None, description="Filter by institution (as source or recipient)"),
    status: Optional[str] = Query(None, description="Filter by status: proposed/notified/accepted/declined/transferred"),
):
    try:
        sb = get_supabase()

        if institution_id:
            # Two-sided: show matches where this institution is source OR matched
            source_resp = (
                sb.table("surplus_matches")
                .select("*")
                .eq("source_institution_id", institution_id)
                .order("created_at", desc=True)
                .execute()
            )
            matched_resp = (
                sb.table("surplus_matches")
                .select("*")
                .eq("matched_institution_id", institution_id)
                .order("created_at", desc=True)
                .execute()
            )

            # Merge and deduplicate
            all_matches = {m["id"]: m for m in (source_resp.data or [])}
            for m in (matched_resp.data or []):
                all_matches[m["id"]] = m

            matches = list(all_matches.values())

            # Tag each match with the institution's role
            for m in matches:
                if m["source_institution_id"] == institution_id:
                    m["your_role"] = "source"
                else:
                    m["your_role"] = "recipient"

        else:
            resp = (
                sb.table("surplus_matches")
                .select("*")
                .order("created_at", desc=True)
                .execute()
            )
            matches = resp.data or []

        # Apply status filter
        if status:
            matches = [m for m in matches if m.get("status") == status]

        # Sort by created_at descending
        matches.sort(key=lambda m: m.get("created_at", ""), reverse=True)

        return matches

    except Exception as e:
        logger.error("List matches error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to list matches: {e}")


# ─────────────────────────────────────────────
# Respond to Match (accept / decline)
# ─────────────────────────────────────────────

@router.patch(
    "/api/surplus/matches/{match_id}/respond",
    summary="Accept or decline a surplus match",
    description=(
        "Matched institution accepts or declines. "
        "Triggers notification back to source institution. "
        "On CRITICAL decline, auto-tries the next nearest institution."
    ),
)
async def respond_to_match(
    match_id: str,
    body: MatchResponse = None,
    status: Optional[str] = Query(None, description="accepted / declined"),
):
    # Frontend sends {status} in body, or ?status= as query param
    action = None
    if body and body.action:
        action = body.action
    elif body and body.status:
        action = body.status
    elif status:
        action = status

    if action not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="Status/action must be 'accepted' or 'declined'.")

    try:
        result = update_match_status(match_id, action)
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Match respond error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to respond to match: {e}")


# ─────────────────────────────────────────────
# Complete Transfer
# ─────────────────────────────────────────────

@router.patch(
    "/api/surplus/matches/{match_id}/complete",
    summary="Mark transfer as complete",
    description=(
        "Source confirms pickup happened. Updates inventory (reduces quantity), "
        "logs as 'transferred' (waste prevented, not wasted), and notifies both sides."
    ),
)
async def complete_transfer(match_id: str):
    try:
        result = update_match_status(match_id, "transferred")
        return result

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error("Transfer complete error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to complete transfer: {e}")


# ─────────────────────────────────────────────
# Notifications Feed
# ─────────────────────────────────────────────

@router.get(
    "/api/notifications",
    summary="Notification feed for an institution",
    description="Returns all notifications for a given institution, newest first.",
)
async def get_notifications(
    institution_id: str = Query(..., description="Institution ID to fetch notifications for"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
):
    try:
        sb = get_supabase()
        query = (
            sb.table("notifications")
            .select("*")
            .eq("institution_id", institution_id)
        )

        if unread_only:
            query = query.is_("read_at", "null")

        resp = query.order("sent_at", desc=True).execute()
        return resp.data or []

    except Exception as e:
        logger.error("Get notifications error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get notifications: {e}")


@router.patch(
    "/api/notifications/{notification_id}/read",
    summary="Mark a notification as read",
)
async def mark_notification_read(notification_id: str):
    try:
        sb = get_supabase()
        from datetime import datetime, timezone
        resp = (
            sb.table("notifications")
            .update({"read_at": datetime.now(timezone.utc).isoformat()})
            .eq("id", notification_id)
            .execute()
        )
        if not resp.data:
            raise HTTPException(status_code=404, detail="Notification not found.")

        return {"message": "Notification marked as read."}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Mark notification read error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to mark notification read: {e}")


# ─────────────────────────────────────────────
# Manual Demo Trigger
# ─────────────────────────────────────────────

@router.post(
    "/api/surplus/run",
    summary="Manual surplus matching trigger (for demos)",
    description=(
        "Runs detect → match → notify for ALL institutions. "
        "Same as what the daily scheduler does, but on-demand."
    ),
)
async def trigger_surplus_run():
    try:
        result = run_surplus_matching()
        return {"message": "Surplus matching triggered successfully.", **result}
    except Exception as e:
        logger.error("Manual surplus trigger failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Surplus matching failed: {e}")


# ─────────────────────────────────────────────
# Frontend compatibility alias
# ─────────────────────────────────────────────

@router.post(
    "/api/surplus/match/{institution_id}",
    summary="Trigger matching for an institution (frontend alias)",
    description="Alias for /api/surplus/notify/{institution_id} — used by the frontend.",
)
async def trigger_matching_alias(institution_id: str):
    """Frontend calls /api/surplus/match/{id} — route to notify handler."""
    return await notify_surplus(institution_id)


# ─────────────────────────────────────────────
# Nearby Places Discovery (Google Places API)
# ─────────────────────────────────────────────

@router.get(
    "/api/surplus/nearby-places",
    summary="Discover nearby institutions via Google Places",
    description=(
        "Calls Google Places API to find colleges, hostels, hotels near "
        "a registered institution. Caches results for 7 days."
    ),
)
async def get_nearby_places(
    institution_id: str = Query(..., description="Source institution to search around"),
    radius_km: int = Query(10, ge=1, le=50, description="Search radius in km"),
    refresh: bool = Query(False, description="Force refresh from Google Places API"),
    lat: Optional[float] = Query(None, description="Latitude (skip DB lookup if provided)"),
    lng: Optional[float] = Query(None, description="Longitude (skip DB lookup if provided)"),
    name: Optional[str] = Query(None, description="Institution name (used with lat/lng)"),
):
    try:
        inst_name = name or "Unknown"

        # If lat/lng provided directly (e.g. demo mode), skip DB lookup
        if lat is not None and lng is not None:
            logger.info("Using provided lat/lng for nearby search (demo mode).")
        else:
            # Look up the institution's lat/lng from DB
            sb = get_supabase()
            inst_resp = sb.table("institutions").select("*").eq("id", institution_id).execute()
            if not inst_resp.data:
                raise HTTPException(status_code=404, detail="Institution not found.")
            inst = inst_resp.data[0]
            lat = inst["latitude"]
            lng = inst["longitude"]
            inst_name = inst["name"]

        # Call Google Places API (uses cache keyed by institution_id)
        result = discover_and_cache_places(
            institution_id=institution_id,
            lat=lat,
            lng=lng,
            radius_meters=radius_km * 1000,
            force_refresh=refresh,
        )

        return {
            "institution": inst_name,
            "radius_km": radius_km,
            "count": len(result["places"]),
            "from_cache": result["from_cache"],
            "error": result["error"],
            "places": result["places"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Nearby places error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to discover nearby places: {e}")


@router.post(
    "/api/surplus/nearby-places/{place_id}/invite",
    summary="Mark intent to invite a discovered place",
    description=(
        "Flags a discovered place as 'invited' — indicating intent to "
        "onboard them to the surplus network. No real invite is sent."
    ),
)
async def invite_place(place_id: str):
    try:
        result = mark_place_invited(place_id)
        if not result:
            raise HTTPException(status_code=404, detail="Place not found.")

        return {
            "message": f"Marked '{result.get('name', place_id)}' as invited.",
            "place": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Invite place error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to mark place as invited: {e}")

