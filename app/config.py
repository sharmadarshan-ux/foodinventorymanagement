"""
GEN-016 Application Settings.
Loads configuration from .env via pydantic-settings.
"""

from pydantic_settings import BaseSettings
from typing import List, Optional


class Settings(BaseSettings):
    # ── Supabase ──
    supabase_url: str
    supabase_key: str

    # ── Google Gemini ──
    gemini_api_key: str

    # ── Resend (email) ──
    resend_api_key: str = ""
    alert_email_from: str = "alerts@yourdomain.com"
    alert_email_to: str = "owner@example.com"

    # ── SMTP Gmail Config ──
    smtp_email: str = ""
    smtp_password: str = ""
    frontend_url: str = "http://localhost:3000"

    # ── Twilio (optional SMS) ──
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None
    twilio_from_number: Optional[str] = None
    twilio_to_number: Optional[str] = None

    # ── Telegram Bot ──
    telegram_bot_token: str = ""

    # ── Google Maps / Places API ──
    google_maps_api_key: Optional[str] = None

    # ── CORS ──
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # ── Scheduler ──
    scheduler_timezone: str = "Asia/Kolkata"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()
