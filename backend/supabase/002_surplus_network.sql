-- ============================================================
-- GEN-016: Surplus Intelligence Network — Migration
-- Run this AFTER the original schema.sql has been applied.
-- Paste into Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ──────────────────────────────────────────────
-- 7. INSTITUTIONS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL
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
-- 10. ADD institution_id TO INVENTORY ITEMS
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
-- Done! Surplus Intelligence Network tables ready.
-- ============================================================
