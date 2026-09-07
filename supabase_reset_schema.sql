-- ==============================================================================
-- EASTFIELD ACADEMY: FRESH DATABASE RESET & REBUILD SCRIPT
-- Drops all existing application tables and creates clean, fresh tables
-- with assigned security policies, indexes, and storage configurations.
-- ==============================================================================

-- 1. DROP EXISTING OLD TABLES
DROP TABLE IF EXISTS public.ea_config CASCADE;
DROP TABLE IF EXISTS public.ea_students CASCADE;
DROP TABLE IF EXISTS public.ea_teachers CASCADE;
DROP TABLE IF EXISTS public.ea_grades CASCADE;
DROP TABLE IF EXISTS public.ea_attendance CASCADE;
DROP TABLE IF EXISTS public.ea_bills CASCADE;
DROP TABLE IF EXISTS public.ea_fee_payments CASCADE;
DROP TABLE IF EXISTS public.ea_fee_structures CASCADE;
DROP TABLE IF EXISTS public.ea_daily_collections CASCADE;
DROP TABLE IF EXISTS public.ea_sync_logs CASCADE;
DROP TABLE IF EXISTS public.ea_inventory CASCADE;
DROP TABLE IF EXISTS public.ea_book_stock CASCADE;
DROP TABLE IF EXISTS public.ea_book_sales CASCADE;
DROP TABLE IF EXISTS public.ea_deleted_records CASCADE;
DROP TABLE IF EXISTS public.ea_jhs_mock_exams CASCADE;

-- 2. CREATE FRESH TABLES

-- Table 1: Configuration & Settings
CREATE TABLE public.ea_config (
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

-- Table 2: Students & Pupils
CREATE TABLE public.ea_students (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  roll_number VARCHAR NOT NULL,
  level VARCHAR NOT NULL DEFAULT 'PRIMARY',
  class_name VARCHAR NOT NULL,
  guardian_name VARCHAR DEFAULT '',
  guardian_email VARCHAR DEFAULT '',
  guardian_phone VARCHAR DEFAULT '',
  photo_url TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 3: Teachers & Staff
CREATE TABLE public.ea_teachers (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'TEACHER',
  password VARCHAR,
  level VARCHAR DEFAULT 'PRIMARY',
  subjects JSONB DEFAULT '[]'::jsonb,
  classes JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 4: Continuous Assessment & Examination Grades
CREATE TABLE public.ea_grades (
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
  teacher_id VARCHAR NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (student_id, subject_id, term, year)
);

-- Table 5: Attendance
CREATE TABLE public.ea_attendance (
  student_id VARCHAR NOT NULL,
  term VARCHAR NOT NULL DEFAULT 'Term 1',
  year VARCHAR NOT NULL DEFAULT '2025/2026',
  total_days INTEGER NOT NULL DEFAULT 0,
  days_present INTEGER NOT NULL DEFAULT 0,
  remarks VARCHAR NOT NULL DEFAULT '',
  teacher_id VARCHAR NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (student_id, term, year)
);

-- Table 6: Student Fee Bills
CREATE TABLE public.ea_bills (
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

-- Table 7: Fee Payment Receipts
CREATE TABLE public.ea_fee_payments (
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

-- Table 8: Fee Structures
CREATE TABLE public.ea_fee_structures (
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

-- Table 9: Daily Collections
CREATE TABLE public.ea_daily_collections (
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

-- Table 10: Sync Logs
CREATE TABLE public.ea_sync_logs (
  id VARCHAR PRIMARY KEY,
  action_type VARCHAR NOT NULL,
  description TEXT NOT NULL,
  performed_by VARCHAR DEFAULT 'System',
  status VARCHAR DEFAULT 'SUCCESS',
  details JSONB DEFAULT '{}'::jsonb,
  timestamp VARCHAR NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 11: School Facility Inventory
CREATE TABLE public.ea_inventory (
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

-- Table 12: Book Stock
CREATE TABLE public.ea_book_stock (
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

-- Table 13: Book Sales
CREATE TABLE public.ea_book_sales (
  id VARCHAR PRIMARY KEY,
  receipt_number VARCHAR NOT NULL,
  buyer_name VARCHAR NOT NULL,
  buyer_type VARCHAR DEFAULT 'Parent',
  student_id VARCHAR,
  class_name VARCHAR,
  contact_number VARCHAR,
  items JSONB DEFAULT '[]'::jsonb,
  subtotal NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  payment_method VARCHAR DEFAULT 'Cash',
  payment_reference VARCHAR,
  sale_date VARCHAR NOT NULL,
  sale_time VARCHAR,
  recorded_by VARCHAR,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Table 14: Deleted Records Registry
CREATE TABLE public.ea_deleted_records (
  id VARCHAR PRIMARY KEY,
  record_type VARCHAR NOT NULL,
  record_id VARCHAR NOT NULL,
  roll_number VARCHAR,
  name VARCHAR,
  details JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table 15: JHS Mock Exams
CREATE TABLE public.ea_jhs_mock_exams (
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

-- 3. INSERT DEFAULT CONFIGURATION
INSERT INTO public.ea_config (
  id, school_name, school_year, term, principal_name, school_logo_text,
  class_score_weight, exam_score_weight, school_motto
) VALUES (
  'global_config', 'Eastfield Academy', '2025/2026', 'Term 1',
  'Dr. Evelyn Asare-Bediako', 'EA', 50, 50, 'Knowledge, Character & Excellence'
) ON CONFLICT (id) DO NOTHING;

-- 4. DYNAMIC ROW LEVEL SECURITY & POLICY LOOP
-- Automatically enables RLS, drops existing policies, and creates permissive policies
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'ea_config', 'ea_students', 'ea_teachers', 'ea_grades', 'ea_attendance',
    'ea_bills', 'ea_fee_payments', 'ea_fee_structures', 'ea_daily_collections',
    'ea_sync_logs', 'ea_inventory', 'ea_book_stock', 'ea_book_sales',
    'ea_deleted_records', 'ea_jhs_mock_exams'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'Allow public access on ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);', 'Allow public access on ' || t, t);
  END LOOP;
END $$;

-- 5. GRANT PERMISSIONS
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 6. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
