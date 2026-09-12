/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Student, User, Subject, ReportConfig, Grade, Attendance, StudentBill, DailyAttendanceRecord } from './types';
import { 
  INITIAL_CLASSES, 
  INITIAL_SUBJECTS, 
  INITIAL_STUDENTS, 
  INITIAL_USERS, 
  INITIAL_GRADES, 
  INITIAL_ATTENDANCE, 
  DEFAULT_REPORT_CONFIG 
} from './data/mockData';
import AdminDashboard from './components/AdminDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import StudentAttendancePortal from './components/StudentAttendancePortal';
import academyHubBg from './assets/images/academy_hub_bg_sharp_1786006863900.jpg';
import { School, ShieldCheck, GraduationCap, Users2, FileCheck, CheckCircle2, Lock, Sparkles, BookOpen, Eye, EyeOff, Database, AlertTriangle, X, Menu, RefreshCw, Check, ExternalLink, Activity, Server, AlertCircle, Copy } from 'lucide-react';
import {
  getSupabaseCredentials,
  testSupabaseConnection,
  SupabaseDetailedStatusReport,
  TableHealthStatus,
  fetchSupabaseConfig,
  fetchSupabaseStudents,
  fetchSupabaseTeachers,
  fetchSupabaseGrades,
  fetchSupabaseAttendance,
  fetchSupabaseDailyAttendance,
  fetchSupabaseBills,
  fetchSupabaseFeePayments,
  fetchSupabaseJHSMockExams,
  fetchSupabaseInventory,
  saveSupabaseConfig,
  saveSupabaseStudents,
  saveSupabaseTeachers,
  saveSupabaseGrades,
  saveSupabaseAttendance,
  saveSupabaseDailyAttendance,
  saveSupabaseBills,
  saveSupabaseFeePayments,
  fetchSupabaseBookStock,
  SUPABASE_SQL_REPAIR,
  isStudentDeleted,
  getDeletedStudentIds,
  recordDeletedStudentId,
  recordDeletedBookStockId,
  subscribeToGlobalRealtime,
  broadcastSync,
  pruneDeletedTombstones
} from './lib/supabase';
import { isAutoPromotionDue, promoteStudents, restoreAllStudentsToAdmittedLevels, deduplicateStudents, restoreStudentsFromTerminalReport } from './services/promotionService';
import { getCanonicalSubjectId } from './utils/subjectUtils';
import { isDemoStudent } from './data/demoPupils';
import { globalSyncEngine, GlobalDatabaseState, pushMasterServerSync, syncTeachersToCDN, syncAttendanceToCDN } from './lib/globalSync';
import { reconcileTeachersWithClassAssignments, getClassTeacherAssignments, saveClassTeacherAssignmentsLocally } from './services/classTeacherService';


export default function App() {
  // Master States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<User[]>(() => {
    try {
      const cached = localStorage.getItem('ea_teachers') || localStorage.getItem('mock_supabase_ea_teachers');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return reconcileTeachersWithClassAssignments(parsed);
        }
      }
      return reconcileTeachersWithClassAssignments(INITIAL_USERS);
    } catch {
      return INITIAL_USERS;
    }
  });
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>(() => {
    try {
      const cached = localStorage.getItem('ea_attendance') || localStorage.getItem('mock_supabase_ea_attendance');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendanceRecord[]>(() => {
    try {
      const saved = localStorage.getItem('ea_daily_attendance') || localStorage.getItem('mock_supabase_ea_daily_attendance');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ea_daily_attendance', JSON.stringify(dailyAttendance));
      localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(dailyAttendance));
    } catch (e) {
      console.warn('Failed saving daily attendance to localStorage', e);
    }
  }, [dailyAttendance]);

  useEffect(() => {
    try {
      localStorage.setItem('ea_attendance', JSON.stringify(attendance));
      localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(attendance));
    } catch (e) {
      console.warn('Failed saving attendance to localStorage', e);
    }
  }, [attendance]);

  const [bills, setBills] = useState<StudentBill[]>([]);
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
  const [isInitialized, setIsInitialized] = useState(false);

  const handleUpdateBill = (updatedBill: StudentBill) => {
    setBills(prev => {
      const next = [...prev.filter(b => b.studentId !== updatedBill.studentId), updatedBill];
      localStorage.setItem('ea_bills', JSON.stringify(next));
      localStorage.setItem('mock_supabase_ea_bills', JSON.stringify(next));
      saveSupabaseBills(next).catch(e => console.warn('Background sync bills error', e));
      return next;
    });
  };

  // Nav State: 'hub' | 'admin' | 'teacher' | 'attendance'
  const [activePortal, setActivePortal] = useState<'hub' | 'admin' | 'teacher' | 'attendance'>(() => {
    if (typeof window !== 'undefined') {
      const q = window.location.search || '';
      const h = window.location.hash || '';
      if (q.includes('action=reset-password') || q.includes('type=recovery') || h.includes('action=reset-password') || h.includes('type=recovery')) {
        return 'teacher';
      }
    }
    return 'hub';
  });

  // Listen for password reset link redirects dynamically
  useEffect(() => {
    const handleUrlChange = () => {
      if (typeof window !== 'undefined') {
        const q = window.location.search || '';
        const h = window.location.hash || '';
        if (q.includes('action=reset-password') || q.includes('type=recovery') || h.includes('action=reset-password') || h.includes('type=recovery')) {
          setActivePortal('teacher');
        }
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // Admin Security Lock Gate State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@eastfield.com');
  const [adminPassword, setAdminPassword] = useState('');
  const [storedAdminPassword, setStoredAdminPassword] = useState(() => localStorage.getItem('ea_admin_password') || 'adminSecure2026!');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminError, setAdminError] = useState('');

  const handleUpdateAdminPassword = (newPass: string) => {
    setStoredAdminPassword(newPass);
    localStorage.setItem('ea_admin_password', newPass);
  };

  // Active Logged-in Teacher State (null if not logged in)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Supabase Sync States
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseDetailedStatusReport>({
    success: false,
    isConfigured: false,
    isConnected: false,
    message: 'Supabase is not configured.',
    healthyTables: [],
    failingTables: [],
    allTablesStatus: [],
    totalTablesChecked: 0,
    healthyCount: 0,
    failingCount: 0,
    suggestedSqlFix: '',
    checkedAt: new Date().toISOString()
  });
  const [isSupabaseSyncing, setIsSupabaseSyncing] = useState(false);
  const [isAuditingSupabase, setIsAuditingSupabase] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'error' | 'disconnected'>('connecting');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(new Date());
  const [lastSyncError, setLastSyncError] = useState<string>('');
  const [showSyncErrorModal, setShowSyncErrorModal] = useState(false);
  const [copiedRepair, setCopiedRepair] = useState(false);
  const [copiedCustomSql, setCopiedCustomSql] = useState(false);
  const isPullingRemoteRef = useRef(false);
  const lastSavedStudentsSigRef = useRef<string>('');
  const lastSavedTeachersSigRef = useRef<string>('');
  const lastSavedGradesSigRef = useRef<string>('');
  const lastSavedAttendanceSigRef = useRef<string>('');
  const lastSavedConfigSigRef = useRef<string>('');
  const lastSavedBillsSigRef = useRef<string>('');
  const lastSavedDailyAttendanceSigRef = useRef<string>('');

  // Check connection status with detailed table diagnostics and suggested SQL fixes
  const checkSupabaseStatus = async (): Promise<SupabaseDetailedStatusReport> => {
    setIsAuditingSupabase(true);
    const creds = getSupabaseCredentials();
    if (!creds.isConfigured) {
      const emptyReport: SupabaseDetailedStatusReport = {
        success: false,
        isConfigured: false,
        isConnected: false,
        message: 'No credentials found. Please configure Supabase in settings.',
        healthyTables: [],
        failingTables: [],
        allTablesStatus: [],
        totalTablesChecked: 0,
        healthyCount: 0,
        failingCount: 0,
        suggestedSqlFix: '',
        checkedAt: new Date().toISOString()
      };
      setSupabaseStatus(emptyReport);
      setIsAuditingSupabase(false);
      return emptyReport;
    }

    setSupabaseStatus(prev => ({
      ...prev,
      isConfigured: true,
      message: 'Auditing 18 Supabase tables and cloud sync health...'
    }));

    try {
      const result = await testSupabaseConnection();
      setSupabaseStatus(result.report);
      if (!result.success || result.report.failingCount > 0) {
        setLastSyncError(result.message);
      }
      return result.report;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to communicate with Supabase.';
      const fallbackReport: SupabaseDetailedStatusReport = {
        success: false,
        isConfigured: true,
        isConnected: false,
        message: errorMsg,
        healthyTables: [],
        failingTables: [],
        allTablesStatus: [],
        totalTablesChecked: 0,
        healthyCount: 0,
        failingCount: 0,
        suggestedSqlFix: '',
        checkedAt: new Date().toISOString()
      };
      setSupabaseStatus(fallbackReport);
      setLastSyncError(errorMsg);
      return fallbackReport;
    } finally {
      setIsAuditingSupabase(false);
    }
  };

  // Pull all tables from Supabase with smart fallbacks and automatic seeding
  const handlePullFromSupabase = async () => {
    isPullingRemoteRef.current = true;
    setIsSupabaseSyncing(true);
    try {
      const activeReport = await checkSupabaseStatus();
      if (!activeReport.isConnected) {
        setIsSupabaseSyncing(false);
        isPullingRemoteRef.current = false;
        return false;
      }

      // Read current values from localStorage (fallback cache)
      const cachedConfigStr = localStorage.getItem('ea_config');
      const localConfig = cachedConfigStr ? JSON.parse(cachedConfigStr) : DEFAULT_REPORT_CONFIG;

      const cachedStudentsStr = localStorage.getItem('ea_students');
      const localStudents: Student[] = cachedStudentsStr ? JSON.parse(cachedStudentsStr) : [];

      const cachedTeachersStr = localStorage.getItem('ea_teachers');
      let parsedTeachers: User[] = [];
      try {
        if (cachedTeachersStr) parsedTeachers = JSON.parse(cachedTeachersStr);
      } catch (e) {}
      const localTeachers: User[] = (Array.isArray(parsedTeachers) && parsedTeachers.length > 0)
        ? parsedTeachers
        : INITIAL_USERS;

      const cachedGradesStr = localStorage.getItem('ea_grades');
      const localGrades: Grade[] = cachedGradesStr ? JSON.parse(cachedGradesStr) : [];

      const cachedAttendanceStr = localStorage.getItem('ea_attendance');
      const localAttendance: Attendance[] = cachedAttendanceStr ? JSON.parse(cachedAttendanceStr) : [];

      // 1. Fetch & Sync Config
      let sConfig: ReportConfig | null = null;
      let configFetchSuccess = false;
      try {
        sConfig = await fetchSupabaseConfig();
        configFetchSuccess = true;
      } catch (err: any) {
        console.warn("Failed fetching config from Supabase. Falling back to local cache.", err);
      }

      if (configFetchSuccess) {
        if (sConfig) {
          const mergedConfig: ReportConfig = {
            ...DEFAULT_REPORT_CONFIG,
            ...localConfig,
            ...sConfig
          };
          if (sConfig.reopeningDate) {
            mergedConfig.reopeningDate = sConfig.reopeningDate;
          }
          setConfig(mergedConfig);
          localStorage.setItem('ea_config', JSON.stringify(mergedConfig));
        } else if (cachedConfigStr) {
          // Only seed if this client device has user-edited local cache
          try {
            await saveSupabaseConfig(localConfig);
            setConfig(localConfig);
          } catch (seedErr) {
            console.error("Failed seeding config to Supabase:", seedErr);
            setConfig(localConfig);
          }
        } else {
          setConfig(DEFAULT_REPORT_CONFIG);
        }
      } else {
        // Query failed (e.g. missing column) -> use local cache, don't write to DB
        setConfig(localConfig);
      }

      // 2. Fetch & Sync Teachers
      let sTeachers: User[] | null = null;
      let teachersFetchSuccess = false;
      try {
        sTeachers = await fetchSupabaseTeachers();
        teachersFetchSuccess = true;
      } catch (err: any) {
        console.warn("Failed fetching teachers from Supabase. Falling back to local cache.", err);
      }

      let activeTeachers = (localTeachers && localTeachers.length > 0) ? localTeachers : INITIAL_USERS;
      if (teachersFetchSuccess && sTeachers !== null) {
        if (sTeachers.length === 0) {
          // Empty table in Supabase -> seed with full staff roster
          const teachersToSeed = activeTeachers.length > 0 ? activeTeachers : INITIAL_USERS;
          activeTeachers = teachersToSeed;
          setTeachers(teachersToSeed);
          localStorage.setItem('ea_teachers', JSON.stringify(teachersToSeed));
          saveSupabaseTeachers(teachersToSeed).catch(seedErr => {
            console.error("Failed seeding teachers to Supabase:", seedErr);
          });
        } else {
          activeTeachers = reconcileTeachersWithClassAssignments(sTeachers);
          setTeachers(activeTeachers);
          localStorage.setItem('ea_teachers', JSON.stringify(activeTeachers));
        }
      } else {
        // Query failed or fallback -> populate local teachers or defaults
        activeTeachers = reconcileTeachersWithClassAssignments((localTeachers && localTeachers.length > 0) ? localTeachers : INITIAL_USERS);
        setTeachers(activeTeachers);
        localStorage.setItem('ea_teachers', JSON.stringify(activeTeachers));
      }

      // 3. Fetch & Sync Students
      let sStudents: Student[] | null = null;
      let studentsFetchSuccess = false;
      try {
        sStudents = await fetchSupabaseStudents();
        studentsFetchSuccess = true;
      } catch (err: any) {
        console.warn("Failed fetching students from Supabase. Falling back to local cache.", err);
      }

      // Filter out any teacher accounts that may have leaked into students
      const teacherEmails = new Set(activeTeachers.map(t => t.email.toLowerCase()));
      const teacherIds = new Set(activeTeachers.map(t => t.id));

      if (studentsFetchSuccess && sStudents !== null) {
        // Authoritative cloud pupils are active; ensure local browser deletion markers don't suppress enrolled pupils
        pruneDeletedTombstones(sStudents, activeTeachers);

        let cleanStudents = sStudents.filter(
          s => !teacherIds.has(s.id) && !teacherEmails.has((s.guardianEmail || '').toLowerCase())
        );

        // Auto-heal if any students were corrupted into "Graduated"
        const hasGraduated = cleanStudents.some(s => (s.className || '').toLowerCase().includes('graduated'));
        if (hasGraduated) {
          cleanStudents = cleanStudents.map(s =>
            (s.className || '').toLowerCase().includes('graduated')
              ? { ...s, className: 'JHS 3', level: 'JHS' }
              : s
          );
        }

        cleanStudents = cleanStudents.filter(s => !isStudentDeleted(s) && !isDemoStudent(s));

        // Supabase is authoritative: do not resurrect deleted students from local cache
        const activeStudents = deduplicateStudents(cleanStudents);

        if (activeStudents.length > 0) {
          localStorage.removeItem('ea_students_cleared');
        } else {
          localStorage.setItem('ea_students_cleared', 'true');
        }

        console.log(`[Supabase Student Sync Diagnostic] handlePullFromSupabase: Loaded ${activeStudents.length} students from remote cloud`);
        lastSavedStudentsSigRef.current = activeStudents.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
        setStudents(activeStudents);
        localStorage.setItem('ea_students', JSON.stringify(activeStudents));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(activeStudents));
        localStorage.setItem('ea_has_initialized', 'true');
        // Keep server cache in lockstep with authoritative ea_students records
        fetch('/api/sync/all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ students: activeStudents })
        }).catch(() => {});
      } else {
        let cleanLocalStudents = localStudents.filter(
          s => !teacherIds.has(s.id)
        ).filter(s => !isStudentDeleted(s) && !isDemoStudent(s));
        cleanLocalStudents = deduplicateStudents(cleanLocalStudents);
        console.log(`[Supabase Student Sync Diagnostic] handlePullFromSupabase (offline/failed): Retaining ${cleanLocalStudents.length} students from local cache.`);
        lastSavedStudentsSigRef.current = cleanLocalStudents.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
        setStudents(cleanLocalStudents);
        localStorage.setItem('ea_students', JSON.stringify(cleanLocalStudents));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(cleanLocalStudents));
        localStorage.setItem('ea_has_initialized', 'true');
      }

      // 4. Fetch & Sync Grades
      let sGrades: Grade[] | null = null;
      let gradesFetchSuccess = false;
      try {
        sGrades = await fetchSupabaseGrades();
        gradesFetchSuccess = true;
      } catch (err: any) {
        console.warn("Failed fetching grades from Supabase. Falling back to local cache.", err);
      }

      let activeGrades = localGrades;
      if (gradesFetchSuccess && sGrades !== null) {
        // Smart merge local and Supabase grades so no local records are wiped out
        const gradeMap = new Map<string, Grade>();
        const studentLevelMap = new Map<string, string>();
        localStudents.forEach(s => studentLevelMap.set(s.id, s.level));

        sGrades.forEach(g => {
          const stLevel = studentLevelMap.get(g.studentId);
          const cSubId = getCanonicalSubjectId(g.subjectId, stLevel);
          const normalizedG = { ...g, subjectId: cSubId };
          const key = `${g.studentId}_${cSubId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
          gradeMap.set(key, normalizedG);
        });
        localGrades.forEach(g => {
          const stLevel = studentLevelMap.get(g.studentId);
          const cSubId = getCanonicalSubjectId(g.subjectId, stLevel);
          const normalizedG = { ...g, subjectId: cSubId };
          const key = `${g.studentId}_${cSubId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
          const existing = gradeMap.get(key);
          if (!existing) {
            gradeMap.set(key, normalizedG);
          } else {
            const localTime = g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
            const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            if (localTime >= remoteTime) {
              gradeMap.set(key, normalizedG);
            }
          }
        });
        activeGrades = Array.from(gradeMap.values());
        setGrades(activeGrades);
        localStorage.setItem('ea_grades', JSON.stringify(activeGrades));
        localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(activeGrades));
        saveSupabaseGrades(activeGrades).catch(e => console.warn("Background sync grades failed", e));
      } else {
        setGrades(localGrades);
      }

      // 5. Fetch & Sync Attendance
      let sAttendance: Attendance[] | null = null;
      let attendanceFetchSuccess = false;
      try {
        sAttendance = await fetchSupabaseAttendance();
        attendanceFetchSuccess = true;
      } catch (err: any) {
        console.warn("Failed fetching attendance from Supabase. Falling back to local cache.", err);
      }

      let activeAttendance = localAttendance;
      if (attendanceFetchSuccess && sAttendance !== null) {
        const attMap = new Map<string, Attendance>();
        sAttendance.forEach(a => {
          const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`;
          attMap.set(key, a);
        });
        localAttendance.forEach(a => {
          const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`;
          const existing = attMap.get(key);
          if (!existing) {
            attMap.set(key, a);
          } else {
            const localTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            if (localTime >= remoteTime) {
              attMap.set(key, a);
            }
          }
        });
        activeAttendance = Array.from(attMap.values());
        setAttendance(activeAttendance);
        localStorage.setItem('ea_attendance', JSON.stringify(activeAttendance));
        localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(activeAttendance));
        saveSupabaseAttendance(activeAttendance).catch(e => console.warn("Background sync attendance failed", e));
      } else {
        setAttendance(localAttendance);
      }

      // 5b. Fetch & Sync Daily Attendance (Roll Call)
      let sDailyAttendance: DailyAttendanceRecord[] | null = null;
      let dailyAttendanceFetchSuccess = false;
      try {
        sDailyAttendance = await fetchSupabaseDailyAttendance();
        dailyAttendanceFetchSuccess = true;
      } catch (err: any) {
        console.warn("Failed fetching daily attendance. Falling back to local cache.", err);
      }

      if (dailyAttendanceFetchSuccess && sDailyAttendance !== null) {
        const dailyMap = new Map<string, DailyAttendanceRecord>();
        sDailyAttendance.forEach(r => {
          if (r && r.studentId && r.date) {
            dailyMap.set(`${r.studentId}_${r.date}`, r);
          }
        });
        dailyAttendance.forEach(r => {
          if (r && r.studentId && r.date) {
            const key = `${r.studentId}_${r.date}`;
            const existing = dailyMap.get(key);
            if (!existing) {
              dailyMap.set(key, r);
            } else {
              const localTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
              const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
              if (localTime >= remoteTime) {
                dailyMap.set(key, r);
              }
            }
          }
        });
        const activeDaily = Array.from(dailyMap.values());
        setDailyAttendance(activeDaily);
        localStorage.setItem('ea_daily_attendance', JSON.stringify(activeDaily));
        localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(activeDaily));
        saveSupabaseDailyAttendance(activeDaily).catch(e => console.warn("Background sync daily attendance failed", e));
      }

      // 6. Fetch & Sync Bills
      let sBills: StudentBill[] | null = null;
      let billsFetchSuccess = false;
      try {
        sBills = await fetchSupabaseBills();
        billsFetchSuccess = true;
      } catch (err: any) {
        console.warn("Failed fetching bills from Supabase. Falling back to local cache.", err);
      }

      const cachedBillsStr = localStorage.getItem('ea_bills');
      let localBills: StudentBill[] = [];
      if (cachedBillsStr) {
        try { localBills = JSON.parse(cachedBillsStr); } catch (e) { localBills = []; }
      }

      let activeBills = localBills;
      if (billsFetchSuccess && sBills !== null) {
        const billMap = new Map<string, StudentBill>();
        sBills.forEach(b => billMap.set(b.studentId, b));
        localBills.forEach(b => {
          const existing = billMap.get(b.studentId);
          if (!existing) {
            billMap.set(b.studentId, b);
          } else {
            const localTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            if (localTime >= remoteTime) {
              billMap.set(b.studentId, b);
            }
          }
        });
        activeBills = Array.from(billMap.values());
        setBills(activeBills);
        localStorage.setItem('ea_bills', JSON.stringify(activeBills));
        localStorage.setItem('mock_supabase_ea_bills', JSON.stringify(activeBills));
        saveSupabaseBills(activeBills).catch(e => console.warn("Background sync bills failed", e));
      } else {
        setBills(localBills);
      }

      // Sync Fee Payments
      try {
        const sPayments = await fetchSupabaseFeePayments();
        if (sPayments && Array.isArray(sPayments)) {
          localStorage.setItem('ea_fee_payments', JSON.stringify(sPayments));
          localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify(sPayments));
          window.dispatchEvent(new Event('storage'));
        }
      } catch (err) {
        console.warn('Failed fetching fee payments from Supabase', err);
      }

      setIsSupabaseSyncing(false);
      setTimeout(() => {
        isPullingRemoteRef.current = false;
      }, 500);
      return true;
    } catch (e: any) {
      console.error('Failed pulling from Supabase:', e);
      setIsSupabaseSyncing(false);
      setTimeout(() => {
        isPullingRemoteRef.current = false;
      }, 500);
      return false;
    }
  };

  // Push all local states to Supabase
  const handlePushToSupabase = useCallback(async (
    customStudents?: Student[],
    customConfig?: ReportConfig,
    customTeachers?: User[],
    customGrades?: Grade[],
    customAttendance?: Attendance[],
    customBills?: StudentBill[]
  ) => {
    setIsSupabaseSyncing(true);
    try {
      // Check status for UI indicator, but do not block server and local persistence
      await checkSupabaseStatus();

      if (customStudents && customStudents.length > 0) {
        try {
          localStorage.removeItem('ea_students_cleared');
        } catch (e) {}
      }

      const isRosterCleared = (customStudents && customStudents.length > 0)
        ? false
        : (typeof localStorage !== 'undefined' && localStorage.getItem('ea_students_cleared') === 'true');

      const targetConfig = customConfig || config;
      const targetStudents = (customStudents !== undefined)
        ? customStudents
        : (isRosterCleared ? [] : students);

      if (targetStudents.length > 0) {
        try {
          localStorage.removeItem('ea_students_cleared');
        } catch (e) {}
      }

      const targetTeachers = customTeachers || teachers;
      const targetGrades = isRosterCleared ? [] : (customGrades !== undefined ? customGrades : grades);
      const targetAttendance = isRosterCleared ? [] : (customAttendance !== undefined ? customAttendance : attendance);
      const targetBills = isRosterCleared ? [] : (customBills !== undefined ? customBills : bills);
      const targetFeePayments = (() => {
        try {
          const cached = localStorage.getItem('ea_fee_payments');
          return cached ? JSON.parse(cached) : [];
        } catch (e) {
          return [];
        }
      })();

      console.log(`[Supabase Student Sync Diagnostic] Manual Push: Pushing ${targetStudents.length} students to Supabase (in-memory state: ${students.length})`);
      const okConfig = await saveSupabaseConfig(targetConfig);
      const okStudents = await saveSupabaseStudents(targetStudents);
      const okTeachers = await saveSupabaseTeachers(targetTeachers);
      const okGrades = await saveSupabaseGrades(targetGrades);
      const okAttendance = await saveSupabaseAttendance(targetAttendance);
      const okBills = await saveSupabaseBills(targetBills);
      const okPayments = await saveSupabaseFeePayments(targetFeePayments);

      // Instantly persist and broadcast master database state across all devices and browsers
      globalSyncEngine.pushMasterServerSync({
        config: targetConfig,
        students: targetStudents,
        teachers: targetTeachers,
        grades: targetGrades,
        attendance: targetAttendance,
        bills: targetBills,
        feePayments: targetFeePayments
      }).catch(e => console.warn('[GlobalSync push notice]', e));

      setIsSupabaseSyncing(false);
      return okConfig && okStudents && okTeachers && okGrades && okAttendance && okBills && okPayments;
    } catch (e: any) {
      console.error('Failed pushing to Supabase:', e);
      setIsSupabaseSyncing(false);
      return false;
    }
  }, [config, students, teachers, grades, attendance, bills]);

  // 1. INITIALIZE MASTER STATES FROM LOCALSTORAGE OR MOCK DATA
  useEffect(() => {
    const cachedStudents = localStorage.getItem('ea_students');
    const cachedTeachers = localStorage.getItem('ea_teachers');
    const cachedGrades = localStorage.getItem('ea_grades');
    const cachedAttendance = localStorage.getItem('ea_attendance');
    const cachedBills = localStorage.getItem('ea_bills');
    const cachedConfig = localStorage.getItem('ea_config');

    let finalTeachers: User[] = [];
    if (cachedTeachers !== null) {
      try {
        finalTeachers = JSON.parse(cachedTeachers) as User[];
      } catch (e) {
        finalTeachers = INITIAL_USERS;
      }
    } else {
      finalTeachers = INITIAL_USERS;
    }
    if (!Array.isArray(finalTeachers) || finalTeachers.length === 0) {
      finalTeachers = INITIAL_USERS;
    }
    finalTeachers = reconcileTeachersWithClassAssignments(finalTeachers);
    setTeachers(finalTeachers);
    localStorage.setItem('ea_teachers', JSON.stringify(finalTeachers));

    const isCleared = localStorage.getItem('ea_students_cleared') === 'true';
    let finalStudents: Student[] = [];
    if (!isCleared && cachedStudents !== null) {
      try {
        finalStudents = JSON.parse(cachedStudents) as Student[];
      } catch (e) {
        finalStudents = [];
      }
    } else {
      finalStudents = [];
    }

    // Filter out any teacher accounts that may have leaked into students
    const teacherIds = new Set(finalTeachers.map(t => t.id).filter(Boolean));
    let cleanStudents = isCleared ? [] : finalStudents.filter(
      s => !teacherIds.has(s.id)
    );

    // CRITICAL: Filter out any deleted students and demo pupils
    if (!isCleared) {
      cleanStudents = cleanStudents.filter(s => !isStudentDeleted(s) && !isDemoStudent(s));
      cleanStudents = deduplicateStudents(cleanStudents);
    }

    if (cleanStudents.length > 0 && !isCleared) {
      setStudents(cleanStudents);
      localStorage.setItem('ea_students', JSON.stringify(cleanStudents));
      localStorage.setItem('mock_supabase_ea_students', JSON.stringify(cleanStudents));
      lastSavedStudentsSigRef.current = cleanStudents.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
      console.log(`[Supabase Student Sync Diagnostic] Initial mount: Loaded ${cleanStudents.length} students from local storage cache.`);
    } else {
      setStudents([]);
      localStorage.setItem('ea_students', JSON.stringify([]));
      localStorage.setItem('mock_supabase_ea_students', JSON.stringify([]));
      console.log('[Supabase Student Sync Diagnostic] Initial mount: Roster holds 0 students (cleared or empty).');
    }
    localStorage.setItem('ea_has_initialized', 'true');

    let finalGrades: Grade[] = [];
    if (cachedGrades !== null) {
      try {
        finalGrades = JSON.parse(cachedGrades) as Grade[];
      } catch (e) {
        finalGrades = [];
      }
    } else {
      finalGrades = [];
    }

    // Filter grades only for actively enrolled students
    finalGrades = finalGrades.filter(g => {
      const studentExists = cleanStudents.some(s => s.id === g.studentId || s.rollNumber === g.studentId);
      return studentExists && !isStudentDeleted({ id: g.studentId });
    });
    setGrades(finalGrades);
    localStorage.setItem('ea_grades', JSON.stringify(finalGrades));

    let finalAttendance: Attendance[] = [];
    if (cachedAttendance !== null) {
      try {
        finalAttendance = JSON.parse(cachedAttendance) as Attendance[];
      } catch (e) {
        finalAttendance = [];
      }
    } else {
      finalAttendance = [];
    }

    if (finalAttendance.length > 0) {
      finalAttendance = finalAttendance.filter(a => !isStudentDeleted({ id: a.studentId }));
      setAttendance(finalAttendance);
      localStorage.setItem('ea_attendance', JSON.stringify(finalAttendance));
    }

    const cachedDailyAttendance = localStorage.getItem('ea_daily_attendance') || localStorage.getItem('mock_supabase_ea_daily_attendance');
    if (cachedDailyAttendance !== null) {
      try {
        const parsedDaily = JSON.parse(cachedDailyAttendance) as DailyAttendanceRecord[];
        if (Array.isArray(parsedDaily) && parsedDaily.length > 0) {
          setDailyAttendance(parsedDaily.filter(r => !isStudentDeleted({ id: r.studentId })));
        }
      } catch (e) {}
    }

    if (cachedBills !== null) {
      try {
        setBills(JSON.parse(cachedBills) as StudentBill[]);
      } catch (e) {
        setBills([]);
      }
    }

    if (cachedConfig) {
      const parsed = JSON.parse(cachedConfig);
      parsed.gradingScale = DEFAULT_REPORT_CONFIG.gradingScale;
      setConfig(parsed);
      localStorage.setItem('ea_config', JSON.stringify(parsed));
    } else {
      setConfig(DEFAULT_REPORT_CONFIG);
      localStorage.setItem('ea_config', JSON.stringify(DEFAULT_REPORT_CONFIG));
    }

    // Load from Supabase if configured
    const initSupabase = async () => {
      const creds = getSupabaseCredentials();
      if (creds.isConfigured) {
        setSyncStatus('syncing');
        isPullingRemoteRef.current = true;
        try {
          const statusReport = await checkSupabaseStatus();
          if (statusReport.isConnected) {
            // Pull latest records to keep local states synced
            const pullResult = await handlePullFromSupabase();
            if (pullResult) {
              setSyncStatus('synced');
            } else {
              setSyncStatus('error');
              setLastSyncError('Initial pull from cloud failed. Verify tables exist.');
            }
          } else {
            setSyncStatus('error');
            setLastSyncError(statusReport.message || 'Failed to verify cloud credentials.');
          }
        } finally {
          setTimeout(() => {
            isPullingRemoteRef.current = false;
          }, 500);
        }
      } else {
        setSyncStatus('offline');
      }
      setIsInitialized(true);
    };
    initSupabase();
  }, []);

  // 1.2 Real-time Global Multi-Device & Cross-Browser Synchronization Engine
  useEffect(() => {
    // A. Perform background master hydration from server database
    const hydrateMasterDatabase = async () => {
      try {
        const master = await globalSyncEngine.fetchMasterServerSync();
        if (master) {
          if (master.config && Object.keys(master.config).length > 0) {
            setConfig(prev => ({ ...prev, ...master.config }));
            localStorage.setItem('ea_config', JSON.stringify(master.config));
          }
          if (Array.isArray(master.teachers) && master.teachers.length > 0) {
            if (master.classTeacherAssignments && typeof master.classTeacherAssignments === 'object') {
              saveClassTeacherAssignmentsLocally(master.classTeacherAssignments);
            }
            const reconciledTeachers = reconcileTeachersWithClassAssignments(master.teachers, master.classTeacherAssignments);
            setTeachers(reconciledTeachers);
            localStorage.setItem('ea_teachers', JSON.stringify(reconciledTeachers));
          }
          if (Array.isArray((master as any).deletedStudentIds)) {
            (master as any).deletedStudentIds.forEach((id: string) => {
              if (id) recordDeletedStudentId(id);
            });
          }
          if (Array.isArray(master.students)) {
            const creds = getSupabaseCredentials();
            // User requirement: Authoritative enrolled pupils are fetched directly from ea_students table.
            // Do not let background server polling overwrite the 159 pupils from Supabase.
            if (!creds.isConfigured) {
              const filtered = master.students.filter(s => !isStudentDeleted(s) && !isDemoStudent(s));
              setStudents(filtered);
              localStorage.setItem('ea_students', JSON.stringify(filtered));
              localStorage.setItem('mock_supabase_ea_students', JSON.stringify(filtered));
              if (filtered.length > 0) {
                localStorage.removeItem('ea_students_cleared');
              } else {
                localStorage.setItem('ea_students_cleared', 'true');
              }
              lastSavedStudentsSigRef.current = filtered.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
            }
          }
          if (Array.isArray(master.grades) && master.grades.length > 0) {
            setGrades(master.grades);
            localStorage.setItem('ea_grades', JSON.stringify(master.grades));
          }
          if (Array.isArray(master.attendance) && master.attendance.length > 0) {
            setAttendance(prev => {
              const attMap = new Map<string, Attendance>();
              master.attendance!.forEach(a => {
                const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`;
                attMap.set(key, a);
              });
              prev.forEach(a => {
                const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`;
                const existing = attMap.get(key);
                if (!existing) {
                  attMap.set(key, a);
                } else {
                  const localTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                  const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                  if (localTime >= remoteTime) {
                    attMap.set(key, a);
                  }
                }
              });
              const merged = Array.from(attMap.values());
              localStorage.setItem('ea_attendance', JSON.stringify(merged));
              localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(merged));
              return merged;
            });
          }
          if (Array.isArray(master.dailyAttendance) && master.dailyAttendance.length > 0) {
            setDailyAttendance(prev => {
              const dailyMap = new Map<string, DailyAttendanceRecord>();
              master.dailyAttendance!.forEach(r => {
                if (r && r.studentId && r.date) {
                  dailyMap.set(`${r.studentId}_${r.date}`, r);
                }
              });
              prev.forEach(r => {
                if (r && r.studentId && r.date) {
                  const key = `${r.studentId}_${r.date}`;
                  const existing = dailyMap.get(key);
                  if (!existing) {
                    dailyMap.set(key, r);
                  } else {
                    const localTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
                    const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                    if (localTime >= remoteTime) {
                      dailyMap.set(key, r);
                    }
                  }
                }
              });
              const merged = Array.from(dailyMap.values());
              localStorage.setItem('ea_daily_attendance', JSON.stringify(merged));
              localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(merged));
              return merged;
            });
          }
          if (Array.isArray(master.bills) && master.bills.length > 0) {
            setBills(master.bills);
            localStorage.setItem('ea_bills', JSON.stringify(master.bills));
          }
          if (Array.isArray(master.feePayments) && master.feePayments.length > 0) {
            localStorage.setItem('ea_fee_payments', JSON.stringify(master.feePayments));
            window.dispatchEvent(new Event('storage'));
          }
          if (Array.isArray(master.bookStock) && master.bookStock.length > 0) {
            localStorage.setItem('ea_book_stock_items', JSON.stringify(master.bookStock));
            localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(master.bookStock));
            window.dispatchEvent(new Event('ea_book_stock_updated'));
          }
          if (Array.isArray(master.bookSales) && master.bookSales.length > 0) {
            localStorage.setItem('ea_book_sales_records', JSON.stringify(master.bookSales));
            localStorage.setItem('mock_supabase_ea_book_sales', JSON.stringify(master.bookSales));
            window.dispatchEvent(new Event('ea_book_sales_updated'));
          }
        }
      } catch (err) {
        console.warn('[GlobalSync] Master database background sync notice:', err);
      }
    };

    hydrateMasterDatabase();

    const handleOutdated = () => {
      console.log('[App] Server version updated. Synchronizing master state...');
      hydrateMasterDatabase();
    };
    window.addEventListener('ea_global_sync_outdated', handleOutdated);

    // B. Real-time Server-Sent Events (SSE) listener
    const unsubscribe = globalSyncEngine.subscribe((streamEvent) => {
      const { type, entity, payload } = streamEvent;
      console.log(`[GlobalSync SSE] Event received: entity='${entity}', type='${type}'`);

      if ((entity === 'all' || type === 'FULL_SYNC' || type === 'SYNC_ALL') && payload) {
        const p = payload as GlobalDatabaseState;
        if (p.config) {
          setConfig(prev => ({ ...prev, ...p.config }));
          localStorage.setItem('ea_config', JSON.stringify(p.config));
        }
        if (Array.isArray(p.teachers)) {
          if (p.classTeacherAssignments && typeof p.classTeacherAssignments === 'object') {
            saveClassTeacherAssignmentsLocally(p.classTeacherAssignments);
          }
          const reconciled = reconcileTeachersWithClassAssignments(p.teachers, p.classTeacherAssignments);
          setTeachers(reconciled);
          localStorage.setItem('ea_teachers', JSON.stringify(reconciled));
          lastSavedTeachersSigRef.current = reconciled.map(t => `${t.id}:${t.email}:${t.role}:${t.name || ''}:${(t.classes || []).join(',')}:${(t.subjects || []).join(',')}`).join('|');
          window.dispatchEvent(new CustomEvent('ea_teachers_updated', { detail: reconciled }));
        }
        if (Array.isArray(p.students)) {
          const creds = getSupabaseCredentials();
          // Keep ea_students table authoritative when cloud is active
          if (!creds.isConfigured) {
            const filtered = p.students.filter(s => !isStudentDeleted(s) && !isDemoStudent(s));
            setStudents(filtered);
            localStorage.setItem('ea_students', JSON.stringify(filtered));
            localStorage.setItem('mock_supabase_ea_students', JSON.stringify(filtered));
            lastSavedStudentsSigRef.current = filtered.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
            window.dispatchEvent(new CustomEvent('ea_students_updated', { detail: filtered }));
            if (filtered.length === 0) {
              localStorage.setItem('ea_students_cleared', 'true');
            } else {
              localStorage.removeItem('ea_students_cleared');
            }
          }
        }
        if (Array.isArray(p.grades)) {
          setGrades(p.grades);
          localStorage.setItem('ea_grades', JSON.stringify(p.grades));
        }
        if (Array.isArray(p.attendance)) {
          setAttendance(p.attendance);
          localStorage.setItem('ea_attendance', JSON.stringify(p.attendance));
          lastSavedAttendanceSigRef.current = p.attendance.map(a => `${a.studentId}:${a.term || ''}:${a.year || ''}:${a.daysPresent}:${a.totalDays}:${a.remarks || ''}`).join('|');
          window.dispatchEvent(new CustomEvent('ea_attendance_updated', { detail: p.attendance }));
        }
        if (Array.isArray(p.dailyAttendance)) {
          setDailyAttendance(p.dailyAttendance);
          localStorage.setItem('ea_daily_attendance', JSON.stringify(p.dailyAttendance));
          localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(p.dailyAttendance));
          lastSavedDailyAttendanceSigRef.current = p.dailyAttendance.map(r => `${r.id || ''}:${r.studentId}:${r.date}:${r.status}`).join('|');
          window.dispatchEvent(new CustomEvent('ea_daily_attendance_updated', { detail: p.dailyAttendance }));
        }
        if (Array.isArray(p.bills)) {
          setBills(p.bills);
          localStorage.setItem('ea_bills', JSON.stringify(p.bills));
        }
        if (Array.isArray(p.feePayments)) {
          localStorage.setItem('ea_fee_payments', JSON.stringify(p.feePayments));
          window.dispatchEvent(new Event('storage'));
        }
        if (Array.isArray(p.bookStock)) {
          localStorage.setItem('ea_book_stock_items', JSON.stringify(p.bookStock));
          localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(p.bookStock));
          window.dispatchEvent(new Event('ea_book_stock_updated'));
        }
        if (Array.isArray(p.bookSales)) {
          localStorage.setItem('ea_book_sales_records', JSON.stringify(p.bookSales));
          localStorage.setItem('mock_supabase_ea_book_sales', JSON.stringify(p.bookSales));
          window.dispatchEvent(new Event('ea_book_sales_updated'));
        }
      } else if (entity === 'students') {
        if (Array.isArray(payload)) {
          const filtered = payload.filter(s => !isStudentDeleted(s) && !isDemoStudent(s));
          setStudents(filtered);
          localStorage.setItem('ea_students', JSON.stringify(filtered));
          localStorage.setItem('mock_supabase_ea_students', JSON.stringify(filtered));
          lastSavedStudentsSigRef.current = filtered.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
          window.dispatchEvent(new CustomEvent('ea_students_updated', { detail: filtered }));
          if (filtered.length === 0) {
            localStorage.setItem('ea_students_cleared', 'true');
          } else {
            localStorage.removeItem('ea_students_cleared');
          }
        } else if (payload && typeof payload === 'object') {
          const action = payload.action || type;
          if (action === 'DELETE') {
            const delId = payload.id;
            const delRoll = payload.rollNumber;
            const delName = payload.studentName;
            setStudents(prev => {
              const updated = prev.filter(s => {
                if (delId && (s.id === delId || String(s.id).toLowerCase() === String(delId).toLowerCase())) return false;
                if (delRoll && s.rollNumber && s.rollNumber.trim().toLowerCase() === delRoll.trim().toLowerCase()) return false;
                if (delName && s.name && s.name.trim().toLowerCase() === delName.trim().toLowerCase()) return false;
                return true;
              });
              localStorage.setItem('ea_students', JSON.stringify(updated));
              localStorage.setItem('mock_supabase_ea_students', JSON.stringify(updated));
              lastSavedStudentsSigRef.current = updated.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
              window.dispatchEvent(new CustomEvent('ea_students_updated', { detail: updated }));
              return updated;
            });
          } else if ((action === 'ADMIT' || action === 'UPSERT') && payload.student) {
            const newStudent = payload.student;
            if (!isStudentDeleted(newStudent) && !isDemoStudent(newStudent)) {
              setStudents(prev => {
                const existingIdx = prev.findIndex(s => s.id === newStudent.id);
                let updated: Student[];
                if (existingIdx >= 0) {
                  updated = prev.map((s, idx) => idx === existingIdx ? newStudent : s);
                } else {
                  updated = [...prev.filter(s => s.id !== newStudent.id), newStudent];
                }
                localStorage.setItem('ea_students', JSON.stringify(updated));
                localStorage.setItem('mock_supabase_ea_students', JSON.stringify(updated));
                localStorage.removeItem('ea_students_cleared');
                lastSavedStudentsSigRef.current = updated.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
                window.dispatchEvent(new CustomEvent('ea_students_updated', { detail: updated }));
                return updated;
              });
            }
          }
        }
      } else if (entity === 'teachers' && Array.isArray(payload)) {
        setTeachers(payload);
        localStorage.setItem('ea_teachers', JSON.stringify(payload));
        lastSavedTeachersSigRef.current = payload.map(t => `${t.id}:${t.email}:${t.role}:${t.name || ''}:${(t.classes || []).join(',')}:${(t.subjects || []).join(',')}`).join('|');
        window.dispatchEvent(new CustomEvent('ea_teachers_updated', { detail: payload }));
      } else if (entity === 'config' && payload) {
        setConfig(prev => ({ ...prev, ...payload }));
        localStorage.setItem('ea_config', JSON.stringify(payload));
      } else if (entity === 'grades' && Array.isArray(payload)) {
        setGrades(payload);
        localStorage.setItem('ea_grades', JSON.stringify(payload));
      } else if (entity === 'attendance' && Array.isArray(payload)) {
        setAttendance(payload);
        localStorage.setItem('ea_attendance', JSON.stringify(payload));
        lastSavedAttendanceSigRef.current = payload.map(a => `${a.studentId}:${a.term || ''}:${a.year || ''}:${a.daysPresent}:${a.totalDays}:${a.remarks || ''}`).join('|');
        window.dispatchEvent(new CustomEvent('ea_attendance_updated', { detail: payload }));
      } else if ((entity === 'dailyAttendance' || entity === 'daily-attendance') && Array.isArray(payload)) {
        setDailyAttendance(payload);
        localStorage.setItem('ea_daily_attendance', JSON.stringify(payload));
        localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(payload));
        lastSavedDailyAttendanceSigRef.current = payload.map(r => `${r.id || ''}:${r.studentId}:${r.date}:${r.status}`).join('|');
        window.dispatchEvent(new CustomEvent('ea_daily_attendance_updated', { detail: payload }));
      } else if (entity === 'bills' && Array.isArray(payload)) {
        setBills(payload);
        localStorage.setItem('ea_bills', JSON.stringify(payload));
      } else if (entity === 'fee-payments' && Array.isArray(payload)) {
        localStorage.setItem('ea_fee_payments', JSON.stringify(payload));
        window.dispatchEvent(new Event('storage'));
      } else if (entity === 'book_stock' || entity === 'ea_book_stock') {
        if (Array.isArray(payload)) {
          localStorage.setItem('ea_book_stock_items', JSON.stringify(payload));
          localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(payload));
          window.dispatchEvent(new Event('ea_book_stock_updated'));
        } else if (payload && typeof payload === 'object') {
          if (payload.action === 'DELETE' && payload.id) {
            recordDeletedBookStockId(payload.id);
          }
          window.dispatchEvent(new Event('ea_book_stock_updated'));
        }
      } else if (entity === 'book_sales' || entity === 'ea_book_sales') {
        if (Array.isArray(payload)) {
          localStorage.setItem('ea_book_sales_records', JSON.stringify(payload));
          localStorage.setItem('mock_supabase_ea_book_sales', JSON.stringify(payload));
          window.dispatchEvent(new Event('ea_book_sales_updated'));
        } else {
          window.dispatchEvent(new Event('ea_book_sales_updated'));
        }
      }
    });

    return () => {
      window.removeEventListener('ea_global_sync_outdated', handleOutdated);
      unsubscribe();
    };
  }, []);

  // 1.5 Self-healing deduplication to purge any legacy duplicate students from local storage
  useEffect(() => {
    if (!isInitialized || students.length === 0) return;
    const clean = deduplicateStudents(students);
    if (clean.length !== students.length) {
      if (clean.length === 0 && students.length > 0) {
        console.error('[Sync Guard] Deduplication produced 0 students from non-empty state. Aborting push to Supabase.');
        return;
      }
      console.warn(`[Eastfield Academy] Deduplicated ${students.length - clean.length} colliding student records.`);
      console.log(`[Supabase Student Sync Diagnostic] Deduplication auto-sync: Pushing ${clean.length} students to Supabase (held in memory: ${students.length})`);
      setStudents(clean);
      localStorage.setItem('ea_students', JSON.stringify(clean));
      localStorage.setItem('mock_supabase_ea_students', JSON.stringify(clean));
      lastSavedStudentsSigRef.current = clean.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
      const creds = getSupabaseCredentials();
      if (creds.isConfigured) {
        saveSupabaseStudents(clean).catch(err => console.warn('Supabase student deduplication sync error', err));
      }
    }
  }, [students, isInitialized]);

  // 2. SAVE STATE MUTATIONS BACK TO LOCAL STORAGE AND SUPABASE (AUTO-SYNC)
  // Auto-promote students at the reopening date of First Term
  useEffect(() => {
    if (!isInitialized || students.length === 0) return;
    if (config.autoPromoteOnReopening !== false && isAutoPromotionDue(config)) {
      const preSnapshot = JSON.parse(JSON.stringify(students));
      const result = promoteStudents(students, config.schoolYear);
      
      const idMap = new Map<string, string>();
      result.records.forEach(r => {
        if (r.oldStudentId && r.newStudentId && r.oldStudentId !== r.newStudentId) {
          idMap.set(r.oldStudentId, r.newStudentId);
        }
      });

      if (idMap.size > 0) {
        setGrades(prev => {
          const updated = prev.map(g => {
            const newId = idMap.get(g.studentId);
            return newId ? { ...g, studentId: newId } : g;
          });
          localStorage.setItem('ea_grades', JSON.stringify(updated));
          localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(updated));
          return updated;
        });
        setAttendance(prev => {
          const updated = prev.map(a => {
            const newId = idMap.get(a.studentId);
            return newId ? { ...a, studentId: newId } : a;
          });
          localStorage.setItem('ea_attendance', JSON.stringify(updated));
          return updated;
        });
        setBills(prev => {
          const updated = prev.map(b => {
            const newId = idMap.get(b.studentId);
            return newId ? { ...b, studentId: newId } : b;
          });
          localStorage.setItem('ea_bills', JSON.stringify(updated));
          return updated;
        });
      }

      const updatedConfig: ReportConfig = {
        ...config,
        lastPromotedYear: config.schoolYear,
        promotionUndoneYear: undefined,
        lastPromotionDate: new Date().toISOString(),
        prePromotionSnapshot: preSnapshot,
        updatedAt: new Date().toISOString()
      };

      setStudents(result.promotedStudents);
      setConfig(updatedConfig);

      localStorage.setItem('ea_students', JSON.stringify(result.promotedStudents));
      localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
      localStorage.setItem('mock_supabase_ea_students', JSON.stringify(result.promotedStudents));
      localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updatedConfig));
      localStorage.setItem('ea_pre_promotion_students', JSON.stringify(preSnapshot));

      const creds = getSupabaseCredentials();
      if (creds.isConfigured) {
        console.log(`[Supabase Student Sync Diagnostic] Auto-Promotion Sync: Pushing ${result.promotedStudents.length} students to Supabase (in-memory state was: ${students.length})`);
        saveSupabaseStudents(result.promotedStudents).catch(err => console.warn('Supabase student sync error', err));
        saveSupabaseConfig(updatedConfig).catch(err => console.warn('Supabase config sync error', err));
      }
    }
  }, [isInitialized, config, students.length]);

  // Ensure we never have teachers registered under students (e.g. from database triggers on signUp)
  useEffect(() => {
    if (!isInitialized) return;
    const teacherIds = new Set(teachers.map(t => t.id).filter(Boolean));
    const hasOverlap = students.some(s => s.id && teacherIds.has(s.id));
    if (hasOverlap) {
      setStudents(prev => prev.filter(s => !teacherIds.has(s.id)));
    }
  }, [teachers, students, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    // Check local storage cache count for defensive validation
    let cachedCount = 0;
    const cachedStr = localStorage.getItem('ea_students');
    try {
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        if (Array.isArray(parsed)) cachedCount = parsed.length;
      }
    } catch (e) {}

    // Defensive check 1: Prevent wiping local cache or cloud with empty students state
    if (students.length === 0) {
      if (localStorage.getItem('ea_students_cleared') === 'true') {
        localStorage.setItem('ea_students', JSON.stringify([]));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify([]));
        return;
      }
      if (cachedCount > 0) {
        console.warn(`[Sync Guard] In-memory students state is 0, but local storage cache holds ${cachedCount} students. Blocking destructive overwrite and rehydrating state.`);
        try {
          const cached = JSON.parse(cachedStr!);
          setStudents(cached);
        } catch (e) {}
        return;
      }
      console.warn('[Sync Guard] Both in-memory state and local cache have 0 students. Skipping push to Supabase to prevent wiping cloud database.');
      return;
    }

    // Safely persist to local cache once verified non-empty
    localStorage.setItem('ea_students', JSON.stringify(students));

    // Defensive check 2: Never push while pulling remote updates
    if (isPullingRemoteRef.current) {
      console.log(`[Supabase Student Sync Diagnostic] Remote pull in progress. Skipping auto-save (in-memory: ${students.length}, cache: ${cachedCount}).`);
      return;
    }

    const sig = students.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
    if (lastSavedStudentsSigRef.current === sig) return;
    lastSavedStudentsSigRef.current = sig;

    // Always synchronize across master server and connected tabs
    pushMasterServerSync({ students }).catch(() => {});
    broadcastSync('students', students);

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      console.log(`[Supabase Student Sync Diagnostic] Auto-sync: Pushing ${students.length} students to Supabase (in-memory: ${students.length}, local cache was: ${cachedCount})`);
      setSyncStatus('syncing');
      saveSupabaseStudents(students).then(ok => {
        if (ok) {
          setSyncStatus('synced');
          setLastSyncTime(new Date());
        } else {
          setSyncStatus('error');
          setLastSyncError('Failed to sync student updates to Cloud.');
        }
      }).catch(err => {
        setSyncStatus('error');
        setLastSyncError(err.message || 'Student sync error.');
      });
    } else {
      setSyncStatus('offline');
    }
  }, [students, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('ea_teachers', JSON.stringify(teachers));

    const sig = teachers.map(t => `${t.id}:${t.email}:${t.role}:${t.name || ''}:${(t.classes || []).join(',')}:${(t.subjects || []).join(',')}`).join('|');
    if (lastSavedTeachersSigRef.current === sig) return;

    // If pulling remote, wait slightly for pull to settle then commit user change
    if (isPullingRemoteRef.current) {
      const retryTimer = setTimeout(() => {
        if (lastSavedTeachersSigRef.current !== sig) {
          lastSavedTeachersSigRef.current = sig;
          const assignments = getClassTeacherAssignments(teachers);
          pushMasterServerSync({ teachers, classTeacherAssignments: assignments }).catch(() => {});
          syncTeachersToCDN(teachers).catch(() => {});
          broadcastSync('teachers', teachers);
          const creds = getSupabaseCredentials();
          if (creds.isConfigured) {
            saveSupabaseTeachers(teachers).catch(() => {});
          }
        }
      }, 600);
      return () => clearTimeout(retryTimer);
    }

    lastSavedTeachersSigRef.current = sig;

    const assignments = getClassTeacherAssignments(teachers);
    // Always push to master server and edge CDN
    pushMasterServerSync({ teachers, classTeacherAssignments: assignments }).catch(() => {});
    syncTeachersToCDN(teachers).catch(() => {});
    broadcastSync('teachers', teachers);

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseTeachers(teachers).then(ok => {
        if (ok) {
          setSyncStatus('synced');
          setLastSyncTime(new Date());
        } else {
          setSyncStatus('error');
          setLastSyncError('Failed to sync staff updates to Cloud.');
        }
      }).catch(err => {
        setSyncStatus('error');
        setLastSyncError(err.message || 'Staff sync error.');
      });
    } else {
      setSyncStatus('offline');
    }
  }, [teachers, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('ea_grades', JSON.stringify(grades));
    if (isPullingRemoteRef.current) return;
    const sig = grades.map(g => `${g.id}:${g.studentId}:${g.subjectId}:${g.totalScore}`).join('|');
    if (lastSavedGradesSigRef.current === sig) return;
    lastSavedGradesSigRef.current = sig;

    pushMasterServerSync({ grades }).catch(() => {});
    broadcastSync('grades', grades);

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseGrades(grades).then(ok => {
        if (ok) {
          setSyncStatus('synced');
          setLastSyncTime(new Date());
        } else {
          setSyncStatus('error');
          setLastSyncError('Failed to sync grade records to Cloud.');
        }
      }).catch(err => {
        setSyncStatus('error');
        setLastSyncError(err.message || 'Grade record sync error.');
      });
    } else {
      setSyncStatus('offline');
    }
  }, [grades, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('ea_attendance', JSON.stringify(attendance));
    if (isPullingRemoteRef.current) return;
    const sig = attendance.map(a => `${a.studentId}:${a.term || ''}:${a.year || ''}:${a.daysPresent}:${a.totalDays}:${a.remarks || ''}`).join('|');
    if (lastSavedAttendanceSigRef.current === sig) return;
    lastSavedAttendanceSigRef.current = sig;

    // Always push attendance to master server and edge CDN
    pushMasterServerSync({ attendance }).catch(() => {});
    syncAttendanceToCDN(attendance).catch(() => {});
    broadcastSync('attendance', attendance);

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseAttendance(attendance).then(ok => {
        if (ok) {
          setSyncStatus('synced');
          setLastSyncTime(new Date());
        } else {
          setSyncStatus('error');
          setLastSyncError('Failed to sync attendance updates to Cloud.');
        }
      }).catch(err => {
        setSyncStatus('error');
        setLastSyncError(err.message || 'Attendance sync error.');
      });
    } else {
      setSyncStatus('offline');
    }
  }, [attendance, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('ea_daily_attendance', JSON.stringify(dailyAttendance));
    if (isPullingRemoteRef.current) return;
    const sig = dailyAttendance.map(r => `${r.id || ''}:${r.studentId}:${r.date}:${r.status}`).join('|');
    if (lastSavedDailyAttendanceSigRef.current === sig) return;
    lastSavedDailyAttendanceSigRef.current = sig;

    // Always push daily attendance to master server and broadcast
    pushMasterServerSync({ dailyAttendance }).catch(() => {});
    broadcastSync('daily_attendance', dailyAttendance);

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      saveSupabaseDailyAttendance(dailyAttendance).catch(() => {});
    }
  }, [dailyAttendance, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('ea_config', JSON.stringify(config));
    if (isPullingRemoteRef.current) return;
    const sig = `${config.term}:${config.schoolYear}:${config.reopeningDate}:${config.vacationDate}:${config.lastPromotedYear}`;
    if (lastSavedConfigSigRef.current === sig) return;
    lastSavedConfigSigRef.current = sig;

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseConfig(config).then(ok => {
        if (ok) {
          setSyncStatus('synced');
          setLastSyncTime(new Date());
          broadcastSync('config', config);
        } else {
          setSyncStatus('error');
          setLastSyncError('Failed to sync configuration to Cloud.');
        }
      }).catch(err => {
        setSyncStatus('error');
        setLastSyncError(err.message || 'Config sync error.');
      });
    } else {
      setSyncStatus('offline');
    }
  }, [config, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('ea_bills', JSON.stringify(bills));
    if (isPullingRemoteRef.current) return;
    const sig = bills.map(b => `${b.id}:${b.studentId}:${b.totalPayable}`).join('|');
    if (lastSavedBillsSigRef.current === sig) return;
    lastSavedBillsSigRef.current = sig;

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      saveSupabaseBills(bills).then(ok => {
        if (ok) {
          broadcastSync('bills', bills);
        }
      }).catch(err => {
        console.warn('Bills auto-sync warning:', err);
      });
    }
  }, [bills, isInitialized]);

  // Listen for local or multi-tab student deletion/update events
  useEffect(() => {
    const handleStudentsUpdated = (e?: Event) => {
      if (e && (e as CustomEvent).detail?.source === 'internal_save') return;
      if (e instanceof StorageEvent && e.key && e.key !== 'ea_students') return;
      try {
        const raw = localStorage.getItem('ea_students');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((s: Student) => !isStudentDeleted(s));
            setStudents(prev => {
              if (prev.length === filtered.length) {
                const prevSig = prev.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
                const nextSig = filtered.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
                if (prevSig === nextSig) return prev;
              }
              lastSavedStudentsSigRef.current = filtered.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
              return filtered;
            });
          }
        }
      } catch (e) {}
    };

    window.addEventListener('ea_students_updated', handleStudentsUpdated);
    window.addEventListener('storage', handleStudentsUpdated);
    return () => {
      window.removeEventListener('ea_students_updated', handleStudentsUpdated);
      window.removeEventListener('storage', handleStudentsUpdated);
    };
  }, []);

  // Listen for real-time class teacher assignment updates across tabs or components
  useEffect(() => {
    const handleClassAssignmentsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const assignments = customEvent.detail;
      if (assignments && typeof assignments === 'object') {
        setConfig(prev => {
          const updated = {
            ...prev,
            classTeacherAssignments: assignments,
            updatedAt: new Date().toISOString()
          };
          try {
            localStorage.setItem('ea_config', JSON.stringify(updated));
            localStorage.setItem('ea_class_teacher_assignments', JSON.stringify(assignments));
          } catch {}
          return updated;
        });
        setTeachers(prev => reconcileTeachersWithClassAssignments(prev, assignments));
      }
    };
    window.addEventListener('ea_class_assignments_updated', handleClassAssignmentsUpdated);
    return () => {
      window.removeEventListener('ea_class_assignments_updated', handleClassAssignmentsUpdated);
    };
  }, []);

  // Global Realtime WebSockets & Background multi-tab / device synchronization
  useEffect(() => {
    if (!isInitialized) return;
    const creds = getSupabaseCredentials();
    if (!creds.isConfigured) {
      setRealtimeStatus('connected');
    }

    let pullDebounceTimer: any = null;

    const pullRemoteUpdates = async () => {
      try {
        isPullingRemoteRef.current = true;
        const [
          remoteConfig,
          remoteBills,
          remoteGrades,
          remoteAttendance,
          remoteDailyAttendance,
          _mock,
          _inv,
          remoteStudents,
          remoteTeachers,
          remoteFeePayments,
          remoteBookStock
        ] = await Promise.all([
          fetchSupabaseConfig(),
          fetchSupabaseBills(),
          fetchSupabaseGrades(),
          fetchSupabaseAttendance(),
          fetchSupabaseDailyAttendance(),
          fetchSupabaseJHSMockExams(),
          fetchSupabaseInventory(),
          fetchSupabaseStudents(),
          fetchSupabaseTeachers(),
          fetchSupabaseFeePayments(),
          fetchSupabaseBookStock()
        ]);

        if (remoteStudents && Array.isArray(remoteStudents)) {
          setStudents(prev => {
            const cleanRemote = deduplicateStudents(remoteStudents.filter(s => !isStudentDeleted(s) && !isDemoStudent(s)));
            const cleanPrev = prev.filter(s => !isStudentDeleted(s) && !isDemoStudent(s));

            const isRosterCleared = typeof window !== 'undefined' && localStorage.getItem('ea_students_cleared') === 'true';
            if (cleanRemote.length === 0 && cleanPrev.length > 0 && !isRosterCleared) {
              return prev;
            }

            // Create map with remote students
            const studentMap = new Map<string, Student>();
            cleanRemote.forEach(s => {
              if (s && s.id) studentMap.set(s.id, s);
            });

            // Preserve local non-deleted students so newly admitted pupils are never automatically deleted
            if (!isRosterCleared) {
              cleanPrev.forEach(s => {
                if (s && s.id && !isStudentDeleted(s) && !isDemoStudent(s)) {
                  const existingRemote = studentMap.get(s.id);
                  if (!existingRemote) {
                    studentMap.set(s.id, s);
                  } else {
                    const localTime = s.updatedAt || s.updated_at ? new Date(s.updatedAt || s.updated_at || '').getTime() : 0;
                    const remoteTime = existingRemote.updatedAt || existingRemote.updated_at ? new Date(existingRemote.updatedAt || existingRemote.updated_at || '').getTime() : 0;
                    if (localTime > remoteTime) {
                      studentMap.set(s.id, { ...existingRemote, ...s });
                    }
                  }
                }
              });
            }

            const merged = deduplicateStudents(Array.from(studentMap.values()).filter(s => !isStudentDeleted(s)));
            const prevSig = cleanPrev.map(s => `${s.id}_${s.className}_${s.name}_${s.rollNumber}`).sort().join(';');
            const mergedSig = merged.map(s => `${s.id}_${s.className}_${s.name}_${s.rollNumber}`).sort().join(';');

            if (prevSig !== mergedSig) {
              if (merged.length > 0) {
                try {
                  localStorage.removeItem('ea_students_cleared');
                } catch (e) {}
              } else {
                try {
                  localStorage.setItem('ea_students_cleared', 'true');
                } catch (e) {}
              }
              localStorage.setItem('ea_students', JSON.stringify(merged));
              localStorage.setItem('mock_supabase_ea_students', JSON.stringify(merged));
              lastSavedStudentsSigRef.current = merged.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
              return merged;
            }
            return prev;
          });
        }

        if (remoteTeachers && Array.isArray(remoteTeachers) && remoteTeachers.length > 0) {
          const assignments = getClassTeacherAssignments(remoteTeachers);
          const reconciled = reconcileTeachersWithClassAssignments(remoteTeachers, assignments);
          setTeachers(prev => {
            const prevSig = prev.map(t => `${t.id}:${(t.classes || []).join(',')}`).join('|');
            const remoteSig = reconciled.map(t => `${t.id}:${(t.classes || []).join(',')}`).join('|');
            if (prevSig !== remoteSig) {
              localStorage.setItem('ea_teachers', JSON.stringify(reconciled));
              localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(reconciled));
              return reconciled;
            }
            return prev;
          });
        }

        if (remoteConfig) {
          setConfig(prev => {
            const localTime = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
            const remoteTime = remoteConfig.updatedAt ? new Date(remoteConfig.updatedAt).getTime() : 0;

            const effectiveAssignments = {
              ...(prev.classTeacherAssignments || {}),
              ...(remoteConfig.classTeacherAssignments || {})
            };

            // If local config has a newer timestamp than remote, retain local
            if (remoteTime && localTime && remoteTime < localTime) {
              return prev;
            }

            const assignmentsChanged = JSON.stringify(prev.classTeacherAssignments || {}) !== JSON.stringify(effectiveAssignments);

            if (
              assignmentsChanged ||
              remoteConfig.reopeningDate !== prev.reopeningDate ||
              remoteConfig.term !== prev.term ||
              remoteConfig.schoolYear !== prev.schoolYear ||
              remoteConfig.schoolName !== prev.schoolName ||
              remoteConfig.principalName !== prev.principalName ||
              remoteConfig.selectedTemplate !== prev.selectedTemplate ||
              remoteConfig.schoolLogoUrl !== prev.schoolLogoUrl ||
              remoteConfig.principalSignatureUrl !== prev.principalSignatureUrl
            ) {
              const updated = { ...prev, ...remoteConfig, classTeacherAssignments: effectiveAssignments };
              localStorage.setItem('ea_config', JSON.stringify(updated));
              if (assignmentsChanged) {
                localStorage.setItem('ea_class_teacher_assignments', JSON.stringify(effectiveAssignments));
              }
              return updated;
            }
            return prev;
          });
        }

        if (remoteBills && Array.isArray(remoteBills) && remoteBills.length > 0) {
          setBills(prev => {
            const hasChanged = JSON.stringify(prev) !== JSON.stringify(remoteBills);
            if (hasChanged) {
              localStorage.setItem('ea_bills', JSON.stringify(remoteBills));
              return remoteBills;
            }
            return prev;
          });
        }

        if (remoteFeePayments && Array.isArray(remoteFeePayments) && remoteFeePayments.length > 0) {
          const cached = localStorage.getItem('ea_fee_payments');
          if (cached !== JSON.stringify(remoteFeePayments)) {
            localStorage.setItem('ea_fee_payments', JSON.stringify(remoteFeePayments));
            window.dispatchEvent(new Event('ea_fee_payments_updated'));
          }
        }

        if (remoteBookStock && Array.isArray(remoteBookStock)) {
          const cached = localStorage.getItem('ea_book_stock_items');
          if (cached !== JSON.stringify(remoteBookStock)) {
            localStorage.setItem('ea_book_stock_items', JSON.stringify(remoteBookStock));
            localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(remoteBookStock));
            window.dispatchEvent(new Event('ea_book_stock_updated'));
          }
        }

        if (remoteGrades && Array.isArray(remoteGrades) && remoteGrades.length > 0) {
          setGrades(prev => {
            const studentLevelMap = new Map<string, string>();
            students.forEach(s => studentLevelMap.set(s.id, s.level));

            const gradeMap = new Map<string, Grade>();
            remoteGrades.forEach(g => {
              const stLevel = studentLevelMap.get(g.studentId);
              const cSubId = getCanonicalSubjectId(g.subjectId, stLevel);
              const normalizedG = { ...g, subjectId: cSubId };
              const key = `${g.studentId}_${cSubId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
              gradeMap.set(key, normalizedG);
            });

            prev.forEach(g => {
              const stLevel = studentLevelMap.get(g.studentId);
              const cSubId = getCanonicalSubjectId(g.subjectId, stLevel);
              const normalizedG = { ...g, subjectId: cSubId };
              const key = `${g.studentId}_${cSubId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
              const existing = gradeMap.get(key);
              if (!existing) {
                gradeMap.set(key, normalizedG);
              } else {
                const localTime = g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
                const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
                if (localTime > remoteTime) {
                  gradeMap.set(key, normalizedG);
                } else if (g.nurseryRemark && !existing.nurseryRemark) {
                  gradeMap.set(key, { ...existing, nurseryRemark: g.nurseryRemark });
                }
              }
            });

            const merged = Array.from(gradeMap.values()).filter(g => !isStudentDeleted({ id: g.studentId }));
            if (JSON.stringify(prev) !== JSON.stringify(merged)) {
              localStorage.setItem('ea_grades', JSON.stringify(merged));
              localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(merged));
              return merged;
            }
            return prev;
          });
        }

        if (remoteDailyAttendance && Array.isArray(remoteDailyAttendance) && remoteDailyAttendance.length > 0) {
          setDailyAttendance(prev => {
            const dailyMap = new Map<string, DailyAttendanceRecord>();
            remoteDailyAttendance.forEach(r => {
              if (r && r.studentId && r.date) {
                dailyMap.set(`${r.studentId}_${r.date}`, r);
              }
            });
            prev.forEach(r => {
              if (r && r.studentId && r.date) {
                const key = `${r.studentId}_${r.date}`;
                if (!dailyMap.has(key)) {
                  dailyMap.set(key, r);
                } else {
                  const localTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
                  const remoteTime = dailyMap.get(key)?.updatedAt ? new Date(dailyMap.get(key)!.updatedAt).getTime() : 0;
                  if (localTime > remoteTime) {
                    dailyMap.set(key, r);
                  }
                }
              }
            });
            const mergedDaily = Array.from(dailyMap.values()).filter(r => !isStudentDeleted({ id: r.studentId }));
            if (JSON.stringify(prev) !== JSON.stringify(mergedDaily)) {
              localStorage.setItem('ea_daily_attendance', JSON.stringify(mergedDaily));
              localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(mergedDaily));
              window.dispatchEvent(new CustomEvent('ea_daily_attendance_updated', { detail: mergedDaily }));
              return mergedDaily;
            }
            return prev;
          });
        }

        if (remoteAttendance && Array.isArray(remoteAttendance) && remoteAttendance.length > 0) {
          setAttendance(prev => {
            const defaultYear = config.schoolYear || '2026/2027';
            const attMap = new Map<string, Attendance>();
            remoteAttendance.forEach(a => {
              const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || defaultYear}`;
              attMap.set(key, a);
            });
            prev.forEach(a => {
              const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || defaultYear}`;
              if (!attMap.has(key)) {
                attMap.set(key, a);
              } else {
                const localTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                const remoteTime = attMap.get(key)?.updatedAt ? new Date(attMap.get(key)!.updatedAt).getTime() : 0;
                if (localTime > remoteTime) {
                  attMap.set(key, a);
                }
              }
            });
            const mergedAtt = Array.from(attMap.values()).filter(a => !isStudentDeleted({ id: a.studentId }));
            if (JSON.stringify(prev) !== JSON.stringify(mergedAtt)) {
              localStorage.setItem('ea_attendance', JSON.stringify(mergedAtt));
              localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(mergedAtt));
              window.dispatchEvent(new CustomEvent('ea_attendance_updated', { detail: mergedAtt }));
              return mergedAtt;
            }
            return prev;
          });
        }

        setLastSyncTime(new Date());
        setSyncStatus('synced');
      } catch (err) {
        // silent catch during background sync
      } finally {
        setTimeout(() => {
          isPullingRemoteRef.current = false;
        }, 400);
      }
    };

    // Debounced pull function to coalesce rapid realtime updates
    const triggerDebouncedPull = () => {
      if (pullDebounceTimer) clearTimeout(pullDebounceTimer);
      pullDebounceTimer = setTimeout(() => {
        pullRemoteUpdates();
      }, 200);
    };

    // 1. Establish live Supabase Realtime WebSocket subscription & cross-tab bus
    const unsubscribeRealtime = subscribeToGlobalRealtime({
      onStatusChange: (status) => {
        setRealtimeStatus(status);
      },
      onStudentsChange: triggerDebouncedPull,
      onTeachersChange: triggerDebouncedPull,
      onGradesChange: triggerDebouncedPull,
      onAttendanceChange: triggerDebouncedPull,
      onDailyAttendanceChange: triggerDebouncedPull,
      onConfigChange: triggerDebouncedPull,
      onBillsChange: triggerDebouncedPull,
      onFeePaymentsChange: triggerDebouncedPull,
      onDeletedRecordsChange: () => {
        triggerDebouncedPull();
        fetchSupabaseBookStock().then((books) => {
          localStorage.setItem('ea_book_stock_items', JSON.stringify(books));
          localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(books));
          window.dispatchEvent(new Event('ea_book_stock_updated'));
        }).catch(() => {});
      },
      onInventoryChange: () => {
        window.dispatchEvent(new Event('ea_inventory_updated'));
      },
      onBookStockChange: () => {
        fetchSupabaseBookStock().then((books) => {
          localStorage.setItem('ea_book_stock_items', JSON.stringify(books));
          localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(books));
          window.dispatchEvent(new Event('ea_book_stock_updated'));
        }).catch(() => {
          window.dispatchEvent(new Event('ea_book_stock_updated'));
        });
      },
      onBookSalesChange: () => {
        window.dispatchEvent(new Event('ea_book_sales_updated'));
      }
    });

    // 2. Automatic continuous background sync heartbeat (every 3 seconds)
    // Ensures instant real-time data sync across devices, teachers' browsers, and admin
    const autoSyncInterval = setInterval(pullRemoteUpdates, 3000);

    // 3. Automatic synchronization triggers on window focus, online reconnect, storage change, and visibility change
    const handleAutoSyncTrigger = () => {
      triggerDebouncedPull();
    };
    window.addEventListener('focus', handleAutoSyncTrigger);
    window.addEventListener('online', handleAutoSyncTrigger);
    window.addEventListener('storage', handleAutoSyncTrigger);
    window.addEventListener('ea_students_updated', handleAutoSyncTrigger);
    document.addEventListener('visibilitychange', handleAutoSyncTrigger);

    // Initial fetch on mount to sync any remote changes that occurred while offline
    pullRemoteUpdates();

    return () => {
      if (pullDebounceTimer) clearTimeout(pullDebounceTimer);
      clearInterval(autoSyncInterval);
      window.removeEventListener('focus', handleAutoSyncTrigger);
      window.removeEventListener('online', handleAutoSyncTrigger);
      window.removeEventListener('storage', handleAutoSyncTrigger);
      window.removeEventListener('ea_students_updated', handleAutoSyncTrigger);
      document.removeEventListener('visibilitychange', handleAutoSyncTrigger);
      unsubscribeRealtime();
    };
  }, [isInitialized]);

  // Manual trigger for force bidirectional sync
  const handleForceSync = async () => {
    setSyncStatus('syncing');
    try {
      const [
        remoteConfig,
        remoteBills,
        remoteGrades,
        remoteAttendance,
        _mock,
        _inv,
        remoteStudents,
        remoteTeachers,
        remoteBookStock
      ] = await Promise.all([
        fetchSupabaseConfig(),
        fetchSupabaseBills(),
        fetchSupabaseGrades(),
        fetchSupabaseAttendance(),
        fetchSupabaseJHSMockExams(),
        fetchSupabaseInventory(),
        fetchSupabaseStudents(),
        fetchSupabaseTeachers(),
        fetchSupabaseBookStock()
      ]);

      if (remoteBookStock && Array.isArray(remoteBookStock)) {
        localStorage.setItem('ea_book_stock_items', JSON.stringify(remoteBookStock));
        localStorage.setItem('mock_supabase_ea_book_stock', JSON.stringify(remoteBookStock));
        window.dispatchEvent(new Event('ea_book_stock_updated'));
      }

      if (remoteStudents && Array.isArray(remoteStudents)) {
        const clean = deduplicateStudents(remoteStudents.filter(s => !isStudentDeleted(s) && !isDemoStudent(s)));
        lastSavedStudentsSigRef.current = clean.map(s => `${s.id}:${s.className}:${s.name}:${s.rollNumber}`).join('|');
        setStudents(clean);
        if (clean.length > 0) {
          localStorage.removeItem('ea_students_cleared');
        } else {
          localStorage.setItem('ea_students_cleared', 'true');
        }
        localStorage.setItem('ea_students', JSON.stringify(clean));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(clean));
      }
      if (remoteTeachers && Array.isArray(remoteTeachers)) {
        const reconciled = reconcileTeachersWithClassAssignments(remoteTeachers);
        setTeachers(reconciled);
        localStorage.setItem('ea_teachers', JSON.stringify(reconciled));
      }
      if (remoteConfig) {
        setConfig(prev => ({ ...prev, ...remoteConfig }));
      }
      if (remoteBills) {
        setBills(remoteBills);
      }
      if (remoteGrades) {
        setGrades(remoteGrades);
      }
      if (remoteAttendance) {
        setAttendance(remoteAttendance);
      }

      setLastSyncTime(new Date());
      setSyncStatus('synced');
      broadcastSync('all');
    } catch (e: any) {
      setSyncStatus('error');
      setLastSyncError(e?.message || 'Sync failed');
    }
  };


  // 3. SECURE ADMIN PASSWORD CHECK
  const handleAdminGateLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    if (adminEmail.toLowerCase() === 'admin@eastfield.com' && adminPassword === storedAdminPassword) {
      setIsAdminAuthenticated(true);
    } else {
      setAdminError('Access Denied: Invalid administrative credentials.');
    }
  };

  // Helper reset app to original state
  const handleResetApplicationState = () => {
    if (confirm('Warning: This will clear all custom inputs and reset the registry back to default Academy records. Proceed?')) {
      localStorage.clear();
      setStudents(INITIAL_STUDENTS);
      setTeachers(INITIAL_USERS);
      setGrades(INITIAL_GRADES);
      setAttendance(INITIAL_ATTENDANCE);
      setConfig(DEFAULT_REPORT_CONFIG);
      setIsAdminAuthenticated(false);
      setActivePortal('hub');
      alert('Application records reset successfully!');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6FC] text-[#1A043B] font-sans pb-12 print:pb-0">
      {/* GLOBAL HIGH-CONTRAST HEADER NAVBAR - HIDE IN PRINT */}
      <header className="bg-[#1C053E] border-b border-white/15 text-white sticky top-0 z-40 shadow-sm no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Academy Name */}
          <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer shrink-0" onClick={() => { setActivePortal('hub'); setIsMobileMenuOpen(false); }}>
            {config.schoolLogoUrl ? (
              <img 
                src={config.schoolLogoUrl} 
                alt={`${config.schoolName} logo`} 
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-lg shadow-sm shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-mauve-900 text-white font-display font-bold text-base sm:text-lg flex items-center justify-center shadow-sm shrink-0">
                {config.schoolLogoText || 'EA'}
              </div>
            )}
            <div className="truncate max-w-[170px] sm:max-w-none">
              <div className="flex items-center gap-2">
                <span className="font-display font-extrabold text-xs sm:text-sm tracking-tight text-white block uppercase truncate">
                  {config.schoolName}
                </span>
              </div>
              <span className="text-[8px] sm:text-[9px] font-mono tracking-wider text-purple-200 uppercase block truncate">
                School Management System
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setActivePortal('hub')}
              className={`px-4 py-2 rounded-lg text-sm sm:text-base font-extrabold uppercase tracking-wider transition cursor-pointer ${
                activePortal === 'hub'
                  ? 'bg-violet-800 text-white border-2 border-violet-300 shadow-md'
                  : 'bg-[#2A085A] text-violet-100 hover:bg-violet-900 border border-violet-500/40'
              }`}
            >
              Academy Hub
            </button>
            <button
              onClick={() => setActivePortal('teacher')}
              className={`px-4 py-2 rounded-lg text-sm sm:text-base font-extrabold uppercase tracking-wider transition cursor-pointer ${
                activePortal === 'teacher'
                  ? 'bg-violet-800 text-white border-2 border-violet-300 shadow-md'
                  : 'bg-[#2A085A] text-violet-100 hover:bg-violet-900 border border-violet-500/40'
              }`}
              id="nav-teacher-portal"
            >
              Teacher Portal
            </button>
            <button
              onClick={() => setActivePortal('attendance')}
              className={`px-4 py-2 rounded-lg text-sm sm:text-base font-extrabold uppercase tracking-wider transition cursor-pointer ${
                activePortal === 'attendance'
                  ? 'bg-violet-800 text-white border-2 border-violet-300 shadow-md'
                  : 'bg-[#2A085A] text-violet-100 hover:bg-violet-900 border border-violet-500/40'
              }`}
              id="nav-attendance-portal"
            >
              Attendance Portal
            </button>
            <button
              onClick={() => setActivePortal('admin')}
              className={`px-4 py-2 rounded-lg text-sm sm:text-base font-extrabold uppercase tracking-wider transition cursor-pointer ${
                activePortal === 'admin'
                  ? 'bg-violet-800 text-white border-2 border-violet-300 shadow-md'
                  : 'bg-[#2A085A] text-violet-100 hover:bg-violet-900 border border-violet-500/40'
              }`}
              id="nav-admin-portal"
            >
              Admin Portal
            </button>

            {/* Supabase Cloud Health & Audit Badge */}
            <button
              type="button"
              onClick={() => {
                checkSupabaseStatus().catch(() => {});
                setShowSyncErrorModal(true);
              }}
              title="Click to view detailed Supabase tables sync health & SQL repairs"
              className={`ml-2 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition cursor-pointer border ${
                !supabaseStatus.isConfigured
                  ? 'bg-[#2A085A] text-violet-200 border-violet-500/40 hover:bg-violet-900'
                  : supabaseStatus.failingCount > 0
                  ? 'bg-rose-950 text-rose-200 border-rose-500 hover:bg-rose-900'
                  : supabaseStatus.isConnected
                  ? 'bg-emerald-950 text-emerald-200 border-emerald-500 hover:bg-emerald-900'
                  : 'bg-amber-950 text-amber-200 border-amber-500 hover:bg-amber-900'
              }`}
            >
              <Database className="w-3.5 h-3.5 shrink-0 text-amber-300" />
              <span className="hidden xl:inline font-mono">
                {!supabaseStatus.isConfigured
                  ? 'Cloud: Offline'
                  : isAuditingSupabase
                  ? 'Auditing Tables...'
                  : supabaseStatus.failingCount > 0
                  ? `Cloud Alert (${supabaseStatus.failingCount} Table${supabaseStatus.failingCount > 1 ? 's' : ''})`
                  : `Cloud Synced (${supabaseStatus.healthyCount}/18 Tables)`}
              </span>
              <span className="xl:hidden font-mono">
                {supabaseStatus.isConnected ? (supabaseStatus.failingCount > 0 ? `${supabaseStatus.failingCount} Err` : 'Cloud') : 'Cloud'}
              </span>
              {isAuditingSupabase && <RefreshCw className="w-3 h-3 animate-spin" />}
            </button>
          </nav>

          {/* Mobile Menu & Quick Diagnostic Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => {
                checkSupabaseStatus().catch(() => {});
                setShowSyncErrorModal(true);
              }}
              className={`p-2 rounded-lg text-white transition border shadow-sm ${
                supabaseStatus.failingCount > 0
                  ? 'bg-rose-900 border-rose-400/50'
                  : supabaseStatus.isConnected
                  ? 'bg-emerald-900 border-emerald-400/50'
                  : 'bg-violet-900 border-violet-400/40'
              }`}
              title="Open Cloud Diagnostic"
            >
              <Database className="w-4 h-4 text-amber-300" />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-violet-900 text-white hover:bg-violet-800 transition border border-violet-400/40 shadow-sm"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ALWAYS-VISIBLE MOBILE GRID QUICK NAV BAR */}
        <div className="md:hidden bg-[#150330] border-t border-violet-800/60 p-2 grid grid-cols-4 gap-1 shadow-inner">
          <button
            onClick={() => setActivePortal('hub')}
            className={`w-full justify-center px-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center text-center ${
              activePortal === 'hub'
                ? 'bg-violet-700 text-white border-2 border-violet-200 shadow-md'
                : 'bg-[#2B085C] text-violet-100 hover:bg-violet-800 border border-violet-500/40'
            }`}
          >
            Hub
          </button>
          <button
            onClick={() => setActivePortal('teacher')}
            className={`w-full justify-center px-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center text-center ${
              activePortal === 'teacher'
                ? 'bg-violet-700 text-white border-2 border-violet-200 shadow-md'
                : 'bg-[#2B085C] text-violet-100 hover:bg-violet-800 border border-violet-500/40'
            }`}
          >
            Teacher
          </button>
          <button
            onClick={() => setActivePortal('attendance')}
            className={`w-full justify-center px-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center text-center ${
              activePortal === 'attendance'
                ? 'bg-violet-700 text-white border-2 border-violet-200 shadow-md'
                : 'bg-[#2B085C] text-violet-100 hover:bg-violet-800 border border-violet-500/40'
            }`}
          >
            Attendance
          </button>
          <button
            onClick={() => setActivePortal('admin')}
            className={`w-full justify-center px-1 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center text-center ${
              activePortal === 'admin'
                ? 'bg-violet-700 text-white border-2 border-violet-200 shadow-md'
                : 'bg-[#2B085C] text-violet-100 hover:bg-violet-800 border border-violet-500/40'
            }`}
          >
            Admin
          </button>
        </div>

        {/* Mobile Dropdown Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-violet-700/50 bg-[#1C053E] px-4 py-3 space-y-2 shadow-2xl animate-fadeIn">
            <button
              onClick={() => {
                setActivePortal('hub');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition ${
                activePortal === 'hub'
                  ? 'bg-violet-700 text-white border-2 border-violet-200 shadow-md'
                  : 'bg-[#2B085C] text-violet-100 hover:bg-violet-800 border border-violet-500/40'
              }`}
            >
              Academy Hub
            </button>

            <button
              onClick={() => {
                setActivePortal('teacher');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition ${
                activePortal === 'teacher'
                  ? 'bg-violet-700 text-white border-2 border-violet-200 shadow-md'
                  : 'bg-[#2B085C] text-violet-100 hover:bg-violet-800 border border-violet-500/40'
              }`}
            >
              Teacher Portal
            </button>

            <button
              onClick={() => {
                setActivePortal('attendance');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition ${
                activePortal === 'attendance'
                  ? 'bg-violet-700 text-white border-2 border-violet-200 shadow-md'
                  : 'bg-[#2B085C] text-violet-100 hover:bg-violet-800 border border-violet-500/40'
              }`}
            >
              Attendance Portal
            </button>

            <button
              onClick={() => {
                setActivePortal('admin');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition ${
                activePortal === 'admin'
                  ? 'bg-violet-700 text-white border-2 border-violet-200 shadow-md'
                  : 'bg-[#2B085C] text-violet-100 hover:bg-violet-800 border border-violet-500/40'
              }`}
            >
              Admin Portal
            </button>
          </div>
        )}
      </header>

      {/* CORE FRAME CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* A. GENERAL HUB INFORMATION SCREEN */}
        {activePortal === 'hub' && (
          <div 
            className="p-6 sm:p-10 rounded-2xl border border-mauve-500/30 shadow-xl relative overflow-hidden animate-fadeIn no-print my-4"
            style={{
              backgroundImage: `url(${academyHubBg})`,
              backgroundRepeat: 'repeat',
              backgroundPosition: 'center',
              backgroundSize: '400px 400px',
              backgroundColor: '#f6f2fb'
            }}
          >
            <div className="absolute inset-0 bg-mauve-950/10 pointer-events-none rounded-2xl" />
            <div className="relative z-10 space-y-6">
              {/* 1. Hero Welcome Card */}
              <div className="bg-white/95 backdrop-blur-md p-6 sm:p-10 rounded-2xl border border-mauve-500/20 text-center max-w-3xl mx-auto space-y-5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <School className="w-48 h-48 text-mauve-900" />
                </div>
                
                <div className="mx-auto flex items-center justify-center">
                  {config.schoolLogoUrl ? (
                    <img 
                      src={config.schoolLogoUrl} 
                      alt={`${config.schoolName} logo`} 
                      className="w-16 h-16 object-contain rounded-lg shadow-md border border-mauve-500/10"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-mauve-100 text-mauve-900 flex items-center justify-center border border-mauve-500/10">
                      <School className="w-6 h-6" />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 relative z-10">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-mauve-900 bg-mauve-100 px-2.5 py-0.5 rounded">
                    Ghanaian Basic Education Framework
                  </span>
                  <h1 className="font-display font-bold text-2xl sm:text-3xl text-mauve-900 tracking-tight uppercase">
                    EASTFIELD ACADEMY SCHOOL MANAGEMENT SYSTEM
                  </h1>
                  <p className="text-xs text-gray-600 max-w-xl mx-auto leading-relaxed">
                    An integrated portal for Eastfield Academy teachers and administrators to manage pupil assessments, academic records, fee tracking, textbook stock, and official report cards.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-1 relative z-10">
                  <button
                    onClick={() => setActivePortal('teacher')}
                    className="bg-mauve-900 hover:bg-mauve-700 text-white font-extrabold px-5 py-3 rounded-lg text-sm transition cursor-pointer shadow-md uppercase tracking-wider border border-white/30"
                  >
                    Enter Teacher Portal
                  </button>
                  <button
                    onClick={() => setActivePortal('admin')}
                    className="bg-[#1E0650] border border-white/30 hover:bg-[#2B0D5D] text-white font-extrabold px-5 py-3 rounded-lg text-sm transition cursor-pointer uppercase tracking-wider shadow-md"
                  >
                    Enter Admin Portal
                  </button>
                  <button
                    onClick={() => setActivePortal('attendance')}
                    className="bg-violet-900 hover:bg-violet-800 border border-white/30 text-white font-extrabold px-5 py-3 rounded-lg text-sm transition cursor-pointer uppercase tracking-wider shadow-md"
                  >
                    Open Attendance Portal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* B. ADMIN PORTAL ROUTE */}
        {activePortal === 'admin' && (
          <div className="space-y-6">
            {currentUser ? (
              /* RESTRICTED VIEWS FOR TEACHERS */
              <div className="max-w-md mx-auto bg-white/95 backdrop-blur-md p-6 rounded-2xl border border-rose-200 text-center space-y-4 no-print animate-fadeIn shadow-lg">
                <div className="w-12 h-12 rounded bg-rose-50 text-rose-600 mx-auto flex items-center justify-center border border-rose-100">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-rose-900 text-base">Access Denied: Teacher Restriction</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  As a registered teacher, you are strictly restricted from accessing administrative controls and database configurations. Please sign out from the Teacher Portal to authorize as an administrator.
                </p>
                <button
                  onClick={() => setActivePortal('teacher')}
                  className="px-4 py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded text-xs uppercase tracking-wider transition cursor-pointer"
                >
                  Return to Teacher Workspace
                </button>
              </div>
            ) : !isAdminAuthenticated ? (
              /* ADMIN SECURITY ACCESS CODES FOR DEMO */
              <div 
                className="max-w-lg mx-auto p-6 sm:p-8 rounded-2xl border border-mauve-500/30 shadow-xl relative overflow-hidden space-y-4 no-print animate-fadeIn my-6"
                style={{
                  backgroundImage: `url(${academyHubBg})`,
                  backgroundRepeat: 'repeat',
                  backgroundPosition: 'center',
                  backgroundSize: '400px 400px',
                  backgroundColor: '#f6f2fb'
                }}
              >
                <div className="absolute inset-0 bg-mauve-950/10 pointer-events-none rounded-2xl" />
                <div className="relative z-10 bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-2xl border border-mauve-500/20 shadow-xl space-y-4">
                  <div className="text-center space-y-1.5">
                    <div className="w-12 h-12 rounded-xl bg-mauve-100 text-mauve-900 mx-auto flex items-center justify-center border border-mauve-500/10 shadow-sm">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h3 className="font-display font-extrabold text-mauve-950 text-lg uppercase tracking-tight">Administrative Access Security</h3>
                    <p className="text-xs text-gray-600 leading-relaxed font-medium">Sign in with administrative credentials to access the Textbook Stock Portal, student admissions, fee tracking, and report configurations.</p>
                  </div>

                  {adminError && (
                    <div className="bg-rose-50 text-rose-700 p-2.5 rounded-xl border border-rose-200 text-xs text-center font-bold">
                      {adminError}
                    </div>
                  )}

                  <form onSubmit={handleAdminGateLogin} className="space-y-3.5">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] uppercase font-bold text-mauve-900 block">Admin Email ID</label>
                      <input
                        type="email"
                        required
                        placeholder="e.g. admin@eastfield.com"
                        value={adminEmail}
                        onChange={(e) => setAdminEmail(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs font-semibold"
                      />
                    </div>

                    <div className="space-y-1 text-left relative">
                      <label className="text-[10px] uppercase font-bold text-mauve-900 block">Admin Security Password</label>
                      <div className="relative">
                        <input
                          type={showAdminPassword ? "text" : "password"}
                          required
                          placeholder="Enter password"
                          value={adminPassword}
                          onChange={(e) => setAdminPassword(e.target.value)}
                          autoComplete="new-password"
                          className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs font-mono font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-mauve-900 focus:outline-none cursor-pointer"
                          id="btn-show-admin-password"
                        >
                          {showAdminPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 bg-mauve-900 hover:bg-mauve-800 text-white font-extrabold rounded-xl text-xs transition cursor-pointer shadow-md uppercase tracking-wider"
                    >
                      Authorize Administrative Credentials
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              /* AUTHORIZED ADMIN MODULES */
              <AdminDashboard
                students={students}
                setStudents={setStudents}
                teachers={teachers}
                setTeachers={setTeachers}
                subjects={INITIAL_SUBJECTS}
                grades={grades}
                setGrades={setGrades}
                attendance={attendance}
                setAttendance={setAttendance}
                dailyAttendance={dailyAttendance}
                setDailyAttendance={setDailyAttendance}
                bills={bills}
                onUpdateBill={handleUpdateBill}
                config={config}
                setConfig={setConfig}
                classes={INITIAL_CLASSES}
                onSignOut={() => {
                  setIsAdminAuthenticated(false);
                  setAdminPassword('');
                }}
                supabaseStatus={supabaseStatus}
                isSupabaseSyncing={isSupabaseSyncing}
                onPullFromSupabase={handlePullFromSupabase}
                onPushToSupabase={handlePushToSupabase}
                onCheckSupabaseStatus={checkSupabaseStatus}
                storedAdminPassword={storedAdminPassword}
                onUpdateAdminPassword={handleUpdateAdminPassword}
              />
            )}
          </div>
        )}

        {/* C. TEACHER PORTAL ROUTE */}
        {activePortal === 'teacher' && (
          isAdminAuthenticated ? (
            <div className="max-w-md mx-auto bg-white p-6 rounded-lg border border-rose-200 text-center space-y-4 no-print animate-fadeIn shadow-sm">
              <div className="w-12 h-12 rounded bg-rose-50 text-rose-600 mx-auto flex items-center justify-center border border-rose-100">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-rose-900 text-base">Access Denied: Admin Restriction</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                As an authenticated administrator, you are strictly restricted from accessing the teacher classroom portal and grade books. Please sign out from the Admin Dashboard first.
              </p>
              <button
                onClick={() => setActivePortal('admin')}
                className="px-4 py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded text-xs uppercase tracking-wider transition cursor-pointer"
              >
                Return to Admin Workspace
              </button>
            </div>
          ) : (
            <TeacherDashboard
              students={students}
              teachers={teachers}
              setTeachers={setTeachers}
              subjects={INITIAL_SUBJECTS}
              grades={grades}
              setGrades={setGrades}
              attendance={attendance}
              setAttendance={setAttendance}
              dailyAttendance={dailyAttendance}
              config={config}
              classes={INITIAL_CLASSES}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              isAdminAuthenticated={isAdminAuthenticated}
            />
          )
        )}

        {/* D. STUDENT ATTENDANCE PORTAL ROUTE */}
        {activePortal === 'attendance' && (
          <StudentAttendancePortal
            students={students}
            setStudents={setStudents}
            teachers={teachers}
            attendance={attendance}
            setAttendance={setAttendance}
            dailyAttendance={dailyAttendance}
            setDailyAttendance={setDailyAttendance}
            classes={INITIAL_CLASSES}
            config={config}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            isAdminAuthenticated={isAdminAuthenticated}
            setActivePortal={setActivePortal}
          />
        )}
      </main>

      {/* FOOTER - HIDE IN PRINT */}
      <footer className="mt-16 border-t border-mauve-100/60 pt-8 text-center text-xs text-mauve-400 no-print">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-mauve-600/70">Eastfield Academy basic education center</p>
          <p className="mt-1">© 2026 Eastfield Academy. Academic Marks Board. All Rights Reserved.</p>
        </div>
      </footer>

      {/* DB SYNC ERROR & HEALTH DIAGNOSTIC MODAL */}
      {showSyncErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden border border-mauve-200 shadow-2xl text-left flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className={`p-5 border-b flex items-center gap-3 ${
              supabaseStatus.failingCount > 0 
                ? 'bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-rose-100' 
                : 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-100'
            }`}>
              <div className={`p-2.5 rounded-xl ${
                supabaseStatus.failingCount > 0 
                  ? 'bg-rose-100 text-rose-700' 
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {supabaseStatus.failingCount > 0 ? (
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-extrabold text-mauve-900 text-base uppercase tracking-wide truncate">
                  Cloud Database & Table Sync Diagnostic
                </h3>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                  Automated 18-Table Audit & Dynamic SQL Fix Generator
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => checkSupabaseStatus().catch(() => {})}
                  disabled={isAuditingSupabase}
                  className="px-2.5 py-1.5 bg-white/80 hover:bg-white text-mauve-900 border border-mauve-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Re-run database table audit"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAuditingSupabase ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Audit Now</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowSyncErrorModal(false)}
                  className="p-1.5 hover:bg-white/80 rounded-lg text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed text-gray-600">
              {/* Quick Status Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Tables Monitored</span>
                  <span className="font-mono text-base font-extrabold text-mauve-900">{supabaseStatus.totalTablesChecked || 18}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Healthy Tables</span>
                  <span className="font-mono text-base font-extrabold text-emerald-800">{supabaseStatus.healthyCount}</span>
                </div>
                <div className={`p-3 border rounded-xl text-center ${
                  supabaseStatus.failingCount > 0 ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <span className={`text-[10px] font-bold uppercase block ${
                    supabaseStatus.failingCount > 0 ? 'text-rose-700' : 'text-gray-500'
                  }`}>Failing Tables</span>
                  <span className={`font-mono text-base font-extrabold ${
                    supabaseStatus.failingCount > 0 ? 'text-rose-700' : 'text-gray-700'
                  }`}>{supabaseStatus.failingCount}</span>
                </div>
                <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl text-center">
                  <span className="text-[10px] font-bold text-violet-700 uppercase block">Enrolled Pupils</span>
                  <span className="font-mono text-base font-extrabold text-violet-900">{students.length}</span>
                </div>
              </div>

              {/* Status Message */}
              <div className={`p-3.5 rounded-xl border font-mono text-xs break-words ${
                supabaseStatus.failingCount > 0
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : supabaseStatus.isConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <div className="flex items-center gap-2 font-bold mb-1">
                  {supabaseStatus.isConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>Status Summary:</span>
                </div>
                <p className="text-[11px] leading-relaxed font-sans">{supabaseStatus.message}</p>
              </div>

              {/* DYNAMIC SUGGESTED SQL FIX FOR DETECTED TABLE MISMATCHES */}
              {supabaseStatus.suggestedSqlFix && (
                <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>Suggested SQL Fix for Detected Table Mismatches:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(supabaseStatus.suggestedSqlFix);
                        setCopiedCustomSql(true);
                        setTimeout(() => setCopiedCustomSql(false), 3000);
                      }}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold cursor-pointer transition uppercase tracking-wider flex items-center gap-1 shadow-xs"
                    >
                      {copiedCustomSql ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied SQL Fix!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy SQL Fix</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-900">
                    The audit detected missing or mismatched tables (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold text-amber-900">{supabaseStatus.failingTables.map(t => t.table).join(', ')}</code>). Run the script below in your <strong>Supabase SQL Editor</strong> to automatically create them and restore real-time syncing:
                  </p>
                  <pre className="p-3 bg-gray-900 text-emerald-400 rounded-lg text-[10px] font-mono overflow-x-auto max-h-48 border border-gray-700 select-all leading-tight">
                    {supabaseStatus.suggestedSqlFix}
                  </pre>
                </div>
              )}

              {/* TABLE HEALTH STATUS BREAKDOWN */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-mauve-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-mauve-700" />
                    <span>Table Audit Breakdown (18 Tables):</span>
                  </h4>
                  <span className="text-[10px] font-mono text-gray-500">
                    Last audited: {new Date(supabaseStatus.checkedAt).toLocaleTimeString()}
                  </span>
                </div>

                <div className="border border-mauve-100 rounded-xl overflow-hidden divide-y divide-mauve-50 max-h-60 overflow-y-auto">
                  {supabaseStatus.allTablesStatus.length > 0 ? (
                    supabaseStatus.allTablesStatus.map(table => (
                      <div key={table.table} className={`p-2.5 flex items-center justify-between text-xs transition ${
                        table.status === 'healthy' ? 'hover:bg-emerald-50/40' : 'bg-rose-50/50 hover:bg-rose-50'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {table.status === 'healthy' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          )}
                          <span className="font-mono font-bold text-mauve-900 truncate">{table.table}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {table.status === 'healthy' ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono text-[10px] font-bold">
                              {table.count !== null ? `${table.count} row${table.count === 1 ? '' : 's'}` : 'Healthy'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-mono text-[10px] font-bold" title={table.errorMessage || 'Error'}>
                              {table.errorCode ? `Err: ${table.errorCode}` : (table.errorMessage ? table.errorMessage.slice(0, 20) : 'Failing')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-400 text-xs">
                      No table health status data. Click "Audit Now" to test table connectivity.
                    </div>
                  )}
                </div>
              </div>

              {/* GENERAL REPAIR BOX */}
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-mauve-600" />
                    <span>Comprehensive Master Schema Repair SQL</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(SUPABASE_SQL_REPAIR);
                      setCopiedRepair(true);
                      setTimeout(() => setCopiedRepair(false), 3000);
                    }}
                    className="px-2.5 py-1 bg-mauve-900 hover:bg-mauve-800 text-white rounded text-[10px] font-bold cursor-pointer transition uppercase tracking-wider"
                  >
                    {copiedRepair ? 'Copied Master SQL!' : 'Copy Master SQL'}
                  </button>
                </div>
                <p className="text-[10px] text-gray-600 leading-normal">
                  If you need the complete baseline schema definition for all tables, columns, and indexes, click above to copy the full repair script for the Supabase SQL Editor.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSyncErrorModal(false)}
                className="px-4 py-2 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer text-center"
              >
                Close Diagnostic
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSyncErrorModal(false);
                  setActivePortal('admin');
                }}
                className="px-4 py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer text-center shadow-sm"
              >
                Go to Credentials Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
