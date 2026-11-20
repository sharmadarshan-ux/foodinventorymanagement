"""
Analytics Service.
Computes consumption patterns from inventory + waste logs and
generates waste-reduction recommendations via Gemini.
"""

import logging
from collections import defaultdict
from datetime import datetime, timezone

from app.database import get_supabase
from app.models.schemas import ConsumptionPattern, AnalyticsSummary
from app.services.gemini_service import generate_waste_recommendations

logger = logging.getLogger(__name__)


async def compute_analytics() -> AnalyticsSummary:
    """
    Aggregate consumption_logs and waste_logs against inventory_items
    to produce consumption patterns and an overall summary.
    """
    sb = get_supabase()

    try:
        # Fetch all data
        items_resp = sb.table("inventory_items").select("*").execute()
        consumption_resp = sb.table("consumption_logs").select("*").execute()
        waste_resp = sb.table("waste_logs").select("*").execute()

        items = items_resp.data or []
        consumption_logs = consumption_resp.data or []
        waste_logs = waste_resp.data or []

        # Build lookup: item_id → product info
        item_map: dict[str, dict] = {}
        for item in items:
            item_map[item["id"]] = item

        # Aggregate per product_name
        product_stats: dict[str, dict] = defaultdict(lambda: {
            "category": None,
            "times_purchased": 0,
            "times_consumed": 0,
            "times_wasted": 0,
            "total_quantity": 0,
            "total_consumed": 0,
            "total_wasted": 0,
            "days_to_consume": [],
        })

        # Count purchases (each inventory item = one purchase event)
        for item in items:
            name = item["product_name"]
            product_stats[name]["times_purchased"] += 1
            product_stats[name]["total_quantity"] += item.get("quantity", 1)
            product_stats[name]["category"] = item.get("category")

        # Consumption records
        for log in consumption_logs:
            iid = log["item_id"]
            item = item_map.get(iid, {})
            name = item.get("product_name") or log.get("product_name", "Unknown")
            product_stats[name]["times_consumed"] += 1
            product_stats[name]["total_consumed"] += log.get("quantity_consumed", 1)

            # Compute days from created_at to consumed_at
            created = item.get("created_at")
            consumed = log.get("consumed_at")
            if created and consumed:
                try:
                    c = datetime.fromisoformat(created.replace("Z", "+00:00"))
                    d = datetime.fromisoformat(consumed.replace("Z", "+00:00"))
                    product_stats[name]["days_to_consume"].append((d - c).days)
                except (ValueError, TypeError):
                    pass

        # Waste records
        for log in waste_logs:
            iid = log["item_id"]
            item = item_map.get(iid, {})
            name = item.get("product_name") or log.get("product_name", "Unknown")
            product_stats[name]["times_wasted"] += 1
            product_stats[name]["total_wasted"] += log.get("quantity_wasted", 1)

        # Build patterns
        patterns: list[ConsumptionPattern] = []
        total_consumed = 0
        total_wasted = 0

        for name, stats in product_stats.items():
            total = stats["total_consumed"] + stats["total_wasted"]
            waste_rate = stats["total_wasted"] / total if total > 0 else 0.0

            avg_days = None
            if stats["days_to_consume"]:
                avg_days = round(sum(stats["days_to_consume"]) / len(stats["days_to_consume"]), 1)

            # Generate per-product insight
            insight = None
            if waste_rate > 0.5:
                insight = f"{name} has a {waste_rate:.0%} waste rate — consider buying smaller quantities."
            elif stats["times_purchased"] >= 4 and waste_rate > 0.25:
                insight = f"{name} overordered {stats['times_purchased']} times with {waste_rate:.0%} waste."

            patterns.append(ConsumptionPattern(
                product_name=name,
                category=stats["category"],
                times_purchased=stats["times_purchased"],
                times_wasted=stats["times_wasted"],
                waste_rate=round(waste_rate, 3),
                avg_days_before_consumption=avg_days,
                insight=insight,
            ))

            total_consumed += stats["total_consumed"]
            total_wasted += stats["total_wasted"]

        # Sort by waste rate descending
        patterns.sort(key=lambda p: p.waste_rate, reverse=True)

        grand_total = total_consumed + total_wasted
        overall_waste_rate = total_wasted / grand_total if grand_total > 0 else 0.0

        return AnalyticsSummary(
            total_items_tracked=len(items),
            total_consumed=total_consumed,
            total_wasted=total_wasted,
            overall_waste_rate=round(overall_waste_rate, 3),
            patterns=patterns,
        )

    except Exception as e:
        logger.error("Analytics computation error: %s", e)
        raise RuntimeError(f"Failed to compute analytics: {e}")


def _build_fallback_recommendations(summary: AnalyticsSummary) -> str:
    """Generate basic recommendations from analytics data when Gemini is unavailable."""
    lines = ["## Waste-Reduction Recommendations\n"]
    lines.append("*Generated from your analytics data (AI service temporarily unavailable).*\n")

    data = summary.model_dump()
    patterns = data.get("patterns", [])
    total_wasted = data.get("total_wasted", 0)
    overall_rate = data.get("overall_waste_rate", 0)

    # Key findings
    lines.append("### Key Findings\n")
    lines.append(f"- **Overall waste rate:** {overall_rate:.0%}")
    lines.append(f"- **Total items wasted:** {total_wasted}")
    lines.append(f"- **Products tracked:** {data.get('total_items_tracked', 0)}\n")

    high_waste = [p for p in patterns if p.get("waste_rate", 0) > 0.25]
    if high_waste:
        lines.append("**High-waste products:**\n")
        for p in high_waste:
            rate = p.get("waste_rate", 0)
            lines.append(f"- **{p['product_name']}** ({p.get('category', 'N/A')}): "
                         f"{rate:.0%} waste rate — purchased {p.get('times_purchased', 0)} times, "
                         f"wasted {p.get('times_wasted', 0)} times")
        lines.append("")

    # Actionable recommendations
    lines.append("### Actionable Recommendations\n")
    rec_num = 1
    for p in high_waste:
        lines.append(f"{rec_num}. **{p['product_name']}** has a {p.get('waste_rate', 0):.0%} waste rate — "
                     f"consider buying smaller quantities or check storage conditions.")
        rec_num += 1

    if overall_rate > 0.3:
        lines.append(f"{rec_num}. Your overall waste rate of {overall_rate:.0%} is high — "
                     f"review purchase frequency and portion sizes across all categories.")
        rec_num += 1

    if not high_waste:
        lines.append(f"{rec_num}. Your waste rates look healthy! Continue monitoring to maintain low waste.")
        rec_num += 1

    lines.append(f"{rec_num}. Set up expiry alerts to catch items before they spoil.")

    # Estimated savings
    lines.append("\n### Estimated Savings\n")
    estimated_monthly = total_wasted * 50  # rough INR estimate per wasted unit
    if estimated_monthly > 0:
        lines.append(f"By reducing waste on flagged products, you could save approximately "
                     f"**₹{estimated_monthly:,}–₹{estimated_monthly * 2:,} per month**.")
    else:
        lines.append("Keep tracking consistently to generate savings estimates.")

    return "\n".join(lines)


async def get_waste_recommendations() -> str:
    """Compute analytics, then ask Gemini for waste-reduction advice.
    Falls back to rule-based recommendations if Gemini is unavailable."""
    summary = await compute_analytics()
    try:
        recommendations = await generate_waste_recommendations(summary.model_dump())
        return recommendations
    except Exception as e:
        logger.warning("Gemini unavailable, using fallback recommendations: %s", e)
        return _build_fallback_recommendations(summary)
