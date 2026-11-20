/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InventoryItem,
  DashboardStats,
  AlertItem,
  AlertSummary,
  AnalyticsPattern,
  GeminiRecommendation,
  GeminiRecipe,
  ScanResult,
  RiskLevel,
  Institution,
  SurplusMatch,
  DiscoveredPlace
} from './types';

const DEFAULT_BASE_URL = 'http://localhost:8000';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__VITE_API_BASE_URL__) {
    return (window as any).__VITE_API_BASE_URL__;
  }
  const envUrl = (import.meta as any).env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;
  }
  return DEFAULT_BASE_URL;
}

// Global state to track connection and fallback mode
let isMockModeEnabled = false;

export function setMockMode(enabled: boolean) {
  isMockModeEnabled = enabled;
  if (typeof window !== 'undefined') {
    localStorage.setItem('fims_mock_mode', enabled ? 'true' : 'false');
  }
}

export function getMockMode(): boolean {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('fims_mock_mode');
    if (saved !== null) {
      return saved === 'true';
    }
  }
  return isMockModeEnabled;
}

// Mock Data for fallback & preview
const MOCK_ITEMS: InventoryItem[] = [
  {
    id: '1',
    name: 'Fresh Amul Pasteurized Milk',
    category: 'Dairy',
    quantity: 2,
    unit: 'Liters',
    entry_date: '2026-07-07',
    expiry_date: '2026-07-10',
    risk_level: 'CRITICAL',
    fssai_license_no: '10012021000071',
    storage_instructions: 'Keep refrigerated below 4°C.'
  },
  {
    id: '2',
    name: 'Harvest Gold Whole Wheat Bread',
    category: 'Bakery',
    quantity: 1,
    unit: 'Loaf',
    entry_date: '2026-07-06',
    expiry_date: '2026-07-11',
    risk_level: 'EXPIRING_SOON',
    fssai_license_no: '10014011001852',
    storage_instructions: 'Store in a cool, dry place. Seal after opening.'
  },
  {
    id: '3',
    name: 'Organic Vine Tomatoes',
    category: 'Produce',
    quantity: 500,
    unit: 'Grams',
    entry_date: '2026-07-05',
    expiry_date: '2026-07-08',
    risk_level: 'EXPIRED',
    fssai_license_no: '22720024000318',
    storage_instructions: 'Keep in dry vegetable tray or refrigerate.'
  },
  {
    id: '4',
    name: 'Mother Dairy Paneer',
    category: 'Dairy',
    quantity: 200,
    unit: 'Grams',
    entry_date: '2026-07-08',
    expiry_date: '2026-07-15',
    risk_level: 'FRESH',
    fssai_license_no: '10012011000104',
    storage_instructions: 'Refrigerate after opening. Consume within 2 days.'
  },
  {
    id: '5',
    name: 'Fortune Soya Health Oil',
    category: 'Pantry',
    quantity: 1,
    unit: 'Liter',
    entry_date: '2026-05-01',
    expiry_date: '2026-11-01',
    risk_level: 'FRESH',
    fssai_license_no: '10013021000624',
    storage_instructions: 'Store away from direct heat and sunlight.'
  },
  {
    id: '6',
    name: 'Catch Coriander Powder',
    category: 'Spices',
    quantity: 100,
    unit: 'Grams',
    entry_date: '2026-03-15',
    expiry_date: '2026-07-12',
    risk_level: 'EXPIRING_SOON',
    fssai_license_no: '10016011003450',
    storage_instructions: 'Keep in an airtight container in a dry pantry.'
  }
];

const MOCK_ALERTS: AlertItem[] = [
  {
    id: 'a1',
    item_name: 'Fresh Amul Pasteurized Milk',
    days_remaining: 1,
    risk_level: 'CRITICAL',
    message: 'CRITICAL: Milk is expiring in less than 24 hours! Consume or freeze.'
  },
  {
    id: 'a2',
    item_name: 'Harvest Gold Whole Wheat Bread',
    days_remaining: 2,
    risk_level: 'EXPIRING_SOON',
    message: 'WARNING: Whole wheat bread expires in 2 days.'
  },
  {
    id: 'a3',
    item_name: 'Organic Vine Tomatoes',
    days_remaining: -1,
    risk_level: 'EXPIRED',
    message: 'ALERT: Organic Vine Tomatoes have expired on 2026-07-08!'
  }
];

const MOCK_ANALYTICS: AnalyticsPattern[] = [
  { id: 1, product_name: 'Amul Milk', category: 'Dairy', total_stocked: 40, consumed_qty: 32, wasted_qty: 8, waste_rate: 20.0 },
  { id: 2, product_name: 'Whole Wheat Bread', category: 'Bakery', total_stocked: 15, consumed_qty: 14, wasted_qty: 1, waste_rate: 6.6 },
  { id: 3, product_name: 'Vine Tomatoes', category: 'Produce', total_stocked: 12, consumed_qty: 8, wasted_qty: 4, waste_rate: 33.3 },
  { id: 4, product_name: 'Mother Dairy Paneer', category: 'Dairy', total_stocked: 10, consumed_qty: 10, wasted_qty: 0, waste_rate: 0.0 },
  { id: 5, product_name: 'Coriander Powder', category: 'Spices', total_stocked: 5, consumed_qty: 4.8, wasted_qty: 0.2, waste_rate: 4.0 }
];

const MOCK_RECOMMENDATIONS: GeminiRecommendation[] = [
  {
    id: 'rec1',
    title: 'Optimize Dairy Procurement',
    advice: 'Your milk waste rate is 20%. Consider switching to 500ml packs instead of 1L packs, or schedule milk purchases every 2 days rather than bulk weekly buying.',
    impact_level: 'HIGH'
  },
  {
    id: 'rec2',
    title: 'Dynamic Tomato Preservation',
    advice: 'Tomatoes exhibit a high 33.3% waste rate due to humidity. Store them in a paper bag in the vegetable crisper or stew and freeze excess tomatoes before they turn soft.',
    impact_level: 'HIGH'
  },
  {
    id: 'rec3',
    title: 'Bread Storage Adjustment',
    advice: 'Bread is expiring soon. Freeze half the loaf on the day of purchase if consumption is slow; sliced bread thaws perfectly in a toaster within 2 minutes.',
    impact_level: 'MEDIUM'
  }
];

const MOCK_RECIPES: GeminiRecipe[] = [
  {
    id: 'rcp1',
    recipe_name: 'Easy Paneer Tomato Curry',
    ingredients_used: ['Organic Vine Tomatoes', 'Mother Dairy Paneer', 'Catch Coriander Powder'],
    estimated_time: '20 mins',
    instructions: [
      'Puree the soft vine tomatoes in a blender.',
      'Heat oil in a pan, add spices and the coriander powder, followed by the tomato puree.',
      'Simmer for 10 minutes until oil separates.',
      'Add paneer cubes and let them simmer for 3-5 minutes on low heat.',
      'Garnish with fresh herbs and serve hot with bread.'
    ],
    difficulty: 'EASY'
  },
  {
    id: 'rcp2',
    recipe_name: 'Classic French Toast',
    ingredients_used: ['Amul Pasteurized Milk', 'Whole Wheat Bread'],
    estimated_time: '12 mins',
    instructions: [
      'In a shallow bowl, whisk milk with a pinch of cinnamon or sugar (optional).',
      'Dip bread slices in the milk mixture until lightly soaked on both sides.',
      'Grease a hot skillet with a dab of butter.',
      'Cook bread on both sides until golden brown and crispy.',
      'Serve warm with a drizzle of honey or fresh fruit.'
    ],
    difficulty: 'EASY'
  }
];

const MOCK_INSTITUTIONS: Institution[] = [
  {
    id: 'inst1',
    name: 'Campus Hostel Block A',
    type: 'hostel',
    latitude: 12.8715,
    longitude: 80.2201,
    contact_email: 'blocka@campus.edu.in',
    contact_phone: '+91 94440 12345'
  },
  {
    id: 'inst2',
    name: 'AM Jain College Canteen',
    type: 'canteen',
    latitude: 12.9815,
    longitude: 80.1985,
    contact_email: 'canteen@amjain.edu.in',
    contact_phone: '+91 98401 54321'
  },
  {
    id: 'inst3',
    name: 'IIT Madras Hostel Nilgiri',
    type: 'hostel',
    latitude: 12.9915,
    longitude: 80.2301,
    contact_email: 'nilgiri@iitm.ac.in',
    contact_phone: '+91 91234 56789'
  }
];

const MOCK_SURPLUS_MATCHES: SurplusMatch[] = [
  {
    id: 'match1',
    surplus_item_id: '1',
    surplus_item: {
      id: '1',
      name: 'Fresh Amul Pasteurized Milk',
      category: 'Dairy',
      quantity: 15,
      unit: 'Liters',
      entry_date: '2026-07-07',
      expiry_date: '2026-07-10',
      risk_level: 'CRITICAL',
      fssai_license_no: '10012021000071',
      storage_instructions: 'Keep refrigerated below 4°C.'
    },
    source_institution_id: 'inst1',
    source_institution: {
      id: 'inst1',
      name: 'Campus Hostel Block A',
      type: 'hostel',
      latitude: 12.8715,
      longitude: 80.2201,
      contact_email: 'blocka@campus.edu.in',
      contact_phone: '+91 94440 12345'
    },
    matched_institution_id: 'inst2',
    matched_institution: {
      id: 'inst2',
      name: 'AM Jain College Canteen',
      type: 'canteen',
      latitude: 12.9815,
      longitude: 80.1985,
      contact_email: 'canteen@amjain.edu.in',
      contact_phone: '+91 98401 54321'
    },
    status: 'proposed',
    quantity_kg: 15,
    message: 'Campus Hostel Block A has 15 Liters pasteurized milk expiring in 24 hours → AM Jain College Canteen — Transfer suggested',
    created_at: '2026-07-09T03:00:00Z'
  }
];

// Helper to make an API call or fall back
async function safeFetch<T>(
  endpoint: string,
  options?: RequestInit,
  mockFallback?: T | (() => T)
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  if (getMockMode()) {
    console.warn(`[API Mock] Bypassing ${endpoint} request, mock mode is ON.`);
    if (mockFallback !== undefined) {
      return typeof mockFallback === 'function' ? (mockFallback as any)() : mockFallback;
    }
    throw new Error('API Mock fallback is undefined for ' + endpoint);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json() as T;
  } catch (error) {
    console.error(`[API Error] Failed to fetch ${url}:`, error);
    
    // If we're not in mock mode but the server is offline/failed,
    // let's try to gracefully fall back if mock data is available, 
    // and print an alert in the console.
    if (mockFallback !== undefined) {
      console.warn(`[API Fallback] Falling back to mock data for ${endpoint}`);
      return typeof mockFallback === 'function' ? (mockFallback as any)() : mockFallback;
    }
    throw error;
  }
}

// ── Markdown → Structured Data Parsers ──

/**
 * Parse Gemini markdown recommendations into GeminiRecommendation[].
 * Splits on markdown headings (### or **bold**) and numbered items.
 */
function parseRecommendationsMarkdown(md: string): GeminiRecommendation[] {
  const recs: GeminiRecommendation[] = [];

  // Split by numbered items (e.g. "1. **Title** — advice") or headings
  const sections = md.split(/\n(?=\d+\.\s|\#{2,3}\s)/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Try to extract "N. **Title** — advice" or "N. Title: advice"
    const numberedMatch = trimmed.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[-—:]\s*([\s\S]*)/);
    // Try heading: "### Title\nadvice"
    const headingMatch = trimmed.match(/^#{2,3}\s+(.+)\n([\s\S]*)/);

    let title = '';
    let advice = '';

    if (numberedMatch) {
      title = numberedMatch[1].replace(/\*\*/g, '').trim();
      advice = numberedMatch[2].replace(/\*\*/g, '').trim();
    } else if (headingMatch) {
      title = headingMatch[1].replace(/\*\*/g, '').trim();
      advice = headingMatch[2].replace(/\*\*/g, '').trim();
    } else {
      // Fallback: use first line as title, rest as advice
      const lines = trimmed.split('\n');
      title = lines[0].replace(/^[\d.#*\s-]+/, '').trim();
      advice = lines.slice(1).join(' ').trim();
    }

    if (!title && !advice) continue;

    // Infer impact level from keywords
    let impact_level: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
    const lc = (title + ' ' + advice).toLowerCase();
    if (lc.includes('high') || lc.includes('critical') || lc.includes('100%') || lc.includes('significant')) {
      impact_level = 'HIGH';
    } else if (lc.includes('low') || lc.includes('healthy') || lc.includes('good')) {
      impact_level = 'LOW';
    }

    recs.push({
      id: `rec_${recs.length + 1}`,
      title: title || 'Recommendation',
      advice: advice || title,
      impact_level,
    });
  }

  // If parsing yielded nothing, return the whole markdown as a single card
  if (recs.length === 0) {
    recs.push({
      id: 'rec_1',
      title: 'AI Waste-Reduction Analysis',
      advice: md.replace(/[#*]/g, '').trim(),
      impact_level: 'HIGH',
    });
  }

  return recs;
}

/**
 * Parse Gemini markdown recipes into GeminiRecipe[].
 * Handles various markdown formats from Gemini output.
 */
function parseRecipesMarkdown(md: string): GeminiRecipe[] {
  const recipes: GeminiRecipe[] = [];

  // Split on major headings (## or ###) that likely indicate recipe names
  const recipeSections = md.split(/\n(?=#{2,3}\s)/).filter(s => s.trim());

  for (const section of recipeSections) {
    const lines = section.trim().split('\n');
    if (lines.length === 0) continue;

    // Extract recipe name from heading
    const nameMatch = lines[0].match(/^#{2,3}\s+(.+)/);
    const recipeName = nameMatch
      ? nameMatch[1].replace(/\*\*/g, '').trim()
      : lines[0].replace(/^[\d.#*\s-]+/, '').trim();

    // Skip non-recipe headings (meta sections)
    const lcName = recipeName.toLowerCase();
    if (lcName.includes('meal plan') || lcName.includes('key finding') ||
        lcName.includes('recommendation') || lcName.includes('saving') ||
        lcName.includes('tip:') || lcName.includes('generated from')) continue;

    const ingredients: string[] = [];
    const instructions: string[] = [];
    let estimatedTime = '15-20 mins';
    let difficulty: 'EASY' | 'MEDIUM' | 'HARD' = 'EASY';
    let inIngredients = false;
    let inInstructions = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const ll = line.toLowerCase();

      // Detect section headers
      if (ll.includes('ingredient')) { inIngredients = true; inInstructions = false; continue; }
      if (ll.includes('instruction') || ll.includes('step') || ll.includes('method') || ll.includes('direction')) {
        inInstructions = true; inIngredients = false; continue;
      }
      if (ll.includes('time') && (ll.includes('prep') || ll.includes('cook') || ll.includes('total') || ll.includes('estimated'))) {
        const timeMatch = line.match(/(\d+[\s-]*(?:to|-)?\s*\d*\s*min(?:ute)?s?)/i);
        if (timeMatch) estimatedTime = timeMatch[1];
        continue;
      }
      if (ll.includes('difficulty')) {
        if (ll.includes('hard')) difficulty = 'HARD';
        else if (ll.includes('medium')) difficulty = 'MEDIUM';
        continue;
      }
      if (ll.includes('suggestion') || ll.includes('expires in') || ll.includes('category')) {
        // Skip inventory metadata lines from fallback recipes
        continue;
      }

      // Collect list items
      const bulletMatch = line.match(/^[-*•]\s+(.+)/);
      const numberedItemMatch = line.match(/^\d+\.\s+(.+)/);

      if (inIngredients && (bulletMatch || numberedItemMatch)) {
        ingredients.push((bulletMatch || numberedItemMatch)![1].replace(/\*\*/g, '').trim());
      } else if (inInstructions && (numberedItemMatch || bulletMatch)) {
        instructions.push((numberedItemMatch || bulletMatch)![1].replace(/\*\*/g, '').trim());
      } else if (!inIngredients && !inInstructions && (bulletMatch || numberedItemMatch)) {
        // If no section detected yet, assume instruction-like content
        instructions.push((bulletMatch || numberedItemMatch)![1].replace(/\*\*/g, '').trim());
      }
    }

    // Only add if it looks like a real recipe
    if (!recipeName || recipeName.length < 3) continue;

    // If no ingredients parsed, use the recipe name as the ingredient
    if (ingredients.length === 0) {
      ingredients.push(recipeName);
    }
    // If no instructions, add a placeholder
    if (instructions.length === 0) {
      instructions.push('Follow standard preparation for this dish.');
    }

    recipes.push({
      id: `rcp_${recipes.length + 1}`,
      recipe_name: recipeName,
      ingredients_used: ingredients,
      estimated_time: estimatedTime,
      instructions,
      difficulty,
    });
  }

  // Fallback: if nothing parsed, show the raw text as a single recipe card
  if (recipes.length === 0 && md.trim()) {
    recipes.push({
      id: 'rcp_1',
      recipe_name: 'Chef\'s Suggestions',
      ingredients_used: ['See details below'],
      estimated_time: 'Varies',
      instructions: md.split('\n').filter(l => l.trim()).map(l => l.replace(/^[\d.#*\s-]+/, '').trim()),
      difficulty: 'EASY',
    });
  }

  return recipes;
}

// API Methods
export const api = {
  /**
   * Health Check
   */
  async checkHealth(): Promise<{ status: string }> {
    const baseUrl = getApiBaseUrl();
    try {
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        return { status: 'healthy' };
      }
      return { status: 'unhealthy' };
    } catch {
      return { status: 'offline' };
    }
  },

  /**
   * Get dashboard summary stats
   */
  async getStats(): Promise<DashboardStats> {
    return safeFetch<DashboardStats>('/api/inventory/stats', {}, () => {
      // Calculate from live mock items
      const items = MOCK_ITEMS;
      return {
        total_items: items.reduce((acc, i) => acc + i.quantity, 0),
        expiring_soon: items.filter(i => i.risk_level === 'EXPIRING_SOON').length,
        critical: items.filter(i => i.risk_level === 'CRITICAL').length,
        expired: items.filter(i => i.risk_level === 'EXPIRED').length
      };
    });
  },

  /**
   * List all items (with optional risk_level filter)
   */
  async getInventory(riskLevel?: string): Promise<InventoryItem[]> {
    const query = riskLevel ? `?risk_level=${riskLevel}` : '';
    return safeFetch<InventoryItem[]>(`/api/inventory${query}`, {}, () => {
      if (riskLevel) {
        return MOCK_ITEMS.filter(i => i.risk_level === riskLevel);
      }
      // Sort by expiry
      return [...MOCK_ITEMS].sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
    });
  },

  /**
   * Add a new inventory item
   */
  async createItem(item: Omit<InventoryItem, 'id' | 'risk_level'>): Promise<InventoryItem> {
    // Map frontend field names to backend schema field names
    const backendPayload: Record<string, any> = {
      product_name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      expiry_date: item.expiry_date,
      fssai_number: (item as any).fssai_license_no || undefined,
      storage_instructions: (item as any).storage_instructions || undefined,
      department: (item as any).department || undefined,
    };
    return safeFetch<InventoryItem>(
      '/api/inventory',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload)
      },
      () => {
        // Mock add
        const now = new Date();
        const expiry = new Date(item.expiry_date);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        let risk_level: RiskLevel = 'FRESH';
        if (diffDays < 0) risk_level = 'EXPIRED';
        else if (diffDays <= 2) risk_level = 'CRITICAL';
        else if (diffDays <= 5) risk_level = 'EXPIRING_SOON';

        const newItem: InventoryItem = {
          ...item,
          id: `item_${Date.now()}`,
          risk_level
        };
        MOCK_ITEMS.push(newItem);
        return newItem;
      }
    );
  },

  /**
   * Update an existing item
   */
  async updateItem(id: string | number, item: Partial<InventoryItem>): Promise<InventoryItem> {
    return safeFetch<InventoryItem>(
      `/api/inventory/${id}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      },
      () => {
        const idx = MOCK_ITEMS.findIndex(i => String(i.id) === String(id));
        if (idx === -1) throw new Error('Item not found');
        
        const updated = {
          ...MOCK_ITEMS[idx],
          ...item
        } as InventoryItem;

        // Recalculate risk level if expiry date changed
        if (item.expiry_date) {
          const now = new Date();
          const expiry = new Date(item.expiry_date);
          const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          let risk_level: RiskLevel = 'FRESH';
          if (diffDays < 0) risk_level = 'EXPIRED';
          else if (diffDays <= 2) risk_level = 'CRITICAL';
          else if (diffDays <= 5) risk_level = 'EXPIRING_SOON';
          updated.risk_level = risk_level;
        }

        MOCK_ITEMS[idx] = updated;
        return updated;
      }
    );
  },

  /**
   * Mark quantity as consumed
   */
  async consumeItem(id: string | number, quantity: number): Promise<InventoryItem> {
    // The spec lists standard PATCH /api/inventory/{id}/consume.
    // Let's pass the quantity inside the body or query. We will do both (query parameter & body) for safety!
    return safeFetch<InventoryItem>(
      `/api/inventory/${id}/consume?quantity=${quantity}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      },
      () => {
        const idx = MOCK_ITEMS.findIndex(i => String(i.id) === String(id));
        if (idx === -1) throw new Error('Item not found');
        
        const item = MOCK_ITEMS[idx];
        const newQty = Math.max(0, item.quantity - quantity);
        
        // Update analytics total
        const mockAnalytic = MOCK_ANALYTICS.find(a => a.product_name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(a.product_name.toLowerCase()));
        if (mockAnalytic) {
          mockAnalytic.consumed_qty += quantity;
          mockAnalytic.waste_rate = Number(((mockAnalytic.wasted_qty / (mockAnalytic.consumed_qty + mockAnalytic.wasted_qty)) * 100).toFixed(1));
        }

        if (newQty === 0) {
          MOCK_ITEMS.splice(idx, 1);
          return { ...item, quantity: 0 };
        } else {
          item.quantity = newQty;
          return item;
        }
      }
    );
  },

  /**
   * Mark quantity as wasted
   */
  async wasteItem(id: string | number, quantity: number): Promise<InventoryItem> {
    return safeFetch<InventoryItem>(
      `/api/inventory/${id}/waste?quantity=${quantity}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      },
      () => {
        const idx = MOCK_ITEMS.findIndex(i => String(i.id) === String(id));
        if (idx === -1) throw new Error('Item not found');
        
        const item = MOCK_ITEMS[idx];
        const newQty = Math.max(0, item.quantity - quantity);

        // Update analytics total
        const mockAnalytic = MOCK_ANALYTICS.find(a => a.product_name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(a.product_name.toLowerCase()));
        if (mockAnalytic) {
          mockAnalytic.wasted_qty += quantity;
          mockAnalytic.waste_rate = Number(((mockAnalytic.wasted_qty / (mockAnalytic.consumed_qty + mockAnalytic.wasted_qty)) * 100).toFixed(1));
        }

        if (newQty === 0) {
          MOCK_ITEMS.splice(idx, 1);
          return { ...item, quantity: 0 };
        } else {
          item.quantity = newQty;
          return item;
        }
      }
    );
  },

  /**
   * Scan a label photo to extract details using Gemini API
   */
  async scanLabel(file: File): Promise<ScanResult> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/scan`;

    if (getMockMode()) {
      // Simulate scanning loading delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      return {
        product_name: 'Amul Gold Pasteurised Milk',
        expiry_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days from now
        fssai_license_no: '10012021000071',
        storage_instructions: 'Refrigerate below 4°C. Consume within 48 hours of opening.',
        quantity: 1,
        unit: 'Liter',
        category: 'Dairy'
      };
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error(`Scan failed ${response.status}: ${response.statusText}`);
      }
      return await response.json() as ScanResult;
    } catch (error) {
      console.error('[Scan API Error] Scan failed:', error);
      // Give them simulated scanning data on fail so they can test/demonstrate
      console.warn('[Scan Fallback] Mocking response for demo safety.');
      await new Promise(resolve => setTimeout(resolve, 1500));
      return {
        product_name: 'Britannia Cheese Slices',
        expiry_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        fssai_license_no: '10015022003595',
        storage_instructions: 'Keep refrigerated between 4°C and 8°C.',
        quantity: 200,
        unit: 'Grams',
        category: 'Dairy'
      };
    }
  },

  /**
   * Recalculate risk levels manually
   */
  async triggerSchedulerRun(): Promise<{ status: string; message: string }> {
    return safeFetch<{ status: string; message: string }>('/api/scheduler/run', { method: 'POST' }, () => {
      // Randomly modify a risk level or mock status message
      return {
        status: 'success',
        message: 'Successfully executed risk recalculation scheduler. 6 items updated.'
      };
    });
  },

  /**
   * Get active alerts
   */
  async getAlerts(): Promise<AlertItem[]> {
    return safeFetch<AlertItem[]>('/api/alerts', {}, () => {
      // Return alerts based on critical / expiring soon items
      return MOCK_ALERTS;
    });
  },

  /**
   * Get alert count summary
   */
  async getAlertSummary(): Promise<AlertSummary> {
    return safeFetch<AlertSummary>('/api/alerts/summary', {}, () => {
      return {
        CRITICAL: MOCK_ITEMS.filter(i => i.risk_level === 'CRITICAL').length,
        EXPIRING_SOON: MOCK_ITEMS.filter(i => i.risk_level === 'EXPIRING_SOON').length,
        EXPIRED: MOCK_ITEMS.filter(i => i.risk_level === 'EXPIRED').length
      };
    });
  },

  /**
   * Get analytics & consumption patterns
   */
  async getAnalytics(): Promise<AnalyticsPattern[]> {
    const result = await safeFetch<any>('/api/analytics', {}, () => {
      return MOCK_ANALYTICS;
    });
    // Backend returns { patterns: [...], total_items_tracked, ... }
    // Extract the patterns array; fall back if result is already an array.
    if (Array.isArray(result)) {
      return result;
    }
    return result?.patterns ?? [];
  },

  /**
   * Get Gemini recommendations.
   * Backend returns { recommendations: "markdown string" }.
   * We parse the markdown into structured GeminiRecommendation[] for the UI.
   */
  async getRecommendations(): Promise<GeminiRecommendation[]> {
    const result = await safeFetch<any>('/api/analytics/recommendations', {}, () => {
      return MOCK_RECOMMENDATIONS;
    });
    // Already an array (mock mode) — return as-is
    if (Array.isArray(result)) return result;
    // Backend returns { recommendations: "markdown string" }
    const md: string = result?.recommendations ?? '';
    if (!md) return [];
    return parseRecommendationsMarkdown(md);
  },

  /**
   * Get Gemini recipes suggestions.
   * Backend returns { recipes: "markdown string" }.
   * We parse the markdown into structured GeminiRecipe[] for the UI.
   */
  async getRecipes(): Promise<GeminiRecipe[]> {
    const result = await safeFetch<any>('/api/analytics/recipes', {}, () => {
      return MOCK_RECIPES;
    });
    if (Array.isArray(result)) return result;
    const md: string = result?.recipes ?? '';
    if (!md) return [];
    return parseRecipesMarkdown(md);
  },

  /**
   * Generate and trigger download of FSSAI PDF report
   */
  async downloadFssaiReport(): Promise<void> {
    const baseUrl = getApiBaseUrl();
    const url = `${baseUrl}/api/compliance/report`;

    if (getMockMode()) {
      // In mock mode, generate a simple text/pdf blob or similar
      console.warn('[API Mock] Simulating PDF download.');
      const docContent = `GEN-016 - FSSAI Food Safety and Expiry Compliance Report\nGenerated: ${new Date().toLocaleString()}\n\nCritical Items: 1\nExpiring Soon: 2\nExpired: 1\n\nVerified FSSAI Licenses:\n- Amul Milk: 10012021000071\n- Bread: 10014011001852\n- Paneer: 10012011000104\n\nCompliance Status: COMPLIANT`;
      const blob = new Blob([docContent], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `FSSAI_Compliance_Report_${Date.now()}.pdf`;
      link.click();
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to generate FSSAI PDF: ${response.statusText}`);
      }
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `FSSAI_Compliance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
    } catch (error) {
      console.error('[Report API Error] PDF generation failed:', error);
      // Try to generate a fake pdf file for the demo fallback
      const docContent = `[DEMO FALLBACK] FSSAI Compliance Report PDF\nGenerated at: ${new Date().toLocaleDateString()}\nStatus: Verified\n\nThis is a fallback compliance PDF document because the FastAPI server was offline or unreachable at ${baseUrl}.`;
      const blob = new Blob([docContent], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `FSSAI_Compliance_Report_Fallback.txt`;
      link.click();
      throw error;
    }
  },

  /**
   * Register a new institution
   */
  async registerInstitution(institution: Omit<Institution, 'id'>): Promise<Institution> {
    return safeFetch<Institution>(
      '/api/institutions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(institution)
      },
      () => {
        const newInst: Institution = {
          ...institution,
          id: `inst_${Date.now()}`
        };
        MOCK_INSTITUTIONS.push(newInst);
        return newInst;
      }
    );
  },

  /**
   * Get all registered institutions
   */
  async getInstitutions(): Promise<Institution[]> {
    return safeFetch<Institution[]>('/api/institutions', {}, () => {
      return MOCK_INSTITUTIONS;
    });
  },

  /**
   * Detect current surplus candidates across all institutions
   */
  async detectSurplus(): Promise<InventoryItem[]> {
    return safeFetch<InventoryItem[]>('/api/surplus/detect', {}, () => {
      // In mock mode, we find items with risk_level == 'CRITICAL'
      return MOCK_ITEMS.filter(item => item.risk_level === 'CRITICAL');
    });
  },

  /**
   * Trigger matching for an institution's surplus items
   */
  async triggerMatching(institutionId: string | number): Promise<SurplusMatch[]> {
    return safeFetch<SurplusMatch[]>(
      `/api/surplus/match/${institutionId}`,
      { method: 'POST' },
      () => {
        const sourceInst = MOCK_INSTITUTIONS.find(i => String(i.id) === String(institutionId)) || MOCK_INSTITUTIONS[0];
        // Find other institutions to match with
        const otherInsts = MOCK_INSTITUTIONS.filter(i => String(i.id) !== String(sourceInst.id));
        if (otherInsts.length === 0) {
          return MOCK_SURPLUS_MATCHES;
        }
        
        // Find critical item
        const criticalItems = MOCK_ITEMS.filter(item => item.risk_level === 'CRITICAL');
        if (criticalItems.length === 0) {
          return MOCK_SURPLUS_MATCHES;
        }

        // Create new matches
        criticalItems.forEach((item, idx) => {
          const matchedInst = otherInsts[idx % otherInsts.length];
          const matchId = `match_${Date.now()}_${idx}`;
          const alreadyMatched = MOCK_SURPLUS_MATCHES.some(
            m => String(m.surplus_item_id) === String(item.id) && String(m.matched_institution_id) === String(matchedInst.id)
          );

          if (!alreadyMatched) {
            MOCK_SURPLUS_MATCHES.push({
              id: matchId,
              surplus_item_id: item.id,
              surplus_item: item,
              source_institution_id: sourceInst.id,
              source_institution: sourceInst,
              matched_institution_id: matchedInst.id,
              matched_institution: matchedInst,
              status: 'proposed',
              quantity_kg: item.quantity,
              message: `${sourceInst.name} has ${item.quantity} ${item.unit} of ${item.name} expiring soon → ${matchedInst.name} — Transfer suggested`,
              created_at: new Date().toISOString()
            });
          }
        });

        return MOCK_SURPLUS_MATCHES;
      }
    );
  },

  /**
   * Get all active surplus matches
   */
  async getSurplusMatches(): Promise<SurplusMatch[]> {
    return safeFetch<SurplusMatch[]>('/api/surplus/matches', {}, () => {
      return MOCK_SURPLUS_MATCHES;
    });
  },

  /**
   * Respond to a surplus match proposal (accept/decline)
   */
  async respondToMatch(id: string | number, status: 'accepted' | 'declined'): Promise<SurplusMatch> {
    return safeFetch<SurplusMatch>(
      `/api/surplus/matches/${id}/respond?status=${status}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      },
      () => {
        const match = MOCK_SURPLUS_MATCHES.find(m => String(m.id) === String(id));
        if (!match) {
          throw new Error('Surplus match not found');
        }
        match.status = status;
        return match;
      }
    );
  },

  /**
   * Trigger the daily surplus check manually
   */
  async runSurplusCheck(): Promise<{ status: string; message: string; matches_created: number }> {
    return safeFetch<{ status: string; message: string; matches_created: number }>(
      '/api/surplus/run',
      { method: 'POST' },
      () => {
        if (MOCK_INSTITUTIONS.length > 0) {
          const firstInst = MOCK_INSTITUTIONS[0];
          const previousCount = MOCK_SURPLUS_MATCHES.length;
          
          const otherInsts = MOCK_INSTITUTIONS.filter(i => String(i.id) !== String(firstInst.id));
          const criticalItems = MOCK_ITEMS.filter(item => item.risk_level === 'CRITICAL');
          
          if (otherInsts.length > 0 && criticalItems.length > 0) {
            criticalItems.forEach((item, idx) => {
              const matchedInst = otherInsts[idx % otherInsts.length];
              const alreadyMatched = MOCK_SURPLUS_MATCHES.some(
                m => String(m.surplus_item_id) === String(item.id) && String(m.matched_institution_id) === String(matchedInst.id)
              );

              if (!alreadyMatched) {
                MOCK_SURPLUS_MATCHES.push({
                  id: `match_auto_${Date.now()}_${idx}`,
                  surplus_item_id: item.id,
                  surplus_item: item,
                  source_institution_id: firstInst.id,
                  source_institution: firstInst,
                  matched_institution_id: matchedInst.id,
                  matched_institution: matchedInst,
                  status: 'proposed',
                  quantity_kg: item.quantity,
                  message: `${firstInst.name} has ${item.quantity} ${item.unit} of ${item.name} expiring soon → ${matchedInst.name} — Transfer suggested`,
                  created_at: new Date().toISOString()
                });
              }
            });
          }
          
          const created = MOCK_SURPLUS_MATCHES.length - previousCount;
          return {
            status: 'success',
            message: `Executed daily surplus checking job. Detected ${criticalItems.length} surplus candidate items. Generated ${created} new matching recommendations.`,
            matches_created: created
          };
        }

        return {
          status: 'success',
          message: 'Executed daily surplus check. No institutions registered yet.',
          matches_created: 0
        };
      }
    );
  },

  /**
   * Discover nearby institutions via Google Places API.
   * Always calls the real backend (even in mock/demo mode) to get live
   * Google Places data. Pass lat/lng so the backend doesn't need a DB lookup.
   */
  async getNearbyPlaces(
    institutionId: string | number,
    radiusKm: number = 10,
    refresh: boolean = false,
    lat?: number,
    lng?: number,
    instName?: string,
  ): Promise<{ places: DiscoveredPlace[]; from_cache: boolean; error: string | null }> {
    const baseUrl = getApiBaseUrl();
    let url = `${baseUrl}/api/surplus/nearby-places?institution_id=${institutionId}&radius_km=${radiusKm}&refresh=${refresh}`;
    if (lat !== undefined && lng !== undefined) {
      url += `&lat=${lat}&lng=${lng}`;
    }
    if (instName) {
      url += `&name=${encodeURIComponent(instName)}`;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('[Nearby Places] Failed to fetch from backend:', error);
      return {
        places: [],
        from_cache: false,
        error: 'Could not reach the server. Please ensure the backend is running.',
      };
    }
  },

  /**
   * Mark a discovered place as invited
   */
  async invitePlace(placeId: string): Promise<{ message: string }> {
    return safeFetch<{ message: string }>(
      `/api/surplus/nearby-places/${placeId}/invite`,
      { method: 'POST' },
      () => ({ message: `Invited place ${placeId} to join the network.` })
    );
  },

  // ── Department Auth ──

  /**
   * List all departments (for login dropdown)
   */
  async listDepartments(): Promise<{ id: string; dept_code: string; name: string; icon: string }[]> {
    return safeFetch<any[]>('/api/auth/departments', {}, () => [
      { id: '1', dept_code: 'SNACKS', name: 'Snacks', icon: '🍿' },
      { id: '2', dept_code: 'DRINKS', name: 'Drinks', icon: '🥤' },
      { id: '3', dept_code: 'DAIRY', name: 'Dairy', icon: '🥛' },
      { id: '4', dept_code: 'PRODUCE', name: 'Produce', icon: '🥬' },
      { id: '5', dept_code: 'BAKERY', name: 'Bakery', icon: '🍞' },
      { id: '6', dept_code: 'SPICES', name: 'Spices', icon: '🧂' },
    ]);
  },

  /**
   * Department login
   */
  async departmentLogin(deptCode: string, password: string): Promise<{ dept_code: string; name: string; icon: string; message: string }> {
    return safeFetch<any>(
      '/api/auth/department-login',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dept_code: deptCode, password }),
      },
      () => { throw new Error('Login requires backend connection.'); }
    );
  },

  /**
   * Get items filtered by department
   */
  async getDepartmentItems(deptCode: string): Promise<InventoryItem[]> {
    return safeFetch<InventoryItem[]>(
      `/api/inventory?department=${deptCode}`,
      {},
      () => MOCK_ITEMS.filter(i => i.category?.toUpperCase() === deptCode.toUpperCase())
    );
  }
};
