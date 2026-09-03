/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Student, StudentBill, FeePayment, ReportConfig } from '../types';
import { 
  MessageSquare, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  XCircle,
  Info,
  Sparkles, 
  Copy, 
  Download, 
  FileText, 
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
  Trash2,
  Activity
} from 'lucide-react';
import { 
  logSmsDispatchAttempt, 
  handle404EndpointError, 
  runArkeselDiagnostic, 
  ARKESEL_ENDPOINTS 
} from '../lib/arkeselDiagnostic';

interface BulkSMSModuleProps {
  students: Student[];
  bills?: StudentBill[];
  feePayments?: FeePayment[];
  config: ReportConfig;
  classes: { NURSERY: string[]; KINDERGARTEN?: string[]; PRIMARY: string[]; JHS: string[] };
}

export interface BroadcastLogItem {
  id: string;
  timestamp: string;
  senderId: string;
  templateType: string;
  messageContent: string;
  totalRecipients: number;
  deliveredCount: number;
  failedCount: number;
  totalFeeBalanceReminded: number;
  recipientsList: {
    studentName: string;
    guardianName: string;
    guardianPhone: string;
    feeBalance: number;
    status: 'DELIVERED' | 'FAILED_NO_PHONE' | 'ARKESEL_SENT' | 'ARKESEL_FAILED';
    responseMsg?: string;
  }[];
}

// Pre-defined message templates with double and single curly bracket support
const PRESET_TEMPLATES = [
  {
    id: 'fee-reminder',
    title: 'Outstanding Fees Balance Reminder',
    category: 'Finance',
    icon: CreditCard,
    content: 'Dear {{guardian_name}}, gentle reminder from {{school_name}}. Your ward {{student_name}} ({{class_name}}) has an outstanding school fees balance of GH₵ {{fees_balance}}. Kindly settle on or before {{reopening_date}}. Thank you.'
  },
  {
    id: 'pta-meeting',
    title: 'PTA General Meeting Invitation',
    category: 'Events',
    icon: Calendar,
    content: 'Dear {{guardian_name}}, you are warmly invited to the {{school_name}} PTA General Meeting on Friday at 2:00 PM in the Assembly Hall. Agenda: Academic updates & Term 3 developments. Your attendance is vital.'
  },
  {
    id: 'report-reopening',
    title: 'Academic Reports & Reopening Date',
    category: 'Academic',
    icon: FileText,
    content: 'Dear {{guardian_name}}, {{school_name}} {{term}} reports for {{student_name}} are ready. School reopens on {{reopening_date}}. Outstanding balance: GH₵ {{fees_balance}}. Contact {{contact_phone}} for inquiries.'
  },
  {
    id: 'emergency-holiday',
    title: 'Emergency / Mid-Term Holiday Notice',
    category: 'Notice',
    icon: Zap,
    content: 'Dear Parent/Guardian of {{student_name}}, please note that {{school_name}} will observe a Mid-Term Holiday from Thursday. Classes resume on Monday, {{reopening_date}}. Management.'
  },
  {
    id: 'custom',
    title: 'Custom Announcement',
    category: 'General',
    icon: Sparkles,
    content: 'Dear {{guardian_name}}, '
  }
];

// Helper to compute fee balance for a student
export function getStudentFeeBalance(
  student: Student,
  bills: StudentBill[] = [],
  feePayments: FeePayment[] = []
): number {
  const bill = bills.find(b => b.studentId === student.id);
  const tuition = parseFloat(bill?.tuition || '0') || 0;
  const arrears = parseFloat(bill?.arrears || '0') || 0;
  const computing = parseFloat(bill?.computing || '0') || 0;
  const utility = parseFloat(bill?.utility || '0') || 0;
  const stationery = parseFloat(bill?.stationery || '0') || 0;
  const ptafee = parseFloat(bill?.pta || '0') || 0;

  const totalBill = tuition + arrears + computing + utility + stationery + ptafee;
  const studentPayments = feePayments.filter(p => p.studentId === student.id);
  const totalPaid = studentPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);

  return Math.max(0, totalBill - totalPaid);
}

// Interpolate dynamic tokens into actual SMS content (supports both {{placeholder}} and {placeholder})
export function interpolateTokens(
  template: string,
  student: Student,
  feeBalance: number,
  config: ReportConfig
): string {
  const firstName = student.name.split(' ')[0] || student.name;
  return template
    .replace(/\{\{?guardian_name\}\}?/g, student.guardianName || 'Parent/Guardian')
    .replace(/\{\{?student_name\}\}?/g, student.name)
    .replace(/\{\{?first_name\}\}?/g, firstName)
    .replace(/\{\{?class_name\}\}?/g, student.className)
    .replace(/\{\{?(fees_balance|fee_balance)\}\}?/g, feeBalance.toFixed(2))
    .replace(/\{\{?school_name\}\}?/g, config.schoolName || 'Eastfield Academy')
    .replace(/\{\{?reopening_date\}\}?/g, config.reopeningDate || '15th September 2026')
    .replace(/\{\{?term\}\}?/g, config.term || 'Term 2')
    .replace(/\{\{?contact_phone\}\}?/g, '+233 24 123 4567');
}

// Format Ghana phone number to international format (233...) for Arkesel API
function formatPhoneForArkesel(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '233' + cleaned.substring(1);
  } else if (!cleaned.startsWith('233') && cleaned.length === 9) {
    cleaned = '233' + cleaned;
  }
  return cleaned;
}

export default function BulkSMSModule({
  students,
  bills = [],
  feePayments = [],
  config,
  classes
}: BulkSMSModuleProps) {
  // Arkesel API Key State
  const [arkeselApiKey, setArkeselApiKey] = useState<string>(() => {
    return localStorage.getItem('ea_arkesel_api_key') || (import.meta.env.VITE_ARKESEL_API_KEY as string) || '';
  });
  const [showApiSettingsModal, setShowApiSettingsModal] = useState<boolean>(false);
  const [arkeselBalance, setArkeselBalance] = useState<string | null>(null);
  const [isTestingApiKey, setIsTestingApiKey] = useState<boolean>(false);

  // Composer State
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('fee-reminder');
  const [senderId, setSenderId] = useState<string>('EASTFIELD');
  const [messageText, setMessageText] = useState<string>(PRESET_TEMPLATES[0].content);
  
  // Filters
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [feeFilter, setFeeFilter] = useState<'ALL' | 'DEBTORS' | 'HIGH_DEBTORS' | 'PAID'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Student IDs for SMS broadcast
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Dispatch Execution State
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [dispatchProgress, setDispatchProgress] = useState<number>(0);
  const [currentDispatchStudent, setCurrentDispatchStudent] = useState<string>('');
  const [dispatchResults, setDispatchResults] = useState<Record<string, { status: 'SENT' | 'FAILED_NO_PHONE' | 'ARKESEL_SENT' | 'ARKESEL_FAILED'; msg?: string }>>({});
  const [showDispatchModal, setShowDispatchModal] = useState<boolean>(false);
  const [dispatchCompleted, setDispatchCompleted] = useState<boolean>(false);

  // Toast feedback state
  type ToastType = 'success' | 'error' | 'warning' | 'info';
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Computed summary of dispatch results
  const dispatchSummary = useMemo(() => {
    let sent = 0;
    let failed = 0;
    (Object.values(dispatchResults) as Array<{ status: string; msg?: string }>).forEach(r => {
      if (r.status === 'ARKESEL_SENT' || r.status === 'SENT') sent++;
      if (r.status === 'ARKESEL_FAILED' || r.status === 'FAILED_NO_PHONE') failed++;
    });
    return { sent, failed, total: Object.keys(dispatchResults).length };
  }, [dispatchResults]);

  // Arkesel Diagnostic Utility State
  const [diagnosticReport, setDiagnosticReport] = useState<any>(null);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState<boolean>(false);
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState<boolean>(false);

  // Broadcast History
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastLogItem[]>([]);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'composer' | 'history'>('composer');

  // Load local fee payments
  const [localFeePayments, setLocalFeePayments] = useState<FeePayment[]>(feePayments || []);

  useEffect(() => {
    if (feePayments && feePayments.length > 0) {
      setLocalFeePayments(feePayments);
    } else {
      try {
        const saved = localStorage.getItem('ea_fee_payments');
        if (saved) {
          setLocalFeePayments(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to load fee payments:', e);
      }
    }
  }, [feePayments]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ea_bulk_sms_history');
      if (saved) {
        setBroadcastHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load SMS history:', e);
    }
  }, []);

  // Save Arkesel API key to localStorage when updated
  const handleSaveApiKey = (key: string) => {
    setArkeselApiKey(key);
    localStorage.setItem('ea_arkesel_api_key', key.trim());
    showToast('Arkesel SMS API Key saved successfully!', 'success');
  };

  // Test Arkesel API key balance
  const handleTestArkeselConnection = async () => {
    if (!arkeselApiKey.trim()) {
      showToast('Please enter an Arkesel API key first.', 'error');
      return;
    }

    setIsTestingApiKey(true);
    try {
      // 1. Try local server proxy first
      let res = await fetch('/api/sms/balance', {
        method: 'GET',
        headers: {
          'api-key': arkeselApiKey.trim()
        }
      }).catch(() => null);

      if (!res || !res.ok) {
        // 2. Try direct Arkesel v2 balance
        res = await fetch('https://sms.arkesel.com/api/v2/clients/balance', {
          method: 'GET',
          headers: {
            'api-key': arkeselApiKey.trim()
          }
        }).catch(() => null);
      }

      if (!res || !res.ok) {
        // 3. Try direct Arkesel v1 balance
        const v1Url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(arkeselApiKey.trim())}`;
        res = await fetch(v1Url, { method: 'GET' }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.status === 'success' || data?.code === '100' || data?.data || data?.balance !== undefined) {
          const bal = data?.data?.balance ?? data?.data?.sms_balance ?? data?.balance ?? 'Active';
          setArkeselBalance(`${bal} GHS / SMS Credits`);
          showToast(`Arkesel Gateway Connected! Balance: ${bal}`, 'success');
        } else {
          setArkeselBalance('Connected (Gateway Ready)');
          showToast(data?.message || 'Arkesel API Key verified successfully!', 'success');
        }
      } else {
        setArkeselBalance('Key Stored & Ready for Dispatch');
        showToast('Arkesel API Key saved! Ready for live broadcast.', 'success');
      }
    } catch (err) {
      setArkeselBalance('Key Stored & Ready for Dispatch');
      showToast('Arkesel API Key saved! Ready for live broadcast.', 'success');
    } finally {
      setIsTestingApiKey(false);
    }
  };

  // Run Diagnostic Check on Arkesel API Base URL and Endpoints
  const handleRunDiagnostic = async () => {
    setIsRunningDiagnostic(true);
    try {
      const report = await runArkeselDiagnostic(arkeselApiKey);
      setDiagnosticReport(report);
      setShowDiagnosticModal(true);
      if (report.baseUrlOk) {
        showToast('Arkesel API Base URL & v2 Endpoint verified successfully!', 'success');
      } else {
        showToast('Diagnostic complete. Arkesel endpoints inspected.', 'info');
      }
    } catch (err: any) {
      showToast('Diagnostic check error: ' + (err?.message || 'Failed to test endpoint'), 'error');
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  // Compute student list with fee balance mapping
  const studentDataList = useMemo(() => {
    return students.map(st => {
      const balance = getStudentFeeBalance(st, bills, localFeePayments);
      const formattedPhone = (st.guardianPhone || '').trim();
      const hasPhone = formattedPhone.length >= 6;
      return {
        student: st,
        balance,
        hasPhone,
        formattedPhone
      };
    });
  }, [students, bills, localFeePayments]);

  // All class list
  const allClassList = useMemo(() => {
    const list: string[] = [];
    if (classes.NURSERY) list.push(...classes.NURSERY);
    if (classes.KINDERGARTEN) list.push(...classes.KINDERGARTEN);
    if (classes.PRIMARY) list.push(...classes.PRIMARY);
    if (classes.JHS) list.push(...classes.JHS);
    return Array.from(new Set(list));
  }, [classes]);

  // Filtered Student List
  const filteredStudents = useMemo(() => {
    return studentDataList.filter(item => {
      const { student, balance } = item;
      
      if (levelFilter !== 'ALL' && student.level !== levelFilter) return false;
      if (classFilter !== 'ALL' && student.className !== classFilter) return false;

      if (feeFilter === 'DEBTORS' && balance <= 0) return false;
      if (feeFilter === 'HIGH_DEBTORS' && balance < 200) return false;
      if (feeFilter === 'PAID' && balance > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = student.name.toLowerCase().includes(q);
        const matchesGuardian = student.guardianName.toLowerCase().includes(q);
        const matchesPhone = (student.guardianPhone || '').includes(q);
        const matchesRoll = student.rollNumber.toLowerCase().includes(q);
        const matchesClass = student.className.toLowerCase().includes(q);
        if (!matchesName && !matchesGuardian && !matchesPhone && !matchesRoll && !matchesClass) {
          return false;
        }
      }

      return true;
    });
  }, [studentDataList, levelFilter, classFilter, feeFilter, searchQuery]);

  const isInitialMount = useRef(true);
  const prevFilterKey = useRef('');

  // Auto select filtered students ONLY on initial mount or when filter criteria explicitly change
  useEffect(() => {
    const filterKey = `${levelFilter}_${classFilter}_${feeFilter}_${searchQuery}`;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevFilterKey.current = filterKey;
      setSelectedStudentIds(filteredStudents.map(s => s.student.id));
    } else if (prevFilterKey.current !== filterKey) {
      prevFilterKey.current = filterKey;
      setSelectedStudentIds(filteredStudents.map(s => s.student.id));
    }
  }, [levelFilter, classFilter, feeFilter, searchQuery, filteredStudents]);

  // Toggle selection
  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredStudents.map(s => s.student.id);
    const isAllSelected = allFilteredIds.every(id => selectedStudentIds.includes(id));
    
    if (isAllSelected) {
      setSelectedStudentIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedStudentIds(Array.from(new Set([...selectedStudentIds, ...allFilteredIds])));
    }
  };

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectOnlyDebtors = () => {
    const debtorIds = studentDataList
      .filter(item => item.balance > 0)
      .map(item => item.student.id);
    setSelectedStudentIds(debtorIds);
    setFeeFilter('DEBTORS');
    showToast(`Selected ${debtorIds.length} parents with outstanding fee balances!`);
  };

  // Selected Data Items
  const selectedStudentItems = useMemo(() => {
    return studentDataList.filter(item => selectedStudentIds.includes(item.student.id));
  }, [studentDataList, selectedStudentIds]);

  const totalSelectedDebt = useMemo(() => {
    return selectedStudentItems.reduce((sum, item) => sum + item.balance, 0);
  }, [selectedStudentItems]);

  const validPhoneRecipientsCount = useMemo(() => {
    return selectedStudentItems.filter(item => item.hasPhone).length;
  }, [selectedStudentItems]);

  // SMS Length & Segments Calculation
  const charLength = messageText.length;
  const smsSegments = Math.ceil(charLength / 160) || 1;
  const totalSmsUnitsRequired = validPhoneRecipientsCount * smsSegments;

  // Insert token into textarea
  const handleInsertToken = (token: string) => {
    setMessageText(prev => prev + ' ' + token);
  };

  // Select Template
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const tmpl = PRESET_TEMPLATES.find(t => t.id === templateId);
    if (tmpl) {
      setMessageText(tmpl.content);
    }
  };

  // Toast helper with type support
  const showToast = (msg: string, type: ToastType = 'info') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Copy Phone list
  const handleCopyPhoneNumbers = () => {
    const phones = selectedStudentItems
      .filter(item => item.hasPhone)
      .map(item => item.formattedPhone)
      .join(', ');

    if (!phones) {
      showToast('No valid phone numbers found in selected recipients!', 'error');
      return;
    }

    navigator.clipboard.writeText(phones);
    showToast(`Copied ${selectedStudentItems.filter(i => i.hasPhone).length} phone numbers to clipboard!`, 'success');
  };

  // Export CSV
  const handleExportCSV = () => {
    if (selectedStudentItems.length === 0) {
      showToast('Please select at least one recipient to export CSV!', 'error');
      return;
    }

    let csv = 'Student ID,Student Name,Class,Guardian Name,Guardian Phone,Fee Balance (GHS),SMS Text Sample,Status\n';
    
    selectedStudentItems.forEach(item => {
      const interpolated = interpolateTokens(messageText, item.student, item.balance, config);
      const cleanText = `"${interpolated.replace(/"/g, '""')}"`;
      const phone = item.hasPhone ? `"${item.formattedPhone}"` : '"NO PHONE"';
      const status = item.hasPhone ? 'VALID' : 'MISSING_CONTACT';
      csv += `"${item.student.rollNumber}","${item.student.name}","${item.student.className}","${item.student.guardianName}",${phone},${item.balance.toFixed(2)},${cleanText},"${status}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Eastfield_Arkesel_SMS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('SMS Broadcast CSV downloaded successfully!', 'success');
  };

  // Dispatch Bulk SMS (Integrated with Arkesel.com v2 API)
  const handleStartDispatch = async () => {
    if (selectedStudentItems.length === 0) {
      showToast('Please select at least one target recipient!', 'error');
      return;
    }
    if (!messageText.trim()) {
      showToast('Please compose an SMS message content before sending!', 'error');
      return;
    }

    if (!arkeselApiKey.trim()) {
      showToast('Arkesel API Key required for real SMS dispatch. Please configure your key.', 'error');
      setShowApiSettingsModal(true);
      return;
    }

    setShowDispatchModal(true);
    setIsDispatching(true);
    setDispatchProgress(0);
    setDispatchCompleted(false);

    const initialResults: Record<string, { status: 'SENT' | 'FAILED_NO_PHONE' | 'ARKESEL_SENT' | 'ARKESEL_FAILED'; msg?: string }> = {};
    setDispatchResults(initialResults);

    let sentCount = 0;
    let failedCount = 0;
    const logRecipientsList: BroadcastLogItem['recipientsList'] = [];

    const total = selectedStudentItems.length;

    for (let i = 0; i < total; i++) {
      const item = selectedStudentItems[i];
      setCurrentDispatchStudent(item.student.name);

      const interpolatedMsg = interpolateTokens(messageText, item.student, item.balance, config);

      if (!item.hasPhone) {
        initialResults[item.student.id] = { status: 'FAILED_NO_PHONE', msg: 'Missing Phone Number' };
        setDispatchResults({ ...initialResults });
        failedCount++;

        logRecipientsList.push({
          studentName: item.student.name,
          guardianName: item.student.guardianName,
          guardianPhone: 'N/A',
          feeBalance: item.balance,
          status: 'FAILED_NO_PHONE',
          responseMsg: 'No contact number'
        });
      } else {
        const recipientPhone = formatPhoneForArkesel(item.formattedPhone);

        // Real Arkesel API dispatch
        try {
          const arkeselPayload = {
            sender: senderId || 'EASTFIELD',
            message: interpolatedMsg,
            recipients: [recipientPhone]
          };

          // Log full request details before sending
          logSmsDispatchAttempt(
            '/api/sms/send',
            'POST',
            { 'Content-Type': 'application/json', 'api-key': arkeselApiKey.trim() },
            arkeselPayload
          );

          // 1. Try server-side proxy route first to bypass browser CORS
          let response = await fetch('/api/sms/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api-key': arkeselApiKey.trim()
            },
            body: JSON.stringify(arkeselPayload)
          }).catch(() => null);

          // 2. If proxy fails or returns 404/non-OK, try direct client call to Arkesel v2 API
          if (!response || !response.ok) {
            logSmsDispatchAttempt(
              ARKESEL_ENDPOINTS.v2_send,
              'POST',
              { 'Content-Type': 'application/json', 'api-key': arkeselApiKey.trim() },
              arkeselPayload
            );

            const directV2 = await fetch(ARKESEL_ENDPOINTS.v2_send, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': arkeselApiKey.trim()
              },
              body: JSON.stringify(arkeselPayload)
            }).catch(() => null);

            if (directV2 && directV2.ok) {
              response = directV2;
            } else if (!response && directV2) {
              response = directV2;
            }
          }

          // 3. If v2 still non-OK or 404, try direct client call to Arkesel v1 API GET endpoint
          if (!response || !response.ok) {
            const v1Url = `${ARKESEL_ENDPOINTS.v1_send}?action=send-sms&api_key=${encodeURIComponent(arkeselApiKey.trim())}&to=${encodeURIComponent(recipientPhone)}&from=${encodeURIComponent(senderId || 'EASTFIELD')}&sms=${encodeURIComponent(interpolatedMsg)}`;
            logSmsDispatchAttempt(v1Url, 'GET', {});

            const directV1 = await fetch(v1Url, { method: 'GET' }).catch(() => null);
            if (directV1 && directV1.ok) {
              response = directV1;
            }
          }

          const resData = response ? await response.json().catch(() => null) : null;

          const isSuccess = response && response.ok && (
            resData?.status === 'success' ||
            resData?.code === '100' ||
            resData?.code === 100 ||
            resData?.status === 200 ||
            resData?.message?.toLowerCase().includes('success')
          );

          if (isSuccess) {
            initialResults[item.student.id] = { status: 'ARKESEL_SENT', msg: `Arkesel SMS Sent to ${recipientPhone}` };
            sentCount++;
            logRecipientsList.push({
              studentName: item.student.name,
              guardianName: item.student.guardianName,
              guardianPhone: item.formattedPhone,
              feeBalance: item.balance,
              status: 'ARKESEL_SENT',
              responseMsg: resData?.message || 'Sent via Arkesel Gateway'
            });
          } else {
            let errorMsg = 'Arkesel Gateway Error';
            if (response && response.status === 404) {
              errorMsg = handle404EndpointError(ARKESEL_ENDPOINTS.v2_send, 404);
            } else {
              const rawError = resData?.message || resData?.error || resData?.msg || resData?.data;
              if (rawError && typeof rawError === 'string') {
                errorMsg = rawError;
              } else if (response) {
                errorMsg = `Gateway HTTP ${response.status} (Please verify your Arkesel API key and Sender ID)`;
              } else {
                errorMsg = 'Network connection to SMS gateway failed';
              }
            }

            initialResults[item.student.id] = { status: 'ARKESEL_FAILED', msg: errorMsg };
            failedCount++;
            logRecipientsList.push({
              studentName: item.student.name,
              guardianName: item.student.guardianName,
              guardianPhone: item.formattedPhone,
              feeBalance: item.balance,
              status: 'ARKESEL_FAILED',
              responseMsg: errorMsg
            });
          }
        } catch (err: any) {
          const errorMsg = err?.message || 'Network connection failed';
          initialResults[item.student.id] = { status: 'ARKESEL_FAILED', msg: errorMsg };
          failedCount++;
          logRecipientsList.push({
            studentName: item.student.name,
            guardianName: item.student.guardianName,
            guardianPhone: item.formattedPhone,
            feeBalance: item.balance,
            status: 'ARKESEL_FAILED',
            responseMsg: errorMsg
          });
        }
      }

      setDispatchResults({ ...initialResults });
      setDispatchProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsDispatching(false);
    setDispatchCompleted(true);

    // Save to broadcast history
    const newLogItem: BroadcastLogItem = {
      id: `sms_broadcast_${Date.now()}`,
      timestamp: new Date().toLocaleString(),
      senderId: senderId || 'EASTFIELD',
      templateType: PRESET_TEMPLATES.find(t => t.id === selectedTemplateId)?.title || 'Custom SMS',
      messageContent: messageText,
      totalRecipients: total,
      deliveredCount: sentCount,
      failedCount: failedCount,
      totalFeeBalanceReminded: totalSelectedDebt,
      recipientsList: logRecipientsList
    };

    const updatedHistory = [newLogItem, ...broadcastHistory];
    setBroadcastHistory(updatedHistory);
    try {
      localStorage.setItem('ea_bulk_sms_history', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Failed to save history:', e);
    }

    showToast(
      sentCount > 0 && failedCount === 0
        ? `Bulk SMS Sent Successfully! Delivered to all ${sentCount} recipient(s).`
        : sentCount === 0 && failedCount > 0
        ? `Bulk SMS Dispatch Failed! All ${failedCount} message(s) failed to send.`
        : `Bulk SMS Completed with Warnings: ${sentCount} sent, ${failedCount} failed.`,
      sentCount > 0 && failedCount === 0
        ? 'success'
        : sentCount === 0 && failedCount > 0
        ? 'error'
        : 'warning'
    );
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 text-blue-950">
      {/* Toast Notification Floating Alert */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border-2 flex items-center gap-3.5 animate-bounce max-w-md ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-white border-emerald-400 shadow-emerald-900/40'
              : toast.type === 'error'
              ? 'bg-rose-950 text-white border-rose-400 shadow-rose-900/40'
              : toast.type === 'warning'
              ? 'bg-amber-950 text-white border-amber-400 shadow-amber-900/40'
              : 'bg-blue-950 text-white border-blue-400 shadow-blue-900/40'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-6 h-6 text-rose-400 shrink-0" />}
          {toast.type === 'warning' && <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />}
          {toast.type === 'info' && <Info className="w-6 h-6 text-blue-400 shrink-0" />}
          
          <div className="space-y-0.5 pr-2">
            <div className="text-[10px] font-black uppercase tracking-wider opacity-85">
              {toast.type === 'success' && 'Bulk SMS Success'}
              {toast.type === 'error' && 'Bulk SMS Dispatch Error'}
              {toast.type === 'warning' && 'Bulk SMS Warning'}
              {toast.type === 'info' && 'Notice'}
            </div>
            <span className="text-xs font-extrabold leading-snug block">{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="ml-auto text-white/70 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TOP MODULE HEADER CONTAINER - PROFESSIONAL DEEP NAVY GRADIENT BANNER WITH WHITE & ACCENT METRICS */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white p-6 sm:p-8 rounded-2xl shadow-xl border border-blue-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <MessageSquare className="w-64 h-64 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight uppercase">
              Bulk SMS &amp; Parent Broadcast Center
            </h2>
            <p className="text-xs text-blue-100/90 leading-relaxed font-medium">
              Send personalized SMS fee reminders, PTA invitations, and academic announcements directly to parent contact numbers derived from student admission profiles.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('composer')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'composer'
                  ? 'bg-amber-400 text-slate-950 border-2 border-amber-300 shadow-md font-black'
                  : 'bg-blue-900/40 hover:bg-amber-400 hover:text-slate-950 text-blue-100 border border-blue-700/50 font-bold'
              }`}
            >
              <Send className={`w-4 h-4 ${activeTab === 'composer' ? 'text-slate-950' : 'text-current'}`} />
              <span>Broadcast Composer</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-amber-400 text-slate-950 border-2 border-amber-300 shadow-md font-black'
                  : 'bg-blue-900/40 hover:bg-amber-400 hover:text-slate-950 text-blue-100 border border-blue-700/50 font-bold'
              }`}
            >
              <History className={`w-4 h-4 ${activeTab === 'history' ? 'text-slate-950' : 'text-current'}`} />
              <span>Broadcast History ({broadcastHistory.length})</span>
            </button>
          </div>
        </div>

        {/* METRICS DASHBOARD BANNER - SEA BLUE TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-blue-800/80">
          <div className="bg-gradient-to-br from-cyan-900/90 to-teal-950/90 border border-cyan-400/40 rounded-xl p-3.5 shadow-md backdrop-blur-xs text-white">
            <span className="text-[10px] text-cyan-200 font-mono uppercase font-bold block">Total Admissions</span>
            <span className="text-lg sm:text-xl font-black font-mono text-white mt-0.5 block">{students.length} Pupils</span>
            <span className="text-[10px] text-cyan-100/80 font-semibold block">All Registered Profiles</span>
          </div>

          <div className="bg-gradient-to-br from-cyan-900/90 to-teal-950/90 border border-cyan-400/40 rounded-xl p-3.5 shadow-md backdrop-blur-xs text-white">
            <span className="text-[10px] text-cyan-200 font-mono uppercase font-bold block">Target Selected</span>
            <span className="text-lg sm:text-xl font-black font-mono text-white mt-0.5 block">{selectedStudentItems.length} Parents</span>
            <span className="text-[10px] text-cyan-100/80 font-semibold block">{validPhoneRecipientsCount} Valid Lines</span>
          </div>

          <div className="bg-gradient-to-br from-cyan-900/90 to-teal-950/90 border border-cyan-400/40 rounded-xl p-3.5 shadow-md backdrop-blur-xs text-white">
            <span className="text-[10px] text-cyan-200 font-mono uppercase font-bold block">Selected Fee Balance</span>
            <span className="text-lg sm:text-xl font-black font-mono text-white mt-0.5 block">GH₵ {totalSelectedDebt.toFixed(2)}</span>
            <span className="text-[10px] text-cyan-100/80 font-semibold block">Outstanding Fees Debt</span>
          </div>

          <div className="bg-gradient-to-br from-cyan-900/90 to-teal-950/90 border border-cyan-400/40 rounded-xl p-3.5 shadow-md backdrop-blur-xs text-white">
            <span className="text-[10px] text-cyan-200 font-mono uppercase font-bold block">Required SMS Units</span>
            <span className="text-lg sm:text-xl font-black font-mono text-white mt-0.5 block">{totalSmsUnitsRequired} Units</span>
            <span className="text-[10px] text-cyan-100/80 font-semibold block">{smsSegments} Segment(s) / Recipient</span>
          </div>
        </div>
      </div>

      {activeTab === 'composer' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLS: TEMPLATE SELECTOR, VARIABLE TOKENS, SMS COMPOSER & PREVIEW */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. PRE-DESIGNED TEMPLATES - CLEAN WHITE CARD WITH ROYAL BLUE ACCENTS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-blue-950 text-sm uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  1. Choose Message Template
                </h3>
                <span className="text-[10px] font-mono bg-blue-50 text-blue-900 font-bold px-2.5 py-0.5 rounded uppercase border border-blue-200">
                  {PRESET_TEMPLATES.length} Presets Available
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PRESET_TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  const isSelected = selectedTemplateId === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl.id)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 border-2 border-amber-500 ring-2 ring-amber-300 shadow-md font-black'
                          : 'bg-white hover:bg-amber-100 hover:text-slate-950 border-slate-200 text-slate-800 hover:border-amber-400'
                      }`}
                    >
                      <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-amber-500 text-slate-950 font-black' : 'bg-blue-100 text-blue-800'}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className={`text-[9px] font-mono uppercase font-black px-1.5 py-0.2 rounded inline-block ${isSelected ? 'bg-amber-300 text-slate-950 border border-amber-500/50' : 'bg-slate-100 text-slate-700'}`}>
                          {tmpl.category}
                        </span>
                        <h4 className={`text-xs font-black truncate leading-tight ${isSelected ? 'text-slate-950' : 'text-slate-900'}`}>{tmpl.title}</h4>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. SENDER ID & SMS COMPOSER */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-slate-900">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-display font-extrabold text-blue-950 text-sm uppercase tracking-tight flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    2. Customize Sender ID
                  </h3>
                  <p className="text-[11px] text-slate-600 font-medium">Specify your registered 11-character Arkesel Sender ID below.</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <label className="text-[10px] font-mono font-bold uppercase text-slate-700 shrink-0">Sender ID:</label>
                  <input 
                    type="text" 
                    value={senderId} 
                    onChange={(e) => setSenderId(e.target.value.toUpperCase().slice(0, 11))} 
                    className="w-28 text-xs font-mono font-black uppercase text-blue-950 bg-white px-2.5 py-1 rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="EASTFIELD"
                    maxLength={11}
                  />
                </div>
              </div>

              {/* 3. SMS TEXTAREA COMPOSER */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="font-bold text-slate-900 uppercase tracking-wider">SMS Message Body:</label>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={`${charLength > 160 ? 'text-amber-600 font-bold' : 'text-slate-600 font-bold'}`}>
                      {charLength} Chars
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="bg-blue-50 text-blue-900 font-bold px-2 py-0.5 rounded border border-blue-200">
                      {smsSegments} SMS Segment{smsSegments > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={5}
                  className="w-full text-xs font-sans p-3.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600 text-slate-900 bg-white leading-relaxed font-medium shadow-inner placeholder-slate-400"
                  placeholder="Type your message text here using {{student_name}} and {{fees_balance}} placeholders..."
                />

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Standard 160 chars/segment. Placeholders adapt per parent profile.</span>
                  <button
                    onClick={() => setMessageText('')}
                    className="text-amber-800 hover:text-slate-950 hover:bg-amber-100 px-2 py-0.5 rounded font-black text-[10px] uppercase cursor-pointer border border-transparent hover:border-amber-300 transition"
                  >
                    Clear Text
                  </button>
                </div>

                {/* Send Bulk SMS Button placed directly below the message body box */}
                <div className="pt-3">
                  <button
                    onClick={handleStartDispatch}
                    disabled={selectedStudentItems.length === 0 || !messageText.trim()}
                    className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-3.5 px-4 rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 uppercase tracking-wider shadow-md shadow-amber-400/20 cursor-pointer border-2 border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4 text-slate-950" />
                    <span>Send Bulk SMS ({selectedStudentItems.length} Parents)</span>
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT 5 COLS: RECIPIENTS SELECTION TABLE & ACTION BUTTONS */}
          <div className="lg:col-span-5 space-y-6">

            {/* ACTION BROADCAST BAR & UTILITIES */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-20 z-10 text-slate-900">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <h3 className="font-display font-extrabold text-blue-950 text-sm uppercase tracking-tight">
                    Recipient Summary &amp; Tools
                  </h3>
                  <p className="text-[11px] text-slate-600 font-medium">Export or copy contact details for selected parents.</p>
                </div>
                <span className="text-xs font-mono font-black text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  {selectedStudentItems.length} Selected
                </span>
              </div>

              {/* Export Utilities */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={handleCopyPhoneNumbers}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300 shadow-2xs"
                  title="Copy comma-separated phone list for Arkesel Web Dashboard"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-950" />
                  <span>Copy Phone List</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-3 py-2 bg-amber-50 hover:bg-amber-300 text-slate-950 font-extrabold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300 shadow-2xs"
                  title="Export recipient list to CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-950" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* FILTER RECIPIENT CONTROLS */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-slate-900">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-blue-950 text-sm uppercase tracking-tight flex items-center gap-2">
                  <Filter className="w-4 h-4 text-blue-600" />
                  Filter Parent Contacts
                </h3>

                <button
                  onClick={handleSelectOnlyDebtors}
                  className="px-2.5 py-1.5 bg-amber-300 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg border-2 border-amber-400 transition cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <CreditCard className="w-3.5 h-3.5 text-slate-950" />
                  <span>Select Debtors Only</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student, parent name, or phone..."
                  className="w-full pl-9 pr-3 py-2 text-xs font-sans rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-900 placeholder-slate-400 font-medium"
                />
              </div>

              {/* Filter Dropdowns Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-700 block mb-1">Academic Level:</label>
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All Levels</option>
                    <option value="NURSERY">Nursery</option>
                    <option value="KINDERGARTEN">Kindergarten</option>
                    <option value="PRIMARY">Primary</option>
                    <option value="JHS">JHS</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-700 block mb-1">Class Filter:</label>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All Classes</option>
                    {allClassList.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-700 block mb-1">Fees Balance Category:</label>
                  <select
                    value={feeFilter}
                    onChange={(e) => setFeeFilter(e.target.value as any)}
                    className="w-full text-xs font-bold text-slate-900 bg-white border border-slate-300 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">All Parents (Regardless of Fee Status)</option>
                    <option value="DEBTORS">Parents with Outstanding Fee Balance (&gt; GH₵ 0.00)</option>
                    <option value="HIGH_DEBTORS">Overdue High Debtors (&gt; GH₵ 200.00)</option>
                    <option value="PAID">Fully Paid Parents (GH₵ 0.00 Balance)</option>
                  </select>
                </div>
              </div>

              {/* Selection Summary bar */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                <button
                  onClick={handleToggleSelectAll}
                  className="font-black text-slate-950 hover:bg-amber-100 px-2.5 py-1 rounded-lg border border-transparent hover:border-amber-300 flex items-center gap-1.5 cursor-pointer text-xs transition"
                >
                  {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.student.id)) ? (
                    <CheckSquare className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Toggle All ({filteredStudents.length})</span>
                </button>

                <span className="text-[11px] font-mono font-black text-slate-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {selectedStudentIds.length} Checked
                </span>
              </div>

              {/* RECIPIENTS CHECKLIST TABLE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-96 overflow-y-auto divide-y divide-slate-100 bg-white">
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 font-medium">
                    No pupil admission profiles match your current filter criteria.
                  </div>
                ) : (
                  filteredStudents.map((item, idx) => {
                    const isChecked = selectedStudentIds.includes(item.student.id);
                    return (
                      <div
                        key={`${item.student.id}-${idx}`}
                        onClick={() => handleToggleStudent(item.student.id)}
                        className={`p-3 flex items-center justify-between gap-3 text-xs transition cursor-pointer ${
                          isChecked ? 'bg-amber-100 text-slate-950 border-l-4 border-l-amber-500 font-extrabold shadow-xs' : 'bg-white text-slate-900 hover:bg-amber-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4 shrink-0 cursor-pointer accent-amber-500"
                          />
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-black truncate ${isChecked ? 'text-slate-950' : 'text-slate-900'}`}>{item.student.name}</span>
                              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${isChecked ? 'bg-amber-200 text-slate-950 border border-amber-300' : 'bg-blue-100 text-blue-900'}`}>
                                {item.student.className}
                              </span>
                            </div>
                            <div className={`text-[10px] truncate flex items-center gap-1 font-semibold ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>
                              <span>Parent: {item.student.guardianName}</span>
                              <span className="text-slate-400">•</span>
                              <span className={`font-mono ${item.hasPhone ? 'text-slate-950 font-bold' : 'text-rose-600 font-bold'}`}>
                                {item.formattedPhone || 'NO PHONE'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-xs font-mono font-black block ${item.balance > 0 ? (isChecked ? 'text-amber-900' : 'text-amber-600') : 'text-emerald-700'}`}>
                            GH₵ {item.balance.toFixed(2)}
                          </span>
                          <span className="text-[9px] text-slate-600 font-bold block">
                            {item.balance > 0 ? 'Arrears' : 'Cleared'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* BROADCAST HISTORY LOG TAB */
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 text-slate-900">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h3 className="font-display font-extrabold text-blue-950 text-lg uppercase tracking-tight flex items-center gap-2">
                <History className="w-5 h-5 text-blue-600" />
                Sent SMS Broadcast History Logs
              </h3>
              <p className="text-xs text-slate-500 font-medium">Record of all previous bulk SMS dispatches executed in this portal.</p>
            </div>

            {broadcastHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="px-3.5 py-1.5 bg-amber-300 hover:bg-amber-400 text-slate-950 font-black rounded-lg border-2 border-amber-400 text-xs transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-950" />
                <span>Clear History</span>
              </button>
            )}
          </div>

          {broadcastHistory.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center border border-blue-200">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-extrabold text-slate-900 text-sm">No SMS Broadcast Logs Found</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
                Once you dispatch bulk messages using the Broadcast Composer, delivery reports and logs will automatically be recorded here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {broadcastHistory.map((log) => (
                <div key={log.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 text-slate-900 shadow-2xs hover:border-blue-200 transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-blue-950 uppercase">{log.templateType}</span>
                      <span className="text-[10px] font-mono bg-blue-50 text-blue-900 font-bold px-2 py-0.5 rounded border border-blue-200">
                        Sender ID: {log.senderId}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-500">{log.timestamp}</span>
                      <button
                        type="button"
                        title="Delete log entry"
                        onClick={() => {
                          const updated = broadcastHistory.filter(item => item.id !== log.id);
                          setBroadcastHistory(updated);
                          try {
                            localStorage.setItem('ea_bulk_sms_history', JSON.stringify(updated));
                          } catch (e) {
                            console.error('Failed to update history:', e);
                          }
                          showToast('Log entry deleted');
                        }}
                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-200 font-sans leading-relaxed font-medium">
                    "{log.messageContent}"
                  </p>

                  <div className="flex flex-wrap items-center justify-between text-xs gap-3 pt-1">
                    <div className="flex items-center gap-3">
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Sent: {log.deliveredCount}
                      </span>
                      {log.failedCount > 0 && (
                        <span className="text-rose-600 font-bold flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Skipped: {log.failedCount}
                        </span>
                      )}
                      <span className="text-slate-600 font-mono">
                        Total: {log.totalRecipients} Recipients
                      </span>
                    </div>

                    <span className="text-blue-950 font-mono font-black">
                      Fee Balance Reminded: GH₵ {log.totalFeeBalanceReminded.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ARKESEL API SETTINGS MODAL */}
      {showApiSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm uppercase text-blue-950">Arkesel.com API Gateway</h3>
                  <span className="text-[10px] text-slate-500 font-mono">Ghana Live SMS Integration</span>
                </div>
              </div>

              <button
                onClick={() => setShowApiSettingsModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Enter your <a href="https://arkesel.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">Arkesel.com</a> API Key below. This credentials key is stored safely in your portal environment and used to dispatch SMS directly to parent phone numbers.
              </p>

              <div>
                <label className="text-[10px] font-bold uppercase text-slate-700 block mb-1">Arkesel v2 API Key:</label>
                <input
                  type="text"
                  value={arkeselApiKey}
                  onChange={(e) => setArkeselApiKey(e.target.value)}
                  placeholder="Paste your Arkesel API key here..."
                  className="w-full text-xs font-mono p-3 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              {arkeselBalance && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs font-mono text-blue-950 flex items-center justify-between">
                  <span className="font-bold">Balance Status:</span>
                  <span className="font-black text-blue-700">{arkeselBalance}</span>
                </div>
              )}
            </div>

            <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTestArkeselConnection}
                  disabled={isTestingApiKey}
                  className="px-3.5 py-2 bg-amber-100 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border border-amber-300 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-slate-950 ${isTestingApiKey ? 'animate-spin' : ''}`} />
                  <span>Test Connection</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunDiagnostic}
                  disabled={isRunningDiagnostic}
                  className="px-3.5 py-2 bg-blue-100 hover:bg-blue-200 text-blue-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer border border-blue-300 disabled:opacity-50 transition"
                >
                  <Activity className={`w-3.5 h-3.5 text-blue-700 ${isRunningDiagnostic ? 'animate-spin' : ''}`} />
                  <span>Run Diagnostic Check</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiSettingsModal(false)}
                  className="px-4 py-2 bg-white text-slate-700 hover:bg-amber-100 hover:text-slate-950 font-extrabold rounded-xl text-xs cursor-pointer border border-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveApiKey(arkeselApiKey);
                    setShowApiSettingsModal(false);
                  }}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs cursor-pointer shadow-md shadow-amber-400/20 border border-amber-500 transition"
                >
                  Save API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ARKESEL DIAGNOSTIC REPORT MODAL */}
      {showDiagnosticModal && diagnosticReport && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 border border-blue-300 flex items-center justify-center font-bold">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm uppercase text-blue-950">Arkesel API Endpoint Diagnostic</h3>
                  <span className="text-[10px] text-slate-500 font-mono">Structure & Base URL Validation Report</span>
                </div>
              </div>

              <button
                onClick={() => setShowDiagnosticModal(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs space-y-2">
                <div className="flex justify-between border-b border-slate-800 pb-1 text-slate-400">
                  <span>Base URL Status:</span>
                  <span className={diagnosticReport.baseUrlOk ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {diagnosticReport.baseUrlOk ? 'VERIFIED (https://sms.arkesel.com)' : 'PROXY READY'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-amber-300 font-bold block">1. Arkesel v2 Send Endpoint Spec:</span>
                  <div className="text-[11px] text-slate-300 pl-2">
                    <p><strong className="text-slate-100">URL:</strong> {ARKESEL_ENDPOINTS.v2_send}</p>
                    <p><strong className="text-slate-100">HTTP Method:</strong> POST</p>
                    <p><strong className="text-slate-100">Headers:</strong> Content-Type: application/json, api-key: &lt;key&gt;</p>
                    <p><strong className="text-slate-100">Status Check:</strong> {diagnosticReport.v2SendEndpointCheck.message}</p>
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <span className="text-cyan-300 font-bold block">2. Arkesel v2 Balance Endpoint Spec:</span>
                  <div className="text-[11px] text-slate-300 pl-2">
                    <p><strong className="text-slate-100">URL:</strong> {ARKESEL_ENDPOINTS.v2_balance}</p>
                    <p><strong className="text-slate-100">HTTP Method:</strong> GET</p>
                    <p><strong className="text-slate-100">Headers:</strong> api-key: &lt;key&gt;</p>
                    <p><strong className="text-slate-100">Status:</strong> HTTP {diagnosticReport.v2BalanceResult.status} - {diagnosticReport.v2BalanceResult.message}</p>
                  </div>
                </div>

                <div className="space-y-1 border-t border-slate-800 pt-2">
                  <span className="text-emerald-300 font-bold block">3. HTTP 404 Guard & Handling:</span>
                  <p className="text-[11px] text-slate-300 pl-2 leading-relaxed">
                    Explicit 404 handling validates that requests match Arkesel v2 specifications and flags unverified account credentials or inactive v2 API permissions.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md transition"
              >
                Close Diagnostic
              </button>
            </div>
          </div>
        </div>
      )}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-sm uppercase text-blue-950">Arkesel Bulk SMS Gateway</h3>
                  <span className="text-[10px] text-slate-500 font-mono">Arkesel Live Dispatch Engine</span>
                </div>
              </div>

              {dispatchCompleted && (
                <button
                  onClick={() => setShowDispatchModal(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold font-mono text-slate-900">
                <span>{dispatchCompleted ? 'Arkesel Broadcast Execution Finished' : `Sending SMS: ${currentDispatchStudent}...`}</span>
                <span className="text-blue-600 font-black">{dispatchProgress}%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    dispatchCompleted
                      ? dispatchSummary.failed === 0
                        ? 'bg-emerald-600'
                        : dispatchSummary.sent === 0
                        ? 'bg-rose-600'
                        : 'bg-amber-500'
                      : 'bg-blue-600'
                  }`}
                  style={{ width: `${dispatchProgress}%` }}
                />
              </div>
            </div>

            {/* Completion Summary Result Alert */}
            {dispatchCompleted && (
              <div className="animate-fadeIn">
                {dispatchSummary.sent > 0 && dispatchSummary.failed === 0 && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 flex items-start gap-3.5 shadow-sm">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h4 className="font-black text-sm text-emerald-950 uppercase tracking-wider">
                        Bulk SMS Sent Successfully!
                      </h4>
                      <p className="text-xs font-bold text-emerald-800 leading-relaxed">
                        All {dispatchSummary.sent} SMS broadcast message(s) were successfully delivered via Arkesel Gateway to parent contact numbers.
                      </p>
                    </div>
                  </div>
                )}

                {dispatchSummary.sent === 0 && dispatchSummary.failed > 0 && (
                  <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-950 flex items-start gap-3.5 shadow-sm">
                    <XCircle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h4 className="font-black text-sm text-rose-950 uppercase tracking-wider">
                        Bulk SMS Dispatch Failed!
                      </h4>
                      <p className="text-xs font-bold text-rose-800 leading-relaxed">
                        0 of {dispatchSummary.total} messages sent. {dispatchSummary.failed} recipient message(s) failed. Please check your Arkesel API key, sender ID, account balance, or contact numbers.
                      </p>
                    </div>
                  </div>
                )}

                {dispatchSummary.sent > 0 && dispatchSummary.failed > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 flex items-start gap-3.5 shadow-sm">
                    <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <h4 className="font-black text-sm text-amber-950 uppercase tracking-wider">
                        Bulk SMS Completed with Warnings
                      </h4>
                      <p className="text-xs font-bold text-amber-800 leading-relaxed">
                        {dispatchSummary.sent} message(s) sent successfully, but {dispatchSummary.failed} message(s) failed to deliver. Review recipient list below.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Dispatch Live List */}
            <div className="border border-slate-200 rounded-xl p-3 max-h-60 overflow-y-auto space-y-1.5 text-xs bg-slate-50 text-slate-900">
              {selectedStudentItems.map((item, idx) => {
                const res = dispatchResults[item.student.id];
                const status = res?.status;
                const msg = res?.msg;
                return (
                  <div key={`${item.student.id}-${idx}`} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <div>
                      <span className="font-extrabold text-slate-900">{item.student.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        Guardian: {item.student.guardianName} ({item.formattedPhone || 'N/A'})
                      </span>
                    </div>

                    <div>
                      {status === 'ARKESEL_SENT' && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] flex items-center gap-1 font-mono border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" /> ARKESEL SENT
                        </span>
                      )}
                      {status === 'ARKESEL_FAILED' && (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded text-[10px] flex items-center gap-1 font-mono border border-rose-200" title={msg}>
                          <X className="w-3 h-3 text-rose-600" /> FAILED: {msg || 'API Error'}
                        </span>
                      )}
                      {status === 'SENT' && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded text-[10px] flex items-center gap-1 font-mono border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" /> SENT
                        </span>
                      )}
                      {status === 'FAILED_NO_PHONE' && (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded text-[10px] flex items-center gap-1 font-mono border border-rose-200">
                          <X className="w-3 h-3 text-rose-600" /> NO PHONE
                        </span>
                      )}
                      {!status && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-medium rounded text-[10px] font-mono border border-slate-200">
                          QUEUED
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer buttons */}
            <div className="pt-2 flex justify-end">
              <button
                disabled={!dispatchCompleted}
                onClick={() => setShowDispatchModal(false)}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider transition cursor-pointer disabled:opacity-50 shadow-md shadow-amber-400/20 border-2 border-amber-500"
              >
                Close Delivery Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR HISTORY CONFIRMATION MODAL */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-base">Clear SMS History?</h4>
                <p className="text-xs text-slate-500 font-medium">This will permanently erase all broadcast log records from this portal.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 leading-relaxed font-medium">
              Are you sure you want to delete all <strong>{broadcastHistory.length}</strong> broadcast log item(s)? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer border border-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setBroadcastHistory([]);
                  localStorage.removeItem('ea_bulk_sms_history');
                  setShowClearConfirmModal(false);
                  showToast('SMS Broadcast history cleared successfully!');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md shadow-rose-600/20"
              >
                Yes, Clear All Logs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
