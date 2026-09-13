-- Eastfield Academy: additive migration for JHS Terminal Assessment History
-- Run this once in the Supabase SQL Editor. It does not delete existing data.

CREATE TABLE IF NOT EXISTS public.ea_jhs_terminal_assessments (
  id VARCHAR PRIMARY KEY,
  student_id VARCHAR NOT NULL,
  student_name VARCHAR NOT NULL,
  roll_number VARCHAR,
  class_name VARCHAR DEFAULT 'JHS 1',
  academic_year VARCHAR DEFAULT '2025/2026',
  term VARCHAR DEFAULT 'Term 3',
  scores JSONB DEFAULT '{}'::jsonb,
  overall_average NUMERIC,
  promotional_status VARCHAR DEFAULT 'PENDING',
  teacher_remarks TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ea_jhs_terminal_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access on ea_jhs_terminal_assessments"
  ON public.ea_jhs_terminal_assessments;
CREATE POLICY "Allow public access on ea_jhs_terminal_assessments"
  ON public.ea_jhs_terminal_assessments
  FOR ALL TO anon, authenticated, public
  USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.ea_jhs_terminal_assessments
  TO anon, authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ea_jhs_terminal_assessments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_jhs_terminal_assessments;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
