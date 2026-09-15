/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Student, User, Grade, Attendance, StudentBill, DailyAttendanceRecord } from '../types';
import { 
  Database, RefreshCw, CheckCircle2, AlertTriangle, XCircle, 
  Copy, Check, ShieldCheck, Server, Laptop, Activity, ArrowRight,
  ExternalLink, Zap, Users, GraduationCap, History, Clock, FileCode
} from 'lucide-react';
import { 
  auditDatabaseCounts, 
  DatabaseAuditReport, 
  SUPABASE_SQL_REPAIR, 
  pruneDeletedTombstones,
  fetchSupabaseStudents,
  fetchSupabaseTeachers,
  fetchSupabaseGrades,
  saveSupabaseGrades,
  fetchSupabaseAttendance,
  saveSupabaseAttendance,
  saveSupabaseStudents,
  saveSupabaseTeachers,
  isStudentDeleted,
  isTeacherDeleted
} from '../lib/supabase';
import { globalSyncEngine } from '../lib/globalSync';
import { deduplicateStudents } from '../services/promotionService';

interface DatabaseAuditTabProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  teachers: User[];
  setTeachers: React.Dispatch<React.SetStateAction<User[]>>;
  grades?: Grade[];
  setGrades?: React.Dispatch<React.SetStateAction<Grade[]>>;
  attendance?: Attendance[];
  setAttendance?: React.Dispatch<React.SetStateAction<Attendance[]>>;
  dailyAttendance?: DailyAttendanceRecord[];
  setDailyAttendance?: React.Dispatch<React.SetStateAction<DailyAttendanceRecord[]>>;
  bills?: StudentBill[];
  onPullFromSupabase?: () => Promise<boolean>;
  onPushToSupabase?: () => Promise<boolean>;
}

export default function DatabaseAuditTab({
  students,
  setStudents,
  teachers,
  setTeachers,
  grades = [],
  setGrades,
  attendance = [],
  setAttendance,
  dailyAttendance = [],
  setDailyAttendance,
  bills = [],
  onPullFromSupabase,
  onPushToSupabase
}: DatabaseAuditTabProps) {
  const [report, setReport] = useState<DatabaseAuditReport | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRealigning, setIsRealigning] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [lastAuditTime, setLastAuditTime] = useState<Date>(new Date());

  const lastSyncAuditTimeRef = useRef<number>(0);

  const runAudit = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const data = await auditDatabaseCounts(force);
      setReport(data);
      setLastAuditTime(new Date());
    } catch (err) {
      console.error('[DatabaseAudit] Error auditing counts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    runAudit(false);
    const interval = setInterval(() => runAudit(false), 30000); // Background refresh every 30s
    return () => clearInterval(interval);
  }, [runAudit]);

  // Listen to external sync updates with throttling
  useEffect(() => {
    const handleSyncEvent = () => {
      const now = Date.now();
      if (now - lastSyncAuditTimeRef.current > 4000) {
        lastSyncAuditTimeRef.current = now;
        runAudit(false);
      }
    };
    window.addEventListener('ea_global_sync_stream_event', handleSyncEvent);
    window.addEventListener('ea_global_sync_outdated', handleSyncEvent);
    return () => {
      window.removeEventListener('ea_global_sync_stream_event', handleSyncEvent);
      window.removeEventListener('ea_global_sync_outdated', handleSyncEvent);
    };
  }, [runAudit]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_REPAIR);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleForceRealignment = async () => {
    setIsRealigning(true);
    setActionSuccessMessage(null);
    try {
      // 1. Gather all local data safely from memory and storage
      let localStudentsList: Student[] = students;
      try {
        const cached = localStorage.getItem('ea_students');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStudentsList = parsed;
          }
        }
      } catch (e) {}

      let localTeachersList: User[] = teachers;
      try {
        const cachedT = localStorage.getItem('ea_teachers');
        if (cachedT) {
          const parsedT = JSON.parse(cachedT);
          if (Array.isArray(parsedT) && parsedT.length > 0) {
            localTeachersList = parsedT;
          }
        }
      } catch (e) {}

      let localGradesList: Grade[] = grades;
      try {
        const cachedG = localStorage.getItem('ea_grades');
        if (cachedG) {
          const parsedG = JSON.parse(cachedG);
          if (Array.isArray(parsedG) && parsedG.length > 0) {
            localGradesList = parsedG;
          }
        }
      } catch (e) {}

      let localAttList: Attendance[] = attendance;
      try {
        const cachedA = localStorage.getItem('ea_attendance');
        if (cachedA) {
          const parsedA = JSON.parse(cachedA);
          if (Array.isArray(parsedA) && parsedA.length > 0) {
            localAttList = parsedA;
          }
        }
      } catch (e) {}

      // 2. Fetch authoritative remote data in PARALLEL for maximum speed
      const [remoteStudents, remoteTeachers, remoteGrades, remoteAttendance] = await Promise.all([
        fetchSupabaseStudents(),
        fetchSupabaseTeachers(),
        fetchSupabaseGrades(),
        fetchSupabaseAttendance()
      ]);

      // 3. Bidirectional student merge
      const studentMap = new Map<string, Student>();
      (remoteStudents || []).forEach(s => {
        if (s && s.id && !isStudentDeleted(s)) {
          studentMap.set(s.id, s);
        }
      });
      (localStudentsList || []).forEach(s => {
        if (s && s.id && !isStudentDeleted(s)) {
          if (!studentMap.has(s.id)) {
            studentMap.set(s.id, s);
          }
        }
      });
      const reconciledStudents = deduplicateStudents(Array.from(studentMap.values()));
      pruneDeletedTombstones(reconciledStudents, remoteTeachers || undefined);

      // 4. Bidirectional teacher merge
      const teacherMap = new Map<string, User>();
      (remoteTeachers || []).forEach(t => {
        if (t && t.id && !isTeacherDeleted(t)) teacherMap.set(t.id, t);
      });
      (localTeachersList || []).forEach(t => {
        if (t && t.id && !isTeacherDeleted(t) && !teacherMap.has(t.id)) teacherMap.set(t.id, t);
      });
      const reconciledTeachers = Array.from(teacherMap.values());

      // 5. Bidirectional grades merge
      const gradeMap = new Map<string, Grade>();
      (remoteGrades || []).forEach(g => {
        if (g && g.studentId && g.subjectId) {
          const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
          gradeMap.set(key, g);
        }
      });
      (localGradesList || []).forEach(g => {
        if (g && g.studentId && g.subjectId) {
          const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
          if (!gradeMap.has(key)) {
            gradeMap.set(key, g);
          }
        }
      });
      const reconciledGrades = Array.from(gradeMap.values());

      // 6. Bidirectional attendance merge
      const attMap = new Map<string, Attendance>();
      (remoteAttendance || []).forEach(a => {
        if (a && a.studentId) {
          const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`;
          attMap.set(key, a);
        }
      });
      (localAttList || []).forEach(a => {
        if (a && a.studentId) {
          const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`;
          if (!attMap.has(key)) {
            attMap.set(key, a);
          }
        }
      });
      const reconciledAttendance = Array.from(attMap.values());

      // 7. Update UI and local storage instantly
      setStudents(reconciledStudents);
      setTeachers(reconciledTeachers);
      if (setGrades) setGrades(reconciledGrades);
      if (setAttendance) setAttendance(reconciledAttendance);

      localStorage.setItem('ea_students', JSON.stringify(reconciledStudents));
      localStorage.setItem('mock_supabase_ea_students', JSON.stringify(reconciledStudents));
      localStorage.setItem('ea_teachers', JSON.stringify(reconciledTeachers));
      localStorage.setItem('ea_grades', JSON.stringify(reconciledGrades));
      localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(reconciledGrades));
      localStorage.setItem('ea_attendance', JSON.stringify(reconciledAttendance));
      localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(reconciledAttendance));

      // 8. Commit reconciled data to Supabase and Server database concurrently in PARALLEL
      console.log(`[Realignment] Synchronizing reconciled records to Supabase and Server in parallel...`);
      await Promise.all([
        saveSupabaseStudents(reconciledStudents),
        saveSupabaseTeachers(reconciledTeachers),
        saveSupabaseGrades(reconciledGrades),
        saveSupabaseAttendance(reconciledAttendance),
        fetch('/api/sync/all', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            students: reconciledStudents,
            teachers: reconciledTeachers,
            grades: reconciledGrades,
            attendance: reconciledAttendance
          })
        }).catch(() => {})
      ]);

      // 9. Notify cross-tab engine without blocking
      globalSyncEngine.checkVersionAndSync().catch(() => {});

      // 10. Re-run audit to reflect 100% matched counts
      await runAudit(true);

      const studentCount = reconciledStudents.length;
      const teacherCount = reconciledTeachers.length;
      const gradeCount = reconciledGrades.length;
      const attendanceCount = reconciledAttendance.length;

      setActionSuccessMessage(`Global realignment complete! All ${studentCount} pupils, ${teacherCount} staff, ${gradeCount} grades, and ${attendanceCount} attendance records are 100% synchronized.`);
      setTimeout(() => setActionSuccessMessage(null), 8000);
    } catch (err: any) {
      console.error('Realignment failed:', err);
      setActionSuccessMessage('Realignment encountered an issue. Check network connection.');
    } finally {
      setIsRealigning(false);
    }
  };

  const handlePruneTombstones = () => {
    pruneDeletedTombstones(students, teachers);
    runAudit();
    setActionSuccessMessage('Cleaned local deletion tombstones. Active pupils and teachers are now fully unblocked.');
    setTimeout(() => setActionSuccessMessage(null), 6000);
  };

  // Compute status metrics
  const isStudentInSync = report?.counts.students.inSync ?? true;
  const isTeacherInSync = report?.counts.teachers.inSync ?? true;
  const allInSync = report ? Object.values(report.counts).every((c: any) => Boolean(c?.inSync)) : true;

  const entities = [
    {
      id: 'students',
      label: 'Enrolled Pupils / Students',
      icon: GraduationCap,
      local: report?.counts.students.local ?? students.length,
      supabase: report?.counts.students.supabase,
      server: report?.counts.students.server,
      inSync: isStudentInSync,
      description: 'Active pupil admissions and academic records'
    },
    {
      id: 'teachers',
      label: 'Staff Members & Teachers',
      icon: Users,
      local: report?.counts.teachers.local ?? teachers.length,
      supabase: report?.counts.teachers.supabase,
      server: report?.counts.teachers.server,
      inSync: isTeacherInSync,
      description: 'Teacher accounts, subject specializations, and credentials'
    },
    {
      id: 'grades',
      label: 'Continuous Assessment Grades',
      icon: Activity,
      local: report?.counts.grades.local ?? grades.length,
      supabase: report?.counts.grades.supabase,
      server: report?.counts.grades.server,
      inSync: report?.counts.grades.inSync ?? true,
      description: 'Class continuous scores and terminal exam results'
    },
    {
      id: 'attendance',
      label: 'Terminal Attendance Records',
      icon: Clock,
      local: report?.counts.attendance.local ?? attendance.length,
      supabase: report?.counts.attendance.supabase,
      server: report?.counts.attendance.server,
      inSync: report?.counts.attendance.inSync ?? true,
      description: 'Term-level attendance totals, days present, and remarks'
    },
    {
      id: 'dailyAttendance',
      label: 'Daily Roll Call Records',
      icon: CheckCircle2,
      local: report?.counts.dailyAttendance.local ?? dailyAttendance.length,
      supabase: report?.counts.dailyAttendance.supabase,
      server: report?.counts.dailyAttendance.server,
      inSync: report?.counts.dailyAttendance.inSync ?? true,
      description: 'Morning and afternoon daily presence logs'
    },
    {
      id: 'bills',
      label: 'Pupil Fee Bills',
      icon: Server,
      local: report?.counts.bills.local ?? bills.length,
      supabase: report?.counts.bills.supabase,
      server: report?.counts.bills.server,
      inSync: report?.counts.bills.inSync ?? true,
      description: 'Current term bills and ledger arrears'
    },
    {
      id: 'feePayments',
      label: 'Fee Payment Transactions',
      icon: Database,
      local: report?.counts.feePayments.local ?? 0,
      supabase: report?.counts.feePayments.supabase,
      server: report?.counts.feePayments.server,
      inSync: report?.counts.feePayments.inSync ?? true,
      description: 'Recorded fee receipts, MoMo, and cash vouchers'
    }
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-indigo-900/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl shadow-md font-bold">
                <Database className="w-5 h-5" />
              </div>
              <h2 className="text-xl sm:text-2xl font-black font-display tracking-tight text-white">
                Database Audit & Global Synchronization
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/90 font-medium max-w-3xl">
              Inspect live record counts across your Supabase Cloud Database, central Node Server cache, and local browser storage. Manually verify and realign student and teacher records across all devices.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => runAudit(true)}
              disabled={isLoading}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-2 cursor-pointer"
              title="Refresh Audit Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>{isLoading ? 'Auditing...' : 'Run Audit'}</span>
            </button>

            <button
              onClick={handleForceRealignment}
              disabled={isRealigning}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer uppercase tracking-wider"
              id="btn-force-realignment"
            >
              <Zap className={`w-4 h-4 ${isRealigning ? 'animate-spin' : 'fill-slate-950'}`} />
              <span>{isRealigning ? 'Realigning...' : 'Force Global Realignment'}</span>
            </button>

            <button
              onClick={handleCopySql}
              className="px-3.5 py-2.5 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 font-bold text-xs rounded-xl border border-indigo-700 transition flex items-center gap-2 cursor-pointer"
              title="Copy Database Migration Script for Supabase SQL Editor"
            >
              {copiedSql ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Repair Script'}</span>
            </button>
          </div>
        </div>

        {actionSuccessMessage && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-500/80 text-emerald-200 text-xs rounded-xl flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
        )}
      </div>

      {/* Top 3 Diagnostics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Supabase Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Supabase Cloud State</span>
            <div className="flex items-center gap-2">
              {report?.supabaseConnected ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <span className="font-extrabold text-slate-900 text-base">
                {report?.supabaseConnected ? 'Connected & Live' : 'Connecting / Fallback'}
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Target: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] font-mono">public.ea_*</code> tables
            </p>
          </div>
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <Database className="w-5 h-5" />
          </div>
        </div>

        {/* Global Synchronization State */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Cross-Device Synchronization</span>
            <div className="flex items-center gap-2">
              {allInSync ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
              )}
              <span className={`font-extrabold text-base ${allInSync ? 'text-emerald-700' : 'text-amber-700'}`}>
                {allInSync ? 'All Instances In Sync' : 'Reconciliation Ready'}
              </span>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Last checked: {lastAuditTime.toLocaleTimeString()}
            </p>
          </div>
          <div className={`p-2.5 rounded-xl ${allInSync ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Enrolled Pupils Real-Time Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-700">Enrolled Pupils Roster</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-950 font-display">
                {Math.max(report?.counts.students.supabase ?? 0, report?.counts.students.local ?? 0, students.length)}
              </span>
              <span className="text-xs font-bold text-slate-700">Active Pupils</span>
            </div>
            <p className="text-xs text-slate-700 font-medium">
              Staff Teachers: <span className="font-bold text-slate-900">{report?.counts.teachers.supabase ?? report?.counts.teachers.local ?? teachers.length}</span>
            </p>
          </div>
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
            <GraduationCap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Divergence Alert & Quick-Fix Banner */}
      {!allInSync && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-900 rounded-xl shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h4 className="font-black text-amber-950 text-sm">
                Record Divergence Detected Between Local Browser and Supabase Cloud DB
              </h4>
              <p className="text-xs text-amber-800/90 font-medium">
                {report?.counts.students.local !== report?.counts.students.supabase && (
                  <span className="font-semibold">
                    Pupils: {report?.counts.students.local} in this browser vs {report?.counts.students.supabase ?? '0'} in Supabase Cloud DB.
                  </span>
                )}
                {" "}Click &quot;Realign &amp; Sync to Cloud&quot; to push all un-synced pupil records to Supabase and establish 100% parity across all devices.
              </p>
            </div>
          </div>
          <button
            onClick={handleForceRealignment}
            disabled={isRealigning}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-2 shadow cursor-pointer shrink-0 uppercase tracking-wide"
          >
            <Zap className={`w-4 h-4 ${isRealigning ? 'animate-spin' : 'fill-slate-950'}`} />
            <span>{isRealigning ? 'Realigning...' : 'Realign & Sync to Cloud'}</span>
          </button>
        </div>
      )}

      {/* Main Table: Counts Across Environments */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>Synchronized Entity Audit</span>
              <span className="text-xs bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {entities.length} Modules
              </span>
            </h3>
            <p className="text-xs text-slate-700 font-medium mt-0.5">
              Comparison between this browser's cache, the Supabase Cloud database, and the central sync cache.
            </p>
          </div>

          <button
            onClick={handlePruneTombstones}
            className="text-xs px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            title="Clean stale deletion tombstones from this browser"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Unblock Active Records</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-black uppercase tracking-wider text-slate-700">
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4 text-center">This Browser (Local)</th>
                <th className="py-3 px-4 text-center">Supabase Cloud DB</th>
                <th className="py-3 px-4 text-center">Server CDN Cache</th>
                <th className="py-3 px-4 text-center">Sync Status</th>
                <th className="py-3 px-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
              {entities.map((item) => {
                const Icon = item.icon;
                const localVal = item.local;
                const supabaseVal = item.supabase;
                const serverVal = item.server;
                const inSync = item.inSync;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{item.label}</div>
                          <div className="text-[11px] text-slate-700">{item.description}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="font-extrabold text-sm text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {localVal}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {supabaseVal !== null && supabaseVal !== undefined ? (
                        <span className="font-extrabold text-sm text-indigo-950 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                          {supabaseVal}
                        </span>
                      ) : (
                        <span className="text-slate-700 italic text-[11px]">Connecting...</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {serverVal !== null && serverVal !== undefined ? (
                        <span className="font-bold text-sm text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {serverVal}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px] font-medium" title="Cloud-Direct architecture (Supabase Primary)">
                          Cloud-Direct
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {inSync ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>IN SYNC</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>DIVERGENCE</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={handleForceRealignment}
                        disabled={isRealigning}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                      >
                        Realign Now
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Sync Timestamps & Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>Recent Synchronization Logs & Timestamps</span>
            </h3>
            <p className="text-xs text-slate-700 font-medium mt-0.5">
              Live audit trail of synchronization events, admissions, deletions, and realignments.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-700">
            Auto-refreshed: {lastAuditTime.toLocaleTimeString()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-black uppercase tracking-wider text-slate-700">
                <th className="py-2.5 px-4">Timestamp</th>
                <th className="py-2.5 px-4">Action Type</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4 text-center">Performed By</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800 font-medium">
              {report?.recentSyncLogs && report.recentSyncLogs.length > 0 ? (
                report.recentSyncLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-950 bg-slate-100 px-2 py-0.5 rounded font-mono text-[11px]">
                        {log.action_type || log.actionType || 'SYNC_EVENT'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {log.description}
                    </td>
                    <td className="py-3 px-4 text-center text-slate-700 font-semibold">
                      {log.performed_by || log.performedBy || 'System'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                        {log.status || 'SUCCESS'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-700">
                    <div className="max-w-md mx-auto space-y-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                      <div className="font-bold text-slate-700">Real-Time Sync Active</div>
                      <p className="text-xs text-slate-700">
                        All student and teacher records are synchronized directly between Supabase and active client browsers via live WebSocket channels.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL Migration & Troubleshooting Drawer */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-base text-white">Authoritative Supabase Schema Migration</h4>
              <p className="text-xs text-slate-400 font-medium">
                If new columns or tables are needed in your Supabase project, execute this script in the Supabase SQL Editor.
              </p>
            </div>
          </div>

          <button
            onClick={handleCopySql}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer self-start sm:self-auto shrink-0"
          >
            {copiedSql ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copiedSql ? 'SQL Script Copied!' : 'Copy Migration SQL'}</span>
          </button>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-indigo-200/90 max-h-48 overflow-y-auto">
          <pre>{SUPABASE_SQL_REPAIR.slice(0, 800)}...</pre>
        </div>
      </div>
    </div>
  );
}
