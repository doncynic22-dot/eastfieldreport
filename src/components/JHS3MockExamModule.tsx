/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Student, Subject, User, ReportConfig } from '../types';
import {
  JHSMockExamRecord,
  getStoredJHSMockRecords,
  saveStoredJHSMockRecords,
  calculateBECEGrade,
  getBECEGradeMeta,
  computeBECECalculations,
  getCoreSubjectType
} from '../utils/jhsMockUtils';
import { fetchSupabaseJHSMockExams } from '../lib/supabase';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Printer,
  Save,
  Search,
  Users,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  FileSpreadsheet,
  Layers,
  ArrowUpDown,
  X,
  AlertCircle,
  BarChart3,
  ShieldCheck,
  Check,
  Lock
} from 'lucide-react';
import { matchesSubject } from '../utils/subjectUtils';

interface JHS3MockExamModuleProps {
  students: Student[];
  subjects: Subject[];
  currentUser: User | null;
  isAdminAuthenticated: boolean;
  config: ReportConfig;
}

export default function JHS3MockExamModule({
  students,
  subjects,
  currentUser,
  isAdminAuthenticated,
  config
}: JHS3MockExamModuleProps) {
  // Master Mock Records State
  const [mockRecords, setMockRecords] = useState<JHSMockExamRecord[]>(() => getStoredJHSMockRecords());
  const [toastMessage, setToastMessage] = useState('');

  // Selected Exam Session
  const [selectedExamTitle, setSelectedExamTitle] = useState('Mock Examination 1');
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('2025/2026');

  // Mode: 'broadsheet' (Admin/All view) or 'teacher-entry' (Subject entry)
  const [viewMode, setViewMode] = useState<'broadsheet' | 'teacher-entry'>(
    isAdminAuthenticated ? 'broadsheet' : 'teacher-entry'
  );

  // Filter JHS 3 Students specifically
  const jhs3Students = useMemo(() => {
    return students.filter((s) => {
      if (!s.className) return false;
      const cls = s.className.trim().toUpperCase();
      return cls === 'JHS 3' || cls === 'JHS3' || cls === 'JUNIOR HIGH SCHOOL 3';
    });
  }, [students]);

  // Filter JHS Subjects
  const jhsSubjects = useMemo(() => {
    return subjects.filter((sub) => sub.level === 'JHS' || !sub.level);
  }, [subjects]);

  // Filter allowed JHS subjects for the logged-in teacher to avoid wrong subject entries
  const allowedJHSSubjects = useMemo(() => {
    if (isAdminAuthenticated || currentUser?.role === 'ADMIN' || (currentUser?.level as string) === 'ALL') {
      return jhsSubjects;
    }
    if (currentUser?.subjects && currentUser.subjects.length > 0) {
      const filtered = jhsSubjects.filter((sub) =>
        currentUser.subjects?.some((sRef) => matchesSubject(sRef, sub))
      );
      if (filtered.length > 0) return filtered;
    }
    return jhsSubjects;
  }, [jhsSubjects, currentUser, isAdminAuthenticated]);

  // Teacher Subject Entry State
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    const defaultSub = allowedJHSSubjects.find((s) => s.code === 'ENG' || s.id === 'sub-j-eng');
    return defaultSub ? defaultSub.id : allowedJHSSubjects[0]?.id || jhsSubjects[0]?.id || '';
  });

  // Ensure selectedSubjectId is valid within allowedJHSSubjects
  useEffect(() => {
    if (allowedJHSSubjects.length > 0) {
      const isValid = allowedJHSSubjects.some(
        (s) => s.id === selectedSubjectId || s.code === selectedSubjectId || matchesSubject(selectedSubjectId, s)
      );
      if (!isValid && allowedJHSSubjects[0]) {
        setSelectedSubjectId(allowedJHSSubjects[0].id);
      }
    }
  }, [allowedJHSSubjects, selectedSubjectId]);

  const [teacherScoresMap, setTeacherScoresMap] = useState<{ [studentId: string]: number | '' }>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Single Student Modal State
  const [editingStudentRecord, setEditingStudentRecord] = useState<JHSMockExamRecord | null>(null);
  const [editStudentScores, setEditStudentScores] = useState<{ [subjectKey: string]: number | '' }>({});
  const [editRemarks, setEditRemarks] = useState('');

  // Sync effect across tabs and fetch from Supabase
  useEffect(() => {
    const handleSync = () => {
      setMockRecords(getStoredJHSMockRecords());
    };
    window.addEventListener('ea_jhs_mock_updated', handleSync);

    // Initial and focus fetch from Supabase
    fetchSupabaseJHSMockExams().then((remoteData) => {
      if (remoteData && remoteData.length > 0) {
        setMockRecords(remoteData);
      }
    });

    return () => window.removeEventListener('ea_jhs_mock_updated', handleSync);
  }, []);

  // Text-only notification helper
  const showTextNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Populate teacher scores table whenever subject or exam session changes
  useEffect(() => {
    if (!selectedSubjectId) return;

    const currentSub = jhsSubjects.find((s) => s.id === selectedSubjectId || s.code === selectedSubjectId);
    const subKey = currentSub ? currentSub.id : selectedSubjectId;

    const initialMap: { [studentId: string]: number | '' } = {};

    jhs3Students.forEach((st) => {
      const existingRecord = mockRecords.find(
        (r) => r.studentId === st.id && r.examTitle === selectedExamTitle
      );
      if (existingRecord && existingRecord.scores) {
        let val = existingRecord.scores[subKey];
        if (val === undefined && currentSub) val = existingRecord.scores[currentSub.code];
        if (val === undefined && currentSub) val = existingRecord.scores[currentSub.name];
        if (val !== undefined && val !== null && val !== '') {
          initialMap[st.id] = Number(val);
        } else {
          initialMap[st.id] = '';
        }
      } else {
        initialMap[st.id] = '';
      }
    });

    setTeacherScoresMap(initialMap);
  }, [selectedSubjectId, selectedExamTitle, jhs3Students, mockRecords, jhsSubjects]);

  // Handle Save Teacher Subject Entry
  const handleSaveTeacherSubjectScores = () => {
    const currentSub = jhsSubjects.find((s) => s.id === selectedSubjectId || s.code === selectedSubjectId);
    const subKey = currentSub ? currentSub.id : selectedSubjectId;
    const subName = currentSub ? currentSub.name : 'Selected Subject';

    let updatedCount = 0;
    // Get fresh latest records from storage to prevent overwriting parallel entries
    const latestRecords = getStoredJHSMockRecords();
    const nextRecords = [...latestRecords];

    jhs3Students.forEach((st) => {
      const val = teacherScoresMap[st.id];
      if (val !== undefined && val !== '') {
        const scoreNum = Math.min(100, Math.max(0, Number(val)));

        let recordIndex = nextRecords.findIndex(
          (r) => r.studentId === st.id && r.examTitle === selectedExamTitle
        );

        if (recordIndex >= 0) {
          nextRecords[recordIndex] = {
            ...nextRecords[recordIndex],
            scores: {
              ...nextRecords[recordIndex].scores,
              [subKey]: scoreNum
            },
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.name || 'Subject Teacher'
          };
        } else {
          const cleanExamTitle = selectedExamTitle.replace(/\s+/g, '_');
          nextRecords.push({
            id: `mock_${st.id}_${cleanExamTitle}`,
            studentId: st.id,
            studentName: st.name,
            rollNumber: st.rollNumber,
            className: st.className || 'JHS 3',
            examTitle: selectedExamTitle,
            academicYear: selectedAcademicYear,
            scores: {
              [subKey]: scoreNum
            },
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.name || 'Subject Teacher'
          });
        }
        updatedCount++;
      }
    });

    saveStoredJHSMockRecords(nextRecords);
    setMockRecords(nextRecords);
    showTextNotification(`Submitted JHS 3 Mock Exam marks for ${subName} (${updatedCount} pupils)`);
  };

  // Open Edit Modal for a student record
  const handleOpenEditModal = (st: Student) => {
    const existing = mockRecords.find((r) => r.studentId === st.id && r.examTitle === selectedExamTitle);
    const existingScores = existing ? { ...existing.scores } : {};

    const initialEditMap: { [subjectKey: string]: number | '' } = {};
    jhsSubjects.forEach((sub) => {
      let val = existingScores[sub.id];
      if (val === undefined) val = existingScores[sub.code];
      if (val === undefined) val = existingScores[sub.name];
      initialEditMap[sub.id] = val !== undefined && val !== null ? val : '';
    });

    const cleanExamTitle = selectedExamTitle.replace(/\s+/g, '_');
    setEditingStudentRecord(
      existing || {
        id: `mock_${st.id}_${cleanExamTitle}`,
        studentId: st.id,
        studentName: st.name,
        rollNumber: st.rollNumber,
        className: st.className || 'JHS 3',
        examTitle: selectedExamTitle,
        academicYear: selectedAcademicYear,
        scores: {},
        updatedAt: new Date().toISOString()
      }
    );
    setEditStudentScores(initialEditMap);
    setEditRemarks(existing?.remarks || '');
  };

  // Save Edit Student Scores
  const handleSaveStudentEdit = () => {
    if (!editingStudentRecord) return;

    const cleanedScores: { [key: string]: number } = {};
    Object.keys(editStudentScores).forEach((k) => {
      const val = editStudentScores[k];
      if (val !== '' && val !== undefined && !isNaN(Number(val))) {
        cleanedScores[k] = Math.min(100, Math.max(0, Number(val)));
      }
    });

    const latestRecords = getStoredJHSMockRecords();
    const nextRecords = [...latestRecords];
    const idx = nextRecords.findIndex(
      (r) => (r.id && r.id === editingStudentRecord.id) || (r.studentId === editingStudentRecord.studentId && r.examTitle === editingStudentRecord.examTitle)
    );

    const updatedRecord: JHSMockExamRecord = {
      ...editingStudentRecord,
      scores: cleanedScores,
      remarks: editRemarks,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Admin Officer'
    };

    if (idx >= 0) {
      nextRecords[idx] = updatedRecord;
    } else {
      nextRecords.push(updatedRecord);
    }

    saveStoredJHSMockRecords(nextRecords);
    setMockRecords(nextRecords);
    setEditingStudentRecord(null);
    showTextNotification(`Updated mock exam results for ${editingStudentRecord.studentName}`);
  };

  // Broadsheet Ranked Calculation List
  const broadsheetData = useMemo(() => {
    const list = jhs3Students.map((st) => {
      const record = mockRecords.find((r) => r.studentId === st.id && r.examTitle === selectedExamTitle);
      const scores = record ? record.scores : {};
      const calcs = computeBECECalculations(scores, jhsSubjects);

      return {
        student: st,
        record,
        scores,
        calcs
      };
    });

    // Sort by Total Aggregate ASC (1st place has lowest aggregate number, e.g. 6 is better than 12),
    // then by Raw Score DESC (higher raw score is better)
    list.sort((a, b) => {
      if (a.calcs.totalAggregate !== b.calcs.totalAggregate) {
        return a.calcs.totalAggregate - b.calcs.totalAggregate;
      }
      return b.calcs.rawScore - a.calcs.rawScore;
    });

    return list.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }, [jhs3Students, mockRecords, selectedExamTitle, jhsSubjects]);

  // Filtered broadsheet by search
  const filteredBroadsheet = useMemo(() => {
    if (!searchQuery.trim()) return broadsheetData;
    const q = searchQuery.toLowerCase();
    return broadsheetData.filter(
      (b) =>
        b.student.name.toLowerCase().includes(q) ||
        b.student.rollNumber.toLowerCase().includes(q)
    );
  }, [broadsheetData, searchQuery]);

  // Overall Statistics
  const totalCandidates = broadsheetData.length;
  const distinctionsCount = broadsheetData.filter((b) => b.calcs.totalAggregate <= 12).length;
  const creditsCount = broadsheetData.filter((b) => b.calcs.totalAggregate > 12 && b.calcs.totalAggregate <= 24).length;
  const passesCount = broadsheetData.filter((b) => b.calcs.totalAggregate > 24 && b.calcs.totalAggregate <= 36).length;
  const topCandidate = broadsheetData[0];
  const avgRawScore =
    totalCandidates > 0
      ? Math.round(broadsheetData.reduce((sum, b) => sum + b.calcs.rawScore, 0) / totalCandidates)
      : 0;

  // Print Notice Board Broadsheet in Landscape A4
  const handlePrintNoticeBoard = () => {
    let styleEl = document.getElementById('broadsheet-print-page-style') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'broadsheet-print-page-style';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = `
      @page {
        size: A4 landscape !important;
        margin: 6mm !important;
      }
    `;
    window.print();
  };

  // Export Broadsheet to CSV
  const handleExportCSV = () => {
    let csv = `JHS 3 BECE MOCK EXAMINATION MASTER BROADSHEET - ${selectedExamTitle} (${selectedAcademicYear})\n`;
    csv += `School: ${config.schoolName || 'Eastfield Academy'}\n`;
    csv += `Date Exported: ${new Date().toLocaleDateString()}\n\n`;

    const subHeaders = jhsSubjects.map((s) => `${s.code || s.name} Score,${s.code || s.name} Grade`).join(',');
    csv += `Rank,Index/Roll No,Student Name,${subHeaders},Core Aggregate,Best 2 Electives Aggr,Total Aggregate,Raw Total Score,Performance Band\n`;

    broadsheetData.forEach((row) => {
      const subCols = jhsSubjects
        .map((sub) => {
          let scoreVal = row.scores[sub.id];
          if (scoreVal === undefined) scoreVal = row.scores[sub.code];
          if (scoreVal === undefined) scoreVal = row.scores[sub.name];
          if (scoreVal !== undefined && scoreVal !== null) {
            const g = calculateBECEGrade(scoreVal);
            return `${scoreVal},G${g}`;
          }
          return `-,-`;
        })
        .join(',');

      csv += `"${row.rank}","${row.student.rollNumber}","${row.student.name}",${subCols},"${row.calcs.coreAggregate}","${row.calcs.bestTwoElectiveAggregate}","${row.calcs.totalAggregate}","${row.calcs.rawScore}","${row.calcs.performanceBand}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `JHS3_BECE_Mock_Broadsheet_${selectedExamTitle.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showTextNotification('JHS 3 Mock Broadsheet CSV downloaded successfully!');
  };

  return (
    <div className="space-y-6">
      {/* Text-only notification (NO text container background) */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 text-emerald-800 font-black text-sm sm:text-base animate-bounce drop-shadow-md pointer-events-none">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PORTAL HEADER & NAVIGATION BAR (NO-PRINT) */}
      <div className="bg-white rounded-2xl border-2 border-blue-900 shadow-xl overflow-hidden no-print">
        <div className="bg-gradient-to-r from-blue-900 via-blue-950 to-indigo-950 text-white p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b-2 border-amber-400">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-400 text-mauve-950 rounded-2xl shadow-lg border border-amber-300 shrink-0">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 font-black text-[10px] uppercase tracking-wider rounded-md border border-amber-400/40">
                  OFFICIAL JHS 3 mock exam PORTAL
                </span>
                <span className="px-2.5 py-0.5 bg-red-500/25 text-red-300 font-extrabold text-[10px] rounded-md border border-red-400/40">
                  {jhs3Students.length} Candidates Enrolled
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-1">
                JHS 3 Mock Examination Result Portal
              </h1>
              <p className="text-xs text-blue-200 mt-0.5">
                BECE Assessment BroadSheet, Subject Mark Entry & Master Notice Board Sheet
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* View Mode Switcher */}
            <div className="bg-blue-950/80 p-1 rounded-xl border border-blue-700/60 flex items-center gap-1 w-full sm:w-auto">
              <button
                onClick={() => setViewMode('broadsheet')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'broadsheet'
                    ? 'bg-amber-400 text-mauve-950 shadow-md font-black'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800/50'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Admin Broadsheet & Print</span>
              </button>
              <button
                onClick={() => setViewMode('teacher-entry')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-extrabold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  viewMode === 'teacher-entry'
                    ? 'bg-amber-400 text-mauve-950 shadow-md font-black'
                    : 'text-blue-200 hover:text-white hover:bg-blue-800/50'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>Teacher Subject Entry</span>
              </button>
            </div>
          </div>
        </div>

        {/* SESSION SELECTOR BAR */}
        <div className="p-4 bg-blue-50/50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold text-gray-700">
              <Layers className="w-4 h-4 text-blue-700" />
              <span>Exam Session:</span>
              <select
                value={selectedExamTitle}
                onChange={(e) => setSelectedExamTitle(e.target.value)}
                className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-black text-mauve-950 focus:ring-2 focus:ring-blue-600 outline-none shadow-2xs"
              >
                <option value="Mock Examination 1">Mock Examination 1</option>
                <option value="Mock Examination 2">Mock Examination 2</option>
                <option value="Mock Examination 3">Mock Examination 3</option>
                <option value="BECE Final Pre-Exam Mock">BECE Final Pre-Exam Mock</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 font-bold text-gray-700">
              <span>Academic Year:</span>
              <input
                type="text"
                value={selectedAcademicYear}
                onChange={(e) => setSelectedAcademicYear(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg font-bold text-mauve-950 w-28 text-center focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handlePrintNoticeBoard}
              className="px-4 py-1.5 bg-blue-800 hover:bg-blue-900 text-white font-black text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Print Notice Board Master Sheet</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODE 1: ADMIN BROADSHEET & NOTICE BOARD VIEW */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'broadsheet' && (
        <div className="space-y-6">
          {/* STATS OVERVIEW CARDS (NO-PRINT) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-blue-100 text-blue-900 rounded-xl shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">JHS 3 Pupils</p>
                <p className="text-xl font-black text-mauve-950">{totalCandidates}</p>
                <p className="text-[10px] text-gray-500">BECE Candidates</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-emerald-100 text-emerald-800 rounded-xl shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Top Aggregate</p>
                <p className="text-xl font-black text-emerald-800">
                  {topCandidate ? `Aggr ${String(topCandidate.calcs.totalAggregate).padStart(2, '0')}` : 'N/A'}
                </p>
                <p className="text-[10px] text-emerald-700 font-bold truncate max-w-[120px]">
                  {topCandidate ? topCandidate.student.name : 'No records'}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-amber-100 text-amber-900 rounded-xl shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Distinctions (Aggr ≤ 12)</p>
                <p className="text-xl font-black text-amber-950">{distinctionsCount}</p>
                <p className="text-[10px] text-amber-800 font-bold">
                  {totalCandidates > 0 ? `${Math.round((distinctionsCount / totalCandidates) * 100)}% of class` : '0%'}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center gap-3">
              <div className="p-3 bg-indigo-100 text-indigo-900 rounded-xl shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase">Class Avg Raw Score</p>
                <p className="text-xl font-black text-indigo-950">{avgRawScore}</p>
                <p className="text-[10px] text-gray-500">Out of 600 Total Marks</p>
              </div>
            </div>
          </div>

          {/* SEARCH & FILTER BAR (NO-PRINT) */}
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between gap-4 no-print">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search JHS 3 pupil by name or index number..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs font-bold text-mauve-950 focus:ring-2 focus:ring-blue-600 outline-none"
              />
            </div>
            <div className="text-xs font-bold text-gray-500 shrink-0">
              Showing <span className="text-blue-900 font-black">{filteredBroadsheet.length}</span> of {totalCandidates} pupils
            </div>
          </div>

          {/* ------------------------------------------------------------- */}
          {/* BECE MASTER BROADSHEET TABLE & NOTICE BOARD PRINT TEMPLATE */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-2xl border-2 border-blue-900 shadow-2xl overflow-hidden printable-noticeboard">
            {/* NOTICE BOARD HEADER (PRINT ONLY OR VISIBLE IN BROADSHEET) */}
            <div className="p-6 bg-gradient-to-r from-blue-900 via-blue-950 to-indigo-950 text-white border-b-2 border-amber-400">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-amber-400 text-mauve-950 rounded-2xl flex items-center justify-center font-black text-2xl border-2 border-white shadow-lg shrink-0">
                    EA
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
                      {config.schoolName || 'EASTFIELD ACADEMY'}
                    </h2>
                    <p className="text-xs text-amber-300 font-bold uppercase tracking-widest mt-0.5">
                      {config.schoolMotto || 'KNOWLEDGE, CHARACTER & EXCELLENCE'}
                    </p>
                    <p className="text-xs text-blue-200 mt-1 font-semibold">
                      JHS 3 BECE MOCK EXAMINATION OFFICIAL MASTER BROADSHEET — NOTICE BOARD RECORD SHEET
                    </p>
                  </div>
                </div>

                <div className="text-right hidden sm:block border-l border-blue-800 pl-6">
                  <span className="px-3 py-1 bg-amber-400 text-mauve-950 font-black text-xs uppercase rounded-lg shadow-sm block">
                    {selectedExamTitle}
                  </span>
                  <p className="text-xs text-blue-200 mt-1 font-mono font-bold">
                    Academic Year: {selectedAcademicYear}
                  </p>
                  <p className="text-[10px] text-blue-300 font-bold mt-0.5">
                    Class: JUNIOR HIGH SCHOOL 3 (JHS 3)
                  </p>
                </div>
              </div>
            </div>

            {/* GRADING SYSTEM REFERENCE BAR */}
            <div className="bg-blue-50 p-2.5 px-4 border-b border-gray-300 flex flex-wrap items-center justify-between text-[11px] font-bold text-mauve-950 gap-2">
              <div className="flex items-center gap-1 text-blue-900 font-black uppercase">
                <AlertCircle className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>BECE Grading Scale:</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="px-1.5 py-0.5 bg-emerald-700 text-white rounded">90-100 = G1</span>
                <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded">80-89 = G2</span>
                <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded">70-79 = G3</span>
                <span className="px-1.5 py-0.5 bg-blue-500 text-white rounded">60-69 = G4</span>
                <span className="px-1.5 py-0.5 bg-cyan-600 text-white rounded">55-59 = G5</span>
                <span className="px-1.5 py-0.5 bg-amber-500 text-mauve-950 rounded">50-54 = G6</span>
                <span className="px-1.5 py-0.5 bg-orange-500 text-white rounded">45-49 = G7</span>
                <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded">40-44 = G8</span>
                <span className="px-1.5 py-0.5 bg-red-600 text-white rounded">0-39 = G9</span>
              </div>
            </div>

            {/* MAIN BROADSHEET TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1100px]">
                <thead>
                  <tr className="bg-blue-900 text-white text-[11px] uppercase font-black tracking-wider border-b-2 border-amber-400">
                    <th className="py-3 px-3 border-r border-blue-800 bg-blue-900 text-white font-black">STUDENT NAME</th>
                    {jhsSubjects.map((sub) => {
                      const isCore = getCoreSubjectType(sub) !== null;
                      return (
                        <th
                          key={sub.id}
                          className={`py-2 px-2 text-center border-r border-blue-800 text-[10px] ${
                            isCore ? 'bg-blue-900 text-amber-300 font-black' : 'bg-blue-900/90 text-blue-100 font-bold'
                          }`}
                        >
                          <div className="truncate max-w-[80px] mx-auto">{sub.code || sub.name}</div>
                          <div className="text-[8px] opacity-80 font-normal text-blue-200">Grade</div>
                        </th>
                      );
                    })}
                    <th className="py-2.5 px-3 text-center border-r border-blue-800 bg-blue-900 text-white font-black text-[11px] w-28">
                      AGGREGATE
                    </th>
                    <th className="py-2.5 px-2.5 text-center border-r border-blue-800 bg-blue-900 text-white font-black text-[10px] w-20">
                      RAW TOTAL
                    </th>
                    <th className="py-2.5 px-2 text-center no-print w-16 bg-blue-900 text-white font-black text-[10px]">
                      ACTION
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-xs font-medium text-gray-800">
                  {filteredBroadsheet.length === 0 ? (
                    <tr>
                      <td colSpan={jhsSubjects.length + 4} className="p-8 text-center text-gray-500 italic bg-gray-50/80">
                        <div className="space-y-1">
                          <p className="font-bold text-gray-700 text-sm">No registered JHS 3 candidates found.</p>
                          <p className="text-xs text-gray-500">
                            You can register new JHS 3 pupils in Student Admission or wait for automatic promotion of JHS 2 students to JHS 3.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredBroadsheet.map((row) => {
                      const metaAggr = getBECEGradeMeta(
                        Math.min(9, Math.max(1, Math.round(row.calcs.totalAggregate / 6)))
                      );

                      return (
                        <tr
                          key={row.student.id}
                          className={`hover:bg-blue-50/40 transition ${
                            row.rank === 1 ? 'bg-amber-50/60 font-semibold' : ''
                          }`}
                        >
                          {/* STUDENT NAME */}
                          <td className="py-2.5 px-3 border-r border-gray-200 font-black text-mauve-950">
                            <div className="flex items-center gap-1.5">
                              <span>{row.student.name}</span>
                              {row.rank === 1 && (
                                <span className="px-1.5 py-0.2 bg-amber-400 text-mauve-950 font-black text-[9px] uppercase rounded">
                                  TOP 1
                                </span>
                              )}
                            </div>
                          </td>

                          {/* SUBJECT SCORES & GRADES */}
                          {jhsSubjects.map((sub) => {
                            let val = row.scores[sub.id];
                            if (val === undefined) val = row.scores[sub.code];
                            if (val === undefined) val = row.scores[sub.name];

                            const isCore = getCoreSubjectType(sub) !== null;

                            if (val !== undefined && val !== null && !isNaN(val)) {
                              const gradeNum = calculateBECEGrade(val);
                              const gradeMeta = getBECEGradeMeta(gradeNum);

                              return (
                                <td
                                  key={sub.id}
                                  className={`py-2 px-1.5 text-center border-r border-gray-200 font-mono text-xs ${
                                    isCore ? 'bg-blue-50/30' : ''
                                  }`}
                                >
                                  <span
                                    className={`inline-block px-2 py-0.5 text-xs font-black rounded-md shadow-2xs ${gradeMeta.badgeClass}`}
                                    title={`Score: ${val}/100 (${gradeMeta.label})`}
                                  >
                                    {gradeNum}
                                  </span>
                                </td>
                              );
                            }

                            return (
                              <td
                                key={sub.id}
                                className={`py-2 px-1 text-center border-r border-gray-200 text-gray-300 text-xs font-mono italic ${
                                  isCore ? 'bg-blue-50/20' : ''
                                }`}
                              >
                                -
                              </td>
                            );
                          })}

                          {/* TOTAL BECE AGGREGATE */}
                          <td className="py-2.5 px-3 text-center border-r border-gray-200 bg-amber-50/70">
                            <span
                              className={`inline-flex items-center justify-center px-3 py-1 text-xs sm:text-sm font-black font-mono rounded-xl shadow-xs border ${
                                row.calcs.totalAggregate <= 12
                                  ? 'bg-emerald-700 text-white border-emerald-600'
                                  : row.calcs.totalAggregate <= 20
                                  ? 'bg-blue-700 text-white border-blue-600'
                                  : row.calcs.totalAggregate <= 30
                                  ? 'bg-cyan-700 text-white border-cyan-600'
                                  : row.calcs.totalAggregate <= 36
                                  ? 'bg-amber-500 text-mauve-950 border-amber-400'
                                  : 'bg-red-600 text-white border-red-500'
                              }`}
                            >
                              AGGR {String(row.calcs.totalAggregate).padStart(2, '0')}
                            </span>
                          </td>

                          {/* RAW TOTAL SCORE */}
                          <td className="py-2.5 px-2.5 text-center border-r border-gray-200 font-mono font-black text-xs text-mauve-950 bg-gray-50">
                            {row.calcs.rawScore}
                          </td>

                          {/* EDIT ACTION (NO PRINT) */}
                          <td className="py-2.5 px-2 text-center no-print">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(row.student)}
                              className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-900 rounded-lg transition cursor-pointer"
                              title="Edit all mock scores for student"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* NOTICE BOARD FOOTER SIGNATURE & SUMMARY (PRINT & DISPLAY) */}
            <div className="p-6 bg-gray-50 border-t-2 border-blue-900 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1">
                <p className="font-black text-mauve-950 uppercase tracking-wider text-[11px]">
                  SUMMARY PERFORMANCE STATS
                </p>
                <div className="text-[11px] text-gray-700 space-y-0.5">
                  <p>• Total JHS 3 Candidates Sat: <strong className="text-mauve-950">{totalCandidates}</strong></p>
                  <p>• Distinction Candidates (Aggr 06 - 12): <strong className="text-emerald-800 font-black">{distinctionsCount}</strong></p>
                  <p>• Merit Candidates (Aggr 13 - 24): <strong className="text-blue-900 font-black">{creditsCount}</strong></p>
                  <p>• Pass Candidates (Aggr 25 - 36): <strong className="text-amber-900 font-black">{passesCount}</strong></p>
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-black text-mauve-950 uppercase tracking-wider text-[11px]">
                  NOTICE BOARD POSTING NOTE
                </p>
                <p className="text-[10px] text-gray-600 leading-relaxed italic">
                  This official broadsheet contains verified scores computed under standard Ghana BECE aggregate rules (4 Cores: English, Mathematics, Science, Social Studies + Best 2 Elective Subjects). Posted on the official Eastfield Academy JHS Notice Board.
                </p>
              </div>

              <div className="flex flex-col justify-between pt-2 border-t md:border-t-0 md:border-l border-gray-300 md:pl-6">
                <div>
                  <p className="font-black text-mauve-950 text-xs uppercase">{config.principalName || 'Dr. Evelyn Asare-Bediako'}</p>
                  <p className="text-[10px] text-gray-500 font-semibold">Headmaster / Academic Principal</p>
                </div>
                <div className="mt-4 pt-2 border-t border-dashed border-gray-400 flex items-center justify-between text-[10px] text-gray-500">
                  <span>Signature & Stamp: ______________________</span>
                  <span>Date: {new Date().toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODE 2: TEACHER SUBJECT MARK ENTRY PORTAL */}
      {/* ------------------------------------------------------------- */}
      {viewMode === 'teacher-entry' && (
        <div className="bg-white rounded-2xl border-2 border-violet-800/30 shadow-xl overflow-hidden p-4 sm:p-6 space-y-6 no-print">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-violet-700 shrink-0" />
                <span>Teacher Subject Entry: JHS 3 Mock Examination</span>
              </h2>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Select a subject below to enter or edit mock exam scores (0 - 100) for all JHS 3 pupils at once.
              </p>
            </div>

            {/* SUBJECT SELECTOR */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-black text-slate-900 uppercase shrink-0">Select Subject:</span>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 bg-slate-50 border-2 border-violet-500 rounded-xl font-black text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-violet-600 outline-none shadow-xs"
              >
                {allowedJHSSubjects.map((sub) => {
                  const isCore = getCoreSubjectType(sub) !== null;
                  return (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code || 'JHS'}) {isCore ? '★ CORE' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* TEACHER ASSIGNED SUBJECT SECURITY BANNER */}
          {currentUser?.role !== 'ADMIN' && (currentUser?.level as string) !== 'ALL' && currentUser?.subjects && currentUser.subjects.length > 0 && (
            <div className="bg-violet-50 border border-violet-200 p-3.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-900 font-medium shadow-2xs">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-violet-700 shrink-0" />
                <span>
                  <strong>Assigned Subjects Security Rule:</strong> You are authorized to enter mock marks strictly for your assigned subject(s):{' '}
                  <span className="font-black text-violet-950 underline">{allowedJHSSubjects.map((s) => s.name).join(', ')}</span>.
                </span>
              </div>
              <span className="text-[10px] font-black bg-violet-200 text-violet-950 px-2.5 py-1 rounded-lg uppercase tracking-wide shrink-0">
                {allowedJHSSubjects.length} {allowedJHSSubjects.length === 1 ? 'Subject' : 'Subjects'} Authorized
              </span>
            </div>
          )}

          {/* TEACHER SCORE ENTRY CONTAINER (RESPONSIVE FOR MOBILE & DESKTOP) */}
          <div className="space-y-4">
            {/* QUICK SAVE BUTTON & HINT */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl border border-slate-300">
              <div className="text-xs text-slate-900 font-bold flex items-center gap-1.5">
                <span className="text-base">📱</span>
                <span>Mark Entry: Enter scores (0-100) per pupil horizontally below, then click Save.</span>
              </div>
              <button
                type="button"
                onClick={handleSaveTeacherSubjectScores}
                className="w-full sm:w-auto px-5 py-2.5 bg-violet-700 hover:bg-violet-800 text-white font-black text-xs uppercase rounded-xl border border-violet-600 shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Save className="w-4 h-4 text-white" />
                <span>Save Subject Scores</span>
              </button>
            </div>

            {/* MOBILE CARD VIEW (VISIBLE ON PHONE SCREENS - HORIZONTAL LAYOUT NO INDEX NO) */}
            <div className="md:hidden space-y-2.5">
              {jhs3Students.length === 0 ? (
                <div className="p-6 text-center text-slate-600 italic bg-slate-50 rounded-xl border border-slate-200 font-medium">
                  No JHS 3 pupils enrolled. Please register JHS 3 pupils in Student Management first.
                </div>
              ) : (
                jhs3Students.map((st, idx) => {
                  const currentVal = teacherScoresMap[st.id] ?? '';
                  const numVal = currentVal !== '' ? Number(currentVal) : null;
                  const computedGrade = numVal !== null ? calculateBECEGrade(numVal) : null;
                  const gradeMeta = computedGrade !== null ? getBECEGradeMeta(computedGrade) : null;

                  return (
                    <div
                      key={st.id}
                      className="p-3.5 bg-slate-50 hover:bg-violet-50/50 rounded-xl border-2 border-slate-200 focus-within:border-violet-500 shadow-2xs transition flex items-center justify-between gap-3"
                    >
                      {/* LEFT: Pupil Number & Student Name */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="shrink-0 w-7 h-7 bg-violet-800 text-white rounded-lg text-xs font-black font-mono flex items-center justify-center shadow-2xs">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-black text-sm text-slate-900 truncate">{st.name}</h4>
                          {gradeMeta ? (
                            <div className="text-[11px] font-bold text-violet-900 flex items-center gap-1.5 mt-0.5">
                              <span className="bg-violet-200 text-violet-950 px-1.5 py-0.2 rounded font-mono font-black text-[10px]">
                                Grade {computedGrade}
                              </span>
                              <span className="truncate">{gradeMeta.remark}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Unentered score</span>
                          )}
                        </div>
                      </div>

                      {/* RIGHT: Marks Input Box (Horizontally aligned with Name) */}
                      <div className="shrink-0 flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="100"
                          placeholder="0-100"
                          value={currentVal}
                          onChange={(e) => {
                            const raw = e.target.value;
                            setTeacherScoresMap((prev) => ({
                              ...prev,
                              [st.id]: raw === '' ? '' : Math.min(100, Math.max(0, parseInt(raw) || 0))
                            }));
                          }}
                          className="w-24 sm:w-28 px-3 py-2 bg-white border-2 border-violet-600 rounded-xl text-base font-black font-mono text-center text-slate-900 focus:ring-2 focus:ring-violet-700 outline-none shadow-xs"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW (NO INDEX NO COLUMN - CLEAN HORIZONTAL ALIGNMENT & CONTRAST) */}
            <div className="hidden md:block border border-slate-300 rounded-xl overflow-x-auto bg-white shadow-xs">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-violet-900 text-white text-xs uppercase font-black tracking-wide border-b border-violet-700 shadow-xs">
                    <th className="py-3 px-3.5 border-r border-violet-800 w-16 text-center">NO</th>
                    <th className="py-3 px-3.5 border-r border-violet-800">STUDENT NAME</th>
                    <th className="py-3 px-3.5 border-r border-violet-800 text-center w-48 bg-violet-950 text-amber-300">
                      MARKS OBTAINED (0-100)
                    </th>
                    <th className="py-3 px-3.5 border-r border-violet-800 text-center w-36">BECE GRADE</th>
                    <th className="py-3 px-3.5 text-center w-44">GRADE REMARK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs font-medium text-slate-800">
                  {jhs3Students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                        No JHS 3 pupils enrolled. Please register JHS 3 pupils in Student Management first.
                      </td>
                    </tr>
                  ) : (
                    jhs3Students.map((st, idx) => {
                      const currentVal = teacherScoresMap[st.id] ?? '';
                      const numVal = currentVal !== '' ? Number(currentVal) : null;
                      const computedGrade = numVal !== null ? calculateBECEGrade(numVal) : null;
                      const gradeMeta = computedGrade !== null ? getBECEGradeMeta(computedGrade) : null;

                      return (
                        <tr key={st.id} className="hover:bg-violet-50/40 transition">
                          <td className="py-2.5 px-3 text-center border-r border-slate-200 font-mono font-bold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3.5 border-r border-slate-200 font-black text-slate-900 text-sm">
                            {st.name}
                          </td>

                          {/* MARKS INPUT */}
                          <td className="py-2 px-3 border-r border-slate-200 bg-violet-50/20">
                            <input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              max="100"
                              placeholder="Enter 0-100"
                              value={currentVal}
                              onChange={(e) => {
                                const raw = e.target.value;
                                setTeacherScoresMap((prev) => ({
                                  ...prev,
                                  [st.id]: raw === '' ? '' : Math.min(100, Math.max(0, parseInt(raw) || 0))
                                }));
                              }}
                              className="w-full px-3 py-1.5 bg-white border-2 border-violet-500 rounded-lg text-sm sm:text-base font-black font-mono text-center text-slate-900 focus:ring-2 focus:ring-violet-700 outline-none shadow-2xs"
                            />
                          </td>

                          {/* BECE GRADE BADGE */}
                          <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono">
                            {gradeMeta ? (
                              <span
                                className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-black font-mono shadow-xs ${gradeMeta.badgeClass}`}
                              >
                                Grade {computedGrade}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Unentered</span>
                            )}
                          </td>

                          {/* REMARK */}
                          <td className="py-2.5 px-3 text-center">
                            {gradeMeta ? (
                              <span className="text-xs font-extrabold text-slate-800">
                                {gradeMeta.remark}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SUBMIT BUTTON BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-xs text-slate-700 font-bold">
              💡 Tip: Entering a score automatically calculates the BECE grade from Grade 1 (90-100) to Grade 9 (0-39).
            </div>
            <button
              type="button"
              onClick={handleSaveTeacherSubjectScores}
              className="w-full sm:w-auto px-6 py-2.5 bg-violet-800 hover:bg-violet-900 text-white font-black text-xs uppercase rounded-xl border border-violet-600 shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4 text-white" />
              <span>Submit & Save Subject Scores</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* EDIT SINGLE STUDENT MOCK SCORES MODAL */}
      {/* ------------------------------------------------------------- */}
      {editingStudentRecord && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-2xl max-w-2xl w-full border-2 border-blue-900 shadow-2xl overflow-hidden animate-scaleUp my-8">
            <div className="bg-blue-900 text-white p-4 flex items-center justify-between border-b border-blue-500">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-amber-300" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-white">
                  Edit All Mock Scores: {editingStudentRecord.studentName} ({editingStudentRecord.rollNumber})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudentRecord(null)}
                className="text-gray-300 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {jhsSubjects.map((sub) => {
                  const isCore = getCoreSubjectType(sub) !== null;
                  const isEditable =
                    isAdminAuthenticated ||
                    currentUser?.role === 'ADMIN' ||
                    (currentUser?.level as string) === 'ALL' ||
                    allowedJHSSubjects.some((s) => s.id === sub.id || matchesSubject(s.id, sub));

                  const currentVal = editStudentScores[sub.id] ?? '';

                  const numVal = currentVal !== '' ? Number(currentVal) : null;
                  const g = numVal !== null ? calculateBECEGrade(numVal) : null;

                  return (
                    <div
                      key={sub.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        !isEditable
                          ? 'bg-gray-100/80 border-gray-200 opacity-60'
                          : isCore
                          ? 'bg-blue-50/70 border-blue-300'
                          : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-black text-mauve-950 flex items-center gap-1">
                          <span>{sub.name}</span>
                          {isCore && <span className="text-amber-600 font-bold text-[10px]">(CORE)</span>}
                          {!isEditable && <Lock className="w-3 h-3 text-gray-500" title="Assigned to another subject teacher" />}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          Code: {sub.code} {!isEditable && <span className="italic text-red-600 font-sans">(Read-Only)</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder={isEditable ? '0-100' : 'Locked'}
                          disabled={!isEditable}
                          value={currentVal}
                          onChange={(e) => {
                            if (!isEditable) return;
                            const raw = e.target.value;
                            setEditStudentScores((prev) => ({
                              ...prev,
                              [sub.id]: raw === '' ? '' : Math.min(100, Math.max(0, parseInt(raw) || 0))
                            }));
                          }}
                          className={`w-20 px-2.5 py-1.5 border rounded-lg text-xs font-black font-mono text-center text-blue-950 focus:ring-2 focus:ring-blue-600 outline-none ${
                            !isEditable ? 'bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed' : 'bg-white border-gray-300'
                          }`}
                        />
                        <span className="w-14 text-center font-black text-[10px] font-mono px-1 py-0.5 rounded bg-blue-900 text-white">
                          {g !== null ? `G${g}` : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-xs font-extrabold text-mauve-950 uppercase mb-1">
                  Teacher / Academic Board Remarks:
                </label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="E.g. Outstanding performance in core subjects..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-600 outline-none"
                />
              </div>
            </div>

            <div className="bg-gray-100 p-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingStudentRecord(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold uppercase rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveStudentEdit}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs uppercase rounded-xl border border-blue-500 shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4 text-white" />
                <span>Save Student Mock Results</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
