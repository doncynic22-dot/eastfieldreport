import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Student, User, Grade, Attendance, ReportConfig, StudentBill, FeePayment, FeeStructureItem, DailyCollectionSummary, SyncAuditLog, ClassroomInventoryRecord, JHSMockExamRecord, BookStockItem, BookSaleRecord, DailyAttendanceRecord, DailyAttendanceStatus } from '../types';
import { DEFAULT_INVENTORY_DATA, DEFAULT_BOOK_STOCK_ITEMS, DEFAULT_BOOK_SALES } from '../data/mockData';
import { isDemoStudent } from '../data/demoPupils';
import { fetchServerEntity, saveServerEntity, globalSyncEngine, getAntiCacheHeaders, syncStudentAdditionToCDN, syncStudentDeletionToCDN, uploadAssetToCDN } from './globalSync';

// Helper to retrieve credentials from env or localStorage
export function getSupabaseCredentials() {
  const defaultUrl = "https://tbzepahgztyjrnknpfqh.supabase.co";
  const defaultKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRiemVwYWhnenR5anJua25wZnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2MjcxNjYsImV4cCI6MjEwMDIwMzE2Nn0.Jq87AWN9Hq-kABasG2TM4qc_ZTJXKqSH16BuHL9yEV4";

  // @ts-ignore
  const rawEnvUrl = import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.SUPABASE_URL || (typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL) : '') || '';
  // @ts-ignore
  const rawEnvKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? (process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY) : '') || '';
  const envUrl = (rawEnvUrl && !rawEnvUrl.includes('tigcnyawfhcxcdjqdfaf')) ? rawEnvUrl : '';
  const envKey = (rawEnvKey && !rawEnvKey.includes('tigcnyawfhcxcdjqdfaf') && !rawEnvKey.includes('2099842709')) ? rawEnvKey : '';
  
  let localUrl = '';
  let localKey = '';
  try {
    localUrl = localStorage.getItem('ea_supabase_url') || '';
    localKey = localStorage.getItem('ea_supabase_anon_key') || '';
    
    // Automatically clear stale/paused old Supabase projects or expired/corrupted keys from localStorage
    if (localUrl && (localUrl.includes('tigcnyawfhcxcdjqdfaf') || localUrl.trim() === '')) {
      localStorage.removeItem('ea_supabase_url');
      localUrl = '';
    }
    if (localKey && (localKey.includes('2099842709') || localKey.includes('tigcnyawfhcxcdjqdfaf') || localKey.trim() === '')) {
      localStorage.removeItem('ea_supabase_anon_key');
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

// =========================================================================
// REAL-TIME SYNCHRONIZATION & AUTO-SYNC ENGINE
// =========================================================================
let globalRealtimeChannel: RealtimeChannel | null = null;
const realtimeListeners: Set<(info: { table: string; eventType: string; payload?: any }) => void> = new Set();
let isRealtimeSubscribed = false;
let lastRealtimeEventTime: number | null = null;
let lastRealtimeError: string | null = null;
let crossTabBroadcastChannel: BroadcastChannel | null = null;

// Initialize cross-tab BroadcastChannel for zero-latency multi-tab sync
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    crossTabBroadcastChannel = new BroadcastChannel('ea_global_sync_broadcast');
    crossTabBroadcastChannel.onmessage = (event) => {
      const data = event.data;
      if (data && data.table) {
        lastRealtimeEventTime = Date.now();
        realtimeListeners.forEach((listener) => {
          try {
            listener({ table: data.table, eventType: 'CROSS_TAB_BROADCAST', payload: data });
          } catch (e) {
            console.warn('Realtime listener error:', e);
          }
        });
      }
    };
  } catch (e) {
    // BroadcastChannel unsupported or blocked
  }
}

// Storage event listener for fallback cross-tab sync in older contexts
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key && (event.key.startsWith('ea_') || event.key.startsWith('mock_supabase_ea_'))) {
      const cleanKey = event.key.replace(/^mock_supabase_/, '').replace(/^ea_/, '');
      lastRealtimeEventTime = Date.now();
      realtimeListeners.forEach((listener) => {
        try {
          listener({ table: cleanKey, eventType: 'STORAGE_EVENT', payload: { key: event.key } });
        } catch (e) {}
      });
    }
  });

  window.addEventListener('ea_global_sync_internal', ((event: CustomEvent) => {
    const detail = event.detail;
    if (detail && detail.table) {
      lastRealtimeEventTime = Date.now();
      realtimeListeners.forEach((listener) => {
        try {
          listener({ table: detail.table, eventType: 'LOCAL_EVENT', payload: detail });
        } catch (e) {}
      });
    }
  }) as EventListener);
}

export function getRealtimeConnectionStatus() {
  return {
    isSubscribed: isRealtimeSubscribed,
    lastEventTime: lastRealtimeEventTime,
    error: lastRealtimeError
  };
}

/**
 * Instantly broadcasts a synchronization event across:
 * 1. Supabase Realtime WebSocket broadcast channel (across internet / devices)
 * 2. HTML5 BroadcastChannel (across all open browser tabs instantly)
 * 3. Window CustomEvents & domain events (for in-memory views and modules)
 */
export function broadcastGlobalSync(table: string, details?: any) {
  lastRealtimeEventTime = Date.now();

  // 1. Send via Supabase Realtime broadcast channel if connected
  try {
    if (globalRealtimeChannel && isRealtimeSubscribed) {
      globalRealtimeChannel.send({
        type: 'broadcast',
        event: 'ea_sync_event',
        payload: { table, timestamp: Date.now(), details }
      }).catch((e) => {
        console.warn('Supabase broadcast send notice:', e);
      });
    }
  } catch (e) {}

  // 2. Send via Cross-tab BroadcastChannel
  try {
    if (crossTabBroadcastChannel) {
      crossTabBroadcastChannel.postMessage({ table, timestamp: Date.now(), details });
    }
  } catch (e) {}

  // 3. Dispatch local in-app CustomEvent
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ea_global_sync_internal', {
        detail: { table, details, timestamp: Date.now() }
      }));

      // Domain-specific legacy events for sub-modules
      if (table === 'ea_students' || table === 'students') {
        if (details?.action === 'DELETE' && (details.id || details.rollNumber || details.studentName)) {
          recordDeletedStudentId(details.id, details.rollNumber, details.studentName);
        }
        window.dispatchEvent(new Event('ea_students_updated'));
      } else if (table === 'ea_inventory' || table === 'inventory') {
        window.dispatchEvent(new Event('ea_inventory_updated'));
      } else if (table === 'ea_book_stock' || table === 'book_stock') {
        window.dispatchEvent(new Event('ea_book_stock_updated'));
      } else if (table === 'ea_book_sales' || table === 'book_sales') {
        window.dispatchEvent(new Event('ea_book_sales_updated'));
      }
    }
  } catch (e) {}

  // 4. Also forward through secondary broadcastSync engine
  try {
    const domainMap: Record<string, GlobalSyncDomain> = {
      ea_students: 'students',
      students: 'students',
      ea_teachers: 'teachers',
      teachers: 'teachers',
      ea_grades: 'grades',
      grades: 'grades',
      ea_attendance: 'attendance',
      attendance: 'attendance',
      ea_config: 'config',
      config: 'config',
      ea_bills: 'bills',
      bills: 'bills',
      ea_fee_payments: 'fee_payments',
      fee_payments: 'fee_payments',
      ea_inventory: 'inventory',
      inventory: 'inventory',
      ea_book_stock: 'book_stock',
      book_stock: 'book_stock',
      ea_book_sales: 'book_sales',
      book_sales: 'book_sales',
      ea_deleted_records: 'deleted_records',
      deleted_records: 'deleted_records'
    };
    const mapped = domainMap[table];
    if (mapped) {
      broadcastSync(mapped, details, details?.action === 'DELETE' ? 'delete' : 'update');
    }
  } catch (e) {}
}

/**
 * Subscribes to Real-time auto-synchronization from Supabase Postgres CDC,
 * Realtime broadcasts, and multi-tab sync channels.
 */
export function subscribeToGlobalRealtimeRaw(
  callback: (info: { table: string; eventType: string; payload?: any }) => void
): () => void {
  realtimeListeners.add(callback);

  const client = getSupabaseClient();
  if (client && !globalRealtimeChannel) {
    try {
      globalRealtimeChannel = client
        .channel('ea-global-sync-channel')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public' },
          (payload) => {
            const table = payload.table || 'all';
            const eventType = payload.eventType || 'POSTGRES_CHANGE';
            lastRealtimeEventTime = Date.now();
            realtimeListeners.forEach((listener) => {
              try {
                listener({ table, eventType, payload });
              } catch (e) {}
            });
          }
        )
        .on(
          'broadcast',
          { event: 'ea_sync_event' },
          ({ payload }) => {
            const table = payload?.table || 'all';
            lastRealtimeEventTime = Date.now();
            realtimeListeners.forEach((listener) => {
              try {
                listener({ table, eventType: 'REMOTE_BROADCAST', payload });
              } catch (e) {}
            });
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            isRealtimeSubscribed = true;
            lastRealtimeError = null;
            broadcastGlobalSync('system_connection', { status: 'SUBSCRIBED' });
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            isRealtimeSubscribed = false;
            lastRealtimeError = err?.message || 'Realtime subscription interrupted';
          } else if (status === 'CLOSED') {
            isRealtimeSubscribed = false;
          }
        });
    } catch (err: any) {
      console.warn('Failed to initialize Supabase Realtime channel:', err);
      lastRealtimeError = err?.message || 'Initialization error';
    }
  }

  return () => {
    realtimeListeners.delete(callback);
  };
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, key, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    if (globalRealtimeChannel) {
      try {
        supabaseClientInstance?.removeChannel(globalRealtimeChannel);
      } catch (e) {}
      globalRealtimeChannel = null;
      isRealtimeSubscribed = false;
    }
    supabaseClientInstance = null;
    currentClientUrl = '';
    currentClientKey = '';
    return null;
  }
  
  // Re-create client if credentials changed or client is not yet created
  if (!supabaseClientInstance || supabaseClientInstance.auth === undefined || url !== currentClientUrl || key !== currentClientKey) {
    try {
      if (globalRealtimeChannel) {
        try {
          supabaseClientInstance?.removeChannel(globalRealtimeChannel);
        } catch (e) {}
        globalRealtimeChannel = null;
        isRealtimeSubscribed = false;
      }
      supabaseClientInstance = createClient(url, key, {
        auth: {
          persistSession: false
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
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

export function setCustomSupabaseCredentials(url: string, key: string): boolean {
  try {
    if (url && key) {
      localStorage.setItem('ea_supabase_url', url.trim());
      localStorage.setItem('ea_supabase_anon_key', key.trim());
    } else {
      localStorage.removeItem('ea_supabase_url');
      localStorage.removeItem('ea_supabase_anon_key');
    }
    if (globalRealtimeChannel) {
      try {
        supabaseClientInstance?.removeChannel(globalRealtimeChannel);
      } catch (e) {}
      globalRealtimeChannel = null;
      isRealtimeSubscribed = false;
    }
    supabaseClientInstance = null;
    currentClientUrl = '';
    currentClientKey = '';
    return true;
  } catch (e) {
    return false;
  }
}

export const FRESH_STUDENTS_TABLE_SQL = `-- =========================================================================
-- EASTFIELD ACADEMY: FRESH 'ea_students' TABLE WITH ASSIGNED POLICIES
-- Run this in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- =========================================================================

-- 1. Drop existing table if replacing fresh
DROP TABLE IF EXISTS public.ea_students CASCADE;

-- 2. Re-create the Pupils / Students Table
CREATE TABLE public.ea_students (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  roll_number VARCHAR NOT NULL,
  level VARCHAR NOT NULL DEFAULT 'PRIMARY',
  class_name VARCHAR NOT NULL,
  guardian_name VARCHAR NOT NULL DEFAULT '',
  guardian_email VARCHAR NOT NULL DEFAULT '',
  guardian_phone VARCHAR DEFAULT '',
  photo_url TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create high-speed lookup indexes
CREATE INDEX IF NOT EXISTS idx_ea_students_class ON public.ea_students (class_name);
CREATE INDEX IF NOT EXISTS idx_ea_students_roll ON public.ea_students (roll_number);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ea_students ENABLE ROW LEVEL SECURITY;

-- 5. Create Permissive Assigned Policies for 'anon', 'authenticated', and 'service_role'
-- (Ensures new students added from the web app client or admin portal never get blocked or rejected)
DROP POLICY IF EXISTS "Allow public read access to ea_students" ON public.ea_students;
CREATE POLICY "Allow public read access to ea_students"
ON public.ea_students FOR SELECT
TO anon, authenticated, service_role
USING (true);

DROP POLICY IF EXISTS "Allow public insert access to ea_students" ON public.ea_students;
CREATE POLICY "Allow public insert access to ea_students"
ON public.ea_students FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to ea_students" ON public.ea_students;
CREATE POLICY "Allow public update access to ea_students"
ON public.ea_students FOR UPDATE
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete access to ea_students" ON public.ea_students;
CREATE POLICY "Allow public delete access to ea_students"
ON public.ea_students FOR DELETE
TO anon, authenticated, service_role
USING (true);

-- 6. Grant Table Permissions to All Roles
GRANT ALL ON TABLE public.ea_students TO anon;
GRANT ALL ON TABLE public.ea_students TO authenticated;
GRANT ALL ON TABLE public.ea_students TO service_role;

-- 7. Add to Realtime Publication for Live Cross-Device Sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_students'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_students;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
`;

export const FRESH_TEACHERS_TABLE_SQL = `-- =========================================================================
-- EASTFIELD ACADEMY: 'ea_teachers' TABLE & AUTH SETUP WITH ASSIGNED POLICIES
-- Run this in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- =========================================================================

-- 1. Create or Ensure ea_teachers Table Exists
CREATE TABLE IF NOT EXISTS public.ea_teachers (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL DEFAULT '',
  email VARCHAR NOT NULL DEFAULT '',
  role VARCHAR NOT NULL DEFAULT 'TEACHER',
  password VARCHAR DEFAULT 'password123',
  level VARCHAR NOT NULL DEFAULT 'PRIMARY',
  classes JSONB DEFAULT '[]'::jsonb,
  subjects JSONB DEFAULT '[]'::jsonb,
  date_of_birth VARCHAR DEFAULT '',
  phone_number VARCHAR DEFAULT '',
  qualification VARCHAR DEFAULT '',
  profile_picture TEXT DEFAULT '',
  hometown VARCHAR DEFAULT '',
  ghana_card_number VARCHAR DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS name VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS email VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'TEACHER';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS password VARCHAR DEFAULT 'password123';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS level VARCHAR DEFAULT 'PRIMARY';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS classes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS phone_number VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS qualification VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS profile_picture TEXT DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS hometown VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS ghana_card_number VARCHAR DEFAULT '';
ALTER TABLE public.ea_teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Indexes for Fast Teacher Lookup & Login
CREATE INDEX IF NOT EXISTS idx_ea_teachers_email ON public.ea_teachers (email);
CREATE INDEX IF NOT EXISTS idx_ea_teachers_role ON public.ea_teachers (role);

-- 3. Enable RLS and Configure Open Permissive Policies for anon, authenticated, and service_role
ALTER TABLE public.ea_teachers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to ea_teachers" ON public.ea_teachers;
CREATE POLICY "Allow public read access to ea_teachers"
ON public.ea_teachers FOR SELECT
TO anon, authenticated, service_role
USING (true);

DROP POLICY IF EXISTS "Allow public insert access to ea_teachers" ON public.ea_teachers;
CREATE POLICY "Allow public insert access to ea_teachers"
ON public.ea_teachers FOR INSERT
TO anon, authenticated, service_role
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to ea_teachers" ON public.ea_teachers;
CREATE POLICY "Allow public update access to ea_teachers"
ON public.ea_teachers FOR UPDATE
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete access to ea_teachers" ON public.ea_teachers;
CREATE POLICY "Allow public delete access to ea_teachers"
ON public.ea_teachers FOR DELETE
TO anon, authenticated, service_role
USING (true);

-- 4. Grant Table Permissions to All Roles
GRANT ALL ON TABLE public.ea_teachers TO anon;
GRANT ALL ON TABLE public.ea_teachers TO authenticated;
GRANT ALL ON TABLE public.ea_teachers TO service_role;

-- 5. Auto-confirm any pending unconfirmed Auth users
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

-- 6. Populate All Academy Teaching Staff (13 Teachers across Nursery, KG, Primary, JHS)
INSERT INTO public.ea_teachers (id, name, email, role, password, level, classes, subjects, updated_at)
VALUES
  ('tch-01', 'Kojo Mensah (Nursery 1)', 'nursery@eastfield.com', 'TEACHER', 'password123', 'NURSERY', '["Nursery 1"]'::jsonb, '["sub-n-lit", "sub-n-num"]'::jsonb, now()),
  ('tch-n2', 'Esi Agyeman (Nursery 2)', 'nursery2@eastfield.com', 'TEACHER', 'password123', 'NURSERY', '["Nursery 2"]'::jsonb, '["sub-n-cr", "sub-n-pho"]'::jsonb, now()),
  ('tch-k1', 'Akosua Boakye (KG 1)', 'kg1@eastfield.com', 'TEACHER', 'password123', 'KINDERGARTEN', '["Kindergarten 1"]'::jsonb, '["sub-k-lit", "sub-k-num"]'::jsonb, now()),
  ('tch-k2', 'Kofi Osei (KG 2)', 'kg2@eastfield.com', 'TEACHER', 'password123', 'KINDERGARTEN', '["Kindergarten 2"]'::jsonb, '["sub-k-owop", "sub-k-ca"]'::jsonb, now()),
  ('tch-02', 'Ama Serwaa (Primary 1)', 'primary@eastfield.com', 'TEACHER', 'password123', 'PRIMARY', '["Primary 1"]'::jsonb, '["sub-p-math", "sub-p-eng"]'::jsonb, now()),
  ('tch-p2', 'Kwame Nkrumah (Primary 2)', 'primary2@eastfield.com', 'TEACHER', 'password123', 'PRIMARY', '["Primary 2"]'::jsonb, '["sub-p-math", "sub-p-eng"]'::jsonb, now()),
  ('tch-p3', 'Abena Darko (Primary 3)', 'primary3@eastfield.com', 'TEACHER', 'password123', 'PRIMARY', '["Primary 3"]'::jsonb, '["sub-p-math", "sub-p-sci"]'::jsonb, now()),
  ('tch-p4', 'Yaa Asantewaa (Primary 4)', 'primary4@eastfield.com', 'TEACHER', 'password123', 'PRIMARY', '["Primary 4"]'::jsonb, '["sub-p-eng", "sub-p-soc"]'::jsonb, now()),
  ('tch-p5', 'Kofi Addo (Primary 5)', 'primary5@eastfield.com', 'TEACHER', 'password123', 'PRIMARY', '["Primary 5"]'::jsonb, '["sub-p-math", "sub-p-rme"]'::jsonb, now()),
  ('tch-p6', 'Adwoa Mansa (Primary 6)', 'primary6@eastfield.com', 'TEACHER', 'password123', 'PRIMARY', '["Primary 6"]'::jsonb, '["sub-p-eng", "sub-p-ict"]'::jsonb, now()),
  ('tch-03', 'Kwesi Appiah', 'jhs@eastfield.com', 'TEACHER', 'password123', 'JHS', '[]'::jsonb, '["sub-j-math", "sub-j-ca"]'::jsonb, now()),
  ('tch-04', 'Abena Gyamfi', 'jhs2@eastfield.com', 'TEACHER', 'password123', 'JHS', '[]'::jsonb, '["sub-j-eng", "sub-j-sci"]'::jsonb, now()),
  ('tch-05', 'Yaw Asamoah', 'jhs3@eastfield.com', 'TEACHER', 'password123', 'JHS', '[]'::jsonb, '["sub-j-soc", "sub-j-rme"]'::jsonb, now())
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  password = EXCLUDED.password,
  level = EXCLUDED.level,
  classes = EXCLUDED.classes,
  subjects = EXCLUDED.subjects,
  updated_at = now();

-- 7. Add to Realtime Publication for Live Cross-Device Sync
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_teachers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_teachers;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 8. Refresh Schema Cache
NOTIFY pgrst, 'reload schema';
`;

export const FRESH_BOOK_STOCK_TABLE_SQL = `-- =========================================================================
-- EASTFIELD ACADEMY: 'ea_book_stock' & 'ea_book_sales' TABLES & SYNC SETUP
-- Run this in your Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- Supports Textbooks, Exercise Books, and Customised Academy Stationery
-- =========================================================================

-- 1. Create or Ensure ea_book_stock Table Exists
CREATE TABLE IF NOT EXISTS public.ea_book_stock (
  id VARCHAR PRIMARY KEY,
  title VARCHAR NOT NULL,
  category VARCHAR NOT NULL DEFAULT 'Textbook',
  publication VARCHAR NOT NULL DEFAULT 'General',
  subject_type VARCHAR NOT NULL DEFAULT 'General',
  target_class VARCHAR DEFAULT 'All Classes',
  unit_price NUMERIC(12,2) DEFAULT 0,
  cost_price NUMERIC(12,2) DEFAULT 0,
  quantity_in_stock INTEGER DEFAULT 0,
  quantity_sold INTEGER DEFAULT 0,
  quantity_remaining INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 20,
  shelf_location VARCHAR,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist if table was already partially created
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS title VARCHAR;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS category VARCHAR DEFAULT 'Textbook';
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS publication VARCHAR DEFAULT 'General';
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS subject_type VARCHAR DEFAULT 'General';
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS target_class VARCHAR DEFAULT 'All Classes';
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS quantity_in_stock INTEGER DEFAULT 0;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS quantity_sold INTEGER DEFAULT 0;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS quantity_remaining INTEGER DEFAULT 0;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 20;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS shelf_location VARCHAR;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.ea_book_stock ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Create or Ensure ea_book_sales Table Exists (Receipts & Sales Ledger)
CREATE TABLE IF NOT EXISTS public.ea_book_sales (
  id VARCHAR PRIMARY KEY,
  receipt_number VARCHAR NOT NULL,
  buyer_name VARCHAR NOT NULL,
  buyer_type VARCHAR DEFAULT 'Parent',
  student_id VARCHAR,
  class_name VARCHAR,
  contact_number VARCHAR,
  items JSONB DEFAULT '[]'::jsonb NOT NULL,
  subtotal NUMERIC(12,2) DEFAULT 0,
  discount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  payment_method VARCHAR DEFAULT 'Cash',
  payment_reference VARCHAR,
  sale_date VARCHAR NOT NULL,
  sale_time VARCHAR,
  recorded_by VARCHAR,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS receipt_number VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS buyer_name VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS buyer_type VARCHAR DEFAULT 'Parent';
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS student_id VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS class_name VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS contact_number VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS payment_method VARCHAR DEFAULT 'Cash';
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS payment_reference VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS sale_date VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS sale_time VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS recorded_by VARCHAR;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.ea_book_sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 3. Indexes for Instant Filtering & Multi-Browser Search
CREATE INDEX IF NOT EXISTS idx_ea_book_stock_category ON public.ea_book_stock (category);
CREATE INDEX IF NOT EXISTS idx_ea_book_stock_title ON public.ea_book_stock (title);
CREATE INDEX IF NOT EXISTS idx_ea_book_stock_subject ON public.ea_book_stock (subject_type);
CREATE INDEX IF NOT EXISTS idx_ea_book_stock_class ON public.ea_book_stock (target_class);
CREATE INDEX IF NOT EXISTS idx_ea_book_sales_receipt ON public.ea_book_sales (receipt_number);
CREATE INDEX IF NOT EXISTS idx_ea_book_sales_date ON public.ea_book_sales (sale_date);

-- 4. Disable RLS & Grant Unrestricted API Access for Seamless Frontend Sync
ALTER TABLE public.ea_book_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ea_book_sales DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.ea_book_stock TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.ea_book_sales TO anon, authenticated, service_role;

-- 5. Enable Realtime Publications for Instant Multi-Device Synchronization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_book_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_book_stock;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ea_book_sales'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ea_book_sales;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

ALTER TABLE public.ea_book_stock REPLICA IDENTITY FULL;
ALTER TABLE public.ea_book_sales REPLICA IDENTITY FULL;

-- 6. Reload PostgREST API Schema Cache
NOTIFY pgrst, 'reload schema';
`;

// SQL Script for setting up tables in Supabase Console
export { SUPABASE_SQL_REPAIR, TABLE_SQL_DEFINITIONS, generateSuggestedSqlFix } from './supabaseRepairSql';
import { generateSuggestedSqlFix } from './supabaseRepairSql';

export interface TableHealthStatus {
  table: string;
  displayName: string;
  status: 'healthy' | 'missing' | 'error';
  error?: string;
  errorCode?: string;
  count?: number | null;
  suggestedFix?: string;
}

export interface SupabaseDetailedStatusReport {
  success: boolean;
  isConfigured: boolean;
  isConnected: boolean;
  message: string;
  healthyTables: string[];
  failingTables: TableHealthStatus[];
  allTablesStatus: TableHealthStatus[];
  totalTablesChecked: number;
  healthyCount: number;
  failingCount: number;
  suggestedSqlFix?: string;
  checkedAt: string;
}

export const MONITORED_SUPABASE_TABLES: Array<{ name: string; displayName: string }> = [
  { name: 'ea_config', displayName: 'School Configuration' },
  { name: 'ea_students', displayName: 'Enrolled Pupils / Students' },
  { name: 'ea_teachers', displayName: 'Teachers & Staff' },
  { name: 'ea_grades', displayName: 'Terminal Assessment Grades' },
  { name: 'ea_attendance', displayName: 'Termly Attendance Summaries' },
  { name: 'ea_daily_attendance', displayName: 'Daily Student Attendance' },
  { name: 'ea_bills', displayName: 'Student Bills & Invoices' },
  { name: 'ea_fee_payments', displayName: 'Fee Payment Receipts' },
  { name: 'ea_fee_structures', displayName: 'Class Fee Structures' },
  { name: 'ea_daily_collections', displayName: 'Daily Revenue Collections' },
  { name: 'ea_inventory', displayName: 'School Asset Inventory' },
  { name: 'ea_book_stock', displayName: 'Book & Stationery Stock' },
  { name: 'ea_book_sales', displayName: 'Book Sales Transactions' },
  { name: 'ea_jhs_mock_exams', displayName: 'JHS 3 BECE Mock Exams' },
  { name: 'ea_deleted_records', displayName: 'Audit Deletion Tombstones' },
  { name: 'ea_sync_logs', displayName: 'Sync Activity Logs' },
  { name: 'ea_sync_state', displayName: 'Realtime Sync State' },
  { name: 'ea_notifications', displayName: 'Broadcast Notifications' }
];

export async function checkTableHealth(client: SupabaseClient, table: { name: string; displayName: string }): Promise<TableHealthStatus> {
  try {
    const { error, count } = await client
      .from(table.name)
      .select('count', { count: 'exact', head: true });

    if (!error) {
      return {
        table: table.name,
        displayName: table.displayName,
        status: 'healthy',
        count: typeof count === 'number' ? count : null
      };
    }

    const isMissing = error.code === 'PGRST205' || 
                      error.code === '42P01' || 
                      error.message?.includes('does not exist') ||
                      error.message?.includes('schema cache');

    let fixAdvice = '';
    if (isMissing) {
      fixAdvice = `Table '${table.name}' does not exist in the Supabase schema cache. Run the CREATE TABLE script in Supabase SQL editor.`;
    } else if (error.code === '42501' || error.message?.includes('permission') || error.message?.includes('policy')) {
      fixAdvice = `RLS permission denied on '${table.name}'. Run 'ALTER TABLE public.${table.name} DISABLE ROW LEVEL SECURITY;'.`;
    } else {
      fixAdvice = `Table error (${error.code || 'unknown'}): ${error.message}.`;
    }

    return {
      table: table.name,
      displayName: table.displayName,
      status: isMissing ? 'missing' : 'error',
      error: error.message || 'Unknown database error',
      errorCode: error.code || 'UNKNOWN',
      count: null,
      suggestedFix: fixAdvice
    };
  } catch (err: any) {
    return {
      table: table.name,
      displayName: table.displayName,
      status: 'error',
      error: err.message || 'Network request failed',
      errorCode: 'FETCH_ERROR',
      count: null,
      suggestedFix: 'Supabase cloud endpoint is unreachable or network timeout.'
    };
  }
}

// Helper to verify connection with full table health auditing and suggested SQL fixes
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; report: SupabaseDetailedStatusReport }> {
  const client = getSupabaseClient();
  if (!client) {
    const report: SupabaseDetailedStatusReport = {
      success: false,
      isConfigured: false,
      isConnected: false,
      message: 'Supabase is not configured yet. Please configure URL and Key in Settings.',
      healthyTables: [],
      failingTables: [],
      allTablesStatus: [],
      totalTablesChecked: 0,
      healthyCount: 0,
      failingCount: 0,
      suggestedSqlFix: '',
      checkedAt: new Date().toISOString()
    };
    return { success: false, message: report.message, report };
  }

  try {
    // Audit all monitored tables in parallel
    const tableStatuses: TableHealthStatus[] = await Promise.all(
      MONITORED_SUPABASE_TABLES.map(tbl => checkTableHealth(client, tbl))
    );

    const healthy = tableStatuses.filter(t => t.status === 'healthy');
    const failing = tableStatuses.filter(t => t.status !== 'healthy');
    const failingNames = failing.map(t => t.table);

    const isConnected = tableStatuses.some(t => t.errorCode !== 'FETCH_ERROR') && healthy.length > 0;
    const suggestedSql = generateSuggestedSqlFix(failingNames);

    let message = '';
    if (!isConnected) {
      message = 'Supabase cloud endpoint is unreachable. Local offline storage is active.';
    } else if (failing.length === 0) {
      message = `All ${healthy.length} database tables are healthy and synced!`;
    } else {
      const missingCount = failing.filter(f => f.status === 'missing').length;
      message = `Connected: ${healthy.length} of ${tableStatuses.length} tables healthy. ${failing.length} table${failing.length > 1 ? 's' : ''} require attention (${missingCount} missing).`;
    }

    const report: SupabaseDetailedStatusReport = {
      success: isConnected && failing.length === 0,
      isConfigured: true,
      isConnected,
      message,
      healthyTables: healthy.map(h => h.table),
      failingTables: failing,
      allTablesStatus: tableStatuses,
      totalTablesChecked: tableStatuses.length,
      healthyCount: healthy.length,
      failingCount: failing.length,
      suggestedSqlFix: suggestedSql,
      checkedAt: new Date().toISOString()
    };

    return {
      success: isConnected,
      message,
      report
    };
  } catch (err: any) {
    const report: SupabaseDetailedStatusReport = {
      success: false,
      isConfigured: true,
      isConnected: false,
      message: 'Supabase cloud endpoint is unreachable. Local offline storage is active.',
      healthyTables: [],
      failingTables: [],
      allTablesStatus: [],
      totalTablesChecked: 0,
      healthyCount: 0,
      failingCount: 0,
      suggestedSqlFix: '',
      checkedAt: new Date().toISOString()
    };
    return { success: false, message: report.message, report };
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
  if (!client) {
    const serverConfig = await fetchServerEntity<ReportConfig>('/config');
    if (serverConfig) {
      localStorage.setItem('ea_config', JSON.stringify(serverConfig));
      return serverConfig;
    }
    const cached = localStorage.getItem('mock_supabase_ea_config') || localStorage.getItem('ea_config');
    return cached ? JSON.parse(cached) : null;
  }
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
      const serverConfig = await fetchServerEntity<ReportConfig>('/config');
      if (serverConfig) {
        localStorage.setItem('ea_config', JSON.stringify(serverConfig));
        return serverConfig;
      }
      if (selectErr && isMissingTableOrConnectionError(selectErr)) {
        const cached = localStorage.getItem('mock_supabase_ea_config') || localStorage.getItem('ea_config');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }

    let assignments = data.class_teacher_assignments || data.classTeacherAssignments || undefined;
    if (!assignments || Object.keys(assignments).length === 0) {
      const serverAssignments = await fetchServerEntity<Record<string, string>>('/class-teacher-assignments');
      if (serverAssignments && typeof serverAssignments === 'object' && Object.keys(serverAssignments).length > 0) {
        assignments = serverAssignments;
      }
    }
    if (assignments && typeof assignments === 'object' && Object.keys(assignments).length > 0) {
      try {
        localStorage.setItem('ea_class_teacher_assignments', JSON.stringify(assignments));
      } catch {}
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
      classTeacherAssignments: assignments,
      updatedAt: data.updated_at || undefined
    };
  } catch (err: any) {
    const serverConfig = await fetchServerEntity<ReportConfig>('/config');
    if (serverConfig) {
      localStorage.setItem('ea_config', JSON.stringify(serverConfig));
      return serverConfig;
    }
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

  // Persist to central server database and broadcast to other devices
  saveServerEntity('/config', configWithTimestamp).catch(e => console.warn('[Server Sync Config Notice]', e));
  if (config.classTeacherAssignments && typeof config.classTeacherAssignments === 'object') {
    saveServerEntity('/class-teacher-assignments', config.classTeacherAssignments).catch(e => console.warn('[Server Sync Assignments Notice]', e));
  }

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
      class_teacher_assignments: config.classTeacherAssignments || null,
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

// Helper to track deleted student IDs in localStorage
export function getDeletedStudentIds(): string[] {
  try {
    const saved = localStorage.getItem('ea_deleted_student_ids');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed.filter(x => {
          if (typeof x !== 'string' || !x.trim()) return false;
          const clean = x.trim().toLowerCase();
          // Never allow roll numbers or student names to be tombstoned
          if (clean.includes('/') || clean.includes(' ') || clean.includes('\\')) return false;
          if (clean.startsWith('ea') || clean.startsWith('kg') || /^[a-z]+$/.test(clean)) return false;
          return true;
        });
      }
    }
  } catch (e) {}
  return [];
}

export function recordDeletedStudentId(id: string, _rollNumber?: string, _studentName?: string): void {
  if (!id) return;
  try {
    const current = getDeletedStudentIds();
    const currentLower = new Set(current.map(x => String(x).toLowerCase().trim()));
    const toAdd: string[] = [];

    // ONLY tombstone unique record ID. Roll numbers and pupil names must never be tombstoned.
    const clean = String(id).toLowerCase().trim();
    if (clean && !clean.includes('/') && !clean.includes(' ') && !currentLower.has(clean)) {
      toAdd.push(clean);
      currentLower.add(clean);
    }
    const alphanum = clean.replace(/[^a-z0-9]/g, '');
    if (alphanum && alphanum !== clean && !currentLower.has(alphanum)) {
      toAdd.push(alphanum);
      currentLower.add(alphanum);
    }

    if (toAdd.length > 0) {
      localStorage.setItem('ea_deleted_student_ids', JSON.stringify([...current, ...toAdd]));
    }
  } catch (e) {}
}

export function isStudentDeleted(student?: { id?: string; rollNumber?: string; name?: string } | null): boolean {
  if (!student || !student.id) return false;
  const deleted = getDeletedStudentIds();
  if (deleted.length === 0) return false;
  const deletedSet = new Set(deleted.map(x => String(x).toLowerCase().trim()));
  
  // ONLY match unique record ID
  const cleanId = String(student.id).toLowerCase().trim();
  if (deletedSet.has(cleanId)) return true;
  const alphaId = cleanId.replace(/[^a-z0-9]/g, '');
  if (alphaId && deletedSet.has(alphaId)) return true;

  return false;
}

export function removeDeletedStudentId(id?: string, rollNumber?: string, studentName?: string): void {
  if (!id && !rollNumber && !studentName) return;
  try {
    const current = getDeletedStudentIds();
    const toRemove = new Set<string>();
    if (id) {
      const clean = id.toLowerCase().trim();
      toRemove.add(clean);
      const alpha = clean.replace(/[^a-z0-9]/g, '');
      if (alpha) toRemove.add(alpha);
    }
    if (rollNumber) {
      const clean = rollNumber.toLowerCase().trim();
      toRemove.add(clean);
      const alpha = clean.replace(/[^a-z0-9]/g, '');
      if (alpha) toRemove.add(alpha);
    }
    if (studentName) {
      const clean = studentName.toLowerCase().trim();
      toRemove.add(clean);
      const alpha = clean.replace(/[^a-z0-9]/g, '');
      if (alpha) toRemove.add(alpha);
    }
    const filtered = current.filter(item => !toRemove.has(item.toLowerCase().trim()));
    localStorage.setItem('ea_deleted_student_ids', JSON.stringify(filtered));
  } catch (e) {}
}

export function clearAllDeletedStudentIds(): void {
  try {
    localStorage.removeItem('ea_deleted_student_ids');
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

// Global helper to automatically prune deleted tombstones for any records that exist actively
// NOTE: Student deletion tombstones are PERMANENT and must never be pruned. Only active staff credentials can be reconciled.
export function pruneDeletedTombstones(_activeStudents: Student[], activeTeachers?: User[]): void {
  try {
    if (Array.isArray(activeTeachers) && activeTeachers.length > 0) {
      const activeTIds = new Set(activeTeachers.map(t => String(t.id).toLowerCase().trim()));
      const currentT = getDeletedTeacherIds();
      const prunedT = currentT.filter(id => !activeTIds.has(String(id).toLowerCase().trim()));
      if (prunedT.length !== currentT.length) {
        localStorage.setItem('ea_deleted_teacher_ids', JSON.stringify(prunedT));
      }
    }
  } catch (e) {}
}

// 2. SYNC STUDENTS
export async function fetchSupabaseStudents(): Promise<Student[] | null> {
  const filterDeleted = (list: Student[]) => {
    return list.filter(s => !isStudentDeleted(s) && !isDemoStudent(s));
  };

  // Helper to query Server / CDN endpoint
  const fetchFromServer = async (): Promise<Student[] | null> => {
    try {
      const res = await fetch('/api/students', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.deletedStudentIds) && json.deletedStudentIds.length > 0) {
          try {
            const existing = getDeletedStudentIds();
            const set = new Set(existing.map(x => String(x).toLowerCase().trim()));
            let added = false;
            json.deletedStudentIds.forEach((id: string) => {
              const clean = String(id).toLowerCase().trim();
              if (clean && !set.has(clean)) {
                existing.push(clean);
                set.add(clean);
                added = true;
              }
            });
            if (added) {
              localStorage.setItem('ea_deleted_student_ids', JSON.stringify(existing));
            }
          } catch (e) {}
        }
        if (json && Array.isArray(json.students)) {
          return filterDeleted(json.students);
        }
      }
    } catch (e) {
      console.warn('[Fetch Students] Server endpoint fallback notice:', e);
    }
    return null;
  };

  const getMergedFallback = async (): Promise<Student[] | null> => {
    const serverResult = await fetchFromServer();
    if (serverResult !== null && Array.isArray(serverResult)) {
      const clean = filterDeleted(serverResult);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ea_students', JSON.stringify(clean));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(clean));
      }
      return clean;
    }

    const cached = localStorage.getItem('ea_students') || localStorage.getItem('mock_supabase_ea_students');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return filterDeleted(parsed);
      } catch (e) {}
    }
    return null;
  };

  const client = getSupabaseClient();
  if (!client) {
    return await getMergedFallback();
  }
  try {
    let lastRosterClearedAt: string | null = null;

    // 1. Sync remote tombstones from ea_deleted_records and ea_sync_logs to ensure global deletion propagation
    try {
      const { data: delRecords } = await client
        .from('ea_deleted_records')
        .select('*')
        .in('record_type', ['STUDENT', 'ROSTER_CLEAR'])
        .order('deleted_at', { ascending: false })
        .limit(200);
      if (delRecords && Array.isArray(delRecords)) {
        delRecords.forEach((row: any) => {
          if (row.record_type === 'ROSTER_CLEAR') {
            const rowTime = row.deleted_at || (row.details ? (typeof row.details === 'string' ? JSON.parse(row.details)?.clearedAt : row.details?.clearedAt) : null);
            if (rowTime && (!lastRosterClearedAt || new Date(rowTime) > new Date(lastRosterClearedAt))) {
              lastRosterClearedAt = rowTime;
            }
          } else {
            const details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
            recordDeletedStudentId(row.record_id || details.id, row.roll_number || details.rollNumber, row.name || details.studentName);
          }
        });
      }
    } catch (delErr) {}

    try {
      const { data: logs } = await client
        .from('ea_sync_logs')
        .select('*')
        .in('action_type', ['DELETE_STUDENT', 'CLEAR_STUDENTS'])
        .order('timestamp', { ascending: false })
        .limit(200);
      if (logs && Array.isArray(logs)) {
        logs.forEach((log: any) => {
          if (log.action_type === 'CLEAR_STUDENTS' || log.action === 'CLEAR_STUDENTS') {
            const logTime = log.timestamp;
            if (logTime && (!lastRosterClearedAt || new Date(logTime) > new Date(lastRosterClearedAt))) {
              lastRosterClearedAt = logTime;
            }
          } else {
            const details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
            const id = details.id || details.studentId;
            const rollNumber = details.rollNumber;
            const studentName = details.studentName || details.name;
            recordDeletedStudentId(id, rollNumber, studentName);
          }
        });
      }
    } catch (logErr) {}

    const { data, error } = await client.from('ea_students').select('*');
    if (error) {
      console.warn('[Fetch Students] Supabase query error, falling back to server/cache:', error.message || error);
      return await getMergedFallback();
    }

    if (!data || data.length === 0) {
      // Remote Supabase table has 0 records - update local caches to reflect clean empty roster
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ea_students', JSON.stringify([]));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify([]));
        localStorage.setItem('ea_students_cleared', 'true');
      }
      return [];
    }

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

    // If any records returned from Supabase match isStudentDeleted, purge them permanently from Supabase by ID only
    const ghostRecords = mapped.filter(s => isStudentDeleted(s));
    if (ghostRecords.length > 0 && client) {
      const ghostIds = ghostRecords.map(g => g.id).filter(Boolean) as string[];
      for (let i = 0; i < ghostIds.length; i += 30) {
        client.from('ea_students').delete().in('id', ghostIds.slice(i, i + 30)).then(() => {});
      }
    }

    let cleanMapped = filterDeleted(mapped);

    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('ea_students');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const mappedIds = new Set(cleanMapped.map(s => s.id));
            const unsynced = parsed.filter(s => s && s.id && !mappedIds.has(s.id) && !isStudentDeleted(s) && !isDemoStudent(s));
            if (unsynced.length > 0) {
              cleanMapped = [...cleanMapped, ...unsynced];
            }
          }
        }
      } catch (e) {}
      localStorage.removeItem('ea_students_cleared');
      localStorage.setItem('ea_students', JSON.stringify(cleanMapped));
      localStorage.setItem('mock_supabase_ea_students', JSON.stringify(cleanMapped));
    }

    // Keep server / CDN synchronized in background with latest Supabase roster
    try {
      saveServerEntity('/students', cleanMapped).catch(() => {});
    } catch (e) {}

    return cleanMapped;
  } catch (err: any) {
    return await getMergedFallback();
  }
}

// Dedicated single-student admission & instant global sync
export async function saveSingleSupabaseStudent(student: Student): Promise<boolean> {
  if (!student || (!student.id && !student.name)) return false;

  // 1. Immediately remove any tombstone locally and from memory
  removeDeletedStudentId(student.id, student.rollNumber, student.name);
  try {
    localStorage.removeItem('ea_students_cleared');
  } catch (e) {}

  // 2. Immediately update local caches for zero latency
  try {
    const cached = localStorage.getItem('ea_students') || localStorage.getItem('mock_supabase_ea_students');
    let currentList: Student[] = [];
    if (cached) {
      try {
        currentList = JSON.parse(cached);
      } catch (e) {}
    }
    const idx = currentList.findIndex(s => s.id === student.id);
    let updatedList: Student[];
    if (idx >= 0) {
      updatedList = currentList.map((s, i) => i === idx ? { ...s, ...student } : s);
    } else {
      updatedList = [...currentList, student];
    }
    const seen = new Set<string>();
    const cleanList: Student[] = [];
    for (const s of updatedList) {
      if (s && s.id && !seen.has(s.id)) {
        seen.add(s.id);
        cleanList.push(s);
      }
    }
    updatedList = cleanList;
    localStorage.setItem('ea_students', JSON.stringify(updatedList));
    localStorage.setItem('mock_supabase_ea_students', JSON.stringify(updatedList));
    window.dispatchEvent(new CustomEvent('ea_students_updated', { detail: { source: 'internal_save' } }));
  } catch (e) {}

  // 3. Immediately dispatch to Server / CDN API with anti-cache synchronization
  try {
    await syncStudentAdditionToCDN(student);
  } catch (e) {
    console.warn('syncStudentAdditionToCDN notice:', e);
  }

  // 4. Upsert to Supabase Cloud Database
  const client = getSupabaseClient();
  if (client) {
    try {
      // Clear remote tombstone from ea_deleted_records
      try {
        if (student.id) {
          await client.from('ea_deleted_records').delete().eq('record_id', student.id);
        }
        if (student.rollNumber) {
          await client.from('ea_deleted_records').delete().eq('roll_number', student.rollNumber);
        }
      } catch (tombErr) {}

      // Upsert single student directly to Supabase
      const payload = {
        id: student.id,
        name: student.name,
        roll_number: student.rollNumber,
        level: student.level || 'PRIMARY',
        class_name: student.className,
        guardian_name: student.guardianName || '',
        guardian_email: student.guardianEmail || '',
        guardian_phone: student.guardianPhone || '',
        photo_url: student.photoUrl || '',
        updated_at: new Date().toISOString()
      };

      let { error } = await safeUpsert('ea_students', [payload], client, 'id');
      if (error && (error.message?.includes('photo_url') || error.message?.includes('guardian_phone') || error.code === '42703')) {
        const { photo_url, guardian_phone, ...legacyPayload } = payload;
        const retryRes = await safeUpsert('ea_students', [legacyPayload], client, 'id');
        error = retryRes.error;
      }

      if (error) {
        console.warn('[Supabase saveSingleStudent] Notice:', error.message || error);
      }

      // Log sync operation
      try {
        await client.from('ea_sync_logs').insert([{
          id: `sync_adm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action_type: 'ADMIT_STUDENT',
          description: `Pupil admitted / updated: ${student.name} (${student.rollNumber}) - ${student.className}`,
          performed_by: 'Admin',
          status: 'SUCCESS',
          details: { id: student.id, name: student.name, rollNumber: student.rollNumber, className: student.className, timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      } catch (logErr) {}

      // Broadcast globally across Realtime WebSockets, BroadcastChannels, and in-memory listeners
      broadcastGlobalSync('ea_students', { action: 'UPSERT', student, id: student.id, rollNumber: student.rollNumber });
      broadcastSync('students', student, 'insert');

      return true;
    } catch (err) {
      console.warn('saveSingleSupabaseStudent exception:', err);
      broadcastGlobalSync('ea_students', { action: 'UPSERT', student, id: student.id });
      broadcastSync('students', student, 'insert');
      return true;
    }
  }

  broadcastGlobalSync('ea_students', { action: 'UPSERT', student, id: student.id });
  broadcastSync('students', student, 'insert');
  return true;
}

export async function saveSupabaseStudents(students: Student[]): Promise<boolean> {
  // Defensive check: When an empty array is passed, do NOT wipe the database!
  // Empty saves often happen during component initialization or transient states.
  // Full wipe is strictly handled when the user explicitly triggers clearAllSupabaseStudents().
  if (!Array.isArray(students) || students.length === 0) {
    console.warn('[Supabase Student Sync] Empty or invalid students array received. Skipping remote push to protect pupil roster.');
    return true;
  }

  // Filter out any students that have been marked deleted or demo
  const validStudents = students.filter(s => !isStudentDeleted(s) && !isDemoStudent(s));

  if (validStudents.length === 0) {
    console.warn('[Supabase Student Sync] Zero valid students after filter. Skipping remote push to protect pupil roster.');
    return true;
  }

  console.log(`[Supabase Student Sync Diagnostic] saveSupabaseStudents: Pushing ${validStudents.length} students to Supabase (raw count: ${students.length})`);

  // Always persist to local cache immediately to guarantee offline/local persistence
  localStorage.setItem('mock_supabase_ea_students', JSON.stringify(validStudents));
  localStorage.setItem('ea_students', JSON.stringify(validStudents));
  localStorage.removeItem('ea_students_cleared');
  window.dispatchEvent(new CustomEvent('ea_students_updated', { detail: { source: 'internal_save' } }));

  // Sync to Server / CDN API
  try {
    saveServerEntity('/students', validStudents).catch(() => {});
    await fetch(`/api/students?_t=${Date.now()}`, {
      method: 'POST',
      headers: getAntiCacheHeaders(),
      body: JSON.stringify({ students: validStudents })
    }).catch(e => console.warn('Sync /api/students warning:', e));
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    broadcastGlobalSync('ea_students', { action: 'UPSERT', count: validStudents.length });
    broadcastSync('students', validStudents, 'update');
    return true;
  }

  try {
    // 1. Purge any deleted student IDs from Supabase to prevent stale records lingering
    const deletedIds = getDeletedStudentIds();
    if (deletedIds.length > 0) {
      for (let i = 0; i < deletedIds.length; i += 50) {
        const chunk = deletedIds.slice(i, i + 50);
        try {
          await client.from('ea_students').delete().in('id', chunk);
          await client.from('ea_students').delete().in('roll_number', chunk);
          await client.from('ea_students').delete().in('name', chunk);
        } catch (e) {}
      }
    }

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

    // Upsert in safe chunks of 40 with onConflict: 'id'
    for (let i = 0; i < payloads.length; i += 40) {
      const chunk = payloads.slice(i, i + 40);
      let { error } = await safeUpsert('ea_students', chunk, client, 'id');
      if (error && (error.message?.includes('photo_url') || error.message?.includes('guardian_phone') || error.code === '42703')) {
        const legacyChunk = chunk.map(({ photo_url, guardian_phone, ...rest }) => rest);
        await safeUpsert('ea_students', legacyChunk, client, 'id');
      }
    }
    
    broadcastGlobalSync('ea_students', { action: 'UPSERT', count: validStudents.length });
    broadcastSync('students', validStudents, 'update');

    return true;
  } catch (err: any) {
    broadcastGlobalSync('ea_students', { action: 'UPSERT', count: validStudents.length });
    broadcastSync('students', validStudents, 'update');
    return true;
  }
}

// Dedicated function to safely and completely clear all student records across storage, server, and Supabase
export async function clearAllSupabaseStudents(): Promise<boolean> {
  try {
    // 1. Set explicit cleared flag and wipe student-related local storage caches
    try {
      localStorage.setItem('ea_students_cleared', 'true');
      localStorage.setItem('ea_students', JSON.stringify([]));
      localStorage.setItem('mock_supabase_ea_students', JSON.stringify([]));
      localStorage.setItem('ea_grades', JSON.stringify([]));
      localStorage.setItem('mock_supabase_ea_grades', JSON.stringify([]));
      localStorage.setItem('ea_attendance', JSON.stringify([]));
      localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify([]));
      localStorage.setItem('ea_bills', JSON.stringify([]));
      localStorage.setItem('mock_supabase_ea_bills', JSON.stringify([]));
      localStorage.setItem('ea_daily_attendance', JSON.stringify([]));
      localStorage.setItem('ea_jhs_mock_records', JSON.stringify([]));
      localStorage.setItem('ea_jhs_mock_exams', JSON.stringify([]));
      localStorage.setItem('mock_supabase_ea_jhs_mock_exams', JSON.stringify([]));
      localStorage.setItem('ea_jhs_terminal_assessment_history', JSON.stringify([]));
      localStorage.setItem('ea_pre_promotion_students', JSON.stringify([]));
      localStorage.removeItem('ea_students_seeded');
      localStorage.removeItem('ea_roster_initialized');
    } catch (e) {}

    // 2. Clear server cache via POST and DELETE /api/students/clear and master sync
    try {
      saveServerEntity('/students', []).catch(() => {});
      saveServerEntity('/grades', []).catch(() => {});
      saveServerEntity('/attendance', []).catch(() => {});
      saveServerEntity('/bills', []).catch(() => {});
      await fetch('/api/students/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
      await fetch('/api/students', {
        method: 'DELETE'
      }).catch(() => {});
      await fetch('/api/sync/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: [],
          grades: [],
          attendance: [],
          bills: [],
          dailyAttendance: [],
          jhsMockExams: [],
          rosterCleared: true
        })
      }).catch(() => {});
    } catch (e) {}

    // 3. Clear remote Supabase tables if client is configured
    const client = getSupabaseClient();
    if (client) {
      // Gather current IDs to register individual tombstones
      try {
        const { data: currentRows } = await client.from('ea_students').select('id, roll_number, name');
        if (currentRows && Array.isArray(currentRows) && currentRows.length > 0) {
          currentRows.forEach((r: any) => {
            if (r.id) recordDeletedStudentId(r.id, r.roll_number, r.name);
          });
          const allIds = currentRows.map((r: any) => r.id).filter(Boolean);
          for (let i = 0; i < allIds.length; i += 50) {
            const chunk = allIds.slice(i, i + 50);
            await client.from('ea_students').delete().in('id', chunk);
          }
        }
      } catch (e) {
        console.warn('Supabase fetch/batch delete students warning:', e);
      }

      // Comprehensive delete across student and student-related tables
      try {
        await client.from('ea_students').delete().not('id', 'is', null);
      } catch (e) {}
      try {
        await client.from('ea_students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {}
      try {
        await client.from('ea_grades').delete().not('id', 'is', null);
      } catch (e) {}
      try {
        await client.from('ea_attendance').delete().not('id', 'is', null);
      } catch (e) {}
      try {
        await client.from('ea_bills').delete().not('id', 'is', null);
      } catch (e) {}
      try {
        await client.from('ea_jhs_mock_exams').delete().not('id', 'is', null);
      } catch (e) {}

      // Insert global ROSTER_CLEAR tombstone in ea_deleted_records
      try {
        await client.from('ea_deleted_records').upsert([{
          id: `ROSTER_CLEAR_${Date.now()}`,
          record_type: 'ROSTER_CLEAR',
          record_id: 'ALL_STUDENTS',
          details: JSON.stringify({ clearedAt: new Date().toISOString() }),
          deleted_at: new Date().toISOString()
        }]);
      } catch (e) {}

      // Insert clear action log in ea_sync_logs
      try {
        await client.from('ea_sync_logs').insert([{
          action: 'CLEAR_STUDENTS',
          action_type: 'CLEAR_STUDENTS',
          description: 'All pupil records cleared from admissions directory.',
          performed_by: 'Admin',
          status: 'SUCCESS',
          details: { clearedAt: new Date().toISOString() },
          timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      } catch (e) {}
    }

    broadcastGlobalSync('ea_students', { action: 'CLEAR_ALL', count: 0 });
    broadcastSync('students', [], 'delete');
    broadcastSync('grades', [], 'delete');
    broadcastSync('attendance', [], 'delete');
    broadcastSync('bills', [], 'delete');
    window.dispatchEvent(new CustomEvent('ea_students_updated', { detail: { source: 'clear_all' } }));
    window.dispatchEvent(new Event('ea_grades_updated'));
    window.dispatchEvent(new Event('ea_attendance_updated'));
    window.dispatchEvent(new Event('ea_bills_updated'));

    globalSyncEngine.pushMasterServerSync({
      students: [],
      grades: [],
      attendance: [],
      bills: [],
      dailyAttendance: [],
      jhsMockExams: [],
      rosterCleared: true
    }).catch(() => {});

    return true;
  } catch (err) {
    console.error('Failed to clear all students:', err);
    return false;
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
    const serverTeachers = await fetchServerEntity<User[]>('/teachers');
    if (serverTeachers && serverTeachers.length > 0) {
      localStorage.setItem('ea_teachers', JSON.stringify(serverTeachers));
      return filterDeleted(serverTeachers);
    }
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
      const serverTeachers = await fetchServerEntity<User[]>('/teachers');
      if (serverTeachers && serverTeachers.length > 0) {
        localStorage.setItem('ea_teachers', JSON.stringify(serverTeachers));
        return filterDeleted(serverTeachers);
      }
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
    if (!data || data.length === 0) {
      const serverTeachers = await fetchServerEntity<User[]>('/teachers');
      if (serverTeachers && serverTeachers.length > 0) {
        localStorage.setItem('ea_teachers', JSON.stringify(serverTeachers));
        return filterDeleted(serverTeachers);
      }
      return null;
    }
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

    // Remote database is authoritative for teachers
    const activeTeacherIds = new Set(mapped.map(t => String(t.id).toLowerCase().trim()));
    const curDelT = getDeletedTeacherIds();
    const prunedT = curDelT.filter(id => !activeTeacherIds.has(String(id).toLowerCase().trim()));
    if (prunedT.length !== curDelT.length) {
      try {
        localStorage.setItem('ea_deleted_teacher_ids', JSON.stringify(prunedT));
      } catch (e) {}
    }

    const cleanTeachers = filterDeleted(mapped);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ea_teachers', JSON.stringify(cleanTeachers));
    }

    return cleanTeachers;
  } catch (err: any) {
    const serverTeachers = await fetchServerEntity<User[]>('/teachers');
    if (serverTeachers && serverTeachers.length > 0) {
      localStorage.setItem('ea_teachers', JSON.stringify(serverTeachers));
      return filterDeleted(serverTeachers);
    }
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

  // Persist to central server database and broadcast to other devices
  saveServerEntity('/teachers', teachers).catch(e => console.warn('[Server Sync Teachers Notice]', e));

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

export async function deleteSupabaseStudent(id: string, rollNumber?: string, studentName?: string, photoUrl?: string): Promise<boolean> {
  if (!id && !rollNumber && !studentName) return true;
  recordDeletedStudentId(id, rollNumber, studentName);

  const normName = studentName ? studentName.toLowerCase().trim() : '';
  const normRoll = rollNumber ? rollNumber.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  const studentKeys = [id, rollNumber].filter(Boolean) as string[];

  // 1. Immediately purge from local caches
  try {
    const isTargetStudent = (s: any) => {
      if (!s) return false;
      if (id && s.id && (s.id === id || String(s.id).toLowerCase().trim() === id.toLowerCase().trim())) return true;
      if (rollNumber && s.rollNumber && (s.rollNumber.trim().toLowerCase() === rollNumber.trim().toLowerCase() || s.rollNumber.toUpperCase().replace(/[^A-Z0-9]/g, '') === normRoll)) return true;
      if (normName && s.name && s.name.toLowerCase().trim() === normName) return true;
      return false;
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

    window.dispatchEvent(new CustomEvent('ea_students_updated', { detail: { source: 'delete' } }));
    window.dispatchEvent(new Event('ea_grades_updated'));
    window.dispatchEvent(new Event('ea_attendance_updated'));
    window.dispatchEvent(new Event('ea_bills_updated'));
    window.dispatchEvent(new Event('ea_fee_payments_updated'));
  } catch (e) {
    console.warn('Local student delete cleanup error:', e);
  }

  // 1.5 Sync deletion to Server / CDN API
  try {
    await syncStudentDeletionToCDN(id, rollNumber, studentName, photoUrl);
  } catch (e) {
    console.warn('syncStudentDeletionToCDN notice:', e);
  }

  // 2. Delete from Supabase remote database and purge CDN photo assets
  const client = getSupabaseClient();
  if (client) {
    try {
      // Purge student photo from Supabase Storage CDN buckets
      try {
        const pathsToDelete: string[] = [];
        if (photoUrl) {
          if (photoUrl.includes('student-photos/')) {
            const part = photoUrl.split('student-photos/')[1]?.split('?')[0];
            if (part) pathsToDelete.push(`student-photos/${part}`);
          }
          if (photoUrl.includes('passport/')) {
            const part = photoUrl.split('passport/')[1]?.split('?')[0];
            if (part) pathsToDelete.push(`passport/${part}`);
          }
        }
        const cleanId = id ? id.replace(/[^a-zA-Z0-9_-]/g, '_') : '';
        if (cleanId) {
          try {
            const { data: eaList } = await client.storage.from('ea').list('student-photos', { search: cleanId });
            if (Array.isArray(eaList)) {
              eaList.forEach(f => pathsToDelete.push(`student-photos/${f.name}`));
            }
          } catch (e) {}
        }
        if (pathsToDelete.length > 0) {
          const uniquePaths = Array.from(new Set(pathsToDelete));
          await client.storage.from('ea').remove(uniquePaths).catch(() => {});
          await client.storage.from('student-photos').remove(uniquePaths).catch(() => {});
          console.log(`[Storage CDN Sync] Removed ${uniquePaths.length} photo assets for deleted pupil ${id}`);
        }
      } catch (photoErr) {}
      for (const k of studentKeys) {
        await client.from('ea_grades').delete().eq('student_id', k);
        await client.from('ea_attendance').delete().eq('student_id', k);
        await client.from('ea_daily_attendance').delete().eq('student_id', k);
        await client.from('ea_bills').delete().eq('student_id', k);
        await client.from('ea_fee_payments').delete().eq('student_id', k);
        await client.from('ea_jhs_mock_exams').delete().eq('student_id', k);
      }
      if (id) {
        await client.from('ea_students').delete().eq('id', id);
        await client.from('ea_students').delete().eq('id', id.trim());
        await client.from('ea_students').delete().eq('id', id.toLowerCase().trim());
      }
      if (rollNumber) {
        await client.from('ea_students').delete().eq('roll_number', rollNumber.trim());
      }
      if (studentName) {
        await client.from('ea_students').delete().eq('name', studentName.trim());
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

      // Broadcast globally across Realtime WebSockets, BroadcastChannels, and in-memory listeners
      broadcastGlobalSync('ea_students', { id, rollNumber, studentName, action: 'DELETE' });
      broadcastSync('students', { id, rollNumber, studentName }, 'delete');

      return true;
    } catch (err: any) {
      console.warn('deleteSupabaseStudent remote exception:', err);
      broadcastGlobalSync('ea_students', { id, rollNumber, studentName, action: 'DELETE' });
      broadcastSync('students', { id, rollNumber, studentName }, 'delete');
      return true;
    }
  }

  // Broadcast deletion across local tabs even if client instance is offline
  broadcastGlobalSync('ea_students', { id, rollNumber, studentName, action: 'DELETE' });
  broadcastSync('students', { id, rollNumber, studentName }, 'delete');
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
  if (!client) {
    const serverGrades = await fetchServerEntity<Grade[]>('/grades');
    if (serverGrades && serverGrades.length > 0) {
      localStorage.setItem('ea_grades', JSON.stringify(serverGrades));
      return serverGrades;
    }
    const cached = localStorage.getItem('mock_supabase_ea_grades') || localStorage.getItem('ea_grades');
    return cached ? JSON.parse(cached) : null;
  }
  try {
    const { data, error } = await client.from('ea_grades').select('*');
    if (error) {
      const serverGrades = await fetchServerEntity<Grade[]>('/grades');
      if (serverGrades && serverGrades.length > 0) {
        localStorage.setItem('ea_grades', JSON.stringify(serverGrades));
        return serverGrades;
      }
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_grades') || localStorage.getItem('ea_grades');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data || data.length === 0) {
      const serverGrades = await fetchServerEntity<Grade[]>('/grades');
      if (serverGrades && serverGrades.length > 0) {
        localStorage.setItem('ea_grades', JSON.stringify(serverGrades));
        saveSupabaseGrades(serverGrades).catch(() => {});
        return serverGrades;
      }
      const cached = localStorage.getItem('mock_supabase_ea_grades') || localStorage.getItem('ea_grades');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveSupabaseGrades(parsed).catch(() => {});
            return parsed;
          }
        } catch (e) {}
      }
      return null;
    }
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
    const serverGrades = await fetchServerEntity<Grade[]>('/grades');
    if (serverGrades && serverGrades.length > 0) {
      localStorage.setItem('ea_grades', JSON.stringify(serverGrades));
      return serverGrades;
    }
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

  // Persist to central server database and broadcast to other devices
  saveServerEntity('/grades', grades).catch(e => console.warn('[Server Sync Grades Notice]', e));

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
  if (!client) {
    const serverAttendance = await fetchServerEntity<Attendance[]>('/attendance');
    if (serverAttendance && serverAttendance.length > 0) {
      localStorage.setItem('ea_attendance', JSON.stringify(serverAttendance));
      return serverAttendance;
    }
    const cached = localStorage.getItem('mock_supabase_ea_attendance') || localStorage.getItem('ea_attendance');
    return cached ? JSON.parse(cached) : null;
  }
  try {
    const { data, error } = await client.from('ea_attendance').select('*');
    if (error) {
      const serverAttendance = await fetchServerEntity<Attendance[]>('/attendance');
      if (serverAttendance && serverAttendance.length > 0) {
        localStorage.setItem('ea_attendance', JSON.stringify(serverAttendance));
        return serverAttendance;
      }
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_attendance') || localStorage.getItem('ea_attendance');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data || data.length === 0) {
      const serverAttendance = await fetchServerEntity<Attendance[]>('/attendance');
      if (serverAttendance && serverAttendance.length > 0) {
        localStorage.setItem('ea_attendance', JSON.stringify(serverAttendance));
        saveSupabaseAttendance(serverAttendance).catch(() => {});
        return serverAttendance;
      }
      const cached = localStorage.getItem('mock_supabase_ea_attendance') || localStorage.getItem('ea_attendance');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveSupabaseAttendance(parsed).catch(() => {});
            return parsed;
          }
        } catch (e) {}
      }
      return null;
    }
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
    const serverAttendance = await fetchServerEntity<Attendance[]>('/attendance');
    if (serverAttendance && serverAttendance.length > 0) {
      localStorage.setItem('ea_attendance', JSON.stringify(serverAttendance));
      return serverAttendance;
    }
    if (isMissingTableOrConnectionError(err)) {
      const cached = localStorage.getItem('mock_supabase_ea_attendance') || localStorage.getItem('ea_attendance');
      return cached ? JSON.parse(cached) : null;
    }
    return null;
  }
}

export async function saveSupabaseAttendance(attendance: Attendance[]): Promise<boolean> {
  if (!attendance || !Array.isArray(attendance) || attendance.length === 0) {
    return true;
  }
  // Always persist to local cache immediately to guarantee offline/local persistence
  try {
    localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(attendance));
    localStorage.setItem('ea_attendance', JSON.stringify(attendance));
  } catch (e) {}

  // Broadcast cross-tab and to local event listeners
  try {
    broadcastSync('attendance', attendance, 'update');
    window.dispatchEvent(new CustomEvent('ea_attendance_updated', { detail: attendance }));
  } catch (e) {}

  // Persist to central server database and broadcast to other devices
  saveServerEntity('/attendance', attendance).catch(e => console.warn('[Server Sync Attendance Notice]', e));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = attendance.map(a => ({
      student_id: a.studentId,
      term: a.term || 'Term 1',
      year: a.year || '2026/2027',
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

// 5b. SYNC DAILY ATTENDANCE (Roll Call)
export async function fetchSupabaseDailyAttendance(): Promise<DailyAttendanceRecord[] | null> {
  const client = getSupabaseClient();
  if (!client) {
    const serverDaily = await fetchServerEntity<DailyAttendanceRecord[]>('/daily-attendance');
    if (serverDaily && Array.isArray(serverDaily) && serverDaily.length > 0) {
      try {
        localStorage.setItem('ea_daily_attendance', JSON.stringify(serverDaily));
        localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(serverDaily));
      } catch (e) {}
      return serverDaily;
    }
    const cached = localStorage.getItem('mock_supabase_ea_daily_attendance') || localStorage.getItem('ea_daily_attendance');
    return cached ? JSON.parse(cached) : null;
  }
  try {
    const { data, error } = await client.from('ea_daily_attendance').select('*');
    if (error) {
      const serverDaily = await fetchServerEntity<DailyAttendanceRecord[]>('/daily-attendance');
      if (serverDaily && Array.isArray(serverDaily) && serverDaily.length > 0) {
        try {
          localStorage.setItem('ea_daily_attendance', JSON.stringify(serverDaily));
          localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(serverDaily));
        } catch (e) {}
        return serverDaily;
      }
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_daily_attendance') || localStorage.getItem('ea_daily_attendance');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data || data.length === 0) {
      const serverDaily = await fetchServerEntity<DailyAttendanceRecord[]>('/daily-attendance');
      if (serverDaily && Array.isArray(serverDaily) && serverDaily.length > 0) {
        try {
          localStorage.setItem('ea_daily_attendance', JSON.stringify(serverDaily));
          localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(serverDaily));
        } catch (e) {}
        saveSupabaseDailyAttendance(serverDaily).catch(() => {});
        return serverDaily;
      }
      const cached = localStorage.getItem('mock_supabase_ea_daily_attendance') || localStorage.getItem('ea_daily_attendance');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveSupabaseDailyAttendance(parsed).catch(() => {});
            return parsed;
          }
        } catch (e) {}
      }
      return null;
    }
    const mapped: DailyAttendanceRecord[] = data.map(item => ({
      id: item.id || `att-${item.student_id}-${item.date}-${Date.now()}`,
      studentId: item.student_id,
      date: item.date,
      status: item.status as DailyAttendanceStatus,
      term: item.term || 'Term 1',
      year: item.year || '2025/2026',
      teacherId: item.teacher_id || 'admin',
      updatedAt: item.updated_at || new Date().toISOString()
    }));
    try {
      localStorage.setItem('ea_daily_attendance', JSON.stringify(mapped));
      localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(mapped));
    } catch (e) {}
    return mapped;
  } catch (err: any) {
    const serverDaily = await fetchServerEntity<DailyAttendanceRecord[]>('/daily-attendance');
    if (serverDaily && Array.isArray(serverDaily) && serverDaily.length > 0) {
      try {
        localStorage.setItem('ea_daily_attendance', JSON.stringify(serverDaily));
        localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(serverDaily));
      } catch (e) {}
      return serverDaily;
    }
    const cached = localStorage.getItem('mock_supabase_ea_daily_attendance') || localStorage.getItem('ea_daily_attendance');
    return cached ? JSON.parse(cached) : null;
  }
}

export async function saveSupabaseDailyAttendance(records: DailyAttendanceRecord[]): Promise<boolean> {
  if (!records || !Array.isArray(records) || records.length === 0) {
    return true;
  }
  // Always persist to local cache immediately to guarantee offline/local persistence
  try {
    localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(records));
    localStorage.setItem('ea_daily_attendance', JSON.stringify(records));
  } catch (e) {}

  // Broadcast cross-tab and to local event listeners
  try {
    broadcastSync('daily_attendance', records, 'update');
    window.dispatchEvent(new CustomEvent('ea_daily_attendance_updated', { detail: records }));
  } catch (e) {}

  // Persist to central server database and broadcast to other devices
  saveServerEntity('/daily-attendance', records).catch(e => console.warn('[Server Sync Daily Attendance Notice]', e));

  const client = getSupabaseClient();
  if (!client) return true;
  try {
    const payloads = records.map(r => ({
      id: r.id || `att-${r.studentId}-${r.date}-${Date.now()}`,
      student_id: r.studentId,
      date: r.date,
      status: r.status,
      term: r.term || 'Term 1',
      year: r.year || '2026/2027',
      teacher_id: r.teacherId || 'admin',
      updated_at: r.updatedAt || new Date().toISOString()
    }));
    const { error } = await safeUpsert('ea_daily_attendance', payloads, client, 'id');
    if (error) {
      console.warn('Supabase saveSupabaseDailyAttendance notice:', error);
      return true;
    }
    return true;
  } catch (err) {
    console.warn('Supabase saveSupabaseDailyAttendance exception:', err);
    return true;
  }
}

// 6. SYNC STUDENT BILLS
export async function fetchSupabaseBills(): Promise<StudentBill[] | null> {
  const client = getSupabaseClient();
  if (!client) {
    const serverBills = await fetchServerEntity<StudentBill[]>('/bills');
    if (serverBills && serverBills.length > 0) {
      localStorage.setItem('ea_bills', JSON.stringify(serverBills));
      return serverBills;
    }
    const cached = localStorage.getItem('mock_supabase_ea_bills') || localStorage.getItem('ea_bills');
    return cached ? JSON.parse(cached) : null;
  }
  try {
    const { data, error } = await client.from('ea_bills').select('*');
    if (error) {
      const serverBills = await fetchServerEntity<StudentBill[]>('/bills');
      if (serverBills && serverBills.length > 0) {
        localStorage.setItem('ea_bills', JSON.stringify(serverBills));
        return serverBills;
      }
      if (isMissingTableOrConnectionError(error)) {
        const cached = localStorage.getItem('mock_supabase_ea_bills') || localStorage.getItem('ea_bills');
        return cached ? JSON.parse(cached) : null;
      }
      return null;
    }
    if (!data || data.length === 0) {
      const serverBills = await fetchServerEntity<StudentBill[]>('/bills');
      if (serverBills && serverBills.length > 0) {
        localStorage.setItem('ea_bills', JSON.stringify(serverBills));
        saveSupabaseBills(serverBills).catch(() => {});
        return serverBills;
      }
      const cached = localStorage.getItem('mock_supabase_ea_bills') || localStorage.getItem('ea_bills');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            saveSupabaseBills(parsed).catch(() => {});
            return parsed;
          }
        } catch (e) {}
      }
      return null;
    }
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
    const serverBills = await fetchServerEntity<StudentBill[]>('/bills');
    if (serverBills && serverBills.length > 0) {
      localStorage.setItem('ea_bills', JSON.stringify(serverBills));
      return serverBills;
    }
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

  // Persist to central server database and broadcast to other devices
  saveServerEntity('/bills', bills).catch(e => console.warn('[Server Sync Bills Notice]', e));

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
    const serverPayments = await fetchServerEntity<FeePayment[]>('/fee-payments');
    if (serverPayments && serverPayments.length > 0) {
      localStorage.setItem('ea_fee_payments', JSON.stringify(serverPayments));
      return filterDeleted(serverPayments);
    }
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
      const serverPayments = await fetchServerEntity<FeePayment[]>('/fee-payments');
      if (serverPayments && serverPayments.length > 0) {
        localStorage.setItem('ea_fee_payments', JSON.stringify(serverPayments));
        return filterDeleted(serverPayments);
      }
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
    if (!data || data.length === 0) {
      const serverPayments = await fetchServerEntity<FeePayment[]>('/fee-payments');
      if (serverPayments && serverPayments.length > 0) {
        localStorage.setItem('ea_fee_payments', JSON.stringify(serverPayments));
        return filterDeleted(serverPayments);
      }
      return null;
    }
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
    const serverPayments = await fetchServerEntity<FeePayment[]>('/fee-payments');
    if (serverPayments && serverPayments.length > 0) {
      localStorage.setItem('ea_fee_payments', JSON.stringify(serverPayments));
      return filterDeleted(serverPayments);
    }
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

  // Persist to central server database and broadcast to other devices
  saveServerEntity('/fee-payments', payments).catch(e => console.warn('[Server Sync Fee Payments Notice]', e));

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

    // 3. Fallback to Server-Hosted Persistent Edge CDN Storage
    try {
      const cdnUrl = await uploadAssetToCDN(file, 'student-photos', `${cleanId}_${Date.now()}.${fileExt}`);
      if (cdnUrl) {
        console.log(`[Storage CDN Sync] Pupil photo saved directly to edge CDN storage: ${cdnUrl}`);
        return cdnUrl;
      }
    } catch (e) {
      console.warn('Fallback to CDN storage notice:', e);
    }

    // 4. Fallback to optimized data URL if bucket permissions/network restrict direct upload
    return dataUrl;
  } catch (err) {
    console.warn('Student photo storage upload error, attempting CDN fallback:', err);
    try {
      const cdnFallback = await uploadAssetToCDN(file, 'student-photos');
      if (cdnFallback) return cdnFallback;
    } catch {}
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
      const cdnUrl = await uploadAssetToCDN(file, 'teacher-photos');
      return cdnUrl || dataUrl;
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

    // Fallback to Server CDN Storage
    try {
      const cdnUrl = await uploadAssetToCDN(file, 'teacher-photos', `${cleanId}_${Date.now()}.${fileExt}`);
      if (cdnUrl) return cdnUrl;
    } catch {}

    return dataUrl;
  } catch (err) {
    try {
      const cdnUrl = await uploadAssetToCDN(file, 'teacher-photos');
      if (cdnUrl) return cdnUrl;
    } catch {}
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

export function removeDeletedBookStockId(id: string): void {
  if (!id) return;
  const cleanId = String(id).trim().toLowerCase();
  try {
    const current = getDeletedBookStockIds();
    const filtered = current.filter((c) => c.toLowerCase() !== cleanId);
    localStorage.setItem('ea_deleted_book_stock_ids', JSON.stringify(filtered));
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
  const client = getSupabaseClient();

  // 1. Sync remote tombstones from ea_deleted_records & ea_sync_logs to guarantee global deletion parity
  if (client) {
    try {
      const { data: delRecords } = await client
        .from('ea_deleted_records')
        .select('*')
        .eq('record_type', 'BOOK_STOCK')
        .order('deleted_at', { ascending: false })
        .limit(200);
      if (delRecords && Array.isArray(delRecords)) {
        delRecords.forEach((row: any) => {
          const details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
          recordDeletedBookStockId(row.record_id || details.id);
        });
      }
    } catch (delErr) {}

    try {
      const { data: logs } = await client
        .from('ea_sync_logs')
        .select('*')
        .eq('action_type', 'DELETE_BOOK_STOCK')
        .order('timestamp', { ascending: false })
        .limit(200);
      if (logs && Array.isArray(logs)) {
        logs.forEach((log: any) => {
          const details = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
          recordDeletedBookStockId(details.id || log.record_id);
        });
      }
    } catch (logErr) {}
  }

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

  if (client) {
    try {
      const fetchPromise = client.from('ea_book_stock').select('*').order('created_at', { ascending: false });
      const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), 5000)
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
  // 1. Un-tombstone any item being updated or inserted
  if (Array.isArray(items)) {
    items.forEach((item) => {
      if (item && item.id) {
        removeDeletedBookStockId(item.id);
      }
    });
  }

  // Record any explicitly provided deletedIds
  if (Array.isArray(deletedIds) && deletedIds.length > 0) {
    deletedIds.forEach((id) => recordDeletedBookStockId(id));
  }

  const activeDeletedList = getDeletedBookStockIds();
  const activeDeletedLower = new Set(activeDeletedList.map((id) => id.toLowerCase()));

  const cleanItems = (items || []).filter(
    (b) => b && b.id && !activeDeletedLower.has(String(b.id).trim().toLowerCase())
  );

  // 2. Immediately persist to localStorage for instant local reactivity
  try {
    localStorage.setItem('ea_book_stock_items', JSON.stringify(cleanItems));
    localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(cleanItems));
    localStorage.setItem('ea_book_stock_initialized', 'true');
    localStorage.setItem('ea_book_stock_seeded', 'true');
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('ea_book_stock_updated'));
  } catch (e) {}

  const client = getSupabaseClient();
  if (!client) {
    broadcastGlobalSync('ea_book_stock', { action: 'UPSERT', count: cleanItems.length });
    broadcastSync('book_stock', cleanItems, 'update');
    return true;
  }

  try {
    const allDeletedToPurge = Array.from(new Set([...(deletedIds || []), ...activeDeletedList]));
    if (allDeletedToPurge.length > 0) {
      try {
        await client.from('ea_book_stock').delete().in('id', allDeletedToPurge);
      } catch (delErr) {
        console.warn('Error purging deleted book stock items from Supabase:', delErr);
      }
    }

    // Clean any old tombstones for items that are being inserted or active
    if (cleanItems.length > 0) {
      try {
        const activeIds = cleanItems.map((b) => b.id);
        await client.from('ea_deleted_records').delete().eq('record_type', 'BOOK_STOCK').in('record_id', activeIds);
      } catch (e) {}
    }

    if (cleanItems.length === 0) {
      broadcastGlobalSync('ea_book_stock', { action: 'CLEAR', count: 0 });
      broadcastSync('book_stock', [], 'update');
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
      setTimeout(() => resolve({ error: { message: 'Upsert timeout' } }), 6000)
    );
    const { error } = await Promise.race([upsertPromise, timeoutPromise]);
    if (error) {
      console.warn('saveSupabaseBookStock error:', error);
    }

    // Log sync operation
    try {
      await client.from('ea_sync_logs').insert([{
        id: `sync_book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        action_type: 'UPSERT_BOOK_STOCK',
        description: `Textbook records synced: ${cleanItems.length} items`,
        performed_by: 'User',
        status: 'SUCCESS',
        details: { count: cleanItems.length, timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]);
    } catch (logErr) {}

    // Broadcast globally across Realtime WebSockets, BroadcastChannels, and in-memory listeners
    broadcastGlobalSync('ea_book_stock', { action: 'UPSERT', count: cleanItems.length });
    broadcastSync('book_stock', cleanItems, 'update');

    // Dual-sync to Master Node server database
    try {
      fetch(`/api/book-stock?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookStock: cleanItems })
      }).catch(() => {});
    } catch (e) {}

    return true;
  } catch (err) {
    console.warn('saveSupabaseBookStock exception:', err);
    broadcastGlobalSync('ea_book_stock', { action: 'UPSERT', count: cleanItems.length });
    broadcastSync('book_stock', cleanItems, 'update');
    try {
      fetch(`/api/book-stock?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookStock: cleanItems })
      }).catch(() => {});
    } catch (e) {}
    return true;
  }
}

export async function saveSingleSupabaseBookStockItem(item: BookStockItem): Promise<boolean> {
  if (!item || !item.id) return false;
  removeDeletedBookStockId(item.id);

  const current = await fetchSupabaseBookStock();
  const exists = current.some((b) => b.id === item.id);
  const updated = exists ? current.map((b) => (b.id === item.id ? item : b)) : [item, ...current];

  return saveSupabaseBookStock(updated);
}

export async function deleteSupabaseBookStockItem(id: string, title?: string): Promise<boolean> {
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
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('ea_book_stock_updated'));
  } catch (e) {}

  // 4. Directly sync deletion to Supabase database & record tombstone
  const client = getSupabaseClient();
  if (client) {
    try {
      await Promise.allSettled([
        client.from('ea_book_stock').delete().eq('id', cleanId),
        client.from('ea_book_stock').delete().ilike('id', cleanId)
      ]);

      // Record in ea_deleted_records for other devices to discover on poll/sync
      try {
        await client.from('ea_deleted_records').upsert([{
          id: `del_book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          record_type: 'BOOK_STOCK',
          record_id: cleanId,
          name: title || cleanId,
          details: { id: cleanId, title: title || '', timestamp: new Date().toISOString() },
          deleted_at: new Date().toISOString()
        }]);
      } catch (delErr) {}

      // Log in ea_sync_logs
      try {
        await client.from('ea_sync_logs').insert([{
          id: `del_book_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          action_type: 'DELETE_BOOK_STOCK',
          description: `Textbook deleted: ${title || cleanId} (${cleanId})`,
          performed_by: 'Admin',
          status: 'SUCCESS',
          details: { id: cleanId, title: title || '', timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      } catch (logErr) {}
    } catch (e) {
      console.warn('deleteSupabaseBookStockItem remote delete exception:', e);
    }
  }

  // 5. Broadcast globally across Realtime channel and Cross-Tab BroadcastChannel
  broadcastGlobalSync('ea_book_stock', { id: cleanId, title, action: 'DELETE' });
  broadcastSync('book_stock', { id: cleanId, title }, 'delete');

  // 6. Push deletion to Master Node server
  try {
    fetch(`/api/book-stock/${encodeURIComponent(cleanId)}?_t=${Date.now()}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cleanId, title })
    }).catch(() => {});
  } catch (e) {}

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

    // Dual-sync to Master Node server database
    try {
      fetch(`/api/book-sales?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookSales: cleanSales })
      }).catch(() => {});
    } catch (e) {}

    return true;
  } catch (err) {
    console.warn('saveSupabaseBookSales exception:', err);
    try {
      fetch(`/api/book-sales?_t=${Date.now()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookSales: cleanSales })
      }).catch(() => {});
    } catch (e) {}
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

  // Push deletion to Master Node server
  try {
    fetch(`/api/book-sales/${encodeURIComponent(cleanId)}?_t=${Date.now()}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cleanId })
    }).catch(() => {});
  } catch (e) {}

  return true;
}

// -------------------------------------------------------------
// GLOBAL REALTIME & CROSS-TAB BROADCAST SYNCHRONIZATION BUS
// -------------------------------------------------------------

let globalBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
    globalBroadcastChannel = new BroadcastChannel('ea_global_sync_channel');
  }
} catch (e) {
  // Fallback gracefully if BroadcastChannel is restricted
}

export type GlobalSyncDomain = 
  | 'students'
  | 'teachers'
  | 'grades'
  | 'attendance'
  | 'daily_attendance'
  | 'config'
  | 'bills'
  | 'fee_payments'
  | 'inventory'
  | 'book_stock'
  | 'book_sales'
  | 'deleted_records'
  | 'jhs_mock_exams'
  | 'all';

export interface GlobalSyncMessage {
  domain: GlobalSyncDomain;
  action?: 'insert' | 'update' | 'delete' | 'sync';
  timestamp: number;
  sourceTabId: string;
  payload?: any;
}

const CURRENT_TAB_ID = typeof window !== 'undefined'
  ? `tab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  : 'server_tab';

/**
 * Broadcast an update event across all open browser tabs and local event listeners immediately.
 */
export function broadcastSync(domain: GlobalSyncDomain, payload?: any, action: 'insert' | 'update' | 'delete' | 'sync' = 'sync') {
  if (typeof window === 'undefined') return;

  const message: GlobalSyncMessage = {
    domain,
    action,
    timestamp: Date.now(),
    sourceTabId: CURRENT_TAB_ID,
    payload
  };

  // 1. Cross-tab broadcast
  try {
    globalBroadcastChannel?.postMessage(message);
  } catch (e) {}

  // 2. Intra-tab custom event
  try {
    window.dispatchEvent(new CustomEvent(`ea_${domain}_updated`, { detail: message }));
    window.dispatchEvent(new CustomEvent('ea_global_sync', { detail: message }));
    window.dispatchEvent(new Event('storage'));
  } catch (e) {}
}

export interface RealtimeSyncCallbacks {
  onSyncEvent?: (event: GlobalSyncMessage) => void;
  onStudentsChange?: () => void;
  onTeachersChange?: () => void;
  onGradesChange?: () => void;
  onAttendanceChange?: () => void;
  onDailyAttendanceChange?: () => void;
  onConfigChange?: () => void;
  onBillsChange?: () => void;
  onFeePaymentsChange?: () => void;
  onInventoryChange?: () => void;
  onBookStockChange?: () => void;
  onBookSalesChange?: () => void;
  onDeletedRecordsChange?: () => void;
  onStatusChange?: (status: 'connected' | 'connecting' | 'error' | 'disconnected') => void;
}

/**
 * Subscribes to Supabase Realtime postgres_changes across all Academy tables AND
 * listens for cross-tab BroadcastChannel notifications.
 * Returns an unsubscribe teardown function.
 */
export function subscribeToGlobalRealtime(callbacks: RealtimeSyncCallbacks = {}): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Listen for cross-tab broadcasts
  const handleBroadcastMessage = (event: MessageEvent<GlobalSyncMessage>) => {
    const data = event.data;
    if (!data || data.sourceTabId === CURRENT_TAB_ID) return;

    callbacks.onSyncEvent?.(data);

    switch (data.domain) {
      case 'students':
        callbacks.onStudentsChange?.();
        break;
      case 'teachers':
        callbacks.onTeachersChange?.();
        break;
      case 'grades':
        callbacks.onGradesChange?.();
        break;
      case 'attendance':
        callbacks.onAttendanceChange?.();
        break;
      case 'daily_attendance':
        callbacks.onDailyAttendanceChange?.();
        callbacks.onAttendanceChange?.();
        break;
      case 'config':
        callbacks.onConfigChange?.();
        break;
      case 'bills':
        callbacks.onBillsChange?.();
        break;
      case 'fee_payments':
        callbacks.onFeePaymentsChange?.();
        break;
      case 'inventory':
        callbacks.onInventoryChange?.();
        break;
      case 'book_stock':
        callbacks.onBookStockChange?.();
        break;
      case 'book_sales':
        callbacks.onBookSalesChange?.();
        break;
      case 'deleted_records':
        callbacks.onDeletedRecordsChange?.();
        break;
      case 'all':
        callbacks.onStudentsChange?.();
        callbacks.onTeachersChange?.();
        callbacks.onGradesChange?.();
        callbacks.onAttendanceChange?.();
        callbacks.onDailyAttendanceChange?.();
        callbacks.onConfigChange?.();
        callbacks.onBillsChange?.();
        break;
    }
  };

  if (globalBroadcastChannel) {
    globalBroadcastChannel.addEventListener('message', handleBroadcastMessage);
  }

  // 2. Set up Supabase Realtime WebSocket subscription
  const client = getSupabaseClient();
  let channelInstance: any = null;

  if (client) {
    callbacks.onStatusChange?.('connecting');
    const channelName = `ea_realtime_${Math.random().toString(36).substring(2, 8)}`;
    channelInstance = client.channel(channelName);

    const tablesToListen: { table: string; domain: GlobalSyncDomain; callbackKey?: keyof RealtimeSyncCallbacks }[] = [
      { table: 'ea_config', domain: 'config', callbackKey: 'onConfigChange' },
      { table: 'ea_students', domain: 'students', callbackKey: 'onStudentsChange' },
      { table: 'ea_teachers', domain: 'teachers', callbackKey: 'onTeachersChange' },
      { table: 'ea_grades', domain: 'grades', callbackKey: 'onGradesChange' },
      { table: 'ea_attendance', domain: 'attendance', callbackKey: 'onAttendanceChange' },
      { table: 'ea_daily_attendance', domain: 'daily_attendance', callbackKey: 'onDailyAttendanceChange' },
      { table: 'ea_bills', domain: 'bills', callbackKey: 'onBillsChange' },
      { table: 'ea_fee_payments', domain: 'fee_payments', callbackKey: 'onFeePaymentsChange' },
      { table: 'ea_inventory', domain: 'inventory', callbackKey: 'onInventoryChange' },
      { table: 'ea_book_stock', domain: 'book_stock', callbackKey: 'onBookStockChange' },
      { table: 'ea_book_sales', domain: 'book_sales', callbackKey: 'onBookSalesChange' },
      { table: 'ea_deleted_records', domain: 'deleted_records', callbackKey: 'onDeletedRecordsChange' },
      { table: 'ea_sync_logs', domain: 'deleted_records', callbackKey: 'onDeletedRecordsChange' },
      { table: 'ea_jhs_mock_exams', domain: 'jhs_mock_exams' }
    ];

    tablesToListen.forEach(({ table, domain, callbackKey }) => {
      channelInstance = channelInstance.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload: any) => {
          // If deleted records changed, update tombstone registry immediately
          if (table === 'ea_deleted_records' && payload.new) {
            const row = payload.new;
            const details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
            if (row.record_type === 'STUDENT') {
              recordDeletedStudentId(row.record_id || details.id, row.roll_number || details.rollNumber, row.name || details.studentName);
            } else if (row.record_type === 'BOOK_STOCK' || row.record_type === 'TEXTBOOK') {
              recordDeletedBookStockId(row.record_id || details.id);
              window.dispatchEvent(new Event('ea_book_stock_updated'));
            }
          }

          if (table === 'ea_sync_logs' && payload.new) {
            const row = payload.new;
            if (row.action_type === 'DELETE_STUDENT') {
              const details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
              recordDeletedStudentId(details.id || details.studentId, details.rollNumber, details.studentName || details.name);
            } else if (row.action_type === 'DELETE_BOOK_STOCK') {
              const details = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
              recordDeletedBookStockId(details.id || row.record_id);
              window.dispatchEvent(new Event('ea_book_stock_updated'));
            }
          }

          if (table === 'ea_students' && (payload.eventType === 'DELETE' || payload.event === 'DELETE')) {
            if (payload.old) {
              recordDeletedStudentId(payload.old.id, payload.old.roll_number, payload.old.name);
            }
          }

          if (table === 'ea_book_stock' && (payload.eventType === 'DELETE' || payload.event === 'DELETE')) {
            if (payload.old && payload.old.id) {
              recordDeletedBookStockId(payload.old.id);
            }
            window.dispatchEvent(new Event('ea_book_stock_updated'));
          } else if (table === 'ea_book_stock') {
            window.dispatchEvent(new Event('ea_book_stock_updated'));
          }

          // Trigger domain callback
          if (callbackKey && typeof callbacks[callbackKey] === 'function') {
            (callbacks[callbackKey] as Function)();
          }

          // Broadcast locally
          broadcastSync(domain, payload, (payload.eventType?.toLowerCase() as any) || 'update');
        }
      );
    });

    channelInstance.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        callbacks.onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        callbacks.onStatusChange?.('error');
      } else if (status === 'CLOSED') {
        callbacks.onStatusChange?.('disconnected');
      }
    });
  } else {
    callbacks.onStatusChange?.('disconnected');
  }

  // Return teardown function
  return () => {
    if (globalBroadcastChannel) {
      globalBroadcastChannel.removeEventListener('message', handleBroadcastMessage);
    }
    if (channelInstance && client) {
      try {
        client.removeChannel(channelInstance);
      } catch (e) {}
    }
  };
}

export interface DatabaseAuditReport {
  timestamp: string;
  supabaseConfigured: boolean;
  supabaseConnected: boolean;
  serverConnected: boolean;
  counts: {
    students: { local: number; supabase: number | null; server: number | null; inSync: boolean };
    teachers: { local: number; supabase: number | null; server: number | null; inSync: boolean };
    grades: { local: number; supabase: number | null; server: number | null; inSync: boolean };
    attendance: { local: number; supabase: number | null; server: number | null; inSync: boolean };
    dailyAttendance: { local: number; supabase: number | null; server: number | null; inSync: boolean };
    bills: { local: number; supabase: number | null; server: number | null; inSync: boolean };
    feePayments: { local: number; supabase: number | null; server: number | null; inSync: boolean };
  };
  missingTables: string[];
  tableHealthStatus: TableHealthStatus[];
  suggestedSqlFix: string;
  failingTablesCount: number;
  recentSyncLogs: Array<{
    id: string;
    action_type?: string;
    actionType?: string;
    description: string;
    performed_by?: string;
    performedBy?: string;
    status: string;
    timestamp: string;
  }>;
}

export async function auditDatabaseCounts(): Promise<DatabaseAuditReport> {
  const client = getSupabaseClient();
  const isConfigured = !!client;
  let isConnected = false;
  let isServerConnected = false;
  const missingTables: string[] = [];

  const getLocalCount = (key: string): number => {
    try {
      const v = localStorage.getItem(key);
      if (v) {
        const parsed = JSON.parse(v);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch (e) {}
    return 0;
  };

  const localCounts = {
    students: getLocalCount('ea_students'),
    teachers: getLocalCount('ea_teachers'),
    grades: getLocalCount('ea_grades'),
    attendance: getLocalCount('ea_attendance'),
    dailyAttendance: getLocalCount('ea_daily_attendance'),
    bills: getLocalCount('ea_bills'),
    feePayments: getLocalCount('ea_fee_payments'),
  };

  let serverCounts: Record<string, number | null> = {
    students: null,
    teachers: null,
    grades: null,
    attendance: null,
    dailyAttendance: null,
    bills: null,
    feePayments: null,
  };

  try {
    const res = await fetch(`/api/sync/version?_t=${Date.now()}`);
    if (res.ok) {
      const json = await res.json();
      isServerConnected = true;
      if (json.counts) {
        serverCounts.students = json.counts.students ?? null;
        serverCounts.teachers = json.counts.teachers ?? null;
        serverCounts.grades = json.counts.grades ?? null;
        serverCounts.attendance = json.counts.attendance ?? null;
        serverCounts.dailyAttendance = json.counts.dailyAttendance ?? null;
        serverCounts.bills = json.counts.bills ?? null;
        serverCounts.feePayments = json.counts.feePayments ?? null;
      }
    }
  } catch (e) {}

  let supabaseCounts: Record<string, number | null> = {
    students: null,
    teachers: null,
    grades: null,
    attendance: null,
    dailyAttendance: null,
    bills: null,
    feePayments: null,
  };

  let allTableHealthStatuses: TableHealthStatus[] = [];

  if (client) {
    try {
      const { error } = await client.from('ea_config').select('id', { count: 'exact', head: true });
      if (!error) isConnected = true;
    } catch (e) {}

    // Audit all 18 tables in parallel
    allTableHealthStatuses = await Promise.all(
      MONITORED_SUPABASE_TABLES.map(tbl => checkTableHealth(client, tbl))
    );

    allTableHealthStatuses.forEach(t => {
      if (t.status !== 'healthy') {
        missingTables.push(t.table);
      } else {
        isConnected = true;
      }
    });

    const statusMap = new Map(allTableHealthStatuses.map(s => [s.table, s.count]));
    supabaseCounts.students = statusMap.get('ea_students') ?? null;
    supabaseCounts.teachers = statusMap.get('ea_teachers') ?? null;
    supabaseCounts.grades = statusMap.get('ea_grades') ?? null;
    supabaseCounts.attendance = statusMap.get('ea_attendance') ?? null;
    supabaseCounts.dailyAttendance = statusMap.get('ea_daily_attendance') ?? null;
    supabaseCounts.bills = statusMap.get('ea_bills') ?? null;
    supabaseCounts.feePayments = statusMap.get('ea_fee_payments') ?? null;
  }

  let recentSyncLogs: any[] = [];
  if (client) {
    try {
      const { data } = await client
        .from('ea_sync_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(20);
      if (data && Array.isArray(data)) {
        recentSyncLogs = data;
      }
    } catch (e) {}
  }
  if (recentSyncLogs.length === 0) {
    try {
      const savedLogs = localStorage.getItem('ea_audit_sync_logs');
      if (savedLogs) {
        recentSyncLogs = JSON.parse(savedLogs);
      }
    } catch (e) {}
  }

  const checkSync = (loc: number, sup: number | null, srv: number | null) => {
    if (sup !== null && sup !== loc) return false;
    if (srv !== null && srv !== loc) return false;
    return true;
  };

  const failingTables = allTableHealthStatuses.filter(t => t.status !== 'healthy');
  const suggestedSql = generateSuggestedSqlFix(failingTables.map(t => t.table));

  return {
    timestamp: new Date().toISOString(),
    supabaseConfigured: isConfigured,
    supabaseConnected: isConnected,
    serverConnected: isServerConnected,
    counts: {
      students: {
        local: localCounts.students,
        supabase: supabaseCounts.students,
        server: serverCounts.students,
        inSync: checkSync(localCounts.students, supabaseCounts.students, serverCounts.students),
      },
      teachers: {
        local: localCounts.teachers,
        supabase: supabaseCounts.teachers,
        server: serverCounts.teachers,
        inSync: checkSync(localCounts.teachers, supabaseCounts.teachers, serverCounts.teachers),
      },
      grades: {
        local: localCounts.grades,
        supabase: supabaseCounts.grades,
        server: serverCounts.grades,
        inSync: checkSync(localCounts.grades, supabaseCounts.grades, serverCounts.grades),
      },
      attendance: {
        local: localCounts.attendance,
        supabase: supabaseCounts.attendance,
        server: serverCounts.attendance,
        inSync: checkSync(localCounts.attendance, supabaseCounts.attendance, serverCounts.attendance),
      },
      dailyAttendance: {
        local: localCounts.dailyAttendance,
        supabase: supabaseCounts.dailyAttendance,
        server: serverCounts.dailyAttendance,
        inSync: checkSync(localCounts.dailyAttendance, supabaseCounts.dailyAttendance, serverCounts.dailyAttendance),
      },
      bills: {
        local: localCounts.bills,
        supabase: supabaseCounts.bills,
        server: serverCounts.bills,
        inSync: checkSync(localCounts.bills, supabaseCounts.bills, serverCounts.bills),
      },
      feePayments: {
        local: localCounts.feePayments,
        supabase: supabaseCounts.feePayments,
        server: serverCounts.feePayments,
        inSync: checkSync(localCounts.feePayments, supabaseCounts.feePayments, serverCounts.feePayments),
      },
    },
    missingTables,
    tableHealthStatus: allTableHealthStatuses,
    suggestedSqlFix: suggestedSql,
    failingTablesCount: failingTables.length,
    recentSyncLogs,
  };
}
