import React, { useState, useMemo, useEffect } from 'react';
import { Student, Subject, Grade, ReportConfig } from '../types';
import { 
  History, 
  Search, 
  Filter, 
  Calendar, 
  Printer, 
  Plus, 
  Trash2, 
  Edit3, 
  FileText, 
  GraduationCap, 
  CheckCircle2, 
  Award, 
  BookOpen, 
  UserCheck, 
  X, 
  Save, 
  RefreshCw,
  AlertCircle,
  Clock,
  FileSpreadsheet
} from 'lucide-react';

export interface JHSTerminalRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  academicYear: string;
  term: string; // e.g., 'Term 3', 'Term 2', 'Term 1'
  scores: { 
    [subjectId: string]: { 
      classScore?: number; // out of 30 
      examScore?: number;  // out of 70
      totalScore?: number; // out of 100
      grade?: string;
      remark?: string;
    } 
  };
  overallAverage?: number;
  promotionalStatus?: 'PROMOTED' | 'RETAINED' | 'GRADUATED' | 'PENDING';
  teacherRemarks?: string;
  updatedAt?: string;
}

interface JHSTerminalAssessmentHistoryModuleProps {
  students: Student[];
  subjects: Subject[];
  grades?: Grade[];
  config: ReportConfig;
  currentUser?: { name: string; id?: string; email?: string; role: string };
}

// Local Storage Key for JHS Terminal Assessment Records
const STORAGE_KEY = 'ea_jhs_terminal_assessment_history';

// Standard Academic Years list starting from present year 2025/2026 onwards
export const JHS_ACADEMIC_YEARS = [
  '2025/2026',
  '2026/2027',
  '2027/2028',
  '2028/2029',
  '2029/2030',
  '2030/2031'
];

export function getStoredJHSTerminalRecords(): JHSTerminalRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.error('Failed to load JHS Terminal Assessment History from localStorage:', err);
  }
  return [];
}

export function saveJHSTerminalRecords(records: JHSTerminalRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.error('Failed to save JHS Terminal Assessment History to localStorage:', err);
  }
}

// Helper: Compute GES Grade (1 - 9)
function calculateGESGrade(score: number): { grade: string; remark: string; badgeColor: string } {
  if (score >= 80) return { grade: '1', remark: 'HIGHEST DISCRETION / EXCELLENT', badgeColor: 'bg-emerald-100 text-emerald-950 border-emerald-300' };
  if (score >= 70) return { grade: '2', remark: 'HIGHER / VERY GOOD', badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  if (score >= 65) return { grade: '3', remark: 'HIGH / GOOD', badgeColor: 'bg-blue-100 text-blue-900 border-blue-300' };
  if (score >= 60) return { grade: '4', remark: 'HIGH AVERAGE / CREDIT', badgeColor: 'bg-blue-100 text-blue-900 border-blue-300' };
  if (score >= 55) return { grade: '5', remark: 'AVERAGE / CREDIT', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' };
  if (score >= 50) return { grade: '6', remark: 'LOW AVERAGE / PASS', badgeColor: 'bg-amber-100 text-amber-900 border-amber-300' };
  if (score >= 45) return { grade: '7', remark: 'LOW / PASS', badgeColor: 'bg-orange-100 text-orange-900 border-orange-300' };
  if (score >= 40) return { grade: '8', remark: 'LOWER / WEAK PASS', badgeColor: 'bg-orange-100 text-orange-900 border-orange-300' };
  return { grade: '9', remark: 'LOWEST / FAIL', badgeColor: 'bg-rose-100 text-rose-950 border-rose-300' };
}

export default function JHSTerminalAssessmentHistoryModule({
  students,
  subjects,
  grades = [],
  config,
}: JHSTerminalAssessmentHistoryModuleProps) {
  // Stored Terminal History Records
  const [terminalRecords, setTerminalRecords] = useState<JHSTerminalRecord[]>(() => getStoredJHSTerminalRecords());
  
  // Filters (Defaults to Term 3 & 2025/2026 Academic Year starting point as requested)
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>('2025/2026');
  const [selectedTerm, setSelectedTerm] = useState<string>('Term 3');
  const [selectedClassLevel, setSelectedClassLevel] = useState<string>('ALL_JHS');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<JHSTerminalRecord | null>(null);
  const [printingRecord, setPrintingRecord] = useState<JHSTerminalRecord | null>(null);
  const [showMasterSheetModal, setShowMasterSheetModal] = useState<boolean>(false);

  // Form State for Add / Edit
  const [formStudentId, setFormStudentId] = useState<string>('');
  const [formAcademicYear, setFormAcademicYear] = useState<string>('2025/2026');
  const [formTerm, setFormTerm] = useState<string>('Term 3');
  const [formClass, setFormClass] = useState<string>('JHS 1');
  const [formTeacherRemarks, setFormTeacherRemarks] = useState<string>('');
  const [formScores, setFormScores] = useState<{ [subjectId: string]: { classScore?: number; examScore?: number; totalScore?: number } }>({});

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync state to local storage when terminalRecords changes
  useEffect(() => {
    saveJHSTerminalRecords(terminalRecords);
  }, [terminalRecords]);

  // Filter JHS Subjects
  const jhsSubjects = useMemo(() => {
    return subjects.filter((s) => s.level === 'JHS' || !s.level);
  }, [subjects]);

  // Filter JHS Students
  const jhsStudents = useMemo(() => {
    return students.filter((st) => {
      const cls = (st.className || '').toUpperCase();
      return st.level === 'JHS' || cls.includes('JHS') || cls.includes('JUNIOR') || cls.includes('GRADUAT') || cls.includes('ALUMNI');
    });
  }, [students]);

  // Combine stored terminal records & current grades into unified terminal records list
  const filteredRecords = useMemo(() => {
    const map = new Map<string, JHSTerminalRecord>();

    // 1. Load manual or saved history records first
    terminalRecords.forEach((rec) => {
      const recYear = rec.academicYear || '2025/2026';
      const recTerm = rec.term || 'Term 3';
      const recClass = (rec.className || 'JHS 1').toUpperCase();

      // Academic year filter
      if (selectedAcademicYear !== 'ALL_YEARS' && recYear !== selectedAcademicYear) return;
      // Term filter
      if (selectedTerm !== 'ALL_TERMS' && recTerm !== selectedTerm) return;
      // Class level filter
      if (selectedClassLevel !== 'ALL_JHS') {
        if (selectedClassLevel === 'GRADUATED') {
          if (!recClass.includes('GRADUAT') && !recClass.includes('ALUMNI') && !recClass.includes('OLD')) return;
        } else {
          if (!recClass.includes(selectedClassLevel.toUpperCase())) return;
        }
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (rec.studentName || '').toLowerCase().includes(q);
        const rollMatch = (rec.rollNumber || '').toLowerCase().includes(q);
        if (!nameMatch && !rollMatch) return;
      }

      const key = `${rec.studentId}_${recYear}_${recTerm}`;
      map.set(key, rec);
    });

    // 2. Also map registered JHS pupils if not already overridden by manual record
    jhsStudents.forEach((st) => {
      const stClass = (st.className || 'JHS 1').toUpperCase();
      
      // Class level filter
      if (selectedClassLevel !== 'ALL_JHS') {
        if (selectedClassLevel === 'GRADUATED') {
          if (!stClass.includes('GRADUAT') && !stClass.includes('ALUMNI') && !stClass.includes('OLD')) return;
        } else {
          if (!stClass.includes(selectedClassLevel.toUpperCase())) return;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = st.name.toLowerCase().includes(q);
        const rollMatch = st.rollNumber.toLowerCase().includes(q);
        if (!nameMatch && !rollMatch) return;
      }

      const targetYear = selectedAcademicYear !== 'ALL_YEARS' ? selectedAcademicYear : '2025/2026';
      const targetTerm = selectedTerm !== 'ALL_TERMS' ? selectedTerm : 'Term 3';
      const key = `${st.id}_${targetYear}_${targetTerm}`;

      if (!map.has(key)) {
        // Present year (2025/2026 Term 3) holds active live grade records.
        // For other years/terms, students appear with no mark entry since marks haven't been entered yet.
        const isPresentYearAndTerm = targetYear === '2025/2026' && (targetTerm === 'Term 3' || targetTerm === 'ALL_TERMS');
        const scoresObj: { [subId: string]: { classScore?: number; examScore?: number; totalScore?: number } } = {};
        
        if (isPresentYearAndTerm) {
          const studentGrades = grades.filter((g) => g.studentId === st.id);
          studentGrades.forEach((g) => {
            const classSc = g.classScore ?? 0;
            const examSc = g.examScore ?? 0;
            const totSc = g.totalScore ?? (classSc + examSc);
            scoresObj[g.subjectId] = {
              classScore: classSc,
              examScore: examSc,
              totalScore: totSc
            };
          });
        }

        const scoreValues = Object.values(scoresObj).map((s) => s.totalScore).filter((v): v is number => v !== undefined && v !== null);
        const hasScores = isPresentYearAndTerm && scoreValues.length > 0;
        const avg = hasScores ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length : null;

        map.set(key, {
          id: `auto_${st.id}_${targetYear}_${targetTerm}`,
          studentId: st.id,
          studentName: st.name,
          rollNumber: st.rollNumber,
          className: st.className || 'JHS 1',
          academicYear: targetYear,
          term: targetTerm,
          scores: scoresObj,
          overallAverage: avg !== null ? Math.round(avg * 10) / 10 : undefined,
          teacherRemarks: hasScores
            ? (avg >= 75 ? 'Excellent terminal performance.' : avg >= 50 ? 'Satisfactory progress shown.' : 'Needs improvement in core subjects.')
            : 'No mark entry recorded yet.',
          updatedAt: new Date().toISOString()
        });
      }
    });

    const list = Array.from(map.values());
    // Sort DESC by Academic Year, then Term, then Student Name ASC
    list.sort((a, b) => {
      if (a.academicYear !== b.academicYear) {
        return b.academicYear.localeCompare(a.academicYear);
      }
      if (a.term !== b.term) {
        return b.term.localeCompare(a.term);
      }
      return a.studentName.localeCompare(b.studentName);
    });

    return list;
  }, [terminalRecords, jhsStudents, grades, selectedAcademicYear, selectedTerm, selectedClassLevel, searchQuery]);

  // Handle open modal for new entry
  const handleOpenAddModal = () => {
    setEditingRecord(null);
    setFormStudentId(jhsStudents[0]?.id || '');
    setFormAcademicYear(selectedAcademicYear !== 'ALL_YEARS' ? selectedAcademicYear : '2025/2026');
    setFormTerm(selectedTerm !== 'ALL_TERMS' ? selectedTerm : 'Term 3');
    setFormClass(jhsStudents[0]?.className || 'JHS 1');
    setFormTeacherRemarks('Satisfactory performance in Terminal Examinations.');
    setFormScores({});
    setShowAddModal(true);
  };

  // Handle open modal for editing
  const handleOpenEditModal = (rec: JHSTerminalRecord) => {
    setEditingRecord(rec);
    setFormStudentId(rec.studentId);
    setFormAcademicYear(rec.academicYear);
    setFormTerm(rec.term);
    setFormClass(rec.className);
    setFormTeacherRemarks(rec.teacherRemarks || '');
    setFormScores(rec.scores || {});
    setShowAddModal(true);
  };

  // Save terminal assessment entry
  const handleSaveRecord = () => {
    if (!formStudentId) {
      showToast('Please select a student.');
      return;
    }

    const st = students.find((s) => s.id === formStudentId);
    const studentName = st ? st.name : 'Unknown Student';
    const rollNumber = st ? st.rollNumber : 'ST-000';

    // Calculate overall average
    const scoreItems = Object.values(formScores) as Array<{ classScore?: number; examScore?: number; totalScore?: number }>;
    const totals = scoreItems.map((s) => s.totalScore ?? ((s.classScore || 0) + (s.examScore || 0)));
    const avg = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;

    const newRec: JHSTerminalRecord = {
      id: editingRecord ? editingRecord.id : `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      studentId: formStudentId,
      studentName,
      rollNumber,
      className: formClass,
      academicYear: formAcademicYear,
      term: formTerm,
      scores: formScores,
      overallAverage: Math.round(avg * 10) / 10,
      teacherRemarks: formTeacherRemarks,
      updatedAt: new Date().toISOString()
    };

    setTerminalRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === newRec.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = newRec;
        return copy;
      }
      return [newRec, ...prev];
    });

    setShowAddModal(false);
    showToast(`Terminal Examination record saved for ${studentName}!`);
  };

  // Delete record
  const handleDeleteRecord = (id: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to remove the terminal history record for ${studentName}?`)) {
      setTerminalRecords((prev) => prev.filter((r) => r.id !== id));
      showToast(`Record for ${studentName} removed from history archive.`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className={showMasterSheetModal ? 'no-print' : ''}>
        {/* TOAST BANNER */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-amber-300 px-5 py-3 rounded-xl shadow-2xl border-2 border-amber-400 font-extrabold text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* DASHBOARD HEADER BANNER */}
      <div className="bg-gradient-to-r from-slate-950 via-mauve-950 to-blue-950 text-white rounded-2xl p-6 sm:p-8 shadow-2xl border-2 border-amber-500/30 relative overflow-hidden no-print">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400 text-slate-950 font-black text-xs uppercase rounded-full tracking-wider shadow-md">
              <History className="w-4 h-4 text-slate-950" />
              <span>Dedicated Admin Archive Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-amber-300">
              JHS Assessment History Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
              Archival tracking, historical retrieval, and A4 result slip issuance for Junior High School Terminal Examination Assessments. Focused starting from <strong className="text-amber-200">Term 3 of 2025/2026 Academic Year</strong> onwards and previous sessions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-xl border-2 border-amber-500 shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Record Terminal Entry</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMasterSheetModal(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs uppercase rounded-xl border border-blue-400 shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-amber-300" />
              <span>Print Master Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs uppercase rounded-xl border border-slate-600 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Print Broadsheet / Records</span>
            </button>
          </div>
        </div>

        {/* METRICS METERS BAR */}
        <div className="mt-6 pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Archived Records</span>
            <span className="text-lg font-black font-mono text-amber-400 mt-0.5 block">{filteredRecords.length} Pupils</span>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Focus Session</span>
            <span className="text-xs font-black text-blue-300 mt-1 block">{selectedAcademicYear} • {selectedTerm}</span>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Level Scope</span>
            <span className="text-xs font-black text-emerald-400 mt-1 block">
              {selectedClassLevel === 'ALL_JHS' ? 'All JHS Classes (1 - 3 & Alumni)' : selectedClassLevel}
            </span>
          </div>
          <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Terminal Benchmark</span>
            <span className="text-xs font-black text-amber-300 mt-1 block">30% Class + 70% Exam</span>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-md space-y-4 no-print">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-amber-700" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
              Terminal Assessment Search & Filter Controls
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-bold">
            Showing {filteredRecords.length} matching assessment records
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Academic Year Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-700" />
              <span>Academic Year:</span>
            </label>
            <select
              value={selectedAcademicYear}
              onChange={(e) => setSelectedAcademicYear(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border-2 border-slate-300 font-black text-slate-900 bg-white focus:border-amber-500 outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL_YEARS">-- All Academic Years --</option>
              {JHS_ACADEMIC_YEARS.map((yr) => (
                <option key={yr} value={yr}>
                  {yr} {yr === '2025/2026' ? '(Present Year • Term 3)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Term Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-violet-700" />
              <span>Academic Term:</span>
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border-2 border-slate-300 font-black text-slate-900 bg-white focus:border-amber-500 outline-none shadow-2xs cursor-pointer"
            >
              <option value="Term 3">Term 3 (Terminal Exam Assessment)</option>
              <option value="Term 2">Term 2</option>
              <option value="Term 1">Term 1</option>
              <option value="ALL_TERMS">-- All Terms --</option>
            </select>
          </div>

          {/* JHS Class Level Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
              <span>JHS Division Class:</span>
            </label>
            <select
              value={selectedClassLevel}
              onChange={(e) => setSelectedClassLevel(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border-2 border-slate-300 font-black text-slate-900 bg-white focus:border-amber-500 outline-none shadow-2xs cursor-pointer"
            >
              <option value="ALL_JHS">-- All JHS Division Classes & Alumni --</option>
              <option value="JHS 1">JHS 1</option>
              <option value="JHS 2">JHS 2</option>
              <option value="JHS 3">JHS 3</option>
              <option value="GRADUATED">Graduated JHS Alumni (Old Pupils)</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="space-y-1">
            <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-amber-700" />
              <span>Search Pupil Name / Roll No:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="e.g. Kwame Mensah or ST101..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs py-2.5 pl-3 pr-8 rounded-xl border-2 border-slate-300 font-bold text-slate-900 bg-white focus:border-amber-500 outline-none shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* HISTORICAL TERMINAL RECORDS TABLE */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-slate-950 text-white p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h2 className="font-extrabold text-sm uppercase tracking-wider text-white">
              JHS Assessment History Records
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowMasterSheetModal(true)}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-lg shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-950" />
              <span>Print Terminal Master Sheet</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-200 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>Academic Year: {selectedAcademicYear}</span>
              <span>•</span>
              <span>Term: {selectedTerm}</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 text-[11px] uppercase font-black tracking-wider border-b border-slate-300">
                <th className="py-3 px-3.5 border-r border-slate-300 text-center w-12">#</th>
                <th className="py-3 px-4 border-r border-slate-300">PUPIL NAME & ROLL NO</th>
                <th className="py-3 px-3.5 border-r border-slate-300 text-center w-28">ACADEMIC YEAR</th>
                <th className="py-3 px-3.5 border-r border-slate-300 text-center w-28">TERM</th>
                <th className="py-3 px-3.5 border-r border-slate-300 text-center w-28">CLASS</th>
                <th className="py-3 px-3.5 border-r border-slate-300 text-center w-32">TERMINAL AVG</th>
                <th className="py-3 px-4 text-center w-48">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic font-medium">
                    No historical terminal assessment records found matching your active filter criteria. Use the "Record Terminal Entry" button to log new historical records or select a different Academic Year/Term.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, idx) => {
                  const hasScores = rec.scores && Object.keys(rec.scores).some((k) => {
                    const s = rec.scores[k];
                    return s && (s.classScore !== undefined || s.examScore !== undefined || s.totalScore !== undefined);
                  });
                  const avg = rec.overallAverage;

                  return (
                    <tr key={rec.id} className="hover:bg-amber-50/50 transition">
                      <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-500 border-r border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="font-black text-slate-950 text-sm">{rec.studentName}</div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>Roll / Index: {rec.rollNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center border-r border-slate-200 font-black font-mono text-slate-800">
                        <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-950 border border-blue-200 rounded-md">
                          {rec.academicYear}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center border-r border-slate-200 font-bold text-slate-800">
                        <span className="inline-block px-2.5 py-1 bg-violet-50 text-violet-950 border border-violet-200 rounded-md">
                          {rec.term}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center border-r border-slate-200 font-black text-slate-900">
                        {rec.className}
                      </td>
                      <td className="py-3 px-3.5 text-center border-r border-slate-200 font-mono font-black text-slate-900">
                        {hasScores && avg !== undefined && avg !== null ? (
                          <span className={`inline-block px-2.5 py-1 rounded-md ${avg >= 70 ? 'bg-emerald-100 text-emerald-950 font-extrabold' : avg >= 50 ? 'bg-blue-100 text-blue-950' : 'bg-rose-100 text-rose-950'}`}>
                            {avg.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-500 font-bold text-[10px] rounded border border-slate-300 italic">
                            No Marks Entered
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPrintingRecord(rec)}
                            className="px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] rounded-lg border border-amber-500 shadow-xs transition inline-flex items-center gap-1 cursor-pointer"
                            title="Print Official Terminal Result Slip"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-950" />
                            <span>Slip</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(rec)}
                            className="px-2 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-950 font-bold text-[11px] rounded-lg border border-blue-300 transition inline-flex items-center cursor-pointer"
                            title="Edit Record"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-900" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(rec.id, rec.studentName)}
                            className="px-2 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-950 font-bold text-[11px] rounded-lg border border-rose-300 transition inline-flex items-center cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-800" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT TERMINAL RECORD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full border-2 border-amber-500 shadow-2xl overflow-hidden my-8 animate-scaleUp">
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  {editingRecord ? `Edit Terminal Record: ${editingRecord.studentName}` : 'Record New JHS Terminal Exam Entry'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto text-slate-900">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-800">Select Student:</label>
                  <select
                    value={formStudentId}
                    onChange={(e) => {
                      setFormStudentId(e.target.value);
                      const st = students.find((s) => s.id === e.target.value);
                      if (st?.className) setFormClass(st.className);
                    }}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    {jhsStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.rollNumber}) - {st.className}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-800">JHS Class Level:</label>
                  <select
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="JHS 1">JHS 1</option>
                    <option value="JHS 2">JHS 2</option>
                    <option value="JHS 3">JHS 3</option>
                    <option value="GRADUATED JHS">Graduated JHS Alumni</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-800">Academic Year:</label>
                  <select
                    value={formAcademicYear}
                    onChange={(e) => setFormAcademicYear(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    {JHS_ACADEMIC_YEARS.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-800">Academic Term:</label>
                  <select
                    value={formTerm}
                    onChange={(e) => setFormTerm(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-bold bg-white"
                  >
                    <option value="Term 3">Term 3 (Terminal Examination)</option>
                    <option value="Term 2">Term 2</option>
                    <option value="Term 1">Term 1</option>
                  </select>
                </div>
              </div>

              {/* Subject Score Entry */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-xs font-black uppercase text-slate-800 block">
                  Subject Marks Entry (Class 50% + Exam 50% = Total 100%):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {jhsSubjects.map((sub) => {
                    const currentObj = formScores[sub.id] || {};
                    const classSc = currentObj.classScore ?? '';
                    const examSc = currentObj.examScore ?? '';
                    const totalSc = (Number(classSc) || 0) + (Number(examSc) || 0);

                    return (
                      <div key={sub.id} className="p-2 bg-white rounded-lg border border-slate-200 space-y-1 text-xs">
                        <span className="font-extrabold text-slate-900 block truncate">{sub.name}</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            placeholder="Class /50"
                            value={classSc}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Math.min(50, Math.max(0, Number(e.target.value)));
                              setFormScores((prev) => ({
                                ...prev,
                                [sub.id]: {
                                  ...prev[sub.id],
                                  classScore: val,
                                  totalScore: (val || 0) + (prev[sub.id]?.examScore || 0)
                                }
                              }));
                            }}
                            className="w-20 p-1 border rounded font-mono font-bold text-center text-xs"
                          />
                          <input
                            type="number"
                            min="0"
                            max="50"
                            placeholder="Exam /50"
                            value={examSc}
                            onChange={(e) => {
                              const val = e.target.value === '' ? undefined : Math.min(50, Math.max(0, Number(e.target.value)));
                              setFormScores((prev) => ({
                                ...prev,
                                [sub.id]: {
                                  ...prev[sub.id],
                                  examScore: val,
                                  totalScore: (prev[sub.id]?.classScore || 0) + (val || 0)
                                }
                              }));
                            }}
                            className="w-20 p-1 border rounded font-mono font-bold text-center text-xs"
                          />
                          <span className="font-black font-mono text-slate-900 ml-auto text-xs">
                            ={totalSc}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Headmaster / Teacher Remarks */}
              <div className="pt-2 border-t border-slate-200">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-800">Headmaster / Teacher Remarks:</label>
                  <input
                    type="text"
                    value={formTeacherRemarks}
                    onChange={(e) => setFormTeacherRemarks(e.target.value)}
                    placeholder="e.g. Excellent terminal effort..."
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRecord}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-xl border border-amber-500 shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4 text-slate-950" />
                <span>Save Terminal Record</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE TERMINAL ASSESSMENT RESULT SLIP MODAL */}
      {printingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full border-2 border-amber-500 shadow-2xl overflow-hidden animate-scaleUp my-4 text-slate-900">
            {/* Modal Top Bar */}
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800 no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  JHS Terminal Result Slip Print Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print A4 Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintingRecord(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE A4 SHEET CONTENT */}
            <div id="jhs-terminal-print-slip" className="p-6 sm:p-8 space-y-6 bg-white font-sans text-slate-900">
              {/* School Header */}
              <div className="text-center border-b-2 border-slate-950 pb-4 space-y-1">
                <div className="text-xs uppercase font-extrabold tracking-widest text-blue-900">
                  {config?.schoolName || 'EASTFIELD ACADEMY'} • JHS DIVISION
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight">
                  OFFICIAL JHS TERMINAL ASSESSMENT REPORT SLIP
                </h1>
                <p className="text-xs text-slate-600 font-bold">
                  Accredited Junior High School Academic Statement ({printingRecord.term} • Academic Year {printingRecord.academicYear})
                </p>
                <div className="inline-block px-3 py-0.5 bg-amber-100 text-amber-950 text-[10px] font-black uppercase rounded border border-amber-300 mt-1">
                  OFFICIAL ARCHIVED TERMINAL EXAMINATION RECORD
                </div>
              </div>

              {/* Pupil Info Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-300 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">PUPIL NAME</span>
                  <span className="font-black text-slate-950 text-sm">{printingRecord.studentName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">ROLL / INDEX NO</span>
                  <span className="font-black font-mono text-slate-950 text-sm">{printingRecord.rollNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">ACADEMIC SESSION</span>
                  <span className="font-black text-blue-900">{printingRecord.academicYear} • {printingRecord.term}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase block">CLASS LEVEL</span>
                  <span className="font-black text-slate-950">{printingRecord.className}</span>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="border border-slate-300 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-white font-black uppercase text-[10px] tracking-wider">
                      <th className="p-2.5 border-r border-slate-800 w-10 text-center">#</th>
                      <th className="p-2.5 border-r border-slate-800">SUBJECT</th>
                      <th className="p-2.5 border-r border-slate-800 text-center w-20">CLASS (50)</th>
                      <th className="p-2.5 border-r border-slate-800 text-center w-20">EXAM (50)</th>
                      <th className="p-2.5 border-r border-slate-800 text-center w-24">TOTAL (100)</th>
                      <th className="p-2.5 border-r border-slate-800 text-center w-20">GRADE</th>
                      <th className="p-2.5 text-center w-32">REMARK</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-900">
                    {jhsSubjects.map((sub, idx) => {
                      const scObj = printingRecord.scores[sub.id] || printingRecord.scores[sub.code] || printingRecord.scores[sub.name] || {};
                      const classSc = scObj.classScore ?? '-';
                      const examSc = scObj.examScore ?? '-';
                      const totalSc = scObj.totalScore ?? (typeof classSc === 'number' || typeof examSc === 'number' ? (Number(classSc) || 0) + (Number(examSc) || 0) : null);
                      const gesMeta = totalSc !== null ? calculateGESGrade(totalSc) : null;

                      return (
                        <tr key={sub.id}>
                          <td className="p-2 text-center border-r border-slate-200 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-200 font-bold text-slate-900">{sub.name}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-700">{classSc}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-700">{examSc}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono font-black text-slate-950">
                            {totalSc !== null ? totalSc : '-'}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono font-black">
                            {gesMeta ? (
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${gesMeta.badgeColor}`}>
                                Grade {gesMeta.grade}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="p-2 text-center text-[10px] font-bold text-slate-800">
                            {gesMeta ? gesMeta.remark : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Terminal Summary Box */}
              <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-300 text-xs text-center">
                <span className="font-extrabold uppercase text-[10px] text-amber-900 block tracking-wider">TERMINAL OVERALL AVERAGE</span>
                <span className="text-xl font-black font-mono text-slate-950 mt-0.5 block">
                  {printingRecord.overallAverage !== undefined && printingRecord.overallAverage !== null && Object.keys(printingRecord.scores || {}).length > 0 ? (
                    `${printingRecord.overallAverage.toFixed(1)}% Marks`
                  ) : (
                    <span className="text-slate-500 font-sans text-xs italic font-bold">No Marks Entered</span>
                  )}
                </span>
              </div>

              {/* Headmaster Remarks */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-black uppercase text-[10px] text-slate-500 block">HEADMASTER / TEACHER REMARKS</span>
                <p className="font-bold text-slate-900 italic">
                  "{printingRecord.teacherRemarks || 'Satisfactory academic progress demonstrated across subjects.'}"
                </p>
              </div>

              {/* Signatures */}
              <div className="pt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs">
                <div className="space-y-1">
                  <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-center pb-1 font-serif italic text-slate-700">
                    {(config as any)?.headmasterSignature || 'Headmaster Sign & Stamp'}
                  </div>
                  <p className="text-[10px] font-black uppercase text-center text-slate-600">Headmaster / Principal Signature</p>
                </div>
                <div className="space-y-1">
                  <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-center pb-1 text-slate-800 font-mono font-bold">
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <p className="text-[10px] font-black uppercase text-center text-slate-600">Date Issued & Official Stamp</p>
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => setPrintingRecord(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-6 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-xl border border-amber-500 shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                <span>Print Official Result Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* PRINTABLE TERMINAL ASSESSMENT MASTER SHEET MODAL */}
      {showMasterSheetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:bg-transparent print:p-0 print:overflow-visible">
          <style>{`
            @media print {
              @page {
                size: A4 landscape !important;
                margin: 3mm !important;
              }
              html, body {
                width: 100% !important;
                height: auto !important;
                overflow: visible !important;
                background: #ffffff !important;
              }
              body > *:not(#root) {
                display: none !important;
              }
              header, nav, aside, .no-print {
                display: none !important;
              }
              #jhs-terminal-master-sheet {
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              #jhs-terminal-master-sheet table {
                width: 100% !important;
                max-width: 100% !important;
                table-layout: auto !important;
                font-size: 6.5px !important;
              }
              #jhs-terminal-master-sheet th,
              #jhs-terminal-master-sheet td {
                padding: 1px 1px !important;
                font-size: 6.5px !important;
                white-space: nowrap !important;
              }
            }
          `}</style>
          <div className="bg-white rounded-2xl max-w-6xl w-full border-2 border-amber-500 shadow-2xl overflow-hidden animate-scaleUp my-4 text-slate-900 print:max-w-none print:w-full print:border-none print:shadow-none print:my-0 print:rounded-none print:overflow-visible">
            {/* Modal Top Bar (no-print) */}
            <div className="bg-slate-950 text-white p-4 flex items-center justify-between border-b border-slate-800 no-print">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  JHS Terminal Master Sheet Broadsheet
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-lg shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Master Sheet (A4 Landscape)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMasterSheetModal(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Filter Selectors Bar inside Modal (no-print) */}
            <div className="bg-slate-100 p-3 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs no-print">
              <div>
                <label className="font-bold text-slate-700 text-[10px] uppercase block mb-0.5">Academic Year:</label>
                <select
                  value={selectedAcademicYear}
                  onChange={(e) => setSelectedAcademicYear(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-lg border border-slate-300 font-extrabold text-slate-900 bg-white"
                >
                  <option value="ALL_YEARS">-- All Academic Years --</option>
                  {JHS_ACADEMIC_YEARS.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr} {yr === '2025/2026' ? '(Present Year • Term 3)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 text-[10px] uppercase block mb-0.5">Academic Term:</label>
                <select
                  value={selectedTerm}
                  onChange={(e) => setSelectedTerm(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-lg border border-slate-300 font-extrabold text-slate-900 bg-white"
                >
                  <option value="Term 3">Term 3 (Terminal Exam Assessment)</option>
                  <option value="Term 2">Term 2</option>
                  <option value="Term 1">Term 1</option>
                  <option value="ALL_TERMS">-- All Terms --</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 text-[10px] uppercase block mb-0.5">JHS Division Class:</label>
                <select
                  value={selectedClassLevel}
                  onChange={(e) => setSelectedClassLevel(e.target.value)}
                  className="w-full text-xs p-1.5 rounded-lg border border-slate-300 font-extrabold text-slate-900 bg-white"
                >
                  <option value="ALL_JHS">-- All JHS Division Classes --</option>
                  <option value="JHS 1">JHS 1</option>
                  <option value="JHS 2">JHS 2</option>
                  <option value="JHS 3">JHS 3</option>
                  <option value="GRADUATED">Graduated JHS Alumni</option>
                </select>
              </div>
            </div>

            {/* PRINTABLE BROAD SHEET CONTAINER */}
            <div id="jhs-terminal-master-sheet" className="printable-noticeboard p-6 space-y-4 bg-white font-sans text-slate-900 max-h-[75vh] overflow-auto print:max-h-none print:overflow-visible print:p-0 print:w-full">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-900 pb-2 space-y-0.5">
                <div className="text-xs uppercase font-extrabold tracking-widest text-blue-900 print:text-[8px]">
                  {config?.schoolName || 'EASTFIELD ACADEMY'} • JHS ACADEMIC DIVISION
                </div>
                <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight print:text-[11px]">
                  JHS TERMINAL ASSESSMENT MASTER SHEET BROAD SHEET
                </h1>
                <div className="text-xs font-black text-slate-800 flex items-center justify-center gap-3 flex-wrap print:text-[8px]">
                  <span>ACADEMIC YEAR: <strong className="text-blue-900">{selectedAcademicYear}</strong></span>
                  <span>•</span>
                  <span>TERM: <strong className="text-violet-900">{selectedTerm}</strong></span>
                  <span>•</span>
                  <span>CLASS SCOPE: <strong className="text-emerald-900">{selectedClassLevel === 'ALL_JHS' ? 'All JHS Classes' : selectedClassLevel}</strong></span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono print:text-[6.5px]">
                  Official School Assessment Archive Broadsheet • Date Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} • [Scores: CLS = Class Assessment (50%), EXM = Exam (50%), TOT = Total (100%)]
                </div>
              </div>

              {/* Master Sheet Broadsheet Table */}
              <div className="overflow-x-auto border border-slate-900 rounded-lg print:border-none print:overflow-visible print:w-full print:max-w-none">
                <table className="w-full text-left text-xs border-collapse print:text-[6.5px] print:w-full print:max-w-full">
                  <thead>
                    <tr className="bg-blue-900 text-white font-black uppercase text-[10px] tracking-wider print:text-[6.5px]">
                      <th rowSpan={2} className="p-1 border-r border-blue-800 text-center w-5 print:text-[6.5px] print:p-0.5">#</th>
                      <th rowSpan={2} className="p-1 border-r border-blue-800 min-w-[100px] max-w-[150px] print:text-[6.5px] print:p-0.5 print:min-w-[80px] whitespace-nowrap">PUPIL NAME</th>
                      {jhsSubjects.map((sub) => {
                        const subCode = sub.code?.trim() || (
                          sub.name.toUpperCase().includes('ENGLISH') ? 'ENG' :
                          sub.name.toUpperCase().includes('MATH') ? 'MAT' :
                          sub.name.toUpperCase().includes('SCIENCE') ? 'SCI' :
                          sub.name.toUpperCase().includes('SOCIAL') ? 'SOC' :
                          sub.name.toUpperCase().includes('RELIGIOUS') || sub.name.toUpperCase().includes('RME') ? 'RME' :
                          sub.name.toUpperCase().includes('COMPUTING') || sub.name.toUpperCase().includes('ICT') ? 'COMP' :
                          sub.name.toUpperCase().includes('FRENCH') ? 'FRE' :
                          sub.name.toUpperCase().includes('CAREER') || sub.name.toUpperCase().includes('TECH') ? 'CAR' :
                          sub.name.toUpperCase().includes('CREATIVE') || sub.name.toUpperCase().includes('ARTS') || sub.name.toUpperCase().includes('CAD') ? 'CAD' :
                          sub.name.toUpperCase().includes('TWI') || sub.name.toUpperCase().includes('AKUAPEM') || sub.name.toUpperCase().includes('GHANAIAN') ? 'TWI' :
                          sub.name.substring(0, 5).toUpperCase()
                        );
                        return (
                          <th key={sub.id} colSpan={3} className="p-1 border-r border-blue-800 text-center print:p-0.5">
                            <div className="font-extrabold text-white text-[9px] print:text-[6.5px] leading-none uppercase tracking-tighter">{subCode}</div>
                          </th>
                        );
                      })}
                    </tr>
                    <tr className="bg-blue-950 text-blue-100 font-bold uppercase text-[8px] leading-none print:text-[6px]">
                      {jhsSubjects.map((sub) => (
                        <React.Fragment key={`hdr-cols-${sub.id}`}>
                          <th className="p-0.5 border-r border-blue-800 text-center bg-blue-950 text-blue-100 print:text-[6px] print:p-0.25">CLS</th>
                          <th className="p-0.5 border-r border-blue-800 text-center bg-blue-950 text-blue-100 print:text-[6px] print:p-0.25">EXM</th>
                          <th className="p-0.5 border-r border-blue-800 text-center bg-blue-900 text-amber-300 font-extrabold print:text-[6px] print:p-0.25">TOT</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-medium text-slate-900">
                    {filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={2 + jhsSubjects.length * 3} className="p-8 text-center text-slate-500 italic print:p-4 print:text-[7px]">
                          No assessment records match the selected Year, Term, and Class filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((rec, idx) => {
                        const formattedStudentName = rec.studentName ? rec.studentName.replace(/\s+/g, ' ') : '';
                        return (
                          <tr key={rec.id} className="hover:bg-amber-50/40">
                            <td className="p-1 text-center border-r border-slate-300 font-mono text-slate-600 print:text-[6.5px] print:p-0.5">{idx + 1}</td>
                            <td className="p-1 border-r border-slate-300 font-bold text-slate-950 print:text-[6.5px] print:p-0.5 whitespace-nowrap overflow-hidden">
                              <span className="inline-block whitespace-nowrap">{formattedStudentName}</span>
                            </td>
                            {jhsSubjects.map((sub) => {
                              const scObj = rec.scores?.[sub.id] || rec.scores?.[sub.code] || rec.scores?.[sub.name] || {};
                              const classSc = scObj.classScore !== undefined && scObj.classScore !== null ? scObj.classScore : null;
                              const examSc = scObj.examScore !== undefined && scObj.examScore !== null ? scObj.examScore : null;
                              const totalSc = scObj.totalScore ?? (classSc !== null || examSc !== null ? (classSc || 0) + (examSc || 0) : null);

                              return (
                                <React.Fragment key={`cell-${sub.id}`}>
                                  <td className="p-0.5 border-r border-slate-300 text-center font-mono text-slate-700 print:text-[6.5px] print:p-0.25">
                                    {classSc !== null ? classSc : <span className="text-slate-400 italic text-[6px]">-</span>}
                                  </td>
                                  <td className="p-0.5 border-r border-slate-300 text-center font-mono text-slate-700 print:text-[6.5px] print:p-0.25">
                                    {examSc !== null ? examSc : <span className="text-slate-400 italic text-[6px]">-</span>}
                                  </td>
                                  <td className="p-0.5 border-r border-slate-300 text-center font-mono font-black text-slate-950 bg-slate-50/50 print:text-[6.5px] print:p-0.25">
                                    {totalSc !== null ? totalSc : <span className="text-slate-400 italic text-[6px]">-</span>}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Master Sheet Summary Footer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-100 p-3 rounded-lg border border-slate-300 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-600 block">TOTAL PUPILS</span>
                  <span className="font-extrabold text-slate-950">{filteredRecords.length} Pupils</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-600 block">RECORDED EXAM MARKS</span>
                  <span className="font-extrabold text-blue-900">
                    {filteredRecords.filter((r) => Object.keys(r.scores || {}).length > 0).length} Pupils
                  </span>
                </div>
              </div>

              {/* Signatures & Approvals */}
              <div className="pt-4 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs">
                <div className="space-y-1">
                  <div className="h-8 border-b border-dashed border-slate-400 flex items-end justify-center pb-0.5 italic text-slate-700">
                    {(config as any)?.headmasterSignature || 'Headmaster Sign & Stamp'}
                  </div>
                  <p className="text-[10px] font-black uppercase text-center text-slate-600">Headmaster / Principal Approval Signature</p>
                </div>
                <div className="space-y-1">
                  <div className="h-8 border-b border-dashed border-slate-400 flex items-end justify-center pb-0.5 text-slate-800 font-mono font-bold">
                    {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <p className="text-[10px] font-black uppercase text-center text-slate-600">Date Verified & School Seal</p>
                </div>
              </div>
            </div>

            {/* Bottom Modal Actions (no-print) */}
            <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => setShowMasterSheetModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-6 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase rounded-xl border border-amber-500 shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-950" />
                <span>Print Master Sheet</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
