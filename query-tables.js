import { createClient } from '@supabase/supabase-js';

const url = "https://tigcnyawfhcxcdjqdfaf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZ2NueWF3ZmhjeGNkanFkZmFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNjY3MDksImV4cCI6MjA5OTg0MjcwOX0.Zt0-yT0RHcjzVsuC1ngohpU1SJfX8O1RtRafosEFZvc";

const supabase = createClient(url, key);

async function run() {
  const tables = ['ea_config', 'ea_students', 'ea_teachers', 'ea_grades', 'ea_attendance'];
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select('*').limit(1);
      if (error) {
        console.log(`Table ${t} error:`, error.message, `(Code: ${error.code})`);
      } else {
        console.log(`Table ${t} row keys:`, data.length > 0 ? Object.keys(data[0]) : "No rows (table exists)");
      }
    } catch (err) {
      console.error(`Table ${t} crash:`, err);
    }
  }
}
run();
