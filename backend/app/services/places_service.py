"""
Google Places API Service.
Discovers nearby colleges, hostels, and hotels around a given location.
Uses the Places API (New) — Nearby Search endpoint.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

from app.config import settings
from app.database import get_supabase

logger = logging.getLogger(__name__)

# Google Places API (New) endpoint
PLACES_NEARBY_URL = "https://places.googleapis.com/v1/places:searchNearby"

# Place types relevant to food surplus redistribution
# NOTE: Only types supported by Google Places API (New) are listed.
# "food_bank" is NOT a valid Google Places type and causes a 400 error.
INCLUDED_TYPES = [
    "university",
    "school",
    "lodging",          # hotels, hostels
    "restaurant",
    "meal_delivery",
    "meal_takeaway",
]

# Cache TTL — re-fetch if older than 7 days
CACHE_TTL_DAYS = 7


def _is_cache_fresh(institution_id: str) -> bool:
    """Check if we have cached places for this institution within the TTL."""
    try:
        sb = get_supabase()
        cutoff = (datetime.now(timezone.utc) - timedelta(days=CACHE_TTL_DAYS)).isoformat()

        resp = (
            sb.table("discovered_places")
            .select("id")
            .eq("source_institution_id", institution_id)
            .gte("discovered_at", cutoff)
            .limit(1)
            .execute()
        )

        return bool(resp.data)
    except Exception as e:
        logger.warning("Cache check failed: %s", e)
        return False


def _get_cached_places(institution_id: str) -> list[dict]:
    """Return cached discovered places for an institution."""
    try:
        sb = get_supabase()
        resp = (
            sb.table("discovered_places")
            .select("*")
            .eq("source_institution_id", institution_id)
            .order("discovered_at", desc=True)
            .execute()
        )
        return resp.data or []
    except Exception as e:
        logger.error("Cache read failed: %s", e)
        return []


def search_nearby_institutions(
    lat: float,
    lng: float,
    radius_meters: int = 10000,
) -> list[dict]:
    """
    Call Google Places API (New) to find nearby colleges, hostels, hotels.

    Returns a clean list of:
      - name, address, place_id, latitude, longitude, place_type, types

    Handles API errors gracefully — returns empty list with logged error.
    """
    api_key = settings.google_maps_api_key

    if not api_key:
        logger.warning("GOOGLE_MAPS_API_KEY not configured — returning demo data.")
        return _get_demo_places(lat, lng)

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": (
            "places.id,places.displayName,places.formattedAddress,"
            "places.location,places.types,places.primaryType"
        ),
    }

    body = {
        "includedTypes": INCLUDED_TYPES,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": radius_meters,
            }
        },
        "maxResultCount": 20,
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(PLACES_NEARBY_URL, headers=headers, json=body)

        if response.status_code != 200:
            logger.error(
                "Places API error %d: %s",
                response.status_code,
                response.text[:300],
            )
            return []

        data = response.json()
        raw_places = data.get("places", [])

        # Clean and normalise
        results = []
        for place in raw_places:
            loc = place.get("location", {})
            display_name = place.get("displayName", {})
            primary_type = place.get("primaryType", "")
            types = place.get("types", [])

            # Map primary type to a simpler category
            place_type = _classify_type(primary_type, types)

            results.append({
                "place_id": place.get("id", ""),
                "name": display_name.get("text", "Unknown"),
                "address": place.get("formattedAddress", ""),
                "latitude": loc.get("latitude", 0),
                "longitude": loc.get("longitude", 0),
                "place_type": place_type,
                "types": types,
            })

        logger.info("Places API returned %d nearby places.", len(results))
        return results

    except httpx.TimeoutException:
        logger.error("Places API timed out.")
        return []
    except Exception as e:
        logger.error("Places API error: %s", e)
        return []


def _get_demo_places(lat: float, lng: float) -> list[dict]:
    """Return demo/mock nearby places when no Google API key is configured."""
    return [
        {
            "place_id": "demo_college_1",
            "name": "SRM University",
            "address": "Kattankulathur, Chennai, Tamil Nadu",
            "latitude": lat + 0.015,
            "longitude": lng + 0.010,
            "place_type": "college",
            "types": ["university"],
        },
        {
            "place_id": "demo_hostel_1",
            "name": "Taj Coromandel Hotel",
            "address": "Nungambakkam, Chennai, Tamil Nadu",
            "latitude": lat - 0.008,
            "longitude": lng + 0.020,
            "place_type": "hostel",
            "types": ["lodging"],
        },
        {
            "place_id": "demo_restaurant_1",
            "name": "Adyar Ananda Bhavan",
            "address": "Adyar, Chennai, Tamil Nadu",
            "latitude": lat + 0.005,
            "longitude": lng - 0.012,
            "place_type": "restaurant",
            "types": ["restaurant"],
        },
    ]


def _classify_type(primary_type: str, types: list[str]) -> str:
    """Map Google Places types to our simpler categories."""
    type_str = primary_type.lower()
    all_types = " ".join(t.lower() for t in types)

    if "university" in type_str or "university" in all_types or "school" in all_types:
        return "college"
    elif "lodging" in type_str or "lodging" in all_types:
        return "hostel"
    elif "restaurant" in type_str or "meal" in all_types or "food" in all_types:
        return "restaurant"
    else:
        return "other"


def discover_and_cache_places(
    institution_id: str,
    lat: float,
    lng: float,
    radius_meters: int = 10000,
    force_refresh: bool = False,
) -> dict:
    """
    Discover nearby places, upsert into discovered_places, return the list.

    Uses cache: if data < 7 days old and not force_refresh, returns cached data.
    Returns: { "places": [...], "from_cache": bool, "error": Optional[str] }
    """
    # Check cache first
    if not force_refresh and _is_cache_fresh(institution_id):
        cached = _get_cached_places(institution_id)
        return {"places": cached, "from_cache": True, "error": None}

    # Fetch from Google Places API
    places = search_nearby_institutions(lat, lng, radius_meters)

    if not places:
        # If API failed but we have stale cache, return that
        stale_cache = _get_cached_places(institution_id)
        if stale_cache:
            return {
                "places": stale_cache,
                "from_cache": True,
                "error": "API unavailable — showing cached results.",
            }
        return {
            "places": [],
            "from_cache": False,
            "error": "No nearby places found or API unavailable.",
        }

    # Upsert into discovered_places
    sb = get_supabase()
    upserted = []

    for place in places:
        row = {
            "place_id": place["place_id"],
            "name": place["name"],
            "address": place["address"],
            "latitude": place["latitude"],
            "longitude": place["longitude"],
            "place_type": place["place_type"],
            "source_institution_id": institution_id,
            "is_registered": False,
            "discovered_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            # Upsert: insert or update on conflict (place_id + source)
            resp = (
                sb.table("discovered_places")
                .upsert(row, on_conflict="place_id,source_institution_id")
                .execute()
            )
            if resp.data:
                upserted.append(resp.data[0])
        except Exception as e:
            logger.warning("Failed to upsert place %s: %s", place["place_id"], e)
            # Still include it in the response even if upsert fails
            upserted.append(row)

    logger.info(
        "Discovered %d places near institution %s, upserted %d.",
        len(places), institution_id, len(upserted),
    )

    return {"places": upserted, "from_cache": False, "error": None}


def mark_place_invited(place_id: str) -> Optional[dict]:
    """Mark a discovered place as 'invited' (intent to reach out)."""
    try:
        sb = get_supabase()
        resp = (
            sb.table("discovered_places")
            .update({
                "invited": True,
                "invited_at": datetime.now(timezone.utc).isoformat(),
            })
            .eq("place_id", place_id)
            .execute()
        )

        if not resp.data:
            return None

        return resp.data[0]

    except Exception as e:
        logger.error("Failed to mark place invited: %s", e)
        return None
