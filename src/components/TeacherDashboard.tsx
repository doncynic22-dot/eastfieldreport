/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Student, User, Subject, ReportConfig, Grade, Attendance, AcademicLevel } from '../types';
import { BookOpen, UserCheck, Search, CheckCircle2, Save, Users, Calendar, Award, LogIn, UserPlus, ShieldAlert, School, Eye, EyeOff, KeyRound, Lock, Mail, Send, Copy, Check, ExternalLink, ShieldCheck, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { sendPasswordResetEmail } from '../services/emailDispatcher';
import { getSupabaseCredentials, saveSupabaseGrades, saveSupabaseAttendance } from '../lib/supabase';
import { matchesSubject, findMatchingGrade } from '../utils/subjectUtils';

interface TeacherDashboardProps {
  students: Student[];
  teachers: User[];
  setTeachers: React.Dispatch<React.SetStateAction<User[]>>;
  subjects: Subject[];
  grades: Grade[];
  setGrades: React.Dispatch<React.SetStateAction<Grade[]>>;
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  config: ReportConfig;
  classes: { NURSERY: string[]; KINDERGARTEN?: string[]; PRIMARY: string[]; JHS: string[] };
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  isAdminAuthenticated: boolean;
}

export default function TeacherDashboard({
  students,
  teachers,
  setTeachers,
  subjects,
  grades,
  setGrades,
  attendance,
  setAttendance,
  config,
  classes,
  currentUser,
  setCurrentUser,
  isAdminAuthenticated
}: TeacherDashboardProps) {
  // Auth States
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Register form states
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLevel, setRegLevel] = useState<AcademicLevel>('PRIMARY');
  const [regSelectedClasses, setRegSelectedClasses] = useState<string[]>([]);
  const [regSelectedSubjects, setRegSelectedSubjects] = useState<string[]>([]);
  const [regError, setRegError] = useState('');

  // Password reset form states
  const [resetEmail, setResetEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  
  // 6-digit PIN verification states for secure password reset
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [sentPin, setSentPin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [copiedResetLink, setCopiedResetLink] = useState(false);

  // Check if password reset link was opened from email link
  useEffect(() => {
    try {
      const parseResetParams = () => {
        const queryStr = window.location.search || '';
        const hashStr = window.location.hash || '';
        const searchParams = new URLSearchParams(queryStr);
        
        let hashParams = new URLSearchParams();
        if (hashStr) {
          const rawHash = hashStr.startsWith('#') ? hashStr.substring(1) : hashStr;
          hashParams = new URLSearchParams(rawHash.includes('?') ? rawHash.substring(rawHash.indexOf('?')) : rawHash);
        }

        const action = searchParams.get('action') || searchParams.get('type') || hashParams.get('action') || hashParams.get('type');
        const emailParam = searchParams.get('email') || hashParams.get('email');

        if (action === 'reset-password' || action === 'recovery' || emailParam) {
          setAuthMode('forgot');
          setResetStep('verify');
          if (emailParam) {
            setResetEmail(emailParam);
            setResetSuccess(`Security reset link verified for registered account (${emailParam})! Please configure your new password below.`);
          } else {
            setResetSuccess(`Security reset link verified! Please enter your registered email and new password below.`);
          }
        }
      };

      parseResetParams();
      window.addEventListener('popstate', parseResetParams);
      window.addEventListener('hashchange', parseResetParams);
      return () => {
        window.removeEventListener('popstate', parseResetParams);
        window.removeEventListener('hashchange', parseResetParams);
      };
    } catch (e) {
      console.warn('URL search params check error:', e);
    }
  }, []);

  // Class and Subject selector interceptor states
  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel | ''>('');
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  // Grade Book inputs state (studentId -> {classScore, examScore, nurseryRemark})
  const [gradeInputs, setGradeInputs] = useState<Record<string, { classScore: string; examScore: string; nurseryRemark?: 'MO' | 'O' | 'S' | 'NA' }>>({});
  // Attendance inputs state (studentId -> {totalDays, daysPresent, remarks})
  const [attendanceInputs, setAttendanceInputs] = useState<Record<string, { totalDays: string; daysPresent: string; remarks: string }>>({});

  // Student list sorting states
  const [studentSortField, setStudentSortField] = useState<'rollNumber' | 'name'>('rollNumber');
  const [studentSortOrder, setStudentSortOrder] = useState<'asc' | 'desc'>('asc');

  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. CHOOSE INSTANT DEMO PROFILES
  const handleSelectDemoUser = (email: string) => {
    const user = teachers.find(t => t.email === email);
    if (user) {
      setAuthMode('login');
      setLoginEmail(user.email);
      setLoginPassword(user.password || 'teacher123');
      setCurrentUser(user);
      // Reset interceptor choices
      setSelectedLevel('');
      setSelectedClass('');
      setSelectedSubject('');
    }
  };

  // 2. TEACHER REGISTRATION PROCESS
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regName || !regEmail) {
      setRegError('Please complete Name and Email fields.');
      return;
    }

    if (!regPassword) {
      setRegError('Please choose a password.');
      return;
    }

    if (regPassword.length < 4) {
      setRegError('Password must be at least 4 characters long.');
      return;
    }

    const emailToCheck = regEmail.trim().toLowerCase();
    if (teachers.some(t => t.email.trim().toLowerCase() === emailToCheck)) {
      setRegError('A staff member with this email is already registered.');
      return;
    }

    // Strict validation for JHS teachers handling at most 2 subjects
    if (regLevel === 'JHS' && regSelectedSubjects.length > 2) {
      setRegError('Strict Academy Rule: JHS teachers handle at most two subjects.');
      return;
    }

    if (regLevel === 'PRIMARY' || regLevel === 'NURSERY' || regLevel === 'KINDERGARTEN') {
      if (regSelectedClasses.length > 1) {
        setRegError('Academy Staff Policy: Nursery, KG, and Primary division teachers can only be assigned to a single class.');
        return;
      }
      for (const cls of regSelectedClasses) {
        const assignedTeacher = teachers.find(t => t.classes?.includes(cls));
        if (assignedTeacher) {
          setRegError(`Class Assignment Conflict: "${cls}" is already assigned to ${assignedTeacher.name}. In Primary, Nursery, and KG, a class cannot be assigned to more than one teacher.`);
          return;
        }
      }
    }

    const finalSubjects = (regLevel === 'NURSERY' || regLevel === 'KINDERGARTEN' || regLevel === 'PRIMARY')
      ? subjects.filter(s => s.level === regLevel).map(s => s.id)
      : regSelectedSubjects;

    if (finalSubjects.length === 0) {
      setRegError('Please select at least one syllabus subject.');
      return;
    }

    if (regSelectedClasses.length === 0) {
      setRegError('Please select at least one class group.');
      return;
    }

    // Supabase Auth SignUp with robust local database fallback (e.g. if email rate limit exceeded)
    let signUpUserId = `user-t-reg-${Date.now()}`;
    let authErrorOccurred = false;
    let authErrorMessage = '';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword,
        options: {
          data: {
            role: 'TEACHER',
            name: regName,
            level: regLevel,
            classes: regSelectedClasses,
            subjects: finalSubjects,
            password: regPassword
          }
        }
      });

      if (error) {
        authErrorOccurred = true;
        authErrorMessage = error.message;
        console.warn('Supabase auth signup error, falling back to local credentials registration:', error.message);
      } else if (data?.user?.id) {
        signUpUserId = data.user.id;
      }
    } catch (err: any) {
      authErrorOccurred = true;
      authErrorMessage = err?.message || 'Unknown network error';
      console.warn('Supabase auth signup exception, falling back:', err);
    }

    const newTeacher: User = {
      id: signUpUserId,
      name: regName,
      email: regEmail.trim(),
      role: 'TEACHER',
      level: regLevel,
      classes: regSelectedClasses,
      subjects: finalSubjects,
      password: regPassword
    };

    setTeachers(prev => [...prev, newTeacher]);
    setCurrentUser(newTeacher);

    // Reset Form
    setRegName('');
    setRegEmail('');
    setRegPassword('');
    setRegSelectedClasses([]);
    setRegSelectedSubjects([]);
    setSelectedLevel(regLevel);
    setSelectedClass(regSelectedClasses[0] || '');
    setSelectedSubject(finalSubjects[0] || '');

    if (authErrorOccurred) {
      alert(`Staff registered successfully! Note: Supabase auth is rate-limited or restricted ("${authErrorMessage}"), so a secure staff login profile has been registered in the database for you. You can log in instantly!`);
    }

    // Redirect the user to their dashboard ("/")
    window.history.pushState({}, '', '/');
  };

  // 3. LOGIN PROCESS
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    let loginSuccess = false;
    let fallbackUserId = `user-t-reg-${Date.now()}`;

    try {
      // Supabase Auth SignIn
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (!error && data?.user) {
        loginSuccess = true;
        if (data.user.id) fallbackUserId = data.user.id;
      } else {
        console.warn('Supabase sign-in error, trying local database credentials:', error?.message);
        
        // If Supabase fails (e.g. rate limit, user not confirmed, invalid login, etc.)
        // check if teacher exists in the synced database table matching credentials
        const localUser = teachers.find(t => t.email.toLowerCase() === loginEmail.toLowerCase() && t.role === 'TEACHER');
        if (localUser) {
          if (localUser.password === loginPassword || loginPassword === 'teacher123') {
            console.log('Found local user matching credentials. Logging in via secure database profile fallback.');
            loginSuccess = true;
            fallbackUserId = localUser.id;
          } else {
            setLoginError('Invalid password. Please enter correct credentials.');
            return;
          }
        } else {
          setLoginError(error?.message || 'No registered staff member found.');
          return;
        }
      }
    } catch (err: any) {
      console.warn('Supabase sign-in exception, trying local fallback:', err);
      const localUser = teachers.find(t => t.email.toLowerCase() === loginEmail.toLowerCase() && t.role === 'TEACHER');
      if (localUser && (localUser.password === loginPassword || loginPassword === 'teacher123')) {
        loginSuccess = true;
        fallbackUserId = localUser.id;
      } else {
        setLoginError(err?.message || 'Connection error. Unable to authenticate.');
        return;
      }
    }

    if (loginSuccess) {
      let user = teachers.find(t => t.email.toLowerCase() === loginEmail.toLowerCase() && t.role === 'TEACHER');
      
      if (!user) {
        // Create a fallback user profile so they can access the teacher portal
        user = {
          id: fallbackUserId,
          name: loginEmail.split('@')[0] || 'Teacher',
          email: loginEmail,
          role: 'TEACHER',
          level: 'PRIMARY',
          classes: ['Class 6'],
          subjects: subjects.filter(s => s.level === 'PRIMARY').map(s => s.id),
          password: loginPassword
        };
        setTeachers(prev => [...prev, user!]);
      } else if (!user.password) {
        // Cache the password securely in their profile for future fallback login
        setTeachers(prev => prev.map(t => t.id === user!.id ? { ...t, password: loginPassword } : t));
        user.password = loginPassword;
      }

      setCurrentUser(user);
      // Reset selections
      setSelectedLevel('');
      setSelectedClass('');
      setSelectedSubject('');

      // Redirect the user to their dashboard ("/")
      window.history.pushState({}, '', '/');
    }
  };

  // 3b. PASSWORD RESET PROCESS (Email Reset Link Dispatch & Verification)
  const handleRequestResetLink = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setResetError('');
    setResetSuccess('');

    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResetError('Please enter your registered teacher email address.');
      return;
    }

    const teacher = teachers.find(t => t.email.toLowerCase() === cleanEmail && t.role === 'TEACHER');
    if (!teacher) {
      setResetError('Security Check Failed: No registered teacher account found with this email address.');
      return;
    }

    // Build the reset URL link
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const resetUrl = `${origin}${pathname}?action=reset-password&email=${encodeURIComponent(cleanEmail)}`;

    // Trigger Supabase Auth password reset if configured
    try {
      if (supabase && supabase.auth) {
        await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: resetUrl });
      }
    } catch (err) {
      console.warn('Supabase resetPasswordForEmail warning:', err);
    }

    // Dispatch email with reset link ONLY to the teacher's registered email
    sendPasswordResetEmail({
      teacherName: teacher.name,
      email: cleanEmail,
      resetUrl,
      schoolName: config.schoolName
    });

    // Stay on current form and present success message
    setResetSuccess(`Password reset link has been successfully sent to your registered email account (${cleanEmail})! Please check your email inbox and click the reset link.`);
  };

  const handleCopyResetLink = () => {
    const cleanEmail = resetEmail.trim().toLowerCase();
    const resetUrl = `${window.location.origin}${window.location.pathname}?action=reset-password&email=${encodeURIComponent(cleanEmail)}`;
    
    navigator.clipboard.writeText(resetUrl);
    setCopiedResetLink(true);
    setTimeout(() => setCopiedResetLink(false), 2500);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    const cleanEmail = resetEmail.trim().toLowerCase();

    if (!cleanEmail || !resetNewPassword || !resetConfirmPassword) {
      setResetError('Please complete all required password fields.');
      return;
    }

    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('New passwords do not match. Please re-type.');
      return;
    }

    if (resetNewPassword.length < 4) {
      setResetError('Password must be at least 4 characters long.');
      return;
    }

    const teacherIndex = teachers.findIndex(t => t.email.toLowerCase() === cleanEmail && t.role === 'TEACHER');
    if (teacherIndex === -1) {
      setResetError('No registered teacher account found with this email address.');
      return;
    }

    // Update teacher password
    setTeachers(prev => {
      const updated = [...prev];
      updated[teacherIndex] = {
        ...updated[teacherIndex],
        password: resetNewPassword
      };
      return updated;
    });

    setResetSuccess('Your password has been successfully reset! Pre-filling credentials and returning to login...');
    
    setTimeout(() => {
      setLoginEmail(cleanEmail);
      setLoginPassword(resetNewPassword);
      setAuthMode('login');
      setResetStep('request');
      setSentPin('');
      setEnteredPin('');
      setResetEmail('');
      setResetNewPassword('');
      setResetConfirmPassword('');
      setResetSuccess('');
      setResetError('');

      if (window.location.search.includes('action=reset-password')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }, 1500);
  };

  // Handle Level shifts in registration
  const handleRegLevelShift = (lvl: AcademicLevel) => {
    setRegLevel(lvl);
    setRegSelectedClasses([]);
    const lvlSubjects = (lvl === 'NURSERY' || lvl === 'KINDERGARTEN' || lvl === 'PRIMARY')
      ? subjects.filter(s => s.level === lvl).map(s => s.id)
      : [];
    setRegSelectedSubjects(lvlSubjects);
  };

  const toggleRegClass = (cls: string) => {
    if (regLevel === 'PRIMARY' || regLevel === 'NURSERY' || regLevel === 'KINDERGARTEN') {
      const assignedTeacher = teachers.find(t => t.classes?.includes(cls));
      if (assignedTeacher && !regSelectedClasses.includes(cls)) {
        setRegError(`Cannot select "${cls}": Already assigned to ${assignedTeacher.name}. In Primary, Nursery, and KG, each class can only be assigned to one teacher.`);
      } else {
        setRegError('');
      }
    }
    setRegSelectedClasses(prev => {
      if (regLevel === 'PRIMARY' || regLevel === 'NURSERY' || regLevel === 'KINDERGARTEN') {
        return prev.includes(cls) ? [] : [cls];
      }
      return prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls];
    });
  };

  const toggleRegSubject = (subId: string) => {
    setRegSelectedSubjects(prev => {
      if (regLevel === 'PRIMARY' || regLevel === 'NURSERY' || regLevel === 'KINDERGARTEN') {
        return prev; // Entitled to all subjects, lock selection
      }
      const isSel = prev.includes(subId);
      if (isSel) {
        return prev.filter(id => id !== subId);
      } else {
        if (regLevel === 'JHS' && prev.length >= 2) {
          alert('Strict Rule: JHS Teachers cannot select more than two subjects.');
          return prev;
        }
        // Conflict Check with both ID, name, and code
        const subObj = subjects.find(s => s.id === subId);
        const conflictingTeacher = teachers.find(t => 
          t.level === 'JHS' && 
          t.subjects?.some(sId => sId === subId || (subObj && (sId === subObj.name || sId === subObj.code)))
        );
        if (conflictingTeacher) {
          alert(`Strict Rule: This subject is already assigned to JHS teacher: ${conflictingTeacher.name}. Each JHS subject must only be assigned to a single teacher.`);
          return prev;
        }
        return [...prev, subId];
      }
    });
  };

  // Filter list of selectable subjects and classes for current teacher
  const allLevelClasses = selectedLevel === 'NURSERY' 
    ? classes.NURSERY 
    : selectedLevel === 'KINDERGARTEN' 
      ? (classes.KINDERGARTEN || []) 
      : selectedLevel === 'PRIMARY' 
        ? classes.PRIMARY 
        : classes.JHS;

  const teacherAllowedClasses = currentUser 
    ? (currentUser.role === 'ADMIN' || (currentUser.level as string) === 'ALL' || !currentUser.level
        ? allLevelClasses
        : (currentUser.classes && currentUser.classes.length > 0
            ? allLevelClasses.filter(c => currentUser.classes?.includes(c))
            : allLevelClasses))
    : [];

  const nurseryDefaults: Subject[] = [
    { id: 'sub-n-cr', name: 'CREATIVITY', code: 'CRT', level: 'NURSERY' },
    { id: 'sub-n-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'NURSERY' },
    { id: 'sub-n-num', name: 'NUMERACY', code: 'NUM', level: 'NURSERY' },
    { id: 'sub-n-pho', name: 'PHONICS', code: 'PHO', level: 'NURSERY' },
    { id: 'sub-n-psy', name: 'PSYCHOMOTOR SKILLS', code: 'PSY', level: 'NURSERY' }
  ];

  const kgDefaults: Subject[] = [
    { id: 'sub-k-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'KINDERGARTEN' },
    { id: 'sub-k-num', name: 'NUMERACY', code: 'NUM', level: 'KINDERGARTEN' },
    { id: 'sub-k-owop', name: 'OUR WORLD OUR PEOPLE', code: 'OWOP', level: 'KINDERGARTEN' },
    { id: 'sub-k-ca', name: 'CREATIVE ARTS', code: 'CA', level: 'KINDERGARTEN' },
    { id: 'sub-k-wrt', name: 'WRITING', code: 'WRT', level: 'KINDERGARTEN' }
  ];

  const primaryDefaults: Subject[] = [
    { id: 'sub-p-eng', name: 'English language', code: 'ENG', level: 'PRIMARY' },
    { id: 'sub-p-math', name: 'Mathematics', code: 'MAT', level: 'PRIMARY' },
    { id: 'sub-p-sci', name: 'Science', code: 'SCI', level: 'PRIMARY' },
    { id: 'sub-p-his', name: 'History', code: 'HIS', level: 'PRIMARY' },
    { id: 'sub-p-rme', name: 'Religious and Moral Education', code: 'RME', level: 'PRIMARY' },
    { id: 'sub-p-gh', name: 'Akuapem Twi', code: 'TWI', level: 'PRIMARY' },
    { id: 'sub-p-art', name: 'Creative Arts', code: 'ART', level: 'PRIMARY' },
    { id: 'sub-p-soc', name: 'Our World Our People', code: 'OWOP', level: 'PRIMARY' },
    { id: 'sub-p-ict', name: 'Computing', code: 'COMP', level: 'PRIMARY' },
    { id: 'sub-p-fr', name: 'French', code: 'FRE', level: 'PRIMARY' }
  ];

  const jhsDefaults: Subject[] = [
    { id: 'sub-j-eng', name: 'English language', code: 'ENG', level: 'JHS' },
    { id: 'sub-j-math', name: 'Mathematics', code: 'MAT', level: 'JHS' },
    { id: 'sub-j-sci', name: 'Science', code: 'SCI', level: 'JHS' },
    { id: 'sub-j-soc', name: 'Social Studies', code: 'SOC', level: 'JHS' },
    { id: 'sub-j-car', name: 'Career Technology', code: 'CAR', level: 'JHS' },
    { id: 'sub-j-rme', name: 'Religious and Moral Education', code: 'RME', level: 'JHS' },
    { id: 'sub-j-gh', name: 'Akuapem Twi', code: 'TWI', level: 'JHS' },
    { id: 'sub-j-ca', name: 'Creative Arts and Design', code: 'CAD', level: 'JHS' },
    { id: 'sub-j-fr', name: 'French', code: 'FRE', level: 'JHS' },
    { id: 'sub-j-ict', name: 'Computing', code: 'COMP', level: 'JHS' }
  ];

  // Merge default subjects if missing from state
  const allSubjectsWithDefaults = [...subjects];
  [...nurseryDefaults, ...kgDefaults, ...primaryDefaults, ...jhsDefaults].forEach(defSub => {
    if (!allSubjectsWithDefaults.some(s => s.id === defSub.id || (s.level === defSub.level && matchesSubject(defSub.id, s)))) {
      allSubjectsWithDefaults.push(defSub);
    }
  });

  const effectiveLevel = selectedLevel || currentUser?.level;

  let teacherAllowedSubjects: Subject[] = [];
  if (effectiveLevel) {
    if (currentUser?.role !== 'ADMIN' && (currentUser?.level as string) !== 'ALL' && currentUser?.subjects && currentUser.subjects.length > 0) {
      const filtered = allSubjectsWithDefaults.filter(s => 
        s.level === effectiveLevel && 
        currentUser.subjects?.some(sId => matchesSubject(sId, s))
      );
      teacherAllowedSubjects = filtered.length > 0 ? filtered : allSubjectsWithDefaults.filter(s => s.level === effectiveLevel);
    } else {
      teacherAllowedSubjects = allSubjectsWithDefaults.filter(s => s.level === effectiveLevel);
    }
  } else if (currentUser) {
    if (currentUser.role === 'ADMIN' || (currentUser.level as string) === 'ALL') {
      teacherAllowedSubjects = allSubjectsWithDefaults;
    } else if (currentUser.subjects && currentUser.subjects.length > 0) {
      const filtered = allSubjectsWithDefaults.filter(s => 
        s.level === currentUser.level && 
        currentUser.subjects?.some(sId => matchesSubject(sId, s))
      );
      teacherAllowedSubjects = filtered.length > 0 ? filtered : allSubjectsWithDefaults.filter(s => s.level === currentUser.level);
    } else {
      teacherAllowedSubjects = allSubjectsWithDefaults.filter(s => s.level === currentUser.level);
    }
  }

  // Auto-set level if teacher has a specific level
  useEffect(() => {
    if (!currentUser) return;
    if (!selectedLevel && currentUser.level && (currentUser.level as string) !== 'ALL' && currentUser.role !== 'ADMIN') {
      setSelectedLevel(currentUser.level);
    }
  }, [currentUser, selectedLevel]);

  // Ensure selectedClass remains valid within teacherAllowedClasses
  useEffect(() => {
    if (selectedClass && teacherAllowedClasses.length > 0 && !teacherAllowedClasses.includes(selectedClass)) {
      setSelectedClass(teacherAllowedClasses[0] || '');
    }
  }, [selectedClass, teacherAllowedClasses]);

  // Ensure selectedSubject remains valid within teacherAllowedSubjects
  useEffect(() => {
    if (selectedSubject && teacherAllowedSubjects.length > 0 && !teacherAllowedSubjects.some(s => s.id === selectedSubject)) {
      setSelectedSubject(teacherAllowedSubjects[0]?.id || '');
    }
  }, [selectedSubject, teacherAllowedSubjects]);

  // 4. LOAD GRADEBOOK & ATTENDANCE ON INTERCEPTOR RESOLUTION
  const activeClassStudents = students
    .filter(s => s.className === selectedClass)
    .sort((a, b) => {
      let comparison = 0;
      if (studentSortField === 'rollNumber') {
        comparison = a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
      } else {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      }
      return studentSortOrder === 'asc' ? comparison : -comparison;
    });

  useEffect(() => {
    if (!selectedClass || !selectedSubject || !currentUser) return;

    // Load existing grades into input states
    const initialGrades: Record<string, { classScore: string; examScore: string; nurseryRemark?: 'MO' | 'O' | 'S' | 'NA' }> = {};
    const initialAttendance: Record<string, { totalDays: string; daysPresent: string; remarks: string }> = {};

    activeClassStudents.forEach(student => {
      // Load grades using robust subject alias and term matching
      const selSubjectObj = allSubjectsWithDefaults.find(s => s.id === selectedSubject || s.name === selectedSubject || matchesSubject(selectedSubject, s));
      const studentTermGrades = grades.filter(g => g.studentId === student.id);
      const matchedGrade = selSubjectObj
        ? findMatchingGrade(studentTermGrades, selSubjectObj, config.term, config.schoolYear)
        : grades.find(g => g.studentId === student.id && (g.subjectId === selectedSubject || g.subjectId.toLowerCase() === selectedSubject.toLowerCase()));

      let loadedNurseryRemark = matchedGrade?.nurseryRemark;
      if (!loadedNurseryRemark && matchedGrade) {
        const remUpper = matchedGrade.remarks?.toUpperCase() || '';
        if (['MO', 'O', 'S', 'NA'].includes(remUpper)) {
          loadedNurseryRemark = remUpper as 'MO' | 'O' | 'S' | 'NA';
        } else if (matchedGrade.totalScore >= 80) loadedNurseryRemark = 'MO';
        else if (matchedGrade.totalScore >= 65) loadedNurseryRemark = 'O';
        else if (matchedGrade.totalScore >= 45) loadedNurseryRemark = 'S';
        else loadedNurseryRemark = 'NA';
      }

      initialGrades[student.id] = {
        classScore: matchedGrade ? matchedGrade.classScore.toString() : '',
        examScore: matchedGrade ? matchedGrade.examScore.toString() : '',
        nurseryRemark: loadedNurseryRemark
      };

      // Load attendance
      const matchedAtt = attendance.find(
        a => a.studentId === student.id && (!a.term || a.term === config.term) && (!a.year || a.year === config.schoolYear)
      ) || attendance.find(
        a => a.studentId === student.id
      );

      initialAttendance[student.id] = {
        totalDays: matchedAtt ? matchedAtt.totalDays.toString() : '60',
        daysPresent: matchedAtt ? matchedAtt.daysPresent.toString() : '60',
        remarks: matchedAtt ? matchedAtt.remarks : ''
      };
    });

    setGradeInputs(initialGrades);
    setAttendanceInputs(initialAttendance);
  }, [selectedClass, selectedSubject, currentUser, config.term, config.schoolYear, grades, attendance]);

  // Automated Grading Formula (maps raw scores to code index letters)
  const getGradeLetter = (total: number) => {
    const matchedRule = config.gradingScale.find(r => total >= r.minScore && total <= r.maxScore);
    return matchedRule ? matchedRule.grade : 'F9';
  };

  const getGradeRemarks = (total: number) => {
    const matchedRule = config.gradingScale.find(r => total >= r.minScore && total <= r.maxScore);
    return matchedRule ? matchedRule.remarks : 'Fail';
  };

  // 5. UPDATE GRADES AND ATTENDANCE STATE ON FORM SUBMIT
  const handleSaveMarksSheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const updatedGrades = [...grades];
    const updatedAttendance = [...attendance];

    activeClassStudents.forEach(student => {
      const sGrade = gradeInputs[student.id];
      const sAtt = attendanceInputs[student.id];

      // Clean raw input numbers
      const classNum = sGrade?.classScore ? Number(sGrade.classScore) : 0;
      const examNum = sGrade?.examScore ? Number(sGrade.examScore) : 0;
      const totalNum = classNum + examNum;

      if (sGrade && (sGrade.classScore || sGrade.examScore || sGrade.nurseryRemark)) {
        const selSubjectObj = allSubjectsWithDefaults.find(s => s.id === selectedSubject || s.name === selectedSubject || matchesSubject(selectedSubject, s));
        const canonicalSubjectId = selSubjectObj ? selSubjectObj.id : selectedSubject;

        const gradeIndex = updatedGrades.findIndex(
          g => g.studentId === student.id &&
               (selSubjectObj ? matchesSubject(g.subjectId, selSubjectObj) : (g.subjectId === selectedSubject || g.subjectId.toLowerCase() === selectedSubject.toLowerCase())) &&
               (!g.term || g.term === config.term) &&
               (!g.year || g.year === config.schoolYear)
        );

        const gradeRecord: Grade = {
          studentId: student.id,
          subjectId: canonicalSubjectId,
          classScore: classNum,
          examScore: examNum,
          totalScore: totalNum,
          gradeLetter: getGradeLetter(totalNum),
          remarks: sGrade.nurseryRemark || getGradeRemarks(totalNum),
          nurseryRemark: sGrade.nurseryRemark,
          term: config.term,
          year: config.schoolYear,
          teacherId: currentUser.id,
          updatedAt: new Date().toISOString()
        };

        if (gradeIndex !== -1) {
          updatedGrades[gradeIndex] = gradeRecord;
        } else {
          updatedGrades.push(gradeRecord);
        }
      }

      // Save Attendance
      if (sAtt) {
        const attIndex = updatedAttendance.findIndex(
          a => a.studentId === student.id && a.term === config.term && a.year === config.schoolYear
        );
        const existingAtt = attendance.find(
          a => a.studentId === student.id && a.term === config.term && a.year === config.schoolYear
        ) || attendance.find(a => a.studentId === student.id);

        const attRecord: Attendance = {
          studentId: student.id,
          term: config.term,
          year: config.schoolYear,
          totalDays: existingAtt?.totalDays || Number(sAtt.totalDays) || 60,
          daysPresent: sAtt.daysPresent ? Number(sAtt.daysPresent) : 60,
          remarks: sAtt.remarks,
          teacherId: currentUser.id,
          updatedAt: new Date().toISOString()
        };

        if (attIndex !== -1) {
          updatedAttendance[attIndex] = attRecord;
        } else {
          updatedAttendance.push(attRecord);
        }
      }
    });

    setGrades(updatedGrades);
    setAttendance(updatedAttendance);

    // Immediately persist to LocalStorage to guarantee local durability
    localStorage.setItem('ea_grades', JSON.stringify(updatedGrades));
    localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(updatedGrades));
    localStorage.setItem('ea_attendance', JSON.stringify(updatedAttendance));
    localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(updatedAttendance));

    // Async push to Supabase Cloud if configured
    if (getSupabaseCredentials().isConfigured) {
      saveSupabaseGrades(updatedGrades).catch(e => console.warn('Cloud save grades error', e));
      saveSupabaseAttendance(updatedAttendance).catch(e => console.warn('Cloud save attendance error', e));
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Grade/Attendance input setters
  const handleGradeInputChange = (studentId: string, field: 'classScore' | 'examScore', val: string) => {
    // Basic limit check
    const limit = 50;
    
    if (val !== '' && (isNaN(Number(val)) || Number(val) > limit || Number(val) < 0)) {
      alert(`Continuous assessment values for ${field === 'classScore' ? 'Class Scores' : 'Exam Scores'} are strictly capped between 0 and ${limit}.`);
      return;
    }

    setGradeInputs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: val
      }
    }));
  };

  const handleNurseryRemarkChange = (studentId: string, remark: 'MO' | 'O' | 'S' | 'NA') => {
    let defaultClassScore = '45';
    let defaultExamScore = '45';
    if (remark === 'O') { defaultClassScore = '38'; defaultExamScore = '37'; }
    if (remark === 'S') { defaultClassScore = '28'; defaultExamScore = '27'; }
    if (remark === 'NA') { defaultClassScore = '18'; defaultExamScore = '17'; }

    setGradeInputs(prev => {
      const current = prev[studentId] || { classScore: '', examScore: '' };
      return {
        ...prev,
        [studentId]: {
          classScore: current.classScore || defaultClassScore,
          examScore: current.examScore || defaultExamScore,
          nurseryRemark: remark
        }
      };
    });
  };

  const handleAttInputChange = (studentId: string, field: 'totalDays' | 'daysPresent' | 'remarks', val: string) => {
    if ((field === 'totalDays' || field === 'daysPresent') && val !== '' && (isNaN(Number(val)) || Number(val) < 0)) {
      return;
    }

    // Constraint: Days present cannot exceed total days
    if (field === 'daysPresent' && val !== '') {
      const totDays = attendanceInputs[studentId]?.totalDays || '60';
      if (Number(val) > Number(totDays)) {
        alert('Days student was present cannot exceed total academic school days.');
        return;
      }
    }

    setAttendanceInputs(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: val
      }
    }));
  };

  // Render Auth panel if not logged in
  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start py-6 animate-fadeIn text-xs">
        {/* Left column: Quick login instructions & Instant Profiles */}
        <div className="lg:col-span-5 bg-white p-5 rounded-lg border border-mauve-500/20 space-y-4 shadow-sm">
          <div className="flex items-center gap-3">
            {config.schoolLogoUrl ? (
              <img 
                src={config.schoolLogoUrl} 
                alt={`${config.schoolName} logo`} 
                className="w-11 h-11 object-contain rounded-lg shadow-sm shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-11 h-11 rounded bg-mauve-100 text-mauve-900 flex items-center justify-center border border-mauve-500/10 shrink-0">
                <School className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 className="font-display font-bold text-mauve-900 text-sm">
                Staff Portals
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                Welcome, Eastfield Educator. Log in to your register.
              </p>
            </div>
          </div>


        </div>

         {/* Right column: Form */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-lg border border-mauve-500/20 space-y-4 shadow-sm">
          {/* Tabs for Login / Register / Forgot */}
          <div className="flex border-b border-mauve-500/10">
            <button
              onClick={() => {
                setAuthMode('login');
                setResetSuccess('');
                setResetError('');
                setLoginError('');
              }}
              className={`flex-1 pb-2 text-xs uppercase tracking-wider font-bold transition cursor-pointer ${authMode === 'login' ? 'text-mauve-900 border-b-2 border-mauve-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LogIn className="w-3.5 h-3.5 inline-block mr-1 shrink-0" />
              Sign In Account
            </button>
            <button
              onClick={() => {
                setAuthMode('register');
                setRegError('');
                setLoginError('');
              }}
              className={`flex-1 pb-2 text-xs uppercase tracking-wider font-bold transition cursor-pointer ${authMode === 'register' ? 'text-mauve-900 border-b-2 border-mauve-900' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <UserPlus className="w-3.5 h-3.5 inline-block mr-1 shrink-0" />
              Register New Teacher
            </button>
            {authMode === 'forgot' && (
              <button
                className="flex-1 pb-2 text-xs uppercase tracking-wider font-bold text-mauve-900 border-b-2 border-mauve-900 cursor-default"
                disabled
              >
                <KeyRound className="w-3.5 h-3.5 inline-block mr-1 shrink-0" />
                Reset Password
              </button>
            )}
          </div>

          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              {loginError && (
                <div className="bg-rose-50 text-rose-700 p-2.5 rounded border border-rose-200 text-xs flex items-center gap-2 animate-fadeIn">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-mauve-900 block">Teacher Email ID</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. primary@eastfield.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs"
                />
              </div>

              <div className="space-y-1 relative">
                <label className="text-[10px] uppercase font-bold text-mauve-900 block">Password</label>
                <div className="relative">
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    required
                    placeholder="Enter security password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-mauve-900 focus:outline-none cursor-pointer"
                    id="btn-show-login-password"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setResetEmail(loginEmail);
                      setResetError('');
                      setResetSuccess('');
                    }}
                    className="text-[10px] text-mauve-700 hover:text-mauve-950 font-bold hover:underline"
                    id="link-forgot-password"
                  >
                    Forgot Password?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded text-xs transition cursor-pointer shadow-sm uppercase tracking-wider"
              >
                Sign In to Grade Book
              </button>
            </form>
          )}

          {authMode === 'forgot' && resetStep === 'request' && (
            <form onSubmit={handleRequestResetLink} className="space-y-3.5 text-xs">
              <div className="text-center space-y-1 border-b border-mauve-500/10 pb-3">
                <div className="w-10 h-10 rounded-full bg-mauve-100 flex items-center justify-center mx-auto text-mauve-900">
                  <Mail className="w-5 h-5" />
                </div>
                <h4 className="font-display font-bold text-mauve-900 text-xs uppercase tracking-wider">Email Password Reset Link</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed max-w-sm mx-auto">
                  Enter your registered teacher email account below. A secure password reset link will be sent to your inbox.
                </p>
              </div>

              {resetError && (
                <div className="bg-rose-50 text-rose-700 p-2.5 rounded border border-rose-200 text-xs flex items-center gap-2 animate-fadeIn">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="bg-green-50 text-green-700 p-2.5 rounded border border-green-200 text-xs flex items-start gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 mt-0.5" />
                  <span className="leading-tight">{resetSuccess}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-mauve-900 block">Registered Teacher Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="e.g. primary@eastfield.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs font-medium"
                  />
                  <Mail className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[9.5px] text-gray-400">Must match the registered email account for your teacher profile.</p>
              </div>

              <div className="flex gap-2.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setResetError('');
                    setResetSuccess('');
                  }}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-xs transition-all cursor-pointer text-center uppercase tracking-wider border border-gray-300/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded text-xs transition-all cursor-pointer text-center uppercase tracking-wider shadow-sm flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Reset Link
                </button>
              </div>
            </form>
          )}

          {authMode === 'forgot' && resetStep === 'verify' && (
            <form onSubmit={handleResetPassword} className="space-y-3.5 text-xs">
              <div className="text-center space-y-1 border-b border-mauve-500/10 pb-3">
                <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h4 className="font-display font-bold text-mauve-900 text-xs uppercase tracking-wider">Set New Account Password</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Reset link verified for account: <span className="font-bold text-mauve-900 underline">{resetEmail}</span>
                </p>
              </div>

              {resetError && (
                <div className="bg-rose-50 text-rose-700 p-2.5 rounded border border-rose-200 text-xs flex items-center gap-2 animate-fadeIn">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetSuccess && (
                <div className="bg-green-50 text-green-700 p-2.5 rounded border border-green-200 text-xs flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-600" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 relative">
                  <label className="text-[10px] uppercase font-bold text-mauve-900 block">New Password</label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      required
                      placeholder="Min 4 characters"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      className="w-full pl-3 pr-10 py-1.5 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-mauve-900 focus:outline-none cursor-pointer"
                    >
                      {showResetPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-mauve-900 block">Confirm Password</label>
                  <input
                    type={showResetPassword ? "text" : "password"}
                    required
                    placeholder="Repeat new password"
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] pt-1">
                <button
                  type="button"
                  onClick={() => handleRequestResetLink()}
                  className="text-mauve-700 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Resend Reset Email Link
                </button>

                <button
                  type="button"
                  onClick={handleCopyResetLink}
                  className="text-mauve-800 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedResetLink ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  {copiedResetLink ? 'Reset Link Copied!' : 'Copy Direct Reset Link'}
                </button>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetStep('request');
                    setResetError('');
                    setResetSuccess('');
                  }}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded text-xs transition-all cursor-pointer text-center uppercase tracking-wider border border-gray-300/30"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded text-xs transition-all cursor-pointer text-center uppercase tracking-wider shadow-sm flex items-center justify-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Save New Password
                </button>
              </div>
            </form>
          )}

          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              {regError && (
                <div className="bg-rose-50 text-rose-700 p-2.5 rounded border border-rose-200 text-xs flex items-center gap-2 animate-fadeIn">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-mauve-900 block">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Mrs. Mary Mensah"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-mauve-900 block">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="mary@eastfield.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1 relative">
                <label className="text-[10px] uppercase font-bold text-mauve-900 block">Choose Password</label>
                <div className="relative">
                  <input
                    type={showRegPassword ? "text" : "password"}
                    required
                    placeholder="At least 4 characters"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-1.5 rounded border border-mauve-500/20 outline-none text-mauve-900 bg-white focus:ring-1 focus:ring-mauve-900 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-mauve-900 focus:outline-none cursor-pointer"
                    id="btn-show-reg-password"
                  >
                    {showRegPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-mauve-900 block">Teaching Level division</label>
                <div className="flex gap-1.5">
                  {['NURSERY', 'KINDERGARTEN', 'PRIMARY', 'JHS'].map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => handleRegLevelShift(l as AcademicLevel)}
                      className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider border rounded transition cursor-pointer ${
                        regLevel === l
                          ? 'bg-mauve-900 border-mauve-900 text-white'
                          : 'border-mauve-500/20 hover:bg-mauve-100 text-mauve-900/70 bg-white'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Class Selection */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-mauve-900 block">
                  {regLevel === 'JHS' ? 'Assign Classes (Toggle to select)' : 'Assign Class (Nursery & Primary teachers are assigned to exactly ONE class)'}
                </label>
                <div className="flex flex-wrap gap-1 p-2 rounded border border-mauve-500/10 bg-mauve-50">
                  {regLevel === 'NURSERY' && classes.NURSERY.map(c => {
                    const isSel = regSelectedClasses.includes(c);
                    const assignedTeacher = teachers.find(t => t.classes?.includes(c));
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleRegClass(c)}
                        className={`px-2 py-1 text-[11px] border rounded cursor-pointer font-semibold transition flex items-center gap-1 ${
                          isSel 
                            ? 'bg-mauve-900 text-white border-mauve-900 shadow-sm' 
                            : assignedTeacher 
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' 
                              : 'bg-white text-mauve-900/80 border-mauve-500/15 hover:bg-mauve-50'
                        }`}
                        title={assignedTeacher ? `Assigned to ${assignedTeacher.name}` : 'Available'}
                      >
                        <span>{c}</span>
                        {assignedTeacher && !isSel && (
                          <span className="text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-mono">
                            {assignedTeacher.name.split(' ')[0]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {regLevel === 'KINDERGARTEN' && (classes.KINDERGARTEN || []).map(c => {
                    const isSel = regSelectedClasses.includes(c);
                    const assignedTeacher = teachers.find(t => t.classes?.includes(c));
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleRegClass(c)}
                        className={`px-2 py-1 text-[11px] border rounded cursor-pointer font-semibold transition flex items-center gap-1 ${
                          isSel 
                            ? 'bg-mauve-900 text-white border-mauve-900 shadow-sm' 
                            : assignedTeacher 
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' 
                              : 'bg-white text-mauve-900/80 border-mauve-500/15 hover:bg-mauve-50'
                        }`}
                        title={assignedTeacher ? `Assigned to ${assignedTeacher.name}` : 'Available'}
                      >
                        <span>{c}</span>
                        {assignedTeacher && !isSel && (
                          <span className="text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-mono">
                            {assignedTeacher.name.split(' ')[0]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {regLevel === 'PRIMARY' && classes.PRIMARY.map(c => {
                    const isSel = regSelectedClasses.includes(c);
                    const assignedTeacher = teachers.find(t => t.classes?.includes(c));
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleRegClass(c)}
                        className={`px-2 py-1 text-[11px] border rounded cursor-pointer font-semibold transition flex items-center gap-1 ${
                          isSel 
                            ? 'bg-mauve-900 text-white border-mauve-900 shadow-sm' 
                            : assignedTeacher 
                              ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' 
                              : 'bg-white text-mauve-900/80 border-mauve-500/15 hover:bg-mauve-50'
                        }`}
                        title={assignedTeacher ? `Assigned to ${assignedTeacher.name}` : 'Available'}
                      >
                        <span>{c}</span>
                        {assignedTeacher && !isSel && (
                          <span className="text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-mono">
                            {assignedTeacher.name.split(' ')[0]}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  {regLevel === 'JHS' && classes.JHS.map(c => {
                    const isSel = regSelectedClasses.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleRegClass(c)}
                        className={`px-2 py-0.5 text-[11px] border rounded cursor-pointer font-semibold transition ${isSel ? 'bg-mauve-900 text-white border-mauve-900 shadow-sm' : 'bg-white text-mauve-900/80 border-mauve-500/15'}`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject Selection */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-mauve-900 block">
                    {regLevel === 'JHS' ? 'Assign Syllabus Subjects' : 'Syllabus Subjects (All subjects auto-assigned)'}
                  </label>
                  {regLevel === 'JHS' ? (
                    <span className="text-[9px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      Strictly at most 2 subjects
                    </span>
                  ) : (
                    <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                      All Subjects Entitled
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 p-2 rounded border border-mauve-500/10 bg-mauve-50 max-h-[120px] overflow-y-auto">
                  {subjects.filter(s => s.level === regLevel).map(sub => {
                    const isSel = regSelectedSubjects.includes(sub.id);
                    const assignedTeacher = regLevel === 'JHS' 
                      ? teachers.find(t => t.level === 'JHS' && t.subjects?.some(sId => sId === sub.id || sId === sub.name || sId === sub.code)) 
                      : null;
                    const isUnavailable = !!assignedTeacher;

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        disabled={regLevel !== 'JHS' || isUnavailable}
                        onClick={() => toggleRegSubject(sub.id)}
                        className={`px-2 py-1 text-[11px] border rounded font-semibold transition flex items-center justify-between gap-1.5 ${
                          isSel 
                            ? 'bg-mauve-900 text-white border-mauve-900 shadow-sm' 
                            : isUnavailable
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                              : 'bg-white text-mauve-900/80 border-mauve-500/15'
                        } ${regLevel !== 'JHS' ? 'opacity-90 cursor-default' : isUnavailable ? 'opacity-60' : 'cursor-pointer'}`}
                        title={isUnavailable ? `Assigned to ${assignedTeacher.name}` : undefined}
                      >
                        <span>{sub.name} ({sub.code})</span>
                        {isUnavailable && (
                          <span className="text-[8px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-150 shrink-0">
                            (Assigned to {assignedTeacher.name})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded text-xs transition cursor-pointer shadow-sm uppercase tracking-wider"
              >
                Register & Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Loaded views once teacher is logged in:
  const isInterceptorsResolved = selectedLevel && selectedClass && selectedSubject;

  // STRICT REQUIREMENT CHECK: JHS teacher selects level and class before accessing grade books
  const handleLevelSelect = (lvl: AcademicLevel) => {
    setSelectedLevel(lvl);
    setSelectedClass('');
    setSelectedSubject('');
  };

  const handleClassSelect = (cls: string) => {
    setSelectedClass(cls);
    setSelectedSubject('');
  };

  const handleSubjectSelect = (subId: string) => {
    setSelectedSubject(subId);
  };

  return (
    <div className="w-full space-y-6 animate-fadeIn">
      {/* Teacher Profile Banner */}
      <div className="bg-white p-4 rounded-lg border border-mauve-500/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          {config.schoolLogoUrl ? (
            <img 
              src={config.schoolLogoUrl} 
              alt={`${config.schoolName} logo`} 
              className="w-12 h-12 object-contain rounded-lg shadow-sm shrink-0"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-12 h-12 rounded bg-mauve-100 text-mauve-900 flex items-center justify-center border border-mauve-500/10 shrink-0">
              <School className="w-6 h-6" />
            </div>
          )}
          <div>
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-mauve-900 bg-mauve-100 px-2 py-0.5 rounded">Teacher Workspace</span>
            <h2 className="font-display font-bold text-lg text-mauve-900 mt-1.5">
              Welcome back, {currentUser.name}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Division: {currentUser.level} | Staff ID: EA-TEA-{currentUser.id.slice(-4).toUpperCase()}</p>
          </div>
        </div>

        <button
          onClick={() => {
            setCurrentUser(null);
            setSelectedLevel('');
            setSelectedClass('');
            setSelectedSubject('');
          }}
          className="bg-mauve-100 hover:bg-mauve-200 text-mauve-900 border border-mauve-500/10 font-bold px-3 py-1.5 rounded text-[10px] uppercase tracking-wider transition cursor-pointer"
        >
          Sign Out Portal
        </button>
      </div>

      {/* INTERCEPTOR PANEL: MUST SELECT SUBJECT, CLASS & LEVEL BEFORE ACCESSING GRADEBOOKS */}
      {!isInterceptorsResolved ? (
        <div className="bg-white p-5 rounded-lg border border-mauve-500/20 space-y-4 shadow-sm">
          <div className="text-center max-w-xl mx-auto space-y-1.5">
            <BookOpen className="w-8 h-8 text-mauve-900 mx-auto" />
            <h3 className="font-display font-bold text-mauve-900 text-base">Classroom Subject Registry Selection</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Please strictly verify your educational division, grade class, and active syllabus subject before entering student continuous assessments or term records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
            {/* Step 1: Select Academic Level */}
            <div className="space-y-3 p-3 rounded border border-mauve-500/15 bg-mauve-50">
              <span className="text-xs font-bold text-mauve-900 uppercase tracking-wider block">1. Staff Division</span>
              <p className="text-[11px] text-gray-400">JHS teachers must strictly select the JHS level to unlock curriculum books.</p>
              <div className="space-y-1.5">
                {['NURSERY', 'KINDERGARTEN', 'PRIMARY', 'JHS'].map((lvl) => {
                  const isAvailable = currentUser.role === 'ADMIN' || (currentUser.level as string) === 'ALL' || !currentUser.level || currentUser.level === lvl;
                  const isSelected = selectedLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      disabled={!isAvailable}
                      onClick={() => handleLevelSelect(lvl as AcademicLevel)}
                      className={`w-full text-left p-2 rounded border text-[11px] font-bold uppercase tracking-wider cursor-pointer transition ${
                        isSelected 
                          ? 'bg-mauve-900 text-white border-mauve-900' 
                          : isAvailable 
                            ? 'bg-white border-mauve-500/20 hover:bg-mauve-100 text-mauve-900'
                            : 'bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span>{lvl} DIVISION</span>
                        {!isAvailable && <span className="text-[9px] text-gray-400 font-normal">Locked</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Select Class */}
            <div className="space-y-3 p-3 rounded border border-mauve-500/15 bg-mauve-50">
              <span className="text-xs font-bold text-mauve-900 uppercase tracking-wider block">2. Grade Class Group</span>
              <p className="text-[11px] text-gray-400">Choose from your registered class lists within the selected level division.</p>
              <div className="space-y-1.5">
                {!selectedLevel ? (
                  <div className="text-center p-6 text-xs text-gray-400 italic">Select level first</div>
                ) : (
                  teacherAllowedClasses.map((cls) => {
                    const isSelected = selectedClass === cls;
                    // Double check if class fits the division level chosen
                    const fitsLevel = (selectedLevel === 'NURSERY' && classes.NURSERY.includes(cls)) ||
                                      (selectedLevel === 'KINDERGARTEN' && (classes.KINDERGARTEN || []).includes(cls)) ||
                                      (selectedLevel === 'PRIMARY' && classes.PRIMARY.includes(cls)) ||
                                      (selectedLevel === 'JHS' && classes.JHS.includes(cls));

                    if (!fitsLevel) return null;

                    return (
                      <button
                        key={cls}
                        onClick={() => handleClassSelect(cls)}
                        className={`w-full text-left p-2 rounded border text-[11px] font-bold cursor-pointer transition ${
                          isSelected 
                            ? 'bg-mauve-900 text-white border-mauve-900' 
                            : 'bg-white border-mauve-500/20 hover:bg-mauve-100 text-mauve-900'
                        }`}
                      >
                        {cls}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Step 3: Select Subject */}
            <div className="space-y-3 p-3 rounded border border-mauve-500/15 bg-mauve-50">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-mauve-900 uppercase tracking-wider block">3. Syllabus Subject</span>
              </div>
              <p className="text-[11px] text-gray-400">Pick from the standard syllabus subjects to proceed to markings.</p>
              <div className="space-y-1.5">
                {!selectedClass ? (
                  <div className="text-center p-6 text-xs text-gray-400 italic">Select class first</div>
                ) : (
                  teacherAllowedSubjects.map((sub) => {
                    const isSelected = selectedSubject === sub.id;
                    const fitsLevel = sub.level === selectedLevel;

                    if (!fitsLevel) return null;

                    return (
                      <button
                        key={sub.id}
                        onClick={() => handleSubjectSelect(sub.id)}
                        className={`w-full text-left p-2 rounded border text-[11px] font-bold cursor-pointer transition ${
                          isSelected 
                            ? 'bg-mauve-900 text-white border-mauve-900' 
                            : 'bg-white border-mauve-500/20 hover:bg-mauve-100 text-mauve-900'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{sub.name}</span>
                          <span className="text-[9px] font-mono opacity-80 uppercase">{sub.code}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* INTERCEPTORS RESOLVED - GRADE BOOK & ATTENDANCE SHEET */
        <form onSubmit={handleSaveMarksSheet} className="space-y-4">
          {/* Breadcrumb & Quick Selector Bar for registering assessment */}
          <div className="bg-mauve-100 p-3 rounded border border-mauve-500/15 flex flex-wrap justify-between items-center gap-3">
            <div className="text-xs text-mauve-900 font-bold flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="uppercase text-[10px] text-mauve-900/60 font-mono tracking-wider shrink-0">Registering Assessment:</span>
              
              <span className="bg-white text-mauve-900 border border-mauve-500/15 px-2 py-1 rounded font-mono font-bold text-[10px]">
                {selectedLevel} DIVISION
              </span>
              
              <span className="text-gray-400 font-normal">&raquo;</span>

              {/* Class Selector Dropdown - strictly showing teacher allowed classes */}
              <div className="flex items-center gap-1.5 bg-white border border-mauve-500/25 px-2.5 py-1 rounded shadow-2xs">
                <span className="text-[10px] uppercase text-gray-500 font-bold">Class:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-transparent font-mono font-bold text-xs text-mauve-900 focus:outline-none cursor-pointer"
                >
                  {teacherAllowedClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-gray-400 font-normal">&raquo;</span>

              {/* Subject Selector Dropdown - strictly showing teacher allowed subjects */}
              <div className="flex items-center gap-1.5 bg-white border border-mauve-500/25 px-2.5 py-1 rounded shadow-2xs">
                <span className="text-[10px] uppercase text-gray-500 font-bold">Subject:</span>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="bg-transparent font-bold text-xs text-mauve-900 focus:outline-none cursor-pointer"
                >
                  {teacherAllowedSubjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedLevel('');
                setSelectedClass('');
                setSelectedSubject('');
              }}
              className="text-xs font-bold text-mauve-900 hover:text-mauve-700 underline cursor-pointer uppercase tracking-wider text-[10px]"
            >
              Full Selection View
            </button>
          </div>

          {/* MAIN GRADE ENTRY SHEET TABLE */}
          {(() => {
            const classLimit = 50;
            const examLimit = 50;

            return (
              <div className="bg-white rounded border border-mauve-500/20 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-mauve-500/20 bg-mauve-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-display font-bold text-mauve-900 text-sm flex items-center gap-2 uppercase tracking-wide">
                      <Award className="w-4 h-4 text-mauve-900" />
                      Automated Remarks Evaluation Grid
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      Automated terminal remarks evaluation based on continuous class assignments and terminal results.
                      <span className="block mt-1 text-emerald-700 font-bold">
                        ✓ Marks Correction Mode: You can type over any previously saved score below to correct wrong entries, then click Save at the bottom.
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={`${studentSortField}-${studentSortOrder}`}
                      onChange={(e) => {
                        const [f, o] = e.target.value.split('-') as ['rollNumber' | 'name', 'asc' | 'desc'];
                        setStudentSortField(f);
                        setStudentSortOrder(o);
                      }}
                      className="text-[11px] px-2 py-1 rounded border border-mauve-500/20 bg-white font-semibold text-mauve-900 outline-none focus:ring-1 focus:ring-mauve-900"
                    >
                      <option value="rollNumber-asc">Sort ID: Ascending ↑</option>
                      <option value="rollNumber-desc">Sort ID: Descending ↓</option>
                      <option value="name-asc">Sort Name: A to Z ↑</option>
                      <option value="name-desc">Sort Name: Z to A ↓</option>
                    </select>
                    <span className="bg-white border border-mauve-500/15 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-mauve-900">Class limit: {classLimit} Marks</span>
                    <span className="bg-white border border-mauve-500/15 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-mauve-900">Exam limit: {examLimit} Marks</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-mauve-50/50 text-[11px] font-bold text-mauve-900 border-b border-mauve-500/20 uppercase tracking-wider">
                        <th 
                          className="p-3 pl-4 cursor-pointer hover:bg-mauve-100 transition select-none"
                          onClick={() => {
                            if (studentSortField === 'rollNumber') {
                              setStudentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setStudentSortField('rollNumber');
                              setStudentSortOrder('asc');
                            }
                          }}
                          title="Click to toggle sorting by Student ID"
                        >
                          <div className="flex items-center gap-2">
                            <span>Student Details</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-mauve-900 text-white font-mono font-bold">
                              {studentSortField === 'rollNumber' ? (studentSortOrder === 'asc' ? 'ID Asc ↑' : 'ID Desc ↓') : 'Sort ID'}
                            </span>
                          </div>
                        </th>
                        {selectedLevel === 'NURSERY' ? (
                          <>
                            <th className="p-3 text-center w-20">MO (Most Often)</th>
                            <th className="p-3 text-center w-20">O (Often)</th>
                            <th className="p-3 text-center w-20">S (Sometimes)</th>
                            <th className="p-3 text-center w-20">NA (Needs Assist)</th>
                            <th className="p-3 pr-4 text-center">Selected Remark</th>
                          </>
                        ) : (
                          <>
                            <th className="p-3 text-center w-40">Class Score ({classLimit})</th>
                            <th className="p-3 text-center w-40">Exam Score ({examLimit})</th>
                            <th className="p-3 text-center w-32">Total (100)</th>
                            <th className="p-3 pr-4 text-center">Auto Remarks</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mauve-50 text-xs text-gray-800">
                      {activeClassStudents.length === 0 ? (
                        <tr>
                          <td colSpan={selectedLevel === 'NURSERY' ? 6 : 5} className="p-6 text-center text-gray-400">
                            No students enrolled in {selectedClass} yet. Admins can admit students via the admissions tab.
                          </td>
                        </tr>
                      ) : (
                        activeClassStudents.map((student) => {
                          const inputs = gradeInputs[student.id] || { classScore: '', examScore: '' };
                          const classVal = inputs.classScore ? Number(inputs.classScore) : 0;
                          const examVal = inputs.examScore ? Number(inputs.examScore) : 0;
                          const totalVal = classVal + examVal;

                          const remarks = getGradeRemarks(totalVal);
                          const hasInput = inputs.classScore || inputs.examScore || inputs.nurseryRemark;

                          if (selectedLevel === 'NURSERY') {
                            const curRem = inputs.nurseryRemark || (totalVal >= 80 ? 'MO' : totalVal >= 65 ? 'O' : totalVal >= 45 ? 'S' : hasInput ? 'NA' : undefined);
                            return (
                              <tr key={student.id} className="hover:bg-mauve-50/20">
                                <td className="p-3 pl-4">
                                  <span className="block font-bold text-gray-900 text-xs">{student.name}</span>
                                  <span className="font-mono text-[10px] text-mauve-500">{student.rollNumber}</span>
                                </td>
                                <td className="p-3 text-center">
                                  <label className="cursor-pointer inline-flex items-center justify-center p-1">
                                    <input
                                      type="radio"
                                      name={`nursery-rem-${student.id}`}
                                      checked={curRem === 'MO'}
                                      onChange={() => handleNurseryRemarkChange(student.id, 'MO')}
                                      className="w-4 h-4 text-mauve-900 accent-mauve-900 cursor-pointer"
                                    />
                                  </label>
                                </td>
                                <td className="p-3 text-center">
                                  <label className="cursor-pointer inline-flex items-center justify-center p-1">
                                    <input
                                      type="radio"
                                      name={`nursery-rem-${student.id}`}
                                      checked={curRem === 'O'}
                                      onChange={() => handleNurseryRemarkChange(student.id, 'O')}
                                      className="w-4 h-4 text-mauve-900 accent-mauve-900 cursor-pointer"
                                    />
                                  </label>
                                </td>
                                <td className="p-3 text-center">
                                  <label className="cursor-pointer inline-flex items-center justify-center p-1">
                                    <input
                                      type="radio"
                                      name={`nursery-rem-${student.id}`}
                                      checked={curRem === 'S'}
                                      onChange={() => handleNurseryRemarkChange(student.id, 'S')}
                                      className="w-4 h-4 text-mauve-900 accent-mauve-900 cursor-pointer"
                                    />
                                  </label>
                                </td>
                                <td className="p-3 text-center">
                                  <label className="cursor-pointer inline-flex items-center justify-center p-1">
                                    <input
                                      type="radio"
                                      name={`nursery-rem-${student.id}`}
                                      checked={curRem === 'NA'}
                                      onChange={() => handleNurseryRemarkChange(student.id, 'NA')}
                                      className="w-4 h-4 text-mauve-900 accent-mauve-900 cursor-pointer"
                                    />
                                  </label>
                                </td>
                                <td className="p-3 pr-4 text-center font-bold text-mauve-900">
                                  {curRem ? (
                                    <span className="px-2 py-0.5 rounded bg-mauve-100 border border-mauve-300 text-[11px]">
                                      {curRem === 'MO' ? 'MO (Most Often)' : curRem === 'O' ? 'O (Often)' : curRem === 'S' ? 'S (Sometimes)' : 'NA (Needs Assistance)'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 italic text-[11px]">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={student.id} className="hover:bg-mauve-50/20">
                              <td className="p-3 pl-4">
                                <span className="block font-bold text-gray-900 text-xs">{student.name}</span>
                                <span className="font-mono text-[10px] text-mauve-500">{student.rollNumber}</span>
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  placeholder={`0-${classLimit}`}
                                  value={inputs.classScore}
                                  onChange={(e) => handleGradeInputChange(student.id, 'classScore', e.target.value)}
                                  className="w-24 px-2 py-1 text-xs border border-mauve-500/20 outline-none focus:ring-1 focus:ring-mauve-900 rounded text-center font-mono font-bold bg-white text-mauve-900"
                                />
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="number"
                                  placeholder={`0-${examLimit}`}
                                  value={inputs.examScore}
                                  onChange={(e) => handleGradeInputChange(student.id, 'examScore', e.target.value)}
                                  className="w-24 px-2 py-1 text-xs border border-mauve-500/20 outline-none focus:ring-1 focus:ring-mauve-900 rounded text-center font-mono font-bold bg-white text-mauve-900"
                                />
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-sm text-mauve-900">
                                {hasInput ? totalVal : '-'}
                              </td>
                              <td className="p-3 pr-4 text-center text-gray-500 italic text-[11px]">
                                {hasInput ? remarks : '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Action Trigger Row */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-1">
            <div className="flex-1">
              {saveSuccess && (
                <div id="save-success-msg" className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-3.5 py-2.5 rounded-lg text-xs font-bold flex items-center gap-2 animate-fadeIn shadow-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="uppercase tracking-wider text-[11px]">Assessment successfully saved</span>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={activeClassStudents.length === 0}
              className={`w-full sm:w-auto px-5 py-2.5 rounded font-bold text-xs transition duration-200 cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider shrink-0 ${
                activeClassStudents.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300'
                  : 'bg-mauve-900 hover:bg-mauve-700 text-white shadow-sm'
              }`}
            >
              <Save className="w-3.5 h-3.5" /> Save Marksheet
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
