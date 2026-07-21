import { createClient } from '@supabase/supabase-js';

const url = "https://tigcnyawfhcxcdjqdfaf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZ2NueWF3ZmhjeGNkanFkZmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjY3MDksImV4cCI6MjA5OTg0MjcwOX0.Zt0-yT0RHcjzVsuC1ngohpU1SJfX8O1RtRafosEFZvc";

const supabase = createClient(url, key);

async function run() {
  console.log("=== CHECKING EA_CONFIG ===");
  try {
    const { data, error } = await supabase.from('ea_config').insert({
      id: 'inspect_config_id',
      school_name: 'Test',
      school_year: '2025/2026',
      term: 'Term 1',
      principal_name: 'Principal',
      grading_scale: []
    }).select('*');
    if (error) {
      console.log("ea_config Insert Error:", error.message, `(Code: ${error.code})`);
      if (error.details) console.log("Details:", error.details);
    } else {
      console.log("ea_config inserted successfully! Column keys:", Object.keys(data[0]));
    }
  } catch (err) {
    console.error("ea_config crashed:", err);
  }

  console.log("\n=== CHECKING EA_STUDENTS ===");
  try {
    const { data, error } = await supabase.from('ea_students').insert({
      id: 'inspect_student_id',
      name: 'Test Student',
      roll_number: 'ST-TEST',
      level: 'PRIMARY',
      guardian_name: 'Guardian',
      guardian_email: 'guardian@test.com'
    }).select('*');
    if (error) {
      console.log("ea_students Insert Error:", error.message, `(Code: ${error.code})`);
      if (error.details) console.log("Details:", error.details);
    } else {
      console.log("ea_students inserted successfully! Column keys:", Object.keys(data[0]));
    }
  } catch (err) {
    console.error("ea_students crashed:", err);
  }

  console.log("\n=== CHECKING EA_TEACHERS ===");
  try {
    const { data, error } = await supabase.from('ea_teachers').insert({
      id: 'inspect_teacher_id',
      name: 'Teacher Name',
      email: 'teacher@test.com',
      role: 'TEACHER'
    }).select('*');
    if (error) {
      console.log("ea_teachers Insert Error:", error.message, `(Code: ${error.code})`);
      if (error.details) console.log("Details:", error.details);
    } else {
      console.log("ea_teachers inserted successfully! Column keys:", Object.keys(data[0]));
    }
  } catch (err) {
    console.error("ea_teachers crashed:", err);
  }

  console.log("\n=== CHECKING EA_GRADES ===");
  try {
    const { data, error } = await supabase.from('ea_grades').insert({
      student_id: 'inspect_student_id',
      subject_id: 'sub-test',
      term: 'Term 1',
      year: '2025/2026',
      remarks: 'remarks',
      teacher_id: 'inspect_teacher_id'
    }).select('*');
    if (error) {
      console.log("ea_grades Insert Error:", error.message, `(Code: ${error.code})`);
      if (error.details) console.log("Details:", error.details);
    } else {
      console.log("ea_grades inserted successfully! Column keys:", Object.keys(data[0]));
    }
  } catch (err) {
    console.error("ea_grades crashed:", err);
  }

  console.log("\n=== CHECKING EA_ATTENDANCE ===");
  try {
    const { data, error } = await supabase.from('ea_attendance').insert({
      student_id: 'inspect_student_id',
      term: 'Term 1',
      year: '2025/2026',
      remarks: 'remarks',
      teacher_id: 'inspect_teacher_id'
    }).select('*');
    if (error) {
      console.log("ea_attendance Insert Error:", error.message, `(Code: ${error.code})`);
      if (error.details) console.log("Details:", error.details);
    } else {
      console.log("ea_attendance inserted successfully! Column keys:", Object.keys(data[0]));
    }
  } catch (err) {
    console.error("ea_attendance crashed:", err);
  }

  // Cleanup
  console.log("\n=== CLEANING UP ===");
  try {
    await supabase.from('ea_config').delete().eq('id', 'inspect_config_id');
    await supabase.from('ea_students').delete().eq('id', 'inspect_student_id');
    await supabase.from('ea_teachers').delete().eq('id', 'inspect_teacher_id');
    await supabase.from('ea_grades').delete().eq('student_id', 'inspect_student_id');
    await supabase.from('ea_attendance').delete().eq('student_id', 'inspect_student_id');
    console.log("Cleanup completed.");
  } catch (err) {
    console.error("Cleanup failed:", err);
  }
}
run();
