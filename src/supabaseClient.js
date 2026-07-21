import { createClient } from '@supabase/supabase-js';

// === SUPABASE CONNECTION CONFIGURATION ===
// You can replace the values inside the quotes below with your custom Supabase Project details.

const SUPABASE_URL = "https://tbzepahgztyjrnknpfqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiemVwYWhnenR5anJua25wZnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjcxNjYsImV4cCI6MjEwMDIwMzE2Nn0.Jq87AWN9Hq-kABasG2TM4qc_ZTJXKqSH16BuHL9yEV4";

// Exported client instance for database queries and authentication
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
