-- ============================================================
-- GEN-016: Discovered Places — Migration
-- Run this AFTER 002_surplus_network.sql
-- Paste into Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ──────────────────────────────────────────────
-- 13. DISCOVERED PLACES (from Google Places API)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS discovered_places (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    place_id                TEXT NOT NULL,
    source_institution_id   UUID REFERENCES institutions(id) ON DELETE CASCADE,
    name                    TEXT NOT NULL,
    address                 TEXT,
    latitude                DOUBLE PRECISION NOT NULL,
    longitude               DOUBLE PRECISION NOT NULL,
    place_type              TEXT DEFAULT 'other'
                            CHECK (place_type IN ('college','hostel','restaurant','ngo','foodbank','other')),
    is_registered           BOOLEAN DEFAULT false,
    invited                 BOOLEAN DEFAULT false,
    invited_at              TIMESTAMPTZ,
    discovered_at           TIMESTAMPTZ DEFAULT now(),

    -- Unique constraint for upsert: one entry per place per source institution
    UNIQUE (place_id, source_institution_id)
);

CREATE INDEX IF NOT EXISTS idx_discovered_place_id ON discovered_places(place_id);
CREATE INDEX IF NOT EXISTS idx_discovered_source ON discovered_places(source_institution_id);
CREATE INDEX IF NOT EXISTS idx_discovered_type ON discovered_places(place_type);


-- ──────────────────────────────────────────────
-- 14. RLS FOR DISCOVERED PLACES
-- ──────────────────────────────────────────────
ALTER TABLE discovered_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on discovered_places" ON discovered_places FOR ALL USING (true) WITH CHECK (true);


-- ============================================================
-- Done! Discovered Places table ready.
-- ============================================================
