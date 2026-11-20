-- ============================================================
-- GEN-016: Supabase Schema Migration
-- AI-Powered Food Inventory & Expiry Management System
-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New Query)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ──────────────────────────────────────────────
-- 1. INVENTORY ITEMS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name    TEXT NOT NULL,
    expiry_date     DATE NOT NULL,
    manufacturing_date DATE,
    fssai_number    TEXT,
    storage_instructions TEXT,
    category        TEXT,                     -- dairy, grain, spice, snack, beverage, etc.
    quantity        INTEGER DEFAULT 1 CHECK (quantity >= 0),
    unit            TEXT DEFAULT 'pcs',       -- pcs, kg, L, g, ml
    supplier        TEXT,
    batch_number    TEXT,
    risk_level      TEXT DEFAULT 'FRESH'      -- FRESH | EXPIRING_SOON | CRITICAL | EXPIRED
                    CHECK (risk_level IN ('FRESH','EXPIRING_SOON','CRITICAL','EXPIRED')),
    status          TEXT DEFAULT 'ACTIVE'     -- ACTIVE | CONSUMED | EXPIRED | DISPOSED
                    CHECK (status IN ('ACTIVE','CONSUMED','EXPIRED','DISPOSED')),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_risk ON inventory_items(risk_level);
CREATE INDEX IF NOT EXISTS idx_inventory_expiry ON inventory_items(expiry_date);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);


-- ──────────────────────────────────────────────
-- 2. ALERTS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id         UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    product_name    TEXT NOT NULL,
    risk_level      TEXT NOT NULL
                    CHECK (risk_level IN ('EXPIRING_SOON','CRITICAL','EXPIRED')),
    days_remaining  INTEGER NOT NULL,
    message         TEXT,
    resolved        BOOLEAN DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_item ON alerts(item_id);


-- ──────────────────────────────────────────────
-- 3. CONSUMPTION LOGS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consumption_logs (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id             UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    product_name        TEXT NOT NULL,
    quantity_consumed   INTEGER DEFAULT 1 CHECK (quantity_consumed >= 1),
    consumed_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consumption_item ON consumption_logs(item_id);


-- ──────────────────────────────────────────────
-- 4. WASTE LOGS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waste_logs (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id             UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    product_name        TEXT NOT NULL,
    quantity_wasted     INTEGER DEFAULT 1 CHECK (quantity_wasted >= 1),
    reason              TEXT DEFAULT 'expired'   -- expired | spoiled | damaged | other
                        CHECK (reason IN ('expired','spoiled','damaged','other')),
    wasted_at           TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waste_item ON waste_logs(item_id);


-- ──────────────────────────────────────────────
-- 5. AUTO-UPDATE updated_at TRIGGER
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ──────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (disabled for hackathon)
-- ──────────────────────────────────────────────
-- Enable RLS on tables but allow all operations via service role key.
-- For production, add policies restricting access per user.
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for service-role / anon key (hackathon mode)
CREATE POLICY "Allow all on inventory_items" ON inventory_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on alerts" ON alerts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on consumption_logs" ON consumption_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on waste_logs" ON waste_logs FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- SURPLUS INTELLIGENCE NETWORK TABLES
-- ============================================================


-- ──────────────────────────────────────────────
-- 7. INSTITUTIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL                 -- hostel | canteen | restaurant | ngo | foodbank
                    CHECK (type IN ('hostel','canteen','restaurant','ngo','foodbank')),
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    contact_email   TEXT,
    contact_phone   TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institutions_type ON institutions(type);


-- ──────────────────────────────────────────────
-- 8. SURPLUS MATCHES
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS surplus_matches (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    surplus_item_id         UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
    source_institution_id   UUID REFERENCES institutions(id) ON DELETE CASCADE,
    matched_institution_id  UUID REFERENCES institutions(id) ON DELETE CASCADE,
    quantity_kg             NUMERIC DEFAULT 1,
    urgency_level           TEXT DEFAULT 'MEDIUM'
                            CHECK (urgency_level IN ('LOW','MEDIUM','URGENT','CRITICAL')),
    status                  TEXT DEFAULT 'proposed'
                            CHECK (status IN ('proposed','notified','accepted','declined','transferred','expired')),
    distance_km             NUMERIC DEFAULT 0,
    message                 TEXT,
    created_at              TIMESTAMPTZ DEFAULT now(),
    updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_surplus_status ON surplus_matches(status);
CREATE INDEX IF NOT EXISTS idx_surplus_source ON surplus_matches(source_institution_id);
CREATE INDEX IF NOT EXISTS idx_surplus_matched ON surplus_matches(matched_institution_id);
CREATE INDEX IF NOT EXISTS idx_surplus_item ON surplus_matches(surplus_item_id);

-- Auto-update updated_at
CREATE TRIGGER trg_surplus_matches_updated_at
    BEFORE UPDATE ON surplus_matches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ──────────────────────────────────────────────
-- 9. NOTIFICATIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    institution_id      UUID REFERENCES institutions(id) ON DELETE CASCADE,
    surplus_match_id    UUID REFERENCES surplus_matches(id) ON DELETE CASCADE,
    channel             TEXT NOT NULL DEFAULT 'in_app'
                        CHECK (channel IN ('in_app','email','sms')),
    content             TEXT NOT NULL,
    sent_at             TIMESTAMPTZ DEFAULT now(),
    read_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_institution ON notifications(institution_id);
CREATE INDEX IF NOT EXISTS idx_notifications_match ON notifications(surplus_match_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(institution_id) WHERE read_at IS NULL;


-- ──────────────────────────────────────────────
-- 10. ADD institution_id TO INVENTORY ITEMS (optional FK)
-- ──────────────────────────────────────────────
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_institution ON inventory_items(institution_id);


-- ──────────────────────────────────────────────
-- 11. ALLOW 'transferred' IN WASTE LOGS REASON
-- ──────────────────────────────────────────────
ALTER TABLE waste_logs DROP CONSTRAINT IF EXISTS waste_logs_reason_check;
ALTER TABLE waste_logs ADD CONSTRAINT waste_logs_reason_check
    CHECK (reason IN ('expired','spoiled','damaged','transferred','other'));


-- ──────────────────────────────────────────────
-- 12. RLS FOR NEW TABLES
-- ──────────────────────────────────────────────
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE surplus_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on institutions" ON institutions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on surplus_matches" ON surplus_matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- Done! All tables ready for GEN-016 backend + Surplus Network.
-- ============================================================
