"""
Pydantic schemas for GEN-016.
All request/response models live here.
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class RiskLevel(str, Enum):
    FRESH = "FRESH"
    EXPIRING_SOON = "EXPIRING_SOON"
    CRITICAL = "CRITICAL"
    EXPIRED = "EXPIRED"


class ItemStatus(str, Enum):
    ACTIVE = "ACTIVE"
    CONSUMED = "CONSUMED"
    EXPIRED = "EXPIRED"
    DISPOSED = "DISPOSED"


# ─────────────────────────────────────────────
# Scan (Gemini Vision output)
# ─────────────────────────────────────────────

class ScanResult(BaseModel):
    """Structured data extracted from a product label by Gemini Vision."""
    product_name: str = Field(..., description="Name of the product")
    expiry_date: Optional[str] = Field(None, description="Parsed expiry date (YYYY-MM-DD)")
    manufacturing_date: Optional[str] = Field(None, description="Manufacturing date if found (YYYY-MM-DD)")
    fssai_number: Optional[str] = Field(None, description="FSSAI licence number")
    storage_instructions: Optional[str] = Field(None, description="Storage/handling instructions")
    category: Optional[str] = Field(None, description="Product category (dairy, grain, etc.)")
    raw_text: Optional[str] = Field(None, description="Raw OCR text from Gemini")
    confidence: Optional[float] = Field(None, ge=0, le=1, description="Extraction confidence 0-1")


# ─────────────────────────────────────────────
# Inventory Item
# ─────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    """Schema for adding a new inventory item (after scan confirmation)."""
    product_name: str
    expiry_date: date
    manufacturing_date: Optional[date] = None
    fssai_number: Optional[str] = None
    storage_instructions: Optional[str] = None
    category: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    unit: Optional[str] = Field(default="pcs", description="e.g. pcs, kg, L")
    supplier: Optional[str] = None
    batch_number: Optional[str] = None
    notes: Optional[str] = None
    department: Optional[str] = None


class InventoryItemUpdate(BaseModel):
    """Partial update schema — all fields optional."""
    product_name: Optional[str] = None
    expiry_date: Optional[date] = None
    manufacturing_date: Optional[date] = None
    fssai_number: Optional[str] = None
    storage_instructions: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = Field(default=None, ge=0)
    unit: Optional[str] = None
    supplier: Optional[str] = None
    batch_number: Optional[str] = None
    status: Optional[ItemStatus] = None
    notes: Optional[str] = None
    department: Optional[str] = None


class InventoryItemResponse(BaseModel):
    """Full item returned from the API."""
    id: str
    product_name: str
    expiry_date: date
    manufacturing_date: Optional[date] = None
    fssai_number: Optional[str] = None
    storage_instructions: Optional[str] = None
    category: Optional[str] = None
    quantity: int = 1
    unit: Optional[str] = "pcs"
    supplier: Optional[str] = None
    batch_number: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.FRESH
    status: ItemStatus = ItemStatus.ACTIVE
    days_remaining: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─────────────────────────────────────────────
# Dashboard Stats
# ─────────────────────────────────────────────

class DashboardStats(BaseModel):
    """Four dashboard cards data."""
    total_items: int = 0
    expiring_within_7_days: int = 0
    critical_items: int = 0
    expired_this_month: int = 0


# ─────────────────────────────────────────────
# Alerts
# ─────────────────────────────────────────────

class AlertResponse(BaseModel):
    id: str
    item_id: str
    product_name: str
    risk_level: RiskLevel
    days_remaining: int
    message: Optional[str] = None
    resolved: bool = False
    created_at: Optional[datetime] = None


# ─────────────────────────────────────────────
# Consumption & Waste Logs
# ─────────────────────────────────────────────

class ConsumptionRecord(BaseModel):
    """Logged when a user marks an item as consumed."""
    id: Optional[str] = None
    item_id: str
    product_name: str
    quantity_consumed: int = 1
    consumed_at: Optional[datetime] = None


class ConsumptionLogCreate(BaseModel):
    item_id: str
    quantity_consumed: int = Field(default=1, ge=1)


class WasteLog(BaseModel):
    """Logged when an item expires or is disposed without full consumption."""
    id: Optional[str] = None
    item_id: str
    product_name: str
    quantity_wasted: int = 1
    reason: Optional[str] = Field(None, description="expired | spoiled | damaged | other")
    wasted_at: Optional[datetime] = None


class WasteLogCreate(BaseModel):
    item_id: str
    quantity_wasted: int = Field(default=1, ge=1)
    reason: str = "expired"


# ─────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────

class ConsumptionPattern(BaseModel):
    """Insight about a product's consumption behaviour."""
    product_name: str
    category: Optional[str] = None
    times_purchased: int = 0
    times_wasted: int = 0
    waste_rate: float = Field(0.0, description="Fraction wasted (0-1)")
    avg_days_before_consumption: Optional[float] = None
    insight: Optional[str] = None


class AnalyticsSummary(BaseModel):
    total_items_tracked: int = 0
    total_consumed: int = 0
    total_wasted: int = 0
    overall_waste_rate: float = 0.0
    patterns: List[ConsumptionPattern] = []
    recommendations: Optional[str] = None


# ─────────────────────────────────────────────
# Generic
# ─────────────────────────────────────────────

class MessageResponse(BaseModel):
    """Simple message envelope."""
    message: str
    detail: Optional[str] = None
