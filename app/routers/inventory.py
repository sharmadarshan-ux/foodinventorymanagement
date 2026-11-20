"""
Inventory Router — Full CRUD + dashboard stats.
Powers the smart inventory tracking dashboard.
"""

import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.database import get_supabase
from app.models.schemas import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    DashboardStats,
    ConsumptionLogCreate,
    WasteLogCreate,
    MessageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


def _compute_risk_and_days(expiry_date_str: str) -> tuple[str, int]:
    """Compute risk level and days remaining from an expiry date string."""
    try:
        exp = date.fromisoformat(str(expiry_date_str))
    except (ValueError, TypeError):
        return "FRESH", 999

    days = (exp - date.today()).days

    if days > 30:
        return "FRESH", days
    elif days > 7:
        return "EXPIRING_SOON", days
    elif days > 0:
        return "CRITICAL", days
    else:
        return "EXPIRED", days


def _enrich_item(item: dict) -> dict:
    """Add computed fields + frontend-compatible aliases to an item dict."""
    risk, days = _compute_risk_and_days(item.get("expiry_date", ""))
    item["risk_level"] = risk
    item["days_remaining"] = days
    # Frontend-compatible aliases
    item["name"] = item.get("product_name", "")
    item["entry_date"] = item.get("created_at", "")
    item["fssai_license_no"] = item.get("fssai_number", "")
    return item


# ─────────────────────────────────────────────
# Dashboard Stats
# ─────────────────────────────────────────────

@router.get(
    "/stats",
    summary="Dashboard stat cards",
    description="Returns aggregate counts for the 4 dashboard cards.",
)
async def get_dashboard_stats():
    """
    Returns:
    - total_items: all active items
    - expiring_within_7_days: items expiring in ≤7 days
    - critical_items: items expiring in ≤3 days (risk = CRITICAL)
    - expired_this_month: items that expired in the current calendar month
    """
    try:
        sb = get_supabase()
        resp = sb.table("inventory_items").select("*").neq("status", "CONSUMED").execute()
        items = resp.data or []

        today = date.today()
        first_of_month = today.replace(day=1)

        total = len(items)
        expiring_7 = 0
        critical = 0
        expired_month = 0

        for item in items:
            _, days = _compute_risk_and_days(item.get("expiry_date", ""))

            if 0 < days <= 7:
                expiring_7 += 1
            if 0 < days <= 3:
                critical += 1
            if days <= 0:
                try:
                    exp = date.fromisoformat(str(item["expiry_date"]))
                    if exp >= first_of_month:
                        expired_month += 1
                except (ValueError, TypeError):
                    pass

        return {
            "total_items": total,
            "expiring_within_7_days": expiring_7,
            "critical_items": critical,
            "expired_this_month": expired_month,
            # Frontend-compatible aliases
            "expiring_soon": expiring_7,
            "critical": critical,
            "expired": expired_month,
        }
    except Exception as e:
        logger.error("Dashboard stats error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to compute dashboard stats: {e}")


# ─────────────────────────────────────────────
# LIST (with filters)
# ─────────────────────────────────────────────

@router.get(
    "",
    summary="List inventory items",
)
async def list_items(
    status: Optional[str] = Query(None, description="Filter by status: ACTIVE, CONSUMED, EXPIRED, DISPOSED"),
    category: Optional[str] = Query(None, description="Filter by category"),
    risk_level: Optional[str] = Query(None, description="Filter by risk level"),
    search: Optional[str] = Query(None, description="Search product name"),
    department: Optional[str] = Query(None, description="Filter by department code"),
):
    try:
        sb = get_supabase()
        query = sb.table("inventory_items").select("*")

        if status:
            query = query.eq("status", status.upper())
        if category:
            query = query.eq("category", category.lower())
        if search:
            query = query.ilike("product_name", f"%{search}%")
        if department:
            query = query.eq("department", department.upper())

        resp = query.order("expiry_date", desc=False).execute()
        items = resp.data or []

        # Enrich with computed fields and apply risk_level filter in-memory
        enriched = [_enrich_item(i) for i in items]

        if risk_level:
            enriched = [i for i in enriched if i["risk_level"] == risk_level.upper()]

        return enriched

    except Exception as e:
        logger.error("List items error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to list items: {e}")


# ─────────────────────────────────────────────
# GET single
# ─────────────────────────────────────────────

@router.get(
    "/{item_id}",
    summary="Get a single inventory item",
)
async def get_item(item_id: str):
    try:
        sb = get_supabase()
        resp = sb.table("inventory_items").select("*").eq("id", item_id).execute()

        if not resp.data:
            raise HTTPException(status_code=404, detail="Item not found.")

        return _enrich_item(resp.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Get item error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to get item: {e}")


# ─────────────────────────────────────────────
# CREATE
# ─────────────────────────────────────────────

@router.post(
    "",
    status_code=201,
    summary="Add an inventory item",
    description="Called after the user confirms scan results. Saves the item to Supabase.",
)
async def create_item(item: InventoryItemCreate):
    try:
        sb = get_supabase()

        data = item.model_dump(exclude_none=True)
        # Convert date objects to ISO strings for Supabase
        for key in ("expiry_date", "manufacturing_date"):
            if key in data and isinstance(data[key], date):
                data[key] = data[key].isoformat()

        risk, days = _compute_risk_and_days(data.get("expiry_date", ""))
        data["risk_level"] = risk

        resp = sb.table("inventory_items").insert(data).execute()

        if not resp.data:
            raise HTTPException(status_code=500, detail="Failed to create item — no data returned.")

        created = _enrich_item(resp.data[0])
        return created

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Create item error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to create item: {e}")


# ─────────────────────────────────────────────
# UPDATE
# ─────────────────────────────────────────────

@router.put(
    "/{item_id}",
    summary="Update an inventory item",
)
async def update_item(item_id: str, item: InventoryItemUpdate):
    try:
        sb = get_supabase()

        data = item.model_dump(exclude_none=True)
        if not data:
            raise HTTPException(status_code=400, detail="No fields to update.")

        for key in ("expiry_date", "manufacturing_date"):
            if key in data and isinstance(data[key], date):
                data[key] = data[key].isoformat()

        data["updated_at"] = datetime.now(timezone.utc).isoformat()

        resp = sb.table("inventory_items").update(data).eq("id", item_id).execute()

        if not resp.data:
            raise HTTPException(status_code=404, detail="Item not found.")

        return _enrich_item(resp.data[0])

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Update item error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to update item: {e}")


# ─────────────────────────────────────────────
# DELETE
# ─────────────────────────────────────────────

@router.delete(
    "/{item_id}",
    response_model=MessageResponse,
    summary="Delete an inventory item",
)
async def delete_item(item_id: str):
    try:
        sb = get_supabase()
        resp = sb.table("inventory_items").delete().eq("id", item_id).execute()

        if not resp.data:
            raise HTTPException(status_code=404, detail="Item not found.")

        return MessageResponse(message="Item deleted successfully.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Delete item error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to delete item: {e}")


# ─────────────────────────────────────────────
# CONSUME (mark as consumed + log)
# ─────────────────────────────────────────────

@router.patch(
    "/{item_id}/consume",
    response_model=MessageResponse,
    summary="Mark an item as consumed",
)
async def consume_item(
    item_id: str,
    body: ConsumptionLogCreate = None,
    quantity: Optional[int] = Query(None, description="Quantity consumed (alt to body)"),
):
    # Accept frontend's {quantity} or backend's {quantity_consumed}
    if body is None or (body.quantity_consumed == 1 and quantity is not None):
        from app.models.schemas import ConsumptionLogCreate as CLC
        body = CLC(item_id=item_id, quantity_consumed=quantity or 1)
    try:
        sb = get_supabase()

        # Fetch current item
        item_resp = sb.table("inventory_items").select("*").eq("id", item_id).execute()
        if not item_resp.data:
            raise HTTPException(status_code=404, detail="Item not found.")

        item = item_resp.data[0]
        new_qty = max(0, item.get("quantity", 1) - body.quantity_consumed)

        # Update item
        update_data = {
            "quantity": new_qty,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if new_qty == 0:
            update_data["status"] = "CONSUMED"

        sb.table("inventory_items").update(update_data).eq("id", item_id).execute()

        # Log consumption
        sb.table("consumption_logs").insert({
            "item_id": item_id,
            "product_name": item["product_name"],
            "quantity_consumed": body.quantity_consumed,
            "consumed_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        return MessageResponse(
            message=f"Consumed {body.quantity_consumed} of {item['product_name']}.",
            detail=f"Remaining quantity: {new_qty}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Consume item error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to consume item: {e}")


# ─────────────────────────────────────────────
# WASTE (mark as wasted + log)
# ─────────────────────────────────────────────

@router.patch(
    "/{item_id}/waste",
    response_model=MessageResponse,
    summary="Log waste for an item",
)
async def waste_item(
    item_id: str,
    body: WasteLogCreate = None,
    quantity: Optional[int] = Query(None, description="Quantity wasted (alt to body)"),
):
    # Accept frontend's {quantity} or backend's {quantity_wasted}
    if body is None or (body.quantity_wasted == 1 and quantity is not None):
        from app.models.schemas import WasteLogCreate as WLC
        body = WLC(item_id=item_id, quantity_wasted=quantity or 1)
    try:
        sb = get_supabase()

        item_resp = sb.table("inventory_items").select("*").eq("id", item_id).execute()
        if not item_resp.data:
            raise HTTPException(status_code=404, detail="Item not found.")

        item = item_resp.data[0]
        new_qty = max(0, item.get("quantity", 1) - body.quantity_wasted)

        update_data = {
            "quantity": new_qty,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if new_qty == 0:
            update_data["status"] = "DISPOSED"

        sb.table("inventory_items").update(update_data).eq("id", item_id).execute()

        # Log waste
        sb.table("waste_logs").insert({
            "item_id": item_id,
            "product_name": item["product_name"],
            "quantity_wasted": body.quantity_wasted,
            "reason": body.reason,
            "wasted_at": datetime.now(timezone.utc).isoformat(),
        }).execute()

        return MessageResponse(
            message=f"Logged {body.quantity_wasted} wasted for {item['product_name']}.",
            detail=f"Reason: {body.reason}. Remaining quantity: {new_qty}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Waste item error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to log waste: {e}")
