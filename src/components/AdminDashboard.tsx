/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Student, Subject, ReportConfig, Grade, Attendance, AcademicLevel, StudentBill, User } from '../types';
import { User as UserIcon, Users, GraduationCap, School, BookOpen, Settings, Search, Plus, Edit2, Trash2, Sliders, Check, AlertCircle, FileSpreadsheet, Upload, Download, Image as ImageIcon, X, LogOut, ChevronRight, ChevronLeft, ChevronDown, ChevronUp, HelpCircle, Lock, Share2, MessageSquare, Mail, Phone, ArrowUpRight, Calendar, Sparkles, Save, CheckCircle2, RotateCcw, Printer, FileText, ExternalLink, CreditCard, BarChart3, Camera, UserPlus, Boxes, Award, History, Contact, PhoneCall, Briefcase, BadgeCheck, UserCheck, MapPin, IdCard, Zap, Eye, Database, RefreshCw, Library } from 'lucide-react';
import ReportPDF from './ReportPDF';
import FeesCollectionModule from './FeesCollectionModule';
import FeesDashboard from './FeesDashboard';
import SchoolInventoryModule from './SchoolInventoryModule';
import BookInventoryModule from './BookInventoryModule';
import JHS3MockExamModule from './JHS3MockExamModule';
import JHSTerminalAssessmentHistoryModule from './JHSTerminalAssessmentHistoryModule';
import BulkSMSModule from './BulkSMSModule';
import ReportCardSMSAlertModule from './ReportCardSMSAlertModule';
import TeacherDashboard from './TeacherDashboard';
import { getSupabaseCredentials, getSupabaseClient, deleteSupabaseStudent, deleteSupabaseTeacher, saveSupabaseGrades, saveSupabaseAttendance, saveSupabaseConfig, saveSupabaseStudents, uploadStudentPhotoToSupabase, uploadTeacherPhotoToSupabase, fetchSupabaseBookStock } from '../lib/supabase';
import { createBatchEmailDispatchList, generateEmailReportBody, generateBatchEmailDigest } from '../services/emailDispatcher';
import { promoteStudents, getNextClassAndLevel, isAutoPromotionDue, undoPromotion, restoreAllStudentsToAdmittedLevels, restoreStudentsFromTerminalReport, assignStudentsToCorrectClassesFromId, resolveClassAndLevelFromStudentId, getUpdatedRollNumber, getUpdatedStudentId } from '../services/promotionService';
import { formatReopeningDate } from '../utils/dateUtils';
import { INITIAL_SUBJECTS } from '../data/mockData';
import { matchesSubject } from '../utils/subjectUtils';

interface AdminDashboardProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  teachers: User[];
  setTeachers: React.Dispatch<React.SetStateAction<User[]>>;
  subjects: Subject[];
  grades: Grade[];
  setGrades?: React.Dispatch<React.SetStateAction<Grade[]>>;
  attendance: Attendance[];
  setAttendance: React.Dispatch<React.SetStateAction<Attendance[]>>;
  bills?: StudentBill[];
  onUpdateBill?: (bill: StudentBill) => void;
  config: ReportConfig;
  setConfig: React.Dispatch<React.SetStateAction<ReportConfig>>;
  classes: { NURSERY: string[]; KINDERGARTEN?: string[]; PRIMARY: string[]; JHS: string[] };
  onSignOut?: () => void;
  supabaseStatus?: { isConfigured: boolean; isConnected: boolean; message: string };
  isSupabaseSyncing?: boolean;
  onPullFromSupabase?: () => Promise<boolean>;
  onPushToSupabase?: (customStudents?: Student[], customConfig?: ReportConfig) => Promise<boolean>;
  onCheckSupabaseStatus?: () => Promise<boolean>;
  storedAdminPassword?: string;
  onUpdateAdminPassword?: (newPass: string) => void;
}


type AdminTab = 'analytics' | 'fees-dashboard' | 'fees' | 'bulk-sms' | 'report-sms-alerts' | 'transcripts' | 'jhs3-mock' | 'terminal-history' | 'students' | 'teachers' | 'teacher-profiles' | 'class-assignments' | 'inventory' | 'book-inventory' | 'config';

export default function AdminDashboard({
  students,
  setStudents,
  teachers,
  setTeachers,
  subjects,
  grades,
  setGrades,
  attendance,
  setAttendance,
  bills,
  onUpdateBill,
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

  // Book Inventory & Textbook Stock Quick Summary for Admin Overview
  const [bookStockSummary, setBookStockSummary] = useState<{
    totalTitles: number;
    totalStock: number;
    totalSold: number;
    totalRemaining: number;
    lowStockCount: number;
    totalSalesValue: number;
  }>({
    totalTitles: 0,
    totalStock: 0,
    totalSold: 0,
    totalRemaining: 0,
    lowStockCount: 0,
    totalSalesValue: 0
  });

  useEffect(() => {
    const updateBookSummary = async () => {
      try {
        const stocks = await fetchSupabaseBookStock();
        if (Array.isArray(stocks)) {
          const totalTitles = stocks.length;
          const totalStock = stocks.reduce((sum, b) => sum + (Number(b.quantityInStock) || 0), 0);
          const totalSold = stocks.reduce((sum, b) => sum + (Number(b.quantitySold) || 0), 0);
          const totalRemaining = stocks.reduce((sum, b) => sum + (Number(b.quantityRemaining) || 0), 0);
          const lowStockCount = stocks.filter((b) => (Number(b.quantityRemaining) || 0) <= (Number(b.lowStockThreshold) || 20)).length;
          const totalSalesValue = stocks.reduce((sum, b) => sum + ((Number(b.quantitySold) || 0) * (Number(b.unitPrice) || 0)), 0);
          setBookStockSummary({
            totalTitles,
            totalStock,
            totalSold,
            totalRemaining,
            lowStockCount,
            totalSalesValue
          });
        }
      } catch (e) {
        console.warn('Error fetching book stock summary for admin overview:', e);
      }
    };

    updateBookSummary();
    window.addEventListener('ea_book_stock_updated', updateBookSummary);
    window.addEventListener('ea_book_sales_updated', updateBookSummary);
    return () => {
      window.removeEventListener('ea_book_stock_updated', updateBookSummary);
      window.removeEventListener('ea_book_sales_updated', updateBookSummary);
    };
  }, []);

  // Config Update State
  const [configUpdateSuccess, setConfigUpdateSuccess] = useState<string | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [formConfig, setFormConfig] = useState<ReportConfig>(config);
  const [isFormConfigDirty, setIsFormConfigDirty] = useState(false);

  // Synchronize form draft when external config updates (only if user hasn't typed uncommitted changes)
  useEffect(() => {
    if (!isFormConfigDirty) {
      setFormConfig(config);
    }
  }, [config, isFormConfigDirty]);

  const handleUpdateSystemConfig = async () => {
    setIsSavingConfig(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedConfig: ReportConfig = {
        ...formConfig,
        updatedAt: nowIso
      };
      setConfig(updatedConfig);
      setIsFormConfigDirty(false);
      localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
      localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updatedConfig));
      if (getSupabaseCredentials().isConfigured) {
        await saveSupabaseConfig(updatedConfig);
        await onPushToSupabase?.(undefined, updatedConfig);
      }
      const isThirdTerm = updatedConfig.term?.toLowerCase().includes('3') || updatedConfig.term?.toLowerCase().includes('third');
      const termNotice = isThirdTerm
        ? 'Promotional status is active on Third Term report templates.'
        : 'Promotional status is hidden (only appears on Third Term templates).';

      setConfigUpdateSuccess(`System Settings updated successfully! Academic Year: "${updatedConfig.schoolYear}", Term: "${updatedConfig.term}". ${termNotice}`);
      setTimeout(() => {
        setConfigUpdateSuccess(null);
      }, 7000);
    } catch (err) {
      console.error('Error saving config:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

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
  const [viewingStudentProfile, setViewingStudentProfile] = useState<Student | null>(null);
  const [profileTab, setProfileTab] = useState<'academic' | 'attendance' | 'guardian'>('academic');
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isUploadingStudentPhoto, setIsUploadingStudentPhoto] = useState(false);
  const [studentForm, setStudentForm] = useState({
    name: '',
    rollNumber: '',
    level: 'PRIMARY' as AcademicLevel,
    className: 'Primary 1',
    guardianName: '',
    guardianEmail: '',
    guardianPhone: '',
    photoUrl: ''
  });

  // Teacher Registration & Profile Form State
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [isUploadingTeacherPhoto, setIsUploadingTeacherPhoto] = useState(false);
  const [teacherForm, setTeacherForm] = useState({
    name: '',
    email: '',
    password: '',
    level: 'PRIMARY' as AcademicLevel,
    classes: [] as string[],
    subjects: [] as string[],
    dateOfBirth: '',
    phoneNumber: '',
    qualification: '',
    profilePicture: '',
    hometown: '',
    ghanaCardNumber: ''
  });
  const [teacherError, setTeacherError] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);

  // Teacher Profiles View states
  const [teacherProfileSearchTerm, setTeacherProfileSearchTerm] = useState('');
  const [teacherProfileLevelFilter, setTeacherProfileLevelFilter] = useState('ALL');
  const [viewingTeacherProfileModal, setViewingTeacherProfileModal] = useState<User | null>(null);
  const [selectedWorkstationTeacher, setSelectedWorkstationTeacher] = useState<User | null>(null);

  // Transcript Selector state
  const [selectedClass, setSelectedClass] = useState('Primary 4');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [showBatchEmailModal, setShowBatchEmailModal] = useState(false);
  const [batchCopiedMsg, setBatchCopiedMsg] = useState(false);

  // Interactive Transcript Selector dropdown states
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [isStudentDropdownOpen, setIsStudentDropdownOpen] = useState(false);
  const [studentDropdownSearch, setStudentDropdownSearch] = useState('');
  const [classDropdownSearch, setClassDropdownSearch] = useState('');
  const classDropdownRef = React.useRef<HTMLDivElement>(null);
  const studentDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside (support both desktop mousedown and mobile touchstart)
  useEffect(() => {
    const handleOutsideClick = (e: Event) => {
      const targetNode = e.target as Node;
      if (classDropdownRef.current && !classDropdownRef.current.contains(targetNode)) {
        setIsClassDropdownOpen(false);
      }
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(targetNode)) {
        setIsStudentDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, []);

  // Automated Bulk Email Dispatcher states
  const [batchNote, setBatchNote] = useState('');
  const [isBulkDispatching, setIsBulkDispatching] = useState(false);
  const [bulkDispatchIndex, setBulkDispatchIndex] = useState(-1);
  const [bulkDispatchStatus, setBulkDispatchStatus] = useState<Record<string, 'SENT' | 'SKIPPED' | 'PENDING'>>({});
  const [showCopiedDigestMsg, setShowCopiedDigestMsg] = useState(false);

  // Bulk Printing states
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);
  const [bulkPrintClass, setBulkPrintClass] = useState<string>('Primary 4');
  const [selectedBulkStudentIds, setSelectedBulkStudentIds] = useState<string[]>([]);
  const [bulkStudentSearch, setBulkStudentSearch] = useState<string>('');

  const handleOpenBulkPrintModal = (targetClass?: string) => {
    const cls = targetClass || selectedClass || 'Primary 4';
    setBulkPrintClass(cls);
    const clsStudents = cls === 'ALL' ? students : students.filter(s => s.className === cls);
    setSelectedBulkStudentIds(clsStudents.map(s => s.id));
    setBulkStudentSearch('');
    setShowBulkPrintModal(true);
  };

  const handleToggleStudentBulkSelection = (studentId: string) => {
    setSelectedBulkStudentIds(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleToggleSelectAllBulkStudents = (currentList: Student[]) => {
    const currentIds = currentList.map(s => s.id);
    const allSelected = currentIds.every(id => selectedBulkStudentIds.includes(id));
    if (allSelected) {
      setSelectedBulkStudentIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      const newSelected = Array.from(new Set([...selectedBulkStudentIds, ...currentIds]));
      setSelectedBulkStudentIds(newSelected);
    }
  };

  // First Term Promotion states
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionSuccessMsg, setPromotionSuccessMsg] = useState('');
  const [promotionSearchQuery, setPromotionSearchQuery] = useState('');

  // Grade Data Recovery and Local Backup states
  const [backupRestoreMsg, setBackupRestoreMsg] = useState('');
  const [backupRestoreError, setBackupRestoreError] = useState('');
  const [isExportingData, setIsExportingData] = useState(false);
  const [isRecoveringCloud, setIsRecoveringCloud] = useState(false);

  const handleExportFullSystemBackup = () => {
    setIsExportingData(true);
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        schoolName: config.schoolName,
        students,
        teachers,
        grades,
        attendance,
        bills,
        config
      };
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `eastfield_academy_assessment_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setBackupRestoreMsg('✅ Full system assessment & database backup exported successfully!');
      setTimeout(() => setBackupRestoreMsg(''), 6000);
    } catch (e: any) {
      setBackupRestoreError('Failed to export backup: ' + (e.message || String(e)));
    } finally {
      setIsExportingData(false);
    }
  };

  const handleImportSystemBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid JSON file format.');
        }
        let restoredCount = 0;
        if (Array.isArray(parsed.grades) && parsed.grades.length > 0) {
          // Merge with existing grades safely
          const gradeMap = new Map<string, Grade>();
          grades.forEach(g => {
            const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
            gradeMap.set(key, g);
          });
          parsed.grades.forEach((g: Grade) => {
            const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
            gradeMap.set(key, g);
            restoredCount++;
          });
          const mergedGrades = Array.from(gradeMap.values());
          setGrades(mergedGrades);
          localStorage.setItem('ea_grades', JSON.stringify(mergedGrades));
          localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(mergedGrades));
          if (getSupabaseCredentials().isConfigured) {
            await saveSupabaseGrades(mergedGrades);
          }
        }
        if (Array.isArray(parsed.attendance) && parsed.attendance.length > 0) {
          const attMap = new Map<string, Attendance>();
          attendance.forEach(a => {
            const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`;
            attMap.set(key, a);
          });
          parsed.attendance.forEach((a: Attendance) => {
            const key = `${a.studentId}_${a.term || 'Term 1'}_${a.year || '2025/2026'}`;
            attMap.set(key, a);
          });
          const mergedAtt = Array.from(attMap.values());
          setAttendance(mergedAtt);
          localStorage.setItem('ea_attendance', JSON.stringify(mergedAtt));
          localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(mergedAtt));
          if (getSupabaseCredentials().isConfigured) {
            await saveSupabaseAttendance(mergedAtt);
          }
        }
        setBackupRestoreMsg(`🎉 Successfully restored & merged ${restoredCount} assessment marks and attendance records!`);
        setTimeout(() => setBackupRestoreMsg(''), 8000);
      } catch (err: any) {
        setBackupRestoreError('Error importing backup file: ' + (err.message || 'Corrupted file'));
        setTimeout(() => setBackupRestoreError(''), 7000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDeepCloudGradeRecovery = async () => {
    setIsRecoveringCloud(true);
    setBackupRestoreMsg('');
    setBackupRestoreError('');
    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase Cloud is not configured on this device.');
      }
      const { data, error } = await client.from('ea_grades').select('*');
      if (error) throw error;
      if (!data || data.length === 0) {
        setBackupRestoreMsg('No remote records found in Supabase table "ea_grades".');
        return;
      }
      // Process remote grades
      const gradeMap = new Map<string, Grade>();
      grades.forEach(g => {
        const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
        gradeMap.set(key, g);
      });
      let addedOrUpdated = 0;
      data.forEach(item => {
        const rawNurseryRem = (item.nursery_remark || item.nurseryRemark || '').toString().trim().toUpperCase();
        const remUpper = (item.remarks || '').toString().trim().toUpperCase();
        const totalScoreNum = item.total_score !== undefined && item.total_score !== null ? Number(item.total_score) : ((Number(item.class_score) || 0) + (Number(item.exam_score) || 0));

        let resolvedNurseryRemark: 'MO' | 'O' | 'S' | 'NA' | undefined = undefined;
        if (['MO', 'O', 'S', 'NA'].includes(rawNurseryRem)) {
          resolvedNurseryRemark = rawNurseryRem as 'MO' | 'O' | 'S' | 'NA';
        } else if (['MO', 'O', 'S', 'NA'].includes(remUpper)) {
          resolvedNurseryRemark = remUpper as 'MO' | 'O' | 'S' | 'NA';
        }

        const gRec: Grade = {
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
          updatedAt: item.updated_at || new Date().toISOString(),
        };
        const key = `${gRec.studentId}_${gRec.subjectId}_${gRec.term || 'Term 1'}_${gRec.year || '2025/2026'}`;
        gradeMap.set(key, gRec);
        addedOrUpdated++;
      });
      const merged = Array.from(gradeMap.values());
      setGrades(merged);
      localStorage.setItem('ea_grades', JSON.stringify(merged));
      localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(merged));
      setBackupRestoreMsg(`✨ Successfully recovered and synced ${addedOrUpdated} marks from Supabase Cloud!`);
      setTimeout(() => setBackupRestoreMsg(''), 8000);
    } catch (err: any) {
      setBackupRestoreError('Cloud Grade Recovery Error: ' + (err.message || String(err)));
      setTimeout(() => setBackupRestoreError(''), 8000);
    } finally {
      setIsRecoveringCloud(false);
    }
  };

  const handleExecutePromotion = (targetYear?: string) => {
    const activeYear = targetYear || config.schoolYear;
    const preSnapshot = JSON.parse(JSON.stringify(students));
    const result = promoteStudents(students, activeYear);
    
    // Map previous student IDs to new student IDs for seamless relational integrity
    const idMap = new Map<string, string>();
    result.records.forEach(r => {
      if (r.oldStudentId && r.newStudentId && r.oldStudentId !== r.newStudentId) {
        idMap.set(r.oldStudentId, r.newStudentId);
      }
    });

    if (idMap.size > 0 && setGrades) {
      setGrades(prev => {
        const updated = prev.map(g => {
          const newId = idMap.get(g.studentId);
          return newId ? { ...g, studentId: newId } : g;
        });
        localStorage.setItem('ea_grades', JSON.stringify(updated));
        localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(updated));
        return updated;
      });
    }

    if (idMap.size > 0 && setAttendance) {
      setAttendance(prev => {
        const updated = prev.map(a => {
          const newId = idMap.get(a.studentId);
          return newId ? { ...a, studentId: newId } : a;
        });
        localStorage.setItem('ea_attendance', JSON.stringify(updated));
        return updated;
      });
    }

    if (idMap.size > 0 && bills && onUpdateBill) {
      bills.forEach(b => {
        const newId = idMap.get(b.studentId);
        if (newId) {
          onUpdateBill({ ...b, studentId: newId });
        }
      });
    }

    setStudents(result.promotedStudents);
    
    const updatedConfig: ReportConfig = {
      ...config,
      lastPromotedYear: activeYear,
      promotionUndoneYear: undefined,
      lastPromotionDate: new Date().toISOString(),
      prePromotionSnapshot: preSnapshot,
      updatedAt: new Date().toISOString()
    };
    setConfig(updatedConfig);
    setFormConfig(updatedConfig);
    
    localStorage.setItem('ea_students', JSON.stringify(result.promotedStudents));
    localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
    localStorage.setItem('mock_supabase_ea_students', JSON.stringify(result.promotedStudents));
    localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updatedConfig));
    localStorage.setItem('ea_pre_promotion_students', JSON.stringify(preSnapshot));

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      saveSupabaseStudents(result.promotedStudents).catch(err => console.warn('Supabase student promotion sync error', err));
      saveSupabaseConfig(updatedConfig).catch(err => console.warn('Supabase config promotion sync error', err));
      onPushToSupabase?.(result.promotedStudents, updatedConfig);
    }

    setPromotionSuccessMsg(`🎓 Promotion complete! Migrated all ${result.promotedCount} pupils to their next class and updated student IDs for ${activeYear}.`);
    setTimeout(() => setPromotionSuccessMsg(''), 10000);
    setShowPromotionModal(false);
  };

  const handleUndoPromotion = () => {
    if (!confirm('Are you sure you want to REVERSE / UNDO student promotion? This will restore all pupils back to their previous grade levels and IDs before promotion.')) {
      return;
    }

    let snapshot = config.prePromotionSnapshot;
    if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) {
      const cached = localStorage.getItem('ea_pre_promotion_students');
      if (cached) {
        try {
          snapshot = JSON.parse(cached);
        } catch (e) {
          console.warn('Failed parsing cached pre-promotion snapshot', e);
        }
      }
    }

    const { restoredStudents, revertedCount } = undoPromotion(students, snapshot);

    // Map reverted student IDs back
    const revertIdMap = new Map<string, string>();
    students.forEach((s) => {
      const restored = restoredStudents.find(r => r.name.toLowerCase().trim() === s.name.toLowerCase().trim());
      if (restored && s.id !== restored.id) {
        revertIdMap.set(s.id, restored.id);
      }
    });

    if (revertIdMap.size > 0 && setGrades) {
      setGrades(prev => {
        const updated = prev.map(g => {
          const oldId = revertIdMap.get(g.studentId);
          return oldId ? { ...g, studentId: oldId } : g;
        });
        localStorage.setItem('ea_grades', JSON.stringify(updated));
        localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(updated));
        return updated;
      });
    }

    if (revertIdMap.size > 0 && setAttendance) {
      setAttendance(prev => {
        const updated = prev.map(a => {
          const oldId = revertIdMap.get(a.studentId);
          return oldId ? { ...a, studentId: oldId } : a;
        });
        localStorage.setItem('ea_attendance', JSON.stringify(updated));
        return updated;
      });
    }

    setStudents(restoredStudents);

    const updatedConfig: ReportConfig = {
      ...config,
      lastPromotedYear: `undone_${config.schoolYear}`,
      promotionUndoneYear: config.schoolYear,
      prePromotionSnapshot: undefined,
      updatedAt: new Date().toISOString()
    };
    setConfig(updatedConfig);
    setFormConfig(updatedConfig);

    localStorage.setItem('ea_students', JSON.stringify(restoredStudents));
    localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
    localStorage.setItem('mock_supabase_ea_students', JSON.stringify(restoredStudents));
    localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updatedConfig));
    localStorage.removeItem('ea_pre_promotion_students');

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      saveSupabaseStudents(restoredStudents).catch(err => console.warn('Supabase student undo sync error', err));
      saveSupabaseConfig(updatedConfig).catch(err => console.warn('Supabase config undo sync error', err));
      onPushToSupabase?.(restoredStudents, updatedConfig);
    }

    setPromotionSuccessMsg(`🔄 Promotion reversed! Restored ${revertedCount} pupils back to previous classes & IDs.`);
    setTimeout(() => setPromotionSuccessMsg(''), 8000);
    setShowPromotionModal(false);
  };

  const handleRestoreFromTerminalReport = () => {
    if (!confirm('Are you sure you want to restore previous registered students based on previous term (Term 3) terminal reports? All 170 registered pupils will be verified, enrolled, and assigned.')) {
      return;
    }

    const { restoredStudents, restoredCount } = restoreStudentsFromTerminalReport(students, grades);
    setStudents(restoredStudents);

    const updatedConfig: ReportConfig = {
      ...config,
      lastPromotedYear: `undone_${config.schoolYear}`,
      promotionUndoneYear: config.schoolYear,
      prePromotionSnapshot: undefined,
      updatedAt: new Date().toISOString()
    };
    setConfig(updatedConfig);
    setFormConfig(updatedConfig);

    localStorage.setItem('ea_students', JSON.stringify(restoredStudents));
    localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
    localStorage.setItem('mock_supabase_ea_students', JSON.stringify(restoredStudents));
    localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updatedConfig));
    localStorage.removeItem('ea_pre_promotion_students');

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      saveSupabaseStudents(restoredStudents).catch(err => console.warn('Supabase student restore sync error', err));
      saveSupabaseConfig(updatedConfig).catch(err => console.warn('Supabase config restore sync error', err));
      onPushToSupabase?.(restoredStudents, updatedConfig);
    }

    setPromotionSuccessMsg(`📋 Restored and verified ${restoredStudents.length} registered pupils (${restoredCount} updated) from previous term terminal reports!`);
    setTimeout(() => setPromotionSuccessMsg(''), 10000);
    setShowPromotionModal(false);
  };

  const handleRestoreAdmittedClasses = () => {
    if (!confirm('Are you sure you want to restore all pupils back to their original admitted class levels?')) {
      return;
    }

    const baseRestored = restoreAllStudentsToAdmittedLevels(students);
    const { restoredStudents } = restoreStudentsFromTerminalReport(baseRestored, grades);
    const revertedCount = restoredStudents.filter((s, idx) => s.className !== students[idx]?.className || s.level !== students[idx]?.level).length;
    setStudents(restoredStudents);

    const updatedConfig: ReportConfig = {
      ...config,
      lastPromotedYear: `undone_${config.schoolYear}`,
      promotionUndoneYear: config.schoolYear,
      prePromotionSnapshot: undefined,
      updatedAt: new Date().toISOString()
    };
    setConfig(updatedConfig);
    setFormConfig(updatedConfig);

    localStorage.setItem('ea_students', JSON.stringify(restoredStudents));
    localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
    localStorage.setItem('mock_supabase_ea_students', JSON.stringify(restoredStudents));
    localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updatedConfig));
    localStorage.removeItem('ea_pre_promotion_students');

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      saveSupabaseStudents(restoredStudents).catch(err => console.warn('Supabase student restore sync error', err));
      saveSupabaseConfig(updatedConfig).catch(err => console.warn('Supabase config restore sync error', err));
      onPushToSupabase?.(restoredStudents, updatedConfig);
    }

    setPromotionSuccessMsg(`↺ Restored all pupils to their original admitted class levels (${revertedCount > 0 ? revertedCount : restoredStudents.length} pupils updated).`);
    setTimeout(() => setPromotionSuccessMsg(''), 10000);
    setShowPromotionModal(false);
  };

  const handleAssignClassesFromIds = () => {
    const corrected = assignStudentsToCorrectClassesFromId(students);
    const updatedCount = corrected.filter((s, idx) => s.className !== students[idx]?.className || s.level !== students[idx]?.level).length;
    setStudents(corrected);

    localStorage.setItem('ea_students', JSON.stringify(corrected));
    localStorage.setItem('mock_supabase_ea_students', JSON.stringify(corrected));

    const creds = getSupabaseCredentials();
    if (creds.isConfigured) {
      saveSupabaseStudents(corrected).catch(err => console.warn('Supabase student sync error', err));
      onPushToSupabase?.(corrected, config);
    }

    setPromotionSuccessMsg(`✨ ID Alignment Complete: Scanned roll numbers (e.g. EA/J1/... -> JHS 1) and aligned all ${corrected.length} pupils (${updatedCount} updated) to their proper class!`);
    setTimeout(() => setPromotionSuccessMsg(''), 10000);
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
        setFormConfig(prev => ({
          ...prev,
          schoolLogoUrl: publicUrl
        }));
        setIsFormConfigDirty(true);
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
        setFormConfig(prev => ({
          ...prev,
          schoolLogoUrl: resizedBase64
        }));
        setIsFormConfigDirty(true);
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
    setFormConfig(prev => {
      const copy = { ...prev };
      delete copy.schoolLogoUrl;
      return copy;
    });
    setIsFormConfigDirty(true);
    setLogoUploadError('');
  };

  const [signatureUploadError, setSignatureUploadError] = useState<string>('');

  const handleSignatureFile = async (file: File) => {
    setSignatureUploadError('');
    if (!file.type.startsWith('image/')) {
      setSignatureUploadError('Unsupported file type. Please upload an image file (PNG, JPG, or SVG).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setSignatureUploadError('Signature file too large. Please upload an image under 2MB.');
      return;
    }
    try {
      const resizedBase64 = await resizeImage(file, 250, 100);
      if (resizedBase64) {
        setConfig(prev => ({
          ...prev,
          principalSignatureUrl: resizedBase64
        }));
        setFormConfig(prev => ({
          ...prev,
          principalSignatureUrl: resizedBase64
        }));
        setIsFormConfigDirty(true);
      } else {
        setSignatureUploadError('Failed to read and process signature image.');
      }
    } catch (err) {
      setSignatureUploadError('Failed to process signature image.');
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleSignatureFile(e.target.files[0]);
    }
  };

  const handleClearSignature = () => {
    setConfig(prev => {
      const copy = { ...prev };
      delete copy.principalSignatureUrl;
      return copy;
    });
    setFormConfig(prev => {
      const copy = { ...prev };
      delete copy.principalSignatureUrl;
      return copy;
    });
    setIsFormConfigDirty(true);
    setSignatureUploadError('');
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
  const standardClasses = [...classes.NURSERY, ...kgClasses, ...classes.PRIMARY, ...classes.JHS];
  const customStudentClasses = Array.from(new Set(students.map((s) => s.className).filter(Boolean)));
  const allClassNames = Array.from(new Set([...standardClasses, ...customStudentClasses]));

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

    // Auto-resolve class from Roll Number / ID if formatted (e.g. EA/J1/2026/005 -> JHS 1)
    const resolved = resolveClassAndLevelFromStudentId(studentForm.rollNumber, studentForm.level);
    const finalClassName = studentForm.className || resolved.className;
    const finalLevel = studentForm.level || resolved.level;

    let updatedStudentsList: Student[];
    if (editingStudent) {
      // Edit Student
      updatedStudentsList = students.map(s => s.id === editingStudent.id ? {
        ...s,
        ...studentForm,
        className: finalClassName,
        level: finalLevel
      } : s);
    } else {
      // Add Student
      const newStudent: Student = {
        id: `st-${Date.now()}`,
        name: studentForm.name,
        rollNumber: studentForm.rollNumber,
        level: finalLevel,
        className: finalClassName,
        guardianName: studentForm.guardianName,
        guardianEmail: studentForm.guardianEmail,
        guardianPhone: studentForm.guardianPhone,
        photoUrl: studentForm.photoUrl
      };
      updatedStudentsList = [...students, newStudent];
    }

    setStudents(updatedStudentsList);

    // Global Supabase Sync
    if (onPushToSupabase) {
      onPushToSupabase(updatedStudentsList, config);
    }

    // Reset Form
    setStudentForm({
      name: '',
      rollNumber: '',
      level: 'PRIMARY',
      className: 'Primary 1',
      guardianName: '',
      guardianEmail: '',
      guardianPhone: '',
      photoUrl: ''
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
      guardianPhone: student.guardianPhone || '',
      photoUrl: student.photoUrl || ''
    });
    setShowStudentModal(true);
  };

  const handleDeleteStudent = async (id: string) => {
    const studentToDelete = students.find(s => s.id === id);
    const rollNumber = studentToDelete?.rollNumber;
    const studentName = studentToDelete?.name;

    const remainingStudents = students.filter(s => s.id !== id);
    setStudents(remainingStudents);
    if (selectedStudentId === id) setSelectedStudentId('');

    // Clean up grades and attendance for this student in local state
    if (setGrades) {
      setGrades(prev => prev.filter(g => g.studentId !== id && (!rollNumber || g.studentId !== rollNumber)));
    }
    if (setAttendance) {
      setAttendance(prev => prev.filter(a => a.studentId !== id && (!rollNumber || a.studentId !== rollNumber)));
    }

    // Call deleteSupabaseStudent unconditionally (records tombstone, purges caches, and deletes remote DB)
    await deleteSupabaseStudent(id, rollNumber, studentName);

    // Sync remaining students globally
    if (onPushToSupabase) {
      onPushToSupabase(remainingStudents, config);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    const teacherToDelete = teachers.find(t => t.id === id);
    const email = teacherToDelete?.email;
    const name = teacherToDelete?.name;

    const remainingTeachers = teachers.filter(t => t.id !== id);
    setTeachers(remainingTeachers);

    // Call deleteSupabaseTeacher unconditionally
    await deleteSupabaseTeacher(id, email, name);
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

    if (!teacherForm.name.trim() || !teacherForm.email.trim()) {
      setTeacherError('Please enter Name and Email address.');
      return;
    }

    // STRICT CONSTRAINT CHECK: JHS Teachers handle at most 2 subjects
    if (teacherForm.level === 'JHS' && teacherForm.subjects.length > 2) {
      setTeacherError('Strict Constraint: Junior High School (JHS) teachers must handle AT MOST TWO subjects.');
      return;
    }

    let finalSubjects = (teacherForm.level === 'NURSERY' || teacherForm.level === 'KINDERGARTEN' || teacherForm.level === 'PRIMARY')
      ? subjects.filter(s => s.level === teacherForm.level).map(s => s.id)
      : teacherForm.subjects;

    if (finalSubjects.length === 0) {
      const levelMatches = subjects.filter(s => s.level === teacherForm.level).map(s => s.id);
      if (levelMatches.length > 0) {
        finalSubjects = levelMatches;
      }
    }

    if (finalSubjects.length === 0) {
      setTeacherError('Please select at least one subject to assign to the teacher.');
      return;
    }

    const selectedClasses = teacherForm.classes || [];

    if (editingTeacher) {
      // Edit Teacher & clean up reassigned classes from other teachers
      const emailToCheck = teacherForm.email.trim().toLowerCase();
      if (teachers.some(t => t.id !== editingTeacher.id && t.email.trim().toLowerCase() === emailToCheck)) {
        setTeacherError('A teacher with this email address is already registered.');
        return;
      }
      setTeachers(prev => prev.map(t => {
        if (t.id === editingTeacher.id) {
          return {
            ...t,
            name: teacherForm.name.trim(),
            email: teacherForm.email.trim(),
            password: teacherForm.password ? teacherForm.password : (t.password || 'teacher123'),
            level: teacherForm.level,
            classes: selectedClasses,
            subjects: finalSubjects,
            dateOfBirth: teacherForm.dateOfBirth,
            phoneNumber: teacherForm.phoneNumber,
            qualification: teacherForm.qualification,
            profilePicture: teacherForm.profilePicture,
            hometown: teacherForm.hometown,
            ghanaCardNumber: teacherForm.ghanaCardNumber
          };
        }
        if (selectedClasses.some(cls => t.classes?.includes(cls))) {
          return {
            ...t,
            classes: (t.classes || []).filter(c => !selectedClasses.includes(c))
          };
        }
        return t;
      }));
      setEditingTeacher(null);
    } else {
      // Add new Teacher & clean up reassigned classes from other teachers
      const emailToCheck = teacherForm.email.trim().toLowerCase();
      if (teachers.some(t => t.email.trim().toLowerCase() === emailToCheck)) {
        setTeacherError('A teacher with this email address is already registered.');
        return;
      }
      const newTeacher: User = {
        id: `user-t-${Date.now()}`,
        name: teacherForm.name.trim(),
        email: teacherForm.email.trim(),
        role: 'TEACHER',
        level: teacherForm.level,
        classes: selectedClasses,
        subjects: finalSubjects,
        password: teacherForm.password || 'teacher123',
        dateOfBirth: teacherForm.dateOfBirth,
        phoneNumber: teacherForm.phoneNumber,
        qualification: teacherForm.qualification,
        profilePicture: teacherForm.profilePicture,
        hometown: teacherForm.hometown,
        ghanaCardNumber: teacherForm.ghanaCardNumber
      };
      setTeachers(prev => {
        const updated = prev.map(t => {
          if (selectedClasses.some(cls => t.classes?.includes(cls))) {
            return {
              ...t,
              classes: (t.classes || []).filter(c => !selectedClasses.includes(c))
            };
          }
          return t;
        });
        return [...updated, newTeacher];
      });
    }

    // Reset
    setTeacherForm({
      name: '',
      email: '',
      password: '',
      level: 'PRIMARY',
      classes: [],
      subjects: subjects.filter(s => s.level === 'PRIMARY').map(s => s.id),
      dateOfBirth: '',
      phoneNumber: '',
      qualification: '',
      profilePicture: '',
      hometown: '',
      ghanaCardNumber: ''
    });
    setShowTeacherModal(false);
  };

  const filteredTeacherProfiles = teachers.filter((t) => {
    if (t.role !== 'TEACHER') return false;
    if (teacherProfileLevelFilter !== 'ALL' && t.level !== teacherProfileLevelFilter) return false;
    if (teacherProfileSearchTerm.trim()) {
      const term = teacherProfileSearchTerm.toLowerCase().trim();
      const nameMatch = t.name.toLowerCase().includes(term);
      const emailMatch = t.email.toLowerCase().includes(term);
      const qualMatch = t.qualification?.toLowerCase().includes(term);
      const phoneMatch = t.phoneNumber?.toLowerCase().includes(term);
      const homeMatch = t.hometown?.toLowerCase().includes(term);
      const ghanaCardMatch = t.ghanaCardNumber?.toLowerCase().includes(term);
      const classMatch = t.classes?.some(c => c.toLowerCase().includes(term));
      return nameMatch || emailMatch || qualMatch || phoneMatch || homeMatch || ghanaCardMatch || classMatch;
    }
    return true;
  });

  const toggleClassForTeacherForm = (className: string) => {
    setTeacherError('');
    setTeacherForm(prev => {
      const alreadySelected = prev.classes.includes(className);
      return {
        ...prev,
        classes: alreadySelected ? [] : [className]
      };
    });
  };

  const toggleSubjectForTeacherForm = (subId: string) => {
    setTeacherForm(prev => {
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
        // Conflict Check with both ID, name, and code for JHS
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
    setIsClassDropdownOpen(false);
    setClassDropdownSearch('');
    const firstStudent = students.find((s) => s.className === cls);
    if (firstStudent) {
      setSelectedStudentId(firstStudent.id);
    } else {
      setSelectedStudentId('');
    }
  };

  const currentStudentIndex = studentsInSelectedClass.findIndex(s => s.id === selectedStudentId);
  const handlePrevStudent = () => {
    if (studentsInSelectedClass.length === 0) return;
    const prevIdx = currentStudentIndex > 0 ? currentStudentIndex - 1 : studentsInSelectedClass.length - 1;
    setSelectedStudentId(studentsInSelectedClass[prevIdx].id);
  };
  const handleNextStudent = () => {
    if (studentsInSelectedClass.length === 0) return;
    const nextIdx = currentStudentIndex < studentsInSelectedClass.length - 1 ? currentStudentIndex + 1 : 0;
    setSelectedStudentId(studentsInSelectedClass[nextIdx].id);
  };

  const filteredStudentsForDropdown = studentsInSelectedClass.filter(s => {
    if (!studentDropdownSearch.trim()) return true;
    const term = studentDropdownSearch.toLowerCase();
    return s.name.toLowerCase().includes(term) || s.rollNumber.toLowerCase().includes(term);
  });

  const filteredClassesForDropdown = allClassNames.filter(cls => {
    if (!classDropdownSearch.trim()) return true;
    return cls.toLowerCase().includes(classDropdownSearch.toLowerCase());
  });

  // Auto-sync selectedClass & selectedStudentId to ensure a pupil is always selected and visible in transcript view
  useEffect(() => {
    if (students.length > 0) {
      const inCurrentClass = students.filter((s) => s.className === selectedClass);
      if (inCurrentClass.length > 0) {
        if (!selectedStudentId || !inCurrentClass.some((s) => s.id === selectedStudentId)) {
          setSelectedStudentId(inCurrentClass[0].id);
        }
      } else {
        // If current selectedClass has no students, automatically switch to first class that has students
        const classWithStudents = allClassNames.find((cls) => students.some((s) => s.className === cls)) || students[0]?.className;
        if (classWithStudents && classWithStudents !== selectedClass) {
          setSelectedClass(classWithStudents);
          const firstInClass = students.find((s) => s.className === classWithStudents);
          if (firstInClass) {
            setSelectedStudentId(firstInClass.id);
          }
        }
      }
    }
  }, [students, selectedClass, selectedStudentId, allClassNames]);

  // Auto-heal students who are marked as "Graduated" / "Graduated JHS"
  useEffect(() => {
    if (students.length > 0) {
      const hasGraduated = students.some((s) => (s.className || '').toLowerCase().includes('graduated'));
      if (hasGraduated) {
        const restored = restoreAllStudentsToAdmittedLevels(students);
        setStudents(restored);
        localStorage.setItem('ea_students', JSON.stringify(restored));
        localStorage.setItem('mock_supabase_ea_students', JSON.stringify(restored));
        const creds = getSupabaseCredentials();
        if (creds.isConfigured) {
          saveSupabaseStudents(restored).catch((err) => console.warn('Sync restored students error', err));
          onPushToSupabase?.(restored, config);
        }
      }
    }
  }, [students, config, onPushToSupabase]);

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
            <p className="text-xs text-mauve-800 font-medium mt-0.5 leading-relaxed">
              Overall configurations, student admissions, teacher registries, and consolidated reports of {config.schoolName || 'Eastfield Academy'}.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full md:w-auto">
          {/* Dynamic Term Pill */}
          <div className="bg-mauve-900 text-white px-4 py-2.5 rounded border border-mauve-950 shadow-sm shrink-0 flex items-center gap-3">
            <School className="w-4 h-4 text-white" />
            <div className="text-left">
              <span className="block text-[9px] uppercase font-mono tracking-wider text-amber-200 font-bold">Active Term</span>
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
        <div className="p-3.5 bg-green-700 text-white rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fadeIn no-print">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-200 shrink-0" />
            <span>{promotionSuccessMsg}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleUndoPromotion}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-amber-950 rounded-lg text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer"
              title="Reverse student promotion"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Promotion</span>
            </button>
            <button onClick={() => setPromotionSuccessMsg('')} className="text-white hover:text-green-100 font-bold p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
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
              Reopening Date: <strong>{formatReopeningDate(config.reopeningDate)}</strong>.
              {config.lastPromotedYear === config.schoolYear ? (
                <span className="text-green-300 font-bold ml-1"> ✓ All enrolled pupils promoted for {config.schoolYear}.</span>
              ) : config.promotionUndoneYear === config.schoolYear || config.lastPromotedYear === `undone_${config.schoolYear}` ? (
                <span className="text-amber-300 font-bold ml-1"> ↺ Promotion for {config.schoolYear} is currently reversed / undone.</span>
              ) : (
                <span className="text-amber-200 font-medium ml-1"> Automatically migrates pupils to next class upon First Term reopening.</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            onClick={() => setShowPromotionModal(true)}
            className="px-3.5 py-2 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer flex-1 sm:flex-none"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Review & Execute Promotion</span>
          </button>

          <button
            onClick={handleUndoPromotion}
            className="px-3 py-2 bg-rose-600/90 hover:bg-rose-600 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer border border-rose-400/40 flex-1 sm:flex-none"
            title="Undo / Reverse promotion and restore pupils to pre-promotion classes"
          >
            <RotateCcw className="w-3.5 h-3.5 text-yellow-300" />
            <span>Undo Promotion</span>
          </button>

          <button
            onClick={handleRestoreFromTerminalReport}
            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer border border-emerald-400/40 flex-1 sm:flex-none"
            title="Restore previous registered students from previous term (Term 3) terminal reports"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-200" />
            <span>Restore from Terminal Report</span>
          </button>

          <button
            onClick={handleRestoreAdmittedClasses}
            className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer border border-indigo-400/40 flex-1 sm:flex-none"
            title="Restore all pupils to their original admitted class levels"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-200" />
            <span>Restore Admitted Classes</span>
          </button>
        </div>
      </div>

      {/* QUICK ACCESS BANNER FOR TEXTBOOK STOCK DASHBOARD */}
      <div className="bg-gradient-to-r from-purple-950 via-[#180433] to-indigo-950 text-white p-3 sm:p-4 rounded-2xl shadow-lg border-2 border-purple-500/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 my-2 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-400 text-slate-950 rounded-xl border border-amber-300 shrink-0 shadow-md">
            <Library className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-black text-sm sm:text-base text-white tracking-wide">
                Textbook Stock Dashboard
              </h4>
              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-sm">
                Active Module
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                Stock & POS Ledger
              </span>
            </div>
            <p className="text-xs text-purple-200 mt-0.5">
              {bookStockSummary.totalTitles > 0 ? (
                <span>
                  <strong className="text-amber-300">{bookStockSummary.totalTitles}</strong> registered titles •{' '}
                  <strong className="text-emerald-300">{bookStockSummary.totalRemaining.toLocaleString()}</strong> copies in stock •{' '}
                  <strong className="text-blue-300">{bookStockSummary.totalSold.toLocaleString()}</strong> sold (GH₵ {bookStockSummary.totalSalesValue.toLocaleString()}) • Total Sales vs Remaining Stock charts.
                </span>
              ) : (
                <span>Manage Ghana syllabus textbooks, customised exercise books, daily cash/MoMo sales receipts, and stock visualizers.</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('book-inventory')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer flex-1 sm:flex-none uppercase tracking-wider ${
              activeTab === 'book-inventory'
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 hover:shadow-amber-900/30'
            }`}
            id="btn-quick-open-textbook-stock"
          >
            <Library className="w-4 h-4 text-slate-950" />
            <span>{activeTab === 'book-inventory' ? 'Viewing Textbook Stock' : 'Open Textbook Stock Dashboard →'}</span>
          </button>
        </div>
      </div>

      {/* 2. TAB TOGGLES & ADMIN MODULE DROPDOWN NAVIGATION */}
      <div className="pb-3 border-b border-mauve-500/10 no-print space-y-3">
        {/* Quick Drop-Down Navigation Menu across all tabs under Admin */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-gradient-to-r from-[#1f073d] via-[#2a0a52] to-[#1a0438] p-3 rounded-2xl border-2 border-amber-400/60 shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-400 text-slate-950 font-black shadow-sm shrink-0">
              <Sliders className="w-4 h-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                  Admin Modules Drop Down Menu
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 uppercase">
                  All 14 Tabs
                </span>
              </div>
              <span className="text-[11px] text-amber-200/90 font-medium block">
                Quickly jump to any administrative section or dashboard
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto sm:min-w-[340px] md:min-w-[420px]">
            <label htmlFor="admin-tabs-dropdown-selector" className="text-[11px] uppercase font-bold text-amber-300 whitespace-nowrap shrink-0 hidden md:inline">
              Select Tab:
            </label>
            <select
              id="admin-tabs-dropdown-selector"
              aria-label="Admin Tabs Drop Down Menu"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as AdminTab)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-amber-400 text-slate-950 font-black text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-md cursor-pointer"
            >
              <optgroup label="📊 Core Dashboards">
                <option value="analytics">📊 Overview Metrics</option>
                <option value="book-inventory">📚 Textbook Stock Dashboard (Featured)</option>
                <option value="fees-dashboard">📈 Fees Dashboard</option>
              </optgroup>
              <optgroup label="💰 Finance & School Assets">
                <option value="fees">💳 Fees Collection & Receipts</option>
                <option value="inventory">📦 School Inventory & Assets</option>
              </optgroup>
              <optgroup label="📱 SMS Broadcasts">
                <option value="bulk-sms">💬 Bulk Parent SMS Broadcast</option>
                <option value="report-sms-alerts">⚡ Report Card SMS Alerts</option>
              </optgroup>
              <optgroup label="🎓 Transcripts & Mock Exams">
                <option value="transcripts">📄 Student Transcripts & Reports</option>
                <option value="jhs3-mock">🏆 JHS 3 Mock Exam Portal</option>
                <option value="terminal-history">📜 JHS Assessment History</option>
              </optgroup>
              <optgroup label="👥 Admissions, Staff & Settings">
                <option value="students">🎓 Admissions & Student Roster</option>
                <option value="teachers">👨‍🏫 Staff Directory & Accounts</option>
                <option value="class-assignments">🏫 Assign Class Teachers</option>
                <option value="config">⚙️ System & Report Settings</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Tab Buttons Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2">
          {[
            { id: 'analytics', label: 'Overview Metrics', icon: Users },
            { id: 'book-inventory', label: 'Textbook Stock Dashboard', icon: Library, isFeatured: true },
            { id: 'fees-dashboard', label: 'Fees Dashboard', icon: BarChart3 },
            { id: 'fees', label: 'Fees Collection', icon: CreditCard },
            { id: 'inventory', label: 'School Inventory', icon: Boxes },
            { id: 'bulk-sms', label: 'Bulk Parent SMS', icon: MessageSquare },
            { id: 'report-sms-alerts', label: 'Report SMS Alerts', icon: Zap },
            { id: 'transcripts', label: 'Transcripts', icon: FileSpreadsheet },
            { id: 'jhs3-mock', label: 'JHS 3 Mock Portal', icon: Award },
            { id: 'terminal-history', label: 'JHS Assessment History', icon: History },
            { id: 'students', label: 'Admissions', icon: GraduationCap },
            { id: 'teachers', label: 'Staff Directory', icon: BookOpen },
            { id: 'class-assignments', label: 'Assign Class Teacher', icon: School },
            { id: 'config', label: 'Settings', icon: Settings }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isFeatured = (tab as any).isFeatured;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as AdminTab)}
                className={`flex items-center justify-start gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2.5 rounded-xl text-[11px] sm:text-xs uppercase tracking-wider transition-all duration-150 cursor-pointer border w-full text-left min-h-[44px] ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 shadow-md border-2 border-amber-500 ring-2 ring-amber-300 font-black'
                    : isFeatured
                    ? 'bg-gradient-to-r from-purple-950 via-[#21053d] to-indigo-950 text-amber-300 hover:text-slate-950 hover:bg-amber-300 border-2 border-purple-500/80 font-black ring-1 ring-purple-400/40 shadow-sm'
                    : 'bg-mauve-900 text-white/90 hover:bg-amber-300 hover:text-slate-950 border-mauve-700/80 font-bold'
                }`}
                id={`admin-tab-${tab.id}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950' : isFeatured ? 'text-amber-400' : 'text-amber-300/80'}`} />
                <span className="truncate">{tab.label}</span>
                {isFeatured && !isActive && (
                  <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[8px] font-black uppercase shrink-0 hidden sm:inline-block">
                    HOT
                  </span>
                )}
              </button>
            );
          })}
        </div>
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
                    <span className="text-[10px] uppercase font-black text-mauve-900/90 tracking-wider block">{card.label}</span>
                    <span className="text-xl font-display font-black text-mauve-950 mt-0.5 block">{card.val}</span>
                    <span className="text-[10px] text-mauve-800 font-medium mt-0.5 block">{card.desc}</span>
                  </div>
                  <div className={`p-2.5 rounded border ${card.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* TEXTBOOK STOCK DASHBOARD OVERVIEW & QUICK ACCESS BANNER */}
          <div className="bg-gradient-to-r from-purple-950 via-[#190436] to-slate-950 p-5 rounded-2xl border-2 border-purple-500/40 shadow-xl relative overflow-hidden">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0 shadow-lg shadow-amber-900/30">
                  <Library className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                      Textbook Stock & Book Sales Dashboard
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      Integrated POS Ledger & Recharts
                    </span>
                  </div>
                  <p className="text-xs text-purple-200 mt-0.5 max-w-2xl">
                    Full management for Ghana syllabus textbooks, customized exercise books, daily cash/MoMo receipts, and comparative Total Sales vs. Remaining Stock bar charts.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('book-inventory')}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer uppercase tracking-wider"
                  id="overview-btn-open-textbook-dashboard"
                >
                  <Library className="w-4 h-4 text-slate-950" />
                  <span>Open Textbook Stock Dashboard →</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-purple-800/40">
              <div className="bg-purple-900/40 border border-purple-500/30 p-3 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-purple-300 block">Registered Titles</span>
                <span className="text-lg font-black text-white mt-0.5 block">{bookStockSummary.totalTitles} Titles</span>
                <span className="text-[10px] text-purple-300/70">Textbooks & Exercise Books</span>
              </div>
              <div className="bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Copies in Stock</span>
                <span className="text-lg font-black text-emerald-200 mt-0.5 block">{bookStockSummary.totalRemaining.toLocaleString()} Copies</span>
                <span className="text-[10px] text-emerald-300/70">Ready for issuance</span>
              </div>
              <div className="bg-blue-950/40 border border-blue-500/30 p-3 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-blue-300 block">Total Sold</span>
                <span className="text-lg font-black text-blue-200 mt-0.5 block">{bookStockSummary.totalSold.toLocaleString()} Copies</span>
                <span className="text-[10px] text-blue-300/70">Recorded sales</span>
              </div>
              <div className="bg-amber-950/40 border border-amber-500/30 p-3 rounded-xl">
                <span className="text-[10px] uppercase font-bold text-amber-300 block">Total Sales Value</span>
                <span className="text-lg font-black text-amber-200 mt-0.5 block">GH₵ {bookStockSummary.totalSalesValue.toLocaleString()}</span>
                <span className="text-[10px] text-amber-300/70">{bookStockSummary.lowStockCount > 0 ? `⚠️ ${bookStockSummary.lowStockCount} low stock items` : '✓ Stock levels healthy'}</span>
              </div>
            </div>
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-mauve-900">Classes Managed:</span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {lvl.classes.map((cls, idx) => (
                      <span key={`${cls}-${idx}`} className="text-[10px] px-1.5 py-0.5 bg-mauve-100/60 border border-mauve-200 text-mauve-900 font-semibold rounded">
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

      {/* FEES SUMMARY & ANALYTICS DASHBOARD VIEW */}
      {activeTab === 'fees-dashboard' && (
        <FeesDashboard
          students={students}
          classes={classes}
          config={config}
          bills={bills}
          onRecordNewPayment={() => setActiveTab('fees')}
        />
      )}

      {/* FEES COLLECTION & RECEIPTS VIEW */}
      {activeTab === 'fees' && (
        <FeesCollectionModule
          students={students}
          classes={classes}
          config={config}
          bills={bills}
          onViewDashboard={() => setActiveTab('fees-dashboard')}
        />
      )}

      {/* BULK SMS BROADCAST CENTER VIEW */}
      {activeTab === 'bulk-sms' && (
        <BulkSMSModule
          students={students}
          bills={bills}
          feePayments={[]}
          config={config}
          classes={classes}
        />
      )}

      {/* REPORT CARD SMS ALERT SERVICE MODULE */}
      {activeTab === 'report-sms-alerts' && (
        <ReportCardSMSAlertModule
          students={students}
          bills={bills}
          grades={grades}
          config={config}
          classes={classes}
        />
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
            <div className="space-y-1 relative" ref={classDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-mauve-900 block">1. Select Grade Class</label>
                <span className="text-[10px] font-mono font-bold text-mauve-600">
                  {studentsInSelectedClass.length} {studentsInSelectedClass.length === 1 ? 'Pupil' : 'Pupils'}
                </span>
              </div>
              
              {/* Custom Clickable Trigger Button */}
              <button
                type="button"
                id="transcript-class-selector-btn"
                onClick={() => {
                  setIsClassDropdownOpen(!isClassDropdownOpen);
                  setIsStudentDropdownOpen(false);
                }}
                className="w-full text-xs p-2.5 rounded-lg border border-mauve-500/25 focus:outline-none focus:ring-2 focus:ring-mauve-900 bg-white hover:bg-mauve-50/50 text-mauve-950 font-bold flex items-center justify-between transition cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2 truncate">
                  <School className="w-3.5 h-3.5 text-mauve-700 shrink-0" />
                  <span className="truncate">{selectedClass}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-mauve-600">
                  <span className="text-[10px] bg-mauve-100 px-1.5 py-0.5 rounded font-mono font-bold text-mauve-900">
                    {studentsInSelectedClass.length}
                  </span>
                  {isClassDropdownOpen ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </div>
              </button>

              {/* Class In-DOM Dropdown Menu */}
              {isClassDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-[70] bg-white rounded-xl shadow-2xl border-2 border-mauve-400 overflow-hidden animate-fadeIn text-xs">
                  <div className="p-2 border-b border-mauve-100 bg-mauve-50/60">
                    <div className="relative">
                      <Search className="w-3 h-3 text-mauve-400 absolute left-2 top-2" />
                      <input
                        type="text"
                        placeholder="Search class..."
                        value={classDropdownSearch}
                        onChange={(e) => setClassDropdownSearch(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-xs rounded border border-mauve-200 bg-white text-mauve-900 focus:outline-none focus:ring-1 focus:ring-mauve-900"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-mauve-100">
                    {filteredClassesForDropdown.map((cls) => {
                      const count = students.filter(s => s.className === cls).length;
                      const isSelected = cls === selectedClass;
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => handleClassChangeInTranscriptSelector(cls)}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between transition cursor-pointer hover:bg-mauve-100/70 ${
                            isSelected ? 'bg-mauve-900 text-white hover:bg-mauve-900' : 'text-mauve-950'
                          }`}
                        >
                          <span className="font-bold">{cls}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            isSelected ? 'bg-mauve-800 text-white' : 'bg-mauve-100 text-mauve-800'
                          }`}>
                            {count} {count === 1 ? 'pupil' : 'pupils'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hidden native select for accessibility / automation */}
              <select
                aria-label="Select Grade Class"
                value={selectedClass}
                onChange={(e) => handleClassChangeInTranscriptSelector(e.target.value)}
                className="sr-only"
              >
                {allClassNames.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* Select Student */}
            <div className="space-y-1 relative" ref={studentDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold text-mauve-900 block">2. Choose Student</label>
                {studentsInSelectedClass.length > 0 && (
                  <span className="text-[10px] font-mono text-mauve-600 font-bold">
                    {currentStudentIndex >= 0 ? `${currentStudentIndex + 1} of ${studentsInSelectedClass.length}` : `${studentsInSelectedClass.length} Total`}
                  </span>
                )}
              </div>

              {/* Student Trigger with Quick Prev / Next buttons */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="transcript-prev-student-btn"
                  onClick={handlePrevStudent}
                  disabled={studentsInSelectedClass.length <= 1}
                  title="Previous Pupil"
                  className="p-2.5 rounded-lg border border-mauve-500/25 bg-white hover:bg-mauve-100 text-mauve-900 disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0 cursor-pointer shadow-2xs"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  id="transcript-student-selector-btn"
                  onClick={() => {
                    setIsStudentDropdownOpen(!isStudentDropdownOpen);
                    setIsClassDropdownOpen(false);
                    setStudentDropdownSearch('');
                  }}
                  className="flex-1 text-xs p-2 rounded-lg border border-mauve-500/25 focus:outline-none focus:ring-2 focus:ring-mauve-900 bg-white hover:bg-mauve-50/50 text-mauve-950 font-bold flex items-center justify-between transition cursor-pointer shadow-2xs min-w-0"
                >
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <UserCheck className="w-3.5 h-3.5 text-mauve-700 shrink-0" />
                    <div className="truncate text-left">
                      {selectedStudent ? (
                        <>
                          <div className="truncate text-xs font-black text-mauve-950">{selectedStudent.name}</div>
                          <div className="text-[10px] text-mauve-600 font-mono">{selectedStudent.rollNumber}</div>
                        </>
                      ) : (
                        <span className="text-gray-500 font-medium">-- Choose Pupil --</span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-mauve-600 ml-1.5">
                    {isStudentDropdownOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  id="transcript-next-student-btn"
                  onClick={handleNextStudent}
                  disabled={studentsInSelectedClass.length <= 1}
                  title="Next Pupil"
                  className="p-2.5 rounded-lg border border-mauve-500/25 bg-white hover:bg-mauve-100 text-mauve-900 disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0 cursor-pointer shadow-2xs"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Student In-DOM Dropdown Menu */}
              {isStudentDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 z-[70] bg-white rounded-xl shadow-2xl border-2 border-mauve-400 overflow-hidden animate-fadeIn text-xs">
                  <div className="p-2 border-b border-mauve-100 bg-mauve-50/60">
                    <div className="relative">
                      <Search className="w-3 h-3 text-mauve-400 absolute left-2 top-2" />
                      <input
                        type="text"
                        placeholder="Search name or ID..."
                        value={studentDropdownSearch}
                        onChange={(e) => setStudentDropdownSearch(e.target.value)}
                        className="w-full pl-6 pr-2 py-1 text-xs rounded border border-mauve-200 bg-white text-mauve-900 focus:outline-none focus:ring-1 focus:ring-mauve-900"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-mauve-100">
                    {filteredStudentsForDropdown.length > 0 ? (
                      filteredStudentsForDropdown.map((s) => {
                        const isSelected = s.id === selectedStudentId;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedStudentId(s.id);
                              setIsStudentDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 flex items-center justify-between transition cursor-pointer hover:bg-mauve-100/70 ${
                              isSelected ? 'bg-mauve-900 text-white hover:bg-mauve-900' : 'text-mauve-950'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <div className="font-bold truncate">{s.name}</div>
                              <div className={`text-[10px] font-mono ${isSelected ? 'text-mauve-200' : 'text-mauve-600'}`}>
                                {s.rollNumber}
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-white shrink-0" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="p-3 text-center text-gray-500 italic">
                        {studentsInSelectedClass.length === 0
                          ? `No pupils enrolled in ${selectedClass}`
                          : 'No pupils matched your search'}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Hidden native select for accessibility / automation */}
              <select
                aria-label="Choose Student"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="sr-only"
              >
                <option value="">-- Choose Pupil --</option>
                {studentsInSelectedClass.map((s, idx) => (
                  <option key={`${s.id}-${idx}`} value={s.id}>{s.name} ({s.rollNumber})</option>
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

            {/* Hardcopy Bulk Print Button */}
            <div className="pt-2 border-t border-mauve-500/10 space-y-1">
              <label className="text-[10px] uppercase font-bold text-mauve-900 block">4. Hardcopy Bulk Print</label>
              <button
                onClick={() => handleOpenBulkPrintModal(selectedClass)}
                className="w-full bg-mauve-900 hover:bg-mauve-800 active:scale-[0.98] text-white font-bold py-2 px-3 rounded text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm uppercase tracking-wider"
              >
                <Printer className="w-3.5 h-3.5 shrink-0" />
                <span>Bulk Print Class ({studentsInSelectedClass.length})</span>
              </button>
            </div>

            {/* Arkesel Report Card SMS Alert Service Button */}
            <div className="pt-2 border-t border-mauve-500/10 space-y-1">
              <label className="text-[10px] uppercase font-bold text-mauve-900 block">5. Arkesel SMS Alert Service</label>
              <button
                onClick={() => setActiveTab('report-sms-alerts')}
                className="w-full bg-mauve-950 hover:bg-mauve-900 active:scale-[0.98] text-white font-bold py-2 px-3 rounded text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm uppercase tracking-wider border border-mauve-800"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Bulk Report Card SMS Alerts</span>
              </button>
            </div>

            <div className="pt-2 border-t border-mauve-500/10 text-[11px] text-mauve-800 font-medium space-y-1 bg-mauve-100/50 p-2.5 rounded border border-mauve-500/10 leading-relaxed">
              <span className="font-bold text-mauve-900 uppercase block text-[10px]">System Assistant</span>
              <p>Selecting a student dynamically loads their term marks, calculated class rank, and attendance review sheets into the A4 viewer.</p>
            </div>
          </div>

          {/* Transcript Viewer Main */}
          <div className="lg:col-span-3">
            {selectedStudent ? (
              <ReportPDF
                student={selectedStudent}
                bills={bills}
                onUpdateBill={onUpdateBill}
                setConfig={setConfig}
                grades={
                  grades.filter((g) => g.studentId === selectedStudent.id && (!g.term || g.term === config.term) && (!g.year || g.year === config.schoolYear))
                }
                attendance={
                  attendance.find((a) => a.studentId === selectedStudent.id && (!a.term || a.term === config.term) && (!a.year || a.year === config.schoolYear))
                }
                subjects={subjects}
                config={config}
                allClassStudents={students.filter((s) => s.className === selectedStudent.className)}
                allGrades={grades}
                onUpdateGrade={(subjectId, classScore, examScore, nurseryRemark) => {
                  const studentId = selectedStudent.id;
                  const targetSubObj = subjects.find(s => s.id === subjectId || s.name === subjectId || s.code === subjectId) ||
                                       INITIAL_SUBJECTS.find(s => matchesSubject(subjectId, s));
                  const canonicalSubjectId = targetSubObj ? targetSubObj.id : subjectId;

                  const totalScore = Math.min(100, Math.max(0, classScore + examScore));
                  const rule = config.gradingScale?.find((r) => totalScore >= r.minScore && totalScore <= r.maxScore);
                  const gradeLetter = rule ? rule.grade : (totalScore >= 80 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 60 ? 'C' : totalScore >= 50 ? 'D' : totalScore >= 40 ? 'E' : 'F');
                  const calcRemarks = rule ? rule.remarks : (totalScore >= 80 ? 'Excellent' : totalScore >= 70 ? 'Very Good' : totalScore >= 60 ? 'Good' : totalScore >= 50 ? 'Credit' : totalScore >= 40 ? 'Pass' : 'Fail');
                  const isStudentNursery = selectedStudent.level === 'NURSERY' || (selectedStudent.className || '').toLowerCase().includes('nursery');
                  const finalRemarks = isStudentNursery ? (nurseryRemark || calcRemarks) : calcRemarks;
                  const finalNurseryRemark = isStudentNursery ? nurseryRemark : undefined;

                  const updatedGrades = [...grades];
                  const existingIndex = updatedGrades.findIndex(
                    (g) => g.studentId === studentId &&
                           (g.subjectId === canonicalSubjectId || (targetSubObj && matchesSubject(g.subjectId, targetSubObj))) &&
                           (!g.term || g.term === config.term) &&
                           (!g.year || g.year === config.schoolYear)
                  );

                  const gradeRecord: Grade = {
                    studentId,
                    subjectId: canonicalSubjectId,
                    classScore,
                    examScore,
                    totalScore,
                    gradeLetter,
                    remarks: finalRemarks,
                    nurseryRemark: finalNurseryRemark,
                    term: config.term || 'Term 1',
                    year: config.schoolYear || '2025/2026',
                    teacherId: 'admin',
                    updatedAt: new Date().toISOString()
                  };

                  if (existingIndex !== -1) {
                    updatedGrades[existingIndex] = {
                      ...updatedGrades[existingIndex],
                      ...gradeRecord
                    };
                  } else {
                    updatedGrades.push(gradeRecord);
                  }

                  if (setGrades) {
                    setGrades(updatedGrades);
                  }

                  localStorage.setItem('ea_grades', JSON.stringify(updatedGrades));
                  localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(updatedGrades));

                  if (getSupabaseCredentials().isConfigured) {
                    saveSupabaseGrades(updatedGrades).catch((err) => console.warn('Supabase save grade error', err));
                  }
                }}
                onUpdateAttendance={(daysPresent, totalDays, remarks) => {
                  const studentId = selectedStudent.id;
                  setAttendance((prev) => {
                    const existingIndex = prev.findIndex((a) => a.studentId === studentId && (!a.term || a.term === config.term) && (!a.year || a.year === config.schoolYear));
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

                    let updated: Attendance[];
                    if (existingIndex !== -1) {
                      updated = [...prev];
                      updated[existingIndex] = {
                        ...updated[existingIndex],
                        totalDays,
                        daysPresent,
                        remarks: remarks ?? updated[existingIndex].remarks,
                        updatedAt: new Date().toISOString()
                      };
                    } else {
                      updated = [...prev, newRecord];
                    }

                    localStorage.setItem('ea_attendance', JSON.stringify(updated));
                    localStorage.setItem('mock_supabase_ea_attendance', JSON.stringify(updated));

                    if (getSupabaseCredentials().isConfigured) {
                      saveSupabaseAttendance(updated).catch((err) => console.warn('Supabase save attendance error', err));
                    }

                    return updated;
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

      {/* JHS 3 BECE MOCK EXAM PORTAL VIEW */}
      {activeTab === 'jhs3-mock' && (
        <div className="animate-fadeIn">
          <JHS3MockExamModule
            students={students}
            subjects={subjects}
            currentUser={{ name: 'School Administrator', id: 'admin-01', email: 'admin@eastfield.com', role: 'ADMIN' }}
            isAdminAuthenticated={true}
            config={config}
          />
        </div>
      )}

      {/* JHS TERMINAL ASSESSMENT HISTORY DASHBOARD VIEW */}
      {activeTab === 'terminal-history' && (
        <div className="animate-fadeIn">
          <JHSTerminalAssessmentHistoryModule
            students={students}
            subjects={subjects}
            grades={grades}
            config={config}
            currentUser={{ name: 'School Administrator', id: 'admin-01', email: 'admin@eastfield.com', role: 'ADMIN' }}
          />
        </div>
      )}

      {/* C. STUDENTS ADMISSIONS VIEW */}
      {activeTab === 'students' && (
        <div className="space-y-4 animate-fadeIn no-print">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="font-display font-bold text-mauve-900 text-base uppercase tracking-wide">Student Admissions Registry</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAssignClassesFromIds}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-2 rounded transition flex items-center gap-1.5 cursor-pointer shadow-sm text-xs uppercase tracking-wider"
                title="Scan and assign all students to their correct class based on their Student ID (e.g. EA/J1/2026/005 -> JHS 1)"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Assign by Student ID
              </button>
              <button
                onClick={handleRestoreFromTerminalReport}
                className="bg-teal-700 hover:bg-teal-800 text-white font-bold px-3 py-2 rounded transition flex items-center gap-1.5 cursor-pointer shadow-sm text-xs uppercase tracking-wider"
                title="Restore and verify registered pupils from previous term (Term 3) terminal reports"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restore from Terminal Report
              </button>
              <button
                onClick={handleRestoreAdmittedClasses}
                className="bg-indigo-600/90 hover:bg-indigo-600 text-white font-bold px-3 py-2 rounded transition flex items-center gap-1.5 cursor-pointer shadow-sm text-xs uppercase tracking-wider"
                title="Restore all pupils back to their original admitted class levels"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restore Admitted Classes
              </button>
              <button
                onClick={() => handleOpenBulkPrintModal(studentClassFilter !== 'ALL' ? studentClassFilter : 'ALL')}
                className="bg-mauve-900 hover:bg-mauve-800 text-white font-bold px-3.5 py-2 rounded transition flex items-center gap-1.5 cursor-pointer shadow-sm text-xs uppercase tracking-wider"
                title="Bulk print academic report cards for selected class"
              >
                <Printer className="w-3.5 h-3.5" /> Bulk Print Reports
              </button>
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
                className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-4 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md text-xs uppercase tracking-wider border border-blue-500"
              >
                <Plus className="w-4 h-4 text-white" /> Add New Pupil
              </button>
            </div>
          </div>

          {/* Search filters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded border border-mauve-500/20 shadow-sm">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-mauve-700 absolute left-2.5 top-2.5" />
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
                className="w-full text-xs px-3 py-2 rounded-xl border-2 border-mauve-300 focus:outline-none focus:ring-2 focus:ring-mauve-900 text-mauve-950 font-bold bg-white shadow-xs cursor-pointer min-h-[38px]"
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
                className="w-full text-xs px-3 py-2 rounded-xl border-2 border-mauve-300 focus:outline-none focus:ring-2 focus:ring-mauve-900 text-mauve-950 font-bold bg-white shadow-xs cursor-pointer min-h-[38px]"
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
                className="w-full text-xs px-3 py-2 rounded-xl border-2 border-mauve-300 focus:outline-none focus:ring-2 focus:ring-mauve-900 text-mauve-950 font-bold bg-white shadow-xs cursor-pointer min-h-[38px]"
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
              <table className="w-full text-left border-collapse min-w-[650px]">
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
                      <td colSpan={6} className="p-6 text-center text-mauve-800 font-bold">No student matching selected filters.</td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => (
                      <tr key={`${s.id}-${idx}`} className="hover:bg-mauve-50/10">
                        <td className="p-3 pl-4">
                          <button
                            type="button"
                            onClick={() => {
                              setViewingStudentProfile(s);
                              setProfileTab('academic');
                            }}
                            className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
                            title="Click to view full student profile & photograph"
                          >
                            <div className="w-9 h-11 rounded-lg overflow-hidden border border-mauve-200 bg-mauve-100/60 flex items-center justify-center shrink-0 shadow-xs group-hover:border-mauve-500 group-hover:shadow-sm transition">
                              {s.photoUrl ? (
                                <img src={s.photoUrl} alt={s.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="text-mauve-600 font-extrabold text-xs">
                                  {s.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-gray-900 text-xs group-hover:text-mauve-800 group-hover:underline transition block">
                                {s.name}
                              </span>
                              <span className="text-[10px] text-mauve-600 font-medium flex items-center gap-0.5">
                                <ExternalLink className="w-2.5 h-2.5 inline" /> Full Profile
                              </span>
                            </div>
                          </button>
                        </td>
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
                            <span className="block text-mauve-900 font-semibold font-mono">{s.guardianEmail || 'No Email'}</span>
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
                              type="button"
                              onClick={() => {
                                setViewingStudentProfile(s);
                                setProfileTab('academic');
                              }}
                              className="px-2 py-1 bg-mauve-100 hover:bg-mauve-200 text-mauve-900 font-bold rounded text-[10px] flex items-center gap-1 transition cursor-pointer"
                              title="Open Full Student Profile & Photograph"
                            >
                              <UserIcon className="w-3 h-3 shrink-0" />
                              <span>Profile</span>
                            </button>
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
              <div className="bg-white rounded-2xl border border-mauve-250 w-full max-w-md p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                <div className="bg-blue-600 text-white p-4 rounded-xl flex justify-between items-center shadow-sm -mt-1 -mx-1 mb-2">
                  <h4 className="font-display font-extrabold text-white text-base tracking-wide uppercase">
                    {editingStudent ? 'Modify Student Details' : 'Admit New Pupil'}
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowStudentModal(false)}
                    className="text-blue-100 hover:text-white font-bold cursor-pointer text-xl w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-700/50 transition"
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleAddOrEditStudent} className="space-y-4 text-sm">
                  {/* Passport Size Photograph Upload */}
                  <div className="p-3 bg-mauve-50/70 border border-mauve-200 rounded-xl space-y-2">
                    <label className="text-xs font-semibold text-mauve-800 block flex justify-between items-center">
                      <span>Passport Size Photograph</span>
                      <span className="text-[10px] text-mauve-500 font-normal">Optional &bull; Max 2MB</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-20 rounded-lg border-2 border-dashed border-mauve-300 bg-white flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-inner">
                        {isUploadingStudentPhoto ? (
                          <div className="flex flex-col items-center gap-1 p-2 text-center">
                            <Sparkles className="w-5 h-5 text-amber-500 animate-spin" />
                            <span className="text-[8px] font-bold text-mauve-800 uppercase">Syncing...</span>
                          </div>
                        ) : studentForm.photoUrl ? (
                          <>
                            <img
                              src={studentForm.photoUrl}
                              alt="Passport Preview"
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => setStudentForm({ ...studentForm, photoUrl: '' })}
                              className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition"
                              title="Remove photo"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <Camera className="w-6 h-6 text-mauve-400" />
                        )}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <label className={`inline-flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-mauve-100/50 border border-mauve-200 text-mauve-700 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm ${isUploadingStudentPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingStudentPhoto ? 'Syncing Photo...' : studentForm.photoUrl ? 'Change Photo' : 'Upload Photograph'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingStudentPhoto}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 2 * 1024 * 1024) {
                                  alert('Image size exceeds 2MB limit.');
                                  return;
                                }
                                setIsUploadingStudentPhoto(true);
                                try {
                                  const tempId = editingStudent?.id || studentForm.rollNumber || studentForm.name || `st-${Date.now()}`;
                                  const uploadedUrl = await uploadStudentPhotoToSupabase(file, tempId);
                                  setStudentForm((prev) => ({ ...prev, photoUrl: uploadedUrl }));
                                } catch (err) {
                                  console.warn('Fallback to reader base64:', err);
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setStudentForm((prev) => ({ ...prev, photoUrl: reader.result as string }));
                                  };
                                  reader.readAsDataURL(file);
                                } finally {
                                  setIsUploadingStudentPhoto(false);
                                }
                              }
                            }}
                          />
                        </label>
                        {studentForm.photoUrl && studentForm.photoUrl.startsWith('http') && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Synced to Supabase Bucket 'ea'</span>
                          </div>
                        )}
                        <p className="text-[11px] text-mauve-600 leading-tight">
                          Standard passport portrait (JPG/PNG). Synchronizes directly into Supabase Storage Bucket 'ea' for global cross-device access.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Name */}
                  <div className="space-y-1.5 p-3 rounded-xl bg-amber-100/80 border-2 border-amber-300 shadow-2xs">
                    <label className="text-xs font-black text-slate-950 block uppercase tracking-wider">Student Fullname</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kwadwo Mensah"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      className="w-full p-2.5 rounded-xl border-2 border-amber-400 focus:ring-2 focus:ring-amber-500 outline-none text-slate-950 font-bold bg-amber-50 placeholder:text-amber-700/60"
                    />
                  </div>

                  {/* Roll Number */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-mauve-700 block flex justify-between items-center">
                      <span>Roll / Register ID</span>
                      {!editingStudent && (
                        <span className="text-[10px] text-emerald-600 font-medium">Auto-generated &bull; Class-aware</span>
                      )}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EA/J1/2026/005 or EA/P4/2026/001"
                      value={studentForm.rollNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val.includes('/') || val.includes('-') || val.length >= 4) {
                          const resolved = resolveClassAndLevelFromStudentId(val, studentForm.level);
                          setStudentForm(prev => ({
                            ...prev,
                            rollNumber: val,
                            level: resolved.level,
                            className: resolved.className
                          }));
                        } else {
                          setStudentForm(prev => ({ ...prev, rollNumber: val }));
                        }
                      }}
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white font-mono"
                    />
                    <p className="text-[10px] text-mauve-500">
                      Standard format: <code className="font-semibold text-mauve-800">EA/[Class]/[Year]/[Seq]</code> (e.g. EA/J1/2026/005 &rarr; JHS 1, promoted to JHS 2).
                    </p>
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
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl transition cursor-pointer text-center shadow-md shadow-blue-600/20"
                    >
                      {editingStudent ? 'Save Profile' : 'Confirm Admission'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* FULL STUDENT PROFILE MODAL WITH PASSPORT PHOTO */}
          {viewingStudentProfile && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-blue-200 flex flex-col max-h-[90vh]">
                {/* Header with Background Accent */}
                <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 p-6 text-white relative">
                  <button
                    type="button"
                    onClick={() => setViewingStudentProfile(null)}
                    className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition cursor-pointer"
                    title="Close profile"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                    {/* Passport Size Photograph Display */}
                    <div className="relative w-28 h-36 rounded-xl overflow-hidden border-2 border-white/80 bg-blue-950/50 shadow-xl shrink-0 flex items-center justify-center">
                      {viewingStudentProfile.photoUrl ? (
                        <img
                          src={viewingStudentProfile.photoUrl}
                          alt={viewingStudentProfile.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center p-2">
                          <UserIcon className="w-12 h-12 text-blue-300 mx-auto mb-1 opacity-80" />
                          <span className="text-[10px] text-blue-200 font-semibold uppercase tracking-wider">No Photo</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          triggerEditStudent(viewingStudentProfile);
                          setViewingStudentProfile(null);
                        }}
                        className="absolute bottom-1 right-1 bg-blue-900/90 hover:bg-blue-950 text-white p-1.5 rounded-lg text-[10px] flex items-center gap-1 shadow transition cursor-pointer"
                        title="Upload or Change Photograph"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Basic Info */}
                    <div className="flex-1 text-center sm:text-left space-y-2">
                      <div className="inline-block px-3 py-1 rounded-full bg-blue-600 text-white border border-blue-400/50 text-[11px] font-black uppercase tracking-wider shadow-xs">
                        {viewingStudentProfile.level} &bull; {viewingStudentProfile.className}
                      </div>
                      <h3 className="font-display font-extrabold text-2xl text-white leading-tight">
                        {viewingStudentProfile.name}
                      </h3>
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 text-xs text-blue-100 font-mono">
                        <span className="bg-blue-900/90 text-blue-100 px-2.5 py-1 rounded-lg border border-blue-400/40 font-bold shadow-xs">
                          Roll: {viewingStudentProfile.rollNumber}
                        </span>
                        <span className="bg-blue-900/90 text-blue-100 px-2.5 py-1 rounded-lg border border-blue-400/40 font-bold shadow-xs">
                          ID: #{viewingStudentProfile.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Information */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4 text-sm bg-white">
                  <div className="space-y-4">
                    <h4 className="font-bold text-blue-950 text-xs uppercase tracking-wide flex items-center gap-1.5 border-b border-blue-100 pb-2">
                      <UserIcon className="w-4 h-4 text-blue-600" />
                      <span>Guardian &amp; Contact Details</span>
                    </h4>
                    <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm shrink-0">
                          {viewingStudentProfile.guardianName ? viewingStudentProfile.guardianName.charAt(0).toUpperCase() : 'G'}
                        </div>
                        <div>
                          <h5 className="font-bold text-blue-950 text-sm">
                            {viewingStudentProfile.guardianName || 'No Guardian Name Recorded'}
                          </h5>
                          <span className="text-xs text-blue-700 font-medium">Primary Parent / Legal Guardian</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-blue-200 text-xs">
                        <div className="space-y-0.5">
                          <span className="text-blue-900 font-bold block">Email Address:</span>
                          {viewingStudentProfile.guardianEmail ? (
                            <a
                              href={`mailto:${viewingStudentProfile.guardianEmail}`}
                              className="text-blue-700 font-semibold hover:underline flex items-center gap-1"
                            >
                              <Mail className="w-3 h-3" />
                              <span>{viewingStudentProfile.guardianEmail}</span>
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Not provided</span>
                          )}
                        </div>

                        <div className="space-y-0.5">
                          <span className="text-blue-900 font-bold block">WhatsApp / Phone:</span>
                          {viewingStudentProfile.guardianPhone ? (
                            <a
                              href={`tel:${viewingStudentProfile.guardianPhone}`}
                              className="text-blue-800 font-bold hover:underline flex items-center gap-1"
                            >
                              <Phone className="w-3 h-3" />
                              <span>{viewingStudentProfile.guardianPhone}</span>
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">Not provided</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="p-4 bg-blue-50/50 border-t border-blue-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerEditStudent(viewingStudentProfile);
                        setViewingStudentProfile(null);
                      }}
                      className="px-3.5 py-2 bg-white hover:bg-blue-100/70 border border-blue-300 text-blue-900 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit Student Profile / Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClass(viewingStudentProfile.className);
                        setSelectedStudentId(viewingStudentProfile.id);
                        setViewingStudentProfile(null);
                        setActiveTab('transcripts');
                      }}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Open A4 Term Transcript</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setViewingStudentProfile(null)}
                    className="px-4 py-2 bg-blue-950 hover:bg-blue-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
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
            <button
              onClick={() => {
                setEditingTeacher(null);
                setTeacherForm({
                  name: '',
                  email: '',
                  password: 'teacher123',
                  level: 'PRIMARY',
                  classes: [],
                  subjects: [],
                  dateOfBirth: '',
                  phoneNumber: '',
                  qualification: '',
                  profilePicture: '',
                  hometown: '',
                  ghanaCardNumber: ''
                });
                setTeacherError('');
                setShowTeacherModal(true);
              }}
              className="bg-mauve-800 hover:bg-mauve-900 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register New Teacher</span>
            </button>
          </div>

          <div className="bg-white p-3 rounded border border-mauve-500/20 text-xs text-mauve-900 leading-relaxed flex items-start gap-2 bg-mauve-50/15 shadow-sm">
            <AlertCircle className="w-4 h-4 text-mauve-900 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-mauve-900 block uppercase tracking-wider text-[10px] mb-0.5">Academy Staff Policy:</span>
              <span>Primary teachers handle multiple core subjects to provide immersive grade mentoring. Junior High School (JHS) teachers are specialized academic tutors and, under Academy bylaws, are strictly restricted to handling a maximum of <strong>two distinct subjects</strong>.</span>
            </div>
          </div>

          {/* Table Directory */}
          <div className="bg-white rounded border border-mauve-500/20 overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse min-w-[650px]">
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
                      <div className="flex items-center gap-2.5">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-mauve-100 border-2 border-mauve-300 shrink-0 flex items-center justify-center font-bold text-sm text-mauve-900 shadow-sm">
                          {t.profilePicture ? (
                            <img src={t.profilePicture} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <span>{t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <span className="block font-bold text-gray-900 text-xs">{t.name}</span>
                          <span className="block text-mauve-800 font-semibold font-mono text-[10px]">{t.email}</span>
                          {t.qualification && (
                            <span className="text-[9px] text-amber-800 font-bold block">{t.qualification}</span>
                          )}
                        </div>
                      </div>
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
                          <span key={`${c}-${idx}`} className="bg-mauve-100/60 border border-mauve-200 px-1.5 py-0.5 rounded text-[10px] text-mauve-900 font-bold">
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
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-mauve-100/60 text-mauve-900 border border-mauve-200">
                          Primary Multi-subject
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5 pl-2">
                        <button
                          onClick={() => setViewingTeacherProfileModal(t)}
                          className="px-2 py-1 bg-mauve-50 hover:bg-mauve-100 text-mauve-900 border border-mauve-250 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                          title="View Full Profile"
                        >
                          <Eye className="w-3.5 h-3.5 text-mauve-700" />
                          <span className="hidden sm:inline">View Profile</span>
                        </button>
                        <button
                          onClick={() => setSelectedWorkstationTeacher(t)}
                          className="px-2 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-lg text-[11px] font-extrabold transition flex items-center gap-1 cursor-pointer shadow-xs border border-amber-300"
                          title="Open Workstation for Gradebook & Assessments"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-slate-950" />
                          <span className="hidden sm:inline">Workstation</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingTeacher(t);
                            setTeacherForm({
                              name: t.name,
                              email: t.email,
                              password: t.password || 'teacher123',
                              level: t.level || 'PRIMARY',
                              classes: t.classes || [],
                              subjects: t.subjects || [],
                              dateOfBirth: t.dateOfBirth || '',
                              phoneNumber: t.phoneNumber || '',
                              qualification: t.qualification || '',
                              profilePicture: t.profilePicture || '',
                              hometown: t.hometown || '',
                              ghanaCardNumber: t.ghanaCardNumber || ''
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
              <div className="bg-white rounded-2xl border border-mauve-250 w-full max-w-lg p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-mauve-100 pb-3">
                  <h4 className="font-display font-bold text-mauve-900 text-lg">
                    {editingTeacher ? 'Modify Staff Profile' : 'Register Academy Staff'}
                  </h4>
                  <button
                    onClick={() => setShowTeacherModal(false)}
                    className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer text-xl"
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
                  {/* Photo upload section */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-mauve-700 block">Teacher Profile Photograph</label>
                    <div className="flex items-center gap-3 bg-mauve-50/50 p-3 rounded-xl border border-mauve-200">
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-mauve-200 border-2 border-mauve-400 shrink-0 flex items-center justify-center shadow-md">
                        {isUploadingTeacherPhoto ? (
                          <Sparkles className="w-6 h-6 text-mauve-700 animate-spin" />
                        ) : teacherForm.profilePicture ? (
                          <>
                            <img src={teacherForm.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setTeacherForm({ ...teacherForm, profilePicture: '' })}
                              className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition"
                              title="Remove photo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <Camera className="w-6 h-6 text-mauve-400" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="px-3 py-1.5 bg-white hover:bg-mauve-50 border border-mauve-300 text-mauve-900 rounded-lg text-xs font-bold cursor-pointer transition shadow-xs inline-flex items-center gap-1.5">
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploadingTeacherPhoto ? 'Uploading...' : teacherForm.profilePicture ? 'Change Photo' : 'Upload Photograph'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingTeacherPhoto}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                if (file.size > 2 * 1024 * 1024) {
                                  alert('Image size exceeds 2MB limit.');
                                  return;
                                }
                                setIsUploadingTeacherPhoto(true);
                                try {
                                  const tempId = editingTeacher?.id || teacherForm.email || `t-${Date.now()}`;
                                  const uploadedUrl = await uploadTeacherPhotoToSupabase(file, tempId);
                                  setTeacherForm(prev => ({ ...prev, profilePicture: uploadedUrl }));
                                } catch (err) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setTeacherForm(prev => ({ ...prev, profilePicture: reader.result as string }));
                                  };
                                  reader.readAsDataURL(file);
                                } finally {
                                  setIsUploadingTeacherPhoto(false);
                                }
                              }
                            }}
                          />
                        </label>
                        <p className="text-[10px] text-mauve-500 font-medium">PNG or JPEG, passport format (max 2MB).</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Teacher Fullname</label>
                      <input
                        type="text"
                        required
                        placeholder="Mrs. Mary Mensah"
                        value={teacherForm.name}
                        onChange={(e) => setTeacherForm({ ...teacherForm, name: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
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
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Teacher Access Password</label>
                      <input
                        type="text"
                        placeholder="e.g. teacher123"
                        value={teacherForm.password}
                        onChange={(e) => setTeacherForm({ ...teacherForm, password: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Date of Birth</label>
                      <input
                        type="date"
                        value={teacherForm.dateOfBirth}
                        onChange={(e) => setTeacherForm({ ...teacherForm, dateOfBirth: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Phone Number</label>
                      <input
                        type="tel"
                        placeholder="e.g. +233 24 123 4567"
                        value={teacherForm.phoneNumber}
                        onChange={(e) => setTeacherForm({ ...teacherForm, phoneNumber: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Hometown</label>
                      <input
                        type="text"
                        placeholder="e.g. Cape Coast / Kumasi"
                        value={teacherForm.hometown}
                        onChange={(e) => setTeacherForm({ ...teacherForm, hometown: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-mauve-700 block">Ghana Card Number</label>
                      <input
                        type="text"
                        placeholder="e.g. GHA-000000000-0"
                        value={teacherForm.ghanaCardNumber}
                        onChange={(e) => setTeacherForm({ ...teacherForm, ghanaCardNumber: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white uppercase font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-mauve-700 block">Academic Qualification</label>
                    <input
                      type="text"
                      list="teacher-qualifications-list"
                      placeholder="e.g. B.Ed in Basic Education"
                      value={teacherForm.qualification}
                      onChange={(e) => setTeacherForm({ ...teacherForm, qualification: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                    />
                    <datalist id="teacher-qualifications-list">
                      <option value="B.Ed. Basic Education" />
                      <option value="B.Sc. Mathematics Education" />
                      <option value="B.A. English Studies & Linguistics" />
                      <option value="Diploma in Basic Education (DBE)" />
                      <option value="M.Ed. Educational Curriculum & Instruction" />
                      <option value="M.A. Educational Leadership" />
                      <option value="Postgraduate Diploma in Education (PGDE)" />
                      <option value="Early Childhood Education Certificate" />
                    </datalist>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-mauve-700 block">Staff Division</label>
                    <div className="flex gap-2">
                      {['NURSERY', 'KINDERGARTEN', 'PRIMARY', 'JHS'].map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => handleTeacherLevelChange(l as AcademicLevel)}
                          className={`flex-1 py-2 text-xs font-semibold border rounded-xl transition cursor-pointer ${
                            teacherForm.level === l
                              ? 'bg-mauve-900 border-mauve-900 text-white font-bold shadow-xs'
                              : 'border-mauve-200 hover:bg-mauve-50 text-mauve-600 bg-white'
                          }`}
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
                    </div>
                  </div>

                  {/* Subject selection toggles */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-mauve-700 block">
                        Syllabus Subject Assignment (Toggle subjects assigned to teacher)
                      </label>
                      {teacherForm.level === 'JHS' ? (
                        <span className="text-[10px] bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded font-bold font-mono">
                          MAX 2 SUBJECTS FOR JHS
                        </span>
                      ) : (
                        <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold font-mono uppercase">
                          Toggle Subject Access
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
                            disabled={isUnavailable}
                            onClick={() => toggleSubjectForTeacherForm(sub.id)}
                            className={`px-2.5 py-1 text-xs border rounded-lg text-left transition flex items-center justify-between cursor-pointer ${
                              isSel 
                                ? 'bg-mauve-600 text-white border-mauve-700 font-bold' 
                                : isUnavailable
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                                  : 'bg-white text-mauve-700 border-mauve-200 hover:bg-mauve-50'
                            } ${isUnavailable ? 'opacity-60' : ''}`}
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

      {/* TEACHERS PROFILE TAB VIEW */}
      {activeTab === 'teacher-profiles' && (
        <div className="space-y-5 animate-fadeIn no-print">
          {/* Banner Header */}
          <div className="bg-gradient-to-r from-mauve-900 via-purple-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-mauve-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Contact className="w-6 h-6 text-amber-400" />
                <h3 className="font-display font-bold text-lg uppercase tracking-wide">Teacher Profiles & Academic Credentials</h3>
              </div>
              <p className="text-xs text-purple-100 font-medium mt-1 leading-relaxed max-w-2xl">
                Comprehensive staff profiles detailing teacher profile photographs, birth dates, academic qualifications, phone numbers, and assigned syllabus classes.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingTeacher(null);
                setTeacherForm({
                  name: '',
                  email: '',
                  password: 'teacher123',
                  level: 'PRIMARY',
                  classes: [],
                  subjects: [],
                  dateOfBirth: '',
                  phoneNumber: '',
                  qualification: '',
                  profilePicture: '',
                  hometown: '',
                  ghanaCardNumber: ''
                });
                setTeacherError('');
                setShowTeacherModal(true);
              }}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4 text-slate-950" />
              <span>Add Teacher Profile</span>
            </button>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-mauve-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-mauve-100 rounded-xl text-mauve-900">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-mauve-600 tracking-wider block">Total Teachers</span>
                <span className="text-lg font-black text-mauve-900">{teachers.filter(t => t.role === 'TEACHER').length}</span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-mauve-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 rounded-xl text-emerald-800">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-mauve-600 tracking-wider block">Profiles Complete</span>
                <span className="text-lg font-black text-emerald-900">
                  {teachers.filter(t => t.role === 'TEACHER' && (t.qualification || t.phoneNumber || t.profilePicture)).length}
                </span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-mauve-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-xl text-amber-800">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-mauve-600 tracking-wider block">Qualifications Logged</span>
                <span className="text-lg font-black text-amber-900">
                  {teachers.filter(t => t.role === 'TEACHER' && t.qualification).length}
                </span>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-mauve-200 shadow-xs flex items-center gap-3">
              <div className="p-2.5 bg-cyan-100 rounded-xl text-cyan-800">
                <School className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-mauve-600 tracking-wider block">JHS Tutors (Max 2 Subs)</span>
                <span className="text-lg font-black text-cyan-900">
                  {teachers.filter(t => t.role === 'TEACHER' && t.level === 'JHS').length}
                </span>
              </div>
            </div>
          </div>

          {/* Search & Level Filter Controls */}
          <div className="bg-white p-3.5 rounded-xl border border-mauve-200 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-center">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-mauve-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search profile by name, phone, qualification..."
                value={teacherProfileSearchTerm}
                onChange={(e) => setTeacherProfileSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-mauve-200 text-xs text-mauve-900 outline-none focus:ring-2 focus:ring-mauve-500 bg-white"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
              {['ALL', 'NURSERY', 'KINDERGARTEN', 'PRIMARY', 'JHS'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setTeacherProfileLevelFilter(lvl)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    teacherProfileLevelFilter === lvl
                      ? 'bg-mauve-900 text-white shadow-xs'
                      : 'bg-mauve-50 text-mauve-700 hover:bg-mauve-100 border border-mauve-200'
                  }`}
                >
                  {lvl === 'ALL' ? 'All Divisions' : lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Teacher Profile Cards Grid */}
          {filteredTeacherProfiles.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-mauve-200 text-center space-y-2">
              <Users className="w-10 h-10 text-mauve-300 mx-auto" />
              <p className="font-bold text-mauve-800 text-sm">No Teacher Profiles Found</p>
              <p className="text-xs text-mauve-500">Try adjusting your search criteria or register a new teacher.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeacherProfiles.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl border border-mauve-200 shadow-xs hover:shadow-md transition flex flex-col justify-between overflow-hidden">
                  <div>
                    {/* Card Header & Photo */}
                    <div className="bg-gradient-to-r from-mauve-900 to-slate-900 p-4 text-white relative">
                      <div className="flex items-start gap-3">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-mauve-800 border-4 border-amber-400 shrink-0 shadow-lg flex items-center justify-center">
                          {t.profilePicture ? (
                            <img src={t.profilePicture} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-display font-black text-2xl text-amber-300">
                              {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              t.level === 'NURSERY' ? 'bg-rose-100 text-rose-900' :
                              t.level === 'KINDERGARTEN' ? 'bg-amber-100 text-amber-900' :
                              t.level === 'PRIMARY' ? 'bg-mauve-100 text-mauve-900' :
                              'bg-cyan-100 text-cyan-900'
                            }`}>
                              {t.level || 'PRIMARY'}
                            </span>
                            <span className="text-[10px] text-amber-300 font-mono font-bold">
                              {t.role}
                            </span>
                          </div>
                          <h4 className="font-display font-bold text-base text-white truncate">{t.name}</h4>
                          <p className="text-[11px] text-purple-200 truncate">{t.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Card Body Profile Information */}
                    <div className="p-4 space-y-3 text-xs">
                      {/* Qualification Badge */}
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 flex items-center gap-2">
                        <GraduationCap className="w-4 h-4 text-amber-700 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] uppercase font-bold text-amber-800 block">Qualification</span>
                          <span className="font-bold text-amber-950 text-xs block truncate">
                            {t.qualification || 'Not Specified'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-mauve-900">
                        <div className="bg-mauve-50/50 p-2 rounded-xl border border-mauve-100">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-mauve-600 uppercase mb-0.5">
                            <Calendar className="w-3 h-3" />
                            <span>Date of Birth</span>
                          </div>
                          <span className="font-bold text-xs block text-mauve-950">
                            {t.dateOfBirth ? t.dateOfBirth : 'N/A'}
                          </span>
                        </div>

                        <div className="bg-mauve-50/50 p-2 rounded-xl border border-mauve-100">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-mauve-600 uppercase mb-0.5">
                            <Phone className="w-3 h-3" />
                            <span>Phone Number</span>
                          </div>
                          {t.phoneNumber ? (
                            <a href={`tel:${t.phoneNumber}`} className="font-bold text-xs text-mauve-800 hover:underline block truncate">
                              {t.phoneNumber}
                            </a>
                          ) : (
                            <span className="text-mauve-400 font-medium">N/A</span>
                          )}
                        </div>

                        <div className="bg-mauve-50/50 p-2 rounded-xl border border-mauve-100">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-mauve-600 uppercase mb-0.5">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            <span>Hometown</span>
                          </div>
                          <span className="font-bold text-xs block text-mauve-950 truncate">
                            {t.hometown ? t.hometown : 'N/A'}
                          </span>
                        </div>

                        <div className="bg-mauve-50/50 p-2 rounded-xl border border-mauve-100">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-mauve-600 uppercase mb-0.5">
                            <IdCard className="w-3 h-3 text-cyan-600" />
                            <span>Ghana Card</span>
                          </div>
                          <span className="font-bold text-[11px] font-mono block text-mauve-950 truncate">
                            {t.ghanaCardNumber ? t.ghanaCardNumber : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Assigned Classes */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-mauve-600 block mb-1">Classroom Assigned</span>
                        <div className="flex flex-wrap gap-1">
                          {t.classes && t.classes.length > 0 ? (
                            t.classes.map(c => (
                              <span key={c} className="bg-mauve-100 text-mauve-900 font-bold text-[10px] px-2 py-0.5 rounded-lg border border-mauve-200">
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">Unassigned</span>
                          )}
                        </div>
                      </div>

                      {/* Subjects Handled */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-mauve-600 block mb-1">Subjects Handled</span>
                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                          {t.subjects && t.subjects.length > 0 ? (
                            t.subjects.map(sId => {
                              const sub = subjects.find(s => s.id === sId);
                              return (
                                <span key={sId} className="bg-mauve-50 text-mauve-800 font-semibold text-[10px] px-2 py-0.5 rounded border border-mauve-150">
                                  {sub ? sub.name : sId}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-gray-400 italic text-[11px]">No subjects assigned</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="p-3 bg-mauve-50/30 border-t border-mauve-100 flex items-center justify-between gap-1.5 flex-wrap">
                    <button
                      onClick={() => setViewingTeacherProfileModal(t)}
                      className="py-1.5 px-2.5 bg-white hover:bg-mauve-50 text-mauve-900 border border-mauve-250 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-mauve-700" />
                      <span>View Profile</span>
                    </button>

                    <button
                      onClick={() => setSelectedWorkstationTeacher(t)}
                      className="py-1.5 px-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 border border-amber-300 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-slate-950" />
                      <span>Workstation</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingTeacher(t);
                        setTeacherForm({
                          name: t.name,
                          email: t.email,
                          password: t.password || 'teacher123',
                          level: t.level || 'PRIMARY',
                          classes: t.classes || [],
                          subjects: t.subjects || [],
                          dateOfBirth: t.dateOfBirth || '',
                          phoneNumber: t.phoneNumber || '',
                          qualification: t.qualification || '',
                          profilePicture: t.profilePicture || '',
                          hometown: t.hometown || '',
                          ghanaCardNumber: t.ghanaCardNumber || ''
                        });
                        setTeacherError('');
                        setShowTeacherModal(true);
                      }}
                      className="p-1.5 bg-mauve-100 hover:bg-mauve-200 text-mauve-900 rounded-xl transition cursor-pointer"
                      title="Edit Teacher Profile"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {confirmDeleteTeacherId === t.id ? (
                      <div className="flex items-center gap-1 animate-pulse">
                        <button
                          onClick={() => {
                            handleDeleteTeacher(t.id);
                            setConfirmDeleteTeacherId(null);
                          }}
                          className="px-2 py-1 bg-rose-600 text-white font-bold rounded text-[10px] hover:bg-rose-700 cursor-pointer"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteTeacherId(null)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 font-bold rounded text-[10px] hover:bg-gray-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteTeacherId(t.id)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition cursor-pointer border border-rose-150"
                        title="Delete Teacher"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Teacher Profile Cards Grid */}
        </div>
      )}

      {/* E. CLASS TEACHER ASSIGNMENTS VIEW */}
      {activeTab === 'class-assignments' && (
        <div className="space-y-6 animate-fadeIn no-print">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-mauve-900 via-purple-900 to-indigo-900 text-white p-6 rounded-2xl shadow-sm border border-mauve-800 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <School className="w-6 h-6 text-amber-400" />
                  <h3 className="font-display font-bold text-lg sm:text-xl uppercase tracking-wide">Classroom Roll Call Teacher Assignments</h3>
                </div>
                <p className="text-xs text-purple-100 font-medium mt-1 max-w-2xl leading-relaxed">
                  Assign official Class Teachers to each classroom across Nursery, Kindergarten, Primary, and JHS divisions. Assigned teachers gain immediate real-time access to take daily attendance roll calls for their assigned classroom in the Attendance Portal. (Note: Assigning a JHS teacher to a class affects only the attendance roll call register; in the assessment register, JHS teachers retain access to all JHS classes: JHS 1, JHS 2, JHS 3).
                </p>
              </div>

              {/* Assignment Quick Summary Stats */}
              {(() => {
                const allSchoolClasses = [
                  ...(classes.NURSERY || []),
                  ...(classes.KINDERGARTEN || ["Kindergarten 1", "Kindergarten 2"]),
                  ...(classes.PRIMARY || []),
                  ...(classes.JHS || [])
                ];
                const assignedCount = allSchoolClasses.filter(c => teachers.some(t => t.classes?.includes(c))).length;
                const unassignedCount = allSchoolClasses.length - assignedCount;

                return (
                  <div className="flex gap-2 sm:gap-3 shrink-0">
                    <div className="bg-blue-600 px-3.5 py-2 rounded-xl text-center border border-blue-300 shadow-md">
                      <div className="text-lg font-black text-white">{allSchoolClasses.length}</div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-100">Classes</div>
                    </div>
                    <div className="bg-blue-600 px-3.5 py-2 rounded-xl text-center border border-blue-300 shadow-md">
                      <div className="text-lg font-black text-white">{assignedCount}</div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-100">Assigned</div>
                    </div>
                    <div className="bg-blue-600 px-3.5 py-2 rounded-xl text-center border border-blue-300 shadow-md">
                      <div className="text-lg font-black text-white">{unassignedCount}</div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-100">Pending</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Academic Divisions Assignment Grid */}
          {[
            { levelKey: 'NURSERY', title: 'Nursery Division', color: 'border-pink-200 bg-pink-50/20', classList: classes.NURSERY || [] },
            { levelKey: 'KINDERGARTEN', title: 'Kindergarten Division', color: 'border-purple-200 bg-purple-50/20', classList: classes.KINDERGARTEN || ["Kindergarten 1", "Kindergarten 2"] },
            { levelKey: 'PRIMARY', title: 'Primary School Division (P1 - P6)', color: 'border-indigo-200 bg-indigo-50/20', classList: classes.PRIMARY || [] },
            { levelKey: 'JHS', title: 'Junior High School Division (JHS 1 - JHS 3)', color: 'border-amber-200 bg-amber-50/20', classList: classes.JHS || [] }
          ].map(div => (
            <div key={div.levelKey} className={`bg-white rounded-2xl border ${div.color} p-5 space-y-4 shadow-2xs`}>
              <div className="flex items-center justify-between border-b border-mauve-100 pb-3">
                <h4 className="font-display font-bold text-mauve-900 text-sm uppercase tracking-wide flex items-center gap-2">
                  <School className="w-4 h-4 text-mauve-700" />
                  <span>{div.title}</span>
                </h4>
                <span className="text-xs font-bold text-mauve-600 bg-mauve-100/80 px-2.5 py-0.5 rounded-full">
                  {div.classList.length} Classrooms
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {div.classList.map(clsName => {
                  const assignedTeacher = teachers.find(t => t.classes?.includes(clsName));
                  const classPupils = students.filter(s => s.className === clsName || s.level === clsName);

                  return (
                    <div key={clsName} className={`p-4 rounded-xl border transition-all ${assignedTeacher ? 'bg-emerald-50/30 border-emerald-200/80' : 'bg-amber-50/30 border-amber-200/80'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-bold text-mauve-900 text-sm">{clsName}</h5>
                          <span className="text-[11px] text-mauve-800 font-bold">
                            {classPupils.length} Enrolled Pupils
                          </span>
                        </div>
                        {assignedTeacher ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300/60 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Assigned
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300/60 rounded text-[10px] font-bold uppercase tracking-wider shrink-0">
                            Unassigned
                          </span>
                        )}
                      </div>

                      {/* Current Teacher Info */}
                      {assignedTeacher ? (
                        <div className="p-2.5 bg-white rounded-lg border border-emerald-200 text-xs mb-3 space-y-0.5 shadow-2xs">
                          <div className="font-bold text-emerald-950">{assignedTeacher.name}</div>
                          <div className="text-[10px] text-emerald-700 truncate">{assignedTeacher.email}</div>
                        </div>
                      ) : (
                        <div className="p-2.5 bg-white/80 rounded-lg border border-dashed border-amber-300 text-xs text-amber-800 mb-3 italic">
                          No roll call teacher selected for {clsName}. Select a staff member below.
                        </div>
                      )}

                      {/* Teacher Selection Dropdown */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-mauve-800 uppercase tracking-wider block">
                          Assign Roll Call Teacher:
                        </label>
                        <select
                          value={assignedTeacher ? assignedTeacher.id : ''}
                          onChange={(e) => {
                            const newTeacherId = e.target.value;
                            setTeachers(prev => prev.map(t => {
                              if (newTeacherId && t.id === newTeacherId) {
                                return { ...t, classes: [clsName] };
                              } else if (t.classes?.includes(clsName)) {
                                return { ...t, classes: (t.classes || []).filter(c => c !== clsName) };
                              }
                              return t;
                            }));
                          }}
                          className="w-full px-3 py-2 bg-white border-2 border-mauve-300 rounded-xl text-xs font-bold text-mauve-950 focus:ring-2 focus:ring-mauve-500 focus:outline-none cursor-pointer shadow-xs min-h-[38px]"
                        >
                          <option value="">-- Unassigned (None) --</option>
                          {teachers
                            .filter(t => t.role === 'TEACHER')
                            .map(t => {
                              const alreadyHasOtherClass = t.classes && t.classes.length > 0 && !t.classes.includes(clsName);
                              return (
                                <option key={t.id} value={t.id}>
                                  {t.name} ({t.email}){alreadyHasOtherClass ? ` [In: ${t.classes?.join(', ')}]` : ''}
                                </option>
                              );
                            })}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* E. GENERAL REPORT CONFIGURATION VIEW */}
      {activeTab === 'config' && (
        <div className="bg-white p-6 rounded-2xl border border-mauve-100 mauve-glow space-y-6 animate-fadeIn no-print">
          <div className="border-b border-mauve-100 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-display font-bold text-mauve-900 text-lg">System Configurations</h3>
              <p className="text-xs text-mauve-800 font-medium mt-0.5">Edit academic term, continuous assessment weightings, and global evaluation parameters.</p>
            </div>
            <button
              type="button"
              onClick={handleUpdateSystemConfig}
              disabled={isSavingConfig}
              className={`px-5 py-2.5 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-sm flex items-center gap-2 shrink-0 active:scale-95 ${
                isFormConfigDirty
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white ring-2 ring-emerald-500/50 animate-pulse'
                  : 'bg-mauve-900 hover:bg-mauve-800 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSavingConfig ? 'Saving Changes...' : isFormConfigDirty ? 'Save Changes *' : 'Update Changes'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-mauve-800 uppercase tracking-widest">School & Term Parameters</h4>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-mauve-700 block">Academy Name</label>
                <input
                  type="text"
                  value={formConfig.schoolName}
                  onChange={(e) => {
                    setIsFormConfigDirty(true);
                    setFormConfig(prev => ({ ...prev, schoolName: e.target.value }));
                  }}
                  className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-mauve-700 block">School Year Cycle</label>
                    {isFormConfigDirty && (
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Unsaved
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={formConfig.schoolYear}
                    onChange={(e) => {
                      setIsFormConfigDirty(true);
                      setFormConfig(prev => ({ ...prev, schoolYear: e.target.value }));
                    }}
                    placeholder="e.g. 2025/2026"
                    className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-mauve-700 block">Current Academic Term</label>
                  <select
                    value={formConfig.term}
                    onChange={(e) => {
                      setIsFormConfigDirty(true);
                      setFormConfig(prev => ({ ...prev, term: e.target.value }));
                    }}
                    className="w-full p-2.5 rounded-xl border-2 border-mauve-300 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-950 font-bold bg-white cursor-pointer shadow-xs min-h-[42px]"
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
                  value={formConfig.principalName}
                  onChange={(e) => {
                    setIsFormConfigDirty(true);
                    setFormConfig(prev => ({ ...prev, principalName: e.target.value }));
                  }}
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
                      value={formConfig.reopeningDate || '2026-09-15'}
                      onChange={(e) => {
                        setIsFormConfigDirty(true);
                        setFormConfig(prev => ({ ...prev, reopeningDate: e.target.value }));
                      }}
                      className="w-full p-2 rounded-lg border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none text-mauve-900 bg-white"
                    />
                    <span className="text-[10px] text-mauve-800 font-medium block">Target date for First Term migration roll.</span>
                  </div>

                  <div className="space-y-2 flex flex-col justify-end">
                    <label className="font-semibold text-blue-900 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formConfig.autoPromoteOnReopening !== false}
                        onChange={(e) => {
                          setIsFormConfigDirty(true);
                          setFormConfig(prev => ({ ...prev, autoPromoteOnReopening: e.target.checked }));
                        }}
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
                  value={formConfig.selectedTemplate || 'dynamic'}
                  onChange={(e) => {
                    setIsFormConfigDirty(true);
                    setFormConfig(prev => ({ ...prev, selectedTemplate: e.target.value }));
                  }}
                  className="w-full p-2.5 rounded-xl border-2 border-mauve-300 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-950 font-bold bg-white cursor-pointer shadow-xs min-h-[42px]"
                >
                  <option value="dynamic">Dynamic (Auto-Detect based on Student Level)</option>
                  <option value="compact">Nursery & KG High-Fidelity (Lavender Curves & Bee Mascot)</option>
                  <option value="high-fidelity">JHS & Primary Structured (Elegant Blue Header & Metadata)</option>
                  <option value="classic">Classic Simple Layout (Traditional Clean Design)</option>
                </select>
                <span className="text-[10px] text-mauve-800 font-medium block leading-tight">
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
                      value={formConfig.schoolLogoText || ''}
                      onChange={(e) => {
                        setIsFormConfigDirty(true);
                        setFormConfig(prev => ({ ...prev, schoolLogoText: e.target.value }));
                      }}
                      placeholder="e.g. EA"
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white font-display font-extrabold text-sm"
                    />
                    <div className="flex items-center gap-2 pt-1">
                      <div className="w-10 h-10 rounded bg-mauve-900 text-white font-display font-extrabold text-xs flex items-center justify-center shadow shrink-0">
                        {formConfig.schoolLogoText || '??'}
                      </div>
                      <span className="text-[10px] text-mauve-800 font-medium leading-tight">Default text avatar preview</span>
                    </div>
                  </div>

                  {/* Image Upload Column */}
                  <div className="sm:col-span-8 space-y-3">
                    <label className="text-xs font-semibold text-mauve-700 block">Custom Logo Image</label>
                    
                    {formConfig.schoolLogoUrl ? (
                      <div className="border border-mauve-200 rounded-xl p-4 bg-mauve-50/20 space-y-3">
                        <div className="flex items-center gap-3">
                          <img 
                            src={formConfig.schoolLogoUrl} 
                            alt="School Logo Preview" 
                            className="w-16 h-16 object-contain bg-white rounded-lg border border-mauve-100 p-1.5 shadow-md shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-bold text-mauve-900 block">Custom Logo Active</span>
                            <span className="text-[10px] text-mauve-800 font-medium block leading-tight">Appears on all PDF Transcripts</span>
                            {formConfig.schoolLogoUrl.startsWith('data:') ? (
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
                            <span className="text-[10px] text-mauve-800 font-medium block">
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
                    <p className="text-[10px] text-mauve-900 leading-normal bg-mauve-50/60 p-2.5 rounded-lg border border-mauve-200 font-medium">
                      <strong>Global Synchronization Note:</strong> When you connect your own custom database credentials in the section below, any uploaded logo will automatically sync across devices. For maximum compatibility, files are optimized and stored directly inside the configuration schema to ensure perfect cross-device replication.
                    </p>
                  </div>
                </div>
              </div>

              {/* ADVANCE CUSTOMISATION OPTIONS */}
              <div className="space-y-4 pt-4 border-t border-mauve-200">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-mauve-900" />
                  <h4 className="text-xs font-bold text-mauve-900 uppercase tracking-widest">
                    Advance Customisation Options & Branding
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* School Motto */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-mauve-800 block">School Motto</label>
                    <input
                      type="text"
                      value={formConfig.schoolMotto || ''}
                      onChange={(e) => {
                        setIsFormConfigDirty(true);
                        setFormConfig(prev => ({ ...prev, schoolMotto: e.target.value }));
                      }}
                      placeholder="e.g. Knowledge, Character & Excellence"
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                    />
                    <span className="text-[10px] text-mauve-800 font-medium block">Displayed prominently below the school title on PDF report cards.</span>
                  </div>

                  {/* Watermark Text */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-mauve-800 block">Transcript Watermark Text</label>
                    <input
                      type="text"
                      value={formConfig.watermarkText || ''}
                      onChange={(e) => {
                        setIsFormConfigDirty(true);
                        setFormConfig(prev => ({ ...prev, watermarkText: e.target.value }));
                      }}
                      placeholder="e.g. EASTFIELD ACADEMY"
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white font-mono"
                    />
                    <span className="text-[10px] text-mauve-800 font-medium block">Subtle diagonal watermark overlay rendered on official transcripts.</span>
                  </div>

                  {/* Custom Administrative Notice Note */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="font-semibold text-mauve-800 block">Custom Administrative Notice / Remarks</label>
                    <textarea
                      rows={2}
                      value={formConfig.customNoticeNote || ''}
                      onChange={(e) => {
                        setIsFormConfigDirty(true);
                        setFormConfig(prev => ({ ...prev, customNoticeNote: e.target.value }));
                      }}
                      placeholder="e.g. Next term fees are due on reopening date. All students are requested to be in full ceremonial uniform."
                      className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-mauve-500 outline-none text-mauve-900 bg-white"
                    />
                    <span className="text-[10px] text-mauve-800 font-medium block">Broadcasting note displayed in a dedicated callout on report cards and parent emails.</span>
                  </div>

                  {/* Digital Principal Signature Upload */}
                  <div className="md:col-span-2 p-3.5 bg-mauve-50/40 border border-mauve-200/80 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-mauve-900 block">Head Principal Digital Authentication Signature</span>
                      {formConfig.principalSignatureUrl && (
                        <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Signature Synced
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      {formConfig.principalSignatureUrl ? (
                        <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-mauve-200 shrink-0">
                          <img
                            src={formConfig.principalSignatureUrl}
                            alt="Principal Signature"
                            className="h-10 object-contain max-w-[140px]"
                            referrerPolicy="no-referrer"
                          />
                          <button
                            type="button"
                            onClick={handleClearSignature}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                            title="Remove Signature"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-32 h-10 border border-dashed border-mauve-300 rounded flex items-center justify-center text-mauve-700 font-bold text-[10px] italic bg-white shrink-0">
                          No signature image
                        </div>
                      )}

                      <div className="flex-1 space-y-1">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-mauve-900 hover:bg-mauve-800 text-white font-bold rounded-lg text-xs cursor-pointer transition shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          <span>Upload Signature Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleSignatureChange}
                          />
                        </label>
                        <p className="text-[10px] text-mauve-800 font-medium">PNG or JPG signature on transparent or white background. Auto-embeds in PDF Principal Endorsement block.</p>
                        {signatureUploadError && (
                          <p className="text-[10px] text-red-600">{signatureUploadError}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Display & Layout Toggles */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-mauve-200">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formConfig.showPositionInClass !== false}
                        onChange={(e) => {
                          setIsFormConfigDirty(true);
                          setFormConfig(prev => ({ ...prev, showPositionInClass: e.target.checked }));
                        }}
                        className="w-4 h-4 rounded text-mauve-900 focus:ring-mauve-500"
                      />
                      <span className="font-medium text-mauve-900">Show Class Rank / Position</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formConfig.showConductColumn !== false}
                        onChange={(e) => {
                          setIsFormConfigDirty(true);
                          setFormConfig(prev => ({ ...prev, showConductColumn: e.target.checked }));
                        }}
                        className="w-4 h-4 rounded text-mauve-900 focus:ring-mauve-500"
                      />
                      <span className="font-medium text-mauve-900">Show Behavioral Conduct</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formConfig.showAttendanceSection !== false}
                        onChange={(e) => {
                          setIsFormConfigDirty(true);
                          setFormConfig(prev => ({ ...prev, showAttendanceSection: e.target.checked }));
                        }}
                        className="w-4 h-4 rounded text-mauve-900 focus:ring-mauve-500"
                      />
                      <span className="font-medium text-mauve-900">Show Attendance Section</span>
                    </label>
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
                      value={formConfig.classScoreWeight}
                      onChange={(e) => {
                        setIsFormConfigDirty(true);
                        setFormConfig(prev => ({ ...prev, classScoreWeight: Number(e.target.value) }));
                      }}
                      className="w-full p-2 rounded-lg border border-mauve-200 text-center font-mono font-bold text-mauve-900 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-mauve-600 block">Exam Score weight (%)</label>
                    <input
                      type="number"
                      max={100}
                      min={0}
                      value={formConfig.examScoreWeight}
                      onChange={(e) => {
                        setIsFormConfigDirty(true);
                        setFormConfig(prev => ({ ...prev, examScoreWeight: Number(e.target.value) }));
                      }}
                      className="w-full p-2 rounded-lg border border-mauve-200 text-center font-mono font-bold text-mauve-900 bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-mauve-100 flex justify-between font-semibold text-mauve-900">
                  <span>Combined Total Balance:</span>
                  <span>{formConfig.classScoreWeight + formConfig.examScoreWeight}%</span>
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
                  {formConfig.gradingScale.map((rule, index) => (
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



          {/* UPDATE SYSTEM CONFIGURATIONS ACTION BAR */}
          <div className="pt-4 border-t border-mauve-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1">
              {configUpdateSuccess && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-300 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn shadow-xs">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                  <span>{configUpdateSuccess}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleUpdateSystemConfig}
              disabled={isSavingConfig}
              className={`px-6 py-3 font-bold rounded-xl text-xs uppercase tracking-wider transition cursor-pointer shadow-md flex items-center justify-center gap-2 shrink-0 active:scale-95 ${
                isFormConfigDirty
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white ring-2 ring-emerald-500/50 animate-pulse'
                  : 'bg-mauve-900 hover:bg-mauve-800 text-white'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{isSavingConfig ? 'Saving Changes...' : isFormConfigDirty ? 'Save Changes *' : 'Update Changes'}</span>
            </button>
          </div>
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

          {/* ASSESSMENT DATA RECOVERY & BACKUP MANAGER */}
          <div className="pt-6 border-t border-mauve-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-900 rounded-xl">
                  <Database className="w-5 h-5 text-purple-800" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-mauve-900 text-sm uppercase tracking-wider">
                    Assessment Data Recovery & Emergency Backup
                  </h4>
                  <p className="text-xs text-gray-500">
                    Recover lost marks, restore from offline files, or export full system snapshots.
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-mono font-bold bg-mauve-100 text-mauve-900 px-2.5 py-1 rounded-lg">
                Total Loaded Marks: {grades.length}
              </span>
            </div>

            {backupRestoreMsg && (
              <div className="p-3.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{backupRestoreMsg}</span>
              </div>
            )}

            {backupRestoreError && (
              <div className="p-3.5 bg-rose-50 text-rose-800 border border-rose-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{backupRestoreError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Deep Cloud Sync & Grade Pull */}
              <div className="p-4 bg-white rounded-xl border border-purple-200 space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 text-purple-900 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Deep Cloud Recovery</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Fetches all historical grade rows directly from Supabase Cloud table <code className="bg-purple-50 px-1 py-0.2 rounded font-mono font-bold">ea_grades</code> and re-indexes them without overwriting.
                </p>
                <button
                  type="button"
                  onClick={handleDeepCloudGradeRecovery}
                  disabled={isRecoveringCloud}
                  className="w-full py-2.5 bg-purple-900 hover:bg-purple-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRecoveringCloud ? 'animate-spin' : ''}`} />
                  <span>{isRecoveringCloud ? 'Recovering Cloud Marks...' : 'Recover All Cloud Marks'}</span>
                </button>
              </div>

              {/* Option 2: Export JSON Backup */}
              <div className="p-4 bg-white rounded-xl border border-blue-200 space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <Download className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Export Assessment Backup</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Download a complete offline JSON file containing all students, classes, assessment marks, attendance, and bills for safekeeping.
                </p>
                <button
                  type="button"
                  onClick={handleExportFullSystemBackup}
                  disabled={isExportingData}
                  className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExportingData ? 'Exporting...' : 'Export Backup File'}</span>
                </button>
              </div>

              {/* Option 3: Restore / Import from Backup */}
              <div className="p-4 bg-white rounded-xl border border-amber-200 space-y-2.5 shadow-2xs">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Upload className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Import / Restore Backup</span>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Merge grades and attendance records from a previously exported backup file or another teacher's device.
                </p>
                <label className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 text-center">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload & Restore File</span>
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportSystemBackup}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SCHOOL INVENTORY TAB VIEW */}
      {activeTab === 'inventory' && (
        <SchoolInventoryModule
          allSchoolClasses={[
            ...classes.NURSERY,
            ...(classes.KINDERGARTEN || []),
            ...classes.PRIMARY,
            ...classes.JHS
          ]}
          onOpenBookInventory={() => setActiveTab('book-inventory')}
        />
      )}

      {/* TEXTBOOKS & CUSTOMISED EXERCISE BOOKS STOCK & SALES LEDGER TAB VIEW */}
      {activeTab === 'book-inventory' && (
        <BookInventoryModule
          students={students}
          config={config}
        />
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
                  <p className="text-xs text-mauve-800 font-medium">
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
              {createBatchEmailDispatchList(studentsInSelectedClass, config, getStudentStatsForEmail, batchNote).map((item, idx) => {
                const status = bulkDispatchStatus[item.student.id] || (item.hasEmail ? 'PENDING' : 'SKIPPED');

                return (
                  <div key={`${item.student.id}-${idx}`} className="p-3 bg-white border border-mauve-200 rounded-xl hover:border-blue-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-mauve-900 text-xs">{item.student.name}</span>
                        <span className="text-[10px] font-mono text-mauve-900 bg-mauve-100/80 px-1.5 py-0.5 rounded font-bold">{item.student.rollNumber}</span>
                        {status === 'SENT' && (
                          <span className="text-[10px] font-bold bg-green-100 text-green-800 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3 text-green-600" /> Dispatched
                          </span>
                        )}
                        {status === 'SKIPPED' && (
                          <span className="text-[10px] italic bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                            No Email
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-mauve-900 font-medium">
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
            <div className="pt-3 border-t border-mauve-100 flex justify-between items-center text-xs text-mauve-800 font-medium">
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
                  <p className="text-xs text-mauve-800 font-medium">
                    Automated grade level progression roll for <strong>{config.schoolYear}</strong> (Reopening Date: {formatReopeningDate(config.reopeningDate)}).
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
                <span className="text-[10px] uppercase font-bold text-green-800 block">Migrating to Next Class</span>
                <span className="text-lg font-black text-green-950">
                  {students.filter(s => !s.className.toLowerCase().includes('jhs 3')).length} Pupils
                </span>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-150 rounded-xl text-center">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">JHS 3 (Active Candidates)</span>
                <span className="text-lg font-black text-blue-950">
                  {students.filter(s => s.className.toLowerCase().includes('jhs 3')).length} Active
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setConfig(prev => {
                      const updated = { ...prev, reopeningDate: val };
                      localStorage.setItem('ea_config', JSON.stringify(updated));
                      localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updated));
                      saveSupabaseConfig(updated).catch(err => console.warn('Supabase config sync error', err));
                      return updated;
                    });
                  }}
                  className="p-1.5 rounded-lg border border-mauve-250 text-xs font-semibold bg-white text-mauve-900"
                />
              </div>

              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-mauve-700 absolute left-2.5 top-2.5" />
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
                .map((student, sIdx) => {
                  const { nextClass, nextLevel } = getNextClassAndLevel(student.className, student.level);
                  const isJHS3 = student.className.toLowerCase().includes('jhs 3');
                  const nextRollNumber = getUpdatedRollNumber(student.rollNumber, nextClass, nextLevel, config.schoolYear);

                  return (
                    <div
                      key={`${student.id}-${sIdx}`}
                      className="p-3 bg-white border border-mauve-200 rounded-xl hover:border-indigo-300 transition flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-mauve-900 text-xs">{student.name}</span>
                          <span className="text-[10px] font-mono text-mauve-900 bg-mauve-100/80 px-1.5 py-0.5 rounded font-bold">
                            {student.rollNumber}
                          </span>
                        </div>
                        <span className="text-[11px] text-mauve-800 font-medium block">
                          Level: {student.level}
                        </span>
                      </div>

                      {/* Migration Arrow */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-mauve-800 font-bold block uppercase font-mono">Current</span>
                          <span className="text-xs font-semibold text-mauve-800 bg-gray-100 px-2 py-0.5 rounded">
                            {student.className}
                          </span>
                          <span className="block text-[9px] font-mono text-mauve-700 mt-0.5">
                            ID: {student.rollNumber}
                          </span>
                        </div>

                        <ArrowUpRight className="w-4 h-4 text-indigo-600 shrink-0" />

                        <div className="text-left">
                          <span className="text-[10px] text-mauve-800 font-bold block uppercase font-mono">Promoted</span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded ${
                              isJHS3
                                ? 'bg-blue-100 text-blue-900 border border-blue-200'
                                : 'bg-green-100 text-green-900 border border-green-200'
                            }`}
                          >
                            {nextClass} {isJHS3 ? '(Active)' : ''}
                          </span>
                          <span className="block text-[9px] font-mono text-emerald-800 font-bold mt-0.5">
                            New ID: {nextRollNumber}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Note & Action Footer */}
            <div className="pt-3 border-t border-mauve-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-mauve-800 font-medium leading-tight">
                ℹ️ Promotion migrates student class levels. Historical grades & attendance for prior terms are preserved in past transcripts.
              </span>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={handleUndoPromotion}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Reverse promotion and return pupils to pre-promotion class levels"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>Undo Promotion</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestoreFromTerminalReport}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Restore and verify registered pupils based on previous term (Term 3) terminal report records"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Restore from Terminal Report</span>
                </button>
                <button
                  type="button"
                  onClick={handleRestoreAdmittedClasses}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  title="Restore all pupils to original admitted classes"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Restore Admitted Classes</span>
                </button>
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

      {/* BULK PRINTING PORTAL MODAL */}
      {showBulkPrintModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-fadeIn print:p-0 print:bg-white print:static print:inset-auto print:overflow-visible">
          <div className="bg-white rounded-2xl border border-mauve-250 w-full max-w-6xl mx-auto p-4 sm:p-6 shadow-2xl space-y-4 text-mauve-900 my-4 print:shadow-none print:border-none print:p-0 print:my-0 print:max-w-none print:w-full">
            
            {/* Modal Header Controls - HIDE IN PRINT */}
            <div className="no-print space-y-4 border-b border-mauve-150 pb-4">
              <div className="flex justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-mauve-900 text-white rounded-xl shadow-sm">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-mauve-900 text-base sm:text-lg flex flex-wrap items-center gap-2">
                      <span>Bulk Academic Report Printing Center</span>
                      <span className="text-xs bg-mauve-100 text-mauve-900 border border-mauve-200 font-mono px-2.5 py-0.5 rounded-full font-bold">
                        {bulkPrintClass === 'ALL' ? 'All Classes' : bulkPrintClass}
                      </span>
                    </h4>
                    <p className="text-xs text-mauve-800 font-medium">
                      Batch generate and hardcopy print official A4 report cards for pupils in <strong>{config.schoolName}</strong> ({config.term} {config.schoolYear}).
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowBulkPrintModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer p-1.5 rounded-xl hover:bg-gray-100 transition shrink-0"
                  title="Close Bulk Print Center"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Top Controls Bar */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-mauve-50/60 p-3.5 rounded-xl border border-mauve-200/80 items-center">
                {/* Class Selector */}
                <div className="md:col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-mauve-800 uppercase tracking-wider block">Target Class Roll</label>
                  <select
                    value={bulkPrintClass}
                    onChange={(e) => {
                      const newCls = e.target.value;
                      setBulkPrintClass(newCls);
                      const clsStudents = newCls === 'ALL' ? students : students.filter(s => s.className === newCls);
                      setSelectedBulkStudentIds(clsStudents.map(s => s.id));
                    }}
                    className="w-full text-xs p-2 rounded-lg border border-mauve-200 bg-white text-mauve-900 font-bold focus:ring-2 focus:ring-mauve-900 outline-none"
                  >
                    <option value="ALL">-- All Classes Roll ({students.length} Pupils) --</option>
                    {[...classes.NURSERY, ...(classes.KINDERGARTEN || []), ...classes.PRIMARY, ...classes.JHS].map((c) => {
                      const cCount = students.filter(s => s.className === c).length;
                      return (
                        <option key={c} value={c}>{c} ({cCount} pupils)</option>
                      );
                    })}
                  </select>
                </div>

                {/* Pupil Search */}
                <div className="md:col-span-4 space-y-1">
                  <label className="text-[10px] font-bold text-mauve-800 uppercase tracking-wider block">Filter Pupil Checklist</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={bulkStudentSearch}
                      onChange={(e) => setBulkStudentSearch(e.target.value)}
                      placeholder="Search pupil name or roll number..."
                      className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-mauve-200 bg-white text-mauve-900 focus:ring-2 focus:ring-mauve-900 outline-none"
                    />
                  </div>
                </div>

                {/* Actions & Print Exec */}
                <div className="md:col-span-5 flex items-center justify-end gap-2 pt-2 md:pt-0">
                  <button
                    onClick={() => {
                      const targetList = (bulkPrintClass === 'ALL' ? students : students.filter(s => s.className === bulkPrintClass))
                        .filter(s => !bulkStudentSearch || s.name.toLowerCase().includes(bulkStudentSearch.toLowerCase()) || s.rollNumber.toLowerCase().includes(bulkStudentSearch.toLowerCase()));
                      handleToggleSelectAllBulkStudents(targetList);
                    }}
                    className="px-3 py-2 bg-mauve-100 hover:bg-mauve-200 text-mauve-900 font-bold text-xs rounded-lg transition cursor-pointer border border-mauve-200/60"
                  >
                    Toggle Select All
                  </button>

                  <button
                    onClick={() => window.print()}
                    disabled={selectedBulkStudentIds.length === 0}
                    className="px-4 py-2 bg-mauve-900 hover:bg-mauve-800 active:scale-[0.98] disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md uppercase tracking-wider"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Hardcopies ({selectedBulkStudentIds.length})</span>
                  </button>
                </div>
              </div>

              {/* Iframe warning notice if inside AI Studio preview iframe */}
              {window.self !== window.top && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs animate-fadeIn">
                  <div className="space-y-0.5">
                    <span className="font-bold text-amber-900 flex items-center gap-1.5 uppercase text-[10px] tracking-wide">
                      ⚠️ Secure Preview Frame Notice
                    </span>
                    <p className="text-[11px] text-amber-800">
                      Browser preview iframes block direct `window.print()`. Click below to open in a new browser tab for full multi-page batch printing!
                    </p>
                  </div>
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition cursor-pointer shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Bulk Print Window in New Tab</span>
                  </a>
                </div>
              )}

              {/* Student Checklist Selection Tray */}
              {(() => {
                const availableList = (bulkPrintClass === 'ALL' ? students : students.filter(s => s.className === bulkPrintClass))
                  .filter(s => !bulkStudentSearch || s.name.toLowerCase().includes(bulkStudentSearch.toLowerCase()) || s.rollNumber.toLowerCase().includes(bulkStudentSearch.toLowerCase()));

                return (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-mauve-900 uppercase text-[10px] tracking-wider">
                        Pupil Selection Checklist ({selectedBulkStudentIds.length} of {availableList.length} Checked)
                      </span>
                      <span className="text-mauve-800 font-medium text-[11px]">
                        Uncheck any pupil you do not wish to include in this print batch.
                      </span>
                    </div>

                    {availableList.length === 0 ? (
                      <div className="p-4 text-center text-mauve-900 font-bold bg-mauve-50 rounded-xl border border-dashed border-mauve-200 text-xs">
                        No pupils match the selected class or search filter.
                      </div>
                    ) : (
                      <div className="max-h-36 overflow-y-auto p-2 bg-white rounded-xl border border-mauve-200 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                        {availableList.map((st, idx) => {
                          const isSelected = selectedBulkStudentIds.includes(st.id);
                          return (
                            <label
                              key={`${st.id}-${idx}`}
                              className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition select-none ${
                                isSelected
                                  ? 'bg-mauve-50 border-mauve-300 text-mauve-900 font-semibold'
                                  : 'bg-gray-50/50 border-gray-200 text-mauve-800 font-medium opacity-80'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleStudentBulkSelection(st.id)}
                                className="rounded text-mauve-900 focus:ring-mauve-900 w-3.5 h-3.5 shrink-0"
                              />
                              <span className="truncate text-[11px]" title={`${st.name} (${st.rollNumber})`}>
                                {st.name}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* MAIN BULK REPORT CARDS PRINT CONTAINER */}
            <div className="bulk-print-container space-y-8 print:space-y-0">
              {(() => {
                const targetStudents = students.filter(s => selectedBulkStudentIds.includes(s.id));

                if (targetStudents.length === 0) {
                  return (
                    <div className="p-12 text-center text-mauve-900 font-bold bg-mauve-50/50 rounded-2xl border-2 border-dashed border-mauve-200 space-y-3 no-print">
                      <AlertCircle className="w-8 h-8 text-mauve-600 mx-auto" />
                      <p className="font-semibold text-sm">No pupils selected for bulk printing.</p>
                      <p className="text-xs text-mauve-800 font-medium">Select pupils from the checklist above to load their A4 report cards here.</p>
                    </div>
                  );
                }

                return targetStudents.map((st, idx) => {
                  const stGrades = grades.filter(
                    (g) => g.studentId === st.id && (!g.term || g.term === config.term) && (!g.year || g.year === config.schoolYear)
                  );

                  const stAttendance = attendance.find(
                    (a) => a.studentId === st.id && (!a.term || a.term === config.term) && (!a.year || a.year === config.schoolYear)
                  );

                  const stClassList = students.filter((s) => s.className === st.className);

                  return (
                    <div
                      key={`${st.id}-${idx}`}
                      className="bulk-report-card page-break relative bg-white rounded-xl shadow-md p-2 sm:p-4 print:shadow-none print:p-0 border border-mauve-200 print:border-none"
                    >
                      {/* Screen-Only Header Ribbon */}
                      <div className="no-print flex justify-between items-center bg-mauve-900 text-white text-xs font-bold px-4 py-2 rounded-t-lg mb-3">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          PAGE {idx + 1} OF {targetStudents.length}: {st.name} ({st.rollNumber})
                        </span>
                        <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-mono">
                          {st.className}
                        </span>
                      </div>

                      <ReportPDF
                        student={st}
                        bills={bills}
                        onUpdateBill={onUpdateBill}
                        setConfig={setConfig}
                        grades={stGrades}
                        attendance={stAttendance}
                        subjects={subjects}
                        config={config}
                        allClassStudents={stClassList}
                        allGrades={grades}
                        isBulkMode={true}
                        onUpdateGrade={(subjectId, classScore, examScore, nurseryRemark) => {
                          const studentId = st.id;
                          const targetSubObj = subjects.find(s => s.id === subjectId || s.name === subjectId || s.code === subjectId) ||
                                               INITIAL_SUBJECTS.find(s => matchesSubject(subjectId, s));
                          const canonicalSubjectId = targetSubObj ? targetSubObj.id : subjectId;

                          const totalScore = Math.min(100, Math.max(0, classScore + examScore));
                          const rule = config.gradingScale?.find((r) => totalScore >= r.minScore && totalScore <= r.maxScore);
                          const gradeLetter = rule ? rule.grade : (totalScore >= 80 ? 'A' : totalScore >= 70 ? 'B' : totalScore >= 60 ? 'C' : totalScore >= 50 ? 'D' : totalScore >= 40 ? 'E' : 'F');
                          const calcRemarks = rule ? rule.remarks : (totalScore >= 80 ? 'Excellent' : totalScore >= 70 ? 'Very Good' : totalScore >= 60 ? 'Good' : totalScore >= 50 ? 'Credit' : totalScore >= 40 ? 'Pass' : 'Fail');
                          const isStudentNursery = st.level === 'NURSERY' || (st.className || '').toLowerCase().includes('nursery');
                          const finalRemarks = isStudentNursery ? (nurseryRemark || calcRemarks) : calcRemarks;
                          const finalNurseryRemark = isStudentNursery ? nurseryRemark : undefined;

                          const updatedGrades = [...grades];
                          const existingIndex = updatedGrades.findIndex(
                            (g) => g.studentId === studentId &&
                                   (g.subjectId === canonicalSubjectId || (targetSubObj && matchesSubject(g.subjectId, targetSubObj))) &&
                                   (!g.term || g.term === config.term) &&
                                   (!g.year || g.year === config.schoolYear)
                          );

                          const gradeRecord: Grade = {
                            studentId,
                            subjectId: canonicalSubjectId,
                            classScore,
                            examScore,
                            totalScore,
                            gradeLetter,
                            remarks: finalRemarks,
                            nurseryRemark: finalNurseryRemark,
                            term: config.term || 'Term 1',
                            year: config.schoolYear || '2025/2026',
                            teacherId: 'admin',
                            updatedAt: new Date().toISOString()
                          };

                          if (existingIndex !== -1) {
                            updatedGrades[existingIndex] = {
                              ...updatedGrades[existingIndex],
                              ...gradeRecord
                            };
                          } else {
                            updatedGrades.push(gradeRecord);
                          }

                          if (setGrades) {
                            setGrades(updatedGrades);
                          }

                          localStorage.setItem('ea_grades', JSON.stringify(updatedGrades));
                          localStorage.setItem('mock_supabase_ea_grades', JSON.stringify(updatedGrades));

                          if (getSupabaseCredentials().isConfigured) {
                            saveSupabaseGrades(updatedGrades).catch((err) => console.warn('Supabase save grade error', err));
                          }
                        }}
                      />
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Bottom Footer Actions - HIDE IN PRINT */}
            <div className="no-print pt-4 border-t border-mauve-150 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-mauve-800 font-medium text-[11px]">
                💡 Tip: Use your browser's Print dialog to save all selected report cards as a single multi-page PDF document!
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  onClick={() => setShowBulkPrintModal(false)}
                  className="w-full sm:w-auto px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer"
                >
                  Close Portal
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={selectedBulkStudentIds.length === 0}
                  className="w-full sm:w-auto px-5 py-2.5 bg-mauve-900 hover:bg-mauve-800 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md uppercase tracking-wider disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print All ({selectedBulkStudentIds.length})</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Teacher Profile Credential Sheet Modal Overlay */}
      {viewingTeacherProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn no-print">
          <div className="bg-white rounded-2xl border border-mauve-200 w-full max-w-xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-mauve-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-mauve-600 block">Eastfield Academy Official Staff Record</span>
                <h3 className="font-display font-bold text-mauve-900 text-xl">Teacher Profile Credential Sheet</h3>
              </div>
              <button
                onClick={() => setViewingTeacherProfileModal(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gradient-to-br from-mauve-900 via-slate-900 to-purple-950 rounded-2xl p-6 text-white space-y-4 shadow-lg border border-mauve-800">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-mauve-800 border-4 border-amber-400 shrink-0 shadow-xl flex items-center justify-center">
                  {viewingTeacherProfileModal.profilePicture ? (
                    <img src={viewingTeacherProfileModal.profilePicture} alt={viewingTeacherProfileModal.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display font-black text-2xl text-amber-300">
                      {viewingTeacherProfileModal.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="text-center sm:text-left space-y-1 min-w-0 flex-1">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 inline-block mb-1">
                    {viewingTeacherProfileModal.level || 'PRIMARY'} DIVISION TEACHER
                  </span>
                  <h4 className="font-display font-bold text-2xl text-white">{viewingTeacherProfileModal.name}</h4>
                  <p className="text-xs text-purple-200 font-mono">{viewingTeacherProfileModal.email}</p>
                  {viewingTeacherProfileModal.phoneNumber && (
                    <p className="text-xs text-amber-300 font-bold flex items-center justify-center sm:justify-start gap-1 mt-1">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{viewingTeacherProfileModal.phoneNumber}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-mauve-800/80 text-xs">
                <div className="bg-blue-700/90 border border-blue-500/80 p-2.5 rounded-xl shadow-xs">
                  <span className="text-[9px] uppercase font-bold text-blue-100 block">Date of Birth</span>
                  <span className="font-bold text-white text-sm block">
                    {viewingTeacherProfileModal.dateOfBirth || 'Not Specified'}
                  </span>
                </div>

                <div className="bg-blue-700/90 border border-blue-500/80 p-2.5 rounded-xl shadow-xs">
                  <span className="text-[9px] uppercase font-bold text-blue-100 block">Academic Qualification</span>
                  <span className="font-bold text-amber-300 text-sm block truncate">
                    {viewingTeacherProfileModal.qualification || 'Not Specified'}
                  </span>
                </div>

                <div className="bg-blue-700/90 border border-blue-500/80 p-2.5 rounded-xl shadow-xs">
                  <span className="text-[9px] uppercase font-bold text-blue-100 block">Hometown</span>
                  <span className="font-bold text-white text-sm block truncate">
                    {viewingTeacherProfileModal.hometown || 'Not Specified'}
                  </span>
                </div>

                <div className="bg-blue-700/90 border border-blue-500/80 p-2.5 rounded-xl shadow-xs">
                  <span className="text-[9px] uppercase font-bold text-blue-100 block">Ghana Card Number</span>
                  <span className="font-bold text-amber-300 font-mono text-sm block truncate">
                    {viewingTeacherProfileModal.ghanaCardNumber || 'Not Specified'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="border border-mauve-150 rounded-xl p-3 bg-mauve-50/30 space-y-1">
                <span className="font-bold text-mauve-900 block uppercase text-[10px] tracking-wider">Classroom Assignment</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {viewingTeacherProfileModal.classes && viewingTeacherProfileModal.classes.length > 0 ? (
                    viewingTeacherProfileModal.classes.map(c => (
                      <span key={c} className="bg-mauve-800 text-white font-bold text-xs px-2.5 py-1 rounded-lg">
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500 italic">No classroom assigned</span>
                  )}
                </div>
              </div>

              <div className="border border-mauve-150 rounded-xl p-3 bg-mauve-50/30 space-y-1">
                <span className="font-bold text-mauve-900 block uppercase text-[10px] tracking-wider">Syllabus Subject Expertise</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {viewingTeacherProfileModal.subjects && viewingTeacherProfileModal.subjects.length > 0 ? (
                    viewingTeacherProfileModal.subjects.map(sId => {
                      const sub = subjects.find(s => s.id === sId);
                      return (
                        <span key={sId} className="bg-white border border-mauve-250 text-mauve-900 font-bold text-xs px-2.5 py-1 rounded-lg shadow-xs">
                          {sub ? sub.name : sId}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-gray-500 italic">No subject assigned</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-mauve-100">
              <button
                onClick={() => {
                  const t = viewingTeacherProfileModal;
                  setViewingTeacherProfileModal(null);
                  setSelectedWorkstationTeacher(t);
                }}
                className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 rounded-xl font-extrabold transition flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-md border border-amber-300"
              >
                <BookOpen className="w-4 h-4 text-slate-950" />
                <span>Open Teacher Workstation</span>
              </button>
              <button
                onClick={() => {
                  const tToEdit = viewingTeacherProfileModal;
                  setViewingTeacherProfileModal(null);
                  setEditingTeacher(tToEdit);
                  setTeacherForm({
                    name: tToEdit.name,
                    email: tToEdit.email,
                    password: tToEdit.password || 'teacher123',
                    level: tToEdit.level || 'PRIMARY',
                    classes: tToEdit.classes || [],
                    subjects: tToEdit.subjects || [],
                    dateOfBirth: tToEdit.dateOfBirth || '',
                    phoneNumber: tToEdit.phoneNumber || '',
                    qualification: tToEdit.qualification || '',
                    profilePicture: tToEdit.profilePicture || '',
                    hometown: tToEdit.hometown || '',
                    ghanaCardNumber: tToEdit.ghanaCardNumber || ''
                  });
                  setTeacherError('');
                  setShowTeacherModal(true);
                }}
                className="py-2.5 px-4 bg-mauve-800 hover:bg-mauve-900 text-white rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <Edit2 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => window.print()}
                className="py-2.5 px-3 bg-mauve-100 hover:bg-mauve-200 text-mauve-900 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Badge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Workstation Modal Overlay */}
      {selectedWorkstationTeacher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md p-2 sm:p-4 animate-fadeIn no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-mauve-300 max-w-7xl mx-auto p-4 sm:p-6 space-y-4 my-4">
            <div className="bg-gradient-to-r from-mauve-900 via-purple-900 to-slate-900 p-4 rounded-xl text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 text-lg shadow-sm border-2 border-amber-300 overflow-hidden">
                  {selectedWorkstationTeacher.profilePicture ? (
                    <img src={selectedWorkstationTeacher.profilePicture} alt={selectedWorkstationTeacher.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{selectedWorkstationTeacher.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="bg-amber-400 text-slate-950 font-black text-[10px] uppercase px-2 py-0.5 rounded shadow-xs">
                      Teacher Workstation
                    </span>
                    <span className="text-xs text-purple-200 font-bold">{selectedWorkstationTeacher.level || 'PRIMARY'} DIVISION</span>
                  </div>
                  <h3 className="font-display font-bold text-xl text-white">{selectedWorkstationTeacher.name}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedWorkstationTeacher(null)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 border border-white/20 shadow-sm"
              >
                <X className="w-4 h-4" />
                <span>Exit Workstation</span>
              </button>
            </div>

            <TeacherDashboard
              students={students}
              teachers={teachers}
              setTeachers={setTeachers}
              subjects={subjects}
              grades={grades}
              setGrades={setGrades || (() => {})}
              attendance={attendance}
              setAttendance={setAttendance}
              config={config}
              classes={classes}
              currentUser={selectedWorkstationTeacher}
              setCurrentUser={(usr) => {
                if (!usr) setSelectedWorkstationTeacher(null);
                else setSelectedWorkstationTeacher(usr);
              }}
              isAdminAuthenticated={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
