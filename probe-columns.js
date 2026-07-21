import { createClient } from '@supabase/supabase-js';

const url = "https://tigcnyawfhcxcdjqdfaf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZ2NueWF3ZmhjeGNkanFkZmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjY3MDksImV4cCI6MjA5OTg0MjcwOX0.Zt0-yT0RHcjzVsuC1ngohpU1SJfX8O1RtRafosEFZvc";

const supabase = createClient(url, key);

async function probeColumns(table, columns) {
  console.log(`\n=== Probing Table: ${table} ===`);
  const existing = [];
  const missing = [];
  for (const col of columns) {
    const { error } = await supabase.from(table).select(col).limit(1);
    if (error) {
      if (error.code === 'PGRST204') {
        missing.push(col);
      } else {
        console.log(`  Column '${col}' error: ${error.message} (Code: ${error.code})`);
      }
    } else {
      existing.push(col);
    }
  }
  console.log("  Existing:", existing);
  console.log("  Missing:", missing);
}

async function run() {
  await probeColumns('ea_config', [
    'id', 'school_name', 'school_year', 'term', 'principal_name', 
    'principal_signature_url', 'school_logo_text', 'school_logo_url', 
    'class_score_weight', 'exam_score_weight', 'grading_scale', 
    'report_template', 'updated_at'
  ]);

  await probeColumns('ea_students', [
    'id', 'name', 'roll_number', 'level', 'class_name', 
    'guardian_name', 'guardian_email', 'updated_at'
  ]);

  await probeColumns('ea_teachers', [
    'id', 'name', 'email', 'role', 'password', 'level', 
    'subjects', 'classes', 'updated_at'
  ]);

  await probeColumns('ea_grades', [
    'student_id', 'subject_id', 'class_score', 'exam_score', 
    'total_score', 'grade_letter', 'remarks', 'term', 'year', 
    'teacher_id', 'updated_at'
  ]);

  await probeColumns('ea_attendance', [
    'student_id', 'term', 'year', 'total_days', 'days_present', 
    'remarks', 'teacher_id', 'updated_at'
  ]);
}
run();
