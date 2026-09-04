import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Student, User, Grade, Attendance, ReportConfig, StudentBill, FeePayment, FeeStructureItem, DailyCollectionSummary, SyncAuditLog, ClassroomInventoryRecord, JHSMockExamRecord, BookStockItem, BookSaleRecord } from '../types';
import { DEFAULT_INVENTORY_DATA, DEFAULT_BOOK_STOCK_ITEMS, DEFAULT_BOOK_SALES } from '../data/mockData';

// Helper to retrieve credentials from env or localStorage
export function getSupabaseCredentials() {
  const defaultUrl = "https://tbzepahgztyjrnknpfqh.supabase.co";
  const defaultKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiemVwYWhnenR5anJua25wZnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjcxNjYsImV4cCI6MjA5OTg0MjcwOX0.Jq87AWN9Hq-kABasG2TM4qc_ZTJXKqSH16BuHL9yEV4";

  // @ts-ignore
  const envUrl = import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.SUPABASE_URL || (typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL) : '') || '';
  // @ts-ignore
  const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY) : '') || '';
  
  let localUrl = '';
  let localKey = '';
  try {
    localUrl = localStorage.getItem('ea_supabase_url') || '';
    localKey = localStorage.getItem('ea_supabase_anon_key') || '';
    
    // Automatically clear stale/paused old Supabase projects from localStorage
    if (localUrl && (localUrl.includes('tigcnyawfhcxcdjqdfaf') || localUrl.trim() === '')) {
      localStorage.removeItem('ea_supabase_url');
      localStorage.removeItem('ea_supabase_anon_key');
      localUrl = '';
      localKey = '';
    }
  } catch (e) {
    console.warn('Failed to access localStorage:', e);
  }

  const url = localUrl || envUrl || defaultUrl;
  const key = localKey || envKey || defaultKey;

  return {
    url,
    key,
    isConfigured: !!url && !!key,
    source: (localUrl || localKey) ? 'localStorage' : (envUrl || envKey) ? 'env' : 'default'
  };
}

let supabaseClientInstance: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    supabaseClientInstance = null;
    currentClientUrl = '';
    currentClientKey = '';
    return null;
  }
  
  // Re-create client if credentials changed or client is not yet created
  if (!supabaseClientInstance || supabaseClientInstance.auth === undefined || url !== currentClientUrl || key !== currentClientKey) {
    try {
      supabaseClientInstance = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      currentClientUrl = url;
      currentClientKey = key;
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
      supabaseClientInstance = null;
      currentClientUrl = '';
      currentClientKey = '';
    }
  }
  return supabaseClientInstance;
}

// SQL Script for setting up tables in Supabase Console
export const SUPABASE_SQL_REPAIR = `-- DATABASE SYNC REPAIR SCRIPT (MIGRATION)
-- Execute this SQL script in your Supabase SQL Editor to add missing columns and reload the schema cache.

-- 1. Fix ea_config table columns and types
-- Force convert ID column from UUID to VARCHAR if needed
ALTER TABLE public.ea_config ALTER COLUMN id TYPE VARCHAR;
ALTER TABLE public.ea_config ALTER COLUMN id SET DEFAULT 'global_config';
UPDATE public.ea_config SET id = 'global_config' WHERE id IS NOT NULL AND id <> 'global_config';

ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_name VARCHAR DEFAULT 'Eastfield Academy';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_year VARCHAR DEFAULT '2025/2026';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS term VARCHAR DEFAULT 'Term 1';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS principal_name VARCHAR DEFAULT 'Dr. Evelyn Asare-Bediako';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS principal_signature_url VARCHAR;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_logo_text VARCHAR DEFAULT 'EA';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_logo_url VARCHAR;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS class_score_weight INTEGER DEFAULT 50;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS exam_score_weight INTEGER DEFAULT 50;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS grading_scale JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS report_template VARCHAR DEFAULT 'dynamic';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS reopening_date VARCHAR DEFAULT '2026-09-15';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS last_promoted_year VARCHAR;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS auto_promote_on_reopening BOOLEAN DEFAULT true;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_motto VARCHAR DEFAULT 'Knowledge, Character & Excellence';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS custom_notice_note TEXT;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS show_position_in_class BOOLEAN DEFAULT true;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS show_conduct_column BOOLEAN DEFAULT true;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS show_attendance_section BOOLEAN DEFAULT true;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS accent_color VARCHAR DEFAULT '#1e1b4b';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS watermark_text VARCHAR DEFAULT 'EASTFIELD ACADEMY';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Fix ea_students table columns
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS name VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS roll_number VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'PRIMARY';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS class_name VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS guardian_name VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS guardian_email VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Fix ea_teachers table columns
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS name VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS email VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'TEACHER';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS password VARCHAR;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'PRIMARY';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS classes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS phone_number VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS qualification VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS profile_picture TEXT DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS hometown VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS ghana_card_number VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 4. Fix ea_grades table columns
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS student_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS subject_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS class_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS exam_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS total_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS grade_letter VARCHAR DEFAULT 'F';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS remarks VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS nursery_remark VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS term VARCHAR DEFAULT 'Term 1';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS year VARCHAR DEFAULT '2025/2026';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS teacher_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 5. Fix ea_attendance table columns
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS student_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS term VARCHAR DEFAULT 'Term 1';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS year VARCHAR DEFAULT '2025/2026';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 0;
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS days_present INTEGER DEFAULT 0;
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS remarks VARCHAR DEFAULT '';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS teacher_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 6. Create / Fix ea_bills table columns for per-student bills
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS arrears VARCHAR DEFAULT '0.00';
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS tuition VARCHAR DEFAULT '0.00';
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS computing VARCHAR DEFAULT '0.00';
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS utility VARCHAR DEFAULT '0.00';
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS stationery VARCHAR DEFAULT '0.00';
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS pta VARCHAR DEFAULT '0.00';
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS reopening_date VARCHAR;
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS contact_number VARCHAR;
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS term VARCHAR DEFAULT 'Term 1';
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS year VARCHAR DEFAULT '2025/2026';
ALTER TABLE public.ea_bills ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 7. Create / Fix Additional Tables for Global Synchronisation (Fee Payments, Fee Structures, Daily Collections, Sync Logs)
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
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR;
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS student_id VARCHAR;
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS student_name VARCHAR;
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS class_name VARCHAR;
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS fee_type VARCHAR;
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS total_fee_amount NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS payment_method VARCHAR DEFAULT 'Cash';
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS payment_date VARCHAR;
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'Paid';
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS remarks VARCHAR DEFAULT '';
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS recorded_by VARCHAR DEFAULT 'Admin';
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.ea_fee_payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

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
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS level VARCHAR;
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS tuition NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS computing NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS utility NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS stationery NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS pta NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS uniform NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS mock_exam NUMERIC DEFAULT 0;
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS term VARCHAR DEFAULT 'Term 1';
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS year VARCHAR DEFAULT '2025/2026';
ALTER TABLE public.ea_fee_structures ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

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
ALTER TABLE public.ea_daily_collections ADD COLUMN IF NOT EXISTS collection_date VARCHAR;
ALTER TABLE public.ea_daily_collections ADD COLUMN IF NOT EXISTS total_cash NUMERIC DEFAULT 0;
ALTER TABLE public.ea_daily_collections ADD COLUMN IF NOT EXISTS total_momo NUMERIC DEFAULT 0;
ALTER TABLE public.ea_daily_collections ADD COLUMN IF NOT EXISTS total_bank NUMERIC DEFAULT 0;
ALTER TABLE public.ea_daily_collections ADD COLUMN IF NOT EXISTS total_cheque NUMERIC DEFAULT 0;
ALTER TABLE public.ea_daily_collections ADD COLUMN IF NOT EXISTS total_collected NUMERIC DEFAULT 0;
ALTER TABLE public.ea_daily_collections ADD COLUMN IF NOT EXISTS recorded_by VARCHAR DEFAULT 'Admin';
ALTER TABLE public.ea_daily_collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

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
ALTER TABLE public.ea_sync_logs ADD COLUMN IF NOT EXISTS action_type VARCHAR;
ALTER TABLE public.ea_sync_logs ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.ea_sync_logs ADD COLUMN IF NOT EXISTS performed_by VARCHAR DEFAULT 'System';
ALTER TABLE public.ea_sync_logs ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'SUCCESS';
ALTER TABLE public.ea_sync_logs ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.ea_sync_logs ADD COLUMN IF NOT EXISTS timestamp VARCHAR;
ALTER TABLE public.ea_sync_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

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
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS location_name VARCHAR;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT 'Classroom';
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS student_chairs INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS student_tables INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS textbooks INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS washrooms INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS sinks INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS buses INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS teacher_chairs INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS teacher_tables INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS computers INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS projectors INTEGER DEFAULT 0;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS custom_items TEXT;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.ea_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

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
ALTER TABLE public.ea_jhs_mock_exams DISABLE ROW LEVEL SECURITY;

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
ALTER TABLE public.ea_book_stock DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.ea_book_sales (
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
ALTER TABLE public.ea_book_sales DISABLE ROW LEVEL SECURITY;

-- 8. Disable Row Level Security (RLS) on all tables to ensure public frontend sync operates correctly
ALTER TABLE public.ea_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_fee_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_fee_structures DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_daily_collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_sync_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_book_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_book_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_deleted_records DISABLE ROW LEVEL SECURITY;

-- 9. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`;

export const SUPABASE_SQL_SCHEMA = `-- ==============================================================================
-- OPTIONAL: NUKE AND RECREATE OPTION
-- If you want a complete clean slate (recommended if your existing tables are corrupt
-- or mismatched), uncomment the lines below to drop the old tables before creating them.
-- WARNING: This will delete existing database rows. You can back up your local data
-- first and push it to the fresh database afterward using the "Manual Push Backup"
-- button in the Admin Dashboard credentials panel.
-- ==============================================================================
-- DROP TABLE IF EXISTS public.ea_config CASCADE;
-- DROP TABLE IF EXISTS public.ea_students CASCADE;
-- DROP TABLE IF EXISTS public.ea_teachers CASCADE;
-- DROP TABLE IF EXISTS public.ea_grades CASCADE;
-- DROP TABLE IF EXISTS public.ea_attendance CASCADE;
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

-- 2. Create Pupils/Students Table
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

-- 3. Create Teachers Table
CREATE TABLE IF NOT EXISTS public.ea_teachers (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  email VARCHAR NOT NULL,
  role VARCHAR NOT NULL DEFAULT 'TEACHER',
  password VARCHAR,
  level VARCHAR,
  subjects JSONB,
  classes JSONB,
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
  teacher_id VARCHAR NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (student_id, subject_id, term, year)
);

-- 5. Create Attendance Table
CREATE TABLE IF NOT EXISTS public.ea_attendance (
  student_id VARCHAR NOT NULL,
  term VARCHAR NOT NULL DEFAULT 'Term 1',
  year VARCHAR NOT NULL DEFAULT '2025/2026',
  total_days INTEGER NOT NULL DEFAULT 0,
  days_present INTEGER NOT NULL DEFAULT 0,
  remarks VARCHAR NOT NULL DEFAULT '',
  teacher_id VARCHAR NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (student_id, term, year)
);

-- 6. Create Student Bills Table
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

-- 7. Create Additional Tables (Fee Payments, Fee Structures, Daily Collections, Sync Logs)
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

-- 12. Create Deleted Records / Tombstone Table (for permanent sync across all sessions & devices)
CREATE TABLE IF NOT EXISTS public.ea_deleted_records (
  id VARCHAR PRIMARY KEY,
  record_type VARCHAR NOT NULL,
  record_id VARCHAR NOT NULL,
  roll_number VARCHAR,
  name VARCHAR,
  details JSONB DEFAULT '{}'::jsonb,
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist on older tables in case "IF NOT EXISTS" table creation was skipped
-- A. Fix ea_config table columns
ALTER TABLE public.ea_config ALTER COLUMN id TYPE VARCHAR;
ALTER TABLE public.ea_config ALTER COLUMN id SET DEFAULT 'global_config';
UPDATE public.ea_config SET id = 'global_config' WHERE id IS NOT NULL AND id <> 'global_config';

ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_name VARCHAR DEFAULT 'Eastfield Academy';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_year VARCHAR DEFAULT '2025/2026';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS term VARCHAR DEFAULT 'Term 1';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS principal_name VARCHAR DEFAULT 'Dr. Evelyn Asare-Bediako';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS principal_signature_url VARCHAR;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_logo_text VARCHAR DEFAULT 'EA';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_logo_url VARCHAR;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS class_score_weight INTEGER DEFAULT 50;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS exam_score_weight INTEGER DEFAULT 50;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS grading_scale JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS report_template VARCHAR DEFAULT 'dynamic';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS reopening_date VARCHAR DEFAULT '2026-09-15';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS last_promoted_year VARCHAR;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS auto_promote_on_reopening BOOLEAN DEFAULT true;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS school_motto VARCHAR DEFAULT 'Knowledge, Character & Excellence';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS custom_notice_note TEXT;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS show_position_in_class BOOLEAN DEFAULT true;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS show_conduct_column BOOLEAN DEFAULT true;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS show_attendance_section BOOLEAN DEFAULT true;
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS accent_color VARCHAR DEFAULT '#1e1b4b';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS watermark_text VARCHAR DEFAULT 'EASTFIELD ACADEMY';
ALTER TABLE public.ea_config ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- B. Fix ea_students table columns
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS name VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS roll_number VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'PRIMARY';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS class_name VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS guardian_name VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS guardian_email VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- C. Fix ea_teachers table columns
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS name VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS email VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'TEACHER';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS password VARCHAR;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'PRIMARY';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS classes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- D. Fix ea_grades table columns
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS student_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS subject_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS class_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS exam_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS total_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS grade_letter VARCHAR DEFAULT 'F';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS remarks VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS nursery_remark VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS term VARCHAR DEFAULT 'Term 1';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS year VARCHAR DEFAULT '2025/2026';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS teacher_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- E. Fix ea_attendance table columns
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS student_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS term VARCHAR DEFAULT 'Term 1';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS year VARCHAR DEFAULT '2025/2026';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 0;
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS days_present INTEGER DEFAULT 0;
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS remarks VARCHAR DEFAULT '';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS teacher_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Enable Realtime for all tables if needed (Optional)
-- Wrap in a DO block to prevent "relation already member of publication" errors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_config'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_config;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_students;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_teachers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_teachers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_grades'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_grades;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_attendance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_attendance;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore if publication doesn't exist or other issues occur
    NULL;
END $$;

-- 6. Storage Bucket & Policies Setup
-- Create the public bucket if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('ea', 'ea', true)
ON CONFLICT (id) DO NOTHING;

-- Policy 1: Allow Public Read Access (everyone can view/download images/files in 'ea')
DROP POLICY IF EXISTS "Allow public read access on ea bucket" ON storage.objects;
CREATE POLICY "Allow public read access on ea bucket"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'ea');

-- Policy 2: Allow Authenticated Users (Admins and Teachers) to upload/insert files
DROP POLICY IF EXISTS "Allow authenticated users to upload files" ON storage.objects;
CREATE POLICY "Allow authenticated users to upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ea');

-- Policy 3: Allow Authenticated Users to update files
DROP POLICY IF EXISTS "Allow authenticated users to update files" ON storage.objects;
CREATE POLICY "Allow authenticated users to update files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'ea')
WITH CHECK (bucket_id = 'ea');

-- Policy 4: Allow Authenticated Users to delete files
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;
CREATE POLICY "Allow authenticated users to delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ea');

-- Option C: Folder-Level Security (Strict Auth Folder segregation for authenticated users)
-- Uncomment these if you want users to ONLY be able to modify files within their own folder named after their User ID.
-- Note: Make sure any file uploads prefix the path with the user's authenticated ID.
-- 
-- DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
-- CREATE POLICY "Users can upload to own folder"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (
--   bucket_id = 'ea'
--   AND name LIKE (auth.uid()::text || '/%')
-- );
-- 
-- DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
-- CREATE POLICY "Users can update own files"
-- ON storage.objects FOR UPDATE
-- TO authenticated
-- USING (
--   bucket_id = 'ea'
--   AND name LIKE (auth.uid()::text || '/%')
-- );
-- 
-- DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
-- CREATE POLICY "Users can delete own files"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING (
--   bucket_id = 'ea'
--   AND name LIKE (auth.uid()::text || '/%')
-- );
-- 
-- DROP POLICY IF EXISTS "Allow anyone to upload logos" ON storage.objects;
-- CREATE POLICY "Allow anyone to upload logos"
-- ON storage.objects FOR INSERT
-- TO public
-- WITH CHECK (
--   bucket_id = 'ea'
--   AND name LIKE 'logos/%'
-- );

-- Policy 5 (Fallback/Demo/Testing): Allow public/anonymous uploads & updates during local development or testing phase
DROP POLICY IF EXISTS "Allow public uploads for testing" ON storage.objects;
CREATE POLICY "Allow public uploads for testing"
ON storage.objects
FOR INSERT
TO anon, authenticated, public
WITH CHECK (bucket_id = 'ea');

DROP POLICY IF EXISTS "Allow public updates for testing" ON storage.objects;
CREATE POLICY "Allow public updates for testing"
ON storage.objects
FOR UPDATE
TO anon, authenticated, public
USING (bucket_id = 'ea')
WITH CHECK (bucket_id = 'ea');

DROP POLICY IF EXISTS "Allow public deletes for testing" ON storage.objects;
CREATE POLICY "Allow public deletes for testing"
ON storage.objects
FOR DELETE
TO anon, authenticated, public
USING (bucket_id = 'ea');

-- 7. Row Level Security (RLS) & Policies for all ea_* Tables
-- Newer Supabase projects automatically enable RLS by default on newly created tables.
-- To allow your frontend app to synchronize data, you MUST either disable RLS or add public policies.

-- OPTION A: Disable RLS on all tables (Simplest & Recommended for offline-sync app design)
ALTER TABLE public.ea_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_fee_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_fee_structures DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_daily_collections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_sync_logs DISABLE ROW LEVEL SECURITY;

-- OPTION B: Unrestricted policies (Ensure DELETE/INSERT/UPDATE/SELECT work even if RLS is enabled)
DROP POLICY IF EXISTS "Allow public access on ea_config" ON public.ea_config;
CREATE POLICY "Allow public access on ea_config" ON public.ea_config FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_students" ON public.ea_students;
CREATE POLICY "Allow public access on ea_students" ON public.ea_students FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_teachers" ON public.ea_teachers;
CREATE POLICY "Allow public access on ea_teachers" ON public.ea_teachers FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_grades" ON public.ea_grades;
CREATE POLICY "Allow public access on ea_grades" ON public.ea_grades FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_attendance" ON public.ea_attendance;
CREATE POLICY "Allow public access on ea_attendance" ON public.ea_attendance FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_bills" ON public.ea_bills;
CREATE POLICY "Allow public access on ea_bills" ON public.ea_bills FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_fee_payments" ON public.ea_fee_payments;
CREATE POLICY "Allow public access on ea_fee_payments" ON public.ea_fee_payments FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_fee_structures" ON public.ea_fee_structures;
CREATE POLICY "Allow public access on ea_fee_structures" ON public.ea_fee_structures FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_daily_collections" ON public.ea_daily_collections;
CREATE POLICY "Allow public access on ea_daily_collections" ON public.ea_daily_collections FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access on ea_sync_logs" ON public.ea_sync_logs;
CREATE POLICY "Allow public access on ea_sync_logs" ON public.ea_sync_logs FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

-- 8. Automated Sync Trigger for Registered Users (Solves syntax errors like 'ERROR: 42601')
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  IF (new.raw_user_meta_data->>'role' = 'TEACHER') THEN
    INSERT INTO public.ea_teachers (id, name, email, role, level, classes, subjects, password, updated_at)
    VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'name', 'New Teacher'),
      new.email,
      'TEACHER',
      new.raw_user_meta_data->>'level',
      COALESCE((new.raw_user_meta_data->'classes')::jsonb, '[]'::jsonb),
      COALESCE((new.raw_user_meta_data->'subjects')::jsonb, '[]'::jsonb),
      new.raw_user_meta_data->>'password',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      level = EXCLUDED.level,
      classes = EXCLUDED.classes,
      subjects = EXCLUDED.subjects,
      password = EXCLUDED.password,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`;

// Helper to verify connection by doing a simple query
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase is not configured yet.' };
  }
  try {
    const { error } = await client.from('ea_config').select('id').limit(1);
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "public.ea_config" does not exist')) {
        return { 
          success: true, 
          message: 'Connected to Supabase, but schema tables are missing! Please click "Execute Setup Script" or run the SQL schema in your Supabase SQL editor.' 
        };
      }
      if (isMissingTableOrConnectionError(error)) {
        return { success: false, message: 'Supabase cloud endpoint is unreachable. Local offline storage is active.' };
      }
      return { success: false, message: `Supabase Error: ${error.message} (Code ${error.code})` };
    }
    return { success: true, message: 'Successfully connected and verified database tables!' };
  } catch (err: any) {
    return { success: false, message: 'Supabase cloud endpoint is unreachable. Local offline storage is active.' };
  }
}

// Helper to perform upserts that dynamically heal when columns are missing from the database schema cache
async function safeUpsert(table: string, payload: any, client: SupabaseClient, onConflict?: string): Promise<{ data: any; error: any }> {
  let currentPayload = JSON.parse(JSON.stringify(payload));
  let attempts = 0;
  const maxAttempts = 15; // safety limit to prevent infinite loops

  try {
    while (attempts < maxAttempts) {
      const upsertOptions = onConflict ? { onConflict } : undefined;
      const { data, error } = await client.from(table).upsert(currentPayload, upsertOptions);
      if (!error) {
        return { data, error: null };
      }

      // Check if it's a missing column error (PGRST204)
      if (error.code === 'PGRST204' || error.message?.includes('schema cache') || error.message?.includes('column')) {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1]) {
          const missingColumn = match[1];
          console.warn(`[Supabase SafeUpsert] Column '${missingColumn}' is missing from table '${table}'. Dynamic healing active - omitting column and retrying.`);
          
          // Remove the missing column from payload
          if (Array.isArray(currentPayload)) {
            currentPayload = currentPayload.map(item => {
              const newItem = { ...item };
              delete newItem[missingColumn];
              return newItem;
            });
          } else {
            delete currentPayload[missingColumn];
          }
          attempts++;
          continue;
        }
      }
      
      // For other errors, return them
      return { data: null, error };
    }
    return { data: null, error: { message: 'Max healing attempts reached', code: 'HEALING_FAILED' } };
  } catch (err: any) {
    console.warn(`[Supabase SafeUpsert] Network or fetch exception on table ${table}:`, err);
    return { data: null, error: { message: err?.message || 'Failed to fetch', code: 'NETWORK_ERROR' } };
  }
}

// Helper to check if database table is missing or network/fetch connection failed
function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = error.code || '';
  const message = error.message || (typeof error === 'string' ? error : (error.stack || JSON.stringify(error)));
  return code === 'PGRST205' || code === '42P01' || message.includes('does not exist') || message.includes('schema cache') || message.includes('not found');
}

function isMissingTableOrConnectionError(error: any): boolean {
  if (!error) return false;
  const code = error.code || '';
  const message = error.message || (typeof error === 'string' ? error : (error.stack || JSON.stringify(error)));
  return (
    isMissingTableError(error) ||
    code === 'TypeError' ||
    code === 'NETWORK_ERROR' ||
    message.includes('Failed to fetch') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('Network') ||
    message.includes('fetch') ||
    message.includes('Failed to connect') ||
    message.includes('URL and Anon Key') ||
    message.includes('unreachable')
  );
}

// Helper to convert database errors into beautiful, human-friendly messages
function handleDatabaseError(error: any, contextMessage: string): Error {
  if (!error) return new Error(`An unknown database error occurred during ${contextMessage}.`);
  
  // If it is already a friendly converted Error object, return it directly
  if (error instanceof Error && (error.message.includes('missing on your Supabase project') || error.message.includes('type constraint mismatch') || error.message.includes('Connection Error'))) {
    return error;
  }

  const code = error.code || '';
  const originalMessage = error.message || (typeof error === 'string' ? error : (error.stack || JSON.stringify(error)));
  
  // Table missing or relation missing (PGRST205 or 42P01)
  if (code === 'PGRST205' || code === '42P01' || originalMessage.includes('does not exist') || originalMessage.includes('schema cache') || originalMessage.includes('not found')) {
    return new Error(
      `Database tables are missing on your Supabase project (Code: PGRST205). ` +
      `Please navigate to the Admin Dashboard (Credentials Panel), copy the "SUPABASE SCHEMA SETUP SCRIPT (SQL)", ` +
      `and run it in your Supabase SQL Editor to create the required tables.`
    );
  }
  
  // UUID or type mismatch (22P02)
  if (code === '22P02' || originalMessage.includes('invalid input syntax for type uuid')) {
    return new Error(
      `Database schema type constraint mismatch (Code: 22P02). ` +
      `Please run the "Database Sync Repair Script" in your Supabase SQL Editor to alter the table structure and fix table column types.`
    );
  }
  
  // Connection / Network issues
  if (originalMessage.includes('Failed to fetch') || originalMessage.includes('network') || code === 'TypeError' || originalMessage.includes('fetch')) {
    return new Error(
      `Failed to connect to Supabase (TypeError: Failed to fetch). Your Supabase project might be paused, ` +
      `or the URL and Anon Key are incorrect. Please verify your credentials in the Admin Dashboard.`
    );
  }
  
  return new Error(`Database error details: ${originalMessage} (Code: ${code})`);
}

// 1. SYNC CONFIG
export async function fetchSupabaseConfig(): Promise<ReportConfig | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    // 1. Query most recently updated config row
    const { data: rows, error: selectErr } = await client
      .from('ea_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1);

    let data = rows && rows.length > 0 ? rows[0] : null;

    if (!data) {
      // Fallback query without ordering
      const { data: fallbackRows } = await client.from('ea_config').select('*').limit(1);
      if (fallbackRows && fallbackRows.length > 0) {
        data = fallbackRows[0];
      }
    }

    if (!data) {
      if (selectErr && isMissingTableOrConnectionError(selectErr)) {
        const cached = localStorage.getItem('mock_supabase_ea_config') || localStorage.getItem('ea_config');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }

    return {
      schoolName: data.school_name || 'Eastfield Academy',
      schoolYear: data.school_year || '2025/2026',
      term: data.term || 'Term 1',
      principalName: data.principal_name || 'Dr. Evelyn Asare-Bediako',
      principalSignatureUrl: data.principal_signature_url || undefined,
      schoolLogoText: data.school_logo_text || 'EA',
      schoolLogoUrl: data.school_logo_url || undefined,
      classScoreWeight: data.class_score_weight !== undefined && data.class_score_weight !== null ? data.class_score_weight : 50,
      examScoreWeight: data.exam_score_weight !== undefined && data.exam_score_weight !== null ? data.exam_score_weight : 50,
      gradingScale: data.grading_scale || [],
      selectedTemplate: data.report_template || 'dynamic',
      reopeningDate: data.reopening_date || undefined,
      lastPromotedYear: data.last_promoted_year || undefined,
      promotionUndoneYear: data.promotion_undone_year || undefined,
      prePromotionSnapshot: data.pre_promotion_snapshot || undefined,
      autoPromoteOnReopening: data.auto_promote_on_reopening !== undefined ? data.auto_promote_on_reopening : true,
      schoolMotto: data.school_motto || 'Knowledge, Character & Excellence',
      customNoticeNote: data.custom_notice_note || undefined,
      showPositionInClass: data.show_position_in_class !== undefined ? data.show_position_in_class : true,
      showConductColumn: data.show_conduct_column !== undefined ? data.show_conduct_column : true,
      showAttendanceSection: data.show_attendance_section !== undefined ? data.show_attendance_section : true,
      accentColor: data.accent_color || '#1e1b4b',
      watermarkText: data.watermark_text || undefined,
      updatedAt: data.updated_at || undefined
    };
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_config') || localStorage.getItem('ea_config');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }
}

export async function saveSupabaseConfig(config: ReportConfig): Promise<boolean> {
  const updatedIso = config.updatedAt || new Date().toISOString();
  const configWithTimestamp = { ...config, updatedAt: updatedIso };

  // Always persist to local storage immediately
  localStorage.setItem('mock_supabase_ea_config', JSON.stringify(configWithTimestamp));
  localStorage.setItem('ea_config', JSON.stringify(configWithTimestamp));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    // Preserve existing row's ID if present to update in place
    let targetId: string = 'global_config';
    const { data: existingRows } = await client
      .from('ea_config')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (existingRows && existingRows.length > 0 && existingRows[0].id) {
      targetId = existingRows[0].id;
    }

    const payload = {
      id: targetId,
      school_name: config.schoolName,
      school_year: config.schoolYear,
      term: config.term,
      principal_name: config.principalName,
      principal_signature_url: config.principalSignatureUrl || null,
      school_logo_text: config.schoolLogoText || null,
      school_logo_url: config.schoolLogoUrl || null,
      class_score_weight: config.classScoreWeight,
      exam_score_weight: config.examScoreWeight,
      grading_scale: config.gradingScale,
      report_template: config.selectedTemplate || 'dynamic',
      reopening_date: config.reopeningDate || null,
      last_promoted_year: config.lastPromotedYear || null,
      promotion_undone_year: config.promotionUndoneYear || null,
      pre_promotion_snapshot: config.prePromotionSnapshot || null,
      auto_promote_on_reopening: config.autoPromoteOnReopening !== undefined ? config.autoPromoteOnReopening : true,
      school_motto: config.schoolMotto || null,
      custom_notice_note: config.customNoticeNote || null,
      show_position_in_class: config.showPositionInClass !== undefined ? config.showPositionInClass : true,
      show_conduct_column: config.showConductColumn !== undefined ? config.showConductColumn : true,
      show_attendance_section: config.showAttendanceSection !== undefined ? config.showAttendanceSection : true,
      accent_color: config.accentColor || null,
      watermark_text: config.watermarkText || null,
      updated_at: new Date().toISOString()
    };
    let { error } = await safeUpsert('ea_config', payload, client);
    if (error && (error.code === '22P02' || error.message?.includes('invalid input syntax for type uuid'))) {
      // Fallback if ID column has a UUID type constraint in the database
      const uuidPayload = { ...payload, id: '00000000-0000-0000-0000-000000000000' };
      const retryRes = await safeUpsert('ea_config', uuidPayload, client);
      error = retryRes.error;
    }
    if (error) {
      console.warn('saveSupabaseConfig error:', error);
      if (isMissingTableOrConnectionError(error)) {
        localStorage.setItem('mock_supabase_ea_config', JSON.stringify(config));
        return true;
      }
      return false;
    }
    return true;
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      localStorage.setItem('mock_supabase_ea_config', JSON.stringify(config));
      return true;
    }
    localStorage.setItem('mock_supabase_ea_config', JSON.stringify(config));
    return true;
  }
}

// Helper to track deleted student IDs and identifiers in localStorage
export function getDeletedStudentIds(): string[] {
  try {
    const saved = localStorage.getItem('ea_deleted_student_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function recordDeletedStudentId(id: string, rollNumber?: string, studentName?: string): void {
  if (!id && !rollNumber && !studentName) return;
  try {
    const current = getDeletedStudentIds();
    const toAdd: string[] = [];
    if (id) toAdd.push(id.trim());
    if (rollNumber) {
      const r = rollNumber.trim();
      toAdd.push(r);
      const cleanR = r.replace(/[^A-Za-z0-9]/g, '');
      if (cleanR) toAdd.push(cleanR);
    }
    if (studentName) {
      const n = studentName.trim().toLowerCase();
      if (n) toAdd.push(n);
    }
    const currentLower = new Set(current.map(x => String(x).toLowerCase().trim()));
    const newItems = toAdd.filter(x => !currentLower.has(x.toLowerCase().trim()));
    if (newItems.length > 0) {
      localStorage.setItem('ea_deleted_student_ids', JSON.stringify([...current, ...newItems]));
    }
  } catch (e) {}
}

export function isStudentDeleted(student?: { id?: string; rollNumber?: string; name?: string } | null): boolean {
  if (!student) return false;
  const deleted = getDeletedStudentIds();
  if (deleted.length === 0) return false;
  const deletedSet = new Set(deleted.map(x => String(x).toLowerCase().trim()));
  
  if (student.id && deletedSet.has(student.id.toLowerCase().trim())) return true;
  if (student.rollNumber) {
    const r = student.rollNumber.toLowerCase().trim();
    const cleanR = r.replace(/[^a-z0-9]/g, '');
    if (deletedSet.has(r) || (cleanR && deletedSet.has(cleanR))) return true;
  }
  if (student.name) {
    const n = student.name.toLowerCase().trim();
    if (deletedSet.has(n)) return true;
  }
  return false;
}

export function removeDeletedStudentId(id: string): void {
  if (!id) return;
  try {
    const current = getDeletedStudentIds();
    const idLower = id.toLowerCase().trim();
    const filtered = current.filter(item => item.toLowerCase().trim() !== idLower);
    localStorage.setItem('ea_deleted_student_ids', JSON.stringify(filtered));
  } catch (e) {}
}

// Helper to track deleted teacher IDs in localStorage
export function getDeletedTeacherIds(): string[] {
  try {
    const saved = localStorage.getItem('ea_deleted_teacher_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function recordDeletedTeacherId(id: string, email?: string, name?: string): void {
  if (!id && !email && !name) return;
  try {
    const current = getDeletedTeacherIds();
    const toAdd: string[] = [];
    if (id) toAdd.push(id.trim());
    if (email) toAdd.push(email.trim().toLowerCase());
    if (name) toAdd.push(name.trim().toLowerCase());
    const currentLower = new Set(current.map(x => String(x).toLowerCase().trim()));
    const newItems = toAdd.filter(x => !currentLower.has(x.toLowerCase().trim()));
    if (newItems.length > 0) {
      localStorage.setItem('ea_deleted_teacher_ids', JSON.stringify([...current, ...newItems]));
    }
  } catch (e) {}
}

export function removeDeletedTeacherId(id: string): void {
  if (!id) return;
  try {
    const current = getDeletedTeacherIds();
    const idLower = id.toLowerCase().trim();
    const filtered = current.filter(item => item.toLowerCase().trim() !== idLower);
    localStorage.setItem('ea_deleted_teacher_ids', JSON.stringify(filtered));
  } catch (e) {}
}

// 2. SYNC STUDENTS
export async function fetchSupabaseStudents(): Promise<Student[] | null> {
  const filterDeleted = (list: Student[]) => {
    return list.filter(s => !isStudentDeleted(s));
  };

  const client = getSupabaseClient();
  if (!client) {
    const cached = localStorage.getItem('mock_supabase_ea_students') || localStorage.getItem('ea_students');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return filterDeleted(parsed);
      } catch (e) {}
    }
    return null;
  }
  try {
    // 1. Sync remote tombstones from ea_deleted_records and ea_sync_logs to ensure global deletion propagation
    try {
      const { data: delRecords } = await client
        .from('ea_deleted_records')
        .select('*')
        .eq('record_type', 'STUDENT')
        .order('deleted_at', { ascending: false })
        .limit(200);
      if (delRecords && Array.isArray(delRecords)) {
        delRecords.forEach((row: any) => {
          const details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
          recordDeletedStudentId(row.record_id || details.id, row.roll_number || details.rollNumber, row.name || details.studentName);
        });
      }
    } catch (delErr) {}

    try {
      const { data: logs } = await client
        .from('ea_sync_logs')
        .select('*')
        .eq('action_type', 'DELETE_STUDENT')
        .order('timestamp', { ascending: false })
        .limit(200);
      if (logs && Array.isArray(logs)) {
        logs.forEach((log: any) => {
          const details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
          const id = details.id || details.studentId;
          const rollNumber = details.rollNumber;
          const studentName = details.studentName || details.name;
          recordDeletedStudentId(id, rollNumber, studentName);
        });
      }
    } catch (logErr) {}

    const { data, error } = await client.from('ea_students').select('*');
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_students') || localStorage.getItem('ea_students');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return filterDeleted(parsed);
          } catch (e) {}
        }
        return null;
      }
      return null;
    }
    if (!data) return null;
    const mapped = data.map(item => ({
      id: item.id,
      name: item.name || '',
      rollNumber: item.roll_number || '',
      level: item.level || 'PRIMARY',
      className: item.class_name || '',
      guardianName: item.guardian_name || '',
      guardianEmail: item.guardian_email || '',
      guardianPhone: item.guardian_phone || '',
      photoUrl: item.photo_url || '',
    }));

    // If Supabase returned records that are marked deleted in tombstone registry, purge them from remote DB in background
    const recordsToPurge = mapped.filter(s => isStudentDeleted(s));
    if (recordsToPurge.length > 0) {
      for (const st of recordsToPurge) {
        deleteSupabaseStudent(st.id, st.rollNumber, st.name).catch(() => {});
      }
    }

    return filterDeleted(mapped);
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_students') || localStorage.getItem('ea_students');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return filterDeleted(parsed);
        } catch (e) {}
      }
    }
    return null;
  }
}

export async function saveSupabaseStudents(students: Student[]): Promise<boolean> {
  // Filter out any students that have been marked deleted
  const validStudents = students.filter(s => !isStudentDeleted(s));

  // Always persist to local cache immediately to guarantee offline/local persistence
  localStorage.setItem('mock_supabase_ea_students', JSON.stringify(validStudents));
  localStorage.setItem('ea_students', JSON.stringify(validStudents));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = validStudents.map(s => ({
      id: s.id,
      name: s.name,
      roll_number: s.rollNumber,
      level: s.level,
      class_name: s.className,
      guardian_name: s.guardianName,
      guardian_email: s.guardianEmail,
      guardian_phone: s.guardianPhone || '',
      photo_url: s.photoUrl || '',
      updated_at: new Date().toISOString()
    }));
    let { error } = await safeUpsert('ea_students', payloads, client);
    if (error && (error.message?.includes('photo_url') || error.message?.includes('guardian_phone') || error.code === '42703')) {
      console.warn('Supabase ea_students table missing photo_url/guardian_phone column. Retrying without new columns until SQL migration is run.');
      const legacyPayloads = validStudents.map(s => ({
        id: s.id,
        name: s.name,
        roll_number: s.rollNumber,
        level: s.level,
        class_name: s.className,
        guardian_name: s.guardianName,
        guardian_email: s.guardianEmail,
        updated_at: new Date().toISOString()
      }));
      const retryRes = await safeUpsert('ea_students', legacyPayloads, client);
      error = retryRes.error;
    }
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        return true;
      }
      return false;
    }
    
    // Prune deleted students safely
    try {
      if (validStudents.length === 0) {
        await client.from('ea_grades').delete().not('id', 'is', null);
        await client.from('ea_attendance').delete().not('id', 'is', null);
        await client.from('ea_bills').delete().not('id', 'is', null);
        await client.from('ea_fee_payments').delete().not('id', 'is', null);
        await client.from('ea_jhs_mock_exams').delete().not('id', 'is', null);
        await client.from('ea_students').delete().not('id', 'is', null);
      } else {
        const { data: existingRows } = await client.from('ea_students').select('id, roll_number, name');
        const activeIds = new Set(validStudents.map(s => String(s.id)));
        const activeRolls = new Set(validStudents.map(s => (s.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean));
        const activeNames = new Set(validStudents.map(s => (s.name || '').toLowerCase().trim()).filter(Boolean));
        const tombstoneIds = getDeletedStudentIds().filter(Boolean);
        
        let toDeleteIds: string[] = [];
        if (existingRows && existingRows.length > 0) {
          toDeleteIds = existingRows
            .filter(row => {
              if (activeIds.has(String(row.id))) return false;
              const r = (row.roll_number || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
              if (r && activeRolls.has(r)) return false;
              const n = (row.name || '').toLowerCase().trim();
              if (n && activeNames.has(n)) return false;
              return true;
            })
            .map(row => row.id)
            .filter(Boolean);
        }
        const combinedDeleteIds = Array.from(new Set([...toDeleteIds, ...tombstoneIds]));
        for (let i = 0; i < combinedDeleteIds.length; i += 25) {
          const chunk = combinedDeleteIds.slice(i, i + 25);
          await client.from('ea_grades').delete().in('student_id', chunk);
          await client.from('ea_attendance').delete().in('student_id', chunk);
          await client.from('ea_bills').delete().in('student_id', chunk);
          await client.from('ea_fee_payments').delete().in('student_id', chunk);
          await client.from('ea_jhs_mock_exams').delete().in('student_id', chunk);
          await client.from('ea_students').delete().in('id', chunk);
        }
      }
    } catch (pruneErr) {
      console.warn('Student prune notice:', pruneErr);
    }

    return true;
  } catch (err: any) {
    return true;
  }
}

// 3. SYNC TEACHERS / USERS
export async function fetchSupabaseTeachers(): Promise<User[] | null> {
  const deletedTeacherIds = new Set(getDeletedTeacherIds());
  const filterDeleted = (list: User[]) => {
    if (deletedTeacherIds.size === 0) return list;
    return list.filter(t => !deletedTeacherIds.has(t.id));
  };

  const client = getSupabaseClient();
  if (!client) {
    const cached = localStorage.getItem('mock_supabase_ea_teachers') || localStorage.getItem('ea_teachers');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return filterDeleted(parsed);
      } catch (e) {}
    }
    return null;
  }
  try {
    const { data, error } = await client.from('ea_teachers').select('*');
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_teachers') || localStorage.getItem('ea_teachers');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return filterDeleted(parsed);
          } catch (e) {}
        }
        return null;
      }
      return null;
    }
    if (!data) return null;
    const mapped = data.map(item => ({
      id: item.id,
      name: item.name || '',
      email: item.email || '',
      role: item.role || 'TEACHER',
      password: item.password || undefined,
      level: item.level || undefined,
      subjects: item.subjects || undefined,
      classes: item.classes || undefined,
      dateOfBirth: item.date_of_birth || item.dob || undefined,
      phoneNumber: item.phone_number || item.phone || undefined,
      qualification: item.qualification || undefined,
      profilePicture: item.profile_picture || item.photo_url || undefined,
      hometown: item.hometown || undefined,
      ghanaCardNumber: item.ghana_card_number || item.ghanaCardNumber || undefined,
    }));

    if (deletedTeacherIds.size > 0) {
      const recordsToPurge = mapped.filter(t => deletedTeacherIds.has(t.id));
      if (recordsToPurge.length > 0) {
        const purgeIds = recordsToPurge.map(t => t.id);
        client.from('ea_teachers').delete().in('id', purgeIds).then(() => {});
      }
    }

    return filterDeleted(mapped);
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_teachers') || localStorage.getItem('ea_teachers');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return filterDeleted(parsed);
        } catch (e) {}
      }
    }
    return null;
  }
}

export async function saveSupabaseTeachers(teachers: User[]): Promise<boolean> {
  // Always persist to local cache immediately to guarantee offline/local persistence
  localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(teachers));
  localStorage.setItem('ea_teachers', JSON.stringify(teachers));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = teachers.map(t => ({
      id: t.id,
      name: t.name,
      email: t.email,
      role: t.role,
      password: t.password || null,
      level: t.level || null,
      subjects: t.subjects || null,
      classes: t.classes || null,
      date_of_birth: t.dateOfBirth || null,
      phone_number: t.phoneNumber || null,
      qualification: t.qualification || null,
      profile_picture: t.profilePicture || null,
      hometown: t.hometown || null,
      ghana_card_number: t.ghanaCardNumber || null,
      updated_at: new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_teachers', payloads, client);
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        return true;
      }
      return false;
    }

    // Prune deleted teachers safely
    try {
      if (teachers.length === 0) {
        await client.from('ea_teachers').delete().not('id', 'is', null);
      } else {
        const { data: existingRows } = await client.from('ea_teachers').select('id');
        if (existingRows && existingRows.length > 0) {
          const activeIds = new Set(teachers.map(t => String(t.id)));
          const toDeleteIds = existingRows
            .filter(row => !activeIds.has(String(row.id)))
            .map(row => row.id)
            .filter(Boolean);
          if (toDeleteIds.length > 0) {
            await client.from('ea_teachers').delete().in('id', toDeleteIds);
          }
        }
      }
    } catch (pruneErr) {
      console.warn('Teacher prune notice:', pruneErr);
    }

    return true;
  } catch (err: any) {
    return true;
  }
}

export async function deleteSupabaseStudent(id: string, rollNumber?: string, studentName?: string): Promise<boolean> {
  if (!id && !rollNumber && !studentName) return true;
  recordDeletedStudentId(id, rollNumber, studentName);

  const normName = studentName ? studentName.toLowerCase().trim() : '';
  const normRoll = rollNumber ? rollNumber.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  const studentKeys = [id, rollNumber].filter(Boolean) as string[];

  // 1. Immediately purge from local caches
  try {
    const isTargetStudent = (s: any) => {
      if (s.id && s.id === id) return true;
      if (rollNumber && s.rollNumber && s.rollNumber === rollNumber) return true;
      if (normRoll && s.rollNumber && s.rollNumber.toUpperCase().replace(/[^A-Z0-9]/g, '') === normRoll) return true;
      if (normName && s.name && s.name.toLowerCase().trim() === normName) return true;
      return isStudentDeleted(s);
    };

    const cachedStudents = localStorage.getItem('ea_students') || localStorage.getItem('mock_supabase_ea_students');
    if (cachedStudents) {
      const parsed = JSON.parse(cachedStudents);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter(s => !isTargetStudent(s));
        localStorage.setItem('ea_students', JSON.stringify(updated));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(updated));
      }
    }

    const cachedGrades = localStorage.getItem('ea_grades') || localStorage.getItem('mock_supabase_ea_grades');
    if (cachedGrades) {
      const parsed = JSON.parse(cachedGrades);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter((g: any) => !studentKeys.includes(g.studentId));
        localStorage.setItem('ea_grades', JSON.stringify(updated));
        localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(updated));
      }
    }

    const cachedAtt = localStorage.getItem('ea_attendance') || localStorage.getItem('mock_supabase_ea_attendance');
    if (cachedAtt) {
      const parsed = JSON.parse(cachedAtt);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter((a: any) => !studentKeys.includes(a.studentId));
        localStorage.setItem('ea_attendance', JSON.stringify(updated));
        localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(updated));
      }
    }

    const cachedDailyAtt = localStorage.getItem('ea_daily_attendance');
    if (cachedDailyAtt) {
      const parsed = JSON.parse(cachedDailyAtt);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter((r: any) => !studentKeys.includes(r.studentId));
        localStorage.setItem('ea_daily_attendance', JSON.stringify(updated));
      }
    }

    const cachedBills = localStorage.getItem('ea_bills') || localStorage.getItem('mock_supabase_ea_bills');
    if (cachedBills) {
      const parsed = JSON.parse(cachedBills);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter((b: any) => !studentKeys.includes(b.studentId));
        localStorage.setItem('ea_bills', JSON.stringify(updated));
        localStorage.setItem('mock_supabase_ea_bills', JSON.stringify(updated));
      }
    }

    const cachedFee = localStorage.getItem('ea_fee_payments') || localStorage.getItem('mock_supabase_ea_fee_payments');
    if (cachedFee) {
      const parsed = JSON.parse(cachedFee);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter((p: any) => {
          if (studentKeys.includes(p.studentId)) return false;
          if (normName && p.studentName && p.studentName.toLowerCase().trim() === normName) return false;
          return true;
        });
        localStorage.setItem('ea_fee_payments', JSON.stringify(updated));
        localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify(updated));
      }
    }

    const cachedJhsMock = localStorage.getItem('ea_jhs_mock_exams') || localStorage.getItem('mock_supabase_ea_jhs_mock_exams');
    if (cachedJhsMock) {
      const parsed = JSON.parse(cachedJhsMock);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter((m: any) => !studentKeys.includes(m.studentId));
        localStorage.setItem('ea_jhs_mock_exams', JSON.stringify(updated));
        localStorage.setItem('mock_supabase_ea_jhs_mock_exams', JSON.stringify(updated));
      }
    }

    const cachedTerminal = localStorage.getItem('ea_jhs_terminal_assessment_history');
    if (cachedTerminal) {
      const parsed = JSON.parse(cachedTerminal);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter((rec: any) => {
          if (studentKeys.includes(rec.studentId)) return false;
          if (rollNumber && rec.rollNumber === rollNumber) return false;
          if (normName && rec.studentName && rec.studentName.toLowerCase().trim() === normName) return false;
          return true;
        });
        localStorage.setItem('ea_jhs_terminal_assessment_history', JSON.stringify(updated));
      }
    }

    const cachedPreProm = localStorage.getItem('ea_pre_promotion_students');
    if (cachedPreProm) {
      const parsed = JSON.parse(cachedPreProm);
      if (Array.isArray(parsed)) {
        const updated = parsed.filter(s => !isTargetStudent(s));
        localStorage.setItem('ea_pre_promotion_students', JSON.stringify(updated));
      }
    }

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('ea_students_updated'));
    window.dispatchEvent(new Event('ea_grades_updated'));
    window.dispatchEvent(new Event('ea_attendance_updated'));
    window.dispatchEvent(new Event('ea_bills_updated'));
    window.dispatchEvent(new Event('ea_fee_payments_updated'));
  } catch (e) {
    console.warn('Local student delete cleanup error:', e);
  }

  // 2. Delete from Supabase remote database
  const client = getSupabaseClient();
  if (client) {
    try {
      for (const k of studentKeys) {
        await client.from('ea_grades').delete().eq('student_id', k);
        await client.from('ea_attendance').delete().eq('student_id', k);
        await client.from('ea_bills').delete().eq('student_id', k);
        await client.from('ea_fee_payments').delete().eq('student_id', k);
        await client.from('ea_jhs_mock_exams').delete().eq('student_id', k);
      }
      if (id) {
        await client.from('ea_students').delete().eq('id', id);
      }
      if (rollNumber) {
        await client.from('ea_students').delete().eq('roll_number', rollNumber);
      }
      if (studentName) {
        await client.from('ea_students').delete().ilike('name', studentName);
      }

      // Log deletion in ea_sync_logs and ea_deleted_records to sync across other client devices & sessions
      try {
        await client.from('ea_deleted_records').upsert([{
          id: `del_st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          record_type: 'STUDENT',
          record_id: id || rollNumber || '',
          roll_number: rollNumber || null,
          name: studentName || null,
          details: { id, rollNumber, studentName, timestamp: new Date().toISOString() },
          deleted_at: new Date().toISOString()
        }]);
      } catch (delErr) {}

      try {
        await client.from('ea_sync_logs').insert([{
          id: `del_st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action_type: 'DELETE_STUDENT',
          description: `Student permanently deleted: ${studentName || id} (${rollNumber || id})`,
          performed_by: 'Admin',
          status: 'SUCCESS',
          details: { id, rollNumber, studentName, timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      } catch (logErr) {}

      return true;
    } catch (err: any) {
      console.warn('deleteSupabaseStudent remote exception:', err);
      return true;
    }
  }
  return true;
}

export async function deleteSupabaseTeacher(id: string, email?: string, name?: string): Promise<boolean> {
  if (!id && !email) return true;
  recordDeletedTeacherId(id, email, name);

  try {
    const cached = localStorage.getItem('mock_supabase_ea_teachers') || localStorage.getItem('ea_teachers');
    if (cached) {
      const teachers = JSON.parse(cached) as User[];
      const updated = teachers.filter(t => {
        if (t.id === id) return false;
        if (email && t.email.toLowerCase() === email.toLowerCase()) return false;
        return true;
      });
      localStorage.setItem('ea_teachers', JSON.stringify(updated));
      localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(updated));
    }
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('ea_teachers_updated'));
  } catch (e) {}

  const client = getSupabaseClient();
  if (client) {
    try {
      if (id) await client.from('ea_teachers').delete().eq('id', id);
      if (email) await client.from('ea_teachers').delete().ilike('email', email);

      try {
        await client.from('ea_sync_logs').insert([{
          id: `del_tch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action_type: 'DELETE_TEACHER',
          description: `Staff member permanently deleted: ${name || email || id}`,
          performed_by: 'Admin',
          status: 'SUCCESS',
          details: { id, email, name, timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      } catch (logErr) {}

      return true;
    } catch (e) {
      console.warn('deleteSupabaseTeacher Supabase error:', e);
      return true;
    }
  }
  return true;
}

// 4. SYNC GRADES
export async function fetchSupabaseGrades(): Promise<Grade[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('ea_grades').select('*');
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_grades') || localStorage.getItem('ea_grades');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data) return null;
    return data.map(item => {
      const rawNurseryRem = (item.nursery_remark || item.nurseryRemark || '').toString().trim().toUpperCase();
      const remUpper = (item.remarks || '').toString().trim().toUpperCase();
      const totalScoreNum = item.total_score !== undefined && item.total_score !== null ? Number(item.total_score) : ((Number(item.class_score) || 0) + (Number(item.exam_score) || 0));

      let resolvedNurseryRemark: 'MO' | 'O' | 'S' | 'NA' | undefined = undefined;
      if (['MO', 'O', 'S', 'NA'].includes(rawNurseryRem)) {
        resolvedNurseryRemark = rawNurseryRem as 'MO' | 'O' | 'S' | 'NA';
      } else if (['MO', 'O', 'S', 'NA'].includes(remUpper)) {
        resolvedNurseryRemark = remUpper as 'MO' | 'O' | 'S' | 'NA';
      } else if (totalScoreNum > 0) {
        if (totalScoreNum >= 80) resolvedNurseryRemark = 'MO';
        else if (totalScoreNum >= 65) resolvedNurseryRemark = 'O';
        else if (totalScoreNum >= 45) resolvedNurseryRemark = 'S';
        else resolvedNurseryRemark = 'NA';
      }

      return {
        studentId: item.student_id,
        subjectId: item.subject_id || '',
        classScore: item.class_score !== undefined && item.class_score !== null ? Number(item.class_score) : 0,
        examScore: item.exam_score !== undefined && item.exam_score !== null ? Number(item.exam_score) : 0,
        totalScore: totalScoreNum,
        gradeLetter: item.grade_letter || 'F',
        remarks: item.remarks || resolvedNurseryRemark || '',
        nurseryRemark: resolvedNurseryRemark,
        term: item.term || 'Term 1',
        year: item.year || '2025/2026',
        teacherId: item.teacher_id || '',
        updatedAt: item.updated_at,
      };
    });
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_grades') || localStorage.getItem('ea_grades');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }
}

export async function saveSupabaseGrades(grades: Grade[]): Promise<boolean> {
  // Always persist to local cache immediately to guarantee offline/local persistence
  localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(grades));
  localStorage.setItem('ea_grades', JSON.stringify(grades));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = grades.map(g => {
      const effectiveNurseryRem = g.nurseryRemark || (['MO', 'O', 'S', 'NA'].includes((g.remarks || '').toUpperCase()) ? g.remarks.toUpperCase() : '');
      return {
        student_id: g.studentId,
        subject_id: g.subjectId,
        class_score: g.classScore,
        exam_score: g.examScore,
        total_score: g.totalScore,
        grade_letter: g.gradeLetter,
        remarks: g.remarks || effectiveNurseryRem || '',
        nursery_remark: effectiveNurseryRem || '',
        term: g.term || 'Term 1',
        year: g.year || '2025/2026',
        teacher_id: g.teacherId,
        updated_at: g.updatedAt || new Date().toISOString()
      };
    });
    const { error } = await safeUpsert('ea_grades', payloads, client, 'student_id,subject_id,term,year');
    if (error) {
      console.warn('Supabase saveSupabaseGrades sync error, fallback to local storage preserved:', error);
      return true;
    }
    return true;
  } catch (err: any) {
    console.warn('Supabase saveSupabaseGrades exception, fallback to local storage preserved:', err);
    return true;
  }
}

// 5. SYNC ATTENDANCE
export async function fetchSupabaseAttendance(): Promise<Attendance[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('ea_attendance').select('*');
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_attendance') || localStorage.getItem('ea_attendance');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data) return null;
    return data.map(item => ({
      studentId: item.student_id,
      term: item.term || 'Term 1',
      year: item.year || '2025/2026',
      totalDays: item.total_days !== undefined && item.total_days !== null ? item.total_days : 0,
      daysPresent: item.days_present !== undefined && item.days_present !== null ? item.days_present : 0,
      remarks: item.remarks || '',
      teacherId: item.teacher_id || '',
      updatedAt: item.updated_at,
    }));
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_attendance') || localStorage.getItem('ea_attendance');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }
}

export async function saveSupabaseAttendance(attendance: Attendance[]): Promise<boolean> {
  // Always persist to local cache immediately to guarantee offline/local persistence
  localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(attendance));
  localStorage.setItem('ea_attendance', JSON.stringify(attendance));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = attendance.map(a => ({
      student_id: a.studentId,
      term: a.term || 'Term 1',
      year: a.year || '2025/2026',
      total_days: a.totalDays,
      days_present: a.daysPresent,
      remarks: a.remarks,
      teacher_id: a.teacherId,
      updated_at: a.updatedAt || new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_attendance', payloads, client, 'student_id,term,year');
    if (error) {
      console.warn('Supabase saveSupabaseAttendance sync error, fallback to local storage preserved:', error);
      return true;
    }
    return true;
  } catch (err: any) {
    console.warn('Supabase saveSupabaseAttendance exception, fallback to local storage preserved:', err);
    return true;
  }
}

// 6. SYNC STUDENT BILLS
export async function fetchSupabaseBills(): Promise<StudentBill[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('ea_bills').select('*');
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_bills') || localStorage.getItem('ea_bills');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data) return null;
    return data.map(item => ({
      studentId: item.student_id,
      arrears: item.arrears || '0.00',
      tuition: item.tuition || '0.00',
      computing: item.computing || '0.00',
      utility: item.utility || '0.00',
      stationery: item.stationery || '0.00',
      pta: item.pta || '0.00',
      reopeningDate: item.reopening_date || undefined,
      contactNumber: item.contact_number || undefined,
      term: item.term || 'Term 1',
      year: item.year || '2025/2026',
      updatedAt: item.updated_at,
    }));
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_bills') || localStorage.getItem('ea_bills');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }
}

export async function saveSupabaseBills(bills: StudentBill[]): Promise<boolean> {
  localStorage.setItem('mock_supabase_ea_bills', JSON.stringify(bills));
  localStorage.setItem('ea_bills', JSON.stringify(bills));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = bills.map(b => ({
      student_id: b.studentId,
      arrears: String(b.arrears),
      tuition: String(b.tuition),
      computing: String(b.computing),
      utility: String(b.utility),
      stationery: String(b.stationery),
      pta: String(b.pta),
      reopening_date: b.reopeningDate || null,
      contact_number: b.contactNumber || null,
      term: b.term || 'Term 1',
      year: b.year || '2025/2026',
      updated_at: b.updatedAt || new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_bills', payloads, client, 'student_id');
    if (error) {
      console.warn('Supabase saveSupabaseBills sync error, fallback to local storage preserved:', error);
      return true;
    }
    return true;
  } catch (err: any) {
    console.warn('Supabase saveSupabaseBills exception, fallback to local storage preserved:', err);
    return true;
  }
}

// Helper to track deleted fee payment IDs & receipt numbers in localStorage
export function getDeletedFeePaymentIds(): string[] {
  try {
    const saved = localStorage.getItem('ea_deleted_fee_payment_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function recordDeletedFeePaymentId(idOrReceipt: string): void {
  if (!idOrReceipt) return;
  try {
    const current = getDeletedFeePaymentIds();
    const clean = idOrReceipt.trim();
    if (clean && !current.includes(clean)) {
      localStorage.setItem('ea_deleted_fee_payment_ids', JSON.stringify([...current, clean]));
    }
  } catch (e) {}
}

// 7. SYNC FEE PAYMENTS
export async function fetchSupabaseFeePayments(): Promise<FeePayment[] | null> {
  const deletedIds = new Set(getDeletedFeePaymentIds().map(x => x.toUpperCase()));
  const filterDeleted = (list: FeePayment[]) => {
    if (deletedIds.size === 0) return list;
    return list.filter(item => {
      if (item.id && deletedIds.has(item.id.trim().toUpperCase())) return false;
      if (item.receiptNumber && deletedIds.has(item.receiptNumber.trim().toUpperCase())) return false;
      return true;
    });
  };

  const client = getSupabaseClient();
  if (!client) {
    const cached = localStorage.getItem('mock_supabase_ea_fee_payments') || localStorage.getItem('ea_fee_payments');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return filterDeleted(parsed);
      } catch (e) {}
    }
    return null;
  }
  try {
    const { data, error } = await client.from('ea_fee_payments').select('*');
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_fee_payments') || localStorage.getItem('ea_fee_payments');
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return filterDeleted(parsed);
          } catch (e) {}
        }
        return null;
      }
      return null;
    }
    if (!data) return null;
    const mapped = data.map(item => ({
      id: item.id || item.receipt_number || String(Math.random()),
      receiptNumber: item.receipt_number || '',
      studentId: item.student_id || '',
      studentName: item.student_name || '',
      className: item.class_name || '',
      feeType: (item.fee_type || 'Tuition Fee') as any,
      amountPaid: Number(item.amount_paid) || 0,
      totalFeeAmount: Number(item.total_fee_amount) || 0,
      paymentMethod: (item.payment_method || 'Cash') as any,
      paymentDate: item.payment_date || new Date().toISOString().split('T')[0],
      status: (item.status || 'Paid') as any,
      remarks: item.remarks || '',
      recordedBy: item.recorded_by || 'Admin',
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || undefined,
    }));

    if (deletedIds.size > 0) {
      const recordsToPurge = mapped.filter(item => {
        if (item.id && deletedIds.has(item.id.trim().toUpperCase())) return true;
        if (item.receiptNumber && deletedIds.has(item.receiptNumber.trim().toUpperCase())) return true;
        return false;
      });
      if (recordsToPurge.length > 0) {
        const idsToPurge = recordsToPurge.map(r => r.id).filter(Boolean);
        const recsToPurge = recordsToPurge.map(r => r.receiptNumber).filter(Boolean);
        if (idsToPurge.length > 0) client.from('ea_fee_payments').delete().in('id', idsToPurge).then(() => {});
        if (recsToPurge.length > 0) client.from('ea_fee_payments').delete().in('receipt_number', recsToPurge).then(() => {});
      }
    }

    return filterDeleted(mapped);
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_fee_payments') || localStorage.getItem('ea_fee_payments');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return filterDeleted(parsed);
        } catch (e) {}
      }
    }
    return null;
  }
}

export async function forceResyncSupabaseFeePayments(): Promise<{ success: boolean; count: number; data: FeePayment[]; message: string }> {
  const deletedIds = new Set(getDeletedFeePaymentIds().map(x => x.toUpperCase()));
  const filterDeleted = (list: FeePayment[]) => {
    if (deletedIds.size === 0) return list;
    return list.filter(item => {
      if (item.id && deletedIds.has(item.id.trim().toUpperCase())) return false;
      if (item.receiptNumber && deletedIds.has(item.receiptNumber.trim().toUpperCase())) return false;
      return true;
    });
  };

  const client = getSupabaseClient();
  if (!client) {
    return { success: false, count: 0, data: [], message: 'Supabase client is not connected.' };
  }
  try {
    const { data, error } = await client.from('ea_fee_payments').select('*');
    if (error) {
      return { success: false, count: 0, data: [], message: `Supabase error: ${error.message}` };
    }
    const freshPayments: FeePayment[] = (data || []).map(item => ({
      id: item.id || item.receipt_number || String(Math.random()),
      receiptNumber: item.receipt_number || '',
      studentId: item.student_id || '',
      studentName: item.student_name || '',
      className: item.class_name || '',
      feeType: (item.fee_type || 'Tuition Fee') as any,
      amountPaid: Number(item.amount_paid) || 0,
      totalFeeAmount: Number(item.total_fee_amount) || 0,
      paymentMethod: (item.payment_method || 'Cash') as any,
      paymentDate: item.payment_date || new Date().toISOString().split('T')[0],
      status: (item.status || 'Paid') as any,
      remarks: item.remarks || '',
      recordedBy: item.recorded_by || 'Admin',
      createdAt: item.created_at || new Date().toISOString(),
      updatedAt: item.updated_at || undefined,
    }));

    const cleanPayments = filterDeleted(freshPayments);
    localStorage.setItem('ea_fee_payments', JSON.stringify(cleanPayments));
    localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify(cleanPayments));
    window.dispatchEvent(new Event('storage'));

    return {
      success: true,
      count: cleanPayments.length,
      data: cleanPayments,
      message: `Synchronized ${cleanPayments.length} fee payment record(s) from Supabase.`
    };
  } catch (err: any) {
    return { success: false, count: 0, data: [], message: `Sync exception: ${err.message || err}` };
  }
}

export async function saveSupabaseFeePayments(payments: FeePayment[]): Promise<boolean> {
  localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify(payments));
  localStorage.setItem('ea_fee_payments', JSON.stringify(payments));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    if (!payments || payments.length === 0) {
      await client.from('ea_fee_payments').delete().not('id', 'is', null);
      return true;
    }

    const payloads = payments.map(p => ({
      id: p.id || p.receiptNumber || `fee_${Date.now()}_${Math.random()}`,
      receipt_number: p.receiptNumber,
      student_id: p.studentId,
      student_name: p.studentName,
      class_name: p.className,
      fee_type: p.feeType,
      amount_paid: Number(p.amountPaid) || 0,
      total_fee_amount: Number(p.totalFeeAmount) || 0,
      payment_method: p.paymentMethod || 'Cash',
      payment_date: p.paymentDate,
      status: p.status || 'Paid',
      remarks: p.remarks || '',
      recorded_by: p.recordedBy || 'Admin',
      created_at: p.createdAt || new Date().toISOString(),
      updated_at: p.updatedAt || new Date().toISOString(),
    }));
    if (payloads.length > 0) {
      const { error } = await safeUpsert('ea_fee_payments', payloads, client, 'id');
      if (error) {
        console.warn('Supabase saveSupabaseFeePayments sync error, fallback to local storage preserved:', error);
        return true;
      }
    }

    return true;
  } catch (err: any) {
    console.warn('Supabase saveSupabaseFeePayments exception, fallback to local storage preserved:', err);
    return true;
  }
}

export async function deleteSupabaseFeePayment(payment: { id?: string; receiptNumber?: string }): Promise<boolean> {
  const targetId = payment.id && payment.id.trim() ? payment.id.trim() : null;
  const targetRec = payment.receiptNumber && payment.receiptNumber.trim() ? payment.receiptNumber.trim() : null;

  if (targetId) recordDeletedFeePaymentId(targetId);
  if (targetRec) recordDeletedFeePaymentId(targetRec);

  // Clean local caches first
  try {
    const raw = localStorage.getItem('ea_fee_payments') || localStorage.getItem('mock_supabase_ea_fee_payments');
    if (raw) {
      const arr: FeePayment[] = JSON.parse(raw);
      const filtered = arr.filter(item => {
        if (targetId && item.id && item.id.trim() === targetId) return false;
        if (targetRec && item.receiptNumber && item.receiptNumber.trim().toUpperCase() === targetRec.toUpperCase()) return false;
        return true;
      });
      localStorage.setItem('ea_fee_payments', JSON.stringify(filtered));
      localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Cache purge error:', e);
  }

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    if (!targetId && !targetRec) return true;

    if (targetId) {
      const { error } = await client.from('ea_fee_payments').delete().eq('id', targetId);
      if (error) console.warn('Supabase delete by id error:', error);
    }
    if (targetRec) {
      const { error: err1 } = await client.from('ea_fee_payments').delete().eq('receipt_number', targetRec);
      if (err1) console.warn('Supabase delete by receipt_number error:', err1);
      await client.from('ea_fee_payments').delete().ilike('receipt_number', targetRec);
    }
    return true;
  } catch (e) {
    console.warn('Error deleting fee payment from Supabase:', e);
    return false;
  }
}

export async function deleteSupabaseFeePaymentsBatch(payments: { id?: string; receiptNumber?: string }[]): Promise<boolean> {
  if (!payments || payments.length === 0) return true;
  const ids = payments.map(p => p.id?.trim()).filter(Boolean) as string[];
  const recs = payments.map(p => p.receiptNumber?.trim()).filter(Boolean) as string[];

  ids.forEach(id => recordDeletedFeePaymentId(id));
  recs.forEach(rec => recordDeletedFeePaymentId(rec));

  // Clean local caches
  try {
    const raw = localStorage.getItem('ea_fee_payments') || localStorage.getItem('mock_supabase_ea_fee_payments');
    if (raw) {
      const arr: FeePayment[] = JSON.parse(raw);
      const filtered = arr.filter(item => {
        if (item.id && ids.includes(item.id.trim())) return false;
        if (item.receiptNumber && recs.some(r => r.toUpperCase() === item.receiptNumber.trim().toUpperCase())) return false;
        return true;
      });
      localStorage.setItem('ea_fee_payments', JSON.stringify(filtered));
      localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify(filtered));
    }
  } catch (e) {
    console.warn('Cache purge error in batch:', e);
  }

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    if (ids.length > 0) {
      const { error } = await client.from('ea_fee_payments').delete().in('id', ids);
      if (error) console.warn('Supabase batch delete ids error:', error);
    }
    if (recs.length > 0) {
      const { error } = await client.from('ea_fee_payments').delete().in('receipt_number', recs);
      if (error) console.warn('Supabase batch delete recs error:', error);
    }
    return true;
  } catch (e) {
    console.warn('Error batch deleting fee payments from Supabase:', e);
    return false;
  }
}

export async function clearAllSupabaseFeePayments(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return true;
  try {
    await client.from('ea_fee_payments').delete().not('id', 'is', null);
    return true;
  } catch (e) {
    console.warn('Error clearing all fee payments from Supabase:', e);
    return false;
  }
}


// 8. SYNC FEE STRUCTURES
export async function fetchSupabaseFeeStructures(): Promise<FeeStructureItem[] | null> {
  const client = getSupabaseClient();
  if (!client) {
    const cached = localStorage.getItem('mock_supabase_ea_fee_structures') || localStorage.getItem('ea_fee_structures');
    return cached ? JSON.parse(cached) : null;
  }
  try {
    const { data, error } = await client.from('ea_fee_structures').select('*');
    if (error) return null;
    if (!data) return null;
    return data.map(item => ({
      id: item.id || String(Math.random()),
      level: item.level || '',
      tuition: Number(item.tuition) || 0,
      computing: Number(item.computing) || 0,
      utility: Number(item.utility) || 0,
      stationery: Number(item.stationery) || 0,
      pta: Number(item.pta) || 0,
      uniform: Number(item.uniform) || 0,
      mockExam: Number(item.mock_exam) || 0,
      term: item.term || 'Term 1',
      year: item.year || '2025/2026',
      updatedAt: item.updated_at || undefined,
    }));
  } catch (err: any) {
    return null;
  }
}

export async function saveSupabaseFeeStructures(structures: FeeStructureItem[]): Promise<boolean> {
  localStorage.setItem('mock_supabase_ea_fee_structures', JSON.stringify(structures));
  localStorage.setItem('ea_fee_structures', JSON.stringify(structures));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = structures.map(s => ({
      id: s.id || `${s.level}_${s.term}_${s.year}`,
      level: s.level,
      tuition: Number(s.tuition) || 0,
      computing: Number(s.computing) || 0,
      utility: Number(s.utility) || 0,
      stationery: Number(s.stationery) || 0,
      pta: Number(s.pta) || 0,
      uniform: Number(s.uniform) || 0,
      mock_exam: Number(s.mockExam) || 0,
      term: s.term || 'Term 1',
      year: s.year || '2025/2026',
      updated_at: s.updatedAt || new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_fee_structures', payloads, client, 'id');
    if (error) return true;
    return true;
  } catch (err: any) {
    return true;
  }
}

// 9. SYNC DAILY COLLECTIONS
export async function fetchSupabaseDailyCollections(): Promise<DailyCollectionSummary[] | null> {
  const client = getSupabaseClient();
  if (!client) {
    const cached = localStorage.getItem('mock_supabase_ea_daily_collections') || localStorage.getItem('ea_daily_collections');
    return cached ? JSON.parse(cached) : null;
  }
  try {
    const { data, error } = await client.from('ea_daily_collections').select('*');
    if (error) return null;
    if (!data) return null;
    return data.map(item => ({
      id: item.id || String(Math.random()),
      collectionDate: item.collection_date || '',
      totalCash: Number(item.total_cash) || 0,
      totalMomo: Number(item.total_momo) || 0,
      totalBank: Number(item.total_bank) || 0,
      totalCheque: Number(item.total_cheque) || 0,
      totalCollected: Number(item.total_collected) || 0,
      recordedBy: item.recorded_by || 'Admin',
      updatedAt: item.updated_at || undefined,
    }));
  } catch (err: any) {
    return null;
  }
}

export async function saveSupabaseDailyCollections(collections: DailyCollectionSummary[]): Promise<boolean> {
  localStorage.setItem('mock_supabase_ea_daily_collections', JSON.stringify(collections));
  localStorage.setItem('ea_daily_collections', JSON.stringify(collections));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = collections.map(c => ({
      id: c.id || c.collectionDate,
      collection_date: c.collectionDate,
      total_cash: Number(c.totalCash) || 0,
      total_momo: Number(c.totalMomo) || 0,
      total_bank: Number(c.totalBank) || 0,
      total_cheque: Number(c.totalCheque) || 0,
      total_collected: Number(c.totalCollected) || 0,
      recorded_by: c.recordedBy || 'Admin',
      updated_at: c.updatedAt || new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_daily_collections', payloads, client, 'id');
    if (error) return true;
    return true;
  } catch (err: any) {
    return true;
  }
}

// 10. SYNC AUDIT LOGS
export async function fetchSupabaseSyncLogs(): Promise<SyncAuditLog[] | null> {
  const client = getSupabaseClient();
  if (!client) {
    const cached = localStorage.getItem('mock_supabase_ea_sync_logs') || localStorage.getItem('ea_sync_logs');
    return cached ? JSON.parse(cached) : null;
  }
  try {
    const { data, error } = await client.from('ea_sync_logs').select('*');
    if (error) return null;
    if (!data) return null;
    return data.map(item => ({
      id: item.id || String(Math.random()),
      actionType: item.action_type || '',
      description: item.description || '',
      performedBy: item.performed_by || 'System',
      status: (item.status || 'SUCCESS') as any,
      details: typeof item.details === 'string' ? item.details : JSON.stringify(item.details || {}),
      timestamp: item.timestamp || new Date().toISOString(),
      updatedAt: item.updated_at || undefined,
    }));
  } catch (err: any) {
    return null;
  }
}

export async function saveSupabaseSyncLogs(logs: SyncAuditLog[]): Promise<boolean> {
  localStorage.setItem('mock_supabase_ea_sync_logs', JSON.stringify(logs));
  localStorage.setItem('ea_sync_logs', JSON.stringify(logs));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = logs.map(l => ({
      id: l.id || `log_${Date.now()}_${Math.random()}`,
      action_type: l.actionType,
      description: l.description,
      performed_by: l.performedBy || 'System',
      status: l.status || 'SUCCESS',
      details: typeof l.details === 'string' ? JSON.parse(l.details || '{}') : (l.details || {}),
      timestamp: l.timestamp || new Date().toISOString(),
      updated_at: l.updatedAt || new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_sync_logs', payloads, client, 'id');
    if (error) return true;
    return true;
  } catch (err: any) {
    return true;
  }
}

// Helper to track deleted inventory IDs in localStorage
export function getDeletedInventoryIds(): string[] {
  try {
    const saved = localStorage.getItem('ea_deleted_inventory_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

// 11. SYNC INVENTORY RECORDS
export async function fetchSupabaseInventory(): Promise<ClassroomInventoryRecord[] | null> {
  const client = getSupabaseClient();
  const deletedIds = getDeletedInventoryIds();

  const filterDeleted = (records: ClassroomInventoryRecord[]) => {
    if (!deletedIds || deletedIds.length === 0) return records;
    return records.filter(r => !deletedIds.includes(r.id));
  };

  if (!client) {
    const cached = localStorage.getItem('mock_supabase_ea_inventory') ?? localStorage.getItem('ea_school_inventory');
    if (cached !== null && cached !== undefined) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return filterDeleted(parsed);
      } catch (e) {}
    }
    return [];
  }

  try {
    const { data, error } = await client.from('ea_inventory').select('*');
    if (error) {
      console.warn('Supabase fetch inventory error:', error);
      const cached = localStorage.getItem('mock_supabase_ea_inventory') ?? localStorage.getItem('ea_school_inventory');
      if (cached !== null && cached !== undefined) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return filterDeleted(parsed);
        } catch (e) {}
      }
      return [];
    }

    if (!data || data.length === 0) {
      localStorage.setItem('mock_supabase_ea_inventory', JSON.stringify([]));
      localStorage.setItem('ea_school_inventory', JSON.stringify([]));
      localStorage.setItem('ea_inventory_initialized', 'true');
      localStorage.setItem('ea_inventory_cleared', 'true');
      return [];
    }

    const mapped: ClassroomInventoryRecord[] = data.map(item => ({
      id: item.id || `inv_${Math.random()}`,
      locationName: item.location_name || item.locationName || '',
      category: item.category || 'Classroom',
      studentChairs: Number(item.student_chairs ?? item.studentChairs) || 0,
      studentTables: Number(item.student_tables ?? item.studentTables) || 0,
      textbooks: Number(item.textbooks) || 0,
      washrooms: Number(item.washrooms) || 0,
      sinks: Number(item.sinks) || 0,
      buses: Number(item.buses) || 0,
      teacherChairs: Number(item.teacher_chairs ?? item.teacherChairs) || 0,
      teacherTables: Number(item.teacher_tables ?? item.teacherTables) || 0,
      computers: Number(item.computers) || 0,
      projectors: Number(item.projectors) || 0,
      wallCharts: Number(item.wall_charts ?? item.wallCharts) || 0,
      customItems: (() => {
        if (Array.isArray(item.customItems)) return item.customItems;
        if (Array.isArray(item.custom_items)) return item.custom_items;
        if (typeof item.custom_items === 'string') {
          try { return JSON.parse(item.custom_items); } catch(e) {}
        }
        return [];
      })(),
      notes: item.notes || '',
      updatedAt: item.updated_at || item.updatedAt || new Date().toISOString()
    }));

    // If Supabase returned records that are marked deleted in local registry, clean them up from Supabase DB
    if (deletedIds && deletedIds.length > 0) {
      const recordsToDelete = mapped.filter(r => deletedIds.includes(r.id));
      if (recordsToDelete.length > 0) {
        const idsToPurge = recordsToDelete.map(r => r.id);
        client.from('ea_inventory').delete().in('id', idsToPurge).then(({ error: pErr }) => {
          if (pErr) console.warn('Background purge of deleted inventory IDs notice:', pErr);
        });
      }
    }

    const cleanMapped = filterDeleted(mapped);

    localStorage.setItem('mock_supabase_ea_inventory', JSON.stringify(cleanMapped));
    localStorage.setItem('ea_school_inventory', JSON.stringify(cleanMapped));
    localStorage.setItem('ea_inventory_initialized', 'true');
    return cleanMapped;
  } catch (err: any) {
    console.warn('fetchSupabaseInventory exception:', err);
    const cached = localStorage.getItem('mock_supabase_ea_inventory') ?? localStorage.getItem('ea_school_inventory');
    if (cached !== null && cached !== undefined) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return filterDeleted(parsed);
      } catch (e) {}
    }
    return [];
  }
}

export async function saveSupabaseInventory(inventory: ClassroomInventoryRecord[], deletedIds: string[] = []): Promise<boolean> {
  if (deletedIds && deletedIds.length > 0) {
    const currentDeleted = getDeletedInventoryIds();
    const combined = Array.from(new Set([...currentDeleted, ...deletedIds]));
    localStorage.setItem('ea_deleted_inventory_ids', JSON.stringify(combined));
  }

  const activeDeleted = getDeletedInventoryIds();
  const cleanInventory = inventory.filter(item => !activeDeleted.includes(item.id));

  localStorage.setItem('mock_supabase_ea_inventory', JSON.stringify(cleanInventory));
  localStorage.setItem('ea_school_inventory', JSON.stringify(cleanInventory));
  localStorage.setItem('ea_inventory_initialized', 'true');
  localStorage.setItem('ea_inventory_seeded', 'true');
  if (cleanInventory.length === 0) {
    localStorage.setItem('ea_inventory_cleared', 'true');
  } else {
    localStorage.removeItem('ea_inventory_cleared');
  }

  try {
    window.dispatchEvent(new Event('ea_inventory_updated'));
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const allDeletedToPurge = Array.from(new Set([...(deletedIds || []), ...activeDeleted]));
    if (allDeletedToPurge.length > 0) {
      try {
        const { error: delErr } = await client.from('ea_inventory').delete().in('id', allDeletedToPurge);
        if (delErr) {
          console.warn('Error deleting records from ea_inventory:', delErr);
        }
      } catch (e) {
        console.warn('Exception deleting records from ea_inventory:', e);
      }
    }

    if (cleanInventory.length === 0) {
      try {
        const { error: wipeErr } = await client.from('ea_inventory').delete().neq('id', '___none___');
        if (wipeErr) {
          console.warn('Error wiping ea_inventory:', wipeErr);
        }
      } catch (e) {
        console.warn('Error wiping ea_inventory:', e);
      }
      return true;
    }

    const payloads = cleanInventory.map(item => ({
      id: item.id,
      location_name: item.locationName,
      category: item.category,
      student_chairs: item.studentChairs,
      student_tables: item.studentTables,
      textbooks: item.textbooks,
      washrooms: item.washrooms,
      sinks: item.sinks,
      buses: item.buses,
      teacher_chairs: item.teacherChairs,
      teacher_tables: item.teacherTables,
      computers: item.computers || 0,
      projectors: item.projectors || 0,
      wall_charts: item.wallCharts || 0,
      custom_items: JSON.stringify(item.customItems || []),
      notes: item.notes || '',
      updated_at: item.updatedAt || new Date().toISOString()
    }));

    const { error } = await safeUpsert('ea_inventory', payloads, client, 'id');
    if (error) {
      console.warn('Supabase ea_inventory upsert notice:', error);
    }
    return true;
  } catch (err: any) {
    console.warn('saveSupabaseInventory exception:', err);
    return true;
  }
}

export async function deleteSupabaseInventoryRecord(id: string): Promise<boolean> {
  if (!id) return true;
  try {
    const currentDeleted = getDeletedInventoryIds();
    if (!currentDeleted.includes(id)) {
      localStorage.setItem('ea_deleted_inventory_ids', JSON.stringify([...currentDeleted, id]));
    }

    const cached = localStorage.getItem('ea_school_inventory') ?? localStorage.getItem('mock_supabase_ea_inventory');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const updated = parsed.filter((item: any) => item.id !== id);
          localStorage.setItem('ea_school_inventory', JSON.stringify(updated));
          localStorage.setItem('mock_supabase_ea_inventory', JSON.stringify(updated));
        }
      } catch (e) {}
    }
    localStorage.setItem('ea_inventory_initialized', 'true');
    localStorage.setItem('ea_inventory_seeded', 'true');
    window.dispatchEvent(new Event('ea_inventory_updated'));
  } catch (e) {}

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('ea_inventory').delete().eq('id', id);
      if (error) {
        console.warn('deleteSupabaseInventoryRecord Supabase error:', error);
      }
    } catch (e) {
      console.warn('deleteSupabaseInventoryRecord exception:', e);
    }
  }
  return true;
}

// Global setup helper that tries to execute the setup via RPC or instructions
export async function createTablesInSupabase(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'Supabase client is not initialized.' };

  try {
    // Note: Standard Supabase anonymized access doesn't let you run raw SQL queries directly from client SDK 
    // unless you have a database function (RPC) or use management API.
    // Instead of failing, we instruct the user beautifully and also attempt to insert mock data to verify if tables are already active.
    const { error: confError } = await client.from('ea_config').select('id').limit(1);
    if (!confError) {
      return { success: true, message: 'Tables already exist on Supabase!' };
    }
    
    return { 
      success: false, 
      message: 'Please execute the SQL Script in your Supabase Dashboard SQL Editor. The SDK does not have permission to run dynamic DDL schema queries directly.' 
    };
  } catch (err: any) {
    return { success: false, message: `Could not verify/create tables: ${err.message || err}` };
  }
}

/**
 * Compresses and resizes a passport photograph to max 400x500px portrait JPEG at 85% quality.
 */
export async function compressPassportPhoto(file: File): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 500;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                resolve({ blob, dataUrl });
              } else {
                reject(new Error('Canvas toBlob failed'));
              }
            },
            'image/jpeg',
            0.85
          );
        } else {
          reject(new Error('Canvas context failed'));
        }
      };
      img.onerror = () => reject(new Error('Image loading failed'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('File reading failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Uploads a student passport photograph directly to the Supabase Storage bucket ('ea' or 'student-photos').
 * Returns the global CDN public URL so the image synchronizes across all authorized user devices.
 * Gracefully falls back to a compressed data URL if storage upload is offline or restricted.
 */
export async function uploadStudentPhotoToSupabase(file: File, studentId: string): Promise<string> {
  try {
    const { blob, dataUrl } = await compressPassportPhoto(file);
    const client = getSupabaseClient();
    if (!client) {
      return dataUrl;
    }

    const cleanId = studentId ? studentId.replace(/[^a-zA-Z0-9_-]/g, '_') : `student_${Date.now()}`;
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `student-photos/${cleanId}_${Date.now()}.${fileExt}`;

    // 1. First attempt upload directly to the user's created 'ea' storage bucket
    try {
      const { error: eaErr } = await client.storage
        .from('ea')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (!eaErr) {
        const { data: urlData } = client.storage
          .from('ea')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          console.log('Successfully uploaded student photograph to Supabase bucket "ea":', urlData.publicUrl);
          return urlData.publicUrl;
        }
      } else {
        console.warn('Upload to bucket "ea" notice:', eaErr.message);
      }
    } catch (e: any) {
      console.warn('Bucket "ea" upload exception, attempting secondary bucket:', e?.message || e);
    }

    // 2. Secondary fallback: Attempt upload to 'student-photos' storage bucket
    await client.storage.createBucket('student-photos', {
      public: true,
      fileSizeLimit: 5242880,
    }).catch(() => {});

    const altFileName = `passport/${cleanId}_${Date.now()}.jpg`;
    const { error: uploadErr } = await client.storage
      .from('student-photos')
      .upload(altFileName, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg',
      });

    if (!uploadErr) {
      const { data: urlData } = client.storage
        .from('student-photos')
        .getPublicUrl(altFileName);

      if (urlData?.publicUrl) {
        return urlData.publicUrl;
      }
    }

    // 3. Fallback to optimized data URL if bucket permissions/network restrict direct upload
    return dataUrl;
  } catch (err) {
    console.warn('Student photo storage upload error, falling back to data URL:', err);
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve((r.result as string) || '');
      r.readAsDataURL(file);
    });
  }
}

/**
 * Uploads a teacher profile picture directly to Supabase storage ('ea' or 'teacher-photos').
 * Returns the CDN URL or compressed data URL fallback.
 */
export async function uploadTeacherPhotoToSupabase(file: File, teacherId: string): Promise<string> {
  try {
    const { blob, dataUrl } = await compressPassportPhoto(file);
    const client = getSupabaseClient();
    if (!client) {
      return dataUrl;
    }

    const cleanId = teacherId ? teacherId.replace(/[^a-zA-Z0-9_-]/g, '_') : `teacher_${Date.now()}`;
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `teacher-photos/${cleanId}_${Date.now()}.${fileExt}`;

    try {
      const { error: eaErr } = await client.storage
        .from('ea')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type || 'image/jpeg',
        });

      if (!eaErr) {
        const { data: urlData } = client.storage.from('ea').getPublicUrl(fileName);
        if (urlData?.publicUrl) return urlData.publicUrl;
      }
    } catch (e) {}

    await client.storage.createBucket('teacher-photos', { public: true }).catch(() => {});
    const altFileName = `profiles/${cleanId}_${Date.now()}.jpg`;
    const { error: uploadErr } = await client.storage
      .from('teacher-photos')
      .upload(altFileName, blob, { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' });

    if (!uploadErr) {
      const { data: urlData } = client.storage.from('teacher-photos').getPublicUrl(altFileName);
      if (urlData?.publicUrl) return urlData.publicUrl;
    }

    return dataUrl;
  } catch (err) {
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve((r.result as string) || '');
      r.readAsDataURL(file);
    });
  }
}

// 12. SYNC JHS 3 MOCK EXAM RECORDS
export async function fetchSupabaseJHSMockExams(): Promise<JHSMockExamRecord[] | null> {
  const client = getSupabaseClient();
  if (!client) {
    const cached = localStorage.getItem('mock_supabase_ea_jhs_mock_records') || localStorage.getItem('ea_jhs_mock_records');
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return null;
  }
  try {
    const { data, error } = await client.from('ea_jhs_mock_exams').select('*');
    if (error) {
      console.warn('Supabase fetch JHS mock exams error:', error);
      const cached = localStorage.getItem('mock_supabase_ea_jhs_mock_records') || localStorage.getItem('ea_jhs_mock_records');
      if (cached !== null) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
      }
      return null;
    }
    if (!data) return [];

    const mapped: JHSMockExamRecord[] = data.map((item) => ({
      id: item.id || `mock_${item.student_id}_${item.exam_title}`,
      studentId: item.student_id,
      studentName: item.student_name,
      rollNumber: item.roll_number || '',
      className: item.class_name || 'JHS 3',
      examTitle: item.exam_title || 'Mock Examination 1',
      academicYear: item.academic_year || '2025/2026',
      scores: typeof item.scores === 'object' && item.scores !== null ? item.scores : {},
      remarks: item.remarks || '',
      updatedBy: item.updated_by || '',
      updatedAt: item.updated_at || new Date().toISOString()
    }));

    localStorage.setItem('mock_supabase_ea_jhs_mock_records', JSON.stringify(mapped));
    localStorage.setItem('ea_jhs_mock_records', JSON.stringify(mapped));
    return mapped;
  } catch (err: any) {
    console.warn('fetchSupabaseJHSMockExams exception:', err);
    const cached = localStorage.getItem('mock_supabase_ea_jhs_mock_records') || localStorage.getItem('ea_jhs_mock_records');
    if (cached !== null) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return null;
  }
}

export async function saveSupabaseJHSMockExams(records: JHSMockExamRecord[]): Promise<boolean> {
  localStorage.setItem('mock_supabase_ea_jhs_mock_records', JSON.stringify(records));
  localStorage.setItem('ea_jhs_mock_records', JSON.stringify(records));
  try {
    window.dispatchEvent(new Event('ea_jhs_mock_updated'));
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const payloads = records.map((r) => ({
      id: r.id,
      student_id: r.studentId,
      student_name: r.studentName,
      roll_number: r.rollNumber || '',
      class_name: r.className || 'JHS 3',
      exam_title: r.examTitle || 'Mock Examination 1',
      academic_year: r.academicYear || '2025/2026',
      scores: r.scores || {},
      remarks: r.remarks || '',
      updated_by: r.updatedBy || '',
      updated_at: r.updatedAt || new Date().toISOString()
    }));

    const { error } = await safeUpsert('ea_jhs_mock_exams', payloads, client, 'id');
    if (error) {
      console.warn('Supabase saveSupabaseJHSMockExams error:', error);
      return true;
    }
    return true;
  } catch (err: any) {
    console.warn('saveSupabaseJHSMockExams exception:', err);
    return true;
  }
}

// ==========================================
// 15. BOOKS STOCK & CUSTOMISED EXERCISE BOOKS
// ==========================================

// Helper to track deleted book stock IDs in localStorage
export function getDeletedBookStockIds(): string[] {
  try {
    const saved = localStorage.getItem('ea_deleted_book_stock_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim());
    }
  } catch (e) {}
  return [];
}

export function recordDeletedBookStockId(id: string): void {
  if (!id) return;
  const cleanId = String(id).trim();
  if (!cleanId) return;
  try {
    const current = getDeletedBookStockIds();
    const exists = current.some((c) => c.toLowerCase() === cleanId.toLowerCase());
    if (!exists) {
      localStorage.setItem('ea_deleted_book_stock_ids', JSON.stringify([...current, cleanId]));
    }
  } catch (e) {}
}

export function getDeletedBookSaleIds(): string[] {
  try {
    const saved = localStorage.getItem('ea_deleted_book_sales_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed.map((s) => String(s).trim());
    }
  } catch (e) {}
  return [];
}

export function recordDeletedBookSaleId(id: string): void {
  if (!id) return;
  const cleanId = String(id).trim();
  if (!cleanId) return;
  try {
    const current = getDeletedBookSaleIds();
    const exists = current.some((c) => c.toLowerCase() === cleanId.toLowerCase());
    if (!exists) {
      localStorage.setItem('ea_deleted_book_sales_ids', JSON.stringify([...current, cleanId]));
    }
  } catch (e) {}
}

export async function fetchSupabaseBookStock(): Promise<BookStockItem[]> {
  const deletedIdsList = getDeletedBookStockIds();
  const deletedIdsLower = new Set(deletedIdsList.map((id) => id.toLowerCase()));

  const filterDeleted = (list: BookStockItem[]) => {
    if (!Array.isArray(list)) return [];
    if (deletedIdsLower.size === 0) return list;
    return list.filter((i) => i && i.id && !deletedIdsLower.has(String(i.id).trim().toLowerCase()));
  };

  const isInitialized = localStorage.getItem('ea_book_stock_initialized') === 'true';

  let cachedItems: BookStockItem[] | null = null;
  try {
    const cached = localStorage.getItem('ea_book_stock_items') || localStorage.getItem('mock_supabase_ea_book_stock');
    if (cached !== null && cached !== undefined) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        cachedItems = filterDeleted(parsed);
      }
    }
  } catch (e) {
    console.warn('Error reading book stock from localStorage:', e);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const fetchPromise = client.from('ea_book_stock').select('*').order('created_at', { ascending: false });
      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), 4000)
      );
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!error && Array.isArray(data)) {
        const mapped: BookStockItem[] = data.map((d: any) => ({
          id: String(d.id || '').trim(),
          title: d.title || 'Untitled',
          category: d.category || 'Textbook',
          publication: d.publication || 'General',
          subjectType: d.subject_type || 'General',
          targetClass: d.target_class || 'All Classes',
          unitPrice: Number(d.unit_price) || 0,
          costPrice: d.cost_price !== undefined ? Number(d.cost_price) : undefined,
          quantityInStock: Number(d.quantity_in_stock) || 0,
          quantitySold: Number(d.quantity_sold) || 0,
          quantityRemaining: Number(d.quantity_remaining) || 0,
          lowStockThreshold: Number(d.low_stock_threshold) || 20,
          shelfLocation: d.shelf_location || '',
          notes: d.notes || '',
          createdAt: d.created_at || new Date().toISOString(),
          updatedAt: d.updated_at || new Date().toISOString()
        }));

        if (deletedIdsLower.size > 0) {
          const recordsToPurge = mapped.filter((b) => b.id && deletedIdsLower.has(b.id.toLowerCase()));
          if (recordsToPurge.length > 0) {
            const purgeIds = recordsToPurge.map((b) => b.id);
            client.from('ea_book_stock').delete().in('id', purgeIds).then(() => {});
          }
        }

        const clean = filterDeleted(mapped);
        localStorage.setItem('ea_book_stock_items', JSON.stringify(clean));
        localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(clean));
        localStorage.setItem('ea_book_stock_initialized', 'true');
        localStorage.setItem('ea_book_stock_seeded', 'true');
        return clean;
      }
    } catch (err) {
      console.warn('fetchSupabaseBookStock exception:', err);
    }
  }

  if (cachedItems !== null) {
    return cachedItems;
  }

  // If already initialized, respect empty state and do not restore defaults
  if (isInitialized) {
    return [];
  }

  // Fallback to defaults only on initial setup if never initialized
  try {
    const initial = filterDeleted(DEFAULT_BOOK_STOCK_ITEMS);
    localStorage.setItem('ea_book_stock_items', JSON.stringify(initial));
    localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(initial));
    localStorage.setItem('ea_book_stock_initialized', 'true');
    localStorage.setItem('ea_book_stock_seeded', 'true');
    return initial;
  } catch (e) {}
  return [];
}

export async function saveSupabaseBookStock(items: BookStockItem[], deletedIds?: string[]): Promise<boolean> {
  const activeDeletedList = getDeletedBookStockIds();
  const activeDeletedLower = new Set(activeDeletedList.map((id) => id.toLowerCase()));

  const cleanItems = (items || []).filter(
    (b) => b && b.id && !activeDeletedLower.has(String(b.id).trim().toLowerCase())
  );

  try {
    localStorage.setItem('ea_book_stock_items', JSON.stringify(cleanItems));
    localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(cleanItems));
    localStorage.setItem('ea_book_stock_initialized', 'true');
    localStorage.setItem('ea_book_stock_seeded', 'true');
    window.dispatchEvent(new Event('ea_book_stock_updated'));
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const allDeletedToPurge = Array.from(new Set([...(deletedIds || []), ...activeDeletedList]));
    if (allDeletedToPurge.length > 0) {
      try {
        const purgePromise = client.from('ea_book_stock').delete().in('id', allDeletedToPurge);
        const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3500));
        await Promise.race([purgePromise, timeoutPromise]);
      } catch (delErr) {
        console.warn('Error purging deleted book stock items from Supabase:', delErr);
      }
    }

    if (cleanItems.length === 0) {
      return true;
    }

    const payloads = cleanItems.map((b) => ({
      id: String(b.id).trim(),
      title: b.title,
      category: b.category,
      publication: b.publication,
      subject_type: b.subjectType,
      target_class: b.targetClass || 'All Classes',
      unit_price: b.unitPrice,
      cost_price: b.costPrice || 0,
      quantity_in_stock: b.quantityInStock,
      quantity_sold: b.quantitySold,
      quantity_remaining: b.quantityRemaining,
      low_stock_threshold: b.lowStockThreshold || 20,
      shelf_location: b.shelfLocation || '',
      notes: b.notes || '',
      created_at: b.createdAt || new Date().toISOString(),
      updated_at: b.updatedAt || new Date().toISOString()
    }));

    const upsertPromise = safeUpsert('ea_book_stock', payloads, client, 'id');
    const timeoutPromise = new Promise<{ error: any }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'Upsert timeout' } }), 4000)
    );
    const { error } = await Promise.race([upsertPromise, timeoutPromise]);
    if (error) {
      console.warn('saveSupabaseBookStock error:', error);
    }
    return true;
  } catch (err) {
    console.warn('saveSupabaseBookStock exception:', err);
    return true;
  }
}

export async function deleteSupabaseBookStockItem(id: string): Promise<boolean> {
  if (!id) return true;
  const cleanId = String(id).trim();
  if (!cleanId) return true;
  const cleanIdLower = cleanId.toLowerCase();

  // 1. Immediately record in persistent deleted IDs
  recordDeletedBookStockId(cleanId);

  // 2. Immediately update local storage caches so it's gone from local state instantly
  try {
    const cached = localStorage.getItem('ea_book_stock_items') || localStorage.getItem('mock_supabase_ea_book_stock');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (item: BookStockItem) => item && item.id && String(item.id).trim().toLowerCase() !== cleanIdLower
        );
        localStorage.setItem('ea_book_stock_items', JSON.stringify(filtered));
        localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(filtered));
      }
    }
    localStorage.setItem('ea_book_stock_initialized', 'true');
    localStorage.setItem('ea_book_stock_seeded', 'true');
  } catch (e) {
    console.warn('deleteSupabaseBookStockItem localStorage error:', e);
  }

  // 3. Immediately dispatch storage / update event for live UI reactivity
  try {
    window.dispatchEvent(new Event('ea_book_stock_updated'));
  } catch (e) {}

  // 4. Directly sync deletion to Supabase database (with fast non-blocking guard)
  const client = getSupabaseClient();
  if (client) {
    try {
      const deletePromise = Promise.all([
        client.from('ea_book_stock').delete().eq('id', cleanId),
        client.from('ea_book_stock').delete().ilike('id', cleanId)
      ]);
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 600));
      await Promise.race([deletePromise, timeoutPromise]);
    } catch (e) {
      console.warn('deleteSupabaseBookStockItem remote delete exception:', e);
    }
  }

  return true;
}

// ==========================================
// 16. BOOKS SALES & BUYER RECEIPTS
// ==========================================

export async function fetchSupabaseBookSales(): Promise<BookSaleRecord[]> {
  const deletedIdsList = getDeletedBookSaleIds();
  const deletedIdsLower = new Set(deletedIdsList.map((id) => id.toLowerCase()));

  const filterDeleted = (list: BookSaleRecord[]) => {
    if (!Array.isArray(list)) return [];
    if (deletedIdsLower.size === 0) return list;
    return list.filter((s) => s && s.id && !deletedIdsLower.has(String(s.id).trim().toLowerCase()));
  };

  const isInitialized = localStorage.getItem('ea_book_sales_initialized') === 'true';

  let cachedItems: BookSaleRecord[] | null = null;
  try {
    const cached = localStorage.getItem('ea_book_sales_records') || localStorage.getItem('mock_supabase_ea_book_sales');
    if (cached !== null && cached !== undefined) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        cachedItems = filterDeleted(parsed);
      }
    }
  } catch (e) {
    console.warn('Error reading book sales from localStorage:', e);
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const fetchPromise = client.from('ea_book_sales').select('*').order('created_at', { ascending: false });
      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), 4000)
      );
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (!error && Array.isArray(data)) {
        const mapped: BookSaleRecord[] = data.map((d: any) => ({
          id: String(d.id || '').trim(),
          receiptNumber: d.receipt_number,
          buyerName: d.buyer_name,
          buyerType: d.buyer_type || 'Parent',
          studentId: d.student_id || '',
          className: d.class_name || '',
          contactNumber: d.contact_number || '',
          items: Array.isArray(d.items) ? d.items : [],
          subtotal: Number(d.subtotal) || 0,
          discount: Number(d.discount) || 0,
          totalAmount: Number(d.total_amount) || 0,
          paymentMethod: d.payment_method || 'Cash',
          paymentReference: d.payment_reference || '',
          saleDate: d.sale_date,
          saleTime: d.sale_time || '',
          recordedBy: d.recorded_by || 'Administrator',
          remarks: d.remarks || '',
          createdAt: d.created_at || new Date().toISOString(),
          updatedAt: d.updated_at || new Date().toISOString()
        }));

        if (deletedIdsLower.size > 0) {
          const recordsToPurge = mapped.filter((b) => b.id && deletedIdsLower.has(b.id.toLowerCase()));
          if (recordsToPurge.length > 0) {
            const purgeIds = recordsToPurge.map((b) => b.id);
            client.from('ea_book_sales').delete().in('id', purgeIds).then(() => {});
          }
        }

        const clean = filterDeleted(mapped);
        localStorage.setItem('ea_book_sales_records', JSON.stringify(clean));
        localStorage.setItem('mock_supabase_ea_book_sales', JSON.stringify(clean));
        localStorage.setItem('ea_book_sales_initialized', 'true');
        localStorage.setItem('ea_book_sales_seeded', 'true');
        return clean;
      }
    } catch (err) {
      console.warn('fetchSupabaseBookSales exception:', err);
    }
  }

  if (cachedItems !== null) {
    return cachedItems;
  }

  if (isInitialized) {
    return [];
  }

  // Fallback to defaults only on initial setup
  try {
    const initial = filterDeleted(DEFAULT_BOOK_SALES);
    localStorage.setItem('ea_book_sales_records', JSON.stringify(initial));
    localStorage.setItem('mock_supabase_ea_book_sales', JSON.stringify(initial));
    localStorage.setItem('ea_book_sales_initialized', 'true');
    localStorage.setItem('ea_book_sales_seeded', 'true');
    return initial;
  } catch (e) {}
  return [];
}

export async function saveSupabaseBookSales(sales: BookSaleRecord[], deletedIds?: string[]): Promise<boolean> {
  const activeDeletedList = getDeletedBookSaleIds();
  const activeDeletedLower = new Set(activeDeletedList.map((id) => id.toLowerCase()));

  const cleanSales = (sales || []).filter(
    (s) => s && s.id && !activeDeletedLower.has(String(s.id).trim().toLowerCase())
  );

  try {
    localStorage.setItem('ea_book_sales_records', JSON.stringify(cleanSales));
    localStorage.setItem('mock_supabase_ea_book_sales', JSON.stringify(cleanSales));
    localStorage.setItem('ea_book_sales_initialized', 'true');
    localStorage.setItem('ea_book_sales_seeded', 'true');
    window.dispatchEvent(new Event('ea_book_sales_updated'));
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) return true;

  try {
    const allDeletedToPurge = Array.from(new Set([...(deletedIds || []), ...activeDeletedList]));
    if (allDeletedToPurge.length > 0) {
      try {
        const purgePromise = client.from('ea_book_sales').delete().in('id', allDeletedToPurge);
        const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3500));
        await Promise.race([purgePromise, timeoutPromise]);
      } catch (delErr) {
        console.warn('Error purging deleted sales from Supabase:', delErr);
      }
    }

    if (cleanSales.length === 0) {
      return true;
    }

    const payloads = cleanSales.map((s) => ({
      id: String(s.id).trim(),
      receipt_number: s.receiptNumber,
      buyer_name: s.buyerName,
      buyer_type: s.buyerType || 'Parent',
      student_id: s.studentId || '',
      class_name: s.className || '',
      contact_number: s.contactNumber || '',
      items: s.items || [],
      subtotal: s.subtotal,
      discount: s.discount,
      total_amount: s.totalAmount,
      payment_method: s.paymentMethod,
      payment_reference: s.paymentReference || '',
      sale_date: s.saleDate,
      sale_time: s.saleTime || '',
      recorded_by: s.recordedBy || 'Administrator',
      remarks: s.remarks || '',
      created_at: s.createdAt || new Date().toISOString(),
      updated_at: s.updatedAt || new Date().toISOString()
    }));

    const upsertPromise = safeUpsert('ea_book_sales', payloads, client, 'id');
    const timeoutPromise = new Promise<{ error: any }>((resolve) =>
      setTimeout(() => resolve({ error: { message: 'Upsert timeout' } }), 4000)
    );
    const { error } = await Promise.race([upsertPromise, timeoutPromise]);
    if (error) {
      console.warn('saveSupabaseBookSales error:', error);
    }
    return true;
  } catch (err) {
    console.warn('saveSupabaseBookSales exception:', err);
    return true;
  }
}

export async function deleteSupabaseBookSale(id: string): Promise<boolean> {
  if (!id) return true;
  const cleanId = String(id).trim();
  if (!cleanId) return true;
  const cleanIdLower = cleanId.toLowerCase();

  recordDeletedBookSaleId(cleanId);

  try {
    const cached = localStorage.getItem('ea_book_sales_records') || localStorage.getItem('mock_supabase_ea_book_sales');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (item: BookSaleRecord) => item && item.id && String(item.id).trim().toLowerCase() !== cleanIdLower
        );
        localStorage.setItem('ea_book_sales_records', JSON.stringify(filtered));
        localStorage.setItem('mock_supabase_ea_book_sales', JSON.stringify(filtered));
      }
    }
    localStorage.setItem('ea_book_sales_initialized', 'true');
    localStorage.setItem('ea_book_sales_seeded', 'true');
  } catch (e) {}

  try {
    window.dispatchEvent(new Event('ea_book_sales_updated'));
  } catch (e) {}

  const client = getSupabaseClient();
  if (client) {
    try {
      const deletePromise = Promise.all([
        client.from('ea_book_sales').delete().eq('id', cleanId),
        client.from('ea_book_sales').delete().ilike('id', cleanId)
      ]);
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 600));
      await Promise.race([deletePromise, timeoutPromise]);
    } catch (e) {
      console.warn('deleteSupabaseBookSale exception:', e);
    }
  }

  return true;
}
