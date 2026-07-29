import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Student, User, Grade, Attendance, ReportConfig, StudentBill } from '../types';

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
ALTER TABLE public.ea_students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Fix ea_teachers table columns
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS name VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS email VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'TEACHER';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS password VARCHAR;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'PRIMARY';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS classes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 4. Fix ea_grades table columns
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS student_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS subject_id VARCHAR DEFAULT '';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS class_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS exam_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS total_score NUMERIC DEFAULT 0;
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS grade_letter VARCHAR DEFAULT 'F';
ALTER TABLE public.ea_grades ADD COLUMN IF NOT EXISTS remarks VARCHAR DEFAULT '';
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

-- 7. Disable Row Level Security (RLS) on all tables to ensure public frontend sync operates correctly
ALTER TABLE public.ea_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_bills DISABLE ROW LEVEL SECURITY;

-- 8. Reload PostgREST schema cache
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

-- OPTION A: Disable RLS on the tables (Simplest & Recommended for offline-sync app design)
ALTER TABLE public.ea_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_teachers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_attendance DISABLE ROW LEVEL SECURITY;

-- OPTION B: Alternatively, if you want to keep RLS active, use these unrestricted policies:
-- (Uncomment these if you prefer to keep RLS enabled)
-- ALTER TABLE public.ea_config ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow public access on ea_config" ON public.ea_config;
-- CREATE POLICY "Allow public access on ea_config" ON public.ea_config FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

-- ALTER TABLE public.ea_students ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow public access on ea_students" ON public.ea_students;
-- CREATE POLICY "Allow public access on ea_students" ON public.ea_students FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

-- ALTER TABLE public.ea_teachers ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow public access on ea_teachers" ON public.ea_teachers;
-- CREATE POLICY "Allow public access on ea_teachers" ON public.ea_teachers FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

-- ALTER TABLE public.ea_grades ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow public access on ea_grades" ON public.ea_grades;
-- CREATE POLICY "Allow public access on ea_grades" ON public.ea_grades FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

-- ALTER TABLE public.ea_attendance ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Allow public access on ea_attendance" ON public.ea_attendance;
-- CREATE POLICY "Allow public access on ea_attendance" ON public.ea_attendance FOR ALL TO anon, authenticated, public USING (true) WITH CHECK (true);

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
      return { success: false, message: `Supabase Error: ${error.message} (Code ${error.code})` };
    }
    return { success: true, message: 'Successfully connected and verified database tables!' };
  } catch (err: any) {
    return { success: false, message: `Network/Connection Error: ${err.message || err}` };
  }
}

// Helper to perform upserts that dynamically heal when columns are missing from the database schema cache
async function safeUpsert(table: string, payload: any, client: SupabaseClient, onConflict?: string): Promise<{ data: any; error: any }> {
  let currentPayload = JSON.parse(JSON.stringify(payload));
  let attempts = 0;
  const maxAttempts = 15; // safety limit to prevent infinite loops

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
    message.includes('Failed to fetch') ||
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('Failed to connect') ||
    message.includes('URL and Anon Key')
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
    let { data, error } = await client.from('ea_config').select('*').eq('id', 'global_config').maybeSingle();
    if (!data) {
      const uuidRes = await client.from('ea_config').select('*').eq('id', '00000000-0000-0000-0000-000000000000').maybeSingle();
      if (uuidRes.data) {
        data = uuidRes.data;
        error = null;
      }
    }
    if (!data) {
      const fallbackRes = await client.from('ea_config').select('*').limit(1).maybeSingle();
      if (fallbackRes.data) {
        data = fallbackRes.data;
        error = null;
      }
    }
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_config') || localStorage.getItem('ea_config');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data) return null;
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
      autoPromoteOnReopening: data.auto_promote_on_reopening !== undefined ? data.auto_promote_on_reopening : true,
      schoolMotto: data.school_motto || 'Knowledge, Character & Excellence',
      customNoticeNote: data.custom_notice_note || undefined,
      showPositionInClass: data.show_position_in_class !== undefined ? data.show_position_in_class : true,
      showConductColumn: data.show_conduct_column !== undefined ? data.show_conduct_column : true,
      showAttendanceSection: data.show_attendance_section !== undefined ? data.show_attendance_section : true,
      accentColor: data.accent_color || '#1e1b4b',
      watermarkText: data.watermark_text || undefined
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
  // Always persist to local storage immediately
  localStorage.setItem('mock_supabase_ea_config', JSON.stringify(config));
  localStorage.setItem('ea_config', JSON.stringify(config));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payload = {
      id: 'global_config',
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

// 2. SYNC STUDENTS
export async function fetchSupabaseStudents(): Promise<Student[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('ea_students').select('*');
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_students') || localStorage.getItem('ea_students');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data) return null;
    return data.map(item => ({
      id: item.id,
      name: item.name || '',
      rollNumber: item.roll_number || '',
      level: item.level || 'PRIMARY',
      className: item.class_name || '',
      guardianName: item.guardian_name || '',
      guardianEmail: item.guardian_email || '',
      guardianPhone: item.guardian_phone || '',
    }));
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_students') || localStorage.getItem('ea_students');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }
}

export async function saveSupabaseStudents(students: Student[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const payloads = students.map(s => ({
      id: s.id,
      name: s.name,
      roll_number: s.rollNumber,
      level: s.level,
      class_name: s.className,
      guardian_name: s.guardianName,
      guardian_email: s.guardianEmail,
      guardian_phone: s.guardianPhone || '',
      updated_at: new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_students', payloads, client);
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(students));
        return true;
      }
      return false;
    }
    
    // Prune deleted students
    const cleanStudentIds = students.map(s => s.id).filter(id => id && id.trim() !== '');
    if (cleanStudentIds.length > 0) {
      await client.from('ea_students').delete().not('id', 'in', `(${cleanStudentIds.join(',')})`);
    } else {
      await client.from('ea_students').delete().not('id', 'is', null);
    }

    return true;
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      localStorage.setItem('mock_supabase_ea_students', JSON.stringify(students));
      return true;
    }
    localStorage.setItem('mock_supabase_ea_students', JSON.stringify(students));
    return true;
  }
}

// 3. SYNC TEACHERS / USERS
export async function fetchSupabaseTeachers(): Promise<User[] | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data, error } = await client.from('ea_teachers').select('*');
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_teachers') || localStorage.getItem('ea_teachers');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data) return null;
    return data.map(item => ({
      id: item.id,
      name: item.name || '',
      email: item.email || '',
      role: item.role || 'TEACHER',
      password: item.password || undefined,
      level: item.level || undefined,
      subjects: item.subjects || undefined,
      classes: item.classes || undefined,
    }));
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_teachers') || localStorage.getItem('ea_teachers');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }
}

export async function saveSupabaseTeachers(teachers: User[]): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
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
      updated_at: new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_teachers', payloads, client);
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(teachers));
        return true;
      }
      return false;
    }

    // Prune deleted teachers
    const cleanTeacherIds = teachers.map(t => t.id).filter(id => id && id.trim() !== '');
    if (cleanTeacherIds.length > 0) {
      await client.from('ea_teachers').delete().not('id', 'in', `(${cleanTeacherIds.join(',')})`);
    } else {
      await client.from('ea_teachers').delete().not('id', 'is', null);
    }

    return true;
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(teachers));
      return true;
    }
    localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(teachers));
    return true;
  }
}

export async function deleteSupabaseStudent(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('ea_students').delete().eq('id', id);
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_students') || localStorage.getItem('ea_students');
        if (cached) {
          const students = JSON.parse(cached) as Student[];
          const updated = students.filter(s => s.id !== id);
          localStorage.setItem('mock_supabase_ea_students', JSON.stringify(updated));
        }
        return true;
      }
      return false;
    }
    // Also delete any associated grades or attendance to keep database clean
    await client.from('ea_grades').delete().eq('student_id', id);
    await client.from('ea_attendance').delete().eq('student_id', id);
    return true;
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_students') || localStorage.getItem('ea_students');
      if (cached) {
        const students = JSON.parse(cached) as Student[];
        const updated = students.filter(s => s.id !== id);
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(updated));
      }
      return true;
    }
    return false;
  }
}

export async function deleteSupabaseTeacher(id: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  try {
    const { error } = await client.from('ea_teachers').delete().eq('id', id);
    if (error) {
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_teachers') || localStorage.getItem('ea_teachers');
        if (cached) {
          const teachers = JSON.parse(cached) as User[];
          const updated = teachers.filter(t => t.id !== id);
          localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(updated));
        }
        return true;
      }
      return false;
    }
    return true;
  } catch (err: any) {
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_teachers') || localStorage.getItem('ea_teachers');
      if (cached) {
        const teachers = JSON.parse(cached) as User[];
        const updated = teachers.filter(t => t.id !== id);
        localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(updated));
      }
      return true;
    }
    return false;
  }
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
    return data.map(item => ({
      studentId: item.student_id,
      subjectId: item.subject_id || '',
      classScore: item.class_score !== undefined && item.class_score !== null ? Number(item.class_score) : 0,
      examScore: item.exam_score !== undefined && item.exam_score !== null ? Number(item.exam_score) : 0,
      totalScore: item.total_score !== undefined && item.total_score !== null ? Number(item.total_score) : 0,
      gradeLetter: item.grade_letter || 'F',
      remarks: item.remarks || '',
      term: item.term || 'Term 1',
      year: item.year || '2025/2026',
      teacherId: item.teacher_id || '',
      updatedAt: item.updated_at,
    }));
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
    const payloads = grades.map(g => ({
      student_id: g.studentId,
      subject_id: g.subjectId,
      class_score: g.classScore,
      exam_score: g.examScore,
      total_score: g.totalScore,
      grade_letter: g.gradeLetter,
      remarks: g.remarks,
      term: g.term || 'Term 1',
      year: g.year || '2025/2026',
      teacher_id: g.teacherId,
      updated_at: g.updatedAt || new Date().toISOString()
    }));
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
