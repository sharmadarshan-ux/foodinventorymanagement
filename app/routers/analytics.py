"""
Analytics Router — consumption patterns and waste-reduction recommendations.
Core expected outcome: consumption analytics + waste reduction recommendations.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.models.schemas import AnalyticsSummary
from app.services.analytics_service import compute_analytics, get_waste_recommendations
from app.services.gemini_service import generate_recipes
from app.database import get_supabase

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get(
    "",
    summary="Consumption analytics",
    description=(
        "Returns consumption patterns: per-product waste rates, "
        "average days to consumption, and actionable insights."
    ),
)
async def get_analytics():
    """Core feature: consumption analytics dashboard data."""
    try:
        result = await compute_analytics()
        data = result.model_dump()
        # Transform patterns to frontend-compatible format
        frontend_patterns = []
        for p in data.get("patterns", []):
            frontend_patterns.append({
                **p,
                # Frontend aliases
                "total_stocked": p.get("times_purchased", 0),
                "consumed_qty": p.get("times_purchased", 0) - p.get("times_wasted", 0),
                "wasted_qty": p.get("times_wasted", 0),
                "waste_rate": round(p.get("waste_rate", 0) * 100, 1),  # 0-1 → percentage
            })
        data["patterns"] = frontend_patterns
        return data
    except Exception as e:
        logger.error("Analytics error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to compute analytics: {e}")


@router.get(
    "/recommendations",
    summary="Waste-reduction recommendations",
    description=(
        "Gemini analyses your consumption data and returns specific, "
        "actionable recommendations to reduce food waste."
    ),
)
async def get_recommendations():
    """Core feature: AI-powered waste reduction recommendations."""
    try:
        recs = await get_waste_recommendations()
        return {"recommendations": recs}
    except Exception as e:
        logger.error("Recommendations error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to generate recommendations: {e}")


@router.get(
    "/recipes",
    summary="Meal plan from expiring stock",
    description=(
        "Gemini generates a meal plan using items expiring within 7 days. "
        "Prioritises the soonest-to-expire items."
    ),
)
async def get_recipe_suggestions():
    """Bonus: AI-generated recipes to use up expiring stock."""
    try:
        sb = get_supabase()
        resp = (
            sb.table("inventory_items")
            .select("*")
            .neq("status", "CONSUMED")
            .neq("status", "DISPOSED")
            .execute()
        )
        items = resp.data or []

        # Filter to items expiring within 7 days
        from datetime import date
        expiring = []
        for item in items:
            try:
                exp = date.fromisoformat(str(item.get("expiry_date", "")))
                days = (exp - date.today()).days
                if 0 < days <= 7:
                    item["days_remaining"] = days
                    expiring.append(item)
            except (ValueError, TypeError):
                continue

        if not expiring:
            return {"recipes": "No items are expiring within the next 7 days. Your inventory looks fresh! 🌿"}

        # Sort by soonest expiry
        expiring.sort(key=lambda x: x.get("days_remaining", 999))

        try:
            recipes = await generate_recipes(expiring)
            return {"recipes": recipes}
        except Exception as gemini_err:
            logger.warning("Gemini unavailable for recipes, using fallback: %s", gemini_err)
            # Build fallback recipe suggestions from the expiring items
            lines = ["## Meal Plan for Expiring Items\n"]
            lines.append("*Generated from your inventory data (AI service temporarily unavailable).*\n")
            for item in expiring:
                name = item.get("product_name", "Unknown")
                days = item.get("days_remaining", "?")
                qty = item.get("quantity", "?")
                unit = item.get("unit", "")
                category = item.get("category", "other")
                lines.append(f"### {name}")
                lines.append(f"- **Expires in:** {days} day(s)")
                lines.append(f"- **Quantity:** {qty} {unit}")
                lines.append(f"- **Category:** {category}")
                lines.append(f"- **Suggestion:** Use {name} in your next meal — prioritise items expiring soonest.\n")
            lines.append("---\n")
            lines.append("*Tip: AI-powered detailed recipes will be available when the Gemini API quota resets.*")
            return {"recipes": "\n".join(lines)}

    except Exception as e:
        logger.error("Recipe suggestion error: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to generate recipes: {e}")
