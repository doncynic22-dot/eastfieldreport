import { createClient } from '@supabase/supabase-js';

// === SUPABASE CONNECTION CONFIGURATION ===
// You can replace the values inside the quotes below with your custom Supabase Project details:
const SUPABASE_URL = "https://tbzepahgztyjrnknpfqh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiemVwYWhnenR5anJua25wZnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjcxNjYsImV4cCI6MjEwMDIwMzE2Nn0.Jq87AWN9Hq-kABasG2TM4qc_ZTJXKqSH16BuHL9yEV4";

// Clean and normalize URL in case of template brackets or missing protocol
const cleanUrl = SUPABASE_URL.replace(/^{{\s*|\s*}}$/g, '').trim();
const normalizedUrl = cleanUrl.startsWith('http') ? cleanUrl : `https://${cleanUrl}`;
const normalizedKey = SUPABASE_ANON_KEY.replace(/^{{\s*|\s*}}$/g, '').trim();

// Exported client instance for database queries and real-time synchronization
export const supabase = createClient(normalizedUrl, normalizedKey);
