"""
APScheduler — Daily 7:00 AM IST job.
Computes risk levels for all active inventory items and fires alerts.
Then runs surplus detection and cross-kitchen matching.

Risk levels:
  >30 days  → FRESH
  >7 days   → EXPIRING_SOON
  >0 days   → CRITICAL
  ≤0 days   → EXPIRED

Alert triggers: email at 7, 3, 1 days remaining.
Critical SMS via Twilio at 0 days (if configured).
Surplus matching: detect surplus → find nearby institutions → notify both sides.
"""

import logging
from datetime import date, datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.database import get_supabase
from app.services.email_service import send_expiry_alert

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone=settings.scheduler_timezone)

# Days-remaining thresholds that trigger alerts
ALERT_THRESHOLDS = {7, 3, 1, 0}


def _compute_risk_level(days_remaining: int) -> str:
    if days_remaining > 30:
        return "FRESH"
    elif days_remaining > 7:
        return "EXPIRING_SOON"
    elif days_remaining > 0:
        return "CRITICAL"
    else:
        return "EXPIRED"


def _send_sms_alert(product_name: str, days_remaining: int):
    """Send a critical SMS via Twilio if configured."""
    if not all([
        settings.twilio_account_sid,
        settings.twilio_auth_token,
        settings.twilio_from_number,
        settings.twilio_to_number,
    ]):
        return

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        client.messages.create(
            body=f"🚨 CRITICAL: {product_name} has EXPIRED! Dispose or consume immediately.",
            from_=settings.twilio_from_number,
            to=settings.twilio_to_number,
        )
        logger.info("SMS alert sent for %s", product_name)
    except Exception as e:
        logger.error("Twilio SMS error: %s", e)


def daily_expiry_check():
    """
    Daily job: scan all active inventory items, update risk levels,
    create alerts, and send email digest.
    """
    logger.info("═══ Daily expiry check started at %s ═══", datetime.now())

    try:
        sb = get_supabase()

        # 1. Fetch all non-consumed items
        resp = sb.table("inventory_items").select("*").neq("status", "CONSUMED").execute()
        items = resp.data or []

        if not items:
            logger.info("No active inventory items. Skipping.")
            return

        today = date.today()
        alerts_to_send: list[dict] = []
        items_updated = 0
        alerts_created = 0

        for item in items:
            try:
                expiry = date.fromisoformat(str(item.get("expiry_date", "")))
            except (ValueError, TypeError):
                logger.warning("Item %s has invalid expiry_date, skipping.", item.get("id"))
                continue

            days_remaining = (expiry - today).days
            new_risk = _compute_risk_level(days_remaining)
            old_risk = item.get("risk_level", "FRESH")

            # 2. Update risk_level in Supabase if changed
            if new_risk != old_risk:
                sb.table("inventory_items").update({
                    "risk_level": new_risk,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("id", item["id"]).execute()
                items_updated += 1

                # Auto-mark as EXPIRED status
                if new_risk == "EXPIRED" and item.get("status") == "ACTIVE":
                    sb.table("inventory_items").update({
                        "status": "EXPIRED",
                    }).eq("id", item["id"]).execute()

            # 3. Create/update alert for ALL at-risk items (not just thresholds)
            if new_risk in ("EXPIRING_SOON", "CRITICAL", "EXPIRED"):
                alert_data = {
                    "item_id": item["id"],
                    "product_name": item["product_name"],
                    "risk_level": new_risk,
                    "days_remaining": days_remaining,
                    "message": (
                        f"{item['product_name']} expires in {days_remaining} day(s)!"
                        if days_remaining > 0
                        else f"{item['product_name']} has EXPIRED!"
                    ),
                    "resolved": False,
                }

                # Upsert: check if unresolved alert already exists for this item
                existing = (
                    sb.table("alerts")
                    .select("id")
                    .eq("item_id", item["id"])
                    .eq("resolved", False)
                    .execute()
                )

                if existing.data:
                    # Update existing alert with fresh data
                    sb.table("alerts").update({
                        "risk_level": new_risk,
                        "days_remaining": days_remaining,
                        "message": alert_data["message"],
                    }).eq("id", existing.data[0]["id"]).execute()
                else:
                    # Insert new alert
                    sb.table("alerts").insert(alert_data).execute()

                alert_data["expiry_date"] = str(expiry)
                alerts_to_send.append(alert_data)
                alerts_created += 1

                # 4. SMS for expired items (only at exact thresholds)
                if days_remaining in ALERT_THRESHOLDS and days_remaining <= 0:
                    _send_sms_alert(item["product_name"], days_remaining)

        # 5. Send email digest for all alerts
        if alerts_to_send:
            formatted_items = []
            for a in alerts_to_send:
                matching_item = next((i for i in items if i["id"] == a["item_id"]), {})
                formatted_items.append({
                    "name": a["product_name"],
                    "category": matching_item.get("category", "Uncategorized"),
                    "days_remaining": a["days_remaining"],
                    "risk_level": a["risk_level"],
                    "quantity": matching_item.get("quantity", 1)
                })
            
            to_email = settings.alert_email_to or settings.smtp_email
            if to_email:
                send_expiry_alert(
                    to_email=to_email,
                    institution_name="GEN-016 Central Kitchen",
                    items=formatted_items
                )
                logger.info("Sent expiry alerts to %s", to_email)

        logger.info(
            "═══ Daily check complete: %d items scanned, %d updated, %d alerts ═══",
            len(items), items_updated, alerts_created,
        )

        # ── Step 6: Surplus Intelligence Matching ──
        try:
            from app.services.surplus_service import run_surplus_matching
            logger.info("─── Running surplus detection & matching ───")
            surplus_result = run_surplus_matching()
            logger.info(
                "─── Surplus matching done: %d detected, %d matches, %d notifications ───",
                surplus_result.get("surplus_detected", 0),
                surplus_result.get("matches_created", 0),
                surplus_result.get("notifications_sent", 0),
            )
        except Exception as surplus_err:
            logger.error("Surplus matching step failed: %s", surplus_err)

    except Exception as e:
        logger.error("Daily expiry check FAILED: %s", e, exc_info=True)


def start_scheduler():
    """Register the daily job and start the scheduler."""
    scheduler.add_job(
        daily_expiry_check,
        trigger=CronTrigger(hour=7, minute=0, timezone=settings.scheduler_timezone),
        id="daily_expiry_check",
        name="Daily Expiry Check (7:00 AM IST)",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started — daily expiry check at 07:00 %s", settings.scheduler_timezone)


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped.")
