"""
Telegram Bot Router — long-polling loop that fetches messages
from Telegram Bot API and replies using Gemini + Supabase.

No webhook/ngrok needed — the bot polls Telegram directly.
"""

import asyncio
import logging

import httpx
from fastapi import APIRouter

from app.config import settings
from app.services.telegram_service import (
    parse_intent,
    fetch_live_data,
    format_telegram_reply,
    send_telegram_reply,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/telegram", tags=["Telegram"])

# ── Polling state ──
_offset = 0
_polling_active = False


async def poll_telegram():
    """
    Long-polling loop: fetches updates from Telegram, processes each
    message through the Gemini pipeline, and sends a reply.
    Runs as a background asyncio task — never exits unless cancelled.
    """
    global _offset, _polling_active

    if not settings.telegram_bot_token:
        logger.warning("⚠️ TELEGRAM_BOT_TOKEN not set — polling disabled")
        return

    _polling_active = True
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/getUpdates"

    logger.info("🤖 Telegram bot polling started")

    async with httpx.AsyncClient(timeout=35) as client:
        while _polling_active:
            try:
                resp = await client.get(url, params={
                    "offset": _offset,
                    "timeout": 25,  # long-poll timeout
                })

                if resp.status_code != 200:
                    logger.error("Telegram getUpdates error %s: %s", resp.status_code, resp.text)
                    await asyncio.sleep(5)
                    continue

                data = resp.json()

                if not data.get("ok"):
                    logger.error("Telegram API returned ok=false: %s", data)
                    await asyncio.sleep(5)
                    continue

                for update in data.get("result", []):
                    _offset = update["update_id"] + 1

                    message = update.get("message", {})
                    chat_id = message.get("chat", {}).get("id")
                    text = message.get("text", "").strip()
                    sender = message.get("from", {}).get("first_name", "Unknown")

                    if not chat_id or not text:
                        continue

                    logger.info("📩 Telegram from %s (chat %s): '%s'", sender, chat_id, text[:100])

                    # Process in a separate task so polling isn't blocked
                    asyncio.create_task(
                        _handle_message(chat_id, text, sender)
                    )

            except httpx.ReadTimeout:
                # Normal for long-polling — Telegram returns empty after timeout
                continue
            except Exception as e:
                logger.error("Telegram polling error: %s", e, exc_info=True)
                await asyncio.sleep(5)

    logger.info("🛑 Telegram bot polling stopped")


async def _handle_message(chat_id: int, text: str, sender: str):
    """Process a single message through the Gemini pipeline."""
    try:
        # 1. Parse intent
        intent_data = await parse_intent(text)
        intent = intent_data["intent"]
        item = intent_data.get("item")

        logger.info("🧠 Intent: %s, Item: %s (from %s)", intent, item, sender)

        # 2. Fetch live data
        if intent == "HELP":
            live_data = {}
        else:
            live_data = await fetch_live_data(intent, item)

        # 3. Format reply
        reply = await format_telegram_reply(intent, live_data)

        # 4. Send
        await send_telegram_reply(chat_id, reply)

    except Exception as e:
        logger.error("Message handling failed for chat %s: %s", chat_id, e, exc_info=True)
        try:
            await send_telegram_reply(
                chat_id,
                "⚠️ Sorry, something went wrong. Please try again or type /help."
            )
        except Exception:
            pass


# ─────────────────────────────────────────────
# Health Check Endpoint
# ─────────────────────────────────────────────

@router.get("/health")
async def telegram_health():
    """Check if Telegram bot polling is active."""
    return {
        "status": "active" if _polling_active else "inactive",
        "bot_configured": bool(settings.telegram_bot_token),
        "message": "Telegram bot polling is running" if _polling_active else "Bot not started",
    }
