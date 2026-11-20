"""
Gemini Vision Service.
- scan_product_label(): sends product photo → extracts structured label data
- generate_recipes(): meal-plan suggestions from expiring items
- generate_waste_recommendations(): waste-reduction advice from analytics data
"""

import json
import re
import logging
from datetime import date

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

# ── Configure Gemini once at module load ──
genai.configure(api_key=settings.gemini_api_key)

MODEL = "gemini-flash-lite-latest"

_vision_model = genai.GenerativeModel(
    MODEL,
    generation_config=genai.GenerationConfig(
        response_mime_type="application/json",
    ),
)
_text_model = genai.GenerativeModel(MODEL)


def _safe_parse_json(raw: str) -> dict:
    """Parse JSON from Gemini, handling common quirks like trailing commas,
    single quotes, unquoted keys, and control characters."""
    # First attempt: direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Clean up common issues
    cleaned = raw
    # Remove trailing commas before } or ]
    cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)
    # Replace single quotes with double quotes (but not within strings)
    cleaned = re.sub(r"(?<![\\])\'", '"', cleaned)
    # Remove control characters except newlines/tabs
    cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', cleaned)
    # Fix unquoted keys:  { key: "value" } → { "key": "value" }
    cleaned = re.sub(r'(?<={|,)\s*(\w+)\s*:', r' "\1":', cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # Last resort: extract the first JSON object from the text
    match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', cleaned, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            pass

    # Give up — raise with original error
    raise json.JSONDecodeError("Could not parse Gemini response as JSON", raw, 0)


# ─────────────────────────────────────────────
# Label Scanning
# ─────────────────────────────────────────────

SCAN_PROMPT = """You are an expert food-label reader. Analyse this product image and extract:

1. **product_name** — full product name
2. **expiry_date** — in YYYY-MM-DD format.
   • If the label says "Best Before X months from manufacture" or "Use within X months of Mfg",
     find the manufacturing date on the label and add X months to compute the expiry date.
   • If the label shows DD/MM/YYYY or MM/YYYY, convert to YYYY-MM-DD.
   • If no expiry information exists, set to null.
3. **manufacturing_date** — in YYYY-MM-DD if visible, else null
4. **fssai_number** — the FSSAI licence number (usually 14 digits), else null
5. **storage_instructions** — any storage/handling text, else null
6. **category** — classify into one of: dairy, grain, spice, snack, beverage, meat, seafood, fruit, vegetable, frozen, canned, condiment, bakery, other
7. **raw_text** — all text visible on the label
8. **confidence** — your confidence in the extraction (0.0 to 1.0)

The label may be in English, Hindi, Tamil, Telugu, Kannada, Malayalam, or other Indian languages.
Translate non-English text to English in your extracted fields.

Today's date is {today}.

Return ONLY a valid JSON object with these exact keys. No markdown fences, no extra text.
"""


async def scan_product_label(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """
    Send a product photo to Gemini Vision and return structured label data.
    Returns a dict matching the ScanResult schema.
    """
    try:
        prompt = SCAN_PROMPT.format(today=date.today().isoformat())

        response = _vision_model.generate_content(
            [
                prompt,
                {"mime_type": mime_type, "data": image_bytes},
            ],
            generation_config=genai.GenerationConfig(
                temperature=0.1,
                max_output_tokens=2048,
                response_mime_type="application/json",
            ),
        )

        raw = response.text.strip()

        # Strip markdown code fences if Gemini wraps the output
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

        parsed = _safe_parse_json(raw)
        logger.info("Gemini scan result: %s", parsed.get("product_name", "unknown"))
        return parsed

    except json.JSONDecodeError as e:
        logger.error("Gemini returned non-JSON: %s\nRaw output: %s", e, response.text[:500] if response else "N/A")
        raise ValueError(f"Failed to parse Gemini response as JSON: {e}")
    except Exception as e:
        logger.error("Gemini Vision API error: %s", e)
        raise RuntimeError(f"Gemini Vision API error: {e}")


# ─────────────────────────────────────────────
# Recipe Suggestions (expiring stock)
# ─────────────────────────────────────────────

RECIPE_PROMPT = """You are a creative chef and nutrition expert. Given these food items that are
expiring soon, suggest a practical meal plan to use them up before they expire.

**Expiring items:**
{items_text}

For each recipe:
- Name the dish
- List ingredients (highlight which expiring items are used)
- Give brief cooking instructions
- Mention approximate prep/cook time
- Suggest the meal (breakfast / lunch / dinner / snack)

Prioritise items expiring soonest. Return the plan as well-structured Markdown.
"""


async def generate_recipes(items: list[dict]) -> str:
    """Generate a meal plan from expiring inventory items."""
    try:
        items_text = "\n".join(
            f"- {it['product_name']} (expires {it.get('expiry_date', '?')}, "
            f"qty: {it.get('quantity', '?')} {it.get('unit', '')})"
            for it in items
        )
        prompt = RECIPE_PROMPT.format(items_text=items_text)

        response = _text_model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                max_output_tokens=4096,
            ),
        )
        return response.text

    except Exception as e:
        logger.error("Gemini recipe generation error: %s", e)
        raise RuntimeError(f"Gemini recipe generation error: {e}")


# ─────────────────────────────────────────────
# Waste-Reduction Recommendations
# ─────────────────────────────────────────────

WASTE_PROMPT = """You are a food waste reduction consultant for a household / small business in India.

**Consumption analytics data:**
{analytics_json}

Based on this data, provide:
1. **Key findings** — which products are wasted most, patterns of over-ordering
2. **Actionable recommendations** — specific, numbered steps to reduce waste
   (e.g. buy smaller packs, switch suppliers, change storage method)
3. **Estimated savings** — rough estimate of potential savings in INR per month

Be specific to the products and categories shown. Return well-structured Markdown.
"""


async def generate_waste_recommendations(analytics_data: dict) -> str:
    """Generate waste-reduction recommendations from analytics summary."""
    try:
        prompt = WASTE_PROMPT.format(analytics_json=json.dumps(analytics_data, indent=2, default=str))

        response = _text_model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.5,
                max_output_tokens=4096,
            ),
        )
        return response.text

    except Exception as e:
        logger.error("Gemini waste recommendation error: %s", e)
        raise RuntimeError(f"Gemini waste recommendation error: {e}")
