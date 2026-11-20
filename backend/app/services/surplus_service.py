"""
Surplus Intelligence Service — Full notification & transfer system.

Core flow:
1. detect_surplus_items()  — find CRITICAL items with urgency levels
2. find_nearby_institutions() — Haversine distance search
3. create_and_notify_match() — create match, notify both sides, log notifications
4. update_match_status() — accept/decline/transfer with cascading notifications
"""

import logging
import math
from datetime import date, datetime, timezone, timedelta

from app.database import get_supabase

logger = logging.getLogger(__name__)

# Configurable surplus detection threshold
SURPLUS_QUANTITY_THRESHOLD = 2  # items with quantity >= this are surplus candidates


# ─────────────────────────────────────────────
# Haversine
# ─────────────────────────────────────────────

def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points on Earth (km)."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─────────────────────────────────────────────
# Urgency Calculation
# ─────────────────────────────────────────────

def _compute_urgency(expiry_date_str: str) -> tuple[str, int]:
    """
    Compute urgency level and hours remaining.
    CRITICAL: <24hrs, URGENT: <48hrs, MEDIUM: <7 days, LOW: >7 days
    """
    try:
        exp = date.fromisoformat(str(expiry_date_str))
        days = (exp - date.today()).days
        hours = days * 24

        if hours <= 0:
            return "CRITICAL", 0
        elif hours <= 24:
            return "CRITICAL", hours
        elif hours <= 48:
            return "URGENT", hours
        elif days <= 7:
            return "MEDIUM", hours
        else:
            return "LOW", hours
    except (ValueError, TypeError):
        return "MEDIUM", 0


# ─────────────────────────────────────────────
# 1. Detect Surplus Items
# ─────────────────────────────────────────────

def detect_surplus_items() -> list[dict]:
    """
    Find surplus candidates:
    - risk_level in (CRITICAL, EXPIRED) — 0-7 days to expiry
    - quantity >= SURPLUS_QUANTITY_THRESHOLD
    - status is ACTIVE
    - no consumption logged in the last 24 hours

    Enriches each item with urgency_level and hours_remaining.
    """
    sb = get_supabase()

    try:
        # Get CRITICAL and near-EXPIRED active items above threshold
        critical_resp = (
            sb.table("inventory_items")
            .select("*")
            .eq("risk_level", "CRITICAL")
            .eq("status", "ACTIVE")
            .gte("quantity", SURPLUS_QUANTITY_THRESHOLD)
            .execute()
        )
        # Also check EXPIRING_SOON items (7-30 days) for MEDIUM urgency
        expiring_resp = (
            sb.table("inventory_items")
            .select("*")
            .eq("risk_level", "EXPIRING_SOON")
            .eq("status", "ACTIVE")
            .gte("quantity", SURPLUS_QUANTITY_THRESHOLD)
            .execute()
        )

        candidates = (critical_resp.data or []) + (expiring_resp.data or [])
        if not candidates:
            return []

        # Filter out items consumed in last 24 hours
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        consumption_resp = (
            sb.table("consumption_logs")
            .select("item_id")
            .gte("consumed_at", cutoff)
            .execute()
        )
        recently_consumed_ids = {
            log["item_id"] for log in (consumption_resp.data or [])
        }

        surplus = []
        for item in candidates:
            if item["id"] in recently_consumed_ids:
                continue

            urgency, hours = _compute_urgency(item.get("expiry_date", ""))
            item["urgency_level"] = urgency
            item["hours_remaining"] = hours
            surplus.append(item)

        # Sort by urgency: CRITICAL first
        urgency_order = {"CRITICAL": 0, "URGENT": 1, "MEDIUM": 2, "LOW": 3}
        surplus.sort(key=lambda x: urgency_order.get(x.get("urgency_level", "LOW"), 3))

        logger.info("Detected %d surplus candidates from %d items", len(surplus), len(candidates))
        return surplus

    except Exception as e:
        logger.error("Surplus detection error: %s", e)
        raise RuntimeError(f"Failed to detect surplus items: {e}")


# ─────────────────────────────────────────────
# 2. Find Nearby Institutions
# ─────────────────────────────────────────────

def find_nearby_institutions(source_institution_id: str, radius_km: float = 10.0) -> list[dict]:
    """
    Find institutions within radius_km of source, sorted nearest first.
    Pure Haversine math — no external API.
    """
    sb = get_supabase()

    try:
        source_resp = (
            sb.table("institutions")
            .select("*")
            .eq("id", source_institution_id)
            .execute()
        )
        if not source_resp.data:
            raise ValueError(f"Institution {source_institution_id} not found")

        source = source_resp.data[0]
        src_lat, src_lon = source["latitude"], source["longitude"]

        all_resp = (
            sb.table("institutions")
            .select("*")
            .neq("id", source_institution_id)
            .execute()
        )

        nearby = []
        for inst in (all_resp.data or []):
            dist = _haversine_km(src_lat, src_lon, inst["latitude"], inst["longitude"])
            if dist <= radius_km:
                inst["distance_km"] = round(dist, 2)
                nearby.append(inst)

        nearby.sort(key=lambda x: x["distance_km"])
        logger.info("Found %d institutions within %.1f km of %s", len(nearby), radius_km, source["name"])
        return nearby

    except Exception as e:
        logger.error("Find nearby institutions error: %s", e)
        raise RuntimeError(f"Failed to find nearby institutions: {e}")


# ─────────────────────────────────────────────
# 3. Message Templates
# ─────────────────────────────────────────────

def _urgency_emoji(level: str) -> str:
    return {"CRITICAL": "🔴", "URGENT": "🟠", "MEDIUM": "🟡", "LOW": "🟢"}.get(level, "⚪")


def generate_match_message(
    surplus_item: dict,
    source_institution: dict,
    matched_institution: dict,
) -> str:
    """Build notification message for the MATCHED (recipient) institution."""
    product = surplus_item.get("product_name", "Unknown Item")
    quantity = surplus_item.get("quantity", "?")
    unit = surplus_item.get("unit", "pcs")
    urgency = surplus_item.get("urgency_level", "MEDIUM")
    hours = surplus_item.get("hours_remaining", 0)
    emoji = _urgency_emoji(urgency)

    time_str = f"{hours} hours" if hours < 72 else f"{hours // 24} days"
    source_name = source_institution.get("name", "Unknown")
    source_phone = source_institution.get("contact_phone", "N/A")
    source_email = source_institution.get("contact_email", "N/A")
    distance = matched_institution.get("distance_km", "?")

    return (
        f"{emoji} [{urgency}] {source_name} has {quantity} {unit} {product} "
        f"expiring in {time_str}. "
        f"Distance: {distance} km. "
        f"Contact: {source_phone} / {source_email}. "
        f"Reply to arrange pickup."
    )


def _generate_source_confirmation(
    surplus_item: dict,
    source_institution: dict,
    notify_count: int,
) -> str:
    """Confirmation message for the SOURCE institution."""
    product = surplus_item.get("product_name", "Unknown")
    quantity = surplus_item.get("quantity", "?")
    unit = surplus_item.get("unit", "pcs")
    return (
        f"✅ Surplus alert sent to {notify_count} nearby institution(s) "
        f"for your {quantity} {unit} {product}. "
        f"You'll be notified when someone accepts."
    )


def _generate_acceptance_message(
    surplus_item: dict,
    source_institution: dict,
    matched_institution: dict,
) -> str:
    """Notify source that someone accepted their surplus."""
    product = surplus_item.get("product_name", "Unknown")
    matched_name = matched_institution.get("name", "Unknown")
    matched_phone = matched_institution.get("contact_phone", "N/A")
    matched_email = matched_institution.get("contact_email", "N/A")
    return (
        f"🎉 {matched_name} accepted your {product} transfer! "
        f"Contact them to arrange pickup: {matched_phone} / {matched_email}"
    )


def _generate_transfer_complete_message(
    surplus_item: dict,
    source_institution: dict,
    matched_institution: dict,
    quantity: float,
) -> str:
    """Notify both sides that transfer is confirmed."""
    product = surplus_item.get("product_name", "Unknown")
    unit = surplus_item.get("unit", "pcs")
    return (
        f"📦 Transfer complete: {quantity} {unit} {product} "
        f"from {source_institution.get('name', '?')} → {matched_institution.get('name', '?')}. "
        f"Waste prevented! 🌱"
    )


# ─────────────────────────────────────────────
# Notification Logger
# ─────────────────────────────────────────────

def _log_notification(
    institution_id: str,
    surplus_match_id: str,
    channel: str,
    content: str,
) -> None:
    """Insert a row into the notifications table."""
    sb = get_supabase()
    try:
        sb.table("notifications").insert({
            "institution_id": institution_id,
            "surplus_match_id": surplus_match_id,
            "channel": channel,
            "content": content,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
    except Exception as e:
        logger.warning("Failed to log notification: %s", e)


def _send_email_notification(to_email: str, subject: str, content: str) -> bool:
    """Send email via SMTP generic notification helper."""
    try:
        from app.services.email_service import send_generic_notification
        return send_generic_notification(to_email, subject, content)
    except Exception as e:
        logger.warning("Surplus email failed: %s", e)
        return False


def _send_sms_notification(to_phone: str, content: str, urgency: str) -> bool:
    """Send SMS via Twilio — only for CRITICAL urgency."""
    if urgency != "CRITICAL":
        return False

    from app.config import settings
    if not all([settings.twilio_account_sid, settings.twilio_auth_token,
                settings.twilio_from_number]):
        return False

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(body=content, from_=settings.twilio_from_number, to=to_phone)
        logger.info("Surplus SMS sent to %s", to_phone)
        return True
    except Exception as e:
        logger.warning("Surplus SMS failed: %s", e)
        return False


# ─────────────────────────────────────────────
# 4. Create & Notify Match
# ─────────────────────────────────────────────

def create_and_notify_match(surplus_item: dict, source_institution: dict) -> dict:
    """
    Full create → notify flow for ONE surplus item from ONE source institution.
    Returns {"matches_created": N, "notifications_sent": N}
    """
    sb = get_supabase()
    source_id = source_institution["id"]

    # Find nearby institutions
    nearby = find_nearby_institutions(source_id, radius_km=10.0)
    if not nearby:
        # Fallback: all other institutions
        all_resp = sb.table("institutions").select("*").neq("id", source_id).execute()
        nearby = all_resp.data or []
        for inst in nearby:
            inst["distance_km"] = round(_haversine_km(
                source_institution["latitude"], source_institution["longitude"],
                inst["latitude"], inst["longitude"],
            ), 2)
        nearby.sort(key=lambda x: x["distance_km"])

    if not nearby:
        return {"matches_created": 0, "notifications_sent": 0}

    urgency = surplus_item.get("urgency_level", "MEDIUM")
    matches_created = 0
    notifications_sent = 0

    for matched_inst in nearby:
        # Check for existing active match
        existing = (
            sb.table("surplus_matches")
            .select("id")
            .eq("surplus_item_id", surplus_item["id"])
            .eq("matched_institution_id", matched_inst["id"])
            .in_("status", ["proposed", "notified", "accepted"])
            .execute()
        )
        if existing.data:
            continue

        message = generate_match_message(surplus_item, source_institution, matched_inst)

        # Insert surplus_match with status=proposed
        match_resp = sb.table("surplus_matches").insert({
            "surplus_item_id": surplus_item["id"],
            "source_institution_id": source_id,
            "matched_institution_id": matched_inst["id"],
            "status": "proposed",
            "quantity_kg": surplus_item.get("quantity", 1),
            "urgency_level": urgency,
            "distance_km": matched_inst.get("distance_km", 0),
            "message": message,
        }).execute()

        if not match_resp.data:
            continue

        match_id = match_resp.data[0]["id"]

        # Update status to "notified"
        sb.table("surplus_matches").update({
            "status": "notified",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", match_id).execute()

        # ── Notify matched institution (recipient) ──
        # In-app notification
        _log_notification(matched_inst["id"], match_id, "in_app", message)
        notifications_sent += 1

        # Email to matched institution
        if matched_inst.get("contact_email"):
            from app.services.email_service import send_surplus_match_notification
            sent = send_surplus_match_notification(
                to_email=matched_inst["contact_email"],
                receiver_institution=matched_inst.get("name", "Recipient"),
                sender_institution=source_institution.get("name", "Sender"),
                sender_address=source_institution.get("address", "Address not available"),
                item_name=surplus_item.get("product_name", "Food Item"),
                quantity_kg=float(surplus_item.get("quantity", 1)),
                hours_remaining=int(surplus_item.get("hours_remaining", 24)),
                distance_km=float(matched_inst.get("distance_km", 0.0)),
                contact_phone=source_institution.get("contact_phone", ""),
                contact_email=source_institution.get("contact_email", ""),
                expiry_date=str(surplus_item.get("expiry_date", "N/A")),
                storage_instructions=surplus_item.get("storage_instructions", "No special instructions")
            )
            if sent:
                _log_notification(matched_inst["id"], match_id, "email", message)
                notifications_sent += 1

        # SMS for CRITICAL urgency
        if matched_inst.get("contact_phone") and urgency == "CRITICAL":
            if _send_sms_notification(matched_inst["contact_phone"], message, urgency):
                _log_notification(matched_inst["id"], match_id, "sms", message)
                notifications_sent += 1

        # In-app alert (reuse existing alerts table)
        sb.table("alerts").insert({
            "item_id": surplus_item["id"],
            "product_name": surplus_item["product_name"],
            "risk_level": "CRITICAL",
            "days_remaining": max(0, surplus_item.get("hours_remaining", 0) // 24),
            "message": message,
            "resolved": False,
        }).execute()

        matches_created += 1

    # ── Notify source institution (confirmation) ──
    if matches_created > 0:
        source_msg = _generate_source_confirmation(surplus_item, source_institution, matches_created)
        _log_notification(source_id, match_id, "in_app", source_msg)

        if source_institution.get("contact_email"):
            _send_email_notification(
                source_institution["contact_email"],
                f"✅ Surplus alert sent for {surplus_item.get('product_name', '?')}",
                source_msg,
            )
            _log_notification(source_id, match_id, "email", source_msg)

    return {"matches_created": matches_created, "notifications_sent": notifications_sent}


# ─────────────────────────────────────────────
# 5. Update Match Status (two-sided flow)
# ─────────────────────────────────────────────

def update_match_status(match_id: str, new_status: str, responder_institution_id: str = None) -> dict:
    """
    Handle status transitions: accepted / declined / transferred.
    Each transition notifies BOTH sides.
    """
    sb = get_supabase()

    # Fetch the match + related data
    match_resp = sb.table("surplus_matches").select("*").eq("id", match_id).execute()
    if not match_resp.data:
        raise ValueError(f"Match {match_id} not found")

    match = match_resp.data[0]
    current_status = match["status"]

    # Fetch institutions and item
    source_resp = sb.table("institutions").select("*").eq("id", match["source_institution_id"]).execute()
    matched_resp = sb.table("institutions").select("*").eq("id", match["matched_institution_id"]).execute()
    item_resp = sb.table("inventory_items").select("*").eq("id", match["surplus_item_id"]).execute()

    source_inst = source_resp.data[0] if source_resp.data else {}
    matched_inst = matched_resp.data[0] if matched_resp.data else {}
    surplus_item = item_resp.data[0] if item_resp.data else {}

    now = datetime.now(timezone.utc).isoformat()

    if new_status == "accepted":
        # Update match
        sb.table("surplus_matches").update({
            "status": "accepted",
            "updated_at": now,
        }).eq("id", match_id).execute()

        # Notify source: "{Matched institution} accepted your transfer"
        accept_msg = _generate_acceptance_message(surplus_item, source_inst, matched_inst)
        _log_notification(match["source_institution_id"], match_id, "in_app", accept_msg)

        if source_inst.get("contact_email"):
            from app.services.email_service import send_transfer_accepted_notification
            sent = send_transfer_accepted_notification(
                to_email=source_inst["contact_email"],
                source_institution=source_inst.get("name", "Donor"),
                matched_institution=matched_inst.get("name", "Recipient"),
                item_name=surplus_item.get("product_name", "Food Item"),
                quantity_kg=float(match.get("quantity_kg", 1)),
                contact_phone=matched_inst.get("contact_phone", ""),
                contact_email=matched_inst.get("contact_email", "")
            )
            if sent:
                _log_notification(match["source_institution_id"], match_id, "email", accept_msg)

        # Notify matched: confirmation
        confirm_msg = f"✅ You accepted the surplus {surplus_item.get('product_name', '?')} from {source_inst.get('name', '?')}. Please arrange pickup."
        _log_notification(match["matched_institution_id"], match_id, "in_app", confirm_msg)

        return {"status": "accepted", "message": accept_msg}

    elif new_status == "declined":
        sb.table("surplus_matches").update({
            "status": "declined",
            "updated_at": now,
        }).eq("id", match_id).execute()

        # Notify source
        decline_msg = f"❌ {matched_inst.get('name', '?')} declined the {surplus_item.get('product_name', '?')} transfer."
        _log_notification(match["source_institution_id"], match_id, "in_app", decline_msg)

        # If CRITICAL urgency, auto-try next nearest institution
        if match.get("urgency_level") == "CRITICAL":
            logger.info("CRITICAL match declined — attempting next nearest institution")
            try:
                result = create_and_notify_match(surplus_item, source_inst)
                decline_msg += f" Auto-retrying: {result.get('matches_created', 0)} new matches created."
            except Exception as e:
                logger.warning("Auto-retry failed: %s", e)

        return {"status": "declined", "message": decline_msg}

    elif new_status == "transferred":
        # Mark match as transferred
        sb.table("surplus_matches").update({
            "status": "transferred",
            "updated_at": now,
        }).eq("id", match_id).execute()

        quantity = match.get("quantity_kg", 0)

        # Update source inventory — reduce quantity
        current_qty = surplus_item.get("quantity", 0)
        new_qty = max(0, current_qty - quantity)
        update_data = {
            "quantity": new_qty,
            "updated_at": now,
        }
        if new_qty == 0:
            update_data["status"] = "CONSUMED"  # Transferred = consumed, not wasted
        sb.table("inventory_items").update(update_data).eq("id", match["surplus_item_id"]).execute()

        # Log as "transferred" in waste_logs — counts as waste PREVENTED
        sb.table("waste_logs").insert({
            "item_id": match["surplus_item_id"],
            "product_name": surplus_item.get("product_name", "Unknown"),
            "quantity_wasted": quantity,
            "reason": "transferred",  # Not expired — this is waste prevented
            "wasted_at": now,
        }).execute()

        # Notify both sides
        transfer_msg = _generate_transfer_complete_message(
            surplus_item, source_inst, matched_inst, quantity
        )
        _log_notification(match["source_institution_id"], match_id, "in_app", transfer_msg)
        _log_notification(match["matched_institution_id"], match_id, "in_app", transfer_msg)

        if source_inst.get("contact_email"):
            _send_email_notification(source_inst["contact_email"], "📦 Transfer complete!", transfer_msg)
        if matched_inst.get("contact_email"):
            _send_email_notification(matched_inst["contact_email"], "📦 Transfer received!", transfer_msg)

        # Resolve any related alerts
        sb.table("alerts").update({"resolved": True}).eq("item_id", match["surplus_item_id"]).execute()

        return {"status": "transferred", "message": transfer_msg, "waste_prevented_qty": quantity}

    else:
        raise ValueError(f"Invalid status transition: {current_status} → {new_status}")


# ─────────────────────────────────────────────
# 6. Run Full Surplus Matching (all institutions)
# ─────────────────────────────────────────────

def run_surplus_matching() -> dict:
    """
    End-to-end: detect surplus across ALL institutions → create & notify matches.
    Called by scheduler daily and by POST /api/surplus/run manually.
    """
    sb = get_supabase()

    try:
        surplus_items = detect_surplus_items()
        if not surplus_items:
            logger.info("No surplus items detected — skipping matching.")
            return {"surplus_detected": 0, "matches_created": 0, "notifications_sent": 0}

        inst_resp = sb.table("institutions").select("*").execute()
        institutions = inst_resp.data or []

        if len(institutions) < 2:
            logger.info("Need at least 2 institutions for matching. Found %d.", len(institutions))
            return {
                "surplus_detected": len(surplus_items),
                "matches_created": 0,
                "notifications_sent": 0,
                "note": "Need at least 2 registered institutions.",
            }

        total_matches = 0
        total_notifications = 0

        for item in surplus_items:
            source_id = item.get("institution_id")
            if not source_id:
                source_id = institutions[0]["id"]

            source_inst = next((i for i in institutions if i["id"] == source_id), None)
            if not source_inst:
                continue

            result = create_and_notify_match(item, source_inst)
            total_matches += result.get("matches_created", 0)
            total_notifications += result.get("notifications_sent", 0)

        summary = {
            "surplus_detected": len(surplus_items),
            "matches_created": total_matches,
            "notifications_sent": total_notifications,
        }
        logger.info("Surplus matching complete: %s", summary)
        return summary

    except Exception as e:
        logger.error("Surplus matching FAILED: %s", e, exc_info=True)
        raise RuntimeError(f"Surplus matching failed: {e}")
