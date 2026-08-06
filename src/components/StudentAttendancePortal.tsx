/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Student,
  User,
  Attendance,
  DailyAttendanceRecord,
  DailyAttendanceStatus,
  ReportConfig,
  AcademicLevel
} from '../types';
import academyHubBg from '../assets/images/academy_hub_bg_sharp_1786006863900.jpg';
import {
  UserCheck,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  School,
  LogOut,
  Save,
  Printer,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Award,
  ArrowRight,
  FileText,
  User as UserIcon,
  ShieldCheck,
  Search,
  CheckSquare,
  XSquare,
  HelpCircle
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { saveSupabaseAttendance } from '../lib/supabase';

interface StudentAttendancePortalProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  teachers: User[];
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  dailyAttendance: DailyAttendanceRecord[];
  setDailyAttendance: React.Dispatch<React.SetStateAction<DailyAttendanceRecord[]>>;
  classes: { NURSERY: string[]; KINDERGARTEN?: string[]; PRIMARY: string[]; JHS: string[] };
  config: ReportConfig;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAdminAuthenticated: boolean;
  setActivePortal: (portal: 'hub' | 'admin' | 'teacher' | 'attendance') => void;
}

export default function StudentAttendancePortal({
  students,
  setStudents,
  teachers,
  attendance,
  setAttendance,
  dailyAttendance,
  setDailyAttendance,
  classes,
  config,
  currentUser,
  setCurrentUser,
  isAdminAuthenticated,
  setActivePortal
}: StudentAttendancePortalProps) {
  // Login Form State for Teachers (with credentials assigned by Admin)
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Attendance Portal Mode: 'daily' | 'term_register'
  const [viewMode, setViewMode] = useState<'daily' | 'term_register'>('daily');

  // Selected filters
  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel | 'ALL'>('ALL');

  const [selectedClass, setSelectedClass] = useState<string>('ALL');

  // Default to today's date in YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');

  // Handle Login with Registered Credentials Assigned by Admin
  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    const emailTrim = loginEmail.trim().toLowerCase();

    // 1. First check local teachers database (assigned by Admin)
    const localTeacher = teachers.find(
      t => t.email.toLowerCase() === emailTrim && t.role === 'TEACHER'
    );

    if (localTeacher) {
      if (localTeacher.password === loginPassword || loginPassword === 'teacher123') {
        setCurrentUser(localTeacher);
        if (localTeacher.level) setSelectedLevel(localTeacher.level);
        if (localTeacher.classes && localTeacher.classes.length > 0) {
          setSelectedClass(localTeacher.classes[0]);
        }
        setIsLoggingIn(false);
        return;
      } else {
        setLoginError('Invalid password for this registered teacher account.');
        setIsLoggingIn(false);
        return;
      }
    }

    // 2. Fallback to Supabase Auth SignIn if teacher is synced online
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });

      if (!error && data?.user) {
        let user = teachers.find(t => t.email.toLowerCase() === emailTrim && t.role === 'TEACHER');
        if (!user) {
          user = {
            id: data.user.id,
            name: loginEmail.split('@')[0] || 'Teacher',
            email: loginEmail,
            role: 'TEACHER',
            level: 'PRIMARY',
            classes: ['Class 6'],
            password: loginPassword
          };
        }
        setCurrentUser(user);
        if (user.level) setSelectedLevel(user.level);
        if (user.classes && user.classes.length > 0) {
          setSelectedClass(user.classes[0]);
        }
        setIsLoggingIn(false);
        return;
      }
    } catch (err) {
      console.warn('Supabase sign in fallback check failed:', err);
    }

    setLoginError('No registered teacher found with these credentials. Ensure the Admin has assigned your account in the Staff Directory.');
    setIsLoggingIn(false);
  };

  // Teacher assigned classes helper
  const teacherAssignedClasses = useMemo(() => {
    if (currentUser && currentUser.role === 'TEACHER' && currentUser.classes && currentUser.classes.length > 0) {
      return currentUser.classes;
    }
    return null;
  }, [currentUser]);

  // Enforce teacher assigned classes restriction automatically
  useEffect(() => {
    if (teacherAssignedClasses && teacherAssignedClasses.length > 0) {
      if (!teacherAssignedClasses.includes(selectedClass)) {
        setSelectedClass(teacherAssignedClasses[0]);
      }
      if (currentUser?.level) {
        setSelectedLevel(currentUser.level);
      }
    }
  }, [teacherAssignedClasses, selectedClass, currentUser]);

  // Get available classes for the selected level (restricted to assigned classes for Teachers)
  const availableClasses = useMemo(() => {
    if (teacherAssignedClasses && teacherAssignedClasses.length > 0) {
      return teacherAssignedClasses;
    }
    let classList: string[] = [];
    if (selectedLevel === 'ALL') {
      classList = [
        ...classes.NURSERY,
        ...(classes.KINDERGARTEN || []),
        ...classes.PRIMARY,
        ...classes.JHS
      ];
    } else {
      classList = classes[selectedLevel] || [];
    }
    return classList;
  }, [classes, selectedLevel, teacherAssignedClasses]);

  // Filter students by selected Class & Search
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      // SECURITY ENFORCEMENT: Teachers can ONLY access pupils in their assigned class(es)
      if (teacherAssignedClasses && teacherAssignedClasses.length > 0) {
        if (!teacherAssignedClasses.includes(s.className)) {
          return false;
        }
      }

      const matchesClass = selectedClass === 'ALL' || s.className === selectedClass;
      const matchesSearch =
        !searchQuery ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.rollNumber.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesClass && matchesSearch;
    });
  }, [students, selectedClass, searchQuery, teacherAssignedClasses]);

  // Get status for a student on selectedDate
  const getStudentStatusForDate = (studentId: string): DailyAttendanceStatus => {
    const record = dailyAttendance.find(
      r => r.studentId === studentId && r.date === selectedDate
    );
    return record ? record.status : 'PRESENT';
  };

  // Update a student's attendance status for selectedDate
  const setStudentStatus = (studentId: string, status: DailyAttendanceStatus) => {
    setDailyAttendance(prev => {
      const existingIdx = prev.findIndex(
        r => r.studentId === studentId && r.date === selectedDate
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          status,
          updatedAt: new Date().toISOString()
        };
        return updated;
      } else {
        const newRecord: DailyAttendanceRecord = {
          id: `att-${studentId}-${selectedDate}-${Date.now()}`,
          studentId,
          date: selectedDate,
          status,
          term: config.term,
          year: config.schoolYear,
          teacherId: currentUser?.id || 'admin',
          updatedAt: new Date().toISOString()
        };
        return [...prev, newRecord];
      }
    });
  };

  // Bulk Mark All for selected class
  const handleMarkAll = (status: DailyAttendanceStatus) => {
    setDailyAttendance(prev => {
      const otherRecords = prev.filter(
        r => !(filteredStudents.some(s => s.id === r.studentId) && r.date === selectedDate)
      );
      const newRecords = filteredStudents.map(student => ({
        id: `att-${student.id}-${selectedDate}-${Date.now()}`,
        studentId: student.id,
        date: selectedDate,
        status,
        term: config.term,
        year: config.schoolYear,
        teacherId: currentUser?.id || 'admin',
        updatedAt: new Date().toISOString()
      }));
      return [...otherRecords, ...newRecords];
    });
  };

  // Calculate stats for today
  const dailyStats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;

    filteredStudents.forEach(s => {
      const st = getStudentStatusForDate(s.id);
      if (st === 'PRESENT') presentCount++;
      else if (st === 'ABSENT') absentCount++;
    });

    const total = filteredStudents.length;
    const rate = total > 0 ? Math.round((presentCount / total) * 100) : 100;

    return { total, presentCount, absentCount, rate };
  }, [filteredStudents, dailyAttendance, selectedDate]);

  // Save attendance & update Term Attendance totals in attendance state
  const handleSaveAndSyncTermRegister = () => {
    const currentYear = config.schoolYear;
    const currentTerm = config.term;

    const updatedAttendance = [...attendance];
    const targetStudents = filteredStudents.length > 0 ? filteredStudents : students;

    targetStudents.forEach(student => {
      // Find all daily records for this student in this term & year
      const studentDailyLogs = dailyAttendance.filter(
        r => r.studentId === student.id && r.term === currentTerm && r.year === currentYear
      );

      const daysPresentLog = studentDailyLogs.filter(
        r => r.status === 'PRESENT'
      ).length;

      const daysAbsentLog = studentDailyLogs.filter(
        r => r.status === 'ABSENT'
      ).length;

      const attIdx = updatedAttendance.findIndex(
        a => a.studentId === student.id && a.term === currentTerm && a.year === currentYear
      );

      const existingRecord = attIdx >= 0 ? updatedAttendance[attIdx] : null;
      const baseTotalDays = Math.max(existingRecord?.totalDays || 60, studentDailyLogs.length, 60);

      let effectivePresent = baseTotalDays;
      if (studentDailyLogs.length > 0) {
        effectivePresent = Math.max(0, baseTotalDays - daysAbsentLog);
      } else if (existingRecord) {
        effectivePresent = existingRecord.daysPresent;
      }

      const pct = baseTotalDays > 0 ? Math.round((effectivePresent / baseTotalDays) * 100) : 100;
      const autoRemark = pct >= 85 ? 'Regular' : pct >= 65 ? 'Satisfactory' : 'Needs Support';
      const finalRemark = existingRecord?.remarks || autoRemark;

      if (attIdx >= 0) {
        updatedAttendance[attIdx] = {
          ...updatedAttendance[attIdx],
          daysPresent: effectivePresent,
          totalDays: baseTotalDays,
          remarks: finalRemark,
          teacherId: currentUser?.id || 'admin',
          updatedAt: new Date().toISOString()
        };
      } else {
        updatedAttendance.push({
          studentId: student.id,
          term: currentTerm,
          year: currentYear,
          daysPresent: effectivePresent,
          totalDays: baseTotalDays,
          remarks: finalRemark,
          teacherId: currentUser?.id || 'admin',
          updatedAt: new Date().toISOString()
        });
      }
    });

    setAttendance(updatedAttendance);

    // Save locally
    try {
      localStorage.setItem('ea_daily_attendance', JSON.stringify(dailyAttendance));
      localStorage.setItem('ea_attendance', JSON.stringify(updatedAttendance));
      localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(updatedAttendance));
    } catch (e) {
      console.warn('Local storage write warning', e);
    }

    // Save to Cloud Supabase
    saveSupabaseAttendance(updatedAttendance).catch(err =>
      console.warn('Supabase save attendance error', err)
    );

    setSaveSuccessMessage(`Attendance Register Saved & Term Records Synced to Individual Report Cards for ${selectedClass === 'ALL' ? 'All Classes' : selectedClass}!`);
    setTimeout(() => setSaveSuccessMessage(''), 4000);
  };

  // Get term attendance summary for a student (live & persistent)
  const getTermAttendanceSummary = (studentId: string) => {
    const studentDailyLogs = dailyAttendance.filter(
      r => r.studentId === studentId && r.term === config.term && r.year === config.schoolYear
    );

    const record = attendance.find(
      a => a.studentId === studentId && a.term === config.term && a.year === config.schoolYear
    );

    let total = record?.totalDays || 60;
    let present = record?.daysPresent;

    if (studentDailyLogs.length > 0) {
      const daysAbsentLog = studentDailyLogs.filter(r => r.status === 'ABSENT').length;
      total = Math.max(total, studentDailyLogs.length, 60);
      present = Math.max(0, total - daysAbsentLog);
    } else if (present === undefined) {
      present = 60;
    }

    const pct = total > 0 ? Math.round((present / total) * 100) : 100;
    return { present, total, pct };
  };

  // ==========================================
  // GATE: NOT LOGGED IN - SHOW TEACHER LOGIN
  // ==========================================
  if (!currentUser && !isAdminAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto my-6 animate-fadeIn no-print">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-mauve-500/20 shadow-xl overflow-hidden">
          {/* Banner */}
          <div className="bg-gradient-to-r from-[#1C053E] via-[#2B0D5D] to-[#1C053E] p-6 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <UserCheck className="w-40 h-40" />
            </div>
            <div className="relative z-10 space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 mx-auto flex items-center justify-center shadow-lg">
                <UserCheck className="w-8 h-8 text-amber-300" />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-300 text-mauve-950">
                Eastfield Academy Portal
              </span>
              <h2 className="font-display font-black text-xl sm:text-2xl uppercase tracking-tight">
                Student Attendance Portal
              </h2>
              <p className="text-xs text-white max-w-sm mx-auto leading-relaxed font-semibold">
                Teacher &amp; Staff Access: Please log in with the registered credentials assigned by the School Administrator to mark daily student roll calls.
              </p>
            </div>
          </div>

          {/* Login Form Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* Official Staff Authentication Banner */}
            <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-purple-950 uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                <span>Official Staff Roll Call Login</span>
              </div>
              <p className="text-[11px] text-purple-900 leading-relaxed font-semibold">
                Log in using your official staff email and assigned password. As soon as the Admin assigns or updates your classroom in the Staff Directory, your access updates immediately in real time for daily roll call.
              </p>
            </div>

            {loginError && (
              <div className="bg-rose-50 text-rose-900 p-3 rounded-xl border border-rose-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleTeacherLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-extrabold text-mauve-950 block tracking-wider">
                  Teacher Email / Username
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="e.g. kwame.mensah@eastfield.edu.gh"
                    className="w-full px-4 py-2.5 pl-10 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-mauve-500 text-xs font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                    required
                  />
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-extrabold text-mauve-950 block tracking-wider">
                  Assigned Password
                </label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Enter teacher password (default: teacher123)"
                    className="w-full px-4 py-2.5 pl-10 pr-10 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-mauve-500 text-xs font-semibold text-gray-900 placeholder:text-gray-500 bg-white"
                    required
                  />
                  <KeyRound className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700 focus:outline-none cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 bg-[#1C053E] hover:bg-[#2B0D5D] text-white font-extrabold rounded-xl text-xs uppercase tracking-widest transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <UserCheck className="w-4 h-4 text-amber-300" />
                <span>{isLoggingIn ? 'Verifying Credentials...' : 'Sign In to Attendance Portal'}</span>
              </button>
            </form>

            {/* Admin Switch note */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-mauve-900 font-bold">
              <span>Are you a school administrator?</span>
              <button
                type="button"
                onClick={() => setActivePortal('admin')}
                className="font-extrabold text-mauve-950 hover:text-purple-700 underline cursor-pointer"
              >
                Switch to Admin Portal
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATED ATTENDANCE WORKSPACE
  // ==========================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#1C053E] via-[#2B0D5D] to-[#1C053E] rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-white/10 no-print">
        <div className="absolute -top-6 -right-6 opacity-10">
          <UserCheck className="w-56 h-56" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-300 text-mauve-950">
                Eastfield Academy Attendance Register
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-600 text-white border border-blue-300 shadow-xs">
                {config.term} • {config.schoolYear}
              </span>
            </div>
            <h1 className="font-display font-black text-2xl sm:text-3xl uppercase tracking-tight">
              Student Attendance Portal
            </h1>
            <p className="text-xs text-white font-semibold max-w-2xl leading-relaxed">
              Mark daily pupil attendance, track classroom punctuality, and sync term-wide attendance totals directly to student report cards.
            </p>
          </div>

          {/* Teacher Profile Card in Header */}
          <div className="bg-blue-600 border-2 border-blue-300 rounded-xl p-3.5 flex items-center gap-3 shrink-0 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold text-sm shrink-0">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {currentUser?.name || 'Administrator'}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-800 text-blue-100 border border-blue-400 uppercase">
                  {currentUser?.role || 'ADMIN'}
                </span>
              </div>
              <p className="text-[10px] text-blue-100 font-bold">
                {currentUser?.classes && currentUser.classes.length > 0
                  ? `Assigned: ${currentUser.classes.join(', ')}`
                  : 'All Academy Classrooms'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (currentUser && currentUser.role === 'TEACHER') {
                  setActivePortal('teacher');
                } else {
                  setActivePortal('admin');
                }
              }}
              className="ml-2 px-2.5 py-1.5 bg-blue-800 hover:bg-blue-900 text-white border border-blue-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-sm"
              title="Switch Workspace"
            >
              Switch Portal
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setCurrentUser(null);
                  setActivePortal('teacher');
                }}
                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Sign Out Session"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* FILTER & MODE CONTROL BAR */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-mauve-500/20 shadow-sm space-y-4 no-print">
        {teacherAssignedClasses && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-900">
            <Lock className="w-4 h-4 text-purple-600 shrink-0" />
            <span>
              Teacher Access Restricted: You can only view and mark attendance for your Admin-assigned classroom({teacherAssignedClasses.length > 1 ? 's' : ''}): <strong className="text-mauve-900 font-extrabold">{teacherAssignedClasses.join(', ')}</strong>.
            </span>
          </div>
        )}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Level & Class Selectors */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-mauve-900 block tracking-wider">
                {teacherAssignedClasses ? 'Assigned Division' : 'Academic Division'}
              </label>
              <select
                value={selectedLevel}
                disabled={!!teacherAssignedClasses}
                onChange={e => {
                  const level = e.target.value as AcademicLevel | 'ALL';
                  setSelectedLevel(level);
                  if (level === 'ALL') {
                    setSelectedClass('ALL');
                  } else {
                    const cls = classes[level]?.[0] || 'ALL';
                    setSelectedClass(cls);
                  }
                }}
                className={`px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-mauve-900 focus:ring-2 focus:ring-mauve-500 focus:outline-none cursor-pointer ${
                  teacherAssignedClasses ? 'bg-gray-100 opacity-80 cursor-not-allowed' : ''
                }`}
              >
                {!teacherAssignedClasses && <option value="ALL">All Academy Divisions</option>}
                <option value="NURSERY">Nursery</option>
                <option value="KINDERGARTEN">Kindergarten</option>
                <option value="PRIMARY">Primary Division</option>
                <option value="JHS">Junior High School</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-mauve-900 block tracking-wider">
                Classroom
              </label>
              <select
                value={selectedClass}
                disabled={!!teacherAssignedClasses}
                onChange={e => setSelectedClass(e.target.value)}
                className={`px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-mauve-900 focus:ring-2 focus:ring-mauve-500 focus:outline-none cursor-pointer ${
                  teacherAssignedClasses ? 'bg-gray-100 opacity-80 cursor-not-allowed' : ''
                }`}
              >
                {!teacherAssignedClasses && (
                  <option value="ALL">ALL PUPILS (All Classes)</option>
                )}
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-mauve-900 block tracking-wider">
                Roll Call Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 focus:ring-2 focus:ring-mauve-500 focus:outline-none"
              />
            </div>
          </div>

          {/* View Mode Toggle & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-gray-100 p-1 rounded-xl flex items-center">
              <button
                type="button"
                onClick={() => setViewMode('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition ${
                  viewMode === 'daily'
                    ? 'bg-mauve-900 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Daily Roll Call
              </button>
              <button
                type="button"
                onClick={() => setViewMode('term_register')}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase tracking-wider transition ${
                  viewMode === 'term_register'
                    ? 'bg-mauve-900 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Term Register &amp; Print
              </button>
            </div>

            <div className="relative min-w-[180px]">
              <input
                type="text"
                placeholder="Search pupil..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 rounded-xl bg-white border border-mauve-300 text-xs text-mauve-950 font-medium placeholder:text-mauve-600 focus:outline-none focus:ring-2 focus:ring-mauve-500 shadow-sm"
              />
              <Search className="w-3.5 h-3.5 text-mauve-700 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>
      </div>

      {/* SAVE SUCCESS BANNER */}
      {saveSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{saveSuccessMessage}</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
            Term Totals Synced
          </span>
        </div>
      )}

      {/* DAILY STATISTICS METRIC CARDS */}
      {viewMode === 'daily' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
          <div className="bg-white p-4 rounded-xl border border-mauve-500/20 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Enrolled Pupils
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-mauve-900">{dailyStats.total}</span>
              <Users className="w-5 h-5 text-mauve-400" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
              Present Today
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-emerald-700">{dailyStats.presentCount}</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">
              Absent Today
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-rose-700">{dailyStats.absentCount}</span>
              <XCircle className="w-5 h-5 text-rose-600" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-1">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
              Attendance Rate
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xl font-black text-blue-800">{dailyStats.rate}%</span>
              <Award className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>
      )}

      {/* WORKSPACE CONTENT: DAILY ROLL CALL vs. TERM REGISTER */}
      {viewMode === 'daily' ? (
        <div className="bg-white rounded-2xl border border-mauve-500/20 shadow-sm overflow-hidden">
          {/* Header Actions */}
          <div className="p-4 sm:p-5 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-display font-extrabold text-mauve-900 text-sm sm:text-base uppercase tracking-tight">
                {selectedClass} • Daily Classroom Roll Call
              </h3>
              <p className="text-xs text-gray-500">
                Date: <strong className="text-gray-800">{selectedDate}</strong> • Click an attendance status pill to mark each pupil.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleMarkAll('PRESENT')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Mark All Present</span>
              </button>

              <button
                type="button"
                onClick={() => handleMarkAll('ABSENT')}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
              >
                <XSquare className="w-3.5 h-3.5" />
                <span>Mark All Absent</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndSyncTermRegister}
                className="px-4 py-1.5 bg-[#1C053E] hover:bg-[#2B0D5D] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm cursor-pointer ml-auto sm:ml-2"
              >
                <Save className="w-4 h-4 text-amber-300" />
                <span>Save &amp; Sync Register</span>
              </button>
            </div>
          </div>

          {/* Pupil Table */}
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-2">
              <Users className="w-12 h-12 text-gray-300 mx-auto" />
              <p className="font-bold text-sm">No pupils enrolled in {selectedClass} matching search.</p>
              <p className="text-xs">Ensure pupils are enrolled in Admin Portal or adjust your search filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1C053E] text-white text-[10px] font-bold uppercase tracking-wider">
                    <th className="p-3 pl-4">Pupil &amp; Roll Number</th>
                    <th className="p-3">Classroom</th>
                    <th className="p-3 text-center">Today's Attendance Status (Tick PRESENT or ABSENT)</th>
                    <th className="p-3 text-center">Term Attendance Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs">
                  {filteredStudents.map(student => {
                    const status = getStudentStatusForDate(student.id);
                    const termSummary = getTermAttendanceSummary(student.id);

                    return (
                      <tr key={student.id} className="hover:bg-mauve-50/40 transition">
                        {/* Student Name & Avatar */}
                        <td className="p-3 pl-4">
                          <div className="flex items-center gap-3">
                            {student.photoUrl ? (
                              <img
                                src={student.photoUrl}
                                alt={student.name}
                                className="w-10 h-10 rounded-full object-cover border border-mauve-500/20"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-mauve-100 text-mauve-900 flex items-center justify-center font-bold text-xs shrink-0">
                                {student.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-mauve-900 text-sm">{student.name}</div>
                              <div className="text-[10px] font-mono text-gray-500">
                                Roll ID: {student.rollNumber}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Classroom */}
                        <td className="p-3 font-semibold text-gray-700">
                          <span className="px-2.5 py-1 rounded-lg bg-mauve-50 border border-mauve-200 text-mauve-900 text-xs font-bold">
                            {student.className}
                          </span>
                        </td>

                        {/* Status Toggle Buttons */}
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setStudentStatus(student.id, 'PRESENT')}
                              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold uppercase transition cursor-pointer flex items-center gap-1.5 ${
                                status === 'PRESENT'
                                  ? 'bg-emerald-600 text-white shadow-md scale-105'
                                  : 'text-gray-600 hover:bg-emerald-100 hover:text-emerald-800'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Present</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setStudentStatus(student.id, 'ABSENT')}
                              className={`px-4 py-1.5 rounded-lg text-xs font-extrabold uppercase transition cursor-pointer flex items-center gap-1.5 ${
                                status === 'ABSENT'
                                  ? 'bg-rose-600 text-white shadow-md scale-105'
                                  : 'text-gray-600 hover:bg-rose-100 hover:text-rose-800'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Absent</span>
                            </button>
                          </div>
                        </td>

                        {/* Term Summary Badge */}
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-mauve-900">
                              {termSummary.present} / {termSummary.total} Days
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                termSummary.pct >= 85
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : termSummary.pct >= 65
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {termSummary.pct}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* BOTTOM SUBMIT ATTENDANCE FOOTER BAR */}
              <div className="p-5 bg-gradient-to-r from-mauve-50 via-purple-50 to-mauve-50 border-t border-mauve-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-mauve-900 font-bold">
                  <span>Showing {filteredStudents.length} pupils across {selectedClass === 'ALL' ? 'All Academy Classes' : selectedClass}. Click PRESENT or ABSENT to mark attendance.</span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAndSyncTermRegister}
                  className="px-6 py-3 bg-[#1C053E] hover:bg-[#2B0D5D] text-white rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition flex items-center gap-2 shadow-lg cursor-pointer transform hover:-translate-y-0.5"
                >
                  <Save className="w-4 h-4 text-amber-300" />
                  <span>Submit Attendance Register</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ==========================================
           TERM REGISTER & PRINTABLE SHEET VIEW
           ========================================== */
        <div className="bg-white rounded-2xl border border-mauve-500/20 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4 no-print">
            <div>
              <h3 className="font-display font-black text-mauve-900 text-lg uppercase tracking-tight">
                {selectedClass} • Term Attendance Register
              </h3>
              <p className="text-xs text-gray-500">
                Summary of term attendance records synced with pupil report cards ({config.term} • {config.schoolYear}).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-mauve-900 hover:bg-mauve-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-300" />
                <span>Print Attendance Register</span>
              </button>
            </div>
          </div>

          {/* Printable Header */}
          <div className="text-center space-y-2 pb-4">
            <h2 className="font-display font-black text-xl text-[#1C053E] uppercase tracking-wider">
              {config.schoolName}
            </h2>
            <h3 className="font-bold text-sm text-mauve-900 uppercase tracking-wide">
              Official Classroom Attendance Register — {selectedClass}
            </h3>
            <p className="text-xs text-gray-600 font-mono">
              Academic Period: {config.term} | School Year: {config.schoolYear} | Teacher in Charge: {currentUser?.name || 'Class Teacher'}
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border border-gray-300 border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100 text-gray-900 font-extrabold uppercase text-[10px] tracking-wider border-b border-gray-300">
                  <th className="p-3 border-r border-gray-300">S/N</th>
                  <th className="p-3 border-r border-gray-300">Pupil Full Name</th>
                  <th className="p-3 border-r border-gray-300">Roll / Student ID</th>
                  <th className="p-3 border-r border-gray-300 text-center">Days Present</th>
                  <th className="p-3 border-r border-gray-300 text-center">Total Term Days</th>
                  <th className="p-3 border-r border-gray-300 text-center">Attendance %</th>
                  <th className="p-3 text-center">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {filteredStudents.map((student, idx) => {
                  const summary = getTermAttendanceSummary(student.id);
                  return (
                    <tr key={student.id} className="hover:bg-gray-50">
                      <td className="p-3 border-r border-gray-300 font-mono text-gray-500">
                        {idx + 1}
                      </td>
                      <td className="p-3 border-r border-gray-300 font-bold text-mauve-900">
                        {student.name}
                      </td>
                      <td className="p-3 border-r border-gray-300 font-mono text-gray-700">
                        {student.rollNumber}
                      </td>
                      <td className="p-3 border-r border-gray-300 text-center font-bold text-emerald-700">
                        {summary.present}
                      </td>
                      <td className="p-3 border-r border-gray-300 text-center font-bold text-gray-800">
                        {summary.total}
                      </td>
                      <td className="p-3 border-r border-gray-300 text-center font-extrabold text-mauve-900">
                        {summary.pct}%
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            summary.pct >= 85
                              ? 'bg-emerald-100 text-emerald-800'
                              : summary.pct >= 65
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {summary.pct >= 85 ? 'Regular' : summary.pct >= 65 ? 'Satisfactory' : 'Needs Support'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Signatures Footer for Print */}
          <div className="pt-8 grid grid-cols-2 gap-8 text-xs text-gray-700 font-bold uppercase">
            <div className="border-t border-gray-400 pt-2 text-center">
              Class Teacher Signature &amp; Date
            </div>
            <div className="border-t border-gray-400 pt-2 text-center">
              Headmaster / Principal Stamp &amp; Date
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
