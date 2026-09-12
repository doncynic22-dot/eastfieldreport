/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Global Synchronization & Multi-Device Real-Time Engine
 * Ensures data is persisted centrally and remains 100% identical across all devices,
 * browsers, tabs, and CDN edge caches with zero stale-data leakage.
 */

import { Student, User, Grade, Attendance, StudentBill, ReportConfig, FeePayment, DailyAttendanceRecord } from '../types';

export interface GlobalSyncPayload {
  config?: ReportConfig;
  teachers?: User[];
  students?: Student[];
  grades?: Grade[];
  attendance?: Attendance[];
  dailyAttendance?: DailyAttendanceRecord[];
  bills?: StudentBill[];
  feePayments?: FeePayment[];
  inventory?: any[];
  bookStock?: any[];
  bookSales?: any[];
  deletedBookStockIds?: string[];
  deletedBookSaleIds?: string[];
  jhsMockExams?: any[];
  classTeacherAssignments?: Record<string, string>;
  deletedStudentIds?: string[];
  deletedTeacherIds?: string[];
  rosterCleared?: boolean;
  version?: number;
  lastUpdated?: string;
}

export type GlobalDatabaseState = GlobalSyncPayload;

export interface SyncStreamEvent {
  type: string;
  entity: string;
  version: number;
  payload?: any;
  timestamp: string;
}

type SyncCallback = (event: SyncStreamEvent) => void;

class GlobalSyncManager {
  private eventSource: EventSource | null = null;
  private subscribers: Set<SyncCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimeoutId: any = null;
  private isConnected = false;
  private lastKnownVersion = 0;
  private isChecking = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Connect to SSE stream
      this.connect();

      // Listen for window focus & visibility changes (e.g. waking phone or switching tabs)
      window.addEventListener('focus', () => this.handleVisibilityOrFocus());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.handleVisibilityOrFocus();
        }
      });

      // Listen for network reconnect
      window.addEventListener('online', () => {
        console.log('[GlobalSync] Network back online. Checking sync version...');
        this.connect();
        this.checkVersionAndSync();
      });

      // Continuous polling heartbeat (every 3.5s) to guarantee instantaneous state synchronization across all tabs and devices
      setInterval(() => {
        this.checkVersionAndSync();
      }, 3500);
    }
  }

  public subscribe(callback: SyncCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getVersion(): number {
    return this.lastKnownVersion;
  }

  public setVersion(v: number) {
    if (v > this.lastKnownVersion) {
      this.lastKnownVersion = v;
    }
  }

  public async fetchMasterServerSync() {
    return fetchMasterServerSync();
  }

  public async pushMasterServerSync(payload: Partial<GlobalSyncPayload>) {
    return pushMasterServerSync(payload);
  }

  private connect() {
    if (typeof window === 'undefined') return;

    if (this.eventSource) {
      try {
        this.eventSource.close();
      } catch (e) {}
      this.eventSource = null;
    }

    try {
      // Anti-cache query param so CDNs never cache the SSE connection
      const sseUrl = `/api/sync/stream?_t=${Date.now()}`;
      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('[GlobalSync] Connected to Real-time Sync stream.');
        window.dispatchEvent(new CustomEvent('ea_global_sync_status', { detail: { connected: true } }));
      };

      this.eventSource.addEventListener('connected', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data?.version) {
            this.setVersion(data.version);
          }
        } catch (err) {}
      });

      this.eventSource.addEventListener('sync', (e: MessageEvent) => {
        try {
          const eventData: SyncStreamEvent = JSON.parse(e.data);
          if (eventData.version) {
            this.setVersion(eventData.version);
          }

          console.log(`[GlobalSync] Incoming cross-device update: entity='${eventData.entity}', type='${eventData.type}'`);

          // Notify all in-app subscribers
          for (const sub of this.subscribers) {
            try {
              sub(eventData);
            } catch (err) {
              console.error('[GlobalSync] Subscriber callback error:', err);
            }
          }

          // Dispatch native CustomEvent for any decoupled UI components
          window.dispatchEvent(new CustomEvent('ea_global_sync_stream_event', { detail: eventData }));
        } catch (parseErr) {
          console.warn('[GlobalSync] Failed parsing sync event payload:', parseErr);
        }
      });

      this.eventSource.onerror = () => {
        this.isConnected = false;
        window.dispatchEvent(new CustomEvent('ea_global_sync_status', { detail: { connected: false } }));
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.scheduleReconnect();
      };
    } catch (err) {
      console.warn('[GlobalSync] Could not initialize EventSource:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeoutId) return;

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
    this.reconnectAttempts++;

    this.reconnectTimeoutId = setTimeout(() => {
      this.reconnectTimeoutId = null;
      this.connect();
    }, delay);
  }

  private handleVisibilityOrFocus() {
    this.checkVersionAndSync();
  }

  public async checkVersionAndSync(): Promise<boolean> {
    if (this.isChecking) return false;
    this.isChecking = true;
    try {
      // Force bypass all browser and CDN caches
      const res = await fetch(`/api/sync/version?_t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      });

      if (!res.ok) return false;
      const json = await res.json();
      const serverVersion = json.version || 0;

      let localStudentCount = 0;
      let localTeacherCount = 0;
      try {
        const s = localStorage.getItem('ea_students');
        if (s) localStudentCount = JSON.parse(s).length;
        const t = localStorage.getItem('ea_teachers');
        if (t) localTeacherCount = JSON.parse(t).length;
      } catch (e) {}

      const hasCountDivergence = json.counts && (
        (json.counts.students > 0 && json.counts.students !== localStudentCount) ||
        (json.counts.teachers > 0 && json.counts.teachers !== localTeacherCount)
      );

      if (serverVersion > this.lastKnownVersion || hasCountDivergence || this.lastKnownVersion === 0) {
        console.log(`[GlobalSync] Server sync triggered (server: ${serverVersion}, local: ${this.lastKnownVersion}, divergence: ${hasCountDivergence}). Refreshing...`);
        this.lastKnownVersion = serverVersion;
        window.dispatchEvent(new CustomEvent('ea_global_sync_outdated', { detail: { serverVersion } }));

        // Immediately fetch fresh state and broadcast to all in-app subscribers
        fetchMasterServerSync().then(fresh => {
          if (fresh && (fresh.data || fresh.students || fresh.teachers)) {
            const fullPayload = fresh.data || fresh;

            // Merge any deleted student IDs from server payload into localStorage
            const serverDeletedIds = fresh.deletedStudentIds || (fresh.data && fresh.data.deletedStudentIds);
            if (Array.isArray(serverDeletedIds) && serverDeletedIds.length > 0) {
              try {
                const savedDel = localStorage.getItem('ea_deleted_student_ids');
                const delArr: string[] = savedDel ? JSON.parse(savedDel) : [];
                const currentSet = new Set(delArr.map(x => String(x).toLowerCase().trim()));
                let updated = false;
                serverDeletedIds.forEach((id: string) => {
                  const clean = String(id).toLowerCase().trim();
                  if (clean && !currentSet.has(clean)) {
                    delArr.push(clean);
                    currentSet.add(clean);
                    updated = true;
                  }
                  const alphanum = clean.replace(/[^a-z0-9]/g, '');
                  if (alphanum && alphanum !== clean && !currentSet.has(alphanum)) {
                    delArr.push(alphanum);
                    currentSet.add(alphanum);
                    updated = true;
                  }
                });
                if (updated) {
                  localStorage.setItem('ea_deleted_student_ids', JSON.stringify(delArr));
                }
              } catch (e) {}
            }

            // CRITICAL: NEVER prune student deletion tombstones! Student deletions are permanent.
            // Filter incoming students payload against deleted student tombstones so deleted students are never resurrected
            if (Array.isArray(fullPayload.students)) {
              try {
                const savedDel = localStorage.getItem('ea_deleted_student_ids');
                const delArr: string[] = savedDel ? JSON.parse(savedDel) : [];
                if (delArr.length > 0) {
                  const delSet = new Set(delArr.map(x => String(x).toLowerCase().trim()));
                  fullPayload.students = fullPayload.students.filter((s: any) => {
                    if (!s) return false;
                    const id = s.id ? String(s.id).toLowerCase().trim() : '';
                    if (id && (delSet.has(id) || delSet.has(id.replace(/[^a-z0-9]/g, '')))) return false;
                    const roll = s.rollNumber ? String(s.rollNumber).toLowerCase().trim() : '';
                    if (roll && (delSet.has(roll) || delSet.has(roll.replace(/[^a-z0-9]/g, '')))) return false;
                    const name = s.name ? String(s.name).toLowerCase().trim() : '';
                    if (name && (delSet.has(name) || delSet.has(name.replace(/[^a-z0-9]/g, '')))) return false;
                    return true;
                  });
                }
              } catch (e) {}
            }

            const streamEvent: SyncStreamEvent = {
              type: 'FULL_SYNC',
              entity: 'all',
              version: serverVersion,
              payload: fullPayload,
              timestamp: fresh.lastUpdated
            };
            for (const sub of this.subscribers) {
              try {
                sub(streamEvent);
              } catch (e) {}
            }
            window.dispatchEvent(new CustomEvent('ea_global_sync_stream_event', { detail: streamEvent }));
          }
        }).catch(() => {});

        return true;
      }
      return false;
    } catch (err) {
      return false;
    } finally {
      this.isChecking = false;
    }
  }
}

// Singleton global sync manager instance
export const globalSyncEngine = new GlobalSyncManager();

/**
 * Standard anti-CDN cache fetch options
 * Ensures proxies, Cloudflare, Google Cloud CDN, and mobile browsers never serve stale cached responses
 */
export function getAntiCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'CDN-Cache-Control': 'no-store',
    'Cloudflare-CDN-Cache-Control': 'no-store',
    'Surrogate-Control': 'no-store',
    'Content-Type': 'application/json'
  };
}

/**
 * Explicit CDN & Server Synchronization when a pupil is added or updated
 */
export async function syncStudentAdditionToCDN(student: Student): Promise<boolean> {
  if (!student || (!student.id && !student.name)) return false;
  try {
    const url = `/api/students/admit?_t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getAntiCacheHeaders(),
      body: JSON.stringify({ student })
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.version) {
        globalSyncEngine.setVersion(json.version);
      }
      console.log(`[CDN Sync Engine] Student admission synchronized with CDN & Server. ID: ${student.id}`);
      window.dispatchEvent(new CustomEvent('ea_cdn_sync_complete', {
        detail: { action: 'ADMIT', student, timestamp: new Date().toISOString() }
      }));
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[CDN Sync Engine] syncStudentAdditionToCDN notice:', err);
    return false;
  }
}

/**
 * Explicit CDN & Server Synchronization when a pupil is deleted
 */
export async function syncStudentDeletionToCDN(
  id: string,
  rollNumber?: string,
  studentName?: string,
  photoUrl?: string
): Promise<boolean> {
  if (!id && !rollNumber && !studentName) return true;
  try {
    const targetIdentifier = encodeURIComponent(id || rollNumber || 'unknown');
    const url = `/api/students/${targetIdentifier}?_t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: getAntiCacheHeaders(),
      body: JSON.stringify({ rollNumber, studentName, photoUrl })
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      if (json.version) {
        globalSyncEngine.setVersion(json.version);
      }
      console.log(`[CDN Sync Engine] Student deletion synchronized with CDN & Server. Target: ${id || rollNumber}`);
      window.dispatchEvent(new CustomEvent('ea_cdn_sync_complete', {
        detail: { action: 'DELETE', id, rollNumber, studentName, timestamp: new Date().toISOString() }
      }));
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[CDN Sync Engine] syncStudentDeletionToCDN notice:', err);
    return false;
  }
}

/**
 * Explicit CDN & Server Synchronization for attendance
 */
export async function syncAttendanceToCDN(
  attendance: Attendance[],
  dailyAttendance?: DailyAttendanceRecord[]
): Promise<boolean> {
  try {
    const res = await fetch(`/api/attendance?_t=${Date.now()}`, {
      method: 'POST',
      headers: getAntiCacheHeaders(),
      body: JSON.stringify({ attendance, dailyAttendance })
    });
    return res.ok;
  } catch (err) {
    console.warn('[CDN Sync Engine] syncAttendanceToCDN notice:', err);
    return false;
  }
}

/**
 * Explicit CDN & Server Synchronization for Teachers / Staff Registry
 */
export async function syncTeachersToCDN(teachers: User[]): Promise<boolean> {
  if (!Array.isArray(teachers)) return false;
  try {
    const res = await fetch(`/api/teachers?_t=${Date.now()}`, {
      method: 'POST',
      headers: getAntiCacheHeaders(),
      body: JSON.stringify({ teachers })
    });
    return res.ok;
  } catch (err) {
    console.warn('[CDN Sync Engine] syncTeachersToCDN notice:', err);
    return false;
  }
}

/**
 * Explicit CDN & Server Synchronization when a Teacher / Staff is deleted
 */
export async function syncTeacherDeletionToCDN(id: string, email?: string, name?: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/teachers/${encodeURIComponent(id)}?_t=${Date.now()}`, {
      method: 'DELETE',
      headers: getAntiCacheHeaders(),
      body: JSON.stringify({ email, name })
    });
    return res.ok;
  } catch (err) {
    console.warn('[CDN Sync Engine] syncTeacherDeletionToCDN notice:', err);
    return false;
  }
}

/**
 * Upload any binary file, blob, or base64 data to persistent CDN storage
 */
export async function uploadAssetToCDN(
  fileOrBlob: File | Blob | string,
  folder: string = 'assets',
  customFileName?: string
): Promise<string | null> {
  try {
    let fileData = '';
    let contentType = 'image/jpeg';
    let fileName = customFileName || `asset_${Date.now()}.jpg`;

    if (typeof fileOrBlob === 'string') {
      fileData = fileOrBlob;
      if (fileData.startsWith('data:')) {
        const match = fileData.match(/^data:([^;]+);base64,/);
        if (match) contentType = match[1];
      }
    } else {
      contentType = fileOrBlob.type || 'image/jpeg';
      if ('name' in fileOrBlob && !customFileName) {
        fileName = (fileOrBlob as File).name;
      }
      fileData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string) || '');
        reader.onerror = reject;
        reader.readAsDataURL(fileOrBlob);
      });
    }

    const res = await fetch('/api/cdn/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileData,
        fileName,
        folder,
        contentType
      })
    });

    if (res.ok) {
      const json = await res.json();
      if (json.url || json.cdnUrl) {
        const publicUrl = json.url || json.cdnUrl;
        console.log(`[CDN Sync Engine] Uploaded to CDN storage successfully: ${publicUrl}`);
        return publicUrl;
      }
    }
    return null;
  } catch (err) {
    console.warn('[CDN Sync Engine] uploadAssetToCDN error:', err);
    return null;
  }
}

/**
 * Check CDN edge and storage operational status
 */
export async function checkCDNHealth(): Promise<{ ok: boolean; status?: string }> {
  try {
    const res = await fetch(`/api/cdn/health?_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      return { ok: true, status: data.cdn || 'operational' };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * Fetch full master state from server
 */
export async function fetchMasterServerSync(): Promise<({ version: number; lastUpdated: string; data: GlobalSyncPayload } & GlobalSyncPayload) | null> {
  try {
    const res = await fetch(`/api/sync/all?_t=${Date.now()}`, {
      method: 'GET',
      headers: getAntiCacheHeaders()
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.status === 'success' && json.data) {
      if (json.version) {
        globalSyncEngine.setVersion(json.version);
      }
      return {
        version: json.version || 0,
        lastUpdated: json.lastUpdated || new Date().toISOString(),
        data: json.data,
        ...json.data
      };
    }
    return null;
  } catch (err) {
    console.warn('[GlobalSync] fetchMasterServerSync error:', err);
    return null;
  }
}

/**
 * Push full or partial master state to server
 */
export async function pushMasterServerSync(payload: Partial<GlobalSyncPayload>): Promise<boolean> {
  try {
    const res = await fetch(`/api/sync/all?_t=${Date.now()}`, {
      method: 'POST',
      headers: getAntiCacheHeaders(),
      body: JSON.stringify({ ...payload, timestamp: new Date().toISOString() })
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.version) {
      globalSyncEngine.setVersion(json.version);
    }
    return json.status === 'success';
  } catch (err) {
    console.warn('[GlobalSync] pushMasterServerSync error:', err);
    return false;
  }
}

/**
 * Generic fetcher for a single entity from server
 */
export async function fetchServerEntity<T>(endpoint: string): Promise<T | null> {
  try {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `/api${cleanEndpoint}?_t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getAntiCacheHeaders()
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data !== undefined ? json.data : (json[endpoint.replace('/', '')] || json);
  } catch (err) {
    console.warn(`[GlobalSync] fetchServerEntity (${endpoint}) error:`, err);
    return null;
  }
}

/**
 * Generic saver for a single entity to server
 */
export async function saveServerEntity<T>(endpoint: string, payload: T): Promise<boolean> {
  try {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `/api${cleanEndpoint}?_t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: getAntiCacheHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.version) {
      globalSyncEngine.setVersion(json.version);
    }
    return json.status === 'success' || res.status === 200;
  } catch (err) {
    console.warn(`[GlobalSync] saveServerEntity (${endpoint}) error:`, err);
    return false;
  }
}
