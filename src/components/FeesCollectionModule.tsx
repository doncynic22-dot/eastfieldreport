/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Student, ReportConfig, FeePayment, FeeTypeCategory, PaymentMethod, PaymentStatus, StudentBill } from '../types';
import { INITIAL_FEE_PAYMENTS } from '../data/mockData';
import {
  CreditCard,
  Receipt,
  DollarSign,
  PlusCircle,
  Search,
  Filter,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  User,
  School,
  Calendar,
  FileText,
  RotateCcw,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Building2,
  Phone,
  Mail,
  ExternalLink,
  BarChart3,
  Trash2
} from 'lucide-react';
import { fetchSupabaseFeePayments, saveSupabaseFeePayments, deleteSupabaseFeePayment, deleteSupabaseFeePaymentsBatch, clearAllSupabaseFeePayments } from '../lib/supabase';

interface FeesCollectionModuleProps {
  students: Student[];
  classes: {
    NURSERY: string[];
    KINDERGARTEN?: string[];
    PRIMARY: string[];
    JHS: string[];
  };
  config: ReportConfig;
  bills?: StudentBill[];
  onViewDashboard?: () => void;
}

export function computeStudentNextTermBill(
  student: Student | undefined,
  bills: StudentBill[] = [],
  payments: FeePayment[] = []
) {
  if (!student) {
    return {
      tuition: 0,
      arrears: 0,
      computing: 0,
      utility: 0,
      stationery: 0,
      pta: 0,
      totalNextTermFee: 0,
      alreadyPaidSchoolFees: 0,
      balanceDue: 0,
      hasCustomBill: false,
    };
  }

  const clsUpper = (student.className || '').toUpperCase();
  const isKg =
    student.level === 'KINDERGARTEN' ||
    clsUpper.includes('KG') ||
    clsUpper.includes('KINDERGARTEN');
  const isNurseryLevel =
    !isKg &&
    (student.level === 'NURSERY' ||
      clsUpper.includes('NURSERY') ||
      clsUpper.includes('N1') ||
      clsUpper.includes('N2'));
  const effectiveLevel = isKg
    ? 'KINDERGARTEN'
    : isNurseryLevel
    ? 'NURSERY'
    : student.level === 'JHS'
    ? 'JHS'
    : 'PRIMARY';

  const saved = (bills || []).find((b) => b.studentId === student.id);

  const tuition = saved
    ? parseFloat(saved.tuition) || 0
    : effectiveLevel === 'JHS'
    ? 730
    : effectiveLevel === 'PRIMARY'
    ? 600
    : 450;
  const arrears = saved
    ? parseFloat(saved.arrears) || 0
    : effectiveLevel === 'JHS'
    ? 825
    : 0;
  const computing = saved
    ? parseFloat(saved.computing) || 0
    : effectiveLevel === 'NURSERY' || effectiveLevel === 'KINDERGARTEN'
    ? 15
    : 20;
  const utility = saved
    ? parseFloat(saved.utility) || 0
    : effectiveLevel === 'NURSERY' || effectiveLevel === 'KINDERGARTEN'
    ? 15
    : 25;
  const stationery = saved
    ? parseFloat(saved.stationery) || 0
    : effectiveLevel === 'NURSERY' || effectiveLevel === 'KINDERGARTEN'
    ? 20
    : 30;
  const pta = saved
    ? parseFloat(saved.pta) || 0
    : effectiveLevel === 'NURSERY' || effectiveLevel === 'KINDERGARTEN'
    ? 10
    : 20;

  const totalNextTermFee = tuition + arrears + computing + utility + stationery + pta;

  const alreadyPaidSchoolFees = (payments || [])
    .filter((p) => p.studentId === student.id && p.feeType === 'School Fees')
    .reduce((sum, p) => sum + p.amountPaid, 0);

  const balanceDue = Math.max(0, totalNextTermFee - alreadyPaidSchoolFees);

  return {
    tuition,
    arrears,
    computing,
    utility,
    stationery,
    pta,
    totalNextTermFee,
    alreadyPaidSchoolFees,
    balanceDue,
    hasCustomBill: !!saved,
  };
}

export function isDemoFeePayment(p: FeePayment): boolean {
  if (['fee-001', 'fee-002', 'fee-003', 'fee-004', 'fee-005'].includes(p.id)) return true;
  if (
    ['EA-REC-2026-0001', 'EA-REC-2026-0002', 'EA-REC-2026-0003', 'EA-REC-2026-0004'].includes(p.receiptNumber) &&
    ['st-101', 'st-102', 'st-103', 'st-104'].includes(p.studentId)
  ) {
    return true;
  }
  return false;
}

const DEFAULT_FEE_AMOUNTS: Record<string, number> = {
  'School Fees': 0,
  'Feeding Fee': 0,
  'Bus Fee': 0,
  'Studies Fee': 0,
  'Printing/Exam Fee': 0,
  'Uniform Purchase Fee': 0,
  'Mock Examination Fee': 0,
  'Custom Fee': 0,
};

const DEFAULT_DAILY_RATES: Record<string, number> = {
  'Feeding Fee': 0,
  'Bus Fee': 0,
  'Studies Fee': 0,
};

const DAILY_COLLECTION_FEES = ['Feeding Fee', 'Bus Fee', 'Studies Fee'];
const WEEKDAYS_MON_FRI = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

const FEE_TYPE_OPTIONS: string[] = [
  'School Fees',
  'Feeding Fee',
  'Bus Fee',
  'Studies Fee',
  'Printing/Exam Fee',
  'Uniform Purchase Fee',
  'Mock Examination Fee',
  'Custom Fee',
];

const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = [
  'Cash',
  'Mobile Money',
  'Bank Transfer',
  'Cheque',
  'POS/Card',
];

export default function FeesCollectionModule({
  students,
  classes,
  config,
  bills = [],
  onViewDashboard,
}: FeesCollectionModuleProps) {
  // Load fee payments from localStorage or fall back to INITIAL_FEE_PAYMENTS
  const [feePayments, setFeePayments] = useState<FeePayment[]>(() => {
    try {
      const saved = localStorage.getItem('ea_fee_payments');
      if (saved) {
        const parsed: FeePayment[] = JSON.parse(saved);
        return parsed.filter((p) => !isDemoFeePayment(p));
      }
    } catch (e) {
      console.error('Failed to load fee payments from localStorage', e);
    }
    return INITIAL_FEE_PAYMENTS.filter((p) => !isDemoFeePayment(p));
  });

  const isInitialMountRef = useRef(true);

  // Initial load from global Supabase database
  useEffect(() => {
    fetchSupabaseFeePayments().then((data) => {
      if (data && Array.isArray(data)) {
        setFeePayments(data.filter((p) => !isDemoFeePayment(p)));
      }
      isInitialMountRef.current = false;
    }).catch(err => {
      console.warn('Supabase fee payments sync error:', err);
      isInitialMountRef.current = false;
    });

    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('ea_fee_payments');
        if (saved) {
          const parsed: FeePayment[] = JSON.parse(saved);
          setFeePayments(parsed.filter((p) => !isDemoFeePayment(p)));
        }
      } catch (e) {
        console.error('Storage sync failed', e);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save payments to localStorage and global Supabase whenever they change (ONLY after initial fetch!)
  useEffect(() => {
    try {
      localStorage.setItem('ea_fee_payments', JSON.stringify(feePayments));
      if (!isInitialMountRef.current) {
        saveSupabaseFeePayments(feePayments).catch((err) =>
          console.warn('Failed to sync fee payments to Supabase:', err)
        );
      }
    } catch (e) {
      console.error('Failed to save fee payments to localStorage', e);
    }
  }, [feePayments]);

  // Aggregate all available classes from school structure + student records
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    classes.NURSERY.forEach((c) => classSet.add(c));
    classes.KINDERGARTEN?.forEach((c) => classSet.add(c));
    classes.PRIMARY.forEach((c) => classSet.add(c));
    classes.JHS.forEach((c) => classSet.add(c));
    students.forEach((s) => classSet.add(s.className));
    return Array.from(classSet).sort((a, b) => {
      // Natural order sorting
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [classes, students]);

  // FORM STATE: Dependent Dropdowns & Payment Details
  const [selectedClass, setSelectedClass] = useState<string>(availableClasses[0] || 'Primary 1');
  const [feeTypeOption, setFeeTypeOption] = useState<string>('School Fees');
  const [customFeeTitle, setCustomFeeTitle] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [totalFeeAmount, setTotalFeeAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState<string>('');

  // FILTER & SEARCH STATE
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterFeeType, setFilterFeeType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // RECEIPT MODAL STATE
  const [activeReceiptModal, setActiveReceiptModal] = useState<FeePayment | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; receiptNumber: string } | null>(
    null
  );

  // Dynamically filter students based on selectedClass
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => s.className === selectedClass)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [students, selectedClass]);

  // Automatically select the first student when selectedClass changes
  useEffect(() => {
    if (filteredStudents.length > 0) {
      if (!filteredStudents.some((s) => s.id === selectedStudentId)) {
        setSelectedStudentId(filteredStudents[0].id);
      }
    } else {
      setSelectedStudentId('');
    }
  }, [filteredStudents, selectedStudentId]);

  // Filter available fee types based on selectedClass (Mock Exam Fee only for JHS 3)
  const availableFeeTypes = useMemo(() => {
    return FEE_TYPE_OPTIONS.filter((ft) => {
      if (ft === 'Mock Examination Fee') {
        return selectedClass === 'JHS 3' || selectedClass.includes('JHS 3');
      }
      return true;
    });
  }, [selectedClass]);

  // DAILY COLLECTION STATE (for Feeding Fee, Bus Fee, Studies Fee)
  const isDailyFee = DAILY_COLLECTION_FEES.includes(feeTypeOption);
  const [selectedWeekdays, setSelectedWeekdays] = useState<string[]>(WEEKDAYS_MON_FRI);
  const [dailyRate, setDailyRate] = useState<number>(15);

  const toggleWeekday = (day: string) => {
    setSelectedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Automatically adjust total & amount when daily fee parameters change
  useEffect(() => {
    if (isDailyFee) {
      const totalAmt = selectedWeekdays.length * dailyRate;
      setTotalFeeAmount(totalAmt);
      setAmountPaid(0);
      setRemarks(`Daily Collection (${selectedWeekdays.join(', ')}) @ GH₵${dailyRate}/day`);
    }
  }, [isDailyFee, selectedWeekdays, dailyRate]);

  // If selectedClass changes away from JHS 3 while Mock Examination Fee is selected, reset to School Fees
  useEffect(() => {
    if (feeTypeOption === 'Mock Examination Fee' && !availableFeeTypes.includes('Mock Examination Fee')) {
      setFeeTypeOption('School Fees');
      const defaultAmount = DEFAULT_FEE_AMOUNTS['School Fees'];
      setAmountPaid(0);
      setTotalFeeAmount(defaultAmount);
    }
  }, [availableFeeTypes, feeTypeOption]);

  // Handle Fee Type change -> adjust default amounts
  const handleFeeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextType = e.target.value;
    setFeeTypeOption(nextType);
    if (DAILY_COLLECTION_FEES.includes(nextType)) {
      const rate = DEFAULT_DAILY_RATES[nextType] ?? 10;
      setDailyRate(rate);
      const totalAmt = selectedWeekdays.length * rate;
      setAmountPaid(0);
      setTotalFeeAmount(totalAmt);
      setRemarks(`Daily Collection (${selectedWeekdays.join(', ')}) @ GH₵${rate}/day`);
    } else {
      const defaultAmount = DEFAULT_FEE_AMOUNTS[nextType] ?? 100;
      setAmountPaid(0);
      setTotalFeeAmount(defaultAmount);
      setRemarks('');
    }
  };

  // Determine effective Fee Type string
  const effectiveFeeType: FeeTypeCategory =
    feeTypeOption === 'Custom Fee' ? (customFeeTitle.trim() || 'General Fee') : feeTypeOption;

  // Determine Payment Status automatically
  const calculatedStatus: PaymentStatus = useMemo(() => {
    if (totalFeeAmount <= 0) return 'Paid';
    if (amountPaid >= totalFeeAmount) return 'Paid';
    if (amountPaid > 0 && amountPaid < totalFeeAmount) return 'Partial';
    return 'Pending';
  }, [amountPaid, totalFeeAmount]);

  // Selected student object
  const currentStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId),
    [students, selectedStudentId]
  );

  // Calculate selected student's specific next term bill & balance
  const currentStudentBill = useMemo(
    () => computeStudentNextTermBill(currentStudent, bills, feePayments),
    [currentStudent, bills, feePayments]
  );

  // Automatically populate next term school fees when student is selected or fee type is 'School Fees'
  useEffect(() => {
    if (feeTypeOption === 'School Fees' && currentStudent) {
      const balance = currentStudentBill.balanceDue;
      setTotalFeeAmount(balance);
      setAmountPaid(0);
      if (!remarks.startsWith('Daily Collection')) {
        setRemarks(
          `Next Term School Fees (${
            currentStudentBill.hasCustomBill
              ? 'Individual Assessed Bill'
              : 'Standard Level Bill'
          })`
        );
      }
    }
  }, [
    selectedStudentId,
    feeTypeOption,
    currentStudentBill.totalNextTermFee,
    currentStudentBill.balanceDue,
    currentStudentBill.hasCustomBill,
    currentStudent,
  ]);

  // Generate unique receipt number
  const generateReceiptNumber = () => {
    const year = new Date().getFullYear();
    const count = feePayments.length + 1;
    const pad = String(count).padStart(4, '0');
    return `EA-REC-${year}-${pad}`;
  };

  // Submit Fee Payment
  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStudent) {
      alert('Please select a student to record fee payment.');
      return;
    }
    if (amountPaid < 0 || totalFeeAmount <= 0) {
      alert('Please enter valid positive amounts for total fee and amount paid.');
      return;
    }

    const newReceiptNo = generateReceiptNumber();
    const newPayment: FeePayment = {
      id: `fee-${Date.now()}`,
      receiptNumber: newReceiptNo,
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      className: currentStudent.className,
      feeType: effectiveFeeType,
      amountPaid: Number(amountPaid),
      totalFeeAmount: Number(totalFeeAmount),
      paymentMethod,
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      status: calculatedStatus,
      remarks: remarks.trim()
        ? remarks.trim()
        : `${effectiveFeeType} payment recorded for ${currentStudent.name}`,
      recordedBy: 'Admin Office',
      createdAt: new Date().toISOString(),
    };

    setFeePayments((prev) => [newPayment, ...prev]);

    // Show Toast
    setToastMessage({
      text: `Payment of GH₵ ${Number(amountPaid).toLocaleString()} recorded for ${currentStudent.name}`,
      receiptNumber: newReceiptNo,
    });
    setTimeout(() => setToastMessage(null), 8000);

    // Reset remarks and amount paid
    setRemarks('');
    setAmountPaid(0);
  };

  // Filtered Ledgers
  const displayedPayments = useMemo(() => {
    return feePayments.filter((item) => {
      if (filterClass !== 'ALL' && item.className !== filterClass) return false;
      if (filterFeeType === 'DAILY_ALL') {
        if (!DAILY_COLLECTION_FEES.includes(item.feeType)) return false;
      } else if (filterFeeType !== 'ALL' && item.feeType !== filterFeeType) {
        return false;
      }
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.studentName.toLowerCase().includes(q);
        const matchReceipt = item.receiptNumber.toLowerCase().includes(q);
        const matchType = item.feeType.toLowerCase().includes(q);
        if (!matchName && !matchReceipt && !matchType) return false;
      }
      return true;
    });
  }, [feePayments, filterClass, filterFeeType, filterStatus, searchQuery]);

  // MULTI-SELECTION STATE FOR RECEIPTS
  const [selectedReceiptIds, setSelectedReceiptIds] = useState<string[]>([]);

  const getReceiptKey = (p: FeePayment, idx?: number): string => {
    return p.id || p.receiptNumber || `idx_${idx || 0}`;
  };

  const isSameReceipt = (a: FeePayment, b: FeePayment): boolean => {
    if (a.id && b.id && a.id === b.id) return true;
    if (a.receiptNumber && b.receiptNumber && a.receiptNumber === b.receiptNumber) return true;
    return false;
  };

  const toggleSelectReceipt = (p: FeePayment, idx?: number) => {
    const key = getReceiptKey(p, idx);
    setSelectedReceiptIds((prev) =>
      prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]
    );
  };

  const handleSelectAllReceipts = () => {
    if (displayedPayments.length === 0) return;
    const allDisplayedKeys = displayedPayments.map((p, idx) => getReceiptKey(p, idx));
    const allSelected = allDisplayedKeys.every((key) => selectedReceiptIds.includes(key));
    if (allSelected) {
      setSelectedReceiptIds((prev) => prev.filter((id) => !allDisplayedKeys.includes(id)));
    } else {
      setSelectedReceiptIds((prev) => Array.from(new Set([...prev, ...allDisplayedKeys])));
    }
  };

  const handleDeleteSingleReceipt = async (p: FeePayment) => {
    const updated = feePayments.filter((item) => !isSameReceipt(item, p));
    setFeePayments(updated);
    setSelectedReceiptIds((prev) => prev.filter((key) => key !== getReceiptKey(p)));
    try {
      localStorage.setItem('ea_fee_payments', JSON.stringify(updated));
      localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify(updated));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('Failed to update localStorage after receipt delete', e);
    }
    await deleteSupabaseFeePayment({ id: p.id, receiptNumber: p.receiptNumber });
    await saveSupabaseFeePayments(updated);
    setToastMessage({
      text: `Receipt ${p.receiptNumber} deleted and synchronized with database!`,
      receiptNumber: '',
    });
  };

  const handleDeleteSelectedReceipts = async () => {
    if (selectedReceiptIds.length === 0) return;
    const count = selectedReceiptIds.length;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${count} selected receipt(s)? This action cannot be undone.`
    );
    if (!confirmDelete) return;

    const remaining = feePayments.filter((p, idx) => !selectedReceiptIds.includes(getReceiptKey(p, idx)));
    const deleted = feePayments.filter((p, idx) => selectedReceiptIds.includes(getReceiptKey(p, idx)));

    setFeePayments(remaining);
    setSelectedReceiptIds([]);

    try {
      localStorage.setItem('ea_fee_payments', JSON.stringify(remaining));
      localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify(remaining));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error('Failed to update localStorage after batch delete', e);
    }

    await deleteSupabaseFeePaymentsBatch(
      deleted.map((p) => ({ id: p.id, receiptNumber: p.receiptNumber }))
    );
    await saveSupabaseFeePayments(remaining);

    setToastMessage({
      text: `${count} receipt(s) deleted and synchronized with database!`,
      receiptNumber: '',
    });
  };

  // Analytics KPIs
  const totalCollected = useMemo(() => {
    return displayedPayments.reduce((sum, item) => sum + item.amountPaid, 0);
  }, [displayedPayments]);

  const totalArrears = useMemo(() => {
    return displayedPayments.reduce(
      (sum, item) => sum + Math.max(0, item.totalFeeAmount - item.amountPaid),
      0
    );
  }, [displayedPayments]);

  const schoolFeesCollected = useMemo(() => {
    return displayedPayments
      .filter((item) => item.feeType === 'School Fees')
      .reduce((sum, item) => sum + item.amountPaid, 0);
  }, [displayedPayments]);

  // Export ledger to CSV
  const handleExportCSV = () => {
    const headers = [
      'Receipt Number',
      'Student Name',
      'Class',
      'Fee Type',
      'Total Fee (GHS)',
      'Amount Paid (GHS)',
      'Balance Arrears (GHS)',
      'Payment Method',
      'Status',
      'Payment Date',
      'Remarks',
    ];
    const rows = displayedPayments.map((p) => [
      p.receiptNumber,
      p.studentName,
      p.className,
      p.feeType,
      p.totalFeeAmount,
      p.amountPaid,
      Math.max(0, p.totalFeeAmount - p.amountPaid),
      p.paymentMethod,
      p.status,
      p.paymentDate,
      `"${(p.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Fee_Collections_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* TOAST CONFIRMATION BANNER */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md animate-fadeIn no-print">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-extrabold text-sm sm:text-base text-emerald-950">
                {toastMessage.text}
              </p>
              <p className="text-xs text-emerald-800">
                Receipt Number: <span className="font-mono font-bold">{toastMessage.receiptNumber}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={() => {
                const rec = feePayments.find(
                  (p) => p.receiptNumber === toastMessage.receiptNumber
                );
                if (rec) setActiveReceiptModal(rec);
              }}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              onClick={() => setToastMessage(null)}
              className="p-1 text-emerald-700 hover:text-emerald-900 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* KPI ANALYTICS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="p-4 rounded-xl border border-white/15 bg-white/5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              Total Collections
            </span>
            <span className="text-2xl font-extrabold text-white mt-1 block">
              GH₵ {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{displayedPayments.length} transactions</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/15 bg-white/5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              School Fees Tuition
            </span>
            <span className="text-2xl font-extrabold text-white mt-1 block">
              GH₵ {schoolFeesCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-purple-300 font-bold mt-0.5 block">
              Core academic fee revenue
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <School className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/15 bg-white/5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              Outstanding Arrears
            </span>
            <span className="text-2xl font-extrabold text-amber-300 mt-1 block">
              GH₵ {totalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-amber-400 font-bold mt-0.5 block">
              Remaining unpaid balances
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-white/15 bg-white/5 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              Active Receipts
            </span>
            <span className="text-2xl font-extrabold text-white mt-1 block">
              {feePayments.length}
            </span>
            <span className="text-[11px] text-blue-300 font-bold mt-0.5 block">
              All printable official receipts
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FEES COLLECTION MODULE BODY: 2 COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* LEFT / CENTER: RECORD FEE PAYMENT FORM (2 COLS) */}
        <div className="lg:col-span-2 bg-[#210747] p-6 rounded-2xl border border-white/20 shadow-lg space-y-5">
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div>
              <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-purple-300" />
                <span>Record Fee Payment</span>
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Dynamic dependent selection by Class/Form → Student → Fee Type with automated status grading
              </p>
            </div>
            <div className="flex items-center gap-2">
              {onViewDashboard && (
                <button
                  type="button"
                  onClick={onViewDashboard}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition border border-purple-400/40 uppercase tracking-wider cursor-pointer"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>View Fees Dashboard</span>
                </button>
              )}
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-400/30 hidden sm:inline-block">
                Receipt Auto-Generates
              </span>
            </div>
          </div>

          <form onSubmit={handleRecordPayment} className="space-y-4">
            {/* ROW 1: SELECT CLASS / FORM + SELECT FEE TYPE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* DEPENDENT DROPDOWN 1: CLASS / GRADE LEVEL */}
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-gray-200 block mb-1.5">
                  1. Select Class / Form *
                </label>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white font-extrabold text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                >
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls} className="bg-[#1A0438] text-white font-bold">
                      {cls}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-gray-300 block mt-1">
                  Filters student selection to enrolled pupils only
                </span>
              </div>

              {/* DEPENDENT DROPDOWN 2: FEE TYPE */}
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-gray-200 block mb-1.5">
                  2. Select Fee Type *
                </label>
                <select
                  value={feeTypeOption}
                  onChange={handleFeeTypeChange}
                  className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white font-extrabold text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                >
                  {availableFeeTypes.map((ft) => (
                    <option key={ft} value={ft} className="bg-[#1A0438] text-white font-bold">
                      {ft}
                    </option>
                  ))}
                </select>
                {feeTypeOption === 'Custom Fee' && (
                  <input
                    type="text"
                    value={customFeeTitle}
                    onChange={(e) => setCustomFeeTitle(e.target.value)}
                    placeholder="Enter Custom Fee Title (e.g., Excursion Fee)"
                    className="w-full mt-2 p-2.5 rounded-lg border border-white/30 bg-[#1A0438] text-white text-xs font-bold"
                  />
                )}
              </div>
            </div>

            {/* DAILY COLLECTION TRACKER (Monday to Friday) */}
            {isDailyFee && (
              <div className="p-4 rounded-xl bg-[#2A0D5D]/80 border border-purple-400/40 shadow-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold uppercase">
                      Daily Mon–Fri Record
                    </span>
                    <span className="text-xs font-extrabold text-white uppercase tracking-wider">
                      {feeTypeOption} Daily Schedule & Rate
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays(WEEKDAYS_MON_FRI)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border border-white/20 transition cursor-pointer"
                    >
                      Select All Mon–Fri
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays(['Monday', 'Tuesday', 'Wednesday'])}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold border border-white/20 transition cursor-pointer"
                    >
                      3 Days (Mon–Wed)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWeekdays([])}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-rose-300 text-[11px] font-bold border border-rose-400/30 transition cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-300 font-bold mr-1">Days Covered:</span>
                  {WEEKDAYS_MON_FRI.map((day) => {
                    const isChecked = selectedWeekdays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleWeekday(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition cursor-pointer flex items-center gap-1.5 ${
                          isChecked
                            ? 'bg-purple-600 text-white border-purple-300 shadow-sm'
                            : 'bg-[#1A0438] text-gray-400 border-white/15 hover:border-white/30'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{day}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/10 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="text-gray-300 font-bold">Daily Rate (GH₵/day):</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(Number(e.target.value) || 0)}
                      className="w-20 p-1.5 rounded-lg bg-[#1A0438] border border-white/30 text-white font-mono font-extrabold text-center outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-emerald-300 font-extrabold font-mono">
                    <span>{selectedWeekdays.length} Days × GH₵ {dailyRate} =</span>
                    <span className="text-sm bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-400/30">
                      GH₵ {(selectedWeekdays.length * dailyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ROW 2: SELECT STUDENT (DEPENDENT ON CLASS) */}
            <div>
              <label className="text-xs font-extrabold uppercase tracking-wider text-gray-200 block mb-1.5">
                3. Select Student ({filteredStudents.length} enrolled in {selectedClass}) *
              </label>
              {filteredStudents.length > 0 ? (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white font-extrabold text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                >
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id} className="bg-[#1A0438] text-white font-bold">
                      {s.name} (Roll: {s.rollNumber || s.id}) — Guardian: {s.guardianName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-rose-500/10 border border-rose-400/30 rounded-xl text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    No students currently enrolled in "{selectedClass}". Please register a student in Student Admissions first.
                  </span>
                </div>
              )}

              {/* Quick student summary box & Next Term School Fees Assessment */}
              {currentStudent && (
                <div className="mt-2.5 space-y-2.5">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-300" />
                      <span className="font-bold text-white">{currentStudent.name}</span>
                      <span className="text-gray-300">({currentStudent.rollNumber})</span>
                    </div>
                    <div className="flex items-center gap-4 text-gray-300">
                      <span>Parent: <strong className="text-white">{currentStudent.guardianName}</strong></span>
                      {currentStudent.guardianPhone && (
                        <span className="hidden sm:inline font-mono">{currentStudent.guardianPhone}</span>
                      )}
                    </div>
                  </div>

                  {/* NEXT TERM SCHOOL FEES ASSESSMENT SUMMARY CARD */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-purple-950/90 via-[#2A0E5A]/90 to-purple-950/90 border border-purple-400/40 shadow-lg space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <School className="w-4 h-4 text-purple-300" />
                        <span className="font-extrabold text-white tracking-wide uppercase">
                          Next Term School Fees Bill ({currentStudent.level})
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                          currentStudentBill.hasCustomBill
                            ? 'bg-purple-500/30 text-purple-200 border-purple-400/40'
                            : 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                        }`}>
                          {currentStudentBill.hasCustomBill ? 'Individual Assessed Bill' : 'Standard Level Bill'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFeeTypeOption('School Fees');
                          setTotalFeeAmount(currentStudentBill.balanceDue);
                          setAmountPaid(0);
                          setRemarks('Payment towards Next Term School Fees (Tuition + Levies + Arrears)');
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-[11px] shadow-md transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Apply Next Term Fees (GH₵ {currentStudentBill.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })})</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1 text-gray-200">
                      <div className="p-2 rounded-lg bg-[#1A0438]/80 border border-white/10">
                        <span className="text-[10px] text-gray-400 uppercase block font-bold">Tuition</span>
                        <span className="font-mono font-extrabold text-white">GH₵ {currentStudentBill.tuition.toFixed(2)}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#1A0438]/80 border border-white/10">
                        <span className="text-[10px] text-gray-400 uppercase block font-bold">Arrears B/F</span>
                        <span className="font-mono font-extrabold text-amber-300">GH₵ {currentStudentBill.arrears.toFixed(2)}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#1A0438]/80 border border-white/10">
                        <span className="text-[10px] text-gray-400 uppercase block font-bold">Computing</span>
                        <span className="font-mono font-extrabold text-white">GH₵ {currentStudentBill.computing.toFixed(2)}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#1A0438]/80 border border-white/10">
                        <span className="text-[10px] text-gray-400 uppercase block font-bold">Utility</span>
                        <span className="font-mono font-extrabold text-white">GH₵ {currentStudentBill.utility.toFixed(2)}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#1A0438]/80 border border-white/10">
                        <span className="text-[10px] text-gray-400 uppercase block font-bold">Stationery</span>
                        <span className="font-mono font-extrabold text-white">GH₵ {currentStudentBill.stationery.toFixed(2)}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#1A0438]/80 border border-white/10">
                        <span className="text-[10px] text-gray-400 uppercase block font-bold">PTA Dues</span>
                        <span className="font-mono font-extrabold text-white">GH₵ {currentStudentBill.pta.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/10 font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-bold">Total Term Bill:</span>
                        <span className="text-white font-extrabold bg-white/10 px-2 py-0.5 rounded border border-white/20">
                          GH₵ {currentStudentBill.totalNextTermFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-bold">Paid to Date:</span>
                        <span className="text-emerald-300 font-extrabold bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-400/30">
                          GH₵ {currentStudentBill.alreadyPaidSchoolFees.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 font-bold">Balance Due:</span>
                        <span className={`font-extrabold px-2.5 py-0.5 rounded border ${
                          currentStudentBill.balanceDue === 0
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                        }`}>
                          GH₵ {currentStudentBill.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ROW 3: AMOUNT PAID + TOTAL FEE AMOUNT + PAYMENT METHOD */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-gray-200 block">
                    Total Payable (GH₵) *
                  </label>
                  {feeTypeOption === 'School Fees' && (
                    <span className="text-[10px] font-extrabold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-400/30">
                      🔒 Balance Due (Uneditable)
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalFeeAmount}
                  readOnly={feeTypeOption === 'School Fees'}
                  disabled={feeTypeOption === 'School Fees'}
                  onChange={(e) => setTotalFeeAmount(Number(e.target.value))}
                  className={`w-full p-3 rounded-xl border text-sm font-extrabold outline-none ${
                    feeTypeOption === 'School Fees'
                      ? 'border-purple-400/40 bg-white/5 text-purple-200 cursor-not-allowed'
                      : 'border-white/30 bg-[#1A0438] text-white focus:ring-2 focus:ring-purple-400'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 block mb-1.5">
                  Amount Paid Today (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-emerald-400/50 bg-[#1A0438] text-emerald-300 font-extrabold text-sm focus:ring-2 focus:ring-emerald-400 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-gray-200 block mb-1.5">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white font-extrabold text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                >
                  {PAYMENT_METHOD_OPTIONS.map((m) => (
                    <option key={m} value={m} className="bg-[#1A0438] text-white font-bold">
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ROW 4: PAYMENT DATE + TRANSACTION REMARKS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-extrabold uppercase tracking-wider text-gray-200 block mb-1.5">
                  Payment Date *
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white font-extrabold text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-gray-200 block mb-1.5">
                  Transaction Note / Reference (Optional)
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g., Term 1 Tuition - Mobile Money Ref #88432"
                  className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white font-bold text-sm focus:ring-2 focus:ring-purple-400 outline-none"
                />
              </div>
            </div>

            {/* STATUS PREVIEW & SUBMIT BAR */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-white/15">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-300">Auto-calculated Status:</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
                    calculatedStatus === 'Paid'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                      : calculatedStatus === 'Partial'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                  }`}
                >
                  {calculatedStatus === 'Paid'
                    ? '✓ PAID FULLY'
                    : calculatedStatus === 'Partial'
                    ? '⏳ PARTIAL PAYMENT'
                    : '⚠ PENDING'}
                </span>
                {totalFeeAmount - amountPaid > 0 && (
                  <span className="text-xs text-amber-300 font-bold">
                    (Arrears: GH₵ {(totalFeeAmount - amountPaid).toLocaleString()})
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!currentStudent}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] disabled:opacity-50 text-white font-extrabold text-sm rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Save Payment & Generate Receipt</span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: QUICK RECENTS & FEE SCHEDULE REFERENCE */}
        <div className="bg-[#210747] p-6 rounded-2xl border border-white/20 shadow-lg flex flex-col justify-between space-y-4">
          <div>
            <h4 className="text-base font-extrabold text-white flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span>Standard Fee Schedule</span>
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              Recommended default tuition and service fees per academic term. You can override any amount during payment entry.
            </p>

            <div className="space-y-2.5">
              {Object.entries(DEFAULT_FEE_AMOUNTS).map(([feeName, defAmt]) => (
                <div
                  key={feeName}
                  onClick={() => {
                    setFeeTypeOption(feeName);
                    setAmountPaid(0);
                    setTotalFeeAmount(defAmt);
                  }}
                  className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between cursor-pointer transition"
                >
                  <span className="text-xs font-bold text-white">{feeName}</span>
                  <span className="text-xs font-mono font-extrabold text-purple-300">
                    GH₵ {defAmt.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick print last receipt CTA */}
          {feePayments.length > 0 && (
            <div className="p-4 rounded-xl bg-purple-500/20 border border-purple-400/30 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-purple-200 uppercase">Latest Receipt</span>
                <span className="font-mono font-bold text-white">
                  {feePayments[0].receiptNumber}
                </span>
              </div>
              <p className="text-gray-200">
                {feePayments[0].studentName} — GH₵ {feePayments[0].amountPaid.toLocaleString()} ({feePayments[0].feeType})
              </p>
              <button
                onClick={() => setActiveReceiptModal(feePayments[0])}
                className="w-full mt-2 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Receipt className="w-4 h-4" />
                <span>Open & Print Official Receipt</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FEE COLLECTIONS LEDGER & RECEIPTS TABLE */}
      <div className="bg-[#210747] p-6 rounded-2xl border border-white/20 shadow-lg space-y-5 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/15 pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <Receipt className="w-5 h-5 text-purple-300" />
              <span>Fee Collection Ledger & Receipts ({displayedPayments.length})</span>
            </h3>
            <p className="text-xs text-gray-300">
              Filter by class, fee type, or status, and print official academy receipts for any payment
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {selectedReceiptIds.length > 0 && (
              <button
                onClick={handleDeleteSelectedReceipts}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl border border-rose-400/40 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-4 h-4 text-white" />
                <span>Delete Selected ({selectedReceiptIds.length})</span>
              </button>
            )}
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="w-4 h-4 text-purple-300" />
              <span>Export CSV</span>
            </button>
            {feePayments.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-400/30 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>Clear All Receipts</span>
              </button>
            )}
          </div>
        </div>

        {/* SEARCH & FILTER BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search query */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3.5 text-gray-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search pupil name, receipt no..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-white/30 bg-[#1A0438] text-white text-xs font-bold outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {/* Filter by class */}
          <div>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-white/30 bg-[#1A0438] text-white text-xs font-bold outline-none"
            >
              <option value="ALL">All Classes / Forms</option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Fee Type */}
          <div>
            <select
              value={filterFeeType}
              onChange={(e) => setFilterFeeType(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-white/30 bg-[#1A0438] text-white text-xs font-bold outline-none"
            >
              <option value="ALL">All Fee Types</option>
              <option value="DAILY_ALL" className="text-purple-300 font-extrabold">
                Mon–Fri Daily Fees (Feeding, Bus, Studies)
              </option>
              {FEE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-white/30 bg-[#1A0438] text-white text-xs font-bold outline-none"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="Paid">Paid in Full</option>
              <option value="Partial">Partial Payment</option>
              <option value="Pending">Pending / Unpaid</option>
            </select>
          </div>
        </div>

        {/* LEDGER TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/20 text-gray-300 text-xs font-extrabold uppercase tracking-wider">
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={
                      displayedPayments.length > 0 &&
                      displayedPayments.every((p, idx) =>
                        selectedReceiptIds.includes(getReceiptKey(p, idx))
                      )
                    }
                    onChange={handleSelectAllReceipts}
                    className="w-4 h-4 rounded border-white/30 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    title="Select all displayed receipts"
                  />
                </th>
                <th className="py-3 px-3">Receipt No.</th>
                <th className="py-3 px-3">Student & Class</th>
                <th className="py-3 px-3">Fee Type</th>
                <th className="py-3 px-3 text-right">Amount Paid</th>
                <th className="py-3 px-3 text-right">Total Payable</th>
                <th className="py-3 px-3">Method</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-xs">
              {displayedPayments.length > 0 ? (
                displayedPayments.map((p, idx) => {
                  const isPaid = p.status === 'Paid';
                  const isPartial = p.status === 'Partial';
                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition">
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          checked={selectedReceiptIds.includes(getReceiptKey(p, idx))}
                          onChange={() => toggleSelectReceipt(p, idx)}
                          className="w-4 h-4 rounded border-white/30 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>
                      <td className="py-3 px-3 font-mono font-extrabold text-purple-300 whitespace-nowrap">
                        {p.receiptNumber}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-extrabold text-white block">{p.studentName}</span>
                        <span className="text-[11px] text-gray-300">{p.className}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{p.feeType}</span>
                          {DAILY_COLLECTION_FEES.includes(p.feeType) && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[10px] font-extrabold uppercase">
                              Mon–Fri Daily
                            </span>
                          )}
                        </div>
                        {p.remarks && (
                          <span className="text-[11px] text-gray-300 block italic mt-0.5 max-w-[200px] truncate" title={p.remarks}>
                            {p.remarks}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-300">
                        GH₵ {p.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-gray-300">
                        GH₵ {p.totalFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-200">{p.paymentMethod}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase border ${
                            isPaid
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                              : isPartial
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                              : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-300 whitespace-nowrap">
                        {p.paymentDate}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setActiveReceiptModal(p)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer border border-purple-400/30"
                            title="View and print official student receipt"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                          <button
                            onClick={() => handleDeleteSingleReceipt(p)}
                            className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-extrabold text-xs rounded-lg transition inline-flex items-center justify-center shadow-sm cursor-pointer border border-rose-400/30"
                            title="Delete receipt and synchronise with database"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-gray-300 font-bold">
                    No fee payment records match your filters. Record a payment above to issue a receipt.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CLEAR ALL RECEIPTS CONFIRMATION MODAL */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1A0438] text-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-purple-400/40 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-300">
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-400/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Clear All Receipts?</h3>
                <p className="text-xs text-gray-300">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Are you sure you want to delete all <strong className="text-white">{feePayments.length}</strong> recorded fee receipt(s) and payment history? This will permanently clear them from the local database.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setFeePayments([]);
                  try {
                    localStorage.setItem('ea_fee_payments', JSON.stringify([]));
                    localStorage.setItem('mock_supabase_ea_fee_payments', JSON.stringify([]));
                    window.dispatchEvent(new Event('storage'));
                  } catch (e) {
                    console.error('Failed to clear localStorage', e);
                  }
                  await clearAllSupabaseFeePayments();
                  await saveSupabaseFeePayments([]);
                  setShowClearConfirmModal(false);
                  setToastMessage({
                    text: 'All fee receipt records have been permanently cleared and synchronized with database!',
                    receiptNumber: '',
                  });
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs transition shadow-lg cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Clear All Receipts</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          OFFICIAL SCHOOL FEES RECEIPT MODAL (PRINTABLE)
          ========================================================================= */}
      {activeReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          {/* MODAL WRAPPER */}
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-300 max-h-[90vh] flex flex-col print:max-h-none print:shadow-none print:border-none print:rounded-none">
            {/* NO-PRINT HEADER BAR */}
            <div className="bg-[#1C053E] text-white px-6 py-4 flex items-center justify-between border-b border-white/15 no-print">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-purple-300" />
                <span className="font-extrabold uppercase tracking-wider text-sm sm:text-base">
                  Official School Receipt Preview
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-lg transition flex items-center gap-1.5 shadow-md cursor-pointer uppercase tracking-wider"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Receipt</span>
                </button>
                <button
                  onClick={() => setActiveReceiptModal(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE RECEIPT CONTENT AREA */}
            <div className="p-8 space-y-6 overflow-y-auto bg-white text-gray-900 print-container font-sans">
              {/* ACADEMY HEADER */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-purple-900 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#1C053E] text-white flex items-center justify-center font-serif font-extrabold text-2xl shadow">
                    {config.schoolName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#1C053E] uppercase tracking-tight font-display">
                      {config.schoolName}
                    </h2>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                      {config.schoolMotto || 'Excellence in Academic Discipline & Leadership'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Academic Year {config.schoolYear} • {config.term}
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right font-mono">
                  <span className="text-[11px] font-extrabold text-purple-900 uppercase tracking-widest block">
                    Official Fee Receipt
                  </span>
                  <span className="text-base sm:text-lg font-extrabold text-gray-900 block mt-0.5">
                    {activeReceiptModal.receiptNumber}
                  </span>
                  <span className="text-[11px] text-gray-500 block">
                    Date: {activeReceiptModal.paymentDate}
                  </span>
                </div>
              </div>

              {/* STUDENT & PAYMENT META BOX */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold">Student Name:</span>
                    <span className="font-extrabold text-gray-900">
                      {activeReceiptModal.studentName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold">Class / Grade:</span>
                    <span className="font-extrabold text-gray-900">
                      {activeReceiptModal.className}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold">Student ID:</span>
                    <span className="font-mono font-bold text-gray-700">
                      {activeReceiptModal.studentId}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold">Payment Method:</span>
                    <span className="font-extrabold text-gray-900">
                      {activeReceiptModal.paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold">Transaction Status:</span>
                    <span
                      className={`font-extrabold uppercase ${
                        activeReceiptModal.status === 'Paid'
                          ? 'text-emerald-700'
                          : activeReceiptModal.status === 'Partial'
                          ? 'text-amber-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {activeReceiptModal.status === 'Paid'
                        ? 'PAID IN FULL'
                        : activeReceiptModal.status === 'Partial'
                        ? 'PARTIAL PAYMENT'
                        : 'PENDING'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-bold">Recorded By:</span>
                    <span className="font-bold text-gray-700">
                      {activeReceiptModal.recordedBy || 'Bursar Office'}
                    </span>
                  </div>
                </div>
              </div>

              {/* FEE BREAKDOWN TABLE */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-200 text-gray-700 text-xs font-extrabold uppercase tracking-wider">
                      <th className="py-3 px-4">Fee Description / Type</th>
                      <th className="py-3 px-4 text-right">Total Payable</th>
                      <th className="py-3 px-4 text-right">Amount Paid</th>
                      <th className="py-3 px-4 text-right">Arrears / Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-sm">
                    <tr>
                      <td className="py-4 px-4 font-extrabold text-gray-900">
                        {activeReceiptModal.feeType}
                        <span className="block text-xs font-normal text-gray-500 mt-0.5">
                          {activeReceiptModal.remarks || 'Term academic fee payment'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-700 font-bold">
                        GH₵ {activeReceiptModal.totalFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-emerald-700 font-extrabold">
                        GH₵ {activeReceiptModal.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-gray-700 font-bold">
                        GH₵ {Math.max(0, activeReceiptModal.totalFeeAmount - activeReceiptModal.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50 border-t-2 border-purple-900 font-extrabold text-sm">
                      <td className="py-3.5 px-4 text-purple-950 uppercase">Total Transaction Paid:</td>
                      <td colSpan={2} className="py-3.5 px-4 text-right font-mono text-base text-purple-900">
                        GH₵ {activeReceiptModal.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-gray-600">
                        {activeReceiptModal.amountPaid >= activeReceiptModal.totalFeeAmount
                          ? 'Zero Arrears'
                          : `Balance: GH₵ ${(activeReceiptModal.totalFeeAmount - activeReceiptModal.amountPaid).toLocaleString()}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* REMARKS & SIGNATURE FOOTER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-gray-200 text-xs">
                <div>
                  <span className="font-extrabold text-gray-700 uppercase tracking-wider block mb-1">
                    Payment Remarks:
                  </span>
                  <p className="text-gray-600 italic bg-gray-50 p-3 rounded-lg border border-gray-200">
                    "{activeReceiptModal.remarks || 'Official payment received with thanks.'}"
                  </p>
                </div>

                <div className="flex flex-col justify-end items-end text-center space-y-3">
                  <div className="w-48 border-b-2 border-gray-400 pb-2">
                    <span className="font-serif italic font-bold text-gray-800 text-sm">
                      {config.principalName || 'Bursar / Accounts Officer'}
                    </span>
                  </div>
                  <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    Authorized Cashier Signature & Stamp
                  </span>
                </div>
              </div>

              {/* SECURITY & FOOTER NOTE */}
              <div className="text-center pt-4 border-t border-gray-100 text-[10px] text-gray-400 uppercase tracking-widest">
                Official Computer-Generated Receipt • {config.schoolName} Accounts Ledger • Keep Safely for Future Reference
              </div>
            </div>

            {/* IFRAME PRINT ADVISORY (NO-PRINT) */}
            {window.self !== window.top && (
              <div className="p-3 bg-amber-50 border-t border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3 no-print">
                <span>
                  ⚠️ <strong>Preview iframe notice:</strong> Click below if your browser blocks iframe printing.
                </span>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded uppercase tracking-wider transition shrink-0"
                >
                  Open Full Tab to Print
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
