/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RiskLevel = 'FRESH' | 'EXPIRING_SOON' | 'CRITICAL' | 'EXPIRED';

export interface InventoryItem {
  id: string | number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  entry_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  risk_level: RiskLevel;
  fssai_license_no?: string;
  storage_instructions?: string;
}

export interface DashboardStats {
  total_items: number;
  expiring_soon: number;
  critical: number;
  expired: number;
}

export interface AlertItem {
  id: string | number;
  item_name: string;
  days_remaining: number;
  risk_level: RiskLevel;
  message?: string;
}

export interface AlertSummary {
  CRITICAL: number;
  EXPIRING_SOON: number;
  EXPIRED: number;
  FRESH?: number;
}

export interface AnalyticsPattern {
  id?: string | number;
  product_name: string;
  category: string;
  total_stocked: number;
  consumed_qty: number;
  wasted_qty: number;
  waste_rate: number; // e.g. 12.5 (representing 12.5%)
}

export interface GeminiRecommendation {
  id: string;
  title: string;
  advice: string;
  impact_level: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GeminiRecipe {
  id: string;
  recipe_name: string;
  ingredients_used: string[];
  estimated_time: string;
  instructions: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface ScanResult {
  product_name: string;
  expiry_date: string; // YYYY-MM-DD
  fssai_license_no?: string;
  storage_instructions?: string;
  quantity?: number;
  unit?: string;
  category?: string;
}

export interface Institution {
  id: string | number;
  name: string;
  type: 'hostel' | 'canteen' | 'restaurant' | string;
  latitude: number;
  longitude: number;
  contact_email: string;
  contact_phone: string;
  created_at?: string;
}

export interface SurplusMatch {
  id: string | number;
  surplus_item_id: string | number;
  surplus_item?: InventoryItem;
  source_institution_id: string | number;
  source_institution?: Institution;
  matched_institution_id: string | number;
  matched_institution?: Institution;
  status: 'proposed' | 'accepted' | 'declined' | 'expired';
  quantity_kg: number;
  message?: string;
  created_at?: string;
}

export interface DiscoveredPlace {
  id?: string;
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  place_type: 'college' | 'hostel' | 'restaurant' | 'other';
  is_registered: boolean;
  invited: boolean;
  invited_at?: string;
  discovered_at?: string;
}

