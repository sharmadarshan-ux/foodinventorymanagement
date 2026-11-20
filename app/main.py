"""
GEN-016 — AI-Powered Food Inventory & Expiry Management System
FastAPI application entry point.

Wires all routers, CORS, scheduler startup/shutdown, and health check.
"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.scheduler import start_scheduler, stop_scheduler, daily_expiry_check

# ── Routers ──
from app.routers import scan, inventory, alerts, analytics, compliance, surplus, auth, telegram
from app.routers.telegram import poll_telegram

# ── Logging ──
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-28s │ %(levelname)-7s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup/shutdown) ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start scheduler on startup, shut it down on shutdown."""
    logger.info("🚀 GEN-016 starting up...")
    start_scheduler()
    # Start Telegram bot polling in background
    asyncio.create_task(poll_telegram())
    yield
    logger.info("🛑 GEN-016 shutting down...")
    stop_scheduler()


# ── App ──
app = FastAPI(
    title="GEN-016 — AI Food Inventory & Expiry Management",
    description=(
        "Backend API for the AI-Powered Food Inventory and Expiry Management System. "
        "Features: smart inventory tracking, expiry prediction & alerts, "
        "consumption analytics, waste reduction recommendations, "
        "multilingual Gemini Vision label scan, FSSAI compliance reporting, "
        "and Cross-Kitchen Surplus Intelligence Network."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register Routers ──
app.include_router(scan.router)
app.include_router(inventory.router)
app.include_router(alerts.router)
app.include_router(analytics.router)
app.include_router(compliance.router)
app.include_router(surplus.router)
app.include_router(auth.router)
app.include_router(telegram.router)


# ── Health Check ──
@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "GEN-016",
        "version": "1.0.0",
        "description": "AI-Powered Food Inventory & Expiry Management System",
    }


# ── Manual Scheduler Trigger ──
@app.post("/api/scheduler/run", tags=["Scheduler"])
async def trigger_scheduler():
    """Manually trigger the daily expiry check (for testing / demos)."""
    try:
        daily_expiry_check()
        return {"message": "Daily expiry check triggered successfully."}
    except Exception as e:
        logger.error("Manual scheduler trigger failed: %s", e)
        return {"message": f"Scheduler run failed: {e}"}
