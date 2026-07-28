/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Student, User, Subject, ReportConfig, Grade, Attendance, StudentBill } from './types';
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
import { School, ShieldCheck, GraduationCap, Users2, FileCheck, CheckCircle2, Lock, Sparkles, BookOpen, Eye, EyeOff, Database, AlertTriangle, X, Menu } from 'lucide-react';
import {
  getSupabaseCredentials,
  testSupabaseConnection,
  fetchSupabaseConfig,
  fetchSupabaseStudents,
  fetchSupabaseTeachers,
  fetchSupabaseGrades,
  fetchSupabaseAttendance,
  fetchSupabaseBills,
  saveSupabaseConfig,
  saveSupabaseStudents,
  saveSupabaseTeachers,
  saveSupabaseGrades,
  saveSupabaseAttendance,
  saveSupabaseBills,
  SUPABASE_SQL_SCHEMA,
  SUPABASE_SQL_REPAIR
} from './lib/supabase';
import { isAutoPromotionDue, promoteStudents } from './services/promotionService';


export default function App() {
  // Master States
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
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

  // Nav State: 'hub' | 'admin' | 'teacher'
  const [activePortal, setActivePortal] = useState<'hub' | 'admin' | 'teacher'>(() => {
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
  const [supabaseStatus, setSupabaseStatus] = useState<{ isConfigured: boolean; isConnected: boolean; message: string }>({
    isConfigured: false,
    isConnected: false,
    message: 'Supabase is not configured.'
  });
  const [isSupabaseSyncing, setIsSupabaseSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'offline'>('offline');
  const [lastSyncError, setLastSyncError] = useState<string>('');
  const [showSyncErrorModal, setShowSyncErrorModal] = useState(false);
  const [copiedRepair, setCopiedRepair] = useState(false);

  // Check connection status
  const checkSupabaseStatus = async () => {
    const creds = getSupabaseCredentials();
    if (!creds.isConfigured) {
      setSupabaseStatus({
        isConfigured: false,
        isConnected: false,
        message: 'No credentials found. Please configure Supabase in settings.'
      });
      return false;
    }

    setSupabaseStatus(prev => ({ ...prev, isConfigured: true, message: 'Verifying connection...' }));
    const result = await testSupabaseConnection();
    setSupabaseStatus({
      isConfigured: true,
      isConnected: result.success,
      message: result.message
    });
    return result.success;
  };

  // Pull all tables from Supabase with smart fallbacks and automatic seeding
  const handlePullFromSupabase = async () => {
    setIsSupabaseSyncing(true);
    try {
      const active = await checkSupabaseStatus();
      if (!active) {
        setIsSupabaseSyncing(false);
        return false;
      }

      // Read current values from localStorage (fallback cache)
      const cachedConfigStr = localStorage.getItem('ea_config');
      const localConfig = cachedConfigStr ? JSON.parse(cachedConfigStr) : DEFAULT_REPORT_CONFIG;

      const cachedStudentsStr = localStorage.getItem('ea_students');
      const localStudents: Student[] = cachedStudentsStr ? JSON.parse(cachedStudentsStr) : INITIAL_STUDENTS;

      const cachedTeachersStr = localStorage.getItem('ea_teachers');
      const localTeachers: User[] = cachedTeachersStr ? JSON.parse(cachedTeachersStr) : INITIAL_USERS;

      const cachedGradesStr = localStorage.getItem('ea_grades');
      const localGrades: Grade[] = cachedGradesStr ? JSON.parse(cachedGradesStr) : INITIAL_GRADES;

      const cachedAttendanceStr = localStorage.getItem('ea_attendance');
      const localAttendance: Attendance[] = cachedAttendanceStr ? JSON.parse(cachedAttendanceStr) : INITIAL_ATTENDANCE;

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
            ...localConfig,
            ...sConfig,
            reopeningDate: sConfig.reopeningDate || localConfig.reopeningDate || DEFAULT_REPORT_CONFIG.reopeningDate
          };
          setConfig(mergedConfig);
          localStorage.setItem('ea_config', JSON.stringify(mergedConfig));
        } else {
          // Row does not exist on Supabase, but query worked -> safe to seed
          try {
            await saveSupabaseConfig(localConfig);
            setConfig(localConfig);
          } catch (seedErr) {
            console.error("Failed seeding config to Supabase:", seedErr);
            setConfig(localConfig);
          }
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

      let activeTeachers = localTeachers;
      if (teachersFetchSuccess && sTeachers !== null) {
        if (sTeachers.length === 0 && localTeachers.length > 0) {
          // Empty table -> safe to seed
          try {
            await saveSupabaseTeachers(localTeachers);
            activeTeachers = localTeachers;
            setTeachers(localTeachers);
          } catch (seedErr) {
            console.error("Failed seeding teachers to Supabase:", seedErr);
            activeTeachers = localTeachers;
            setTeachers(localTeachers);
          }
        } else {
          activeTeachers = sTeachers;
          setTeachers(sTeachers);
          localStorage.setItem('ea_teachers', JSON.stringify(sTeachers));
        }
      } else {
        // Query failed or failed to fetch -> fallback to local cache, don't write
        activeTeachers = localTeachers;
        setTeachers(localTeachers);
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
        const cleanStudents = sStudents.filter(
          s => !teacherIds.has(s.id) && !teacherEmails.has(s.guardianEmail.toLowerCase())
        );

        if (cleanStudents.length === 0 && localStudents.length > 0) {
          const cleanLocalStudents = localStudents.filter(
            s => !teacherIds.has(s.id) && !teacherEmails.has(s.guardianEmail.toLowerCase())
          );
          try {
            await saveSupabaseStudents(cleanLocalStudents);
            setStudents(cleanLocalStudents);
          } catch (seedErr) {
            console.error("Failed seeding students to Supabase:", seedErr);
            setStudents(cleanLocalStudents);
          }
        } else {
          setStudents(cleanStudents);
          localStorage.setItem('ea_students', JSON.stringify(cleanStudents));
        }
      } else {
        const cleanLocalStudents = localStudents.filter(
          s => !teacherIds.has(s.id) && !teacherEmails.has(s.guardianEmail.toLowerCase())
        );
        setStudents(cleanLocalStudents);
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
        sGrades.forEach(g => {
          const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
          gradeMap.set(key, g);
        });
        localGrades.forEach(g => {
          const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
          const existing = gradeMap.get(key);
          if (!existing) {
            gradeMap.set(key, g);
          } else {
            const localTime = g.updatedAt ? new Date(g.updatedAt).getTime() : 0;
            const remoteTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            if (localTime >= remoteTime) {
              gradeMap.set(key, g);
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

      setIsSupabaseSyncing(false);
      return true;
    } catch (e: any) {
      console.error('Failed pulling from Supabase:', e);
      setIsSupabaseSyncing(false);
      return false;
    }
  };

  // Push all local states to Supabase
  const handlePushToSupabase = async (
    customStudents?: Student[],
    customConfig?: ReportConfig,
    customTeachers?: User[],
    customGrades?: Grade[],
    customAttendance?: Attendance[],
    customBills?: StudentBill[]
  ) => {
    setIsSupabaseSyncing(true);
    try {
      const active = await checkSupabaseStatus();
      if (!active) {
        setIsSupabaseSyncing(false);
        return false;
      }

      const targetConfig = customConfig || config;
      const targetStudents = customStudents || students;
      const targetTeachers = customTeachers || teachers;
      const targetGrades = customGrades || grades;
      const targetAttendance = customAttendance || attendance;
      const targetBills = customBills || bills;

      const okConfig = await saveSupabaseConfig(targetConfig);
      const okStudents = await saveSupabaseStudents(targetStudents);
      const okTeachers = await saveSupabaseTeachers(targetTeachers);
      const okGrades = await saveSupabaseGrades(targetGrades);
      const okAttendance = await saveSupabaseAttendance(targetAttendance);
      const okBills = await saveSupabaseBills(targetBills);

      setIsSupabaseSyncing(false);
      return okConfig && okStudents && okTeachers && okGrades && okAttendance && okBills;
    } catch (e: any) {
      console.error('Failed pushing to Supabase:', e);
      setIsSupabaseSyncing(false);
      return false;
    }
  };

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
    setTeachers(finalTeachers);
    localStorage.setItem('ea_teachers', JSON.stringify(finalTeachers));

    let finalStudents: Student[] = [];
    if (cachedStudents !== null) {
      try {
        finalStudents = JSON.parse(cachedStudents) as Student[];
      } catch (e) {
        finalStudents = INITIAL_STUDENTS;
      }
    } else {
      finalStudents = INITIAL_STUDENTS;
    }

    // Filter out any teacher accounts that may have leaked into students
    const teacherEmails = new Set(finalTeachers.map(t => t.email.toLowerCase()));
    const teacherIds = new Set(finalTeachers.map(t => t.id));
    let cleanStudents = finalStudents.filter(
      s => !teacherIds.has(s.id) && !teacherEmails.has(s.guardianEmail.toLowerCase())
    );

    // Auto-restore any initial students (like Aboagye Messiah) missing from cache
    const existingStudentIds = new Set(cleanStudents.map(s => s.id));
    INITIAL_STUDENTS.forEach(initSt => {
      if (!existingStudentIds.has(initSt.id)) {
        cleanStudents.push(initSt);
      }
    });

    setStudents(cleanStudents);
    localStorage.setItem('ea_students', JSON.stringify(cleanStudents));

    let finalGrades: Grade[] = [];
    if (cachedGrades !== null) {
      try {
        finalGrades = JSON.parse(cachedGrades) as Grade[];
      } catch (e) {
        finalGrades = INITIAL_GRADES;
      }
    } else {
      finalGrades = INITIAL_GRADES;
    }

    // Auto-restore any initial grades (like Aboagye Messiah's grades) missing from cache
    const existingGradeKeys = new Set(finalGrades.map(g => `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`));
    INITIAL_GRADES.forEach(initG => {
      const key = `${initG.studentId}_${initG.subjectId}_${initG.term || 'Term 1'}_${initG.year || '2025/2026'}`;
      if (!existingGradeKeys.has(key)) {
        finalGrades.push(initG);
      }
    });

    setGrades(finalGrades);
    localStorage.setItem('ea_grades', JSON.stringify(finalGrades));

    let finalAttendance: Attendance[] = [];
    if (cachedAttendance !== null) {
      try {
        finalAttendance = JSON.parse(cachedAttendance) as Attendance[];
      } catch (e) {
        finalAttendance = INITIAL_ATTENDANCE;
      }
    } else {
      finalAttendance = INITIAL_ATTENDANCE;
    }

    const existingAttKeys = new Set(finalAttendance.map(a => `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`));
    INITIAL_ATTENDANCE.forEach(initA => {
      const key = `${initA.studentId}_${initA.term || 'Term 1'}_${initA.year || '2025/2026'}`;
      if (!existingAttKeys.has(key)) {
        finalAttendance.push(initA);
      }
    });

    setAttendance(finalAttendance);
    localStorage.setItem('ea_attendance', JSON.stringify(finalAttendance));

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
        const ok = await checkSupabaseStatus();
        if (ok) {
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
          setLastSyncError('Failed to verify cloud credentials.');
        }
      } else {
        setSyncStatus('offline');
      }
      setIsInitialized(true);
    };
    initSupabase();
  }, []);

  // 2. SAVE STATE MUTATIONS BACK TO LOCAL STORAGE AND SUPABASE (AUTO-SYNC)
  // Auto-promote students at the reopening date of First Term
  useEffect(() => {
    if (!isInitialized || students.length === 0) return;
    if (config.autoPromoteOnReopening !== false && isAutoPromotionDue(config)) {
      const preSnapshot = JSON.parse(JSON.stringify(students));
      const result = promoteStudents(students, config.schoolYear);
      const updatedConfig: ReportConfig = {
        ...config,
        lastPromotedYear: config.schoolYear,
        lastPromotionDate: new Date().toISOString(),
        prePromotionSnapshot: preSnapshot
      };

      setStudents(result.promotedStudents);
      setConfig(updatedConfig);

      localStorage.setItem('ea_students', JSON.stringify(result.promotedStudents));
      localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
      localStorage.setItem('ea_pre_promotion_students', JSON.stringify(preSnapshot));

      const creds = getSupabaseCredentials();
      if (creds.isConfigured) {
        saveSupabaseStudents(result.promotedStudents);
        saveSupabaseConfig(updatedConfig);
      }
    }
  }, [isInitialized, config, students.length]);

  // Ensure we never have teachers registered under students (e.g. from database triggers on signUp)
  useEffect(() => {
    if (!isInitialized) return;
    const teacherEmails = new Set(teachers.map(t => t.email.toLowerCase()));
    const teacherIds = new Set(teachers.map(t => t.id));
    const hasOverlap = students.some(s => teacherIds.has(s.id) || teacherEmails.has(s.guardianEmail.toLowerCase()));
    if (hasOverlap) {
      setStudents(prev => prev.filter(s => !teacherIds.has(s.id) && !teacherEmails.has(s.guardianEmail.toLowerCase())));
    }
  }, [teachers, students, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    localStorage.setItem('ea_students', JSON.stringify(students));
    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseStudents(students).then(ok => {
        if (ok) setSyncStatus('synced');
        else {
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
    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseTeachers(teachers).then(ok => {
        if (ok) setSyncStatus('synced');
        else {
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
    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseGrades(grades).then(ok => {
        if (ok) setSyncStatus('synced');
        else {
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
    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseAttendance(attendance).then(ok => {
        if (ok) setSyncStatus('synced');
        else {
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
    localStorage.setItem('ea_config', JSON.stringify(config));
    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      setSyncStatus('syncing');
      saveSupabaseConfig(config).then(ok => {
        if (ok) setSyncStatus('synced');
        else {
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
    <div className="min-h-screen bg-mauve-50 text-gray-800 font-sans pb-12 print:pb-0">
      {/* GLOBAL HIGH-CONTRAST HEADER NAVBAR - HIDE IN PRINT */}
      <header className="bg-white border-b border-mauve-500/20 sticky top-0 z-40 shadow-sm no-print">
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
                <span className="font-display font-extrabold text-xs sm:text-sm tracking-tight text-mauve-900 block uppercase truncate">
                  {config.schoolName}
                </span>
              </div>
              <span className="text-[8px] sm:text-[9px] font-mono tracking-wider text-mauve-600 uppercase block truncate">
                Terminal Report Engine v4.0
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setActivePortal('hub')}
              className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                activePortal === 'hub'
                  ? 'bg-mauve-900 text-white border border-mauve-900 shadow-sm'
                  : 'text-mauve-900/70 hover:bg-mauve-100 border border-transparent'
              }`}
            >
              Academy Hub
            </button>
            {!isAdminAuthenticated && (
              <button
                onClick={() => setActivePortal('teacher')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  activePortal === 'teacher'
                    ? 'bg-mauve-900 text-white border border-mauve-900 shadow-sm'
                    : 'text-mauve-900/70 hover:bg-mauve-100 border border-transparent'
                }`}
                id="nav-teacher-portal"
              >
                Teacher Portal
              </button>
            )}
            {!currentUser && (
              <button
                onClick={() => setActivePortal('admin')}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                  activePortal === 'admin'
                    ? 'bg-mauve-900 text-white border border-mauve-900 shadow-sm'
                    : 'text-mauve-900/70 hover:bg-mauve-100 border border-transparent'
                }`}
                id="nav-admin-portal"
              >
                Admin Portal
              </button>
            )}
          </nav>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-mauve-50 text-mauve-900 hover:bg-mauve-100 transition border border-mauve-500/15"
              aria-label="Toggle Navigation Menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-mauve-500/20 bg-white px-4 py-3 space-y-2 shadow-md animate-fadeIn">
            <button
              onClick={() => {
                setActivePortal('hub');
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                activePortal === 'hub'
                  ? 'bg-mauve-900 text-white'
                  : 'text-mauve-900 bg-mauve-50/50 hover:bg-mauve-100'
              }`}
            >
              Academy Hub
            </button>

            {!isAdminAuthenticated && (
              <button
                onClick={() => {
                  setActivePortal('teacher');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  activePortal === 'teacher'
                    ? 'bg-mauve-900 text-white'
                    : 'text-mauve-900 bg-mauve-50/50 hover:bg-mauve-100'
                }`}
              >
                Teacher Portal
              </button>
            )}

            {!currentUser && (
              <button
                onClick={() => {
                  setActivePortal('admin');
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                  activePortal === 'admin'
                    ? 'bg-mauve-900 text-white'
                    : 'text-mauve-900 bg-mauve-50/50 hover:bg-mauve-100'
                }`}
              >
                Admin Portal
              </button>
            )}
          </div>
        )}
      </header>

      {/* CORE FRAME CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* A. GENERAL HUB INFORMATION SCREEN */}
        {activePortal === 'hub' && (
          <div className="space-y-6 animate-fadeIn no-print">
            {/* 1. Hero Welcome Card */}
            <div className="bg-white p-6 sm:p-10 rounded-lg border border-mauve-500/20 text-center max-w-3xl mx-auto space-y-5 relative overflow-hidden">
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
                  EASTFIELD ACADEMY REPORT MANAGEMENT SYSTEM
                </h1>
                <p className="text-xs text-gray-600 max-w-xl mx-auto leading-relaxed">
                  A high-fidelity record platform designed for Eastfield Academy teachers and administrators to automate pupil evaluations, log term attendances, and generate crisp transcript cards.
                </p>
              </div>
 
              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-1 relative z-10">
                <button
                  onClick={() => setActivePortal('teacher')}
                  className="bg-mauve-900 hover:bg-mauve-700 text-white font-bold px-5 py-2.5 rounded text-xs transition cursor-pointer shadow-sm uppercase tracking-wider"
                >
                  Enter Teacher Classroom Log
                </button>
                <button
                  onClick={() => setActivePortal('admin')}
                  className="bg-white border border-mauve-900/30 hover:bg-mauve-50 text-mauve-900 font-bold px-5 py-2.5 rounded text-xs transition cursor-pointer uppercase tracking-wider"
                >
                  Manage School Admissions
                </button>
              </div>
            </div>
 
            {/* 2. Feature Highlights Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto pt-2">
              {[
                {
                  title: 'Automated Marking Engine',
                  desc: 'Weighs continuous class assignments at 30% and term examinations at 70%, dynamically outputting standard letter codes and contextual performance evaluations.',
                  icon: FileCheck,
                  badge: 'Standardized'
                },
                {
                  title: 'Divisional Security Access',
                  desc: 'Distinct user portals for administrative operations and teachers. Teacher portals are locked behind classroom registrations to ensure gradebook integrity.',
                  icon: ShieldCheck,
                  badge: 'Secure'
                },
                {
                  title: 'Customizable PDF Transcripts',
                  desc: 'Fine-tune transcript layouts directly in-browser. Customize principal stamp designations, signature layers, and student conduct boards before printing.',
                  icon: GraduationCap,
                  badge: 'A4 Ready'
                }
              ].map((feat, idx) => {
                const Icon = feat.icon;
                return (
                  <div key={idx} className="bg-white p-5 rounded-lg border border-mauve-500/20 flex flex-col justify-between space-y-3 shadow-sm hover:border-mauve-500/40 transition-colors">
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <div className="p-2 rounded bg-mauve-100 text-mauve-900 border border-mauve-500/10">
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-[9px] font-mono font-bold bg-mauve-100 text-mauve-900 px-2 py-0.5 rounded uppercase tracking-wider">
                          {feat.badge}
                        </span>
                      </div>
                      <h3 className="font-display font-bold text-mauve-900 text-sm">{feat.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* B. ADMIN PORTAL ROUTE */}
        {activePortal === 'admin' && (
          <div className="space-y-6">
            {currentUser ? (
              /* RESTRICTED VIEWS FOR TEACHERS */
              <div className="max-w-md mx-auto bg-white p-6 rounded-lg border border-rose-200 text-center space-y-4 no-print animate-fadeIn shadow-sm">
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
              <div className="max-w-md mx-auto bg-white p-6 rounded-lg border border-mauve-500/20 space-y-4 no-print animate-fadeIn shadow-sm">
                <div className="text-center space-y-1.5">
                  <div className="w-10 h-10 rounded bg-mauve-100 text-mauve-900 mx-auto flex items-center justify-center border border-mauve-500/10">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-mauve-900 text-base">Administrative Access Security</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">Sign in with administrative credentials to access student admissions, staff mapping, and report configurations.</p>
                </div>

                {adminError && (
                  <div className="bg-rose-50 text-rose-700 p-2.5 rounded border border-rose-200 text-xs text-center font-bold">
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
                      className="w-full px-3 py-2 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs"
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
                        className="w-full pl-3 pr-10 py-2 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs font-mono font-bold"
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
                    className="w-full py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded text-xs transition cursor-pointer shadow-sm uppercase tracking-wider"
                  >
                    Authorize Administrative Credentials
                  </button>
                </form>
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
              config={config}
              classes={INITIAL_CLASSES}
              currentUser={currentUser}
              setCurrentUser={setCurrentUser}
              isAdminAuthenticated={isAdminAuthenticated}
            />
          )
        )}
      </main>

      {/* FOOTER - HIDE IN PRINT */}
      <footer className="mt-16 border-t border-mauve-100/60 pt-8 text-center text-xs text-mauve-400 no-print">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-mauve-600/70">Eastfield Academy basic education center</p>
          <p className="mt-1">© 2026 Eastfield Academy. Academic Marks Board. All Rights Reserved.</p>
        </div>
      </footer>

      {/* DB SYNC ERROR DIAGNOSTIC MODAL */}
      {showSyncErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn no-print">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden border border-rose-100 shadow-2xl text-left flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-rose-50 to-amber-50 border-b border-rose-100 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-mauve-900 text-base uppercase tracking-wide">
                  Cloud Sync Diagnostic
                </h3>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                  Real-Time Database Trouble-Shooter
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setShowSyncErrorModal(false)}
                className="ml-auto p-1.5 hover:bg-white/60 rounded-lg text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed text-gray-600">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                  Last Reported Database Exception:
                </span>
                <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl font-mono text-[11px] text-rose-800 break-words leading-relaxed">
                  {lastSyncError || 'An unspecified network or query error occurred while communicating with Supabase.'}
                </div>
              </div>

              {/* QUICK REPAIR BOX */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Quick Database Repair SQL</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(SUPABASE_SQL_REPAIR);
                      setCopiedRepair(true);
                      setTimeout(() => setCopiedRepair(false), 3000);
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold cursor-pointer transition uppercase tracking-wider"
                  >
                    {copiedRepair ? 'Copied Repair SQL!' : 'Copy Repair SQL'}
                  </button>
                </div>
                <p className="text-[10px] text-amber-800 leading-normal">
                  If your database was created earlier and is missing columns like <code className="bg-amber-100 px-1 py-0.2 rounded font-mono font-bold">class_score_weight</code> or <code className="bg-amber-100 px-1 py-0.2 rounded font-mono font-bold">class_score</code>, click above to copy the repair SQL. Run it in your Supabase SQL Editor to upgrade your tables instantly without resetting your data!
                </p>
              </div>

              <div className="space-y-2.5">
                <h4 className="font-bold text-mauve-900 text-xs uppercase tracking-wider">
                  Why is this happening?
                </h4>
                <p>
                  The report card app synchronizes record states (such as pupil logs, exam scores, and uploaded school logos) with your configured Supabase Cloud database automatically. A sync error typically means:
                </p>
                <ul className="list-disc list-inside space-y-2 text-[11px] pl-1.5 text-gray-500">
                  <li>
                    <strong className="text-gray-700">Database Tables Missing:</strong> If this is a fresh Supabase project, you must run the schema setup script in the Supabase SQL editor so the tables exist.
                  </li>
                  <li>
                    <strong className="text-gray-700">Incorrect Credentials:</strong> The Supabase Project URL or Anon API Key in your configurations is invalid or has expired.
                  </li>
                  <li>
                    <strong className="text-gray-700">Logo Size Limit:</strong> Highly complex or large logo uploads can exceed the default payload limits of some database configurations. Try removing the logo or using a smaller image.
                  </li>
                </ul>
              </div>

              <div className="p-3.5 bg-mauve-50/50 border border-mauve-100 rounded-xl space-y-1.5">
                <h5 className="font-bold text-mauve-900 text-[11px] flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-mauve-700" />
                  <span>How to Resolve This:</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-[11px] pl-0.5 text-gray-600">
                  <li>Click the <span className="font-bold text-mauve-800">"Go to Credentials Panel"</span> button below.</li>
                  <li>Click on the <span className="font-bold text-mauve-800">"How to Set Up Your Supabase Database Schema"</span> accordion.</li>
                  <li>Copy the provided SQL setup script and run it in your Supabase SQL Editor.</li>
                </ol>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowSyncErrorModal(false)}
                className="px-4 py-2 hover:bg-gray-100 text-gray-600 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer text-center"
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
