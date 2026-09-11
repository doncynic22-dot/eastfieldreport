/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  fetchSupabaseTeachers
} from '../lib/supabase';
import { globalSyncEngine } from '../lib/globalSync';

interface DatabaseAuditTabProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  teachers: User[];
  setTeachers: React.Dispatch<React.SetStateAction<User[]>>;
  grades?: Grade[];
  attendance?: Attendance[];
  dailyAttendance?: DailyAttendanceRecord[];
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
  attendance = [],
  dailyAttendance = [],
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

  const runAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await auditDatabaseCounts();
      setReport(data);
      setLastAuditTime(new Date());
    } catch (err) {
      console.error('[DatabaseAudit] Error auditing counts:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    runAudit();
    const interval = setInterval(runAudit, 30000); // Background refresh every 30s
    return () => clearInterval(interval);
  }, [runAudit]);

  // Listen to external sync updates
  useEffect(() => {
    const handleSyncEvent = () => {
      runAudit();
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
      // 1. Pull authoritative data from Supabase
      if (onPullFromSupabase) {
        await onPullFromSupabase();
      }

      // 2. Fetch directly from supabase helpers
      const remoteStudents = await fetchSupabaseStudents();
      const remoteTeachers = await fetchSupabaseTeachers();

      if (remoteStudents && Array.isArray(remoteStudents)) {
        pruneDeletedTombstones(remoteStudents, remoteTeachers || undefined);
        setStudents(remoteStudents);
        localStorage.setItem('ea_students', JSON.stringify(remoteStudents));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(remoteStudents));
      }

      if (remoteTeachers && Array.isArray(remoteTeachers)) {
        setTeachers(remoteTeachers);
        localStorage.setItem('ea_teachers', JSON.stringify(remoteTeachers));
      }

      // 3. Trigger global sync manager to notify all tabs and browsers
      await globalSyncEngine.checkVersionAndSync();

      // 4. Re-run audit
      await runAudit();

      const studentCount = remoteStudents?.length ?? students.length;
      const teacherCount = remoteTeachers?.length ?? teachers.length;

      setActionSuccessMessage(`Global realignment complete! All ${studentCount} pupils and ${teacherCount} teachers are reconciled and in sync.`);
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
              onClick={runAudit}
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
                {report?.counts.students.supabase ?? report?.counts.students.local ?? students.length}
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
                        <span className="text-slate-700 text-[11px]">—</span>
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
