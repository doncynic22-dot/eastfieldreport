import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getSupabaseCredentials() {
  const defaultUrl = "https://tbzepahgztyjrnknpfqh.supabase.co";
  const defaultKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiemVwYWhnenR5anJua25wZnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjcxNjYsImV4cCI6MjA5OTg0MjcwOX0.Jq87AWN9Hq-kABasG2TM4qc_ZTJXKqSH16BuHL9yEV4";

  // @ts-ignore
  const rawEnvUrl = import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.SUPABASE_URL || (typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL) : '') || '';
  // @ts-ignore
  const rawEnvKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY) : '') || '';
  const envUrl = (rawEnvUrl && !rawEnvUrl.includes('tigcnyawfhcxcdjqdfaf')) ? rawEnvUrl : '';
  const envKey = (rawEnvUrl && !rawEnvUrl.includes('tigcnyawfhcxcdjqdfaf')) ? rawEnvKey : '';
  
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

  return { url, key };
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

function getClientInstance(): SupabaseClient {
  const { url, key } = getSupabaseCredentials();
  if (!cachedClient || url !== lastUrl || key !== lastKey) {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
    lastUrl = url;
    lastKey = key;
  }
  return cachedClient;
}

export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getClientInstance();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
}) as SupabaseClient;
