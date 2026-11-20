"""
Supabase client singleton.
Every module imports get_supabase() from here — never creates its own client.
"""

from supabase import create_client, Client
from app.config import settings

_supabase_client: Client | None = None


def get_supabase() -> Client:
    """Return the singleton Supabase client, creating it on first call."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(
            settings.supabase_url,
            settings.supabase_key,
        )
    return _supabase_client
