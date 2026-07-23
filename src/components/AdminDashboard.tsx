/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Student, User, Subject, ReportConfig, Grade, Attendance, AcademicLevel } from '../types';
import { Users, GraduationCap, School, BookOpen, Settings, Search, Plus, Edit2, Trash2, Sliders, Check, AlertCircle, FileSpreadsheet, Upload, Download, Image as ImageIcon, X, LogOut, ChevronRight, HelpCircle, Lock, Share2, MessageSquare, Mail, Phone, ArrowUpRight, Calendar, Sparkles } from 'lucide-react';
import ReportPDF from './ReportPDF';
import { getSupabaseCredentials, getSupabaseClient, deleteSupabaseStudent, deleteSupabaseTeacher } from '../lib/supabase';
import { createBatchEmailDispatchList, generateEmailReportBody, generateBatchEmailDigest } from '../services/emailDispatcher';
import { promoteStudents, getNextClassAndLevel, isAutoPromotionDue } from '../services/promotionService';

interface AdminDashboardProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  teachers: User[];
  setTeachers: React.Dispatch<React.SetStateAction<User[]>>;
  subjects: Subject[];
  grades: Grade[];
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  config: ReportConfig;
  setConfig: React.Dispatch<React.SetStateAction<ReportConfig>>;
  classes: { NURSERY: string[]; KINDERGARTEN?: string[]; PRIMARY: string[]; JHS: string[] };
  onSignOut?: () => void;
  supabaseStatus?: { isConfigured: boolean; isConnected: boolean; message: string };
  isSupabaseSyncing?: boolean;
  onPullFromSupabase?: () => Promise<boolean>;
  onPushToSupabase?: () => Promise<boolean>;
  onCheckSupabaseStatus?: () => Promise<boolean>;
  storedAdminPassword?: string;
  onUpdateAdminPassword?: (newPass: string) => void;
}


type AdminTab = 'analytics' | 'transcripts' | 'students' | 'teachers' | 'config';

export default function AdminDashboard({
  students,
  setStudents,
  teachers,
  setTeachers,
  subjects,
  grades,
  attendance,
  setAttendance,
  config,
  setConfig,
  classes,
  onSignOut,
  supabaseStatus,
  isSupabaseSyncing,
  onPullFromSupabase,
  onPushToSupabase,
  onCheckSupabaseStatus,
  storedAdminPassword = 'adminSecure2026!',
  onUpdateAdminPassword = () => {}
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');

  // School logo upload states
  const [logoDragActive, setLogoDragActive] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState('');

  // Search, Filter and Sort States
  const [studentSearch, setStudentSearch] = useState('');
  const [studentLevelFilter, setStudentLevelFilter] = useState<string>('ALL');
  const [studentClassFilter, setStudentClassFilter] = useState<string>('ALL');
  const [studentSortField, setStudentSortField] = useState<'rollNumber' | 'name'>('rollNumber');
  const [studentSortOrder, setStudentSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modal / Form States
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({
    name: '',
    rollNumber: '',
    level: 'PRIMARY' as AcademicLevel,
    className: 'Primary 1',
    guardianName: '',
    guardianEmail: '',
    guardianPhone: ''
  });

  // Teacher Registration Form State
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: '',
    email: '',
    level: 'PRIMARY' as AcademicLevel,
    classes: [] as string[],
    subjects: [] as string[]
  });
  const [teacherError, setTeacherError] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);

  // Transcript Selector state
  const [selectedClass, setSelectedClass] = useState('Primary 4');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [showBatchEmailModal, setShowBatchEmailModal] = useState(false);
  const [batchCopiedMsg, setBatchCopiedMsg] = useState(false);

  // Automated Bulk Email Dispatcher states
  const [batchNote, setBatchNote] = useState('');
  const [isBulkDispatching, setIsBulkDispatching] = useState(false);
  const [bulkDispatchIndex, setBulkDispatchIndex] = useState(-1);
  const [bulkDispatchStatus, setBulkDispatchStatus] = useState<Record<string, 'SENT' | 'SKIPPED' | 'PENDING'>>({});
  const [showCopiedDigestMsg, setShowCopiedDigestMsg] = useState(false);

  // First Term Promotion states
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionSuccessMsg, setPromotionSuccessMsg] = useState('');
  const [promotionSearchQuery, setPromotionSearchQuery] = useState('');

  const handleExecutePromotion = (targetYear?: string) => {
    const activeYear = targetYear || config.schoolYear;
    const result = promoteStudents(students, activeYear);
    
    setStudents(result.promotedStudents);
    
    const updatedConfig: ReportConfig = {
      ...config,
      lastPromotedYear: activeYear
    };
    setConfig(updatedConfig);
    
    localStorage.setItem('ea_students', JSON.stringify(result.promotedStudents));
    localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
    if (getSupabaseCredentials().isConfigured) {
      onPushToSupabase?.();
    }

    setPromotionSuccessMsg(`🎓 Promotion complete! Migrated ${result.promotedCount} pupils (${result.graduatedCount} JHS graduates) for ${activeYear}.`);
    setTimeout(() => setPromotionSuccessMsg(''), 8000);
    setShowPromotionModal(false);
  };

  // Deletion confirmation states
  const [confirmDeleteStudentId, setConfirmDeleteStudentId] = useState<string | null>(null);
  const [confirmDeleteTeacherId, setConfirmDeleteTeacherId] = useState<string | null>(null);

  // Admin password change states
  const [currentAdminPassInput, setCurrentAdminPassInput] = useState('');
  const [newAdminPassInput, setNewAdminPassInput] = useState('');
  const [confirmAdminPassInput, setConfirmAdminPassInput] = useState('');
  const [adminPassError, setAdminPassError] = useState('');
  const [adminPassSuccess, setAdminPassSuccess] = useState('');

  const handleAdminPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminPassError('');
    setAdminPassSuccess('');

    if (!currentAdminPassInput || !newAdminPassInput || !confirmAdminPassInput) {
      setAdminPassError('Please fill in all password fields.');
      return;
    }

    if (currentAdminPassInput !== storedAdminPassword) {
      setAdminPassError('Incorrect current security password.');
      return;
    }

    if (newAdminPassInput.length < 6) {
      setAdminPassError('New password must be at least 6 characters long.');
      return;
    }

    if (newAdminPassInput !== confirmAdminPassInput) {
      setAdminPassError('New passwords do not match.');
      return;
    }

    onUpdateAdminPassword(newAdminPassInput);
    setAdminPassSuccess('Admin security password changed successfully!');
    setCurrentAdminPassInput('');
    setNewAdminPassInput('');
    setConfirmAdminPassInput('');
  };


  // Logo upload helper functions
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setLogoDragActive(true);
    } else if (e.type === "dragleave") {
      setLogoDragActive(false);
    }
  };

  const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/png', 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.onerror = () => {
          resolve(e.target?.result as string);
        };
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        resolve('');
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoFile = async (file: File) => {
    setLogoUploadError('');
    if (!file.type.startsWith('image/')) {
      setLogoUploadError('Unsupported file type. Please upload an image file (PNG, JPG, or JPEG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoUploadError('Image file too large. Please upload an image under 2MB.');
      return;
    }

    const client = getSupabaseClient();
    if (client) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `logo-${Date.now()}.${fileExt}`;
        const filePath = `logos/${fileName}`;

        // Upload directly to the 'ea' storage bucket
        const { error } = await client.storage.from('ea').upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

        if (error) {
          throw error;
        }

        // Retrieve public URL
        const { data: { publicUrl } } = client.storage.from('ea').getPublicUrl(filePath);
        
        setConfig(prev => ({
          ...prev,
          schoolLogoUrl: publicUrl
        }));
        return; // Success, bypass base64 fallback
      } catch (err: any) {
        console.warn('Could not upload to Supabase Storage, falling back to base64:', err.message || err);
      }
    }

    // Local Compressed Base64 Fallback (ensures tiny size for perfect DB synchronization)
    try {
      const resizedBase64 = await resizeImage(file, 150, 150);
      if (resizedBase64) {
        setConfig(prev => ({
          ...prev,
          schoolLogoUrl: resizedBase64
        }));
      } else {
        setLogoUploadError('Failed to read and process image.');
      }
    } catch (err) {
      setLogoUploadError('Failed to process image. Try a different file.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLogoDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoFile(e.dataTransfer.files[0]);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleLogoFile(e.target.files[0]);
    }
  };

  const handleClearLogo = () => {
    setConfig(prev => {
      const copy = { ...prev };
      delete copy.schoolLogoUrl;
      return copy;
    });
    setLogoUploadError('');
  };

  // 1. CALCULATE ANALYTICS
  const totalStudents = students.length;
  const totalTeachers = teachers.filter((t) => t.role === 'TEACHER').length;
  const kgClasses = classes.KINDERGARTEN || [];
  const nurseryStudentsCount = students.filter((s) => s.level === 'NURSERY').length;
  const kgStudentsCount = students.filter((s) => s.level === 'KINDERGARTEN').length;
  const primaryStudentsCount = students.filter((s) => s.level === 'PRIMARY').length;
  const jhsStudentsCount = students.filter((s) => s.level === 'JHS').length;

  // Class Lists for dropdown queries
  const allClassNames = [...classes.NURSERY, ...kgClasses, ...classes.PRIMARY, ...classes.JHS];

  // Calculate Overall Averages
  const levelAverages = (level: AcademicLevel) => {
    const levelStudentIds = students.filter((s) => s.level === level).map((s) => s.id);
    const levelGrades = grades.filter((g) => levelStudentIds.includes(g.studentId));
    if (levelGrades.length === 0) return 0;
    return levelGrades.reduce((sum, g) => sum + g.totalScore, 0) / levelGrades.length;
  };

  const overallAvg = grades.length > 0 ? (grades.reduce((sum, g) => sum + g.totalScore, 0) / grades.length) : 0;

  // Helper to dynamically auto-generate Roll / Register ID
  const getAutoRollNumber = (level: AcademicLevel, className: string) => {
    let classAbbr = '';
    const nameLower = className.toLowerCase();
    if (nameLower.includes('nursery 1')) classAbbr = 'N1';
    else if (nameLower.includes('nursery 2')) classAbbr = 'N2';
    else if (nameLower.includes('kindergarten 1') || nameLower.includes('kg 1')) classAbbr = 'KG1';
    else if (nameLower.includes('kindergarten 2') || nameLower.includes('kg 2')) classAbbr = 'KG2';
    else if (nameLower.includes('primary')) {
      const num = nameLower.replace(/[^0-9]/g, '');
      classAbbr = `P${num || '1'}`;
    } else if (nameLower.includes('jhs')) {
      const num = nameLower.replace(/[^0-9]/g, '');
      classAbbr = `J${num || '1'}`;
    } else {
      classAbbr = level.substring(0, 3).toUpperCase();
    }

    const year = '2026';
    const classStudentsCount = students.filter(s => s.className === className).length;
    const nextSeq = String(classStudentsCount + 1).padStart(3, '0');

    return `EA/${classAbbr}/${year}/${nextSeq}`;
  };

  // 2. STUDENT DIRECTORY LOGIC
  const handleAddOrEditStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name || !studentForm.rollNumber) {
      alert('Please fill out Name and Roll Number');
      return;
    }

    if (editingStudent) {
      // Edit Student
      setStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, ...studentForm } : s));
    } else {
      // Add Student
      const newStudent: Student = {
        id: `st-${Date.now()}`,
        name: studentForm.name,
        rollNumber: studentForm.rollNumber,
        level: studentForm.level,
        className: studentForm.className,
        guardianName: studentForm.guardianName,
        guardianEmail: studentForm.guardianEmail,
        guardianPhone: studentForm.guardianPhone
      };
      setStudents(prev => [...prev, newStudent]);
    }

    // Reset Form
    setStudentForm({
      name: '',
      rollNumber: '',
      level: 'PRIMARY',
      className: 'Primary 1',
      guardianName: '',
      guardianEmail: '',
      guardianPhone: ''
    });
    setEditingStudent(null);
    setShowStudentModal(false);
  };

  const triggerEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      rollNumber: student.rollNumber,
      level: student.level,
      className: student.className,
      guardianName: student.guardianName,
      guardianEmail: student.guardianEmail,
      guardianPhone: student.guardianPhone || ''
    });
    setShowStudentModal(true);
  };

  const handleDeleteStudent = async (id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
    if (selectedStudentId === id) setSelectedStudentId('');
    
    // Explicitly delete from Supabase if configured
    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      await deleteSupabaseStudent(id);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
    
    // Explicitly delete from Supabase if configured
    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      await deleteSupabaseTeacher(id);
    }
  };

  // Adjust class list in form dynamically based on chosen level
  const handleLevelChangeInForm = (level: AcademicLevel) => {
    const defaultClass = level === 'NURSERY' 
      ? classes.NURSERY[0] 
      : level === 'KINDERGARTEN'
        ? (kgClasses[0] || 'Kindergarten 1')
        : level === 'PRIMARY' 
          ? classes.PRIMARY[0] 
          : classes.JHS[0];
    const autoRoll = getAutoRollNumber(level, defaultClass);
    setStudentForm(prev => ({
      ...prev,
      level,
      className: defaultClass,
      rollNumber: editingStudent ? prev.rollNumber : autoRoll
    }));
  };

  // 3. TEACHER DIRECTORY LOGIC
  const handleRegisterTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherError('');

    if (!teacherForm.name || !teacherForm.email) {
      setTeacherError('Please enter Name and Email address.');
      return;
    }

    // STRICT CONSTRAINT CHECK: JHS Teachers handle at most 2 subjects
    if (teacherForm.level === 'JHS' && teacherForm.subjects.length > 2) {
      setTeacherError('Strict Constraint: Junior High School (JHS) teachers must handle AT MOST TWO subjects.');
      return;
    }

    if (teacherForm.level === 'NURSERY' || teacherForm.level === 'KINDERGARTEN' || teacherForm.level === 'PRIMARY') {
      if (teacherForm.classes.length > 1) {
        setTeacherError('Academy Staff Policy: Nursery, KG, and Primary division teachers cannot be assigned to more than one class.');
        return;
      }
      for (const cls of teacherForm.classes) {
        const assignedTeacher = teachers.find(t => t.id !== editingTeacher?.id && t.classes?.includes(cls));
        if (assignedTeacher) {
          setTeacherError(`Class Assignment Conflict: "${cls}" is already assigned to ${assignedTeacher.name}. In Nursery, KG, and Primary divisions, a class cannot be assigned to more than one teacher.`);
          return;
        }
      }
    }

    const finalSubjects = (teacherForm.level === 'NURSERY' || teacherForm.level === 'KINDERGARTEN' || teacherForm.level === 'PRIMARY')
      ? subjects.filter(s => s.level === teacherForm.level).map(s => s.id)
      : teacherForm.subjects;

    if (finalSubjects.length === 0) {
      setTeacherError('Please select at least one subject to assign to the teacher.');
      return;
    }

    if (teacherForm.classes.length === 0) {
      setTeacherError('Please select at least one class to assign to the teacher.');
      return;
    }

    if (editingTeacher) {
      // Edit Teacher
      const emailToCheck = teacherForm.email.trim().toLowerCase();
      if (teachers.some(t => t.id !== editingTeacher.id && t.email.trim().toLowerCase() === emailToCheck)) {
        setTeacherError('A teacher with this email address is already registered.');
        return;
      }
      setTeachers(prev => prev.map(t => t.id === editingTeacher.id ? {
        ...t,
        name: teacherForm.name,
        email: teacherForm.email.trim(),
        level: teacherForm.level,
        classes: teacherForm.classes,
        subjects: finalSubjects
      } : t));
      setEditingTeacher(null);
    } else {
      // Add new Teacher
      const emailToCheck = teacherForm.email.trim().toLowerCase();
      if (teachers.some(t => t.email.trim().toLowerCase() === emailToCheck)) {
        setTeacherError('A teacher with this email address is already registered.');
        return;
      }
      const newTeacher: User = {
        id: `user-t-${Date.now()}`,
        name: teacherForm.name,
        email: teacherForm.email.trim(),
        role: 'TEACHER',
        level: teacherForm.level,
        classes: teacherForm.classes,
        subjects: finalSubjects,
        password: 'teacher123'
      };
      setTeachers(prev => [...prev, newTeacher]);
    }

    // Reset
    setTeacherForm({
      name: '',
      email: '',
      level: 'PRIMARY',
      classes: [],
      subjects: subjects.filter(s => s.level === 'PRIMARY').map(s => s.id)
    });
    setShowTeacherModal(false);
  };

  const toggleClassForTeacherForm = (className: string) => {
    if (teacherForm.level === 'NURSERY' || teacherForm.level === 'KINDERGARTEN' || teacherForm.level === 'PRIMARY') {
      const assignedTeacher = teachers.find(t => t.id !== editingTeacher?.id && t.classes?.includes(className));
      if (assignedTeacher && !teacherForm.classes.includes(className)) {
        setTeacherError(`Cannot select "${className}": Already assigned to ${assignedTeacher.name}. In Nursery, KG, and Primary, a class cannot be assigned to more than one teacher.`);
      } else {
        setTeacherError('');
      }
    }
    setTeacherForm(prev => {
      if (prev.level === 'NURSERY' || prev.level === 'KINDERGARTEN' || prev.level === 'PRIMARY') {
        const alreadySelected = prev.classes.includes(className);
        return {
          ...prev,
          classes: alreadySelected ? [] : [className]
        };
      }
      const alreadySelected = prev.classes.includes(className);
      return {
        ...prev,
        classes: alreadySelected 
          ? prev.classes.filter(c => c !== className)
          : [...prev.classes, className]
      };
    });
  };

  const toggleSubjectForTeacherForm = (subId: string) => {
    setTeacherForm(prev => {
      if (prev.level === 'NURSERY' || prev.level === 'KINDERGARTEN' || prev.level === 'PRIMARY') {
        return prev; // Entitled to all subjects, lock selection
      }
      const alreadySelected = prev.subjects.includes(subId);
      let updated = [...prev.subjects];
      if (alreadySelected) {
        updated = updated.filter(s => s !== subId);
      } else {
        // Limit to 2 if JHS
        if (prev.level === 'JHS' && prev.subjects.length >= 2) {
          alert('Junior High School (JHS) teachers are restricted to a maximum of two subjects.');
          return prev;
        }
        // Conflict Check with both ID, name, and code
        const subObj = subjects.find(s => s.id === subId);
        const conflictingTeacher = teachers.find(t => 
          t.level === 'JHS' && 
          t.subjects?.some(sId => sId === subId || (subObj && (sId === subObj.name || sId === subObj.code))) && 
          (!editingTeacher || t.id !== editingTeacher.id)
        );
        if (conflictingTeacher) {
          alert(`Strict Rule: This subject is already assigned to JHS teacher: ${conflictingTeacher.name}. Each JHS subject must only be assigned to a single teacher. Please edit that teacher first to remove/change it.`);
          return prev;
        }
        updated.push(subId);
      }
      return { ...prev, subjects: updated };
    });
  };

  const handleTeacherLevelChange = (level: AcademicLevel) => {
    const levelSubjects = (level === 'NURSERY' || level === 'KINDERGARTEN' || level === 'PRIMARY')
      ? subjects.filter(s => s.level === level).map(s => s.id)
      : [];
    setTeacherForm(prev => ({
      ...prev,
      level,
      classes: [],
      subjects: levelSubjects
    }));
  };

  // Filter and sort students for Directory
  const filteredStudents = students
    .filter((s) => {
      const matchesSearch = s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                            s.rollNumber.toLowerCase().includes(studentSearch.toLowerCase()) ||
                            s.guardianName.toLowerCase().includes(studentSearch.toLowerCase());
      const matchesLevel = studentLevelFilter === 'ALL' || s.level === studentLevelFilter;
      const matchesClass = studentClassFilter === 'ALL' || s.className === studentClassFilter;
      return matchesSearch && matchesLevel && matchesClass;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (studentSortField === 'rollNumber') {
        comparison = a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
      } else {
        comparison = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      }
      return studentSortOrder === 'asc' ? comparison : -comparison;
    });

  // Transcript selector helpers
  const studentsInSelectedClass = students
    .filter((s) => s.className === selectedClass)
    .sort((a, b) => {
      const comp = a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
      return studentSortOrder === 'asc' ? comp : -comp;
    });
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // When class changes in transcript selector, auto-select first student in that class
  const handleClassChangeInTranscriptSelector = (cls: string) => {
    setSelectedClass(cls);
    const firstStudent = students.find((s) => s.className === cls);
    if (firstStudent) {
      setSelectedStudentId(firstStudent.id);
    } else {
      setSelectedStudentId('');
    }
  };

  // Helper to compute student statistics for email report cards
  const getStudentStatsForEmail = (studentId: string) => {
    const targetStudent = students.find(s => s.id === studentId);
    if (!targetStudent) return undefined;

    const sameClassStudents = students.filter(s => s.className === targetStudent.className);
    const classStudentTotals = sameClassStudents.map(st => {
      const stGrades = grades.filter(g => g.studentId === st.id);
      const total = stGrades.reduce((sum, g) => sum + (g.totalScore || 0), 0);
      const avg = stGrades.length > 0 ? total / stGrades.length : 0;
      return { studentId: st.id, total, avg };
    });

    classStudentTotals.sort((a, b) => b.total - a.total);
    const rankIndex = classStudentTotals.findIndex(item => item.studentId === studentId);
    const studentData = classStudentTotals.find(item => item.studentId === studentId);
    const attRecord = attendance.find(a => a.studentId === studentId);

    return {
      totalScore: studentData?.total || 0,
      averageScore: studentData?.avg || 0,
      classRank: rankIndex >= 0 ? rankIndex + 1 : undefined,
      totalStudents: sameClassStudents.length,
      attendanceSummary: attRecord ? `${attRecord.daysPresent} present out of ${attRecord.totalDays} academic days` : undefined
    };
  };

  const handleStartAutoBulkDispatch = () => {
    const dispatchList = createBatchEmailDispatchList(studentsInSelectedClass, config, getStudentStatsForEmail, batchNote);
    const eligibleItems = dispatchList.filter(item => item.hasEmail);

    if (eligibleItems.length === 0) {
      alert('No pupils in this class have valid guardian email addresses stored.');
      return;
    }

    setIsBulkDispatching(true);
    setBulkDispatchIndex(0);

    const newStatusMap: Record<string, 'SENT' | 'SKIPPED' | 'PENDING'> = {};
    dispatchList.forEach(item => {
      newStatusMap[item.student.id] = item.hasEmail ? 'PENDING' : 'SKIPPED';
    });
    setBulkDispatchStatus(newStatusMap);

    let idx = 0;
    const interval = setInterval(() => {
      if (idx < eligibleItems.length) {
        const item = eligibleItems[idx];
        window.open(item.mailtoUrl, '_blank');

        setBulkDispatchStatus(prev => ({
          ...prev,
          [item.student.id]: 'SENT'
        }));
        setBulkDispatchIndex(idx + 1);
        idx++;
      } else {
        clearInterval(interval);
        setIsBulkDispatching(false);
      }
    }, 1200);
  };

  const handleCopyBulkDigest = () => {
    const digestText = generateBatchEmailDigest(studentsInSelectedClass, config, getStudentStatsForEmail, batchNote);
    navigator.clipboard.writeText(digestText);
    setShowCopiedDigestMsg(true);
    setTimeout(() => setShowCopiedDigestMsg(false), 3000);
  };

  const handleOpenGroupedBCCMailer = () => {
    const validEmails = studentsInSelectedClass
      .map(s => s.guardianEmail)
      .filter(e => e && e.includes('@'));

    if (validEmails.length === 0) {
      alert('No valid guardian emails in this class.');
      return;
    }

    const bccList = validEmails.join(',');
    const subject = encodeURIComponent(`Academic Softcopy Reports: ${selectedClass} - ${config.term} (${config.schoolYear})`);
    const bodyText = encodeURIComponent(
      `Dear Parents and Guardians of ${selectedClass},\n\n` +
      `This is an official bulk notification from ${config.schoolName || 'Excel Academy'}.\n` +
      `The Academic Softcopy Report Cards for ${config.term} (${config.schoolYear}) have been generated.\n\n` +
      (batchNote ? `Note from School Administration:\n"${batchNote}"\n\n` : '') +
      `Please contact the school office or check your individual ward's email thread for full performance breakdown.\n\n` +
      `Warm regards,\n` +
      `${config.principalName || 'Head Administrator'}\n` +
      `${config.schoolName || 'Excel Academy'}`
    );

    window.open(`mailto:?bcc=${bccList}&subject=${subject}&body=${bodyText}`, '_blank');
  };

  return (
    <div className="w-full space-y-5 animate-fadeIn">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 rounded border border-mauve-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm no-print">
        <div className="flex items-center gap-4">
          {config.schoolLogoUrl ? (
            <img 
              src={config.schoolLogoUrl} 
              alt={`${config.schoolName} logo`} 
              className="w-16 h-16 object-contain rounded-lg shadow-sm shrink-0 border border-mauve-500/10"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-14 h-14 rounded bg-mauve-100 text-mauve-900 flex items-center justify-center border border-mauve-500/10 shrink-0">
              <School className="w-7 h-7" />
            </div>
          )}
          <div>
            <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-mauve-900 bg-mauve-100 px-2.5 py-0.5 rounded">
              Admin Control Center
            </span>
            <h2 className="font-display font-bold text-xl sm:text-2xl text-mauve-900 mt-1.5">
              Academy Records Dashboard
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Overall configurations, student admissions, teacher registries, and consolidated reports of {config.schoolName || 'Eastfield Academy'}.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
          {/* Dynamic Term Pill */}
          <div className="bg-mauve-900 text-white px-4 py-2.5 rounded border border-mauve-950 shadow-sm shrink-0 flex items-center gap-3">
            <School className="w-4 h-4 text-white" />
            <div className="text-left">
              <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-200">Active Term</span>
              <span className="block font-bold text-xs">{config.term} ({config.schoolYear})</span>
            </div>
          </div>

          {onSignOut && (
            <button
              onClick={onSignOut}
              className="bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-bold px-4 py-2.5 rounded shadow-sm text-xs transition duration-150 flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              id="admin-signout-btn"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Admin</span>
            </button>
          )}
        </div>
      </div>

      {/* Promotion Success Message */}
      {promotionSuccessMsg && (
        <div className="p-3.5 bg-green-600 text-white rounded-xl text-xs font-semibold flex items-center justify-between gap-2 shadow-md animate-fadeIn no-print">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-200 shrink-0" />
            <span>{promotionSuccessMsg}</span>
          </div>
          <button onClick={() => setPromotionSuccessMsg('')} className="text-white hover:text-green-100 font-bold p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* First Term Reopening & Auto-Promotion Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-mauve-900 text-white p-4 rounded-xl shadow-md border border-blue-700/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 my-1 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl text-yellow-300 backdrop-blur-xs shrink-0">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-sm text-white">First Term Reopening & Student Promotion Engine</h4>
              <span className="text-[10px] bg-yellow-400 text-blue-950 font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                {config.term} ({config.schoolYear})
              </span>
            </div>
            <p className="text-xs text-blue-100 leading-relaxed">
              Reopening Date: <strong>{config.reopeningDate ? new Date(config.reopeningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '15th Sept 2026'}</strong>.
              {config.lastPromotedYear === config.schoolYear ? (
                <span className="text-green-300 font-bold ml-1"> ✓ All enrolled pupils promoted for {config.schoolYear}.</span>
              ) : (
                <span className="text-amber-200 font-medium ml-1"> Automatically migrates pupils to next class upon First Term reopening.</span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowPromotionModal(true)}
          className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer w-full sm:w-auto"
        >
          <GraduationCap className="w-4 h-4" />
          <span>Review & Execute Student Promotion</span>
        </button>
      </div>

      {/* 2. TAB TOGGLES */}
      <div className="flex flex-wrap gap-1.5 border-b border-mauve-500/10 pb-1.5 no-print">
        {[
          { id: 'analytics', label: 'Overview Metrics', icon: Users },
          { id: 'transcripts', label: 'Transcript Center', icon: FileSpreadsheet },
          { id: 'students', label: 'Student Admissions', icon: GraduationCap },
          { id: 'teachers', label: 'Teacher Directory', icon: BookOpen },
          { id: 'config', label: 'Settings & Security', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all duration-150 cursor-pointer border ${
                isActive
                  ? 'bg-mauve-900 text-white shadow-sm border-mauve-900'
                  : 'bg-white text-mauve-900/80 hover:bg-mauve-100 border-mauve-500/15'
              }`}
              id={`admin-tab-${tab.id}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 3. TAB VIEWS */}

      {/* A. ANALYTICS VIEW */}
      {activeTab === 'analytics' && (
        <div className="space-y-5 animate-fadeIn no-print">
          {/* Main counts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Enrolled Pupils', val: totalStudents, desc: 'Nursery to JHS', icon: GraduationCap, color: 'text-mauve-900 bg-mauve-100 border-mauve-500/10' },
              { label: 'Academic Staff', val: totalTeachers, desc: 'Registered Teachers', icon: BookOpen, color: 'text-purple-900 bg-purple-50 border-purple-200/30' },
              { label: 'Overall Class Average', val: `${overallAvg.toFixed(1)}%`, desc: 'Across school terms', icon: School, color: 'text-emerald-900 bg-emerald-50 border-emerald-200/30' },
              { label: 'Active Subject Codes', val: subjects.length, desc: 'Ghanaian syllabus', icon: Sliders, color: 'text-indigo-900 bg-indigo-50 border-indigo-200/30' }
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="bg-white p-4 rounded border border-mauve-500/20 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">{card.label}</span>
                    <span className="text-xl font-display font-extrabold text-mauve-900 mt-1 block">{card.val}</span>
                    <span className="text-[10px] text-gray-500 mt-0.5 block">{card.desc}</span>
                  </div>
                  <div className={`p-2.5 rounded border ${card.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Performance breakdown by levels */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[
              { title: 'Nursery & Kindergarten', count: nurseryStudentsCount + kgStudentsCount, classes: [...classes.NURSERY, ...kgClasses], avg: levelAverages('NURSERY') || levelAverages('KINDERGARTEN') },
              { title: 'Primary Classes (P1 - P6)', count: primaryStudentsCount, classes: classes.PRIMARY, avg: levelAverages('PRIMARY') },
              { title: 'Junior High (JHS 1 - JHS 3)', count: jhsStudentsCount, classes: classes.JHS, avg: levelAverages('JHS') }
            ].map((lvl, index) => (
              <div key={index} className="bg-white p-4 rounded border border-mauve-500/20 flex flex-col justify-between space-y-3.5 shadow-sm">
                <div>
                  <h4 className="font-display font-bold text-mauve-900 text-sm uppercase tracking-wide">{lvl.title}</h4>
                  <div className="flex gap-3 mt-2">
                    <div className="bg-mauve-100/50 border border-mauve-500/10 px-2.5 py-1 rounded text-center">
                      <span className="text-[9px] block font-mono font-semibold text-mauve-900">PUPILS</span>
                      <span className="text-xs font-extrabold text-mauve-900">{lvl.count}</span>
                    </div>
                    <div className="bg-mauve-100/50 border border-mauve-500/10 px-2.5 py-1 rounded text-center">
                      <span className="text-[9px] block font-mono font-semibold text-mauve-900">AVERAGE</span>
                      <span className="text-xs font-extrabold text-mauve-900">{lvl.avg.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Classes Managed:</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {lvl.classes.map((cls) => (
                      <span key={cls} className="text-[10px] px-1.5 py-0.5 bg-gray-50 border border-gray-200 text-gray-600 rounded">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* B. TRANSCRIPT CENTER VIEW */}
      {activeTab === 'transcripts' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-fadeIn">
          {/* Student Selector Sidebar - HIDE IN PRINT */}
          <div className="lg:col-span-1 bg-white p-4 rounded border border-mauve-500/20 space-y-4 no-print shadow-sm text-xs">
            <h4 className="font-display font-bold text-mauve-900 text-sm uppercase tracking-wide flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-mauve-900" />
              Student Selector
            </h4>

            {/* Select Class */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-mauve-900 block">1. Select Grade Class</label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChangeInTranscriptSelector(e.target.value)}
                className="w-full text-xs p-2 rounded border border-mauve-500/20 focus:outline-none focus:ring-1 focus:ring-mauve-900 bg-white text-mauve-900 font-medium"
              >
                {allClassNames.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* Select Student */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-mauve-900 block">2. Choose Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full text-xs p-2 rounded border border-mauve-500/20 focus:outline-none focus:ring-1 focus:ring-mauve-900 bg-white text-mauve-900 font-medium"
              >
                <option value="">-- Choose Pupil --</option>
                {studentsInSelectedClass.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.rollNumber})</option>
                ))}
              </select>
            </div>

            {/* Batch Softcopy Dispatch Button */}
            <div className="pt-2 border-t border-mauve-500/10 space-y-1">
              <label className="text-[10px] uppercase font-bold text-mauve-900 block">3. Softcopy Dispatch</label>
              <button
                onClick={() => setShowBatchEmailModal(true)}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-3 rounded text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" />
                <span>Batch Email/WhatsApp ({studentsInSelectedClass.length})</span>
              </button>
            </div>

            <div className="pt-2 border-t border-mauve-500/10 text-[11px] text-gray-500 space-y-1 bg-mauve-100/50 p-2.5 rounded border border-mauve-500/10 leading-relaxed">
              <span className="font-bold text-mauve-900 uppercase block text-[10px]">System Assistant</span>
              <p>Selecting a student dynamically loads their term marks, calculated class rank, and attendance review sheets into the A4 viewer.</p>
            </div>
          </div>

          {/* Transcript Viewer Main */}
          <div className="lg:col-span-3">
            {selectedStudent ? (
              <ReportPDF
                student={selectedStudent}
                grades={grades.filter((g) => g.studentId === selectedStudent.id)}
                attendance={attendance.find((a) => a.studentId === selectedStudent.id)}
                subjects={subjects}
                config={config}
                allClassStudents={students.filter((s) => s.className === selectedStudent.className)}
                allGrades={grades}
                onUpdateAttendance={(daysPresent, totalDays, remarks) => {
                  const studentId = selectedStudent.id;
                  setAttendance((prev) => {
                    const existingIndex = prev.findIndex((a) => a.studentId === studentId);
                    const newRecord: Attendance = {
                      studentId,
                      term: config.term || 'Term 1',
                      year: config.schoolYear || '2025/2026',
                      totalDays,
                      daysPresent,
                      remarks: remarks ?? (prev[existingIndex]?.remarks ?? 'Very good conduct.'),
                      teacherId: 'admin',
                      updatedAt: new Date().toISOString()
                    };
                    if (existingIndex !== -1) {
                      const updated = [...prev];
                      updated[existingIndex] = {
                        ...updated[existingIndex],
                        totalDays,
                        daysPresent,
                        remarks: remarks ?? updated[existingIndex].remarks,
                        updatedAt: new Date().toISOString()
                      };
                      return updated;
                    } else {
                      return [...prev, newRecord];
                    }
                  });
                }}
              />
            ) : (
              <div className="bg-white p-10 rounded border border-dashed border-mauve-500/30 text-center text-gray-400 font-medium text-xs">
                Please select a grade class and student from the left selector panel to visualize the customizable transcript.
              </div>
            )}
          </div>
        </div>
      )}

      {/* C. STUDENTS ADMISSIONS VIEW */}
      {activeTab === 'students' && (
        <div className="space-y-4 animate-fadeIn no-print">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-display font-bold text-mauve-900 text-base uppercase tracking-wide">Student Admissions Registry</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowPromotionModal(true)}
                className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-3.5 py-2 rounded transition flex items-center gap-1.5 cursor-pointer shadow-sm text-xs uppercase tracking-wider"
              >
                <GraduationCap className="w-3.5 h-3.5" /> First Term Promotion Roll
              </button>
              <button
                onClick={() => {
                  setEditingStudent(null);
                  const defaultLevel = 'PRIMARY' as AcademicLevel;
                  const defaultClass = 'Primary 1';
                  const autoRoll = getAutoRollNumber(defaultLevel, defaultClass);
                  setStudentForm({
                    name: '',
                    rollNumber: autoRoll,
                    level: defaultLevel,
                    className: defaultClass,
                    guardianName: '',
                    guardianEmail: '',
                    guardianPhone: ''
                  });
                  setShowStudentModal(true);
                }}
                className="bg-mauve-900 hover:bg-mauve-700 text-white font-bold px-4 py-2 rounded transition flex items-center gap-1.5 cursor-pointer shadow-sm text-xs uppercase tracking-wider"
              >
                <Plus className="w-3.5 h-3.5" /> Add New Pupil
              </button>
            </div>
          </div>

          {/* Search filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded border border-mauve-500/20 shadow-sm">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-mauve-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-2.5 py-1.5 rounded border border-mauve-500/15 focus:outline-none focus:ring-1 focus:ring-mauve-900 text-mauve-900 bg-white"
              />
            </div>

            <div>
              <select
                value={studentLevelFilter}
                onChange={(e) => setStudentLevelFilter(e.target.value)}
                className="w-full text-xs p-1.5 rounded border border-mauve-500/15 focus:outline-none focus:ring-1 focus:ring-mauve-900 text-mauve-900 bg-white"
              >
                <option value="ALL">All Academy Levels</option>
                <option value="NURSERY">Nursery Division</option>
                <option value="KINDERGARTEN">Kindergarten (KG1, KG2)</option>
                <option value="PRIMARY">Primary Six (P1-P6)</option>
                <option value="JHS">Junior High School (JHS)</option>
              </select>
            </div>

            <div>
              <select
                value={studentClassFilter}
                onChange={(e) => setStudentClassFilter(e.target.value)}
                className="w-full text-xs p-1.5 rounded border border-mauve-500/15 focus:outline-none focus:ring-1 focus:ring-mauve-900 text-mauve-900 bg-white"
              >
                <option value="ALL">All Class Groups</option>
                {allClassNames.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={`${studentSortField}-${studentSortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split('-') as ['rollNumber' | 'name', 'asc' | 'desc'];
                  setStudentSortField(f);
                  setStudentSortOrder(o);
                }}
                className="w-full text-xs p-1.5 rounded border border-mauve-500/15 focus:outline-none focus:ring-1 focus:ring-mauve-900 text-mauve-900 bg-white font-medium"
              >
                <option value="rollNumber-asc">Sort: Student ID (Ascending ↑)</option>
                <option value="rollNumber-desc">Sort: Student ID (Descending ↓)</option>
                <option value="name-asc">Sort: Name (A to Z ↑)</option>
                <option value="name-desc">Sort: Name (Z to A ↓)</option>
              </select>
            </div>
          </div>

          {/* Table Directory */}
          <div className="bg-white rounded border border-mauve-500/20 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mauve-50 border-b border-mauve-500/20 text-[11px] font-bold text-mauve-900 uppercase tracking-wider">
                    <th 
                      className="p-3 pl-4 cursor-pointer hover:bg-mauve-100 transition select-none"
                      onClick={() => {
                        if (studentSortField === 'name') {
                          setStudentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setStudentSortField('name');
                          setStudentSortOrder('asc');
                        }
                      }}
                      title="Click to sort by Name"
                    >
                      <div className="flex items-center gap-1">
                        <span>Student Details</span>
                        {studentSortField === 'name' && (
                          <span className="text-mauve-900 font-extrabold">{studentSortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="p-3 cursor-pointer hover:bg-mauve-100 transition select-none"
                      onClick={() => {
                        if (studentSortField === 'rollNumber') {
                          setStudentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                        } else {
                          setStudentSortField('rollNumber');
                          setStudentSortOrder('asc');
                        }
                      }}
                      title="Click to sort by Student ID / Roll Number"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Roll Number</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${studentSortField === 'rollNumber' ? 'bg-mauve-900 text-white' : 'bg-mauve-200 text-mauve-800'}`}>
                          {studentSortField === 'rollNumber' ? (studentSortOrder === 'asc' ? 'ID Asc ↑' : 'ID Desc ↓') : 'Sort ID'}
                        </span>
                      </div>
                    </th>
                    <th className="p-3">Academy Level</th>
                    <th className="p-3">Assigned Class</th>
                    <th className="p-3">Guardian Contacts</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mauve-50 text-xs text-gray-800">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-gray-400">No student matching selected filters.</td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => (
                      <tr key={s.id} className="hover:bg-mauve-50/10">
                        <td className="p-3 pl-4 font-bold text-gray-900 text-xs">{s.name}</td>
                        <td className="p-3 font-mono font-bold text-mauve-900">{s.rollNumber}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            s.level === 'NURSERY' ? 'bg-rose-50 text-rose-700 border border-rose-150' :
                            s.level === 'KINDERGARTEN' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                            s.level === 'PRIMARY' ? 'bg-mauve-50 text-mauve-900 border border-mauve-500/10' :
                            'bg-cyan-50 text-cyan-700 border border-cyan-150'
                          }`}>
                            {s.level}
                          </span>
                        </td>
                        <td className="p-3 text-gray-700 font-bold">{s.className}</td>
                        <td className="p-3">
                          <div className="space-y-0.5 text-[10px]">
                            <span className="block font-bold text-gray-800">{s.guardianName || 'N/A'}</span>
                            <span className="block text-gray-500 font-mono">{s.guardianEmail || 'No Email'}</span>
                            {s.guardianPhone && (
                              <span className="block text-green-700 font-mono flex items-center gap-1 font-semibold">
                                <MessageSquare className="w-2.5 h-2.5 shrink-0" /> {s.guardianPhone}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedClass(s.className);
                                setSelectedStudentId(s.id);
                                setActiveTab('transcripts');
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-[10px] flex items-center gap-1 transition cursor-pointer shadow-sm"
                              title="Open Report Card & Send Softcopy to Parent"
                            >
                              <Share2 className="w-3 h-3 shrink-0" />
                              <span>Send Softcopy</span>
                            </button>
                            <button
                              onClick={() => triggerEditStudent(s)}
                              className="p-1 text-mauve-900 hover:text-mauve-700 hover:bg-mauve-100 rounded transition cursor-pointer"
                              title="Edit Pupil Profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteStudentId === s.id ? (
                              <div className="flex items-center gap-1.5 animate-pulse">
                                <button
                                  onClick={() => {
                                    handleDeleteStudent(s.id);
                                    setConfirmDeleteStudentId(null);
                                  }}
                                  className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded text-[9px] hover:bg-rose-700 cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteStudentId(null)}
                                  className="px-2 py-0.5 bg-gray-200 text-gray-700 font-bold rounded text-[9px] hover:bg-gray-300 cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteStudentId(s.id)}
                                className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition cursor-pointer"
                                title="Delete Pupil"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Student Form Modal */}
          {showStudentModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-white rounded-2xl border border-mauve-250 w-full max-w-md p-6 shadow-2xl space-y-5">
                <div className="flex justify-between items-center border-b border-mauve-100 pb-3">
                  <h4 className="font-display font-bold text-mauve-900 text-lg">
                    {editingStudent ? 'Modify Student Details' : 'Admit New Pupil'}
                  </h4>
                  <button
                    onClick={() => setShowStudentModal(false)}
                    className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleAddOrEditStudent} className="space-y-4 text-sm">
                  {/* Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-mauve-700 block">Student Fullname</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kwadwo Mensah"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                    />
                  </div>

                  {/* Roll Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-mauve-700 block flex justify-between items-center">
                      <span>Roll / Register ID</span>
                      {!editingStudent && (
                        <span className="text-[10px] text-emerald-600 font-medium">Auto-generated</span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EA/P4/052"
                      value={studentForm.rollNumber}
                      onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                    />
                  </div>

                  {/* Level & Class Group */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Academy Level</label>
                      <select
                        value={studentForm.level}
                        onChange={(e) => handleLevelChangeInForm(e.target.value as AcademicLevel)}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                      >
                        <option value="NURSERY">Nursery</option>
                        <option value="KINDERGARTEN">Kindergarten (KG1, KG2)</option>
                        <option value="PRIMARY">Primary</option>
                        <option value="JHS">Junior High (JHS)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Grade Class</label>
                      <select
                        value={studentForm.className}
                        onChange={(e) => {
                          const newClass = e.target.value;
                          const autoRoll = getAutoRollNumber(studentForm.level, newClass);
                          setStudentForm(prev => ({
                            ...prev,
                            className: newClass,
                            rollNumber: editingStudent ? prev.rollNumber : autoRoll
                          }));
                        }}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                      >
                        {studentForm.level === 'NURSERY' && classes.NURSERY.map(c => <option key={c} value={c}>{c}</option>)}
                        {studentForm.level === 'KINDERGARTEN' && kgClasses.map(c => <option key={c} value={c}>{c}</option>)}
                        {studentForm.level === 'PRIMARY' && classes.PRIMARY.map(c => <option key={c} value={c}>{c}</option>)}
                        {studentForm.level === 'JHS' && classes.JHS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Guardian Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-mauve-700 block">Guardian Fullname</label>
                    <input
                      type="text"
                      placeholder="e.g. Ama Serwaa Mensah"
                      value={studentForm.guardianName}
                      onChange={(e) => setStudentForm({ ...studentForm, guardianName: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                    />
                  </div>

                  {/* Guardian Email & WhatsApp Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 flex items-center gap-1">
                        <Mail className="w-3 h-3 text-blue-600" /> Guardian Email
                      </label>
                      <input
                        type="email"
                        placeholder="parent@example.com"
                        value={studentForm.guardianEmail}
                        onChange={(e) => setStudentForm({ ...studentForm, guardianEmail: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3 text-green-600" /> Guardian WhatsApp / Phone
                      </label>
                      <input
                        type="text"
                        placeholder="+233 XX XXX XXXX"
                        value={studentForm.guardianPhone || ''}
                        onChange={(e) => setStudentForm({ ...studentForm, guardianPhone: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2.5 pt-3 border-t border-mauve-100">
                    <button
                      type="button"
                      onClick={() => setShowStudentModal(false)}
                      className="flex-1 py-2.5 border border-mauve-200 hover:bg-mauve-50 text-mauve-600 rounded-xl transition cursor-pointer font-medium text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-mauve-600 hover:bg-mauve-700 text-white rounded-xl transition cursor-pointer font-medium text-center shadow"
                    >
                      {editingStudent ? 'Save Profile' : 'Confirm Admission'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* D. TEACHERS REGISTER VIEW */}
      {activeTab === 'teachers' && (
        <div className="space-y-4 animate-fadeIn no-print">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-bold text-mauve-900 text-base uppercase tracking-wide">Staff Directory</h3>
          </div>

          <div className="bg-white p-3 rounded border border-mauve-500/20 text-xs text-mauve-900 leading-relaxed flex items-start gap-2 bg-mauve-50/15 shadow-sm">
            <AlertCircle className="w-4 h-4 text-mauve-900 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-mauve-900 block uppercase tracking-wider text-[10px] mb-0.5">Academy Staff Policy:</span>
              <span>Primary teachers handle multiple core subjects to provide immersive grade mentoring. Junior High School (JHS) teachers are specialized academic tutors and, under Academy bylaws, are strictly restricted to handling a maximum of <strong>two distinct subjects</strong>.</span>
            </div>
          </div>

          {/* Table Directory */}
          <div className="bg-white rounded border border-mauve-500/20 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-mauve-50 border-b border-mauve-500/20 text-[11px] font-bold text-mauve-900 uppercase tracking-wider">
                  <th className="p-3 pl-4">Staff Details</th>
                  <th className="p-3">Assigned Level</th>
                  <th className="p-3">Assigned Class Groups</th>
                  <th className="p-3">Syllabus Subjects Managed</th>
                  <th className="p-3 text-center">Status Checks</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mauve-50 text-xs text-gray-800">
                {teachers.filter((t) => t.role === 'TEACHER').map((t) => (
                  <tr key={t.id} className="hover:bg-mauve-50/10">
                    <td className="p-3 pl-4">
                      <span className="block font-bold text-gray-900 text-xs">{t.name}</span>
                      <span className="block text-gray-400 font-mono text-[10px]">{t.email}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        t.level === 'NURSERY' ? 'bg-rose-50 text-rose-700 border border-rose-150' :
                        t.level === 'KINDERGARTEN' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        t.level === 'PRIMARY' ? 'bg-mauve-50 text-mauve-900 border border-mauve-500/10' :
                        'bg-cyan-50 text-cyan-700 border border-cyan-150'
                      }`}>
                        {t.level}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {t.classes?.map((c, idx) => (
                          <span key={`${c}-${idx}`} className="bg-gray-50 border border-gray-150 px-1.5 py-0.5 rounded text-[10px] text-gray-600 font-bold">
                            {c}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {t.subjects?.map((sId, idx) => {
                          const sub = subjects.find(s => s.id === sId);
                          return (
                            <span key={`${sId}-${idx}`} className="bg-mauve-50 border border-mauve-500/10 px-1.5 py-0.5 rounded text-[10px] text-mauve-900 font-bold">
                              {sub ? sub.name : 'Subject'}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {t.level === 'JHS' ? (
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono ${
                          (t.subjects?.length || 0) <= 2 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          JHS STRICT: {t.subjects?.length}/2 Subjects
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-gray-50 text-gray-400 border border-gray-150">
                          Primary Multi-subject
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 pl-2">
                        <button
                          onClick={() => {
                            setEditingTeacher(t);
                            setTeacherForm({
                              name: t.name,
                              email: t.email,
                              level: t.level || 'PRIMARY',
                              classes: t.classes || [],
                              subjects: t.subjects || []
                            });
                            setTeacherError('');
                            setShowTeacherModal(true);
                          }}
                          className="p-1 text-mauve-600 hover:text-mauve-800 hover:bg-mauve-50 rounded transition cursor-pointer"
                          title="Edit Teacher Staff Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteTeacherId === t.id ? (
                          <div className="flex items-center gap-1.5 animate-pulse">
                            <button
                              onClick={() => {
                                handleDeleteTeacher(t.id);
                                setConfirmDeleteTeacherId(null);
                              }}
                              className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded text-[9px] hover:bg-rose-700 cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteTeacherId(null)}
                              className="px-2 py-0.5 bg-gray-200 text-gray-700 font-bold rounded text-[9px] hover:bg-gray-300 cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteTeacherId(t.id)}
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Delete Teacher Staff"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Teacher Form Modal */}
          {showTeacherModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-white rounded-2xl border border-mauve-250 w-full max-w-lg p-6 shadow-2xl space-y-5">
                <div className="flex justify-between items-center border-b border-mauve-100 pb-3">
                  <h4 className="font-display font-bold text-mauve-900 text-lg">
                    {editingTeacher ? 'Modify Staff Profile' : 'Register Academy Staff'}
                  </h4>
                  <button
                    onClick={() => setShowTeacherModal(false)}
                    className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
                  >
                    &times;
                  </button>
                </div>

                {teacherError && (
                  <div className="bg-rose-50 text-rose-700 p-3 rounded-xl border border-rose-100 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{teacherError}</span>
                  </div>
                )}

                <form onSubmit={handleRegisterTeacher} className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Teacher Fullname</label>
                      <input
                        type="text"
                        required
                        placeholder="Mrs. Mary Mensah"
                        value={teacherForm.name}
                        onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                        disabled={!!editingTeacher}
                        className={`w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white ${editingTeacher ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : ''}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Teacher Email</label>
                      <input
                        type="email"
                        required
                        placeholder="mary@eastfield.com"
                        value={teacherForm.email}
                        onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })}
                        disabled={!!editingTeacher}
                        className={`w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white ${editingTeacher ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-mauve-700 block">Staff Division</label>
                    <div className="flex gap-2">
                      {['NURSERY', 'KINDERGARTEN', 'PRIMARY', 'JHS'].map((l) => (
                        <button
                          key={l}
                          type="button"
                          disabled={!!editingTeacher}
                          onClick={() => handleTeacherLevelChange(l as AcademicLevel)}
                          className={`flex-1 py-2 text-xs font-semibold border rounded-xl transition ${
                            teacherForm.level === l
                              ? 'bg-mauve-100 border-mauve-400 text-mauve-900'
                              : 'border-mauve-200 hover:bg-mauve-50 text-mauve-600'
                          } ${editingTeacher ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Class selection toggles */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-mauve-700 block">
                      {teacherForm.level === 'JHS' 
                        ? 'Assign Classes (Toggle classes they teach)' 
                        : 'Assign Class (Nursery & Primary teachers are assigned to exactly ONE class)'}
                    </label>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-mauve-150 bg-mauve-50/25">
                      {teacherForm.level === 'NURSERY' && classes.NURSERY.map(c => {
                        const isSel = teacherForm.classes.includes(c);
                        const assignedTeacher = teachers.find(t => t.id !== editingTeacher?.id && t.classes?.includes(c));
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleClassForTeacherForm(c)}
                            className={`px-2.5 py-1 text-xs border rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                              isSel 
                                ? 'bg-mauve-600 text-white border-mauve-700 font-bold' 
                                : assignedTeacher 
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100' 
                                  : 'bg-white text-mauve-700 border-mauve-200 hover:bg-mauve-50'
                            }`}
                            title={assignedTeacher ? `Assigned to ${assignedTeacher.name}` : 'Available'}
                          >
                            <span>{c}</span>
                            {assignedTeacher && !isSel && (
                              <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono font-medium">
                                Assigned: {assignedTeacher.name.split(' ')[0]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {teacherForm.level === 'KINDERGARTEN' && kgClasses.map(c => {
                        const isSel = teacherForm.classes.includes(c);
                        const assignedTeacher = teachers.find(t => t.id !== editingTeacher?.id && t.classes?.includes(c));
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleClassForTeacherForm(c)}
                            className={`px-2.5 py-1 text-xs border rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                              isSel 
                                ? 'bg-mauve-600 text-white border-mauve-700 font-bold' 
                                : assignedTeacher 
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100' 
                                  : 'bg-white text-mauve-700 border-mauve-200 hover:bg-mauve-50'
                            }`}
                            title={assignedTeacher ? `Assigned to ${assignedTeacher.name}` : 'Available'}
                          >
                            <span>{c}</span>
                            {assignedTeacher && !isSel && (
                              <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono font-medium">
                                Assigned: {assignedTeacher.name.split(' ')[0]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {teacherForm.level === 'PRIMARY' && classes.PRIMARY.map(c => {
                        const isSel = teacherForm.classes.includes(c);
                        const assignedTeacher = teachers.find(t => t.id !== editingTeacher?.id && t.classes?.includes(c));
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleClassForTeacherForm(c)}
                            className={`px-2.5 py-1 text-xs border rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                              isSel 
                                ? 'bg-mauve-600 text-white border-mauve-700 font-bold' 
                                : assignedTeacher 
                                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100' 
                                  : 'bg-white text-mauve-700 border-mauve-200 hover:bg-mauve-50'
                            }`}
                            title={assignedTeacher ? `Assigned to ${assignedTeacher.name}` : 'Available'}
                          >
                            <span>{c}</span>
                            {assignedTeacher && !isSel && (
                              <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono font-medium">
                                Assigned: {assignedTeacher.name.split(' ')[0]}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {teacherForm.level === 'JHS' && classes.JHS.map(c => {
                        const isSel = teacherForm.classes.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleClassForTeacherForm(c)}
                            className={`px-2.5 py-1 text-xs border rounded-lg transition cursor-pointer ${isSel ? 'bg-mauve-600 text-white border-mauve-700 font-bold' : 'bg-white text-mauve-700 border-mauve-200 hover:bg-mauve-50'}`}
                          >
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Subject selection toggles */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-mauve-700 block">
                        {teacherForm.level === 'JHS' ? 'Syllabus Subject Assignment' : 'Syllabus Subject Assignment (All subjects auto-assigned)'}
                      </label>
                      {teacherForm.level === 'JHS' ? (
                        <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded font-bold font-mono">
                          MAX 2 SUBJECTS FOR JHS
                        </span>
                      ) : (
                        <span className="text-[10px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold font-mono uppercase">
                          All Subjects Entitled
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-xl border border-mauve-150 bg-mauve-50/25 max-h-[140px] overflow-y-auto">
                      {subjects.filter((s) => s.level === teacherForm.level).map(sub => {
                        const isSel = teacherForm.subjects.includes(sub.id);
                        const assignedTeacher = teacherForm.level === 'JHS' 
                          ? teachers.find(t => t.level === 'JHS' && t.subjects?.some(sId => sId === sub.id || sId === sub.name || sId === sub.code) && (!editingTeacher || t.id !== editingTeacher.id)) 
                          : null;
                        const isUnavailable = !!assignedTeacher;

                        return (
                          <button
                            key={sub.id}
                            type="button"
                            disabled={teacherForm.level !== 'JHS' || isUnavailable}
                            onClick={() => toggleSubjectForTeacherForm(sub.id)}
                            className={`px-2.5 py-1 text-xs border rounded-lg text-left transition flex items-center justify-between ${
                              isSel 
                                ? 'bg-mauve-600 text-white border-mauve-700 font-bold' 
                                : isUnavailable
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                                  : 'bg-white text-mauve-700 border-mauve-200 hover:bg-mauve-50'
                            } ${teacherForm.level !== 'JHS' ? 'opacity-90 cursor-default font-semibold' : isUnavailable ? 'opacity-60' : 'cursor-pointer'}`}
                            title={isUnavailable ? `Assigned to ${assignedTeacher.name}` : undefined}
                          >
                            <span>{sub.name} ({sub.code})</span>
                            {isUnavailable && (
                              <span className="text-[8px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-150 ml-2">
                                (Assigned to {assignedTeacher.name})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex gap-2.5 pt-3 border-t border-mauve-100">
                    <button
                      type="button"
                      onClick={() => setShowTeacherModal(false)}
                      className="flex-1 py-2.5 border border-mauve-200 hover:bg-mauve-50 text-mauve-600 rounded-xl transition cursor-pointer font-medium text-center"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-mauve-600 hover:bg-mauve-700 text-white rounded-xl transition cursor-pointer font-medium text-center shadow"
                    >
                      {editingTeacher ? 'Save Changes' : 'Add Registry Staff'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* E. GENERAL REPORT CONFIGURATION VIEW */}
      {activeTab === 'config' && (
        <div className="bg-white p-6 rounded-2xl border border-mauve-100 mauve-glow space-y-6 animate-fadeIn no-print">
          <div className="border-b border-mauve-100 pb-3">
            <h3 className="font-display font-bold text-mauve-900 text-lg">System Configurations</h3>
            <p className="text-xs text-mauve-500 mt-0.5">Edit academic term, continuous assessment weightings, and the global evaluation index.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-mauve-800 uppercase tracking-widest">School & Term Parameters</h4>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-mauve-700 block">Academy Name</label>
                <input
                  type="text"
                  value={config.schoolName}
                  onChange={(e) => setConfig(prev => ({ ...prev, schoolName: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-mauve-700 block">School Year Cycle</label>
                  <input
                    type="text"
                    value={config.schoolYear}
                    onChange={(e) => setConfig(prev => ({ ...prev, schoolYear: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-mauve-700 block">Current Academic Term</label>
                  <select
                    value={config.term}
                    onChange={(e) => setConfig(prev => ({ ...prev, term: e.target.value }))}
                    className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                  >
                    <option value="Term 1">Term One (First Term)</option>
                    <option value="Term 2">Term Two (Mid-Year)</option>
                    <option value="Term 3">Term Three (Promotions Term)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-mauve-700 block">Head Principal Stamp Name</label>
                <input
                  type="text"
                  value={config.principalName}
                  onChange={(e) => setConfig(prev => ({ ...prev, principalName: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                />
              </div>

              {/* First Term Reopening & Promotion Settings */}
              <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-blue-700 shrink-0" />
                  <h5 className="text-xs font-bold text-blue-950 uppercase tracking-wider">First Term Promotion Engine</h5>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-blue-900 block">First Term Reopening Date</label>
                    <input
                      type="date"
                      value={config.reopeningDate || '2026-09-15'}
                      onChange={(e) => setConfig(prev => ({ ...prev, reopeningDate: e.target.value }))}
                      className="w-full p-2 rounded-lg border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none text-mauve-900 bg-white"
                    />
                    <span className="text-[10px] text-gray-500 block">Target date for First Term migration roll.</span>
                  </div>

                  <div className="space-y-2 flex flex-col justify-end">
                    <label className="font-semibold text-blue-900 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.autoPromoteOnReopening !== false}
                        onChange={(e) => setConfig(prev => ({ ...prev, autoPromoteOnReopening: e.target.checked }))}
                        className="w-4 h-4 rounded text-blue-700 focus:ring-blue-500"
                      />
                      <span>Auto-Promote on Reopening</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPromotionModal(true)}
                      className="w-full py-2 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Execute Class Promotion Roll</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-mauve-700 block">Active Report Card Template Layout</label>
                <select
                  value={config.selectedTemplate || 'dynamic'}
                  onChange={(e) => setConfig(prev => ({ ...prev, selectedTemplate: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                >
                  <option value="dynamic">Dynamic (Auto-Detect based on Student Level)</option>
                  <option value="compact">Nursery & KG High-Fidelity (Lavender Curves & Bee Mascot)</option>
                  <option value="high-fidelity">JHS & Primary Structured (Elegant Blue Header & Metadata)</option>
                  <option value="classic">Classic Simple Layout (Traditional Clean Design)</option>
                </select>
                <span className="text-[10px] text-gray-500 block leading-tight">
                  Choose the default layout theme for student report cards. This choice synchronizes directly to the database.
                </span>
              </div>

              <div className="space-y-3 pt-3 border-t border-mauve-100">
                <h5 className="text-xs font-bold text-mauve-800 uppercase tracking-wider block">School Logo Customization</h5>
                
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 text-xs">
                  {/* Logo Abbreviation Column */}
                  <div className="sm:col-span-4 space-y-2">
                    <label className="text-xs font-semibold text-mauve-700 block">Default Abbreviation</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={config.schoolLogoText || ''}
                      onChange={(e) => setConfig(prev => ({ ...prev, schoolLogoText: e.target.value }))}
                      placeholder="e.g. EA"
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white font-display font-extrabold text-sm"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <div className="w-10 h-10 rounded bg-mauve-900 text-white font-display font-extrabold text-xs flex items-center justify-center shadow shrink-0">
                        {config.schoolLogoText || '??'}
                      </div>
                      <span className="text-[10px] text-gray-500 leading-tight">Default text avatar preview</span>
                    </div>
                  </div>

                  {/* Image Upload Column */}
                  <div className="sm:col-span-8 space-y-3">
                    <label className="text-xs font-semibold text-mauve-700 block">Custom Logo Image</label>
                    
                    {config.schoolLogoUrl ? (
                      <div className="border border-mauve-200 rounded-xl p-4 bg-mauve-50/20 space-y-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={config.schoolLogoUrl} 
                            alt="School Logo Preview" 
                            className="w-16 h-16 object-contain bg-white rounded-lg border border-mauve-100 p-1.5 shadow-md shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-mauve-900 block">Custom Logo Active</span>
                            <span className="text-[10px] text-gray-500 block leading-tight">Appears on all PDF Transcripts</span>
                            {config.schoolLogoUrl.startsWith('data:') ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase" title="Stored directly inside database config payload. Synchronizes globally.">
                                Database-Synced Base64
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase" title="Hosted on cloud CDN storage.">
                                Cloud Storage CDN
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-mauve-100/60">
                          <label className="px-3.5 py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center gap-1.5">
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={handleLogoChange} 
                            />
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload New Logo</span>
                          </label>

                          <button
                            type="button"
                            onClick={handleClearLogo}
                            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Remove Logo</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                          logoDragActive 
                            ? 'border-mauve-900 bg-mauve-50' 
                            : 'border-mauve-200 hover:border-mauve-500 hover:bg-mauve-50/10'
                        }`}
                      >
                        <label className="cursor-pointer block space-y-3">
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleLogoChange} 
                          />
                          <div className="w-12 h-12 rounded-full bg-mauve-50 flex items-center justify-center mx-auto border border-mauve-100">
                            <Upload className="w-6 h-6 text-mauve-600" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-mauve-900 block">
                              Click to select or drag & drop logo
                            </span>
                            <span className="text-[10px] text-gray-400 block">
                              PNG, JPG, or JPEG (Max 2MB, Square recommended)
                            </span>
                          </div>
                          
                          {/* Dedicated Upload Button inside Dropzone to make it ultra clear */}
                          <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-mauve-900 hover:bg-mauve-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition shadow-sm pointer-events-none">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Logo Image</span>
                          </div>
                        </label>
                      </div>
                    )}

                    {logoUploadError && (
                      <p className="text-[11px] text-red-600 font-medium flex items-center gap-1.5 mt-1 bg-red-50/50 p-2 rounded-lg border border-red-100">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {logoUploadError}
                      </p>
                    )}

                    {/* Synchronization Explainer */}
                    <p className="text-[10px] text-gray-500 leading-normal bg-mauve-50/40 p-2.5 rounded-lg border border-mauve-100/60">
                      <strong>Global Synchronization Note:</strong> When you connect your own custom database credentials in the section below, any uploaded logo will automatically sync across devices. For maximum compatibility, files are optimized and stored directly inside the configuration schema to ensure perfect cross-device replication.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-mauve-800 uppercase tracking-widest">Continuous Assessment Weights</h4>

              <div className="p-4 bg-mauve-50/50 rounded-xl border border-mauve-100 text-xs text-mauve-700 space-y-3">
                <span className="font-bold text-mauve-800 block">Continuous Assessment Balance:</span>
                <p>The total student score is calculated automatically based on these weights. The basic education scale weighs class continuous assessment at 50% and terminal examinations at 50%.</p>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-mauve-600 block">Class Score weight (%)</label>
                    <input
                      type="number"
                      max={100}
                      min={0}
                      value={config.classScoreWeight}
                      onChange={(e) => setConfig(prev => ({ ...prev, classScoreWeight: Number(e.target.value) }))}
                      className="w-full p-2 rounded-lg border border-mauve-200 text-center font-mono font-bold text-mauve-900 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-mauve-600 block">Exam Score weight (%)</label>
                    <input
                      type="number"
                      max={100}
                      min={0}
                      value={config.examScoreWeight}
                      onChange={(e) => setConfig(prev => ({ ...prev, examScoreWeight: Number(e.target.value) }))}
                      className="w-full p-2 rounded-lg border border-mauve-200 text-center font-mono font-bold text-mauve-900 bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-mauve-100 flex justify-between font-semibold text-mauve-900">
                  <span>Combined Total Balance:</span>
                  <span>{config.classScoreWeight + config.examScoreWeight}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Grading evaluation table */}
          <div className="space-y-3 pt-4 border-t border-mauve-50/20">
            <span className="text-xs font-bold text-mauve-900 uppercase tracking-widest block">Transcript Evaluation Index Scale</span>
            <div className="overflow-x-auto border border-mauve-500/20 rounded">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-mauve-50 text-xs font-bold text-mauve-900 uppercase tracking-wider border-b border-mauve-500/10">
                    <th className="p-3 pl-4">Score Range (From)</th>
                    <th className="p-3">Score Range (To)</th>
                    <th className="p-3">Evaluation Remark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-mauve-50 text-xs text-gray-800">
                  {config.gradingScale.map((rule, index) => (
                    <tr key={index}>
                      <td className="p-3 pl-4 font-mono">{rule.minScore}%</td>
                      <td className="p-3 font-mono">{rule.maxScore}%</td>
                      <td className="p-3 italic text-gray-500">{rule.remarks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>



          {/* G. ADMINISTRATIVE SECURITY PASSWORD SECTION */}
          <div className="pt-6 border-t border-mauve-200 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-mauve-900" />
              <h4 className="font-display font-bold text-mauve-900 text-sm uppercase tracking-wider">Administrative Password Management</h4>
            </div>
            
            <p className="text-xs text-gray-500 leading-relaxed">
              Maintain system security by changing your administrative credentials. Ensure you store this password securely.
            </p>

            <form onSubmit={handleAdminPasswordChange} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end text-xs">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-mauve-700 block">Current Admin Password</label>
                <input
                  type="password"
                  placeholder="Enter current password"
                  value={currentAdminPassInput}
                  onChange={(e) => setCurrentAdminPassInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-xs text-mauve-900 font-mono bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-mauve-700 block">New Admin Password</label>
                <input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newAdminPassInput}
                  onChange={(e) => setNewAdminPassInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-xs text-mauve-900 font-mono bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-mauve-700 block">Confirm New Password</label>
                <input
                  type="password"
                  placeholder="Repeat new password"
                  value={confirmAdminPassInput}
                  onChange={(e) => setConfirmAdminPassInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-xs text-mauve-900 font-mono bg-white"
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 bg-mauve-900 hover:bg-mauve-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-sm"
                >
                  Update Admin Password
                </button>
              </div>

              {adminPassError && (
                <div className="md:col-span-3 p-2.5 rounded bg-red-50 text-red-800 border border-red-100 text-[11px] leading-tight">
                  {adminPassError}
                </div>
              )}

              {adminPassSuccess && (
                <div className="md:col-span-3 p-2.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100 text-[11px] leading-tight">
                  {adminPassSuccess}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* BATCH EMAIL DISPATCH MODAL */}
      {showBatchEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn no-print">
          <div className="bg-white rounded-2xl border border-mauve-250 w-full max-w-3xl p-6 shadow-2xl space-y-4 text-mauve-900 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-mauve-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-mauve-900 text-base flex items-center gap-2">
                    <span>Automated Bulk Email Dispatcher</span>
                    <span className="text-xs bg-blue-100 text-blue-800 font-mono px-2 py-0.5 rounded-full font-semibold">
                      {selectedClass}
                    </span>
                  </h4>
                  <p className="text-xs text-mauve-500">
                    Automatically generate and dispatch individual academic report card emails to parents and guardians.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBatchEmailModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Note/Notice for Parents */}
            <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl space-y-1.5 text-xs">
              <label className="font-bold text-blue-900 flex items-center justify-between">
                <span>📝 Custom Administrative Notice for All Emails (Optional):</span>
                <span className="text-[10px] text-blue-600 font-normal">Appended to each ward's report message</span>
              </label>
              <textarea
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
                placeholder="e.g. Term 2 Reopening Date is 15th Sept 2026. All outstanding fees must be settled prior to arrival."
                className="w-full text-xs p-2 rounded-lg border border-blue-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-mauve-900 h-16 resize-none"
              />
            </div>

            {/* Top Toolbar Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-mauve-50/80 p-3 rounded-xl border border-mauve-150 text-xs">
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-bold text-mauve-900">Pupils: {studentsInSelectedClass.length}</span>
                  <span className="ml-2 text-blue-700 font-medium">
                    ({studentsInSelectedClass.filter(s => s.guardianEmail && s.guardianEmail.includes('@')).length} with Email)
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleStartAutoBulkDispatch}
                  disabled={isBulkDispatching}
                  className={`px-3.5 py-1.5 font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
                    isBulkDispatching
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-blue-700 hover:bg-blue-800 text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isBulkDispatching
                      ? `Dispatching (${bulkDispatchIndex}/${studentsInSelectedClass.filter(s => s.guardianEmail && s.guardianEmail.includes('@')).length})...`
                      : '⚡ Auto Dispatch Queue'}
                  </span>
                </button>

                <button
                  onClick={handleCopyBulkDigest}
                  className="px-3 py-1.5 bg-mauve-900 hover:bg-mauve-800 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  {showCopiedDigestMsg ? <Check className="w-3.5 h-3.5 text-green-400" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
                  <span>{showCopiedDigestMsg ? 'Digest Copied!' : '📋 Copy All Email Bodies'}</span>
                </button>

                <button
                  onClick={handleOpenGroupedBCCMailer}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="Open mail app with all parent emails in BCC"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-300" />
                  <span>Grouped BCC Email</span>
                </button>

                <button
                  onClick={() => {
                    const validEmails = studentsInSelectedClass
                      .map(s => s.guardianEmail)
                      .filter(e => e && e.includes('@'));
                    if (validEmails.length > 0) {
                      navigator.clipboard.writeText(validEmails.join(', '));
                      setBatchCopiedMsg(true);
                      setTimeout(() => setBatchCopiedMsg(false), 2500);
                    } else {
                      alert('No guardian emails found in this class.');
                    }
                  }}
                  className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-mauve-800 font-bold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer border border-gray-300"
                >
                  {batchCopiedMsg ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Users className="w-3.5 h-3.5" />}
                  <span>{batchCopiedMsg ? 'Emails Copied!' : 'Copy Emails List'}</span>
                </button>
              </div>
            </div>

            {/* Student Dispatch Grid */}
            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {createBatchEmailDispatchList(studentsInSelectedClass, config, getStudentStatsForEmail, batchNote).map((item) => {
                const status = bulkDispatchStatus[item.student.id] || (item.hasEmail ? 'PENDING' : 'SKIPPED');

                return (
                  <div key={item.student.id} className="p-3 bg-white border border-mauve-200 rounded-xl hover:border-blue-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-mauve-900 text-xs">{item.student.name}</span>
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{item.student.rollNumber}</span>
                        {status === 'SENT' && (
                          <span className="text-[10px] font-bold bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 text-green-600" /> Dispatched
                          </span>
                        )}
                        {status === 'SKIPPED' && (
                          <span className="text-[10px] italic bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                            No Email
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600">
                        <span>Guardian: <strong>{item.student.guardianName || 'N/A'}</strong></span>
                        {item.hasEmail ? (
                          <span className="text-blue-700 font-mono font-medium flex items-center gap-1">
                            <Mail className="w-3 h-3 text-blue-600" /> {item.student.guardianEmail}
                          </span>
                        ) : (
                          <span className="text-amber-600 italic">No email stored</span>
                        )}
                        {item.hasPhone && (
                          <span className="text-green-700 font-mono font-medium flex items-center gap-1">
                            <Phone className="w-3 h-3 text-green-600" /> {item.student.guardianPhone}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedStudentId(item.student.id);
                          setShowBatchEmailModal(false);
                        }}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-mauve-800 font-bold rounded-lg text-xs transition cursor-pointer"
                        title="View Report Card"
                      >
                        View Report
                      </button>
                      
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(item.emailBody);
                          alert(`Email message body for ${item.student.name}'s guardian copied to clipboard!`);
                        }}
                        className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-mauve-800 font-bold rounded-lg text-xs transition cursor-pointer border border-gray-200"
                        title="Copy formatted email body for this ward"
                      >
                        Copy Body
                      </button>

                      {item.hasEmail && (
                        <a
                          href={item.mailtoUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => {
                            setBulkDispatchStatus(prev => ({ ...prev, [item.student.id]: 'SENT' }));
                          }}
                          className="px-2.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                        >
                          <Mail className="w-3 h-3" /> Send Email
                        </a>
                      )}
                      {item.hasPhone && (
                        <a
                          href={item.whatsAppUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg text-xs flex items-center gap-1 transition cursor-pointer shadow-xs"
                        >
                          <MessageSquare className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-mauve-100 flex justify-between items-center text-xs text-gray-500">
              <span>Tip: Click <strong>⚡ Auto Dispatch Queue</strong> to sequentially launch email messages for all guardians in {selectedClass}.</span>
              <button
                onClick={() => setShowBatchEmailModal(false)}
                className="px-4 py-2 bg-mauve-100 hover:bg-mauve-200 text-mauve-900 font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIRST TERM STUDENT PROMOTION MODAL */}
      {showPromotionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn no-print">
          <div className="bg-white rounded-2xl border border-mauve-250 w-full max-w-3xl p-6 shadow-2xl space-y-4 text-mauve-900 max-h-[92vh] flex flex-col">
            
            {/* Header */}
            <div className="flex justify-between items-center border-b border-mauve-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-mauve-900 text-base flex items-center gap-2">
                    First Term Student Promotion & Class Migration
                  </h4>
                  <p className="text-xs text-mauve-500">
                    Automated grade level progression roll for <strong>{config.schoolYear}</strong> (Reopening Date: {config.reopeningDate || '15th Sept 2026'}).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPromotionModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer p-1 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-indigo-50/70 border border-indigo-150 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-indigo-800 block">Total Enrolled</span>
                <span className="text-lg font-black text-indigo-950">{students.length} Pupils</span>
              </div>
              <div className="p-3 bg-green-50/70 border border-green-150 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-green-800 block">Promoting to Next Class</span>
                <span className="text-lg font-black text-green-950">
                  {students.filter(s => !s.className.toLowerCase().includes('graduated')).length} Pupils
                </span>
              </div>
              <div className="p-3 bg-amber-50/70 border border-amber-150 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-amber-800 block">Graduating JHS 3</span>
                <span className="text-lg font-black text-amber-950">
                  {students.filter(s => s.className.toLowerCase().includes('jhs 3')).length} Graduates
                </span>
              </div>
              <div className="p-3 bg-mauve-50 border border-mauve-200 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-mauve-800 block">Target Academic Cycle</span>
                <span className="text-sm font-black text-mauve-950 mt-1 block">{config.schoolYear}</span>
              </div>
            </div>

            {/* Reopening Date & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-mauve-50/80 p-3 rounded-xl border border-mauve-150 text-xs">
              <div className="flex items-center gap-2">
                <label className="font-bold text-mauve-900 shrink-0">First Term Reopening Date:</label>
                <input
                  type="date"
                  value={config.reopeningDate || '2026-09-15'}
                  onChange={(e) => setConfig(prev => ({ ...prev, reopeningDate: e.target.value }))}
                  className="p-1.5 rounded-lg border border-mauve-250 text-xs font-semibold bg-white text-mauve-900"
                />
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-mauve-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter pupil name or class..."
                  value={promotionSearchQuery}
                  onChange={(e) => setPromotionSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-mauve-250 bg-white focus:outline-none focus:ring-1 focus:ring-mauve-900"
                />
              </div>
            </div>

            {/* Student Migration Preview List */}
            <div className="overflow-y-auto flex-1 space-y-2 pr-1 max-h-[40vh]">
              {students
                .filter(s =>
                  s.name.toLowerCase().includes(promotionSearchQuery.toLowerCase()) ||
                  s.rollNumber.toLowerCase().includes(promotionSearchQuery.toLowerCase()) ||
                  s.className.toLowerCase().includes(promotionSearchQuery.toLowerCase())
                )
                .sort((a, b) => {
                  const comp = a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true, sensitivity: 'base' });
                  return studentSortOrder === 'asc' ? comp : -comp;
                })
                .map((student) => {
                  const { nextClass, isGraduated } = getNextClassAndLevel(student.className, student.level);
                  const isAlreadyGraduated = student.className.toLowerCase().includes('graduated');

                  return (
                    <div
                      key={student.id}
                      className="p-3 bg-white border border-mauve-200 rounded-xl hover:border-indigo-300 transition flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-mauve-900 text-xs">{student.name}</span>
                          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {student.rollNumber}
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-500 block">
                          Level: {student.level}
                        </span>
                      </div>

                      {/* Migration Arrow */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-400 block uppercase font-mono">Current</span>
                          <span className="text-xs font-semibold text-mauve-800 bg-gray-100 px-2 py-0.5 rounded">
                            {student.className}
                          </span>
                        </div>

                        <ArrowUpRight className="w-4 h-4 text-indigo-600 shrink-0" />

                        <div className="text-left">
                          <span className="text-[10px] text-gray-400 block uppercase font-mono">Promoted</span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              isGraduated
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : isAlreadyGraduated
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-green-100 text-green-900 border border-green-200'
                            }`}
                          >
                            {nextClass}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Note & Action Footer */}
            <div className="pt-3 border-t border-mauve-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-gray-500 leading-tight">
                ℹ️ Promotion migrates student class levels. Historical grades & attendance for prior terms are preserved in past transcripts.
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => setShowPromotionModal(false)}
                  className="flex-1 sm:flex-none px-4 py-2 bg-mauve-100 hover:bg-mauve-200 text-mauve-900 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleExecutePromotion()}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Execute First Term Promotion ({students.length} Pupils)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
