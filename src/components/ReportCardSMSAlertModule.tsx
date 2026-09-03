/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Student, StudentBill, ReportConfig, Grade } from '../types';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Smartphone,
  Filter,
  CheckSquare,
  Square,
  Search,
  Zap,
  CreditCard,
  Calendar,
  X,
  History,
  Check,
  Key,
  Globe,
  ShieldCheck,
  RefreshCw,
  FileText,
  Eye,
  Sliders,
  Download,
  Activity,
  Award
} from 'lucide-react';
import {
  DEFAULT_REPORT_CARD_SMS_TEMPLATES,
  ReportCardSmsTemplate,
  formatGhanaPhoneNumber,
  interpolateReportCardTemplate,
  getArkeselCredentials,
  saveArkeselCredentials,
  sendArkeselSingleSMS
} from '../services/arkeselSmsService';
import { runArkeselDiagnostic, ARKESEL_ENDPOINTS } from '../lib/arkeselDiagnostic';

interface ReportCardSMSAlertModuleProps {
  students: Student[];
  bills?: StudentBill[];
  grades?: Grade[];
  config: ReportConfig;
  classes: { NURSERY: string[]; KINDERGARTEN?: string[]; PRIMARY: string[]; JHS: string[] };
  onClose?: () => void;
  initialSelectedStudentId?: string;
  initialClass?: string;
}

export interface ReportSmsDispatchResultItem {
  studentId: string;
  studentName: string;
  guardianName: string;
  guardianPhone: string;
  formattedPhone: string;
  className: string;
  feeBalance: number;
  reportStatus: 'FINALIZED' | 'GRADES_ENTERED' | 'PENDING';
  status: 'ARKESEL_SENT' | 'ARKESEL_FAILED' | 'MISSING_PHONE';
  responseMsg?: string;
}

export default function ReportCardSMSAlertModule({
  students,
  bills = [],
  grades = [],
  config,
  classes,
  onClose,
  initialSelectedStudentId,
  initialClass
}: ReportCardSMSAlertModuleProps) {
  // Config & Credentials
  const [arkeselApiKey, setArkeselApiKey] = useState('');
  const [arkeselSenderId, setArkeselSenderId] = useState('EASTFIELD');
  const [arkeselBalance, setArkeselBalance] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configSuccess, setConfigSuccess] = useState('');
  const [configError, setConfigError] = useState('');
  const [isTestingConn, setIsTestingConn] = useState(false);

  // Filters
  const allClassList = useMemo(() => {
    return [
      ...classes.NURSERY,
      ...(classes.KINDERGARTEN || []),
      ...classes.PRIMARY,
      ...classes.JHS
    ];
  }, [classes]);

  const [selectedClass, setSelectedClass] = useState<string>(initialClass || 'ALL');
  const [selectedTerm, setSelectedTerm] = useState<string>(config.term || 'Term 1');
  const [selectedYear, setSelectedYear] = useState<string>(config.schoolYear || '2025/2026');
  const [searchQuery, setSearchQuery] = useState('');
  const [readinessFilter, setReadinessFilter] = useState<'ALL' | 'FINALIZED' | 'WITH_GRADES' | 'UNPAID_ONLY'>('ALL');

  // Template State
  const [activeTemplateId, setActiveTemplateId] = useState<string>('report-finalized');
  const [smsMessage, setSmsMessage] = useState<string>(DEFAULT_REPORT_CARD_SMS_TEMPLATES[0].content);

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(initialSelectedStudentId || null);

  // Dispatch Engine Modal State
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchProgress, setDispatchProgress] = useState(0);
  const [currentDispatchStudent, setCurrentDispatchStudent] = useState('');
  const [dispatchCompleted, setDispatchCompleted] = useState(false);
  const [dispatchResults, setDispatchResults] = useState<{ [id: string]: { status: string; msg: string } }>({});
  const [dispatchSummary, setDispatchSummary] = useState({ total: 0, sent: 0, failed: 0, noPhone: 0 });
  const [dispatchLogs, setDispatchLogs] = useState<ReportSmsDispatchResultItem[]>([]);

  // Individual Single Quick Dispatch State
  const [quickSendLoadingId, setQuickSendLoadingId] = useState<string | null>(null);
  const [quickSendResult, setQuickSendResult] = useState<{ id: string; success: boolean; msg: string } | null>(null);

  // Load Credentials on Mount
  useEffect(() => {
    const creds = getArkeselCredentials();
    setArkeselApiKey(creds.apiKey);
    setArkeselSenderId(creds.senderId);
    if (creds.apiKey) {
      checkArkeselBalance(creds.apiKey);
    }
  }, []);

  const checkArkeselBalance = async (key: string) => {
    if (!key) return;
    try {
      const diag = await runArkeselDiagnostic(key);
      if (diag.v2BalanceResult.ok && diag.v2BalanceResult.message) {
        setArkeselBalance(diag.v2BalanceResult.message);
      } else {
        setArkeselBalance(null);
      }
    } catch {
      setArkeselBalance(null);
    }
  };

  // Helper to compute student report status & fee balance
  const studentDataList = useMemo(() => {
    return students.map(st => {
      // Fee Balance
      const studentBills = bills.filter(b => b.studentId === st.id);
      const totalBilled = studentBills.reduce((acc, b) => {
        return acc + (
          parseFloat(b.arrears || '0') +
          parseFloat(b.tuition || '0') +
          parseFloat(b.computing || '0') +
          parseFloat(b.utility || '0') +
          parseFloat(b.stationery || '0') +
          parseFloat(b.pta || '0')
        );
      }, 0);
      const feeBalance = Math.max(0, totalBilled);

      // Report Grades Readiness
      const studentGrades = grades.filter(
        g => g.studentId === st.id &&
          (!g.term || g.term === selectedTerm) &&
          (!g.year || g.year === selectedYear)
      );

      let reportStatus: 'FINALIZED' | 'GRADES_ENTERED' | 'PENDING' = 'PENDING';
      if (studentGrades.length >= 4) {
        reportStatus = 'FINALIZED';
      } else if (studentGrades.length > 0) {
        reportStatus = 'GRADES_ENTERED';
      }

      const formattedPhone = formatGhanaPhoneNumber(st.guardianPhone);

      return {
        student: st,
        feeBalance,
        reportStatus,
        gradesCount: studentGrades.length,
        formattedPhone,
        hasValidPhone: formattedPhone.length >= 9
      };
    });
  }, [students, bills, grades, selectedTerm, selectedYear]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return studentDataList.filter(item => {
      // Class Filter
      if (selectedClass !== 'ALL' && item.student.className !== selectedClass) {
        return false;
      }
      // Readiness Filter
      if (readinessFilter === 'FINALIZED' && item.reportStatus !== 'FINALIZED') {
        return false;
      }
      if (readinessFilter === 'WITH_GRADES' && item.gradesCount === 0) {
        return false;
      }
      if (readinessFilter === 'UNPAID_ONLY' && item.feeBalance <= 0) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.student.name.toLowerCase().includes(q);
        const matchesGuardian = item.student.guardianName.toLowerCase().includes(q);
        const matchesPhone = item.student.guardianPhone.includes(q);
        const matchesRoll = item.student.rollNumber.toLowerCase().includes(q);
        if (!matchesName && !matchesGuardian && !matchesPhone && !matchesRoll) {
          return false;
        }
      }
      return true;
    });
  }, [studentDataList, selectedClass, readinessFilter, searchQuery]);

  // Default select all filtered on initial render or filter change
  useEffect(() => {
    const validIds = new Set(filteredStudents.filter(s => s.hasValidPhone).map(s => s.student.id));
    setSelectedStudentIds(validIds);
  }, [filteredStudents]);

  // Handle Template Selection
  const handleSelectTemplate = (tpl: ReportCardSmsTemplate) => {
    setActiveTemplateId(tpl.id);
    setSmsMessage(tpl.content);
  };

  // Insert Variable Placeholder
  const insertPlaceholder = (tag: string) => {
    setSmsMessage(prev => prev + ` {{${tag}}}`);
  };

  // Toggle Selection
  const toggleSelectAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set());
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map(s => s.student.id)));
    }
  };

  const toggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  // Selected Student Object for Live Preview
  const selectedPreviewItem = useMemo(() => {
    if (previewStudentId) {
      return studentDataList.find(s => s.student.id === previewStudentId);
    }
    return filteredStudents[0] || studentDataList[0];
  }, [previewStudentId, filteredStudents, studentDataList]);

  const liveInterpolatedPreview = useMemo(() => {
    if (!selectedPreviewItem) return '';
    return interpolateReportCardTemplate(
      smsMessage,
      selectedPreviewItem.student,
      config,
      selectedPreviewItem.feeBalance
    );
  }, [smsMessage, selectedPreviewItem, config]);

  // Save Credentials
  const handleSaveCredentials = () => {
    setConfigError('');
    setConfigSuccess('');
    if (!arkeselApiKey.trim()) {
      setConfigError('Please enter your Arkesel API Key.');
      return;
    }
    saveArkeselCredentials(arkeselApiKey, arkeselSenderId);
    setConfigSuccess('Arkesel API configuration saved successfully!');
    checkArkeselBalance(arkeselApiKey.trim());
    setTimeout(() => {
      setShowConfigModal(false);
      setConfigSuccess('');
    }, 1000);
  };

  // Test Connection
  const handleTestConnection = async () => {
    if (!arkeselApiKey.trim()) {
      setConfigError('Enter API key to test.');
      return;
    }
    setIsTestingConn(true);
    setConfigError('');
    setConfigSuccess('');
    try {
      const res = await runArkeselDiagnostic(arkeselApiKey.trim());
      if (res.v2BalanceResult.ok) {
        setConfigSuccess(`Connection Verified! Balance: ${res.v2BalanceResult.message || 'Active'}`);
        setArkeselBalance(res.v2BalanceResult.message || 'Active');
      } else {
        setConfigError(res.v2BalanceResult.message || 'Failed to connect to Arkesel API');
      }
    } catch (err: any) {
      setConfigError(err?.message || 'Connection test failed');
    } finally {
      setIsTestingConn(false);
    }
  };

  // Single Quick SMS Dispatch
  const handleSendSingleSms = async (item: typeof studentDataList[0]) => {
    if (!item.hasValidPhone) {
      alert(`Cannot send SMS: ${item.student.guardianName} has an invalid or missing phone number.`);
      return;
    }
    setQuickSendLoadingId(item.student.id);
    setQuickSendResult(null);

    const msgContent = interpolateReportCardTemplate(smsMessage, item.student, config, item.feeBalance);
    const result = await sendArkeselSingleSMS({
      recipientPhone: item.formattedPhone,
      message: msgContent,
      apiKey: arkeselApiKey,
      senderId: arkeselSenderId
    });

    setQuickSendLoadingId(null);
    setQuickSendResult({
      id: item.student.id,
      success: result.success,
      msg: result.message
    });

    setTimeout(() => {
      setQuickSendResult(null);
    }, 5000);
  };

  // Bulk Dispatch Execution
  const handleStartBulkDispatch = async () => {
    const itemsToDispatch = filteredStudents.filter(s => selectedStudentIds.has(s.student.id));
    if (itemsToDispatch.length === 0) {
      alert('Please select at least one student recipient to dispatch SMS.');
      return;
    }

    if (!arkeselApiKey.trim()) {
      setShowConfigModal(true);
      return;
    }

    setIsDispatching(true);
    setDispatchProgress(0);
    setDispatchCompleted(false);
    setDispatchResults({});
    setDispatchLogs([]);

    let sent = 0;
    let failed = 0;
    let noPhone = 0;
    const total = itemsToDispatch.length;
    const initialResults: { [id: string]: { status: string; msg: string } } = {};
    const logList: ReportSmsDispatchResultItem[] = [];

    for (let i = 0; i < itemsToDispatch.length; i++) {
      const item = itemsToDispatch[i];
      setCurrentDispatchStudent(`${item.student.name} (${item.student.guardianName})`);
      setDispatchProgress(Math.round(((i + 1) / total) * 100));

      if (!item.hasValidPhone) {
        noPhone++;
        initialResults[item.student.id] = { status: 'MISSING_PHONE', msg: 'Missing / invalid phone number' };
        logList.push({
          studentId: item.student.id,
          studentName: item.student.name,
          guardianName: item.student.guardianName,
          guardianPhone: item.student.guardianPhone,
          formattedPhone: item.formattedPhone,
          className: item.student.className,
          feeBalance: item.feeBalance,
          reportStatus: item.reportStatus,
          status: 'MISSING_PHONE',
          responseMsg: 'Missing or invalid phone number'
        });
        setDispatchResults({ ...initialResults });
        continue;
      }

      const msgContent = interpolateReportCardTemplate(smsMessage, item.student, config, item.feeBalance);
      const res = await sendArkeselSingleSMS({
        recipientPhone: item.formattedPhone,
        message: msgContent,
        apiKey: arkeselApiKey,
        senderId: arkeselSenderId
      });

      if (res.success) {
        sent++;
        initialResults[item.student.id] = { status: 'ARKESEL_SENT', msg: res.message };
        logList.push({
          studentId: item.student.id,
          studentName: item.student.name,
          guardianName: item.student.guardianName,
          guardianPhone: item.student.guardianPhone,
          formattedPhone: item.formattedPhone,
          className: item.student.className,
          feeBalance: item.feeBalance,
          reportStatus: item.reportStatus,
          status: 'ARKESEL_SENT',
          responseMsg: res.message
        });
      } else {
        failed++;
        initialResults[item.student.id] = { status: 'ARKESEL_FAILED', msg: res.message };
        logList.push({
          studentId: item.student.id,
          studentName: item.student.name,
          guardianName: item.student.guardianName,
          guardianPhone: item.student.guardianPhone,
          formattedPhone: item.formattedPhone,
          className: item.student.className,
          feeBalance: item.feeBalance,
          reportStatus: item.reportStatus,
          status: 'ARKESEL_FAILED',
          responseMsg: res.message
        });
      }

      setDispatchResults({ ...initialResults });
    }

    setDispatchSummary({ total, sent, failed, noPhone });
    setDispatchLogs(logList);
    setDispatchCompleted(true);
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 space-y-6 text-slate-900 font-sans animate-fadeIn">
      {/* HEADER BAR */}
      <div className="bg-gradient-to-r from-mauve-950 via-mauve-900 to-slate-900 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-mauve-800/40 relative overflow-hidden">
        <div className="flex items-center gap-4 z-10">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shrink-0">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-black text-xl text-white tracking-wide">
                Report Card SMS Alert Service
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono font-bold uppercase">
                Arkesel SMS Gateway
              </span>
            </div>
            <p className="text-xs text-mauve-200 mt-1">
              Dispatch bulk end-of-term academic report alerts, fee clearance notices, and reopening updates directly to parents via SMS.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition cursor-pointer flex items-center gap-2 shadow-xs"
          >
            <Key className="w-4 h-4 text-amber-400" />
            <span>Arkesel API Credentials</span>
            {arkeselApiKey ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="API Key Configured" />
            ) : (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" title="API Key Required" />
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* GATEWAY QUICK BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Sender ID</span>
            <strong className="text-sm font-black text-mauve-950 font-mono">{arkeselSenderId || 'EASTFIELD'}</strong>
          </div>
          <Smartphone className="w-5 h-5 text-mauve-600" />
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Gateway Status</span>
            <strong className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {arkeselApiKey ? 'API Active' : 'Key Missing'}
            </strong>
          </div>
          <Globe className="w-5 h-5 text-blue-600" />
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">SMS Balance</span>
            <strong className="text-xs font-mono font-black text-amber-700">
              {arkeselBalance || 'Click Credentials to Test'}
            </strong>
          </div>
          <CreditCard className="w-5 h-5 text-amber-500" />
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Active Term</span>
            <strong className="text-xs font-bold text-mauve-900">{selectedTerm} • {selectedYear}</strong>
          </div>
          <Calendar className="w-5 h-5 text-mauve-700" />
        </div>
      </div>

      {/* TEMPLATE STUDIO SECTION */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h3 className="font-display font-extrabold text-sm text-mauve-950 uppercase tracking-wide">
              1. Report Card SMS Template Selector
            </h3>
          </div>
          <span className="text-[11px] text-gray-500 font-mono font-medium">
            {smsMessage.length} Chars • {Math.ceil(smsMessage.length / 160) || 1} SMS Credit(s) / recipient
          </span>
        </div>

        {/* Preset Template Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DEFAULT_REPORT_CARD_SMS_TEMPLATES.map(tpl => {
            const isSelected = activeTemplateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-mauve-950 text-white border-mauve-950 shadow-md scale-[1.01]'
                    : 'bg-gray-50 text-gray-800 border-gray-200 hover:bg-mauve-50/50 hover:border-mauve-300'
                }`}
              >
                <div>
                  <h4 className={`text-xs font-bold mb-1 ${isSelected ? 'text-amber-300' : 'text-mauve-950'}`}>
                    {tpl.title}
                  </h4>
                  <p className={`text-[11px] leading-tight line-clamp-2 ${isSelected ? 'text-mauve-200' : 'text-gray-500'}`}>
                    {tpl.description}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className={isSelected ? 'text-amber-400 font-bold' : 'text-mauve-700 font-semibold'}>
                    {isSelected ? '✓ Active Template' : 'Click to Load'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Message Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-700">SMS Message Content (Double Bracket Placeholders):</label>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-gray-500 font-bold mr-1">Insert Placeholder:</span>
              {['guardian_name', 'student_name', 'class_name', 'term', 'academic_year', 'school_name', 'fees_balance', 'reopening_date', 'contact_phone'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => insertPlaceholder(tag)}
                  className="px-2 py-0.5 bg-gray-100 hover:bg-mauve-100 text-mauve-900 border border-gray-300 rounded text-[10px] font-mono font-bold transition cursor-pointer"
                >
                  +{tag}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={3}
            value={smsMessage}
            onChange={(e) => {
              setSmsMessage(e.target.value);
              setActiveTemplateId('custom');
            }}
            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-mauve-500 outline-none text-xs font-mono text-gray-800 leading-relaxed bg-gray-50/50"
            placeholder="Type your SMS alert message..."
          />
        </div>
      </div>

      {/* FILTER & STUDENT SELECTION TABLE */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-mauve-900" />
            <h3 className="font-display font-extrabold text-sm text-mauve-950 uppercase tracking-wide">
              2. Student Report Readiness & Target Recipients
            </h3>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-gray-600">
            <span>Selected:</span>
            <strong className="text-mauve-950 font-black">{selectedStudentIds.size}</strong> / {filteredStudents.length} Students
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
          <div>
            <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Class Filter</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white"
            >
              <option value="ALL">All Classes ({allClassList.length})</option>
              {allClassList.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Report Status Filter</label>
            <select
              value={readinessFilter}
              onChange={(e) => setReadinessFilter(e.target.value as any)}
              className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white"
            >
              <option value="ALL">All Report Statuses</option>
              <option value="FINALIZED">Finalized Reports Only</option>
              <option value="WITH_GRADES">Grades Entered Only</option>
              <option value="UNPAID_ONLY">Outstanding Fee Balance Only</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Term & Year</label>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white"
              >
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white"
              >
                <option value="2025/2026">2025/2026</option>
                <option value="2024/2025">2024/2025</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-gray-600 block mb-1">Search Pupil / Phone</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, phone..."
                className="w-full pl-8 pr-2 py-1.5 border border-gray-300 rounded-lg text-xs outline-none bg-white font-medium"
              />
            </div>
          </div>
        </div>

        {/* Recipients Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-left text-xs text-gray-700">
            <thead className="bg-mauve-950 text-white text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.size > 0 && selectedStudentIds.size === filteredStudents.length}
                    onChange={toggleSelectAll}
                    className="rounded cursor-pointer accent-amber-400"
                  />
                </th>
                <th className="p-3">Pupil & Roll No.</th>
                <th className="p-3">Class</th>
                <th className="p-3">Guardian Contact</th>
                <th className="p-3">Report Card Status</th>
                <th className="p-3">Fee Balance</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((item, idx) => {
                  const isChecked = selectedStudentIds.has(item.student.id);
                  const isQuickLoading = quickSendLoadingId === item.student.id;
                  const isQuickResult = quickSendResult?.id === item.student.id;

                  return (
                    <tr
                      key={`${item.student.id}-${idx}`}
                      className={`hover:bg-gray-50 transition ${isChecked ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleStudent(item.student.id)}
                          className="rounded cursor-pointer accent-amber-500"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-mauve-950">{item.student.name}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{item.student.rollNumber}</div>
                      </td>
                      <td className="p-3 font-semibold text-gray-800">{item.student.className}</td>
                      <td className="p-3">
                        <div className="font-medium text-gray-900">{item.student.guardianName}</div>
                        {item.hasValidPhone ? (
                          <div className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            <span>{item.formattedPhone}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] font-mono text-red-600 font-bold flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>No Valid Phone ({item.student.guardianPhone || 'Empty'})</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {item.reportStatus === 'FINALIZED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Finalized ({item.gradesCount} Subjects)
                          </span>
                        )}
                        {item.reportStatus === 'GRADES_ENTERED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold text-[10px]">
                            <Activity className="w-3 h-3 text-blue-600" />
                            Grades Entered ({item.gradesCount})
                          </span>
                        )}
                        {item.reportStatus === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]">
                            <Calendar className="w-3 h-3 text-amber-600" />
                            Pending Marks
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold">
                        {item.feeBalance > 0 ? (
                          <span className="text-red-700">GH₵ {item.feeBalance.toFixed(2)}</span>
                        ) : (
                          <span className="text-emerald-700">Cleared (GH₵ 0.00)</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewStudentId(item.student.id)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition cursor-pointer"
                            title="Inspect Personalized SMS Text"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={!item.hasValidPhone || isQuickLoading}
                            onClick={() => handleSendSingleSms(item)}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer flex items-center gap-1 ${
                              !item.hasValidPhone
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                : 'bg-mauve-950 hover:bg-mauve-900 text-white shadow-xs'
                            }`}
                          >
                            <Send className="w-3 h-3 text-amber-400" />
                            <span>{isQuickLoading ? 'Sending...' : 'Send SMS'}</span>
                          </button>
                        </div>
                        {isQuickResult && (
                          <div className={`text-[10px] mt-1 font-bold ${quickSendResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                            {quickSendResult.msg}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500 italic">
                    No student report records matched the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-gray-600 font-medium">
            Ready to dispatch SMS to <strong className="text-mauve-950 font-bold">{selectedStudentIds.size}</strong> parent recipient(s).
          </div>

          <button
            type="button"
            disabled={selectedStudentIds.size === 0}
            onClick={handleStartBulkDispatch}
            className={`px-6 py-3 rounded-xl font-extrabold text-xs uppercase tracking-wider transition cursor-pointer flex items-center gap-2 shadow-lg ${
              selectedStudentIds.size === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-mauve-950 to-slate-900 hover:from-mauve-900 hover:to-slate-800 text-white'
            }`}
          >
            <Send className="w-4 h-4 text-amber-400" />
            <span>Broadcast Report Card SMS Alerts ({selectedStudentIds.size})</span>
          </button>
        </div>
      </div>

      {/* LIVE PERSONALLY INTERPOLATED PREVIEW BOX */}
      {selectedPreviewItem && (
        <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-300/60 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase text-amber-900 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-amber-600" />
              Live Personalized Parent SMS Preview ({selectedPreviewItem.student.name})
            </span>
            <span className="text-[10px] text-amber-800 font-mono">
              Target Phone: {selectedPreviewItem.formattedPhone || 'N/A'}
            </span>
          </div>

          <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs font-mono text-gray-800 leading-relaxed shadow-inner">
            {liveInterpolatedPreview}
          </div>
        </div>
      )}

      {/* ARKESEL API CONFIG MODAL */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="bg-mauve-950 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <h3 className="font-display font-bold text-sm text-white">Arkesel.com Gateway Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-white/80 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-gray-800">
              {configError && (
                <div className="p-3 bg-red-50 border border-red-300 text-red-800 rounded-xl text-xs font-bold">
                  {configError}
                </div>
              )}
              {configSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-bold">
                  {configSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-mauve-950 mb-1">Arkesel API Key:</label>
                <input
                  type="password"
                  value={arkeselApiKey}
                  onChange={(e) => setArkeselApiKey(e.target.value)}
                  placeholder="Paste your Arkesel API Key..."
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-mauve-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-mauve-950 mb-1">Arkesel Sender ID (11 Chars Max):</label>
                <input
                  type="text"
                  maxLength={11}
                  value={arkeselSenderId}
                  onChange={(e) => setArkeselSenderId(e.target.value)}
                  placeholder="EASTFIELD"
                  className="w-full p-2.5 border border-gray-300 rounded-xl font-mono text-xs uppercase focus:ring-2 focus:ring-mauve-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTestingConn}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg text-xs transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingConn ? 'animate-spin' : ''}`} />
                  <span>{isTestingConn ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 font-bold rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCredentials}
                    className="px-4 py-1.5 bg-mauve-950 hover:bg-mauve-900 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    Save Credentials
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DISPATCH EXECUTION PROGRESS MODAL */}
      {isDispatching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden space-y-4 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-mauve-950 text-amber-400 flex items-center justify-center font-bold">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-base text-mauve-950">
                  {dispatchCompleted ? 'Report Card SMS Broadcast Complete' : 'Sending Report Card SMS Alerts...'}
                </h3>
                <p className="text-xs text-gray-500 font-mono">
                  {dispatchCompleted ? 'All recipients processed.' : currentDispatchStudent}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold text-gray-700 font-mono">
                <span>Progress</span>
                <span>{dispatchProgress}%</span>
              </div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-mauve-900 transition-all duration-300"
                  style={{ width: `${dispatchProgress}%` }}
                />
              </div>
            </div>

            {/* Live Logs */}
            {dispatchCompleted && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2 max-h-48 overflow-y-auto text-xs font-mono">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-emerald-100 text-emerald-900 rounded-lg font-bold">
                    Sent: {dispatchSummary.sent}
                  </div>
                  <div className="p-2 bg-red-100 text-red-900 rounded-lg font-bold">
                    Failed: {dispatchSummary.failed}
                  </div>
                  <div className="p-2 bg-amber-100 text-amber-900 rounded-lg font-bold">
                    No Phone: {dispatchSummary.noPhone}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!dispatchCompleted}
                onClick={() => setIsDispatching(false)}
                className={`px-5 py-2 rounded-xl font-bold text-xs transition cursor-pointer ${
                  dispatchCompleted
                    ? 'bg-mauve-950 hover:bg-mauve-900 text-white shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
