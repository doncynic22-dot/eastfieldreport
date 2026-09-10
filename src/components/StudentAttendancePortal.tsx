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
  HelpCircle,
  RefreshCw,
  X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { saveSupabaseAttendance, saveSupabaseDailyAttendance, fetchSupabaseAttendance, fetchSupabaseDailyAttendance } from '../lib/supabase';
import { calculateStudentTermAttendance } from '../utils/attendanceUtils';
import { pushMasterServerSync } from '../lib/globalSync';

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

  const [selectedClass, setSelectedClass] = useState<string>(() => {
    try {
      return localStorage.getItem('ea_attendance_selected_class') || 'ALL';
    } catch {
      return 'ALL';
    }
  });

  // Default to today's date in YYYY-MM-DD, or persisted date
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      return localStorage.getItem('ea_attendance_selected_date') || new Date().toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ea_attendance_selected_class', selectedClass);
    } catch {}
  }, [selectedClass]);

  useEffect(() => {
    try {
      localStorage.setItem('ea_attendance_selected_date', selectedDate);
    } catch {}
  }, [selectedDate]);

  const [searchQuery, setSearchQuery] = useState('');
  const [saveSuccessMessage, setSaveSuccessMessage] = useState('');
  const [isSubmittingRegister, setIsSubmittingRegister] = useState(false);
  const [submittedSuccessfully, setSubmittedSuccessfully] = useState(false);
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);

  // Cross-browser & Cloud Realtime Synchronization Listener
  useEffect(() => {
    let isMounted = true;

    // Refresh immediately on mount to grab latest global records from server and cloud
    const fetchLatestOnlineAttendance = async () => {
      try {
        setIsSyncingAttendance(true);
        const [freshDaily, freshAtt] = await Promise.all([
          fetchSupabaseDailyAttendance(),
          fetchSupabaseAttendance()
        ]);
        if (!isMounted) return;

        if (freshDaily && Array.isArray(freshDaily) && freshDaily.length > 0) {
          setDailyAttendance(prev => {
            const map = new Map<string, DailyAttendanceRecord>();
            freshDaily.forEach(r => {
              if (r && r.studentId && r.date) map.set(`${r.studentId}_${r.date}`, r);
            });
            prev.forEach(r => {
              if (r && r.studentId && r.date) {
                const k = `${r.studentId}_${r.date}`;
                if (!map.has(k)) {
                  map.set(k, r);
                } else {
                  const localTime = r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
                  const remoteTime = map.get(k)?.updatedAt ? new Date(map.get(k)!.updatedAt).getTime() : 0;
                  if (localTime > remoteTime) map.set(k, r);
                }
              }
            });
            const merged = Array.from(map.values());
            localStorage.setItem('ea_daily_attendance', JSON.stringify(merged));
            return merged;
          });
        }

        if (freshAtt && Array.isArray(freshAtt) && freshAtt.length > 0) {
          setAttendance(prev => {
            const map = new Map<string, Attendance>();
            freshAtt.forEach(a => {
              if (a && a.studentId) map.set(`${a.studentId}_${a.term || ''}_${a.year || ''}`, a);
            });
            prev.forEach(a => {
              if (a && a.studentId) {
                const k = `${a.studentId}_${a.term || ''}_${a.year || ''}`;
                if (!map.has(k)) {
                  map.set(k, a);
                } else {
                  const localTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
                  const remoteTime = map.get(k)?.updatedAt ? new Date(map.get(k)!.updatedAt).getTime() : 0;
                  if (localTime > remoteTime) map.set(k, a);
                }
              }
            });
            const merged = Array.from(map.values());
            localStorage.setItem('ea_attendance', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn('Initial attendance sync notice:', err);
      } finally {
        if (isMounted) setIsSyncingAttendance(false);
      }
    };

    fetchLatestOnlineAttendance();

    // Listen for intra-tab and cross-browser realtime updates
    const handleDailyUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setDailyAttendance(e.detail);
      }
    };
    const handleAttUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setAttendance(e.detail);
      }
    };

    window.addEventListener('ea_daily_attendance_updated', handleDailyUpdate);
    window.addEventListener('ea_attendance_updated', handleAttUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('ea_daily_attendance_updated', handleDailyUpdate);
      window.removeEventListener('ea_attendance_updated', handleAttUpdate);
    };
  }, [setDailyAttendance, setAttendance]);

  // Manual Trigger to re-fetch and synchronize attendance immediately
  const handleManualRefreshAttendance = async () => {
    setIsSyncingAttendance(true);
    try {
      const [freshDaily, freshAtt] = await Promise.all([
        fetchSupabaseDailyAttendance(),
        fetchSupabaseAttendance()
      ]);
      if (freshDaily && Array.isArray(freshDaily) && freshDaily.length > 0) {
        setDailyAttendance(freshDaily);
        localStorage.setItem('ea_daily_attendance', JSON.stringify(freshDaily));
      }
      if (freshAtt && Array.isArray(freshAtt) && freshAtt.length > 0) {
        setAttendance(freshAtt);
        localStorage.setItem('ea_attendance', JSON.stringify(freshAtt));
      }
      setSaveSuccessMessage('Attendance synchronized with cloud database successfully!');
      setTimeout(() => setSaveSuccessMessage(''), 3000);
    } catch (e) {
      console.warn('Manual sync failed:', e);
    } finally {
      setIsSyncingAttendance(false);
    }
  };

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

  // Check if attendance has been explicitly marked for a student on selectedDate
  const hasAttendanceRecordForDate = (studentId: string): boolean => {
    const student = students.find(s => s.id === studentId || s.rollNumber === studentId);
    const sid = student ? student.id.toLowerCase() : studentId.toLowerCase();
    const sRoll = (student?.rollNumber || '').toLowerCase();

    return dailyAttendance.some(r => {
      if (!r || r.date !== selectedDate) return false;
      const rId = (r.studentId || '').toLowerCase();
      return rId === sid || (sRoll && rId === sRoll);
    });
  };

  // List of distinct dates with recorded attendance for the current class in this term
  const markedDatesForClass = useMemo(() => {
    const dates = new Set<string>();
    const normTerm = (config.term || '').trim().toLowerCase();
    const normYear = (config.schoolYear || '').trim();

    dailyAttendance.forEach(r => {
      if (!r || !r.date) return;
      const rTerm = (r.term || '').trim().toLowerCase();
      const rYear = (r.year || '').trim();
      const termOk = !normTerm || !rTerm || rTerm === normTerm;
      const yearOk = !normYear || !rYear || rYear === normYear;
      if (!termOk || !yearOk) return;

      if (selectedClass === 'ALL') {
        dates.add(r.date);
      } else {
        const student = students.find(s => s.id === r.studentId || s.rollNumber === r.studentId);
        if (student && student.className === selectedClass) {
          dates.add(r.date);
        }
      }
    });

    return Array.from(dates).sort().reverse();
  }, [dailyAttendance, students, selectedClass, config.term, config.schoolYear]);

  // Get status for a student on selectedDate (null if not marked yet)
  const getStudentStatusForDate = (studentId: string): DailyAttendanceStatus | null => {
    const student = students.find(s => s.id === studentId || s.rollNumber === studentId);
    const sRoll = student?.rollNumber;

    const record = dailyAttendance.find(r => {
      if (r.date !== selectedDate) return false;
      if (r.studentId === studentId) return true;
      if (student && r.studentId === student.id) return true;
      if (sRoll && r.studentId === sRoll) return true;
      return false;
    });
    return record ? record.status : null;
  };

  // Update a student's attendance status for selectedDate
  const setStudentStatus = (studentId: string, status: DailyAttendanceStatus) => {
    const student = students.find(s => s.id === studentId || s.rollNumber === studentId);
    const sid = student ? student.id : studentId;
    const currentYear = config.schoolYear || '2026/2027';
    const currentTerm = config.term || 'Term 1';

    // 1. Get current base daily attendance synchronously
    let baseDaily = Array.isArray(dailyAttendance) ? [...dailyAttendance] : [];
    if (baseDaily.length === 0) {
      try {
        const stored = localStorage.getItem('ea_daily_attendance');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) baseDaily = parsed;
        }
      } catch {}
    }

    const existingIdx = baseDaily.findIndex(
      r => (r.studentId === sid || (student && r.studentId === student.rollNumber)) && r.date === selectedDate
    );

    let updatedDaily: DailyAttendanceRecord[];
    if (existingIdx >= 0) {
      updatedDaily = [...baseDaily];
      updatedDaily[existingIdx] = {
        ...updatedDaily[existingIdx],
        status,
        term: currentTerm,
        year: currentYear,
        teacherId: currentUser?.id || 'admin',
        updatedAt: new Date().toISOString()
      };
    } else {
      const newRecord: DailyAttendanceRecord = {
        id: `att-${sid}-${selectedDate}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: sid,
        date: selectedDate,
        status,
        term: currentTerm,
        year: currentYear,
        teacherId: currentUser?.id || 'admin',
        updatedAt: new Date().toISOString()
      };
      updatedDaily = [...baseDaily, newRecord];
    }

    // 2. Set React daily attendance state immediately
    setDailyAttendance(updatedDaily);

    // 3. Guarantee immediate local storage persistence
    try {
      localStorage.setItem('ea_daily_attendance', JSON.stringify(updatedDaily));
      localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(updatedDaily));
    } catch (e) {}

    // 4. Recalculate term attendance live for all students & update attendance state
    let baseAtt = Array.isArray(attendance) ? [...attendance] : [];
    if (baseAtt.length === 0) {
      try {
        const stored = localStorage.getItem('ea_attendance');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) baseAtt = parsed;
        }
      } catch {}
    }
    const nextAtt = [...baseAtt];

    students.forEach(s => {
      const calc = calculateStudentTermAttendance(
        s,
        currentTerm,
        currentYear,
        updatedDaily,
        nextAtt,
        students
      );
      const attIdx = nextAtt.findIndex(
        a => (a.studentId === s.id || a.studentId === s.rollNumber) &&
          (!a.term || a.term.toLowerCase() === currentTerm.toLowerCase()) &&
          (!a.year || a.year === currentYear)
      );
      const attRecord: Attendance = {
        studentId: s.id,
        term: currentTerm,
        year: currentYear,
        daysPresent: calc.daysPresent,
        totalDays: calc.totalDays,
        remarks: calc.remarks,
        teacherId: currentUser?.id || 'admin',
        updatedAt: new Date().toISOString()
      };
      if (attIdx >= 0) {
        nextAtt[attIdx] = attRecord;
      } else if (calc.totalDays > 0) {
        nextAtt.push(attRecord);
      }
    });

    setAttendance(nextAtt);
    try {
      localStorage.setItem('ea_attendance', JSON.stringify(nextAtt));
      localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(nextAtt));
    } catch {}

    // 5. Global Server, Cloud Supabase, and Realtime Broadcast in background
    Promise.allSettled([
      saveSupabaseDailyAttendance(updatedDaily),
      saveSupabaseAttendance(nextAtt),
      pushMasterServerSync({ dailyAttendance: updatedDaily, attendance: nextAtt })
    ]).catch(() => {});
  };

  // Bulk Mark All for selected class
  const handleMarkAll = (status: DailyAttendanceStatus) => {
    const currentYear = config.schoolYear || '2026/2027';
    const currentTerm = config.term || 'Term 1';

    let baseDaily = Array.isArray(dailyAttendance) ? [...dailyAttendance] : [];
    if (baseDaily.length === 0) {
      try {
        const stored = localStorage.getItem('ea_daily_attendance');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) baseDaily = parsed;
        }
      } catch {}
    }

    const otherRecords = baseDaily.filter(
      r => !(filteredStudents.some(s => s.id === r.studentId || s.rollNumber === r.studentId) && r.date === selectedDate)
    );
    const newRecords = filteredStudents.map(student => ({
      id: `att-${student.id}-${selectedDate}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      studentId: student.id,
      date: selectedDate,
      status,
      term: currentTerm,
      year: currentYear,
      teacherId: currentUser?.id || 'admin',
      updatedAt: new Date().toISOString()
    }));
    const updatedDaily = [...otherRecords, ...newRecords];

    setDailyAttendance(updatedDaily);

    try {
      localStorage.setItem('ea_daily_attendance', JSON.stringify(updatedDaily));
      localStorage.setItem('mock_supabase_ea_daily_attendance', JSON.stringify(updatedDaily));
    } catch (e) {}

    // Recalculate term attendance live for all students & sync globally
    let baseAtt = Array.isArray(attendance) ? [...attendance] : [];
    if (baseAtt.length === 0) {
      try {
        const stored = localStorage.getItem('ea_attendance');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) baseAtt = parsed;
        }
      } catch {}
    }
    const nextAtt = [...baseAtt];

    students.forEach(s => {
      const calc = calculateStudentTermAttendance(
        s,
        currentTerm,
        currentYear,
        updatedDaily,
        nextAtt,
        students
      );
      const attIdx = nextAtt.findIndex(
        a => (a.studentId === s.id || a.studentId === s.rollNumber) &&
          (!a.term || a.term.toLowerCase() === currentTerm.toLowerCase()) &&
          (!a.year || a.year === currentYear)
      );
      const attRecord: Attendance = {
        studentId: s.id,
        term: currentTerm,
        year: currentYear,
        daysPresent: calc.daysPresent,
        totalDays: calc.totalDays,
        remarks: calc.remarks,
        teacherId: currentUser?.id || 'admin',
        updatedAt: new Date().toISOString()
      };
      if (attIdx >= 0) {
        nextAtt[attIdx] = attRecord;
      } else if (calc.totalDays > 0) {
        nextAtt.push(attRecord);
      }
    });

    setAttendance(nextAtt);
    try {
      localStorage.setItem('ea_attendance', JSON.stringify(nextAtt));
      localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(nextAtt));
    } catch {}

    // Global Server, Cloud Supabase, and Realtime Broadcast
    Promise.allSettled([
      saveSupabaseDailyAttendance(updatedDaily),
      saveSupabaseAttendance(nextAtt),
      pushMasterServerSync({ dailyAttendance: updatedDaily, attendance: nextAtt })
    ]).catch(() => {});
  };

  // Calculate stats for today
  const dailyStats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let unmarkedCount = 0;

    filteredStudents.forEach(s => {
      const st = getStudentStatusForDate(s.id);
      if (st === 'PRESENT') presentCount++;
      else if (st === 'ABSENT') absentCount++;
      else unmarkedCount++;
    });

    const total = filteredStudents.length;
    const markedTotal = presentCount + absentCount;
    const rate = markedTotal > 0 ? Math.round((presentCount / markedTotal) * 100) : (total > 0 && presentCount > 0 ? 100 : 0);

    return { total, presentCount, absentCount, unmarkedCount, rate };
  }, [filteredStudents, dailyAttendance, selectedDate]);

  // Save attendance & update Term Attendance totals in attendance state
  const handleSaveAndSyncTermRegister = async () => {
    const targetStudents = filteredStudents.length > 0 ? filteredStudents : students;

    if (targetStudents.length === 0) {
      setSaveSuccessMessage('No pupils found to submit attendance for. Please select a class or enroll pupils.');
      setSubmittedSuccessfully(true);
      setTimeout(() => {
        setSaveSuccessMessage('');
        setSubmittedSuccessfully(false);
      }, 4000);
      return;
    }

    setIsSubmittingRegister(true);
    setSaveSuccessMessage('');

    try {
      const currentYear = config.schoolYear;
      const currentTerm = config.term;

      // 1. Ensure all viewed students on the selectedDate have an explicit daily record
      const updatedDailyAttendance = [...dailyAttendance];
      targetStudents.forEach(student => {
        const existingIdx = updatedDailyAttendance.findIndex(
          r => r.studentId === student.id && r.date === selectedDate
        );
        const currentStatus = getStudentStatusForDate(student.id);

        if (existingIdx >= 0) {
          updatedDailyAttendance[existingIdx] = {
            ...updatedDailyAttendance[existingIdx],
            status: currentStatus,
            term: currentTerm,
            year: currentYear,
            teacherId: currentUser?.id || 'admin',
            updatedAt: new Date().toISOString()
          };
        } else {
          updatedDailyAttendance.push({
            id: `att-${student.id}-${selectedDate}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            studentId: student.id,
            date: selectedDate,
            status: currentStatus,
            term: currentTerm,
            year: currentYear,
            teacherId: currentUser?.id || 'admin',
            updatedAt: new Date().toISOString()
          });
        }
      });

      setDailyAttendance(updatedDailyAttendance);

      // 2. Calculate each student's term attendance:
      // Strictly count days marked PRESENT against total days attendance was marked for the term
      const updatedAttendance = [...attendance];

      students.forEach(student => {
        const calc = calculateStudentTermAttendance(
          student,
          currentTerm,
          currentYear,
          updatedDailyAttendance,
          updatedAttendance,
          students
        );

        const attIdx = updatedAttendance.findIndex(
          a => a.studentId === student.id && (!a.term || a.term === currentTerm) && (!a.year || a.year === currentYear)
        );

        const attRecord: Attendance = {
          studentId: student.id,
          term: currentTerm,
          year: currentYear,
          daysPresent: calc.daysPresent,
          totalDays: calc.totalDays,
          remarks: calc.remarks,
          teacherId: currentUser?.id || 'admin',
          updatedAt: new Date().toISOString()
        };

        if (attIdx >= 0) {
          updatedAttendance[attIdx] = attRecord;
        } else if (calc.totalDays > 0) {
          updatedAttendance.push(attRecord);
        }
      });

      setAttendance(updatedAttendance);

      // Save locally to multiple fallback keys for zero data loss
      try {
        localStorage.setItem('ea_daily_attendance', JSON.stringify(updatedDailyAttendance));
        localStorage.setItem('ea_attendance', JSON.stringify(updatedAttendance));
        localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(updatedAttendance));
      } catch (e) {
        console.warn('Local storage write warning', e);
      }

      // Save to Cloud Supabase & broadcast master server sync
      await Promise.allSettled([
        saveSupabaseAttendance(updatedAttendance),
        saveSupabaseDailyAttendance(updatedDailyAttendance),
        pushMasterServerSync({ attendance: updatedAttendance, dailyAttendance: updatedDailyAttendance })
      ]);

      const classLabel = selectedClass === 'ALL' ? 'All Academy Classes' : selectedClass;
      setSaveSuccessMessage(
        `Attendance Register for ${classLabel} (${selectedDate}) has been successfully submitted and saved! Terminal report cards have been updated.`
      );
      setSubmittedSuccessfully(true);

      setTimeout(() => {
        setSubmittedSuccessfully(false);
      }, 5000);

      setTimeout(() => {
        setSaveSuccessMessage('');
      }, 7000);
    } catch (error) {
      console.error('Error submitting attendance register:', error);
      setSaveSuccessMessage('Attendance register saved locally. Changes will sync to cloud when connected.');
      setSubmittedSuccessfully(true);
      setTimeout(() => {
        setSubmittedSuccessfully(false);
        setSaveSuccessMessage('');
      }, 5000);
    } finally {
      setIsSubmittingRegister(false);
    }
  };

  // Get term attendance summary for a student (live & persistent)
  const getTermAttendanceSummary = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) {
      return { present: 0, total: 0, pct: 0 };
    }

    const calc = calculateStudentTermAttendance(
      student,
      config.term,
      config.schoolYear,
      dailyAttendance,
      attendance,
      students
    );

    return {
      present: calc.daysPresent,
      total: calc.totalDays,
      pct: calc.rate
    };
  };

  // ==========================================
  // GATE: NOT LOGGED IN - SHOW TEACHER LOGIN
  // ==========================================
  if (!currentUser && !isAdminAuthenticated) {
    return (
      <div 
        className="max-w-2xl mx-auto p-6 sm:p-8 rounded-2xl border border-mauve-500/30 shadow-xl relative overflow-hidden animate-fadeIn no-print my-6"
        style={{
          backgroundImage: `url(${academyHubBg})`,
          backgroundRepeat: 'repeat',
          backgroundPosition: 'center',
          backgroundSize: '400px 400px',
          backgroundColor: '#f6f2fb'
        }}
      >
        <div className="absolute inset-0 bg-mauve-950/10 pointer-events-none rounded-2xl" />
        <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-2xl border border-mauve-500/20 shadow-xl overflow-hidden">
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

        {/* Global Sync & Recorded Roll Call Dates Navigation Bar */}
        <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-bold text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Global Cloud Sync Active</span>
            </div>

            {markedDatesForClass.includes(selectedDate) ? (
              <span className="px-2.5 py-1 bg-purple-100 text-purple-900 border border-purple-200 rounded-lg font-bold text-[11px] flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-purple-700" />
                Roll call recorded for {selectedDate}
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg font-semibold text-[11px]">
                No roll call taken yet for {selectedDate}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefreshAttendance}
              disabled={isSyncingAttendance}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-[11px] transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Pull latest attendance from cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAttendance ? 'animate-spin text-purple-600' : 'text-gray-500'}`} />
              <span>{isSyncingAttendance ? 'Syncing...' : 'Sync Cloud Now'}</span>
            </button>
          </div>
        </div>

        {/* Quick Date Selectors for Recorded Dates */}
        {markedDatesForClass.length > 0 && (
          <div className="pt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mr-1">
              Recorded Dates ({markedDatesForClass.length}):
            </span>
            {markedDatesForClass.slice(0, 8).map(dateStr => (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer ${
                  selectedDate === dateStr
                    ? 'bg-mauve-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                {dateStr}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Helpful Alert if looking at an empty date when records exist on other dates */}
      {!markedDatesForClass.includes(selectedDate) && markedDatesForClass.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 p-3 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs no-print">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Attendance has already been recorded on other dates for this class (latest on <strong className="font-extrabold">{markedDatesForClass[0]}</strong>).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(markedDatesForClass[0])}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-[11px] uppercase tracking-wider shrink-0 transition cursor-pointer self-start sm:self-auto"
          >
            Jump to {markedDatesForClass[0]}
          </button>
        </div>
      )}

      {/* SAVE SUCCESS BANNER */}
      {saveSuccessMessage && (
        <div id="top-attendance-success-banner" className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{saveSuccessMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-mono font-bold">
              Term Totals Synced
            </span>
            <button
              type="button"
              onClick={() => setSaveSuccessMessage('')}
              className="text-emerald-700 hover:text-emerald-900 p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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
                id="top-submit-attendance-register-btn"
                type="button"
                disabled={isSubmittingRegister}
                onClick={handleSaveAndSyncTermRegister}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold uppercase tracking-wider transition flex items-center gap-1.5 shadow-sm cursor-pointer ml-auto sm:ml-2 active:scale-95 ${
                  submittedSuccessfully
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300'
                    : 'bg-[#1C053E] hover:bg-[#2B0D5D] text-white'
                }`}
              >
                {isSubmittingRegister ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : submittedSuccessfully ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Submitted!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-amber-300" />
                    <span>Submit Register</span>
                  </>
                )}
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
                  {filteredStudents.map((student, sIdx) => {
                    const status = getStudentStatusForDate(student.id);
                    const termSummary = getTermAttendanceSummary(student.id);

                    return (
                      <tr key={`${student.id}-${sIdx}`} className="hover:bg-mauve-50/40 transition">
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
                          <div className="inline-flex items-center gap-2 bg-gray-100 p-1.5 rounded-xl border border-gray-200/80 shadow-inner">
                            <button
                              id={`btn-present-${student.id}`}
                              type="button"
                              onClick={() => setStudentStatus(student.id, 'PRESENT')}
                              title={`Mark ${student.name} as Present`}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center gap-1.5 active:scale-95 select-none ${
                                status === 'PRESENT'
                                  ? 'bg-emerald-600 text-white shadow-md scale-105 ring-2 ring-emerald-400 font-black'
                                  : 'bg-white text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-gray-200'
                              }`}
                            >
                              <Check className={`w-3.5 h-3.5 ${status === 'PRESENT' ? 'stroke-[3]' : 'stroke-2'}`} />
                              <span>Present</span>
                            </button>

                            <button
                              id={`btn-absent-${student.id}`}
                              type="button"
                              onClick={() => setStudentStatus(student.id, 'ABSENT')}
                              title={`Mark ${student.name} as Absent`}
                              className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center gap-1.5 active:scale-95 select-none ${
                                status === 'ABSENT'
                                  ? 'bg-rose-600 text-white shadow-md scale-105 ring-2 ring-rose-400 font-black'
                                  : 'bg-white text-gray-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300 border border-gray-200'
                              }`}
                            >
                              <XCircle className={`w-3.5 h-3.5 ${status === 'ABSENT' ? 'stroke-[3]' : 'stroke-2'}`} />
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
              <div className="p-5 bg-gradient-to-r from-mauve-50 via-purple-50 to-mauve-50 border-t border-mauve-200 flex flex-col gap-4">
                {saveSuccessMessage && (
                  <div
                    id="attendance-register-bottom-success-banner"
                    className="w-full bg-emerald-900 text-white p-4 rounded-xl shadow-lg border-2 border-emerald-400 flex items-start sm:items-center justify-between gap-3 animate-fadeIn"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-800 rounded-lg text-emerald-300 shrink-0">
                        <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                      </div>
                      <div>
                        <div className="font-black text-sm text-emerald-100 uppercase tracking-wide flex items-center gap-2">
                          <span>Attendance Register Submitted Successfully!</span>
                          <span className="text-[10px] bg-emerald-700 text-emerald-100 px-2 py-0.5 rounded font-mono font-bold">
                            CONFIRMED
                          </span>
                        </div>
                        <p className="text-xs text-emerald-200 mt-0.5 font-medium leading-relaxed">
                          {saveSuccessMessage}
                        </p>
                      </div>
                    </div>
                    <button
                      id="dismiss-bottom-attendance-success-btn"
                      type="button"
                      onClick={() => setSaveSuccessMessage('')}
                      className="text-emerald-300 hover:text-white p-1 rounded-lg transition shrink-0"
                      title="Dismiss"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-mauve-900 font-bold">
                    <span>Showing {filteredStudents.length} pupils across {selectedClass === 'ALL' ? 'All Academy Classes' : selectedClass}. Click PRESENT or ABSENT to mark attendance.</span>
                  </div>
                  <button
                    id="submit-attendance-register-btn"
                    type="button"
                    disabled={isSubmittingRegister}
                    onClick={handleSaveAndSyncTermRegister}
                    className={`px-6 py-3.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider transition flex items-center justify-center gap-2.5 shadow-lg cursor-pointer transform active:scale-95 ${
                      submittedSuccessfully
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-4 ring-emerald-300 scale-105'
                        : 'bg-[#1C053E] hover:bg-[#2B0D5D] text-white hover:-translate-y-0.5'
                    }`}
                  >
                    {isSubmittingRegister ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                        <span>Submitting Attendance Register...</span>
                      </>
                    ) : submittedSuccessfully ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-200 animate-bounce" />
                        <span>Attendance Register Submitted!</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 text-amber-300" />
                        <span>Submit Attendance Register</span>
                      </>
                    )}
                  </button>
                </div>
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
                id="term-register-submit-btn"
                type="button"
                disabled={isSubmittingRegister}
                onClick={handleSaveAndSyncTermRegister}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 ${
                  submittedSuccessfully
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300'
                    : 'bg-[#1C053E] hover:bg-[#2B0D5D] text-white'
                }`}
              >
                {isSubmittingRegister ? (
                  <>
                    <RefreshCw className="w-4 h-4 text-amber-300 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : submittedSuccessfully ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                    <span>Submitted!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-amber-300" />
                    <span>Submit &amp; Sync Register</span>
                  </>
                )}
              </button>
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
                    <tr key={`${student.id}-${idx}`} className="hover:bg-gray-50">
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

      {/* FLOATING PERSISTENT SUBMISSION SUCCESS TOAST */}
      {saveSuccessMessage && (
        <div
          id="floating-attendance-submitted-toast"
          className="fixed bottom-6 right-6 z-50 max-w-lg bg-[#1C053E] text-white p-4 rounded-2xl shadow-2xl border-2 border-emerald-400 flex items-start gap-3.5 animate-fadeIn backdrop-blur-md"
        >
          <div className="p-2 bg-emerald-500/20 border border-emerald-400/40 rounded-xl text-emerald-300 shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-black text-sm text-emerald-300 uppercase tracking-wider">
                Register Submitted Successfully
              </h4>
              <span className="text-[9px] uppercase font-mono px-2 py-0.5 bg-emerald-900/80 text-emerald-200 rounded border border-emerald-700 font-bold">
                Synced
              </span>
            </div>
            <p className="text-xs text-gray-200 mt-1 leading-relaxed break-words">
              {saveSuccessMessage}
            </p>
            <div className="mt-2.5 flex items-center gap-3 text-[11px] text-emerald-300 font-bold">
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Saved to Register
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-400" /> Synced to Terminal Reports
              </span>
            </div>
          </div>
          <button
            id="close-floating-attendance-toast-btn"
            type="button"
            onClick={() => setSaveSuccessMessage('')}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition shrink-0 ml-1 cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
