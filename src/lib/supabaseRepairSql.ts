// ==============================================================================
// EASTFIELD ACADEMY - AUTHORITATIVE GLOBAL DATABASE REPAIR & MIGRATION SCRIPT
// ==============================================================================
// Run this in your Supabase project SQL Editor (https://supabase.com/dashboard)
// It safely creates all missing tables, adds missing columns, removes RLS barriers,
// enables realtime broadcasting for all browsers, and reloads the schema cache.
// ==============================================================================

export const SUPABASE_SQL_REPAIR = `-- ==============================================================================
-- EASTFIELD ACADEMY - AUTHORITATIVE GLOBAL DATABASE REPAIR & MIGRATION SCRIPT
-- ==============================================================================

-- 1. Create Config Table
CREATE TABLE IF NOT EXISTS public.ea_config (
  id VARCHAR PRIMARY KEY DEFAULT 'global_config',
  school_name VARCHAR NOT NULL DEFAULT 'Eastfield Academy',
  school_year VARCHAR NOT NULL DEFAULT '2025/2026',
  term VARCHAR NOT NULL DEFAULT 'Term 1',
  principal_name VARCHAR NOT NULL DEFAULT 'Dr. Evelyn Asare-Bediako',
  principal_signature_url VARCHAR,
  school_logo_text VARCHAR DEFAULT 'EA',
  school_logo_url VARCHAR,
  class_score_weight INTEGER NOT NULL DEFAULT 50,
  exam_score_weight INTEGER NOT NULL DEFAULT 50,
  grading_scale JSONB NOT NULL DEFAULT '[]'::jsonb,
  report_template VARCHAR DEFAULT 'dynamic',
  reopening_date VARCHAR DEFAULT '2026-09-15',
  last_promoted_year VARCHAR,
  auto_promote_on_reopening BOOLEAN DEFAULT true,
  school_motto VARCHAR DEFAULT 'Knowledge, Character & Excellence',
  custom_notice_note TEXT,
  show_position_in_class BOOLEAN DEFAULT true,
  show_conduct_column BOOLEAN DEFAULT true,
  show_attendance_section BOOLEAN DEFAULT true,
  accent_color VARCHAR DEFAULT '#1e1b4b',
  watermark_text VARCHAR DEFAULT 'EASTFIELD ACADEMY',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Pupils / Students Table (175 Active Pupils)
CREATE TABLE IF NOT EXISTS public.ea_students (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  roll_number VARCHAR NOT NULL,
  level VARCHAR NOT NULL DEFAULT 'PRIMARY',
  class_name VARCHAR NOT NULL,
  guardian_name VARCHAR NOT NULL,
  guardian_email VARCHAR NOT NULL,
  guardian_phone VARCHAR DEFAULT '',
  photo_url TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Teachers / Staff Table (16 Active Teachers)
CREATE TABLE IF NOT EXISTS public.ea_teachers (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'TEACHER',
  password VARCHAR,
  level VARCHAR DEFAULT 'PRIMARY',
  subjects JSONB DEFAULT '[]'::jsonb,
  classes JSONB DEFAULT '[]'::jsonb,
  date_of_birth VARCHAR DEFAULT '',
  phone_number VARCHAR DEFAULT '',
  qualification VARCHAR DEFAULT '',
  profile_picture TEXT DEFAULT '',
  hometown VARCHAR DEFAULT '',
  ghana_card_number VARCHAR DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Student Continuous Assessment Grades Table
CREATE TABLE IF NOT EXISTS public.ea_grades (
  student_id VARCHAR NOT NULL,
  subject_id VARCHAR NOT NULL,
  class_score NUMERIC NOT NULL DEFAULT 0,
  exam_score NUMERIC NOT NULL DEFAULT 0,
  total_score NUMERIC NOT NULL DEFAULT 0,
  grade_letter VARCHAR NOT NULL DEFAULT 'F',
  remarks VARCHAR NOT NULL DEFAULT '',
  nursery_remark VARCHAR NOT NULL DEFAULT '',
  term VARCHAR NOT NULL DEFAULT 'Term 1',
  year VARCHAR NOT NULL DEFAULT '2025/2026',
  teacher_id VARCHAR NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (student_id, subject_id, term, year)
);

-- 5. Create Term Attendance Table
CREATE TABLE IF NOT EXISTS public.ea_attendance (
  student_id VARCHAR NOT NULL,
  term VARCHAR NOT NULL DEFAULT 'Term 1',
  year VARCHAR NOT NULL DEFAULT '2025/2026',
  total_days INTEGER NOT NULL DEFAULT 0,
  days_present INTEGER NOT NULL DEFAULT 0,
  remarks VARCHAR NOT NULL DEFAULT '',
  teacher_id VARCHAR NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (student_id, term, year)
);

-- 6. Create Daily Attendance Roll Call Table (Real-Time Across Devices)
CREATE TABLE IF NOT EXISTS public.ea_daily_attendance (
  id VARCHAR PRIMARY KEY,
  student_id VARCHAR NOT NULL,
  date VARCHAR NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'Present',
  term VARCHAR NOT NULL DEFAULT 'Term 1',
  year VARCHAR NOT NULL DEFAULT '2025/2026',
  teacher_id VARCHAR NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create Student Bills Table
CREATE TABLE IF NOT EXISTS public.ea_bills (
  student_id VARCHAR PRIMARY KEY,
  arrears VARCHAR DEFAULT '0.00',
  tuition VARCHAR DEFAULT '0.00',
  computing VARCHAR DEFAULT '0.00',
  utility VARCHAR DEFAULT '0.00',
  stationery VARCHAR DEFAULT '0.00',
  pta VARCHAR DEFAULT '0.00',
  reopening_date VARCHAR,
  contact_number VARCHAR,
  term VARCHAR DEFAULT 'Term 1',
  year VARCHAR DEFAULT '2025/2026',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Create Fee Payments Table
CREATE TABLE IF NOT EXISTS public.ea_fee_payments (
  id VARCHAR PRIMARY KEY,
  receipt_number VARCHAR NOT NULL,
  student_id VARCHAR NOT NULL,
  student_name VARCHAR NOT NULL,
  class_name VARCHAR NOT NULL,
  fee_type VARCHAR NOT NULL,
  amount_paid NUMERIC DEFAULT 0,
  total_fee_amount NUMERIC DEFAULT 0,
  payment_method VARCHAR DEFAULT 'Cash',
  payment_date VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'Paid',
  remarks VARCHAR DEFAULT '',
  recorded_by VARCHAR DEFAULT 'Admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Create Fee Structures Table
CREATE TABLE IF NOT EXISTS public.ea_fee_structures (
  id VARCHAR PRIMARY KEY,
  level VARCHAR NOT NULL,
  tuition NUMERIC DEFAULT 0,
  computing NUMERIC DEFAULT 0,
  utility NUMERIC DEFAULT 0,
  stationery NUMERIC DEFAULT 0,
  pta NUMERIC DEFAULT 0,
  uniform NUMERIC DEFAULT 0,
  mock_exam NUMERIC DEFAULT 0,
  term VARCHAR DEFAULT 'Term 1',
  year VARCHAR DEFAULT '2025/2026',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Create Daily Collections Table
CREATE TABLE IF NOT EXISTS public.ea_daily_collections (
  id VARCHAR PRIMARY KEY,
  collection_date VARCHAR NOT NULL,
  total_cash NUMERIC DEFAULT 0,
  total_momo NUMERIC DEFAULT 0,
  total_bank NUMERIC DEFAULT 0,
  total_cheque NUMERIC DEFAULT 0,
  total_collected NUMERIC DEFAULT 0,
  recorded_by VARCHAR DEFAULT 'Admin',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Create Sync Logs Table (Auditing Global Real-Time Sync)
CREATE TABLE IF NOT EXISTS public.ea_sync_logs (
  id VARCHAR PRIMARY KEY,
  action_type VARCHAR NOT NULL,
  description TEXT NOT NULL,
  performed_by VARCHAR DEFAULT 'System',
  status VARCHAR DEFAULT 'SUCCESS',
  details JSONB DEFAULT '{}'::jsonb,
  timestamp VARCHAR NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Create Deleted Records / Tombstone Table
CREATE TABLE IF NOT EXISTS public.ea_deleted_records (
  id VARCHAR PRIMARY KEY,
  record_type VARCHAR NOT NULL,
  record_id VARCHAR NOT NULL,
  roll_number VARCHAR,
  name VARCHAR,
  details JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. Create Inventory Table
CREATE TABLE IF NOT EXISTS public.ea_inventory (
  id VARCHAR PRIMARY KEY,
  location_name VARCHAR NOT NULL,
  category VARCHAR DEFAULT 'Classroom',
  student_chairs INTEGER DEFAULT 0,
  student_tables INTEGER DEFAULT 0,
  textbooks INTEGER DEFAULT 0,
  washrooms INTEGER DEFAULT 0,
  sinks INTEGER DEFAULT 0,
  buses INTEGER DEFAULT 0,
  teacher_chairs INTEGER DEFAULT 0,
  teacher_tables INTEGER DEFAULT 0,
  computers INTEGER DEFAULT 0,
  projectors INTEGER DEFAULT 0,
  custom_items TEXT,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. Create Book Stock Table
CREATE TABLE IF NOT EXISTS public.ea_book_stock (
  id VARCHAR PRIMARY KEY,
  title VARCHAR NOT NULL,
  category VARCHAR NOT NULL DEFAULT 'Textbook',
  publication VARCHAR NOT NULL,
  subject_type VARCHAR NOT NULL,
  target_class VARCHAR DEFAULT 'All Classes',
  unit_price NUMERIC DEFAULT 0,
  cost_price NUMERIC DEFAULT 0,
  quantity_in_stock INTEGER DEFAULT 0,
  quantity_sold INTEGER DEFAULT 0,
  quantity_remaining INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 20,
  shelf_location VARCHAR,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 15. Create Book Sales Table
CREATE TABLE IF NOT EXISTS public.ea_book_sales (
  id VARCHAR PRIMARY KEY,
  receipt_number VARCHAR NOT NULL,
  buyer_name VARCHAR NOT NULL,
  buyer_type VARCHAR DEFAULT 'Parent',
  student_id VARCHAR,
  student_name VARCHAR,
  student_class VARCHAR,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  payment_method VARCHAR DEFAULT 'Cash',
  sold_by VARCHAR DEFAULT 'Admin',
  sale_date VARCHAR NOT NULL,
  status VARCHAR DEFAULT 'Completed',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 16. Create JHS Mock Exams Table
CREATE TABLE IF NOT EXISTS public.ea_jhs_mock_exams (
  id VARCHAR PRIMARY KEY,
  student_id VARCHAR NOT NULL,
  student_name VARCHAR NOT NULL,
  roll_number VARCHAR,
  class_name VARCHAR DEFAULT 'JHS 3',
  exam_title VARCHAR DEFAULT 'Mock Examination 1',
  academic_year VARCHAR DEFAULT '2025/2026',
  scores JSONB DEFAULT '{}'::jsonb,
  remarks TEXT,
  updated_by VARCHAR,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- Ensure Compatibility Views for legacy or unqualified table queries
-- ==============================================================================
CREATE OR REPLACE VIEW public.students AS SELECT * FROM public.ea_students;
CREATE OR REPLACE VIEW public.teachers AS SELECT * FROM public.ea_teachers;
CREATE OR REPLACE VIEW public.attendance AS SELECT * FROM public.ea_attendance;
CREATE OR REPLACE VIEW public.daily_attendance AS SELECT * FROM public.ea_daily_attendance;
CREATE OR REPLACE VIEW public.grades AS SELECT * FROM public.ea_grades;
CREATE OR REPLACE VIEW public.bills AS SELECT * FROM public.ea_bills;

-- ==============================================================================
-- Real-time publication for all ea_* tables so other devices react immediately
-- ==============================================================================
DO $$
DECLARE
  tbl text;
  realtime_tables text[] := ARRAY[
    'ea_config',
    'ea_students',
    'ea_teachers',
    'ea_grades',
    'ea_attendance',
    'ea_daily_attendance',
    'ea_bills',
    'ea_fee_payments',
    'ea_fee_structures',
    'ea_daily_collections',
    'ea_inventory',
    'ea_book_stock',
    'ea_book_sales',
    'ea_deleted_records',
    'ea_jhs_mock_exams',
    'ea_sync_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY realtime_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
    ) THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', tbl);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- ==============================================================================
-- Configure Row Level Security & Permissive Policies
-- ==============================================================================
ALTER TABLE public.ea_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_daily_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_fee_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_fee_structures DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_daily_collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_book_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_book_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_deleted_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_jhs_mock_exams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_sync_logs DISABLE ROW LEVEL SECURITY;

-- Grant broad access to public / anon / authenticated roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Storage Bucket Setup for 'ea' (Photos & Documents)
INSERT INTO storage.buckets (id, name, public)
VALUES ('ea', 'ea', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public read access on ea bucket" ON storage.objects;
CREATE POLICY "Allow public read access on ea bucket" ON storage.objects FOR SELECT TO public USING (bucket_id = 'ea');

DROP POLICY IF EXISTS "Allow public uploads for testing" ON storage.objects;
CREATE POLICY "Allow public uploads for testing" ON storage.objects FOR INSERT TO anon, authenticated, public WITH CHECK (bucket_id = 'ea');

DROP POLICY IF EXISTS "Allow public updates for testing" ON storage.objects;
CREATE POLICY "Allow public updates for testing" ON storage.objects FOR UPDATE TO anon, authenticated, public USING (bucket_id = 'ea') WITH CHECK (bucket_id = 'ea');

DROP POLICY IF EXISTS "Allow public deletes for testing" ON storage.objects;
CREATE POLICY "Allow public deletes for testing" ON storage.objects FOR DELETE TO anon, authenticated, public USING (bucket_id = 'ea');

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
`;
