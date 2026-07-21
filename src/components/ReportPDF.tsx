/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Student, Grade, Attendance, Subject, ReportConfig } from '../types';
import { Printer, Check, Settings2, FileText, Sparkles, ExternalLink, Sliders, GraduationCap } from 'lucide-react';

interface ReportPDFProps {
  student: Student;
  grades: Grade[];
  attendance?: Attendance;
  subjects: Subject[];
  config: ReportConfig;
  allClassStudents: Student[];
  allGrades: Grade[]; // Used for rank calculation
  onUpdateAttendance?: (daysPresent: number, totalDays: number, remarks?: string) => void;
}

// High-fidelity pure SVG illustrations for Nursery/KG reports
function FlyingBeeSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      {/* Translucent Wings */}
      <ellipse cx="40" cy="35" rx="15" ry="8" fill="#D2E2FF" opacity="0.8" transform="rotate(-30 40 35)" stroke="#6C8ED9" strokeWidth="1" />
      <ellipse cx="52" cy="30" rx="12" ry="6" fill="#D2E2FF" opacity="0.6" transform="rotate(-15 52 30)" stroke="#6C8ED9" strokeWidth="1" />
      
      {/* Bee Body (striped periwinkle/blue and white) */}
      <ellipse cx="50" cy="55" rx="20" ry="14" fill="#FFFFFF" stroke="#4F6C9F" strokeWidth="2.5" transform="rotate(-10 50 55)" />
      
      {/* Stripes (lavender/periwinkle/navy) */}
      <g transform="rotate(-10 50 55)">
        <path d="M 42 42 Q 50 46 58 42 L 57 68 Q 50 66 43 68 Z" fill="#B5C4F7" />
        <path d="M 50 41 Q 58 44 64 42 L 62 67 Q 56 66 50 68 Z" fill="#6C86D9" />
      </g>
      
      {/* Antennae */}
      <path d="M 32 40 Q 25 28 20 28" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="28" r="3" fill="#2D3748" />
      
      <path d="M 42 38 Q 42 24 45 22" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />
      <circle cx="45" cy="22" r="3" fill="#2D3748" />

      {/* Head */}
      <circle cx="34" cy="48" r="13" fill="#FFFFFF" stroke="#4F6C9F" strokeWidth="2.5" />
      
      {/* Face features: Cheeks, Eyes, Smile */}
      <circle cx="29" cy="48" r="1.5" fill="#E53E3E" opacity="0.5" />
      <circle cx="39" cy="48" r="1.5" fill="#E53E3E" opacity="0.5" />
      <circle cx="31" cy="44" r="2.2" fill="#2D3748" />
      <circle cx="38" cy="44" r="2.2" fill="#2D3748" />
      {/* Pupils reflection */}
      <circle cx="30" cy="43" r="0.7" fill="#FFFFFF" />
      <circle cx="37" cy="43" r="0.7" fill="#FFFFFF" />
      {/* Smile */}
      <path d="M 30 52 Q 34 57 38 52" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />

      {/* Little arms and legs */}
      <path d="M 24 58 Q 16 60 14 58" fill="none" stroke="#4F6C9F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 42 62 Q 40 74 38 76" fill="none" stroke="#4F6C9F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 52 64 Q 52 76 54 77" fill="none" stroke="#4F6C9F" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function StandingBeeSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className}>
      {/* Translucent Wings */}
      <ellipse cx="62" cy="42" rx="14" ry="7" fill="#D2E2FF" opacity="0.8" transform="rotate(35 62 42)" stroke="#6C8ED9" strokeWidth="1" />
      <ellipse cx="58" cy="34" rx="10" ry="5" fill="#D2E2FF" opacity="0.6" transform="rotate(15 58 34)" stroke="#6C8ED9" strokeWidth="1" />

      {/* Body */}
      <ellipse cx="48" cy="60" rx="15" ry="18" fill="#FFFFFF" stroke="#4F6C9F" strokeWidth="2.5" />
      {/* Stripes */}
      <path d="M 35 52 Q 48 56 61 52 L 61 62 Q 48 67 35 62 Z" fill="#B5C4F7" />
      <path d="M 34 60 Q 48 64 62 60 L 60 68 Q 48 72 36 68 Z" fill="#6C86D9" />

      {/* Head */}
      <circle cx="45" cy="38" r="14" fill="#FFFFFF" stroke="#4F6C9F" strokeWidth="2.5" />
      
      {/* Antennae */}
      <path d="M 38 26 Q 32 15 26 16" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />
      <circle cx="26" cy="16" r="3" fill="#2D3748" />
      
      <path d="M 48 25 Q 52 14 58 13" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />
      <circle cx="58" cy="13" r="3" fill="#2D3748" />

      {/* Face features */}
      <circle cx="39" cy="38" r="2.2" fill="#2D3748" />
      <circle cx="49" cy="38" r="2.2" fill="#2D3748" />
      <circle cx="38" cy="37" r="0.7" fill="#FFFFFF" />
      <circle cx="48" cy="37" r="0.7" fill="#FFFFFF" />
      <circle cx="36" cy="42" r="1.5" fill="#E53E3E" opacity="0.5" />
      <circle cx="51" cy="42" r="1.5" fill="#E53E3E" opacity="0.5" />
      <path d="M 40 44 Q 44 48 48 44" fill="none" stroke="#2D3748" strokeWidth="2" strokeLinecap="round" />

      {/* Waving Hands */}
      <path d="M 32 52 Q 22 45 18 40" fill="none" stroke="#4F6C9F" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="18" cy="40" r="1.5" fill="#4F6C9F" />
      <path d="M 62 58 Q 68 62 64 68" fill="none" stroke="#4F6C9F" strokeWidth="2.5" strokeLinecap="round" />

      {/* Legs */}
      <path d="M 42 77 Q 40 88 36 89" fill="none" stroke="#4F6C9F" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M 52 77 Q 54 88 58 89" fill="none" stroke="#4F6C9F" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function SchoolSealSVG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className}>
      <defs>
        <radialGradient id="silverSheen" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#E6ECFA" />
          <stop offset="100%" stopColor="#B3C4E6" />
        </radialGradient>
      </defs>
      
      <circle cx="60" cy="60" r="56" fill="url(#silverSheen)" stroke="#4A6094" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="48" fill="none" stroke="#4A6094" strokeWidth="1" strokeDasharray="3,2" />
      <circle cx="60" cy="60" r="44" fill="none" stroke="#4A6094" strokeWidth="1.5" />
      
      {/* Arched Text: FIRST AMONG EQUALS */}
      <path id="archTextPath" d="M 22 60 A 38 38 0 0 1 98 60" fill="none" stroke="none" />
      <text className="font-serif font-extrabold text-[8px] fill-[#2B3B63] tracking-widest uppercase">
        <textPath href="#archTextPath" startOffset="50%" textAnchor="middle">
          FIRST AMONG EQUALS
        </textPath>
      </text>

      {/* Arched Text Bottom: KOFORIDUA */}
      <path id="bottomTextPath" d="M 98 60 A 38 38 0 0 1 22 60" fill="none" stroke="none" />
      <text className="font-serif font-bold text-[7px] fill-[#4A6094] tracking-wider uppercase">
        <textPath href="#bottomTextPath" startOffset="50%" textAnchor="middle">
          EASTFIELD ACADEMY
        </textPath>
      </text>

      {/* Center Shield/Crest */}
      <g transform="translate(42, 42)">
        <path d="M 6 4 C 18 4, 30 4, 30 4 C 30 18, 18 30, 18 30 C 18 30, 6 18, 6 4" fill="#FFFFFF" stroke="#2B3B63" strokeWidth="2" />
        <path d="M 12 12 Q 18 10 24 12 M 12 16 Q 18 14 24 16 M 12 20 Q 18 18 24 20" fill="none" stroke="#2B3B63" strokeWidth="1" />
        <line x1="18" y1="11" x2="18" y2="22" stroke="#2B3B63" strokeWidth="1" />
      </g>
    </svg>
  );
}

export default function ReportPDF({
  student,
  grades,
  attendance,
  subjects,
  config,
  allClassStudents,
  allGrades,
  onUpdateAttendance
}: ReportPDFProps) {
  // Customization options state
  const [showLogo, setShowLogo] = useState(true);
  const [showGradingScale, setShowGradingScale] = useState(true);
  const [showAttendanceCard, setShowAttendanceCard] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [customPrincipalComment, setCustomPrincipalComment] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(false);

  const [customRollNumber, setCustomRollNumber] = useState(student.rollNumber);
  const [customClassRoll, setCustomClassRoll] = useState(allClassStudents.length);

  useEffect(() => {
    setCustomRollNumber(student.rollNumber);
  }, [student.rollNumber]);

  useEffect(() => {
    setCustomClassRoll(allClassStudents.length);
  }, [allClassStudents.length]);

  // JHS Customization options
  const [jhsReopening, setJhsReopening] = useState('15th September, 2026');
  const [jhsContact, setJhsContact] = useState('0249321874');
  const [jhsArrears, setJhsArrears] = useState('825.00');
  const [jhsTuition, setJhsTuition] = useState('730.00');
  const [jhsComputing, setJhsComputing] = useState('20.00');
  const [jhsUtility, setJhsUtility] = useState('25.00');
  const [jhsStationery, setJhsStationery] = useState('30.00');
  const [jhsPta, setJhsPta] = useState('20.00');

  // Primary Customization options
  const [primaryReopening, setPrimaryReopening] = useState('15th September, 2026');
  const [primaryContact, setPrimaryContact] = useState('0249321874');
  const [primaryArrears, setPrimaryArrears] = useState('0.00');
  const [primaryTuition, setPrimaryTuition] = useState('600.00');
  const [primaryComputing, setPrimaryComputing] = useState('20.00');
  const [primaryUtility, setPrimaryUtility] = useState('25.00');
  const [primaryStationery, setPrimaryStationery] = useState('30.00');
  const [primaryPta, setPrimaryPta] = useState('20.00');

  // Nursery/KG Customization options
  const [nurseryReopening, setNurseryReopening] = useState('15th September, 2026');
  const [nurseryContact, setNurseryContact] = useState('0249321874');
  const [nurseryArrears, setNurseryArrears] = useState('0.00');
  const [nurseryTuition, setNurseryTuition] = useState('450.00');
  const [nurseryComputing, setNurseryComputing] = useState('15.00');
  const [nurseryUtility, setNurseryUtility] = useState('15.00');
  const [nurseryStationery, setNurseryStationery] = useState('20.00');
  const [nurseryPta, setNurseryPta] = useState('10.00');

  const templateStyle = config.selectedTemplate || 'dynamic';
  const isCompactTemplate = templateStyle === 'compact' || (templateStyle === 'dynamic' && student.level === 'NURSERY');
  const isHighFidelityTemplate = templateStyle === 'high-fidelity' || (templateStyle === 'dynamic' && (student.level === 'JHS' || student.level === 'PRIMARY'));

  const isJHS = student.level === 'JHS';
  const isPrimary = student.level === 'PRIMARY';
  const isNursery = isCompactTemplate;

  const currentReopening = isJHS ? jhsReopening : (isPrimary ? primaryReopening : nurseryReopening);
  const currentContact = isJHS ? jhsContact : (isPrimary ? primaryContact : nurseryContact);
  const currentArrears = isJHS ? jhsArrears : (isPrimary ? primaryArrears : nurseryArrears);
  const currentTuition = isJHS ? jhsTuition : (isPrimary ? primaryTuition : nurseryTuition);
  const currentComputing = isJHS ? jhsComputing : (isPrimary ? primaryComputing : nurseryComputing);
  const currentUtility = isJHS ? jhsUtility : (isPrimary ? primaryUtility : nurseryUtility);
  const currentStationery = isJHS ? jhsStationery : (isPrimary ? primaryStationery : nurseryStationery);
  const currentPta = isJHS ? jhsPta : (isPrimary ? primaryPta : nurseryPta);

  const parsedArrears = parseFloat(currentArrears) || 0;
  const parsedTuition = parseFloat(currentTuition) || 0;
  const parsedComputing = parseFloat(currentComputing) || 0;
  const parsedUtility = parseFloat(currentUtility) || 0;
  const parsedStationery = parseFloat(currentStationery) || 0;
  const parsedPta = parseFloat(currentPta) || 0;
  const totalBillSum = parsedArrears + parsedTuition + parsedComputing + parsedUtility + parsedStationery + parsedPta;

  // Print ref
  const printRef = useRef<HTMLDivElement>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isInsideIframe, setIsInsideIframe] = useState(false);

  useEffect(() => {
    try {
      setIsInsideIframe(window.self !== window.top);
    } catch (e) {
      setIsInsideIframe(true);
    }
  }, []);

  // 1. Calculate Grade Details
  const studentGrades = grades.filter((g) => g.studentId === student.id);
  const totalSubjectsCount = studentGrades.length;

  const totalSum = studentGrades.reduce((sum, g) => sum + g.totalScore, 0);
  const studentAverage = totalSubjectsCount > 0 ? (totalSum / totalSubjectsCount) : 0;

  // 2. Class Rank Calculation (dynamic!)
  const rankList = allClassStudents.map((s) => {
    const sGrades = allGrades.filter((g) => g.studentId === s.id);
    const sCount = sGrades.length;
    const sSum = sGrades.reduce((sum, g) => sum + g.totalScore, 0);
    const sAvg = sCount > 0 ? (sSum / sCount) : 0;
    return { studentId: s.id, average: sAvg };
  });

  // Sort descending by average
  rankList.sort((a, b) => b.average - a.average);
  const studentRankIndex = rankList.findIndex((item) => item.studentId === student.id);
  const studentRank = studentRankIndex !== -1 ? studentRankIndex + 1 : 0;

  // 3. Automated Grade Letter assignment helper based on current configuration scale
  const getGradeDetails = (score: number) => {
    const rule = config.gradingScale.find((r) => score >= r.minScore && score <= r.maxScore);
    return rule || { grade: 'F9', remarks: 'Fail', gpa: 0 };
  };

  // Trigger Print
  const handlePrint = () => {
    setPrintError(null);
    try {
      window.print();
    } catch (err: any) {
      console.error("Print blocked or failed", err);
      setPrintError("Browser security restrictions inside iframes block direct printing. Please open the app in a new window to print.");
    }
  };

  // Progress color based on average
  const getAverageColor = (avg: number) => {
    if (avg >= 80) return 'text-green-600 bg-green-50';
    if (avg >= 60) return 'text-mauve-600 bg-mauve-50';
    if (avg >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-rose-600 bg-rose-50';
  };

  return (
    <div className="w-full flex flex-col gap-4 text-xs" id={`transcript-${student.id}`}>
      {/* Mobile Floating Print Button - no-print, only visible on small screens when scrolled down */}
      <button
        onClick={handlePrint}
        className="fixed bottom-6 right-6 z-50 md:hidden bg-mauve-900 hover:bg-mauve-700 active:scale-95 text-white p-4 rounded-full shadow-lg transition-all duration-150 flex items-center justify-center cursor-pointer no-print border border-white/20"
        title="Print / Export PDF"
        id={`btn-print-floating-${student.id}`}
      >
        <Printer className="w-5 h-5" />
      </button>

      {/* Customizer Panel - HIDE IN PRINT */}
      <div className="bg-white p-4 rounded border border-mauve-500/20 shadow-sm no-print">
        {isInsideIframe && (
          <div className="mb-4 p-3.5 bg-amber-50 rounded border border-amber-200 text-amber-900 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fadeIn">
            <div className="space-y-1">
              <span className="text-[11px] font-bold flex items-center gap-1.5 uppercase tracking-wide">
                ⚠️ Secure App Preview Frame Restriction
              </span>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                You are currently in the AI Studio secure app preview. Browsers block the Print dialog inside iframes. To print or download high-fidelity vector PDF transcripts, please open the application in a new browser tab. Your current data is fully cached and will be preserved!
              </p>
            </div>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full md:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold rounded text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-sm text-center"
              id={`btn-open-new-tab-print-${student.id}`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in New Tab to Print</span>
            </a>
          </div>
        )}

        {printError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded text-[11px] leading-relaxed animate-fadeIn">
            <strong>Printing Error:</strong> {printError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
          <div className="w-full sm:w-auto">
            <h4 className="font-display font-bold text-mauve-900 text-sm flex items-center gap-1.5 uppercase tracking-wide">
              <Settings2 className="w-4 h-4 text-mauve-900" />
              Customize Transcript Details
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">Configure signatures, headers, and principal endorsements. Choose 'Save as PDF' in the destination dropdown to download.</p>
          </div>
          <button
            onClick={handlePrint}
            className="w-full sm:w-auto bg-mauve-900 hover:bg-mauve-700 active:scale-[0.98] focus:ring-2 focus:ring-mauve-500/50 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-sm uppercase tracking-wider"
            id={`btn-print-${student.id}`}
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span>Print / Export PDF</span>
          </button>
        </div>

        {/* Customization Controls Accordion-like */}
        <div className="border-t border-mauve-500/10 pt-3">
          <button
            onClick={() => setIsCustomizing(!isCustomizing)}
            className="text-[10px] font-bold text-mauve-900 hover:text-mauve-700 flex items-center gap-1 mb-2.5 cursor-pointer uppercase tracking-wider underline"
          >
            {isCustomizing ? 'Hide Options' : 'Show Advanced Customization Options'}
          </button>

          {isCustomizing && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 animate-fadeIn">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">Layout Toggles</p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLogo}
                      onChange={(e) => setShowLogo(e.target.checked)}
                      className="rounded border-mauve-500/20 text-mauve-900 focus:ring-mauve-900 w-3.5 h-3.5"
                    />
                    Include Academy Crest Logo
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAttendanceCard}
                      onChange={(e) => setShowAttendanceCard(e.target.checked)}
                      className="rounded border-mauve-500/20 text-mauve-900 focus:ring-mauve-900 w-3.5 h-3.5"
                    />
                    Display Attendance Records
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showGradingScale}
                      onChange={(e) => setShowGradingScale(e.target.checked)}
                      className="rounded border-mauve-500/20 text-mauve-900 focus:ring-mauve-900 w-3.5 h-3.5"
                    />
                    Show Grading System Legend
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSignature}
                      onChange={(e) => setShowSignature(e.target.checked)}
                      className="rounded border-mauve-500/20 text-mauve-900 focus:ring-mauve-900 w-3.5 h-3.5"
                    />
                    Include Principal & Teacher Signature Seals
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">Principal's Custom Remarks</p>
                <div>
                  <textarea
                    value={customPrincipalComment}
                    onChange={(e) => setCustomPrincipalComment(e.target.value)}
                    placeholder="E.g., Kofi is a diligent pupil who has shown exceptional progress this term. Keep up the brilliant performance!"
                    className="w-full min-h-[75px] text-xs p-2 rounded border border-mauve-500/20 focus:outline-none focus:ring-1 focus:ring-mauve-900 bg-white text-mauve-900"
                  />
                  <span className="text-[9px] text-gray-400 block mt-0.5">This comment will override the default remarks in the principal's signature box.</span>
                </div>
              </div>

              {/* Attendance & Conduct Customizer - Admin only */}
              {onUpdateAttendance && (
                <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-mauve-900" />
                      Attendance Days Customizer
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block">Total School Days</label>
                        <input
                          type="number"
                          value={attendance?.totalDays ?? 60}
                          min={1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            onUpdateAttendance(attendance?.daysPresent ?? Math.min(55, val), val, attendance?.remarks);
                          }}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Days Present</label>
                        <input
                          type="number"
                          value={attendance?.daysPresent ?? 55}
                          min={0}
                          max={attendance?.totalDays ?? 100}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            onUpdateAttendance(val, attendance?.totalDays ?? 60, attendance?.remarks);
                          }}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">
                      Conduct & Behavioral Remarks
                    </p>
                    <div>
                      <input
                        type="text"
                        placeholder="E.g., Kofi is a respectful and active participant..."
                        value={attendance?.remarks ?? ''}
                        onChange={(e) => {
                          onUpdateAttendance(
                            attendance?.daysPresent ?? 55,
                            attendance?.totalDays ?? 60,
                            e.target.value
                          );
                        }}
                        className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                      />
                      <span className="text-[9px] text-gray-400 block mt-0.5">Saves behavioral remarks displayed in the conduct log.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Roll ID & No. on Roll Customizer */}
              <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5 text-mauve-900" />
                    Report Template Roll ID Customizer
                  </p>
                  <div>
                    <label className="text-[10px] text-gray-500 block">Student Roll ID (e.g. Register Number)</label>
                    <input
                      type="text"
                      value={customRollNumber}
                      onChange={(e) => setCustomRollNumber(e.target.value)}
                      className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900 font-mono focus:outline-none focus:ring-1 focus:ring-mauve-900"
                    />
                    <span className="text-[9px] text-gray-400 block mt-0.5">Customize the individual student Roll Number displayed on the report card.</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-mauve-900" />
                    No. on Roll Customizer
                  </p>
                  <div>
                    <label className="text-[10px] text-gray-500 block">Class Size (Number on Roll)</label>
                    <input
                      type="number"
                      value={customClassRoll}
                      min={0}
                      onChange={(e) => setCustomClassRoll(parseInt(e.target.value) || 0)}
                      className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900 font-mono focus:outline-none focus:ring-1 focus:ring-mauve-900"
                    />
                    <span className="text-[9px] text-gray-400 block mt-0.5">Override the default class roll count displayed on the report card.</span>
                  </div>
                </div>
              </div>

              {student.level === 'JHS' && (
                <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">JHS Details Customizer</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block">Reopening Date</label>
                        <input
                          type="text"
                          value={jhsReopening}
                          onChange={(e) => setJhsReopening(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Contact Info</label>
                        <input
                          type="text"
                          value={jhsContact}
                          onChange={(e) => setJhsContact(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">JHS Report Card Bills (GHC)</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-gray-500 block">Arrears</label>
                        <input
                          type="text"
                          value={jhsArrears}
                          onChange={(e) => setJhsArrears(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Tuition</label>
                        <input
                          type="text"
                          value={jhsTuition}
                          onChange={(e) => setJhsTuition(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Computing Levy</label>
                        <input
                          type="text"
                          value={jhsComputing}
                          onChange={(e) => setJhsComputing(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Utility</label>
                        <input
                          type="text"
                          value={jhsUtility}
                          onChange={(e) => setJhsUtility(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Stationery</label>
                        <input
                          type="text"
                          value={jhsStationery}
                          onChange={(e) => setJhsStationery(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">PTA</label>
                        <input
                          type="text"
                          value={jhsPta}
                          onChange={(e) => setJhsPta(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {student.level === 'PRIMARY' && (
                <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">Primary Details Customizer</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block">Reopening Date</label>
                        <input
                          type="text"
                          value={primaryReopening}
                          onChange={(e) => setPrimaryReopening(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Contact Info</label>
                        <input
                          type="text"
                          value={primaryContact}
                          onChange={(e) => setPrimaryContact(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">Primary Report Card Bills (GHC)</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-gray-500 block">Arrears</label>
                        <input
                          type="text"
                          value={primaryArrears}
                          onChange={(e) => setPrimaryArrears(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Tuition</label>
                        <input
                          type="text"
                          value={primaryTuition}
                          onChange={(e) => setPrimaryTuition(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Computing Levy</label>
                        <input
                          type="text"
                          value={primaryComputing}
                          onChange={(e) => setPrimaryComputing(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Utility</label>
                        <input
                          type="text"
                          value={primaryUtility}
                          onChange={(e) => setPrimaryUtility(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Stationery</label>
                        <input
                          type="text"
                          value={primaryStationery}
                          onChange={(e) => setPrimaryStationery(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">PTA</label>
                        <input
                          type="text"
                          value={primaryPta}
                          onChange={(e) => setPrimaryPta(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {student.level === 'NURSERY' && (
                <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">Nursery/KG Details Customizer</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block">Reopening Date</label>
                        <input
                          type="text"
                          value={nurseryReopening}
                          onChange={(e) => setNurseryReopening(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Contact Info</label>
                        <input
                          type="text"
                          value={nurseryContact}
                          onChange={(e) => setNurseryContact(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">Nursery/KG Report Card Bills (GHC)</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-gray-500 block">Arrears</label>
                        <input
                          type="text"
                          value={nurseryArrears}
                          onChange={(e) => setNurseryArrears(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Tuition</label>
                        <input
                          type="text"
                          value={nurseryTuition}
                          onChange={(e) => setNurseryTuition(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Computing Levy</label>
                        <input
                          type="text"
                          value={nurseryComputing}
                          onChange={(e) => setNurseryComputing(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Utility</label>
                        <input
                          type="text"
                          value={nurseryUtility}
                          onChange={(e) => setNurseryUtility(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Stationery</label>
                        <input
                          type="text"
                          value={nurseryStationery}
                          onChange={(e) => setNurseryStationery(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">PTA</label>
                        <input
                          type="text"
                          value={nurseryPta}
                          onChange={(e) => setNurseryPta(e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TRANSCRIPT A4 SHEET CONTAINER */}
      <div 
        ref={printRef}
        className="bg-white text-gray-900 shadow-sm border-2 border-mauve-900 rounded p-6 sm:p-10 w-full max-w-[850px] mx-auto print-container relative"
        style={{ contentVisibility: 'auto' }}
      >
        {/* Certificate Style Border */}
        <div className="absolute inset-2 border border-mauve-900/15 pointer-events-none rounded opacity-60 print:inset-0" />
        <div className="absolute inset-3 border-2 border-mauve-100 pointer-events-none rounded opacity-35 print:inset-1" />

        <div className="relative z-10 space-y-6 print:space-y-3">
          {isCompactTemplate ? (
            /* ========================================================
               NURSERY & KG HIGH-FIDELITY TEMPLATE - COMPACT SINGLE-PAGE
               ======================================================== */
            <div className="font-serif text-[#1e293b] space-y-4 print:space-y-3 relative pb-2">
              {/* Curve Wave Decor Background spanning the full sheet */}
              <div className="absolute left-0 top-0 h-full w-48 pointer-events-none select-none overflow-hidden z-0 print:block">
                <svg className="h-full w-full" viewBox="0 0 190 1000" preserveAspectRatio="none">
                  <path d="M 0 0 C 120 200, 180 500, 80 1000 L 0 1000 Z" fill="#E8E5FC" opacity="0.6" />
                  <path d="M 0 0 C 140 200, 200 500, 100 1000" fill="none" stroke="#C5BEFB" strokeWidth="2.5" />
                  <path d="M 0 0 C 160 200, 220 500, 120 1000" fill="none" stroke="#DCD8FD" strokeWidth="1.5" />
                </svg>
              </div>

              {/* Right Edge lavender border bar */}
              <div className="absolute right-0 top-0 h-full w-3 bg-[#C5BEFB] opacity-30 pointer-events-none select-none z-0 print:block" />

              {/* Flying Bee Mascot at top right */}
              <div className="absolute right-8 top-2 w-16 h-16 z-10 print:w-12 print:h-12">
                <FlyingBeeSVG className="w-full h-full" />
              </div>

              <div className="relative z-10 space-y-4 print:space-y-2 px-4 sm:px-6">
                {/* Header */}
                <div className="text-center pt-2 pb-1">
                  {showLogo && (
                    config.schoolLogoUrl ? (
                      <img 
                        src={config.schoolLogoUrl} 
                        alt={`${config.schoolName} logo`} 
                        className="w-14 h-14 object-contain rounded mx-auto mb-1 shrink-0 shadow-sm print:w-10 print:h-10"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-[#4A3B94] text-white font-serif font-extrabold text-lg flex items-center justify-center shadow-sm mb-1 mx-auto shrink-0 select-none print:w-10 print:h-10 print:text-base">
                        {config.schoolLogoText || 'EA'}
                      </div>
                    )
                  )}
                  <h1 className="font-serif font-extrabold text-xl sm:text-2xl tracking-widest text-[#4A3B94] uppercase leading-none print:text-lg">
                    {config.schoolName}
                  </h1>
                  <h2 className="font-serif font-extrabold text-[12px] tracking-wider text-slate-800 uppercase mt-1.5 italic print:text-[10px]">
                    REPORT CARD FOR {student.className.toUpperCase().includes('KG') ? 'KINDERGARTEN' : 'NURSERY'}
                  </h2>
                </div>

                {/* Bio Metadata Bubbles */}
                <div className="space-y-2 px-2 print:space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[180px] px-3.5 py-1 border-2 border-[#A899F7]/50 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm print:py-0.5">
                      <span className="font-serif font-bold italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">NAME:</span>
                      <span className="font-serif font-extrabold text-slate-900 text-[11px] uppercase grow px-1 border-b border-dotted border-slate-300 print:text-[10px]">{student.name}</span>
                    </div>
                    <div className="px-3.5 py-1 border-2 border-[#A899F7]/50 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm shrink-0 print:py-0.5">
                      <span className="font-serif font-bold italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">{student.className.toUpperCase().includes('KG') ? 'KG' : 'NURSERY'}:</span>
                      <span className="font-serif font-extrabold text-slate-900 text-[11px] uppercase px-1 print:text-[10px]">{student.className}</span>
                    </div>
                    <div className="px-3.5 py-1 border-2 border-[#A899F7]/50 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm shrink-0 print:py-0.5">
                      <span className="font-serif font-bold italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">ROLL:</span>
                      <span className="font-serif font-extrabold text-slate-900 text-[11px] uppercase px-1 print:text-[10px]">{customRollNumber}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="px-3.5 py-1 border-2 border-[#A899F7]/50 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm print:py-0.5">
                      <span className="font-serif font-bold italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">SCHOOL YEAR:</span>
                      <span className="font-serif font-extrabold text-slate-900 text-[11px] uppercase grow px-1 border-b border-dotted border-slate-300 print:text-[10px]">{config.schoolYear}</span>
                    </div>
                    <div className="px-3.5 py-1 border-2 border-[#A899F7]/50 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm print:py-0.5">
                      <span className="font-serif font-bold italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">REOPENING:</span>
                      <span className="font-serif font-extrabold text-slate-900 text-[11px] uppercase grow px-1 border-b border-dotted border-slate-300 print:text-[10px]">{currentReopening}</span>
                    </div>
                  </div>
                </div>

                {/* Subject Grades Table */}
                <div className="overflow-hidden border-2 border-[#7285DE] rounded bg-white shadow-sm mx-2">
                  <table className="w-full text-left border-collapse font-serif text-[11px]">
                    <thead>
                      <tr className="bg-[#B5C4F7] text-[#2B3B63] font-extrabold text-[9px] uppercase tracking-wider border-b-2 border-[#7285DE]">
                        <th className="p-1.5 pl-3 border-r border-[#7285DE] bg-white">Subject</th>
                        <th className="p-1.5 text-center w-28 border-r border-[#7285DE] print:w-24 bg-white">Class score (50)</th>
                        <th className="p-1.5 text-center w-28 border-r border-[#7285DE] print:w-24 bg-white">Exam score (50)</th>
                        <th className="p-1.5 text-center w-24 border-r border-[#7285DE] print:w-20 bg-white">Overall (100)</th>
                        <th className="p-1.5 pr-3 text-center bg-white">Comment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#7285DE] text-[11px] text-slate-800">
                      {(() => {
                        const levelSubjects = subjects.filter(sub => sub.level === 'NURSERY');

                        const rows = levelSubjects.map((sub) => {
                          const matchedGrade = studentGrades.find((g) => g.subjectId === sub.id);
                          return {
                            name: sub.name,
                            grade: matchedGrade
                          };
                        });

                        const extraGrades = studentGrades.filter((g) => {
                          return !levelSubjects.some((sub) => sub.id === g.subjectId);
                        });

                        const allRows = [
                          ...rows,
                          ...extraGrades.map((g) => {
                            const sObj = subjects.find((sub) => sub.id === g.subjectId);
                            return {
                              name: sObj ? sObj.name : "Other Subject",
                              grade: g
                            };
                          })
                        ];

                        return allRows.map((row, index) => {
                          const g = row.grade;
                          const gradeInfo = g ? getGradeDetails(g.totalScore) : null;
                          return (
                            <tr key={index} className="hover:bg-[#E8E5FC]/20 print:hover:bg-transparent">
                              <td className="p-1.5 pl-3 border-r border-[#7285DE] font-bold text-slate-800 bg-white">
                                {row.name}
                              </td>
                              <td className="p-1.5 text-center border-r border-[#7285DE] font-mono text-slate-700 font-bold bg-white">
                                {g ? g.classScore : ''}
                              </td>
                              <td className="p-1.5 text-center border-r border-[#7285DE] font-mono text-slate-700 font-bold bg-white">
                                {g ? g.examScore : ''}
                              </td>
                              <td className="p-1.5 text-center border-r border-[#7285DE] font-mono font-extrabold text-[#3B4CA3] bg-white">
                                {g ? g.totalScore : ''}
                              </td>
                              <td className="p-1.5 pr-3 text-center text-slate-600 italic font-medium text-[9px] print:text-[8px] bg-white">
                                {g ? gradeInfo?.remarks : ''}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Combined Bottom Section in 2 Columns to guarantee fitting inside a single A4 page */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2 print:gap-3">
                  {/* Left Column: Attendance & Bills */}
                  <div className="space-y-3 print:space-y-2">
                    {/* Attendance, Attitude & Conduct */}
                    <div className="overflow-hidden border-2 border-[#7285DE] rounded bg-white shadow-sm">
                      <table className="w-full text-left border-collapse font-serif text-[10px]">
                        <thead>
                          <tr className="bg-[#B5C4F7] text-[#2B3B63] font-extrabold text-[8px] uppercase tracking-wider border-b border-[#7285DE] text-center">
                            <th className="p-1 border-r border-[#7285DE]">ATTENDANCE</th>
                            <th className="p-1 border-r border-[#7285DE]">ATTITUDE</th>
                            <th className="p-1">CONDUCT</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-center font-medium text-slate-700 leading-normal">
                            <td className="p-1.5 border-r border-[#7285DE] bg-[#E8E5FC]/10">
                              {attendance ? (
                                <div className="space-y-0.5">
                                  <div className="text-slate-900 font-extrabold text-[9px]">
                                    Present: <span className="text-green-700 font-mono">{attendance.daysPresent}</span> / <span className="font-mono">{attendance.totalDays}</span>
                                  </div>
                                  <div className="text-[8px] text-gray-500">
                                    Absent: <span className="text-rose-600 font-mono">{attendance.totalDays - attendance.daysPresent}</span> days
                                  </div>
                                  <div className="text-[8px] uppercase tracking-wider text-[#4A3B94] font-bold">
                                    Rate: {((attendance.daysPresent / attendance.totalDays) * 100).toFixed(0)}%
                                  </div>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-[8px]">No attendance logged</span>
                              )}
                            </td>
                            <td className="p-1.5 border-r border-[#7285DE] italic text-slate-800 bg-[#E8E5FC]/5 text-[9px] px-2">
                              {studentAverage >= 80 ? '"Very helpful, active, and respectful."' : studentAverage >= 60 ? '"Attentive, eager to learn, and friendly."' : '"Shows a positive attitude and tries well."'}
                            </td>
                            <td className="p-1.5 italic text-slate-800 bg-[#E8E5FC]/10 text-[9px] px-2">
                              {attendance?.remarks ? `"${attendance.remarks}"` : '"Very obedient, well-behaved and polite."'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bills Section */}
                    <div className="border-2 border-[#7285DE] bg-[#EBF1FE] rounded p-2.5 shadow-sm">
                      <h3 className="font-serif font-extrabold text-[9px] text-[#2B3B63] text-center uppercase tracking-widest italic underline mb-1.5">
                        BILLS SUMMARY
                      </h3>
                      <div className="space-y-1 text-[9px] text-slate-800 font-serif">
                        <div className="flex justify-between items-center">
                          <span className="italic font-bold">Arrears:</span>
                          <span className="grow mx-1 border-b border-dotted border-slate-400 opacity-60"></span>
                          <span className="font-mono font-bold text-slate-900">GH₵ {currentArrears}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="italic font-bold">Next term tuition:</span>
                          <span className="grow mx-1 border-b border-dotted border-slate-400 opacity-60"></span>
                          <span className="font-mono font-bold text-slate-900">GH₵ {currentTuition}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="italic font-bold">Computing Levy:</span>
                          <span className="grow mx-1 border-b border-dotted border-slate-400 opacity-60"></span>
                          <span className="font-mono font-bold text-slate-900">GH₵ {currentComputing}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="italic font-bold">Utility:</span>
                          <span className="grow mx-1 border-b border-dotted border-slate-400 opacity-60"></span>
                          <span className="font-mono font-bold text-slate-900">GH₵ {currentUtility}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="italic font-bold">Stationery:</span>
                          <span className="grow mx-1 border-b border-dotted border-slate-400 opacity-60"></span>
                          <span className="font-mono font-bold text-slate-900">GH₵ {currentStationery}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="italic font-bold">PTA:</span>
                          <span className="grow mx-1 border-b border-dotted border-slate-400 opacity-60"></span>
                          <span className="font-mono font-bold text-slate-900">GH₵ {currentPta}</span>
                        </div>
                        <div className="pt-1 border-t border-[#7285DE] flex justify-between items-center font-extrabold text-[#2B3B63] uppercase text-[9px] mt-1.5">
                          <span>TOTAL FEES:</span>
                          <span className="grow mx-1"></span>
                          <span className="font-mono text-[10px] text-[#3B4CA3]">GH₵ {totalBillSum.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Comments & Signatures */}
                  <div className="flex flex-col justify-between space-y-3 print:space-y-2 h-full">
                    {/* General comments box */}
                    <div className="bg-white/80 p-3 rounded border border-[#7285DE]/40 italic text-slate-700 text-[10px] leading-relaxed shadow-sm print:p-2">
                      <span className="block not-italic font-bold text-[#4A3B94] uppercase tracking-wider text-[8px] mb-1">Principal's Remarks</span>
                      {customPrincipalComment ? `"${customPrincipalComment}"` : (attendance?.remarks ? `"${attendance.remarks}"` : '"Keep up the wonderful energy! Extremely proud of your terminal steps."')}
                    </div>

                    {/* Headmistress Contact info */}
                    <div className="border border-slate-300 rounded p-1.5 text-center bg-white shadow-sm">
                      <span className="block text-[8px] uppercase font-bold text-slate-600 italic tracking-wider leading-none">Headmistress' contact</span>
                      <span className="block font-mono font-bold text-[11px] text-[#4A3B94] mt-0.5">{currentContact}</span>
                    </div>

                    {/* Bottom: Academy Crest circular seal & Standing Bee Mascot nested beautifully */}
                    <div className="flex items-center justify-around gap-4 pt-1 bg-white/40 p-1.5 rounded border border-[#A899F7]/10">
                      {/* Academy Crest Circular Seal */}
                      <div className="w-14 h-14 border border-[#A899F7]/30 p-1 bg-white rounded shadow-sm flex items-center justify-center">
                        <SchoolSealSVG className="w-full h-full" />
                      </div>
                      {/* Standing Bee Mascot */}
                      <div className="w-12 h-12">
                        <StandingBeeSVG className="w-full h-full" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : isHighFidelityTemplate ? (
            /* ========================================================
               JHS & PRIMARY CUSTOM TEMPLATE (COMBINED IMAGES 1 & 2)
               ======================================================== */
            <div className="font-serif text-[#1e293b] space-y-4 print:space-y-2">
              {/* Image 1 Header Section */}
              <div className="relative border-b-2 border-slate-900 pb-3 pt-2 print:pb-2 print:pt-1">
                {/* Left vertical block */}
                <div className="absolute left-0 top-0 w-8 h-12 bg-blue-700 rounded-sm" />
                
                {/* Right angled slice banner with star */}
                <div 
                  className="absolute right-0 top-0 w-36 h-24 bg-blue-700 text-white flex items-start justify-end p-4 select-none pointer-events-none"
                  style={{
                    clipPath: 'polygon(100% 0, 100% 100%, 30% 0)'
                  }}
                >
                  <span className="text-white text-lg font-bold absolute right-4 top-4">★</span>
                </div>

                <div className="text-center px-12 flex flex-col items-center justify-center">
                  {showLogo && (
                    config.schoolLogoUrl ? (
                      <img 
                        src={config.schoolLogoUrl} 
                        alt={`${config.schoolName} logo`} 
                        className="w-16 h-16 object-contain rounded shadow-sm mb-2 shrink-0 print:w-12 print:h-12"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded bg-blue-700 text-white font-serif font-extrabold text-xl flex items-center justify-center shadow-sm mb-2 shrink-0 select-none print:w-12 print:h-12 print:text-lg">
                        {config.schoolLogoText || 'EA'}
                      </div>
                    )
                  )}
                  <h1 className="font-serif font-extrabold text-xl sm:text-2xl tracking-widest text-slate-900 uppercase leading-none print:text-lg">
                    {config.schoolName}
                  </h1>
                  <h2 className="font-serif font-extrabold text-xs sm:text-sm tracking-wider text-slate-800 uppercase mt-1.5">
                    STUDENT REPORT CARD FOR {student.level}
                  </h2>
                </div>
              </div>

              {/* Bio Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 sm:gap-y-4 gap-x-6 py-3 px-2 text-[11px] font-serif border-b border-gray-300 print:py-1.5 print:gap-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-slate-700 whitespace-nowrap uppercase tracking-wider">NAME:</span>
                  <span className="border-b border-dashed border-slate-400 grow font-extrabold text-slate-900 uppercase px-1">{student.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-slate-700 whitespace-nowrap uppercase tracking-wider">YEAR:</span>
                  <span className="border-b border-dashed border-slate-400 grow font-extrabold text-slate-900 uppercase px-1">{config.schoolYear}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-slate-700 whitespace-nowrap uppercase tracking-wider">GRADE:</span>
                  <span className="border-b border-dashed border-slate-400 grow font-extrabold text-slate-900 uppercase px-1">{student.className}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-slate-700 whitespace-nowrap uppercase tracking-wider">TERM:</span>
                  <span className="border-b border-dashed border-slate-400 grow font-extrabold text-slate-900 uppercase px-1">{config.term}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-slate-700 whitespace-nowrap uppercase tracking-wider">REOPENING:</span>
                  <span className="border-b border-dashed border-slate-400 grow font-extrabold text-slate-900 uppercase px-1">{currentReopening}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-extrabold text-slate-700 whitespace-nowrap uppercase tracking-wider">NO. ON ROLL:</span>
                  <span className="border-b border-dashed border-slate-400 grow font-extrabold text-slate-900 uppercase px-1">{customClassRoll}</span>
                </div>
              </div>

              {/* Transcript Table */}
              <div className="overflow-hidden border border-slate-900 rounded-sm">
                <table className="w-full text-left border-collapse font-serif text-xs">
                  <thead>
                    <tr className="bg-[#709ED9] text-slate-900 font-extrabold text-[11px] uppercase tracking-wider border-b border-slate-950">
                      <th className="p-1.5 sm:p-2 pl-3 sm:pl-4 border-r border-slate-900 bg-white">Subject</th>
                      <th className="p-1.5 sm:p-2 text-center w-36 border-r border-slate-900 print:w-28 bg-white">Class score (50%)</th>
                      <th className="p-1.5 sm:p-2 text-center w-36 border-r border-slate-900 print:w-28 bg-white">Exam score (50%)</th>
                      <th className="p-1.5 sm:p-2 text-center w-32 border-r border-slate-900 print:w-24 bg-white">Total score (100%)</th>
                      <th className="p-1.5 sm:p-2 pr-3 sm:pr-4 text-center bg-white">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-400 text-xs text-slate-800">
                    {(() => {
                      // Dynamically choose standard subjects based on academic level from the database/teachers portal
                      const levelSubjects = subjects.filter(sub => sub.level === student.level);

                      // Map the student's actual grades to these subjects
                      const rows = levelSubjects.map((sub) => {
                        const matchedGrade = studentGrades.find((g) => g.subjectId === sub.id);
                        return {
                          name: sub.name,
                          grade: matchedGrade
                        };
                      });

                      // Also find any grades that didn't match the level subjects
                      const extraGrades = studentGrades.filter((g) => {
                        return !levelSubjects.some((sub) => sub.id === g.subjectId);
                      });

                      const allRows = [
                        ...rows,
                        ...extraGrades.map((g) => {
                          const sObj = subjects.find((sub) => sub.id === g.subjectId);
                          return {
                            name: sObj ? sObj.name : "Other Subject",
                            grade: g
                          };
                        })
                      ];

                      return allRows.map((row, index) => {
                        const g = row.grade;
                        const gradeInfo = g ? getGradeDetails(g.totalScore) : null;
                        return (
                          <tr key={index} className="hover:bg-slate-50/50">
                            <td className="p-1.5 pl-3 sm:p-2 sm:pl-4 print:p-0.5 print:pl-2 border-r border-slate-900 font-extrabold text-slate-900 text-[11px] print:text-[10px] bg-white">
                              {row.name}
                            </td>
                            <td className="p-1.5 sm:p-2 print:p-0.5 text-center border-r border-slate-900 font-mono text-slate-800 font-bold text-[11px] print:text-[10px] bg-white">
                              {g ? g.classScore : ''}
                            </td>
                            <td className="p-1.5 sm:p-2 print:p-0.5 text-center border-r border-slate-900 font-mono text-slate-800 font-bold text-[11px] print:text-[10px] bg-white">
                              {g ? g.examScore : ''}
                            </td>
                            <td className="p-1.5 sm:p-2 print:p-0.5 text-center border-r border-slate-900 font-mono font-extrabold text-blue-900 text-[11px] print:text-[10px] bg-white">
                              {g ? g.totalScore : ''}
                            </td>
                            <td className="p-1.5 pr-3 sm:p-2 sm:pr-4 print:p-0.5 print:pr-2 text-center text-slate-600 italic font-medium text-[10px] print:text-[9px] bg-white">
                              {g ? gradeInfo?.remarks : ''}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Attendance Bar */}
              <div className="py-1.5 print:py-0.5 text-center font-serif text-[11px] font-extrabold text-slate-900 uppercase tracking-wider">
                ATTENDANCE: <span className="border-b border-slate-900 px-6 font-mono font-bold text-blue-800">{attendance?.daysPresent ?? '_'}</span> OUT OF <span className="border-b border-slate-900 px-6 font-mono font-bold text-blue-800">{attendance?.totalDays ?? '_'}</span>
              </div>

              {/* Combined Image 2 Custom Card (Bills + General Comments) */}
              <div className="relative border-2 border-slate-900 bg-[#EAF2FC] p-4 sm:p-5 print:p-3 rounded-sm overflow-hidden min-h-[160px] print:min-h-0">
                {/* Diagonal slice decor background */}
                <div 
                  className="absolute right-0 top-0 w-[45%] h-full bg-[#D4E4F7] z-0 opacity-80 print:bg-[#D4E4F7] select-none pointer-events-none"
                  style={{
                    clipPath: 'polygon(25% 0, 100% 0, 100% 100%, 0% 100%)'
                  }}
                />

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  {/* BILLS section */}
                  <div className="font-serif">
                    <h3 className="text-xs font-extrabold text-blue-900 uppercase italic underline tracking-wider mb-2 print:mb-1.5">
                      BILLS
                    </h3>
                    <div className="space-y-1 text-xs text-slate-800 font-serif">
                      <div className="flex justify-between max-w-[260px]">
                        <span className="italic">Arrears:</span>
                        <span className="font-mono font-bold text-slate-900">GH₵ {currentArrears}</span>
                      </div>
                      <div className="flex justify-between max-w-[260px]">
                        <span className="italic">Next term tuition:</span>
                        <span className="font-mono font-bold text-slate-900">GH₵ {currentTuition}</span>
                      </div>
                      <div className="flex justify-between max-w-[260px]">
                        <span className="italic">Computing Levy:</span>
                        <span className="font-mono font-bold text-slate-900">GH₵ {currentComputing}</span>
                      </div>
                      <div className="flex justify-between max-w-[260px]">
                        <span className="italic">Utility:</span>
                        <span className="font-mono font-bold text-slate-900">GH₵ {currentUtility}</span>
                      </div>
                      <div className="flex justify-between max-w-[260px]">
                        <span className="italic">Stationery:</span>
                        <span className="font-mono font-bold text-slate-900">GH₵ {currentStationery}</span>
                      </div>
                      <div className="flex justify-between max-w-[260px]">
                        <span className="italic">PTA:</span>
                        <span className="font-mono font-bold text-slate-900">GH₵ {currentPta}</span>
                      </div>
                      <div className="pt-1.5 border-t border-slate-900 max-w-[260px] flex justify-between font-extrabold text-slate-950 uppercase text-xs">
                        <span>TOTAL:</span>
                        <span className="font-mono">GH₵ {totalBillSum.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Comments section */}
                  <div className="font-serif flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-extrabold text-blue-900 uppercase italic underline tracking-wider mb-2 print:mb-1.5">
                        General Comments
                      </h3>
                      <p className="text-xs text-slate-800 italic leading-relaxed bg-white/70 p-2.5 sm:p-3 print:p-2 rounded border border-slate-300 min-h-[40px] print:min-h-0">
                        {customPrincipalComment ? `"${customPrincipalComment}"` : (attendance?.remarks ? `"${attendance.remarks}"` : '"There is still more room for improvement."')}
                      </p>
                    </div>

                    <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-slate-400/30 print:mt-1.5 print:pt-1">
                      <span className="block text-[9px] uppercase font-extrabold text-slate-600 italic">Headmistress' contact</span>
                      <span className="block font-mono font-bold text-xs text-blue-950 mt-0.5">{currentContact}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================
               DEFAULT NURSERY/PRIMARY TEMPLATE
               ======================================================== */
            <>
              {/* 1. School Header Section */}
              <div className="flex flex-col md:flex-row justify-between items-center md:items-start text-center md:text-left border-b border-mauve-500/20 pb-4 gap-4">
                <div className="flex items-center gap-3">
                  {showLogo && (
                    config.schoolLogoUrl ? (
                      <img 
                        src={config.schoolLogoUrl} 
                        alt={`${config.schoolName} logo`} 
                        className="w-14 h-14 object-contain rounded shadow shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded bg-mauve-900 text-white font-display font-extrabold text-xl flex items-center justify-center shadow shrink-0">
                        {config.schoolLogoText}
                      </div>
                    )
                  )}
                  <div>
                    <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-mauve-900 uppercase">
                      {config.schoolName}
                    </h1>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-mauve-900/60 mt-0.5">
                      Academic Report & Transcript
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      P.O. Box 24, Legon-Accra, Ghana | info@eastfieldacademy.edu.gh
                    </p>
                  </div>
                </div>

                <div className="bg-mauve-50 px-3 py-1.5 rounded text-center md:text-right border border-mauve-500/10 shrink-0">
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-gray-400">Academic Season</span>
                  <span className="block font-bold text-mauve-900 text-xs mt-0.5">{config.schoolYear}</span>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-mauve-900 text-white text-[9px] font-bold rounded uppercase tracking-wider">
                    {config.term}
                  </span>
                </div>
              </div>

              {/* 2. Student Bio Meta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-mauve-50 rounded border border-mauve-500/15 text-xs">
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-gray-400 font-semibold">Student Fullname</span>
                  <span className="font-bold text-gray-900 text-xs mt-0.5 block truncate">{student.name}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-gray-400 font-semibold">Class Identifier</span>
                  <span className="font-bold text-gray-900 text-xs mt-0.5 block">{student.className}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-gray-400 font-semibold">Roll ID</span>
                  <span className="font-mono text-xs font-bold text-mauve-900 mt-0.5 block">{customRollNumber}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-gray-400 font-semibold">Academy Level</span>
                  <span className="font-bold text-gray-900 text-xs mt-0.5 block uppercase">{student.level}</span>
                </div>
              </div>

              {/* 3. Performance Summary Badges */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded border border-mauve-500/15 bg-white shadow-sm flex flex-col items-center justify-center">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 font-semibold">Subjects Recorded</span>
                  <span className="text-lg font-display font-bold text-mauve-900 mt-0.5">
                    {totalSubjectsCount}
                  </span>
                </div>
                <div className={`p-3 rounded border border-mauve-500/15 bg-white shadow-sm flex flex-col items-center justify-center font-bold ${getAverageColor(studentAverage)}`}>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 font-semibold">Terminal Average</span>
                  <span className="text-lg font-display font-bold mt-0.5">
                    {studentAverage.toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 rounded border border-mauve-500/15 bg-white shadow-sm flex flex-col items-center justify-center">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-gray-400 font-semibold">Class Rank</span>
                  <span className="text-lg font-display font-bold text-mauve-900 mt-0.5">
                    {studentRank} <span className="text-xs text-gray-400 font-normal">of {customClassRoll}</span>
                  </span>
                </div>
              </div>

              {/* 4. Main Grades Transcript Table */}
              <div className="overflow-hidden border border-mauve-500/20 rounded">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-mauve-900 text-white font-bold text-[11px] uppercase tracking-wide">
                      <th className="p-3 pl-4 bg-white text-mauve-900 border-b border-mauve-100">Subject Details</th>
                      <th className="p-3 text-center w-36 bg-white text-mauve-900 border-b border-mauve-100">Class Score (30%)</th>
                      <th className="p-3 text-center w-36 bg-white text-mauve-900 border-b border-mauve-100">Exam Score (70%)</th>
                      <th className="p-3 text-center w-32 font-bold bg-white text-mauve-900 border-b border-mauve-100">Total (100%)</th>
                      <th className="p-3 pr-4 text-center bg-white text-mauve-900 border-b border-mauve-100">Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mauve-50 text-xs text-gray-800">
                    {studentGrades.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-400 font-medium">
                          No grades entered for this student yet.
                        </td>
                      </tr>
                    ) : (
                      studentGrades.map((g, index) => {
                        const matchedSub = subjects.find((sub) => sub.id === g.subjectId);
                        const gradeInfo = getGradeDetails(g.totalScore);
                        return (
                           <tr key={`${g.subjectId}-${index}`} className="hover:bg-mauve-50/10">
                            <td className="p-3 pl-4 bg-white">
                              <span className="block font-bold text-gray-900">
                                {matchedSub ? matchedSub.name : 'Unknown Subject'}
                              </span>
                              <span className="font-mono text-[9px] text-mauve-500 uppercase tracking-wider">
                                {matchedSub ? matchedSub.code : 'SUB'}
                              </span>
                            </td>
                            <td className="p-3 text-center font-mono text-gray-700 font-bold bg-white">{g.classScore}</td>
                            <td className="p-3 text-center font-mono text-gray-700 font-bold bg-white">{g.examScore}</td>
                            <td className="p-3 text-center font-mono font-bold text-mauve-900 bg-white">{g.totalScore}</td>
                            <td className="p-3 pr-4 text-center text-gray-500 italic text-[11px] bg-white">
                              {gradeInfo.remarks}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* 5. Attendance & Conduct Section */}
              {showAttendanceCard && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded border border-mauve-500/15 bg-mauve-50/30">
                  <div>
                    <h3 className="font-display font-bold text-xs text-mauve-900 flex items-center gap-1 mb-2 uppercase tracking-wide">
                      <Check className="w-3.5 h-3.5 text-mauve-900" />
                      Attendance Summary
                    </h3>
                    {attendance ? (
                      <div className="space-y-1 text-xs text-gray-700">
                        <div className="flex justify-between">
                          <span>School Open Days:</span>
                          <span className="font-bold">{attendance.totalDays} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Days Student Present:</span>
                          <span className="font-bold text-green-700">{attendance.daysPresent} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Days Absent:</span>
                          <span className="font-bold text-rose-600">
                            {attendance.totalDays - attendance.daysPresent} days
                          </span>
                        </div>
                        <div className="pt-1 border-t border-mauve-500/10 flex justify-between font-bold text-mauve-900 uppercase text-[10px]">
                          <span>Attendance Rate:</span>
                          <span>
                            {((attendance.daysPresent / attendance.totalDays) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">No attendance record logged yet. Click Customize to set.</div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-display font-bold text-xs text-mauve-900 flex items-center gap-1 mb-2 uppercase tracking-wide">
                      <FileText className="w-3.5 h-3.5 text-mauve-900" />
                      Conduct & Attitude Review
                    </h3>
                    <p className="text-xs text-gray-600 italic leading-relaxed bg-white p-2.5 rounded border border-mauve-500/15">
                      "{attendance?.remarks || 'No behavioral remarks logged this term.'}"
                    </p>
                  </div>
                </div>
              )}

              {/* 6. Signature Block */}
              {showSignature && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-mauve-500/10 pt-4">
                  <div className="space-y-2">
                    <span className="block text-[9px] uppercase font-mono tracking-wider text-gray-400 font-semibold">
                      Class Teacher's Authentication
                    </span>
                    <div className="h-12 flex items-end">
                      <div className="border-b border-gray-300 w-full pb-1 text-xs text-gray-500 italic">
                        <span className="font-serif text-mauve-900 tracking-wider">Eastfield Teacher Stamp</span>
                      </div>
                    </div>
                    <div className="text-[10px]">
                      <span className="block font-bold text-gray-800">Class Teacher Code: ET-{student.className.replace(/\s+/g, '')}</span>
                      <span className="text-gray-400">Eastfield Academy Staff</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-[9px] uppercase font-mono tracking-wider text-gray-400 font-semibold">
                      Principal's Endorsement & Stamp
                    </span>
                    <div className="h-12 flex items-end">
                      <div className="border-b border-gray-300 w-full pb-1 text-xs text-gray-500 italic relative">
                        <div className="absolute right-2 bottom-2 px-2 py-0.5 border border-rose-500/30 text-rose-500 text-[8px] uppercase tracking-wider font-mono font-bold rounded rotate-[-4deg] opacity-70">
                          Eastfield Approved
                        </div>
                        <span className="font-serif text-mauve-900 font-bold text-sm tracking-wider">
                          {config.principalName}
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] leading-relaxed">
                      <span className="block font-bold text-gray-800">Head Principal Office</span>
                      <p className="text-[10px] text-gray-500 mt-1 italic leading-normal">
                        {customPrincipalComment ? `"${customPrincipalComment}"` : 'Excellent terminal outcome. Recommended for promotional pathways with outstanding merit.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 7. Grading System Index Footer */}
              {showGradingScale && (
                <div className="border-t border-mauve-500/10 pt-4 text-center">
                  <span className="inline-block text-[8px] uppercase font-mono tracking-widest text-gray-400 mb-2">
                    Official Transcript Evaluation Index (Ghanaian Standard Code)
                  </span>
                  <div className="flex flex-wrap justify-center gap-1.5 max-w-xl mx-auto">
                    {config.gradingScale.map((scale) => (
                      <div 
                        key={scale.grade}
                        className="px-1.5 py-0.5 bg-mauve-50 rounded border border-mauve-500/10 text-[9px] text-gray-600 flex items-center gap-1 font-mono"
                      >
                        <span className="font-bold text-mauve-900">{scale.remarks}:</span>
                        <span>{scale.minScore.toFixed(0)}-{scale.maxScore.toFixed(0)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
