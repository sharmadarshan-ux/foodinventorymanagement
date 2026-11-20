-- ============================================================
-- GEN-016: Departments — Migration
-- Run this AFTER 003_discovered_places.sql
-- Paste into Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- ──────────────────────────────────────────────
-- 15. DEPARTMENTS (for scoped login)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    dept_code       TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    password        TEXT NOT NULL,
    icon            TEXT DEFAULT '📦',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dept_code ON departments(dept_code);

-- ──────────────────────────────────────────────
-- 16. RLS
-- ──────────────────────────────────────────────
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on departments" ON departments FOR ALL USING (true) WITH CHECK (true);

-- ──────────────────────────────────────────────
-- 17. ADD department COLUMN TO inventory_items
-- ──────────────────────────────────────────────
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS department TEXT DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_department ON inventory_items(department);

-- ──────────────────────────────────────────────
-- 18. SEED DEPARTMENTS
-- ──────────────────────────────────────────────
INSERT INTO departments (dept_code, name, password, icon) VALUES
    ('SNACKS',  'Snacks',   'snacks123',  '🍿'),
    ('DRINKS',  'Drinks',   'drinks123',  '🥤'),
    ('DAIRY',   'Dairy',    'dairy123',   '🥛'),
    ('PRODUCE', 'Produce',  'produce123', '🥬'),
    ('BAKERY',  'Bakery',   'bakery123',  '🍞'),
    ('SPICES',  'Spices',   'spices123',  '🧂')
ON CONFLICT (dept_code) DO NOTHING;

-- ============================================================
-- Done! Departments table ready with 6 pre-seeded departments.
-- ============================================================
