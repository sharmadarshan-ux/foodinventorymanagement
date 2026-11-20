"""
Telegram Bot Service — Gemini-powered natural language queries
over live Supabase inventory data via Telegram Bot API.

Uses long-polling (no webhook/ngrok needed).
"""

import json
import re
import logging
import asyncio
from datetime import datetime, timezone, timedelta

import httpx
import google.generativeai as genai

from app.config import settings
from app.database import get_supabase

logger = logging.getLogger(__name__)

# ── Gemini setup ──
genai.configure(api_key=settings.gemini_api_key)
_intent_model = genai.GenerativeModel("models/gemini-flash-lite-latest")

# ── Telegram API ──
TELEGRAM_API = f"https://api.telegram.org/bot{settings.telegram_bot_token}"


# ─────────────────────────────────────────────
# 1. Intent Classification via Gemini
# ─────────────────────────────────────────────

INTENT_PROMPT = """You are a food inventory assistant for an Indian institutional kitchen called GEN-016.
Classify this message into exactly one intent.

Message: "{message}"

Intent options:
- EXPIRY_CHECK: user asking about expiring or expired items (keywords: expiry, expiring, expire, expired, critical, spoil, best before, shelf life, going bad, about to expire, date)
- INVENTORY_CHECK: user asking about stock levels (keywords: inventory, stock, items, list, how much, quantity, available, what do we have, check, count)
- SURPLUS_CHECK: user asking about surplus or nearby institutions (keywords: surplus, nearby, transfer, excess, share, donate, donation, available near)
- RECOMMENDATIONS: user asking for advice or tips (keywords: recommend, tips, advice, suggest, what should, reduce waste, analytics, improve)
- RECIPES: user asking for recipe or meal ideas (keywords: recipe, cook, meal, menu, tonight, food, make, dish, prepare, lunch, dinner)
- WASTE_REPORT: user asking about waste data (keywords: waste, wasted, report, lost, thrown, disposed, garbage, spoiled)
- HELP: user asking for help or commands (keywords: help, commands, what can, how to, start, hi, hello, hey, menu, options)
- UNKNOWN: none of the above

Also extract any food item name if mentioned (e.g. paneer, rice, milk, bread).
If no specific item is mentioned, set item to null.

Return ONLY valid JSON, no explanation:
{{"intent": "EXPIRY_CHECK", "item": null}}
"""

# ── Local keyword fallback (if Gemini returns UNKNOWN) ──
_KEYWORD_MAP = {
    "EXPIRY_CHECK": {"expiry", "expiring", "expire", "expired", "critical", "spoil", "shelf", "date", "best before", "going bad"},
    "INVENTORY_CHECK": {"inventory", "stock", "items", "list", "quantity", "available", "check", "count", "how much"},
    "SURPLUS_CHECK": {"surplus", "nearby", "transfer", "excess", "share", "donate", "donation"},
    "RECOMMENDATIONS": {"recommend", "tips", "advice", "suggest", "reduce waste", "analytics", "improve"},
    "RECIPES": {"recipe", "cook", "meal", "menu", "tonight", "dish", "prepare", "lunch", "dinner"},
    "WASTE_REPORT": {"waste", "wasted", "report", "thrown", "disposed", "spoiled", "garbage"},
    "HELP": {"help", "commands", "start", "hi", "hello", "hey", "options"},
}

# ── Slash command mapping ──
_COMMAND_MAP = {
    "/expiry": "EXPIRY_CHECK",
    "/inventory": "INVENTORY_CHECK",
    "/stock": "INVENTORY_CHECK",
    "/surplus": "SURPLUS_CHECK",
    "/recipes": "RECIPES",
    "/recipe": "RECIPES",
    "/waste": "WASTE_REPORT",
    "/tips": "RECOMMENDATIONS",
    "/recommend": "RECOMMENDATIONS",
    "/help": "HELP",
    "/start": "HELP",
}


def _fallback_intent(text: str) -> str:
    """Keyword-based fallback when Gemini returns UNKNOWN."""
    lower = text.lower().strip()
    for intent, keywords in _KEYWORD_MAP.items():
        for kw in keywords:
            if kw in lower:
                return intent
    return "UNKNOWN"


async def parse_intent(message_text: str) -> dict:
    """
    Classify user message: slash commands → keyword fallback → Gemini.
    Returns {"intent": "...", "item": ... or None}
    """
    text = message_text.strip()

    # 1. Slash commands — instant, no AI needed
    cmd = text.split()[0].lower() if text.startswith("/") else None
    if cmd and cmd in _COMMAND_MAP:
        # Extract item from rest of message (e.g., "/inventory paneer")
        rest = text[len(cmd):].strip() or None
        return {"intent": _COMMAND_MAP[cmd], "item": rest}

    # 2. Try Gemini
    try:
        prompt = INTENT_PROMPT.replace("{message}", text)
        response = await asyncio.to_thread(_intent_model.generate_content, prompt)
        raw = response.text.strip()

        # Strip markdown fences
        if raw.startswith("```"):
            raw = re.sub(r"```(?:json)?\s*", "", raw)
            raw = raw.rstrip("`").strip()

        result = json.loads(raw)
        intent = result.get("intent", "UNKNOWN").upper()
        item = result.get("item", None)

        valid_intents = {
            "EXPIRY_CHECK", "INVENTORY_CHECK", "SURPLUS_CHECK",
            "RECOMMENDATIONS", "RECIPES", "WASTE_REPORT", "HELP", "UNKNOWN"
        }
        if intent not in valid_intents:
            intent = "UNKNOWN"

        # 3. Fallback if Gemini said UNKNOWN
        if intent == "UNKNOWN":
            fallback = _fallback_intent(text)
            if fallback != "UNKNOWN":
                logger.info("Gemini UNKNOWN → fallback: %s", fallback)
                intent = fallback

        return {"intent": intent, "item": item}

    except Exception as e:
        logger.error("Gemini intent parsing failed: %s", e)
        fallback = _fallback_intent(text)
        return {"intent": fallback, "item": None}


# ─────────────────────────────────────────────
# 2. Fetch Live Data from Supabase
# ─────────────────────────────────────────────

def _compute_risk(expiry_str: str) -> tuple:
    """Compute risk level and days remaining from expiry date string."""
    try:
        expiry = datetime.strptime(str(expiry_str)[:10], "%Y-%m-%d").date()
        today = datetime.now(timezone.utc).date()
        days = (expiry - today).days

        if days < 0:
            return "EXPIRED", days
        elif days <= 2:
            return "CRITICAL", days
        elif days <= 5:
            return "EXPIRING_SOON", days
        else:
            return "FRESH", days
    except Exception:
        return "UNKNOWN", 0


async def fetch_live_data(intent: str, item: str = None) -> dict:
    """Query Supabase based on intent. Returns raw data dict for formatting."""
    sb = get_supabase()

    try:
        if intent == "EXPIRY_CHECK":
            resp = await asyncio.to_thread(sb.table("inventory_items").select("*").neq("status", "CONSUMED").execute)
            items = resp.data or []

            at_risk = []
            for i in items:
                risk, days = _compute_risk(i.get("expiry_date", ""))
                if risk in ("CRITICAL", "EXPIRING_SOON", "EXPIRED"):
                    i["risk_level"] = risk
                    i["days_remaining"] = days
                    at_risk.append(i)

            priority = {"EXPIRED": 0, "CRITICAL": 1, "EXPIRING_SOON": 2}
            at_risk.sort(key=lambda x: priority.get(x["risk_level"], 3))
            return {"type": "expiry", "items": at_risk, "total": len(at_risk)}

        elif intent == "INVENTORY_CHECK":
            query = sb.table("inventory_items").select("*").neq("status", "CONSUMED")
            if item:
                query = query.ilike("product_name", f"%{item}%")
            resp = await asyncio.to_thread(query.execute)
            items = resp.data or []

            for i in items:
                risk, days = _compute_risk(i.get("expiry_date", ""))
                i["risk_level"] = risk
                i["days_remaining"] = days

            return {"type": "inventory", "items": items, "total": len(items), "search_term": item}

        elif intent == "SURPLUS_CHECK":
            resp = await asyncio.to_thread(
                sb.table("surplus_matches")
                .select("*")
                .in_("status", ["proposed", "notified"])
                .order("created_at", desc=True)
                .limit(10)
                .execute
            )
            matches = resp.data or []
            return {"type": "surplus", "matches": matches, "total": len(matches)}

        elif intent == "WASTE_REPORT":
            week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            resp = await asyncio.to_thread(
                sb.table("waste_logs")
                .select("*")
                .gte("wasted_at", week_ago)
                .order("wasted_at", desc=True)
                .execute
            )
            logs = resp.data or []
            total_wasted = sum(float(l.get("quantity_wasted", 0)) for l in logs)
            return {"type": "waste", "logs": logs, "total_items": len(logs), "total_kg": total_wasted}

        elif intent == "RECOMMENDATIONS":
            resp = await asyncio.to_thread(sb.table("inventory_items").select("*").neq("status", "CONSUMED").execute)
            items = resp.data or []
            at_risk = []
            for i in items:
                risk, days = _compute_risk(i.get("expiry_date", ""))
                if risk in ("CRITICAL", "EXPIRING_SOON"):
                    i["risk_level"] = risk
                    i["days_remaining"] = days
                    at_risk.append(i)
            return {"type": "recommendations", "at_risk_items": at_risk, "total_items": len(items)}

        elif intent == "RECIPES":
            resp = await asyncio.to_thread(sb.table("inventory_items").select("*").neq("status", "CONSUMED").execute)
            items = resp.data or []
            expiring = []
            for i in items:
                risk, days = _compute_risk(i.get("expiry_date", ""))
                if risk in ("CRITICAL", "EXPIRING_SOON"):
                    i["days_remaining"] = days
                    expiring.append(i)
            return {"type": "recipes", "expiring_items": expiring}

        else:
            return {"type": "unknown"}

    except Exception as e:
        logger.error("Supabase query failed for intent %s: %s", intent, e)
        return {"type": "error", "message": str(e)}


# ─────────────────────────────────────────────
# 3. Format Telegram-Friendly Reply (Markdown)
# ─────────────────────────────────────────────

async def format_telegram_reply(intent: str, data: dict) -> str:
    """
    Format data into Telegram Markdown.
    Uses *bold*, _italic_, and emoji.
    """
    if intent == "HELP":
        return (
            "🤖 *GEN-016 Food Assistant*\n"
            "_Powered by Gemini AI_\n\n"
            "*Commands:*\n"
            "/expiry — check expiring items\n"
            "/inventory — view all stock\n"
            "/recipes — get meal suggestions\n"
            "/surplus — view nearby surplus\n"
            "/waste — this week's waste report\n"
            "/tips — waste reduction advice\n"
            "/help — show this menu\n\n"
            "Or just type naturally:\n"
            "_\"What's expiring soon?\"_\n"
            "_\"How much rice do we have?\"_"
        )

    if data.get("type") == "error":
        return "⚠️ Sorry, I couldn't fetch that data right now. Please try again."

    if intent == "EXPIRY_CHECK":
        items = data.get("items", [])
        if not items:
            return "✅ All clear! No items expiring soon. Your inventory is in great shape."

        critical = [i for i in items if i.get("risk_level") in ("CRITICAL", "EXPIRED")]
        expiring = [i for i in items if i.get("risk_level") == "EXPIRING_SOON"]

        msg = "⚠️ *Expiry Alert*\n\n"

        if critical:
            msg += "🔴 *Critical (act today):*\n"
            for i in critical:
                name = i.get("product_name", "Unknown")
                days = i.get("days_remaining", 0)
                qty = i.get("quantity", "?")
                unit = i.get("unit", "units")
                status = "⛔ EXPIRED" if days < 0 else f"{days} day{'s' if days != 1 else ''} left"
                msg += f"• {name} — {status} ({qty}{unit})\n"
            msg += "\n"

        if expiring:
            msg += "🟠 *Expiring Soon:*\n"
            for i in expiring:
                name = i.get("product_name", "Unknown")
                days = i.get("days_remaining", 0)
                qty = i.get("quantity", "?")
                unit = i.get("unit", "units")
                msg += f"• {name} — {days} days left ({qty}{unit})\n"
            msg += "\n"

        msg += "Reply /recipes for meal suggestions."
        return msg

    elif intent == "INVENTORY_CHECK":
        items = data.get("items", [])
        search = data.get("search_term")

        if not items:
            if search:
                return f"🔍 No items found matching *{search}* in your inventory."
            return "📦 Your inventory is currently empty."

        header = f"🔍 *Inventory — '{search}'*" if search else "📦 *Current Inventory*"
        msg = f"{header}\n\n"

        # Group by risk
        fresh = [i for i in items if i.get("risk_level") == "FRESH"]
        exp_soon = [i for i in items if i.get("risk_level") == "EXPIRING_SOON"]
        crit = [i for i in items if i.get("risk_level") in ("CRITICAL", "EXPIRED")]

        if fresh:
            msg += "🟢 *Fresh (30+ days):*\n"
            for i in fresh[:8]:
                name = i.get("product_name", "Unknown")
                qty = i.get("quantity", "?")
                unit = i.get("unit", "units")
                days = i.get("days_remaining", "?")
                msg += f"• {name} — {qty}{unit} ({days} days)\n"
            msg += "\n"

        if exp_soon:
            msg += "🟠 *Expiring Soon:*\n"
            for i in exp_soon:
                name = i.get("product_name", "Unknown")
                qty = i.get("quantity", "?")
                unit = i.get("unit", "units")
                days = i.get("days_remaining", "?")
                msg += f"• {name} — {qty}{unit} ({days} days)\n"
            msg += "\n"

        if crit:
            msg += "🔴 *Critical:*\n"
            for i in crit:
                name = i.get("product_name", "Unknown")
                qty = i.get("quantity", "?")
                unit = i.get("unit", "units")
                days = i.get("days_remaining", "?")
                msg += f"• {name} — {qty}{unit} ({days} days)\n"
            msg += "\n"

        msg += f"Total: {len(items)} items"
        return msg

    elif intent == "SURPLUS_CHECK":
        matches = data.get("matches", [])
        if not matches:
            return "♻️ *Surplus Network*\n\nNo active matches right now. The network is quiet."

        msg = "♻️ *Surplus Network*\n\n"
        msg += f"🟢 Matches near you: {len(matches)}\n\n"

        for m in matches[:5]:
            qty = m.get("quantity_kg", "?")
            status = m.get("status", "?")
            urgency = m.get("urgency_level", "MEDIUM")
            emoji = {"HIGH": "🔴", "MEDIUM": "🟡", "LOW": "🟢"}.get(urgency, "⚪")
            msg += f"{emoji} {qty}kg — {status} ({urgency})\n"

        msg += "\nReply /help for all commands."
        return msg

    elif intent == "WASTE_REPORT":
        logs = data.get("logs", [])
        total_kg = data.get("total_kg", 0)

        if not logs:
            return "🎉 Great news! No food waste recorded this week."

        msg = "📊 *Waste Report — Last 7 Days*\n\n"

        for l in logs[:10]:
            name = l.get("product_name", "Unknown")
            qty = l.get("quantity_wasted", 0)
            reason = l.get("reason", "expired")
            msg += f"• {name} — {qty}kg wasted ({reason})\n"

        msg += f"\nTotal waste: *{total_kg:.1f}kg*\n"
        co2 = total_kg * 2.5
        msg += f"🌍 CO₂ impact: ~{co2:.1f}kg\n"
        msg += "\n💡 Reply /tips for reduction advice."
        return msg

    elif intent == "RECOMMENDATIONS":
        at_risk = data.get("at_risk_items", [])
        total = data.get("total_items", 0)

        msg = "💡 *Waste Reduction Tips*\n\n"
        msg += f"📊 {total} items in inventory, {len(at_risk)} need attention.\n\n"

        if at_risk:
            msg += "*Priority items to use today:*\n"
            for i in at_risk[:5]:
                name = i.get("product_name", "Unknown")
                days = i.get("days_remaining", 0)
                msg += f"• {name} ({days}d left)\n"
            msg += "\n"

        msg += "*Tips:*\n"
        msg += "1️⃣ Use CRITICAL items in today's menu\n"
        msg += "2️⃣ Donate surplus via /surplus network\n"
        msg += "3️⃣ Plan menus around expiring stock\n"
        msg += "\nReply /recipes for specific meal ideas!"
        return msg

    elif intent == "RECIPES":
        expiring = data.get("expiring_items", [])

        if not expiring:
            return "✅ No items expiring soon! No urgent recipe suggestions needed."

        item_names = [i.get("product_name", "item") for i in expiring[:6]]
        quantities = [f"{i.get('quantity', '?')} {i.get('unit', 'units')}" for i in expiring[:6]]
        items_text = ", ".join(f"{n} ({q})" for n, q in zip(item_names, quantities))

        try:
            recipe_prompt = (
                f"You are a kitchen chef. These food items are expiring soon: {items_text}. "
                f"Suggest 3 practical Indian recipes that use these ingredients. "
                f"For each recipe give: name, which expiring items it uses, serves how many. "
                f"Keep it concise — 2-3 lines per recipe. Use plain text, no markdown."
            )
            recipe_resp = await asyncio.to_thread(_intent_model.generate_content, recipe_prompt)
            recipes_text = recipe_resp.text.strip()
        except Exception as e:
            logger.error("Gemini recipe generation failed: %s", e)
            recipes_text = "Could not generate recipes right now."

        msg = "🍽️ *Tonight's Menu*\n\n"
        msg += f"_Using {len(expiring)} expiring items:_\n\n"
        msg += recipes_text
        msg += f"\n\nReply /surplus to share excess."
        return msg

    # Fallback
    return (
        "🤖 I didn't understand that.\n"
        "Type /help to see all commands."
    )


# ─────────────────────────────────────────────
# 4. Send Reply via Telegram Bot API
# ─────────────────────────────────────────────

async def send_telegram_reply(chat_id: int, message: str) -> bool:
    """Send a text message via Telegram Bot API."""
    if not settings.telegram_bot_token:
        logger.warning("Telegram bot token not configured — reply skipped.")
        return False

    url = f"{TELEGRAM_API}/sendMessage"

    # Telegram has 4096 char limit — split if needed
    chunks = _split_message(message, 4000)

    success = True
    async with httpx.AsyncClient() as client:
        for chunk in chunks:
            payload = {
                "chat_id": chat_id,
                "text": chunk,
                "parse_mode": "Markdown",
            }
            try:
                resp = await client.post(url, json=payload, timeout=30)
                if resp.status_code == 200:
                    logger.info("✅ Telegram reply sent to chat %s", chat_id)
                else:
                    logger.error("❌ Telegram API error %s: %s", resp.status_code, resp.text)
                    success = False
            except Exception as e:
                logger.error("❌ Failed to send Telegram reply: %s", e)
                success = False

    return success


def _split_message(text: str, max_len: int = 4000) -> list:
    """Split a long message into chunks at line boundaries."""
    if len(text) <= max_len:
        return [text]

    chunks = []
    current = ""
    for line in text.split("\n"):
        if len(current) + len(line) + 1 > max_len:
            chunks.append(current)
            current = line
        else:
            current = current + "\n" + line if current else line
    if current:
        chunks.append(current)
    return chunks
