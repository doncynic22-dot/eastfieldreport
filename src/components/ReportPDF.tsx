/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Student, Grade, Attendance, Subject, ReportConfig, StudentBill } from '../types';
import { getNextClassAndLevel } from '../services/promotionService';
import { Printer, Check, Settings2, FileText, Sparkles, ExternalLink, Sliders, GraduationCap, Download, Mail, MessageSquare, Share2, Copy, CheckCircle2, Phone, X, Edit2 } from 'lucide-react';
import { generateEmailReportBody, sendGuardianEmail, sendWhatsAppReport } from '../services/emailDispatcher';
import { sendArkeselSingleSMS, interpolateReportCardTemplate, DEFAULT_REPORT_CARD_SMS_TEMPLATES } from '../services/arkeselSmsService';
import { findMatchingGrade, matchesSubject } from '../utils/subjectUtils';
import { formatReopeningDate } from '../utils/dateUtils';
import { saveSupabaseConfig } from '../lib/supabase';

interface ReportPDFProps {
  student: Student;
  bills?: StudentBill[];
  onUpdateBill?: (bill: StudentBill) => void;
  grades: Grade[];
  attendance?: Attendance;
  subjects: Subject[];
  config: ReportConfig;
  setConfig?: React.Dispatch<React.SetStateAction<ReportConfig>>;
  allClassStudents: Student[];
  allGrades: Grade[]; // Used for rank calculation
  onUpdateAttendance?: (daysPresent: number, totalDays: number, remarks?: string) => void;
  onUpdateGrade?: (subjectId: string, classScore: number, examScore: number, nurseryRemark?: 'MO' | 'O' | 'S' | 'NA') => void;
  isBulkMode?: boolean;
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
  bills,
  onUpdateBill,
  grades,
  attendance,
  subjects,
  config,
  setConfig,
  allClassStudents,
  allGrades,
  onUpdateAttendance,
  onUpdateGrade,
  isBulkMode = false
}: ReportPDFProps) {
  // Customization options state
  const [showLogo, setShowLogo] = useState(true);
  const [showGradingScale, setShowGradingScale] = useState(true);
  const [showAttendanceCard, setShowAttendanceCard] = useState(true);
  const [showSignature, setShowSignature] = useState(true);
  const [customPrincipalComment, setCustomPrincipalComment] = useState('');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [isEditingAssessments, setIsEditingAssessments] = useState(false);

  const [customRollNumber, setCustomRollNumber] = useState(student.rollNumber);
  const [customClassRoll, setCustomClassRoll] = useState(allClassStudents.length);

  // Arkesel Report Card SMS Modal States
  const [showArkeselSmsModal, setShowArkeselSmsModal] = useState(false);
  const [arkeselSmsMsg, setArkeselSmsMsg] = useState('');
  const [isSendingArkeselSms, setIsSendingArkeselSms] = useState(false);
  const [arkeselSmsResult, setArkeselSmsResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Check if current config term is Third Term
  const termLower = (config.term || '').toLowerCase();
  const isThirdTerm = termLower.includes('3') || termLower.includes('third');

  // Promotional Status options
  const initialNextClass = getNextClassAndLevel(student.className, student.level);
  const [showPromotionStatus, setShowPromotionStatus] = useState(true);
  const [promotionDecision, setPromotionDecision] = useState<'PROMOTED' | 'RETAINED' | 'GRADUATED' | 'CUSTOM'>(
    initialNextClass.isGraduated ? 'GRADUATED' : 'PROMOTED'
  );
  const [promotedToClass, setPromotedToClass] = useState(initialNextClass.nextClass);
  const [customPromotionText, setCustomPromotionText] = useState(
    initialNextClass.isGraduated ? 'GRADUATED' : `PROMOTED TO ${initialNextClass.nextClass.toUpperCase()}`
  );

  useEffect(() => {
    const info = getNextClassAndLevel(student.className, student.level);
    setPromotionDecision(info.isGraduated ? 'GRADUATED' : 'PROMOTED');
    setPromotedToClass(info.nextClass);
    setCustomPromotionText(info.isGraduated ? 'GRADUATED' : `PROMOTED TO ${info.nextClass.toUpperCase()}`);
  }, [student.id, student.className, student.level]);

  const getPromotionBadgeText = () => {
    if (promotionDecision === 'PROMOTED') {
      return `PROMOTED TO ${promotedToClass.toUpperCase()}`;
    } else if (promotionDecision === 'RETAINED') {
      return `RETAINED IN ${student.className.toUpperCase()}`;
    } else if (promotionDecision === 'GRADUATED') {
      return `GRADUATED FROM ${config.schoolName.toUpperCase()}`;
    } else {
      return customPromotionText.toUpperCase();
    }
  };

  useEffect(() => {
    setCustomRollNumber(student.rollNumber);
  }, [student.rollNumber]);

  useEffect(() => {
    setCustomClassRoll(allClassStudents.length);
  }, [allClassStudents.length]);

  // JHS Customization options
  const defaultReopening = config.reopeningDate || '15th September, 2026';
  const [jhsReopening, setJhsReopening] = useState(defaultReopening);
  const [jhsContact, setJhsContact] = useState('0249321874');
  const [jhsArrears, setJhsArrears] = useState('825.00');
  const [jhsTuition, setJhsTuition] = useState('730.00');
  const [jhsComputing, setJhsComputing] = useState('20.00');
  const [jhsUtility, setJhsUtility] = useState('25.00');
  const [jhsStationery, setJhsStationery] = useState('30.00');
  const [jhsPta, setJhsPta] = useState('20.00');

  // Primary Customization options
  const [primaryReopening, setPrimaryReopening] = useState(defaultReopening);
  const [primaryContact, setPrimaryContact] = useState('0249321874');
  const [primaryArrears, setPrimaryArrears] = useState('0.00');
  const [primaryTuition, setPrimaryTuition] = useState('600.00');
  const [primaryComputing, setPrimaryComputing] = useState('20.00');
  const [primaryUtility, setPrimaryUtility] = useState('25.00');
  const [primaryStationery, setPrimaryStationery] = useState('30.00');
  const [primaryPta, setPrimaryPta] = useState('20.00');

  // Nursery/KG Customization options
  const [nurseryReopening, setNurseryReopening] = useState(defaultReopening);
  const [nurseryContact, setNurseryContact] = useState('0249321874');
  const [nurseryArrears, setNurseryArrears] = useState('0.00');
  const [nurseryTuition, setNurseryTuition] = useState('450.00');
  const [nurseryComputing, setNurseryComputing] = useState('15.00');
  const [nurseryUtility, setNurseryUtility] = useState('15.00');
  const [nurseryStationery, setNurseryStationery] = useState('20.00');
  const [nurseryPta, setNurseryPta] = useState('10.00');

  useEffect(() => {
    const saved = bills?.find(b => b.studentId === student.id);
    const globalReopening = config.reopeningDate || '15th September, 2026';
    const savedReopening = saved?.reopeningDate;
    const isLegacyDefault = (d?: string) => !d || d === '15th September, 2026' || d === '2026-09-15';

    // Prioritize custom global config first, then custom student bill reopening date, then fallback
    const effectiveReopening = !isLegacyDefault(config.reopeningDate)
      ? config.reopeningDate!
      : (!isLegacyDefault(savedReopening) ? savedReopening! : globalReopening);

    setJhsArrears(saved?.arrears ?? '825.00');
    setJhsTuition(saved?.tuition ?? '730.00');
    setJhsComputing(saved?.computing ?? '20.00');
    setJhsUtility(saved?.utility ?? '25.00');
    setJhsStationery(saved?.stationery ?? '30.00');
    setJhsPta(saved?.pta ?? '20.00');
    setJhsReopening(effectiveReopening);
    setJhsContact(saved?.contactNumber || '0249321874');

    setPrimaryArrears(saved?.arrears ?? '0.00');
    setPrimaryTuition(saved?.tuition ?? '600.00');
    setPrimaryComputing(saved?.computing ?? '20.00');
    setPrimaryUtility(saved?.utility ?? '25.00');
    setPrimaryStationery(saved?.stationery ?? '30.00');
    setPrimaryPta(saved?.pta ?? '20.00');
    setPrimaryReopening(effectiveReopening);
    setPrimaryContact(saved?.contactNumber || '0249321874');

    setNurseryArrears(saved?.arrears ?? '0.00');
    setNurseryTuition(saved?.tuition ?? '450.00');
    setNurseryComputing(saved?.computing ?? '15.00');
    setNurseryUtility(saved?.utility ?? '15.00');
    setNurseryStationery(saved?.stationery ?? '20.00');
    setNurseryPta(saved?.pta ?? '10.00');
    setNurseryReopening(effectiveReopening);
    setNurseryContact(saved?.contactNumber || '0249321874');
  }, [student.id, bills, config.reopeningDate, student.level]);

  const clsUpper = (student.className || '').toUpperCase();
  const isKg = student.level === 'KINDERGARTEN' || clsUpper.includes('KG') || clsUpper.includes('KINDERGARTEN');
  const isNurseryLevel = !isKg && (student.level === 'NURSERY' || clsUpper.includes('NURSERY') || clsUpper.includes('N1') || clsUpper.includes('N2'));
  const effectiveLevel = isKg ? 'KINDERGARTEN' : (isNurseryLevel ? 'NURSERY' : (student.level === 'JHS' ? 'JHS' : 'PRIMARY'));

  const templateStyle = config.selectedTemplate || 'dynamic';
  const isCompactTemplate = templateStyle === 'compact' || (templateStyle === 'dynamic' && (isNurseryLevel || isKg));
  const isHighFidelityTemplate = templateStyle === 'high-fidelity' || (templateStyle === 'dynamic' && !isNurseryLevel && !isKg);

  const isJHS = effectiveLevel === 'JHS';
  const isPrimary = effectiveLevel === 'PRIMARY';
  const isNursery = isNurseryLevel;

  const currentReopening = isJHS ? jhsReopening : (isPrimary ? primaryReopening : nurseryReopening);
  const currentContact = isJHS ? jhsContact : (isPrimary ? primaryContact : nurseryContact);
  const currentArrears = isJHS ? jhsArrears : (isPrimary ? primaryArrears : nurseryArrears);
  const currentTuition = isJHS ? jhsTuition : (isPrimary ? primaryTuition : nurseryTuition);
  const currentComputing = isJHS ? jhsComputing : (isPrimary ? primaryComputing : nurseryComputing);
  const currentUtility = isJHS ? jhsUtility : (isPrimary ? primaryUtility : nurseryUtility);
  const currentStationery = isJHS ? jhsStationery : (isPrimary ? primaryStationery : nurseryStationery);
  const currentPta = isJHS ? jhsPta : (isPrimary ? primaryPta : nurseryPta);

  const handleBillFieldChange = (field: keyof StudentBill, value: string) => {
    if (student.level === 'JHS') {
      if (field === 'arrears') setJhsArrears(value);
      if (field === 'tuition') setJhsTuition(value);
      if (field === 'computing') setJhsComputing(value);
      if (field === 'utility') setJhsUtility(value);
      if (field === 'stationery') setJhsStationery(value);
      if (field === 'pta') setJhsPta(value);
      if (field === 'reopeningDate') setJhsReopening(value);
      if (field === 'contactNumber') setJhsContact(value);
    } else if (student.level === 'PRIMARY') {
      if (field === 'arrears') setPrimaryArrears(value);
      if (field === 'tuition') setPrimaryTuition(value);
      if (field === 'computing') setPrimaryComputing(value);
      if (field === 'utility') setPrimaryUtility(value);
      if (field === 'stationery') setPrimaryStationery(value);
      if (field === 'pta') setPrimaryPta(value);
      if (field === 'reopeningDate') setPrimaryReopening(value);
      if (field === 'contactNumber') setPrimaryContact(value);
    } else {
      if (field === 'arrears') setNurseryArrears(value);
      if (field === 'tuition') setNurseryTuition(value);
      if (field === 'computing') setNurseryComputing(value);
      if (field === 'utility') setNurseryUtility(value);
      if (field === 'stationery') setNurseryStationery(value);
      if (field === 'pta') setNurseryPta(value);
      if (field === 'reopeningDate') setNurseryReopening(value);
      if (field === 'contactNumber') setNurseryContact(value);
    }

    if (field === 'reopeningDate' && value && value.trim()) {
      if (setConfig) {
        setConfig(prev => {
          const updated = { ...prev, reopeningDate: value };
          localStorage.setItem('ea_config', JSON.stringify(updated));
          localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updated));
          saveSupabaseConfig(updated).catch(err => console.warn('Supabase config sync error:', err));
          return updated;
        });
      }
    }

    if (onUpdateBill) {
      const curArrears = field === 'arrears' ? value : currentArrears;
      const curTuition = field === 'tuition' ? value : currentTuition;
      const curComputing = field === 'computing' ? value : currentComputing;
      const curUtility = field === 'utility' ? value : currentUtility;
      const curStationery = field === 'stationery' ? value : currentStationery;
      const curPta = field === 'pta' ? value : currentPta;
      const curReopening = field === 'reopeningDate' ? value : currentReopening;
      const curContact = field === 'contactNumber' ? value : currentContact;

      onUpdateBill({
        studentId: student.id,
        arrears: curArrears,
        tuition: curTuition,
        computing: curComputing,
        utility: curUtility,
        stationery: curStationery,
        pta: curPta,
        reopeningDate: curReopening,
        contactNumber: curContact,
        term: config.term || 'Term 1',
        year: config.schoolYear || '2025/2026',
        updatedAt: new Date().toISOString()
      });
    }
  };

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

  // Softcopy PDF & Dispatch states
  const [showShareModal, setShowShareModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [parentEmailInput, setParentEmailInput] = useState(student.guardianEmail || '');
  const [parentPhoneInput, setParentPhoneInput] = useState(student.guardianPhone || '');
  const [customAdminNote, setCustomAdminNote] = useState('');
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => {
    setParentEmailInput(student.guardianEmail || '');
    setParentPhoneInput(student.guardianPhone || '');
  }, [student.guardianEmail, student.guardianPhone, student.id]);

  const handleDownloadSoftcopyPDF = async () => {
    const element = printRef.current;
    if (!element) return;
    setIsGeneratingPDF(true);
    try {
      const html2pdfModule = (await import('html2pdf.js')).default;
      const cleanName = student.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanTerm = (config.term || 'Term').replace(/[^a-zA-Z0-9_-]/g, '_');
      const opt = {
        margin: [0.2, 0.2, 0.2, 0.2] as [number, number, number, number],
        filename: `${cleanName}_${cleanTerm}_Report.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' as const }
      };
      await html2pdfModule().set(opt).from(element).save();
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      handlePrint();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const getDispatchOptions = () => {
    const updatedStudent: Student = {
      ...student,
      guardianEmail: parentEmailInput || student.guardianEmail,
      guardianPhone: parentPhoneInput || student.guardianPhone
    };
    return {
      student: updatedStudent,
      config,
      stats: {
        totalScore: totalSum,
        averageScore: studentAverage,
        classRank: studentRank,
        totalStudents: allClassStudents.length,
        attendanceSummary: attendance ? `${attendance.daysPresent} / ${attendance.totalDays} days present` : undefined
      },
      customNote: customAdminNote
    };
  };

  const handleSendEmail = () => {
    sendGuardianEmail(getDispatchOptions());
  };

  const handleSendWhatsApp = () => {
    sendWhatsAppReport(getDispatchOptions());
  };

  const handleOpenArkeselSmsModal = () => {
    const studentBill = bills.find(b => b.studentId === student.id);
    const feeBalance = studentBill ? (
      parseFloat(studentBill.arrears || '0') +
      parseFloat(studentBill.tuition || '0') +
      parseFloat(studentBill.computing || '0') +
      parseFloat(studentBill.utility || '0') +
      parseFloat(studentBill.stationery || '0') +
      parseFloat(studentBill.pta || '0')
    ) : 0;

    const defaultTpl = DEFAULT_REPORT_CARD_SMS_TEMPLATES[0].content;
    const interpolated = interpolateReportCardTemplate(defaultTpl, student, config, feeBalance);
    setArkeselSmsMsg(interpolated);
    setArkeselSmsResult(null);
    setShowArkeselSmsModal(true);
  };

  const handleExecuteArkeselSms = async () => {
    if (!student.guardianPhone) {
      setArkeselSmsResult({ success: false, msg: 'Parent phone number is missing on student profile.' });
      return;
    }
    setIsSendingArkeselSms(true);
    setArkeselSmsResult(null);

    const res = await sendArkeselSingleSMS({
      recipientPhone: student.guardianPhone,
      message: arkeselSmsMsg
    });

    setIsSendingArkeselSms(false);
    setArkeselSmsResult({
      success: res.success,
      msg: res.message
    });
  };

  const handleCopyMessage = () => {
    const bodyText = generateEmailReportBody(getDispatchOptions());
    navigator.clipboard.writeText(bodyText);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  useEffect(() => {
    try {
      setIsInsideIframe(window.self !== window.top);
    } catch (e) {
      setIsInsideIframe(true);
    }
  }, []);

  // 1. Calculate Grade Details
  const matchedTermGrades = grades.filter((g) => g.studentId === student.id && (!g.term || g.term === config.term) && (!g.year || g.year === config.schoolYear));
  const studentGrades = matchedTermGrades.length > 0 ? matchedTermGrades : grades.filter((g) => g.studentId === student.id);
  const totalSubjectsCount = studentGrades.length;

  const totalSum = studentGrades.reduce((sum, g) => sum + g.totalScore, 0);
  const studentAverage = totalSubjectsCount > 0 ? (totalSum / totalSubjectsCount) : 0;

  // 2. Class Rank Calculation (dynamic!)
  const rankList = allClassStudents.map((s) => {
    const termGrades = allGrades.filter((g) => g.studentId === s.id && (!g.term || g.term === config.term) && (!g.year || g.year === config.schoolYear));
    const sGrades = termGrades.length > 0 ? termGrades : allGrades.filter((g) => g.studentId === s.id);
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
      {!isBulkMode && (
        <>
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

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3">
          <div className="w-full md:w-auto">
            <h4 className="font-display font-bold text-mauve-900 text-sm flex items-center gap-1.5 uppercase tracking-wide">
              <Settings2 className="w-4 h-4 text-mauve-900" />
              Transcript Controls & Dispatch
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">Export softcopy PDF file, send directly to parent Email/WhatsApp, or print hardcopy.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={handleDownloadSoftcopyPDF}
              disabled={isGeneratingPDF}
              className="flex-1 md:flex-none bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-bold text-xs px-3.5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm uppercase tracking-wider"
              title="Generate and download softcopy PDF file"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>{isGeneratingPDF ? 'Generating PDF...' : 'Download Softcopy PDF'}</span>
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="flex-1 md:flex-none bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white font-bold text-xs px-3.5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm uppercase tracking-wider"
              title="Send softcopy report card to parent email or WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
              <span>Send Softcopy</span>
            </button>

            <button
              onClick={handleOpenArkeselSmsModal}
              className="flex-1 md:flex-none bg-mauve-950 hover:bg-mauve-900 active:scale-[0.98] text-white font-bold text-xs px-3.5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm uppercase tracking-wider border border-mauve-800"
              title="Send direct SMS notification to parent via Arkesel Gateway"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>SMS Alert (Arkesel)</span>
            </button>

            {onUpdateGrade && (
              <button
                onClick={() => setIsEditingAssessments(!isEditingAssessments)}
                className={`flex-1 md:flex-none font-bold text-xs px-3.5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm uppercase tracking-wider ${
                  isEditingAssessments
                    ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300'
                    : 'bg-indigo-700 hover:bg-indigo-800 text-white'
                }`}
                title="Edit subject assessment scores directly on this report card template"
              >
                <Edit2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isEditingAssessments ? 'Lock / Finish Editing Scores' : 'Edit Assessment Scores'}</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="flex-1 md:flex-none bg-mauve-900 hover:bg-mauve-800 active:scale-[0.98] focus:ring-2 focus:ring-mauve-500/50 text-white font-bold text-xs px-3.5 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm uppercase tracking-wider"
              id={`btn-print-${student.id}`}
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>Print Hardcopy</span>
            </button>
          </div>
        </div>

        {/* Softcopy Dispatch Modal */}
        {showShareModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn no-print">
            <div className="bg-white rounded-2xl border border-mauve-250 w-full max-w-lg p-6 shadow-2xl space-y-5 text-mauve-900">
              <div className="flex justify-between items-center border-b border-mauve-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold text-mauve-900 text-base">
                      Send Softcopy Report Card
                    </h4>
                    <p className="text-xs text-mauve-500">
                      Parent dispatch portal for {student.name} ({student.className})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer p-1 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student/Parent info summary */}
              <div className="bg-mauve-50/50 p-3.5 rounded-xl border border-mauve-150 text-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-mauve-800">Pupil: {student.name} ({student.rollNumber})</span>
                  <span className="bg-mauve-100 text-mauve-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                    {student.className}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-600 text-[11px]">
                  <span>Guardian Name: <strong>{student.guardianName || 'N/A'}</strong></span>
                  <span>Average Score: <strong>{studentAverage.toFixed(1)}%</strong></span>
                </div>
              </div>

              {/* Parent Contact Details */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-mauve-700 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    Parent Email Address
                  </label>
                  <input
                    type="email"
                    value={parentEmailInput}
                    onChange={(e) => setParentEmailInput(e.target.value)}
                    placeholder="parent@example.com"
                    className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-blue-500 outline-none text-xs text-mauve-900 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-mauve-700 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-green-600" />
                    Parent WhatsApp / Phone Number
                  </label>
                  <input
                    type="text"
                    value={parentPhoneInput}
                    onChange={(e) => setParentPhoneInput(e.target.value)}
                    placeholder="e.g. +233241234567 or 0241234567"
                    className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-green-500 outline-none text-xs text-mauve-900 bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-mauve-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                    Custom Admin Note (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={customAdminNote}
                    onChange={(e) => setCustomAdminNote(e.target.value)}
                    placeholder="e.g. Please note school re-opens on September 15th. Fee balance due."
                    className="w-full p-2.5 rounded-xl border border-mauve-200 focus:ring-2 focus:ring-purple-500 outline-none text-xs text-mauve-900 bg-white resize-none"
                  />
                </div>
              </div>

              {/* Dispatch Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-mauve-100">
                <span className="text-[11px] font-bold text-mauve-700 uppercase tracking-wider block">
                  Softcopy Dispatch Options
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={handleDownloadSoftcopyPDF}
                    disabled={isGeneratingPDF}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isGeneratingPDF ? 'Generating...' : '1. Download Softcopy PDF'}</span>
                  </button>

                  <button
                    onClick={handleSendEmail}
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Mail className="w-4 h-4" />
                    <span>2. Send via Parent Email</span>
                  </button>

                  <button
                    onClick={handleSendWhatsApp}
                    className="w-full bg-green-700 hover:bg-green-800 text-white font-semibold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>3. Send via WhatsApp</span>
                  </button>

                  <button
                    onClick={handleCopyMessage}
                    className="w-full bg-mauve-100 hover:bg-mauve-200 text-mauve-800 font-semibold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer border border-mauve-200"
                  >
                    {copiedMsg ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedMsg ? 'Message Copied!' : 'Copy Summary Text'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[10px] text-amber-800 leading-relaxed">
                💡 <strong>Tip for Admin:</strong> Click <em>"1. Download Softcopy PDF"</em> to save the PDF file locally, then click <em>"Send via WhatsApp"</em> or <em>"Send via Email"</em> to send the message and attach the downloaded softcopy report card to the parent.
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

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

              {/* Promotional Status & Next Level Customizer */}
              {isThirdTerm ? (
                <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-mauve-900" />
                      3rd Term Promotional Status Indicator
                    </p>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showPromotionStatus}
                          onChange={(e) => setShowPromotionStatus(e.target.checked)}
                          className="rounded border-mauve-500/20 text-mauve-900 focus:ring-mauve-900 w-3.5 h-3.5"
                        />
                        Display Promotional Status Banner on Report Card
                      </label>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Promotional Decision</label>
                        <select
                          value={promotionDecision}
                          onChange={(e) => setPromotionDecision(e.target.value as any)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900 font-bold focus:outline-none focus:ring-1 focus:ring-mauve-900"
                        >
                          <option value="PROMOTED">Promoted to Next Class</option>
                          <option value="RETAINED">Retained in Current Class</option>
                          <option value="GRADUATED">Graduated from Academy</option>
                          <option value="CUSTOM">Custom Promotional Message</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {promotionDecision === 'PROMOTED' && (
                      <div>
                        <label className="text-[10px] text-gray-500 block">Promoted To Class / Level Number</label>
                        <input
                          type="text"
                          value={promotedToClass}
                          onChange={(e) => setPromotedToClass(e.target.value)}
                          placeholder="E.g., Primary 2, Kindergarten 2, JHS 1"
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900 font-mono font-bold focus:outline-none focus:ring-1 focus:ring-mauve-900"
                        />
                        <span className="text-[9px] text-gray-400 block mt-0.5">Specify target promoted class or level number (e.g. Primary 2, Basic 3, JHS 1).</span>
                      </div>
                    )}

                    {promotionDecision === 'CUSTOM' && (
                      <div>
                        <label className="text-[10px] text-gray-500 block">Custom Promotional Message</label>
                        <input
                          type="text"
                          value={customPromotionText}
                          onChange={(e) => setCustomPromotionText(e.target.value)}
                          placeholder="E.g., PROMOTED TO BASIC 4 (LEVEL 4)"
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900 font-bold focus:outline-none focus:ring-1 focus:ring-mauve-900"
                        />
                        <span className="text-[9px] text-gray-400 block mt-0.5">Custom text printed on the report card banner.</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3">
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2.5 shadow-xs">
                    <GraduationCap className="w-5 h-5 text-amber-700 shrink-0" />
                    <div>
                      <strong className="block font-bold">Promotional Status Banner Disabled ({config.term || 'First Term'})</strong>
                      <span className="text-[11px] text-amber-800">
                        Class promotion banners and status indicators only appear on <strong>Third Term (Term 3)</strong> report card templates. Switch the active academic term in Admin Settings to enable promotion badges.
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                          onChange={(e) => handleBillFieldChange('reopeningDate', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Contact Info</label>
                        <input
                          type="text"
                          value={jhsContact}
                          onChange={(e) => handleBillFieldChange('contactNumber', e.target.value)}
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
                          onChange={(e) => handleBillFieldChange('arrears', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Tuition</label>
                        <input
                          type="text"
                          value={jhsTuition}
                          onChange={(e) => handleBillFieldChange('tuition', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Computing Levy</label>
                        <input
                          type="text"
                          value={jhsComputing}
                          onChange={(e) => handleBillFieldChange('computing', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Utility</label>
                        <input
                          type="text"
                          value={jhsUtility}
                          onChange={(e) => handleBillFieldChange('utility', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Stationery</label>
                        <input
                          type="text"
                          value={jhsStationery}
                          onChange={(e) => handleBillFieldChange('stationery', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">PTA</label>
                        <input
                          type="text"
                          value={jhsPta}
                          onChange={(e) => handleBillFieldChange('pta', e.target.value)}
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
                          onChange={(e) => handleBillFieldChange('reopeningDate', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Contact Info</label>
                        <input
                          type="text"
                          value={primaryContact}
                          onChange={(e) => handleBillFieldChange('contactNumber', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">Primary/KG Report Card Bills (GHC)</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9px] text-gray-500 block">Arrears</label>
                        <input
                          type="text"
                          value={primaryArrears}
                          onChange={(e) => handleBillFieldChange('arrears', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Tuition</label>
                        <input
                          type="text"
                          value={primaryTuition}
                          onChange={(e) => handleBillFieldChange('tuition', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Computing Levy</label>
                        <input
                          type="text"
                          value={primaryComputing}
                          onChange={(e) => handleBillFieldChange('computing', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Utility</label>
                        <input
                          type="text"
                          value={primaryUtility}
                          onChange={(e) => handleBillFieldChange('utility', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Stationery</label>
                        <input
                          type="text"
                          value={primaryStationery}
                          onChange={(e) => handleBillFieldChange('stationery', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">PTA</label>
                        <input
                          type="text"
                          value={primaryPta}
                          onChange={(e) => handleBillFieldChange('pta', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(student.level === 'NURSERY' || student.level === 'KINDERGARTEN') && (
                <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider">Nursery/KG Details Customizer</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 block">Reopening Date</label>
                        <input
                          type="text"
                          value={nurseryReopening}
                          onChange={(e) => handleBillFieldChange('reopeningDate', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block">Contact Info</label>
                        <input
                          type="text"
                          value={nurseryContact}
                          onChange={(e) => handleBillFieldChange('contactNumber', e.target.value)}
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
                          onChange={(e) => handleBillFieldChange('arrears', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Tuition</label>
                        <input
                          type="text"
                          value={nurseryTuition}
                          onChange={(e) => handleBillFieldChange('tuition', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Computing Levy</label>
                        <input
                          type="text"
                          value={nurseryComputing}
                          onChange={(e) => handleBillFieldChange('computing', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Utility</label>
                        <input
                          type="text"
                          value={nurseryUtility}
                          onChange={(e) => handleBillFieldChange('utility', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">Stationery</label>
                        <input
                          type="text"
                          value={nurseryStationery}
                          onChange={(e) => handleBillFieldChange('stationery', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-gray-500 block">PTA</label>
                        <input
                          type="text"
                          value={nurseryPta}
                          onChange={(e) => handleBillFieldChange('pta', e.target.value)}
                          className="w-full text-xs p-1.5 rounded border border-mauve-500/20 bg-white text-mauve-900"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subject Assessment & Marks Customizer - Admin manual sync */}
              {onUpdateGrade && (
                <div className="col-span-1 md:col-span-2 border-t border-mauve-500/10 pt-3 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <p className="text-[10px] font-bold text-mauve-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-mauve-900" />
                      Subject Assessment Marks Sheet (Manual Database Sync)
                    </p>
                    <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Auto-syncs to Local & Cloud Database
                    </span>
                  </div>

                  <div className="border border-mauve-500/20 rounded-lg overflow-x-auto bg-white shadow-xs">
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse font-sans min-w-[550px]">
                        <thead className="bg-mauve-900 text-white font-bold text-[10px] uppercase tracking-wider sticky top-0 z-10">
                          <tr>
                            <th className="p-2 pl-3">Subject Name</th>
                            {isNursery ? (
                              <th className="p-2 text-center">Nursery Rating (MO / O / S / NA)</th>
                            ) : (
                              <>
                                <th className="p-2 text-center w-28">Class Score (50%)</th>
                                <th className="p-2 text-center w-28">Exam Score (50%)</th>
                                <th className="p-2 text-center w-24">Total (100%)</th>
                                <th className="p-2 text-center pr-3">Grade & Remarks</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-mauve-100 text-xs">
                          {(() => {
                            const rawLevelSubs = subjects.filter((sub) => sub.level === effectiveLevel);
                            const levelSubs = [...rawLevelSubs];
                            if (effectiveLevel === 'JHS') {
                              const defaultJhs = [
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
                              defaultJhs.forEach(dj => {
                                if (!levelSubs.some(s => matchesSubject(dj.id, s))) {
                                  levelSubs.push(dj as any);
                                }
                              });
                            } else if (effectiveLevel === 'KINDERGARTEN') {
                              const defaultKg = [
                                { id: 'sub-k-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'KINDERGARTEN' },
                                { id: 'sub-k-num', name: 'NUMERACY', code: 'NUM', level: 'KINDERGARTEN' },
                                { id: 'sub-k-owop', name: 'OUR WORLD OUR PEOPLE', code: 'OWOP', level: 'KINDERGARTEN' },
                                { id: 'sub-k-ca', name: 'CREATIVE ARTS', code: 'CA', level: 'KINDERGARTEN' },
                                { id: 'sub-k-wrt', name: 'WRITING', code: 'WRT', level: 'KINDERGARTEN' }
                              ];
                              defaultKg.forEach(dk => {
                                if (!levelSubs.some(s => matchesSubject(dk.id, s))) {
                                  levelSubs.push(dk as any);
                                }
                              });
                            } else if (effectiveLevel === 'PRIMARY') {
                              const defaultPrimary = [
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
                              defaultPrimary.forEach(dp => {
                                if (!levelSubs.some(s => matchesSubject(dp.id, s))) {
                                  levelSubs.push(dp as any);
                                }
                              });
                            }
                            const extraG = (effectiveLevel === 'KINDERGARTEN' || isKg || isNursery)
                              ? []
                              : studentGrades.filter((g) => !levelSubs.some((sub) => matchesSubject(g.subjectId, sub)));
                            const allSubjectRows = [
                              ...levelSubs.map((sub) => ({ id: sub.id, name: sub.name, code: sub.code, subjectObj: sub })),
                              ...extraG.map((g) => {
                                const sObj = subjects.find((sub) => matchesSubject(g.subjectId, sub));
                                return { id: g.subjectId, name: sObj ? sObj.name : 'Recorded Subject', code: sObj ? sObj.code : 'SUB', subjectObj: sObj };
                              })
                            ];

                            if (allSubjectRows.length === 0) {
                              return (
                                <tr>
                                  <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                                    No subjects configured for this grade level.
                                  </td>
                                </tr>
                              );
                            }

                            return allSubjectRows.map((subItem) => {
                              const matchedGrade = subItem.subjectObj
                                ? findMatchingGrade(studentGrades, subItem.subjectObj, config.term, config.schoolYear)
                                : studentGrades.find((g) => matchesSubject(g.subjectId, { id: subItem.id, name: subItem.name, code: subItem.code, level: student.level }));
                              const classVal = matchedGrade ? matchedGrade.classScore : 0;
                              const examVal = matchedGrade ? matchedGrade.examScore : 0;
                              const totalVal = matchedGrade ? matchedGrade.totalScore : (classVal + examVal);
                              const rawRem = (matchedGrade?.nurseryRemark || matchedGrade?.remarks || '').toString().trim().toUpperCase();
                              const currentRemark = ['MO', 'O', 'S', 'NA'].includes(rawRem)
                                ? rawRem
                                : (totalVal >= 80 ? 'MO' : totalVal >= 65 ? 'O' : totalVal >= 45 ? 'S' : 'NA');

                              return (
                                <tr key={subItem.id} className="hover:bg-mauve-50/20 transition-colors">
                                  <td className="p-2 pl-3 font-bold text-mauve-950">
                                    {subItem.name} <span className="text-[10px] text-gray-400 font-mono font-normal">({subItem.code})</span>
                                  </td>
                                  {isNursery ? (
                                    <td className="p-2 text-center">
                                      <div className="flex items-center justify-center gap-1.5">
                                        {(['MO', 'O', 'S', 'NA'] as const).map((code) => (
                                          <button
                                            key={code}
                                            type="button"
                                            onClick={() => {
                                              const defaultClass = matchedGrade ? matchedGrade.classScore : (code === 'MO' ? 45 : code === 'O' ? 38 : code === 'S' ? 28 : 18);
                                              const defaultExam = matchedGrade ? matchedGrade.examScore : (code === 'MO' ? 45 : code === 'O' ? 37 : code === 'S' ? 27 : 17);
                                              onUpdateGrade(subItem.id, defaultClass, defaultExam, code);
                                            }}
                                            className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                                              currentRemark === code
                                                ? 'bg-mauve-900 text-white shadow-xs scale-105'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                          >
                                            {code}
                                          </button>
                                        ))}
                                      </div>
                                    </td>
                                  ) : (
                                    <>
                                      <td className="p-2 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          max="50"
                                          value={classVal}
                                          onChange={(e) => {
                                            const val = Math.min(50, Math.max(0, parseInt(e.target.value) || 0));
                                            onUpdateGrade(subItem.id, val, examVal, matchedGrade?.nurseryRemark);
                                          }}
                                          className="w-16 text-center font-mono font-bold p-1 border border-mauve-500/20 rounded bg-white text-mauve-900 text-xs focus:ring-1 focus:ring-mauve-900 outline-none"
                                        />
                                      </td>
                                      <td className="p-2 text-center">
                                        <input
                                          type="number"
                                          min="0"
                                          max="50"
                                          value={examVal}
                                          onChange={(e) => {
                                            const val = Math.min(50, Math.max(0, parseInt(e.target.value) || 0));
                                            onUpdateGrade(subItem.id, classVal, val, matchedGrade?.nurseryRemark);
                                          }}
                                          className="w-16 text-center font-mono font-bold p-1 border border-mauve-500/20 rounded bg-white text-mauve-900 text-xs focus:ring-1 focus:ring-mauve-900 outline-none"
                                        />
                                      </td>
                                      <td className="p-2 text-center font-mono font-black text-blue-900">
                                        {totalVal}
                                      </td>
                                      <td className="p-2 text-center pr-3 text-gray-600 font-medium text-[11px] italic">
                                        {getGradeDetails(totalVal).grade} ({getGradeDetails(totalVal).remarks})
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* TRANSCRIPT A4 SHEET CONTAINER */}
      <div className="w-full overflow-x-auto pb-4">
        <div 
          ref={printRef}
          className="bg-white text-gray-900 shadow-sm border-2 border-mauve-900 rounded p-4 sm:p-6 md:p-10 w-full min-w-[320px] max-w-[850px] mx-auto print-container relative"
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
                    REPORT CARD FOR {isKg ? 'KINDERGARTEN' : (isNursery ? 'NURSERY' : effectiveLevel)}
                  </h2>
                </div>

                {/* Bio Metadata Bubbles */}
                <div className="space-y-2 px-2 print:space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex-1 min-w-[180px] px-3.5 py-1 border-2 border-[#A899F7]/60 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm print:py-0.5">
                      <span className="font-serif font-black italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">NAME:</span>
                      <span className="font-serif font-black text-slate-950 text-[11px] uppercase grow px-1 border-b border-dotted border-slate-400 print:text-[10px]">{student.name}</span>
                    </div>
                    <div className="px-3.5 py-1 border-2 border-[#A899F7]/60 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm shrink-0 print:py-0.5">
                      <span className="font-serif font-black italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">{isKg ? 'KG' : (isNursery ? 'NURSERY' : 'CLASS')}:</span>
                      <span className="font-serif font-black text-slate-950 text-[11px] uppercase px-1 print:text-[10px]">{student.className}</span>
                    </div>
                    <div className="px-3.5 py-1 border-2 border-[#A899F7]/60 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm shrink-0 print:py-0.5">
                      <span className="font-serif font-black italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">ROLL:</span>
                      <span className="font-serif font-black text-slate-950 text-[11px] uppercase px-1 print:text-[10px]">{customRollNumber}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="px-3 py-1 border-2 border-[#A899F7]/60 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm print:py-0.5">
                      <span className="font-serif font-black italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">TERM:</span>
                      <span className="font-serif font-black text-slate-950 text-[11px] uppercase grow px-1 border-b border-dotted border-slate-400 print:text-[10px]">{config.term}</span>
                    </div>
                    <div className="px-3 py-1 border-2 border-[#A899F7]/60 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm print:py-0.5">
                      <span className="font-serif font-black italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">YEAR:</span>
                      <span className="font-serif font-black text-slate-950 text-[11px] uppercase grow px-1 border-b border-dotted border-slate-400 print:text-[10px]">{config.schoolYear}</span>
                    </div>
                    <div className="px-3 py-1 border-2 border-[#A899F7]/60 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm print:py-0.5">
                      <span className="font-serif font-black italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">REOPENING:</span>
                      <span className="font-serif font-black text-slate-950 text-[11px] uppercase grow px-1 border-b border-dotted border-slate-400 print:text-[10px]">{formatReopeningDate(currentReopening)}</span>
                    </div>
                    <div className="px-3 py-1 border-2 border-[#A899F7]/60 rounded-full bg-white/95 flex items-center gap-1.5 shadow-sm print:py-0.5">
                      <span className="font-serif font-black italic text-[#4A3B94] text-[9px] uppercase whitespace-nowrap">NO. ON ROLL:</span>
                      <span className="font-serif font-black text-slate-950 text-[11px] uppercase grow px-1 border-b border-dotted border-slate-400 print:text-[10px]">{customClassRoll}</span>
                    </div>
                  </div>

                  {isThirdTerm && showPromotionStatus && (
                    <div className="px-3.5 py-1.5 border-2 border-[#4A3B94] rounded-2xl bg-[#E8E5FC] flex flex-wrap items-center justify-between gap-2 shadow-sm print:py-1">
                      <span className="font-serif font-black italic text-[#4A3B94] text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-[#4A3B94] inline shrink-0" />
                        PROMOTIONAL STATUS (ANNUAL/3RD TERM):
                      </span>
                      <span className="font-serif font-black text-slate-950 text-[11px] sm:text-xs uppercase tracking-widest bg-white px-3 py-1 rounded-full border-2 border-[#4A3B94] shadow-xs">
                        {getPromotionBadgeText()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Subject Grades Table */}
                <div className="overflow-x-auto border-2 border-[#7285DE] rounded bg-white shadow-sm mx-2">
                  <table className="w-full text-left border-collapse font-serif text-[11px] min-w-[550px]">
                    <thead>
                      {isNursery ? (
                        <tr className="bg-[#B5C4F7] text-[#2B3B63] font-extrabold text-[9px] uppercase tracking-wider border-b-2 border-[#7285DE]">
                          <th className="p-1.5 pl-3 border-r border-[#7285DE] bg-white">Subject</th>
                          <th className="p-1.5 text-center w-16 border-r border-[#7285DE] bg-white">MO</th>
                          <th className="p-1.5 text-center w-16 border-r border-[#7285DE] bg-white">O</th>
                          <th className="p-1.5 text-center w-16 border-r border-[#7285DE] bg-white">S</th>
                          <th className="p-1.5 text-center w-16 bg-white">NA</th>
                        </tr>
                      ) : (
                        <tr className="bg-[#B5C4F7] text-[#2B3B63] font-extrabold text-[9px] uppercase tracking-wider border-b-2 border-[#7285DE]">
                          <th className="p-1.5 pl-3 border-r border-[#7285DE] bg-white">SUBJECT</th>
                          <th className="p-1.5 text-center w-24 border-r border-[#7285DE] bg-white">CLASS SCORE (50)</th>
                          <th className="p-1.5 text-center w-24 border-r border-[#7285DE] bg-white">EXAM SCORE (50)</th>
                          <th className="p-1.5 text-center w-24 border-r border-[#7285DE] bg-white">OVERALL (100)</th>
                          <th className="p-1.5 text-center bg-white">COMMENT</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-[#7285DE] text-[11px] text-slate-800">
                      {(() => {
                        let levelSubjects = subjects.filter(sub => sub.level === effectiveLevel);
                        if (effectiveLevel === 'JHS') {
                          const defaultJhs = [
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
                          defaultJhs.forEach(dj => {
                            if (!levelSubjects.some(s => matchesSubject(dj.id, s))) {
                              levelSubjects.push(dj as any);
                            }
                          });
                        } else if (effectiveLevel === 'KINDERGARTEN') {
                          const defaultKg = [
                            { id: 'sub-k-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'KINDERGARTEN' },
                            { id: 'sub-k-num', name: 'NUMERACY', code: 'NUM', level: 'KINDERGARTEN' },
                            { id: 'sub-k-owop', name: 'OUR WORLD OUR PEOPLE', code: 'OWOP', level: 'KINDERGARTEN' },
                            { id: 'sub-k-ca', name: 'CREATIVE ARTS', code: 'CA', level: 'KINDERGARTEN' },
                            { id: 'sub-k-wrt', name: 'WRITING', code: 'WRT', level: 'KINDERGARTEN' }
                          ];
                          defaultKg.forEach(dk => {
                            if (!levelSubjects.some(s => matchesSubject(dk.id, s))) {
                              levelSubjects.push(dk as any);
                            }
                          });
                        } else if (effectiveLevel === 'NURSERY') {
                          const defaultNursery = [
                            { id: 'sub-n-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'NURSERY' },
                            { id: 'sub-n-num', name: 'NUMERACY', code: 'NUM', level: 'NURSERY' },
                            { id: 'sub-n-cr', name: 'CREATIVITY', code: 'CRT', level: 'NURSERY' },
                            { id: 'sub-n-pho', name: 'PHONICS', code: 'PHO', level: 'NURSERY' },
                            { id: 'sub-n-psy', name: 'PSYCHOMOTOR SKILLS', code: 'PSY', level: 'NURSERY' }
                          ];
                          defaultNursery.forEach(dn => {
                            if (!levelSubjects.some(s => matchesSubject(dn.id, s))) {
                              levelSubjects.push(dn as any);
                            }
                          });
                        } else if (effectiveLevel === 'PRIMARY') {
                          const defaultPrimary = [
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
                          defaultPrimary.forEach(dp => {
                            if (!levelSubjects.some(s => matchesSubject(dp.id, s))) {
                              levelSubjects.push(dp as any);
                            }
                          });
                        }

                        const rows = levelSubjects.map((sub) => {
                          const matchedGrade = findMatchingGrade(studentGrades, sub, config.term, config.schoolYear);
                          return {
                            subjectId: sub.id,
                            name: sub.name,
                            grade: matchedGrade
                          };
                        });

                        const extraGrades = (effectiveLevel === 'KINDERGARTEN' || isKg || isNursery)
                          ? []
                          : studentGrades.filter((g) => {
                              return !levelSubjects.some((sub) => matchesSubject(g.subjectId, sub));
                            });

                        const allRows = [
                          ...rows,
                          ...extraGrades.map((g) => {
                            const sObj = subjects.find((sub) => matchesSubject(g.subjectId, sub));
                            return {
                              subjectId: g.subjectId,
                              name: sObj ? sObj.name : "Other Subject",
                              grade: g
                            };
                          })
                        ];

                        return allRows.map((row, index) => {
                          const g = row.grade;
                          const remarkVal = (g?.nurseryRemark || g?.remarks || '').toString().trim().toUpperCase();
                          let selectedKey: 'MO' | 'O' | 'S' | 'NA' = 'MO';

                          if (['MO', 'O', 'S', 'NA'].includes(remarkVal)) {
                            selectedKey = remarkVal as any;
                          } else if (g) {
                            if (g.totalScore >= 80) selectedKey = 'MO';
                            else if (g.totalScore >= 65) selectedKey = 'O';
                            else if (g.totalScore >= 45) selectedKey = 'S';
                            else selectedKey = 'NA';
                          }

                          const renderRadioDot = (key: 'MO' | 'O' | 'S' | 'NA') => {
                            const isSelected = selectedKey === key;
                            const dotVisual = isSelected ? (
                              <div className="w-3.5 h-3.5 rounded-full bg-[#3B4CA3] border-2 border-[#3B4CA3] mx-auto flex items-center justify-center shadow-xs print:bg-[#3B4CA3] print:border-[#3B4CA3]">
                                <div className="w-1.5 h-1.5 rounded-full bg-white print:bg-white"></div>
                              </div>
                            ) : (
                              <div className="w-3 h-3 rounded-full border-2 border-slate-300 mx-auto hover:border-[#3B4CA3] print:border-slate-400"></div>
                            );

                            if (onUpdateGrade && row.subjectId) {
                              let defaultClass = g ? g.classScore : 45;
                              let defaultExam = g ? g.examScore : 45;
                              if (key === 'O') { defaultClass = g ? g.classScore : 38; defaultExam = g ? g.examScore : 37; }
                              if (key === 'S') { defaultClass = g ? g.classScore : 28; defaultExam = g ? g.examScore : 27; }
                              if (key === 'NA') { defaultClass = g ? g.classScore : 18; defaultExam = g ? g.examScore : 17; }

                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateGrade(row.subjectId, defaultClass, defaultExam, key);
                                  }}
                                  className="w-full h-full p-0.5 flex items-center justify-center cursor-pointer hover:bg-indigo-50/50 rounded transition-colors print:p-0"
                                  title={`Click to set rating for ${row.name} to ${key}`}
                                >
                                  {dotVisual}
                                </button>
                              );
                            }
                            return dotVisual;
                          };

                          if (isNursery) {
                            return (
                              <tr key={index} className="hover:bg-[#E8E5FC]/20 print:hover:bg-transparent">
                                <td className="p-1 pl-2 sm:p-1.5 sm:pl-3 border-r border-[#7285DE] font-bold text-slate-800 bg-white text-[11px] print:text-[9.5pt]">
                                  {row.name}
                                </td>
                                <td className="p-1 text-center border-r border-[#7285DE] bg-white">
                                  {renderRadioDot('MO')}
                                </td>
                                <td className="p-1 text-center border-r border-[#7285DE] bg-white">
                                  {renderRadioDot('O')}
                                </td>
                                <td className="p-1 text-center border-r border-[#7285DE] bg-white">
                                  {renderRadioDot('S')}
                                </td>
                                <td className="p-1 text-center bg-white">
                                  {renderRadioDot('NA')}
                                </td>
                              </tr>
                            );
                          }

                          const classVal = g ? g.classScore : '';
                          const examVal = g ? g.examScore : '';
                          const totalVal = g ? g.totalScore : (g ? (g.classScore + g.examScore) : '');
                          const commentVal = g ? (isNursery ? (g.nurseryRemark || g.remarks || 'MO') : (['MO', 'O', 'S', 'NA'].includes((g.remarks || '').toUpperCase()) || !g.remarks ? getGradeDetails(g.totalScore).remarks : g.remarks)) : '';

                          return (
                            <tr key={index} className="hover:bg-[#E8E5FC]/20 print:hover:bg-transparent">
                              <td className="p-1 pl-2 sm:p-1.5 sm:pl-3 border-r border-[#7285DE] font-bold text-slate-800 bg-white text-[11px] print:text-[9.5pt]">
                                {row.name}
                              </td>
                              <td className="p-1 text-center border-r border-[#7285DE] font-mono text-slate-800 font-bold bg-white text-[11px] print:text-[9.5pt]">
                                {classVal}
                              </td>
                              <td className="p-1 text-center border-r border-[#7285DE] font-mono text-slate-800 font-bold bg-white text-[11px] print:text-[9.5pt]">
                                {examVal}
                              </td>
                              <td className="p-1 text-center border-r border-[#7285DE] font-mono font-extrabold text-[#3B4CA3] bg-white text-[11px] print:text-[9.5pt]">
                                {totalVal}
                              </td>
                              <td className="p-1 text-center italic text-slate-600 font-medium bg-white text-[10px] print:text-[9pt]">
                                {commentVal}
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Combined Bottom Section in 2 Columns */}
                <div className="grid grid-cols-2 gap-3 px-2 print:grid-cols-2 print:gap-2">
                  {/* Left Column: Attendance & Bills */}
                  <div className="space-y-3 print:space-y-2">
                    {/* Attendance, Attitude & Conduct */}
                    <div className="overflow-x-auto border-2 border-[#7285DE] rounded bg-white shadow-sm">
                      <table className="w-full text-center border-collapse font-serif text-[10px] min-w-[300px]">
                        <thead>
                          <tr className="bg-[#B5C4F7] text-[#2B3B63] font-extrabold text-[8px] uppercase tracking-wider border-b border-[#7285DE]">
                            <th className="p-1 border-r border-[#7285DE] w-1/3">ATTENDANCE</th>
                            <th className="p-1 border-r border-[#7285DE] w-1/3">ATTITUDE</th>
                            <th className="p-1 w-1/3">CONDUCT</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="font-bold text-slate-800 text-[10px] leading-normal">
                            <td className="p-1.5 border-r border-[#7285DE] bg-white text-left font-serif text-[9px] leading-tight space-y-0.5">
                              <div>Present: <span className="font-bold">{attendance?.daysPresent ?? 60} / {attendance?.totalDays ?? 60}</span></div>
                              <div>Absent: <span className="font-bold">{(attendance?.totalDays ?? 60) - (attendance?.daysPresent ?? 60)} days</span></div>
                              <div>RATE: <span className="font-bold">{Math.round(((attendance?.daysPresent ?? 60) / (attendance?.totalDays ?? 60)) * 100)}%</span></div>
                            </td>
                            <td className="p-1.5 border-r border-[#7285DE] bg-white italic font-serif text-[9px] text-slate-800">
                              "{studentAverage >= 80 ? 'Very helpful, active, and respectful.' : 'Attentive, active, and respectful.'}"
                            </td>
                            <td className="p-1.5 bg-white italic font-serif text-[9px] text-slate-800">
                              "{attendance?.remarks ? attendance.remarks : 'Very obedient, well-behaved and polite.'}"
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Bills Section */}
                    <div className="border-2 border-[#7285DE] bg-[#EBF1FE] rounded p-2.5 shadow-sm">
                      <h3 className="font-serif font-extrabold text-[9px] text-[#2B3B63] uppercase tracking-widest italic underline mb-1.5">
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
                        <div className="pt-1 border-t-2 border-[#7285DE] flex justify-between items-center font-extrabold text-[#2B3B63] uppercase text-[9px] mt-1.5">
                          <span>TOTAL FEES:</span>
                          <span className="grow mx-1"></span>
                          <span className="font-mono text-[10px] text-[#3B4CA3]">GH₵ {totalBillSum.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Comments & Key Legend */}
                  <div className="flex flex-col justify-between space-y-2 print:space-y-1.5 h-full font-serif">
                    {isNursery && (
                      <div className="border border-[#7285DE]/60 rounded bg-white p-2 text-[9px] shadow-xs">
                        <span className="block font-bold text-[#4A3B94] uppercase tracking-wider text-[8px] mb-1">Remarks Key</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-700 font-medium text-[9px]">
                          <div><span className="font-bold text-slate-900">MO</span> – Most often</div>
                          <div><span className="font-bold text-slate-900">O</span> – Often</div>
                          <div><span className="font-bold text-slate-900">S</span> – Sometimes</div>
                          <div><span className="font-bold text-slate-900">NA</span> – Needs Assistance</div>
                        </div>
                      </div>
                    )}

                    {/* Headmistress' / Teacher's / Principal's Remarks Box */}
                    <div className="bg-white/80 p-2.5 rounded border-2 border-[#7285DE]/60 italic text-slate-700 text-[9.5px] leading-relaxed shadow-sm grow">
                      <span className="block not-italic font-bold text-[#4A3B94] uppercase tracking-wider text-[8px] mb-1">
                        {!isNursery ? "PRINCIPAL'S REMARKS" : "Headmistress' / Teacher's Remarks"}
                      </span>
                      {customPrincipalComment ? `"${customPrincipalComment}"` : (!isNursery ? (attendance?.remarks ? `"${attendance.remarks}"` : '"Keep up the wonderful energy! Extremely proud of your terminal steps."') : (attendance?.remarks ? `"${attendance.remarks}"` : '"Exhibiting steady growth and enthusiasm."'))}
                    </div>

                    {/* Bottom Details & Mascot */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#7285DE]/20">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10">
                          <StandingBeeSVG className="w-full h-full" />
                        </div>
                        <div>
                          <span className="block text-[8px] uppercase font-bold text-slate-600 italic leading-none">Headmistress' contact</span>
                          <span className="block font-mono font-bold text-[11px] text-[#4A3B94] mt-0.5">{currentContact}</span>
                          <span className="block text-[8px] italic font-serif text-slate-500 mt-0.5">First Among Equals</span>
                        </div>
                      </div>
                      {showLogo && (
                        <div className="w-10 h-10 border border-[#A899F7]/30 p-0.5 bg-white rounded shadow-xs flex items-center justify-center shrink-0">
                          <SchoolSealSVG className="w-full h-full" />
                        </div>
                      )}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-y-2 sm:gap-y-4 gap-x-6 py-3 px-2 text-[11px] font-serif border-b-2 border-slate-900 print:py-1.5 print:gap-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-950 whitespace-nowrap uppercase tracking-wider">NAME:</span>
                  <span className="border-b-2 border-dashed border-slate-900 grow font-black text-slate-950 uppercase px-1">{student.name}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-950 whitespace-nowrap uppercase tracking-wider">YEAR:</span>
                  <span className="border-b-2 border-dashed border-slate-900 grow font-black text-slate-950 uppercase px-1">{config.schoolYear}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-950 whitespace-nowrap uppercase tracking-wider">GRADE:</span>
                  <span className="border-b-2 border-dashed border-slate-900 grow font-black text-slate-950 uppercase px-1">{student.className}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-950 whitespace-nowrap uppercase tracking-wider">TERM:</span>
                  <span className="border-b-2 border-dashed border-slate-900 grow font-black text-slate-950 uppercase px-1">{config.term}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-950 whitespace-nowrap uppercase tracking-wider">REOPENING:</span>
                  <span className="border-b-2 border-dashed border-slate-900 grow font-black text-slate-950 uppercase px-1">{formatReopeningDate(currentReopening)}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-black text-slate-950 whitespace-nowrap uppercase tracking-wider">NO. ON ROLL:</span>
                  <span className="border-b-2 border-dashed border-slate-900 grow font-black text-slate-950 uppercase px-1">{customClassRoll}</span>
                </div>
              </div>

              {/* Promotional Status Banner for JHS & Primary */}
              {isThirdTerm && showPromotionStatus && (
                <div className="p-2 sm:p-2.5 bg-[#1e293b] text-white rounded border-2 border-slate-900 flex flex-wrap items-center justify-between gap-2 shadow-sm my-2">
                  <span className="font-serif font-extrabold uppercase text-[10px] sm:text-[11px] tracking-widest text-amber-300 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-amber-300 inline shrink-0" />
                    PROMOTIONAL STATUS (ANNUAL/3RD TERM):
                  </span>
                  <span className="font-serif font-black text-xs sm:text-sm uppercase tracking-widest bg-amber-300 text-slate-950 px-3 py-1 rounded font-black shadow-xs">
                    {getPromotionBadgeText()}
                  </span>
                </div>
              )}

              {/* Transcript Table */}
              <div className="overflow-x-auto border border-slate-900 rounded-sm">
                <table className="w-full text-left border-collapse font-serif text-xs min-w-[550px]">
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
                      const levelSubjects = subjects.filter(sub => sub.level === effectiveLevel);
                      if (effectiveLevel === 'JHS') {
                        const defaultJhs = [
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
                        defaultJhs.forEach(dj => {
                          if (!levelSubjects.some(s => matchesSubject(dj.id, s))) {
                            levelSubjects.push(dj as any);
                          }
                        });
                      } else if (effectiveLevel === 'KINDERGARTEN') {
                        const defaultKg = [
                          { id: 'sub-k-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'KINDERGARTEN' },
                          { id: 'sub-k-num', name: 'NUMERACY', code: 'NUM', level: 'KINDERGARTEN' },
                          { id: 'sub-k-owop', name: 'OUR WORLD OUR PEOPLE', code: 'OWOP', level: 'KINDERGARTEN' },
                          { id: 'sub-k-ca', name: 'CREATIVE ARTS', code: 'CA', level: 'KINDERGARTEN' },
                          { id: 'sub-k-wrt', name: 'WRITING', code: 'WRT', level: 'KINDERGARTEN' }
                        ];
                        defaultKg.forEach(dk => {
                          if (!levelSubjects.some(s => matchesSubject(dk.id, s))) {
                            levelSubjects.push(dk as any);
                          }
                        });
                      } else if (effectiveLevel === 'PRIMARY') {
                        const defaultPrimary = [
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
                        defaultPrimary.forEach(dp => {
                          if (!levelSubjects.some(s => matchesSubject(dp.id, s))) {
                            levelSubjects.push(dp as any);
                          }
                        });
                      }

                      // Map the student's actual grades to these subjects
                      const rows = levelSubjects.map((sub) => {
                        const matchedGrade = findMatchingGrade(studentGrades, sub, config.term, config.schoolYear);
                        return {
                          subjectId: sub.id,
                          name: sub.name,
                          grade: matchedGrade
                        };
                      });

                      // Also find any grades that didn't match the level subjects
                      const extraGrades = (effectiveLevel === 'KINDERGARTEN' || isKg || isNursery)
                        ? []
                        : studentGrades.filter((g) => {
                            return !levelSubjects.some((sub) => matchesSubject(g.subjectId, sub));
                          });

                      const allRows = [
                        ...rows,
                        ...extraGrades.map((g) => {
                          const sObj = subjects.find((sub) => matchesSubject(g.subjectId, sub));
                          return {
                            subjectId: g.subjectId,
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
                              {isEditingAssessments && onUpdateGrade ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={g ? g.classScore : 0}
                                  onChange={(e) => {
                                    const val = Math.min(50, Math.max(0, parseInt(e.target.value) || 0));
                                    onUpdateGrade(row.subjectId, val, g ? g.examScore : 0, g?.nurseryRemark);
                                  }}
                                  className="w-14 text-center font-mono font-bold text-xs p-0.5 border border-amber-400 bg-amber-50 text-amber-950 rounded outline-none no-print"
                                />
                              ) : (
                                g ? g.classScore : ''
                              )}
                            </td>
                            <td className="p-1.5 sm:p-2 print:p-0.5 text-center border-r border-slate-900 font-mono text-slate-800 font-bold text-[11px] print:text-[10px] bg-white">
                              {isEditingAssessments && onUpdateGrade ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={g ? g.examScore : 0}
                                  onChange={(e) => {
                                    const val = Math.min(50, Math.max(0, parseInt(e.target.value) || 0));
                                    onUpdateGrade(row.subjectId, g ? g.classScore : 0, val, g?.nurseryRemark);
                                  }}
                                  className="w-14 text-center font-mono font-bold text-xs p-0.5 border border-amber-400 bg-amber-50 text-amber-950 rounded outline-none no-print"
                                />
                              ) : (
                                g ? g.examScore : ''
                              )}
                            </td>
                            <td className="p-1.5 sm:p-2 print:p-0.5 text-center border-r border-slate-900 font-mono font-extrabold text-blue-900 text-[11px] print:text-[10px] bg-white">
                              {g ? g.totalScore : ''}
                            </td>
                            <td className="p-1.5 pr-3 sm:p-2 sm:pr-4 print:p-0.5 print:pr-2 text-center text-slate-600 italic font-medium text-[10px] print:text-[9px] bg-white">
                              {g ? (isNursery ? (g.nurseryRemark || (['MO', 'O', 'S', 'NA'].includes((g.remarks || '').toUpperCase()) ? g.remarks : 'MO')) : (['MO', 'O', 'S', 'NA'].includes((g.remarks || '').toUpperCase()) ? gradeInfo?.remarks : (g.remarks || gradeInfo?.remarks))) : ''}
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
                    <p className="text-[10px] font-mono uppercase tracking-widest text-mauve-900 font-bold mt-0.5">
                      Academic Report & Transcript
                    </p>
                    <p className="text-[10px] text-mauve-800 font-medium mt-0.5">
                      P.O. Box 24, Legon-Accra, Ghana | info@eastfieldacademy.edu.gh
                    </p>
                  </div>
                </div>

                <div className="bg-mauve-50 px-3 py-1.5 rounded text-center md:text-right border border-mauve-500/10 shrink-0">
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-800 font-bold">Academic Season</span>
                  <span className="block font-bold text-mauve-900 text-xs mt-0.5">{config.schoolYear}</span>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-mauve-900 text-white text-[9px] font-bold rounded uppercase tracking-wider">
                    {config.term}
                  </span>
                </div>
              </div>

              {/* 2. Student Bio Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-4 bg-mauve-50 rounded-xl border-2 border-mauve-900/20 text-xs">
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-900 font-extrabold">Student Fullname</span>
                  <span className="font-extrabold text-slate-950 text-xs mt-0.5 block truncate">{student.name}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-900 font-extrabold">Class Identifier</span>
                  <span className="font-extrabold text-slate-950 text-xs mt-0.5 block">{student.className}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-900 font-extrabold">Roll ID</span>
                  <span className="font-mono text-xs font-black text-slate-950 mt-0.5 block">{customRollNumber}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-900 font-extrabold">Academy Level</span>
                  <span className="font-extrabold text-slate-950 text-xs mt-0.5 block uppercase">{student.level}</span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-900 font-extrabold">No. on Roll</span>
                  <span className="font-mono text-xs font-black text-slate-950 mt-0.5 block">{customClassRoll}</span>
                </div>
              </div>

              {/* Promotional Status Banner for Default Template */}
              {isThirdTerm && showPromotionStatus && (
                <div className="p-3 bg-mauve-900 text-white rounded-xl border-2 border-mauve-950 flex flex-wrap items-center justify-between gap-2 shadow-sm">
                  <span className="font-display font-extrabold uppercase text-xs tracking-wider text-mauve-100 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-300 shrink-0" />
                    Promotional Status (3rd Term / Annual):
                  </span>
                  <span className="font-mono font-black text-xs uppercase tracking-wider bg-amber-300 text-slate-950 px-3 py-1 rounded-lg shadow-xs">
                    {getPromotionBadgeText()}
                  </span>
                </div>
              )}

              {/* 3. Performance Summary Badges */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded border border-mauve-500/20 bg-white shadow-sm flex flex-col items-center justify-center">
                  <span className="text-[9.5px] font-mono uppercase tracking-wider text-mauve-900 font-bold">Subjects Recorded</span>
                  <span className="text-lg font-display font-black text-mauve-950 mt-0.5">
                    {totalSubjectsCount}
                  </span>
                </div>
                <div className={`p-3 rounded border border-mauve-500/20 bg-white shadow-sm flex flex-col items-center justify-center font-bold ${getAverageColor(studentAverage)}`}>
                  <span className="text-[9.5px] font-mono uppercase tracking-wider text-mauve-900 font-bold">Terminal Average</span>
                  <span className="text-lg font-display font-black mt-0.5">
                    {studentAverage.toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 rounded border border-mauve-500/20 bg-white shadow-sm flex flex-col items-center justify-center">
                  <span className="text-[9.5px] font-mono uppercase tracking-wider text-mauve-900 font-bold">Class Rank</span>
                  <span className="text-lg font-display font-black text-mauve-950 mt-0.5">
                    {studentRank} <span className="text-xs text-mauve-700 font-semibold">of {customClassRoll}</span>
                  </span>
                </div>
              </div>

              {/* 4. Main Grades Transcript Table */}
              <div className="overflow-x-auto border border-mauve-500/20 rounded">
                <table className="w-full text-left border-collapse text-xs min-w-[550px]">
                  <thead>
                    <tr className="bg-mauve-900 text-white font-bold text-[11px] uppercase tracking-wide">
                      <th className="p-3 pl-4 bg-white text-mauve-900 border-b border-mauve-100">Subject Details</th>
                      <th className="p-3 text-center w-36 bg-white text-mauve-900 border-b border-mauve-100">Class Score (50%)</th>
                      <th className="p-3 text-center w-36 bg-white text-mauve-900 border-b border-mauve-100">Exam Score (50%)</th>
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
                            <td className="p-3 text-center font-mono text-gray-700 font-bold bg-white">
                              {isEditingAssessments && onUpdateGrade ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={g.classScore}
                                  onChange={(e) => {
                                    const val = Math.min(50, Math.max(0, parseInt(e.target.value) || 0));
                                    onUpdateGrade(g.subjectId, val, g.examScore, g.nurseryRemark);
                                  }}
                                  className="w-16 text-center font-mono font-bold p-1 border border-amber-400 bg-amber-50 text-amber-950 rounded outline-none no-print"
                                />
                              ) : (
                                g.classScore
                              )}
                            </td>
                            <td className="p-3 text-center font-mono text-gray-700 font-bold bg-white">
                              {isEditingAssessments && onUpdateGrade ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="50"
                                  value={g.examScore}
                                  onChange={(e) => {
                                    const val = Math.min(50, Math.max(0, parseInt(e.target.value) || 0));
                                    onUpdateGrade(g.subjectId, g.classScore, val, g.nurseryRemark);
                                  }}
                                  className="w-16 text-center font-mono font-bold p-1 border border-amber-400 bg-amber-50 text-amber-950 rounded outline-none no-print"
                                />
                              ) : (
                                g.examScore
                              )}
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-mauve-900 bg-white">{g.totalScore}</td>
                            <td className="p-3 pr-4 text-center text-gray-500 italic text-[11px] bg-white">
                              {isNursery ? (g.nurseryRemark || (['MO', 'O', 'S', 'NA'].includes((g.remarks || '').toUpperCase()) ? g.remarks : 'MO')) : (['MO', 'O', 'S', 'NA'].includes((g.remarks || '').toUpperCase()) ? gradeInfo.remarks : (g.remarks || gradeInfo.remarks))}
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
                    <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-900 font-bold">
                      Class Teacher's Authentication
                    </span>
                    <div className="h-12 flex items-end">
                      <div className="border-b border-gray-300 w-full pb-1 text-xs text-gray-500 italic">
                        <span className="font-serif text-mauve-900 tracking-wider">Eastfield Teacher Stamp</span>
                      </div>
                    </div>
                    <div className="text-[10px]">
                      <span className="block font-bold text-gray-900">Class Teacher Code: ET-{student.className.replace(/\s+/g, '')}</span>
                      <span className="text-mauve-800 font-medium">Eastfield Academy Staff</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="block text-[9px] uppercase font-mono tracking-wider text-mauve-900 font-bold">
                      Principal's Endorsement & Stamp
                    </span>
                    <div className="h-12 flex items-end">
                      <div className="border-b border-gray-300 w-full pb-1 text-xs text-gray-500 italic relative flex items-center justify-between">
                        {config.principalSignatureUrl ? (
                          <img
                            src={config.principalSignatureUrl}
                            alt="Principal Signature"
                            className="h-10 object-contain max-w-[130px] mb-0.5"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="font-serif text-mauve-900 font-bold text-sm tracking-wider">
                            {config.principalName}
                          </span>
                        )}
                        <div className="absolute right-2 bottom-2 px-2 py-0.5 border border-rose-500/30 text-rose-500 text-[8px] uppercase tracking-wider font-mono font-bold rounded rotate-[-4deg] opacity-70">
                          Eastfield Approved
                        </div>
                      </div>
                    </div>
                    <div className="text-[10px] leading-relaxed">
                      <span className="block font-bold text-gray-800">Head Principal Office</span>
                      <p className="text-[10px] text-gray-500 mt-1 italic leading-normal">
                        {customPrincipalComment ? `"${customPrincipalComment}"` : (isThirdTerm ? 'Excellent terminal outcome. Recommended for promotional pathways with outstanding merit.' : 'Exhibiting steady academic growth and active participation in class.')}
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

      {/* ARKESEL DIRECT REPORT CARD SMS MODAL OVERLAY */}
      {showArkeselSmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn no-print">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-mauve-950 text-amber-400 flex items-center justify-center font-bold">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm text-mauve-950">
                    Send Report Card SMS Alert via Arkesel
                  </h3>
                  <p className="text-xs text-gray-500">
                    Recipient: <strong className="text-gray-800">{student.guardianName}</strong> ({student.guardianPhone || 'No Phone'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowArkeselSmsModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {arkeselSmsResult && (
              <div
                className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  arkeselSmsResult.success
                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                    : 'bg-red-50 text-red-900 border border-red-300'
                }`}
              >
                {arkeselSmsResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <X className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <span>{arkeselSmsResult.msg}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700">SMS Alert Content:</label>
              <textarea
                rows={4}
                value={arkeselSmsMsg}
                onChange={(e) => setArkeselSmsMsg(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl font-mono text-xs text-gray-800 focus:ring-2 focus:ring-mauve-500 outline-none leading-relaxed"
              />
              <div className="flex justify-between text-[11px] text-gray-500 font-mono">
                <span>{arkeselSmsMsg.length} characters</span>
                <span>{Math.ceil(arkeselSmsMsg.length / 160) || 1} SMS Credit(s)</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowArkeselSmsModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSendingArkeselSms || !student.guardianPhone}
                onClick={handleExecuteArkeselSms}
                className={`px-5 py-2 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md ${
                  !student.guardianPhone || isSendingArkeselSms
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-mauve-950 hover:bg-mauve-900 text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>{isSendingArkeselSms ? 'Sending SMS...' : 'Dispatch Arkesel SMS'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
