/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Student, ReportConfig, FeePayment, FeeTypeCategory, PaymentStatus, StudentBill } from '../types';
import { INITIAL_FEE_PAYMENTS } from '../data/mockData';
import { isDemoFeePayment } from './FeesCollectionModule';
import { fetchSupabaseFeePayments } from '../lib/supabase';
import {
  DollarSign,
  Search,
  Filter,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  Receipt,
  PieChart,
  BarChart3,
  TrendingUp,
  CreditCard,
  PlusCircle,
  FileText,
  School,
  ArrowUpRight,
  ShieldCheck,
  User
} from 'lucide-react';

interface FeesDashboardProps {
  students?: Student[];
  classes?: {
    NURSERY: string[];
    KINDERGARTEN?: string[];
    PRIMARY: string[];
    JHS: string[];
  };
  config?: ReportConfig;
  bills?: StudentBill[];
  onRecordNewPayment?: () => void;
}

export default function FeesDashboard({
  students = [],
  classes,
  config,
  onRecordNewPayment
}: FeesDashboardProps) {
  // Load fee payments from localStorage or fallback to INITIAL_FEE_PAYMENTS
  const [feePayments, setFeePayments] = useState<FeePayment[]>(() => {
    try {
      const saved = localStorage.getItem('ea_fee_payments');
      if (saved) {
        const parsed: FeePayment[] = JSON.parse(saved);
        return parsed.filter((p) => !isDemoFeePayment(p));
      }
    } catch (e) {
      console.error('Failed to load fee payments from localStorage in FeesDashboard', e);
    }
    return INITIAL_FEE_PAYMENTS.filter((p) => !isDemoFeePayment(p));
  });

  // Sync when storage changes or load from Supabase
  useEffect(() => {
    fetchSupabaseFeePayments().then((data) => {
      if (data && Array.isArray(data) && data.length > 0) {
        setFeePayments(data.filter((p) => !isDemoFeePayment(p)));
      }
    }).catch(err => console.warn('Supabase fee payments load error:', err));

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

  // SEARCH AND FILTER CONTROL STATE
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterFeeType, setFilterFeeType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterClass, setFilterClass] = useState<string>('ALL');

  // RECEIPT MODAL STATE
  const [activeReceiptModal, setActiveReceiptModal] = useState<FeePayment | null>(null);

  // Derive unique classes from data
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    feePayments.forEach((p) => set.add(p.className));
    students.forEach((s) => set.add(s.className));
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [feePayments, students]);

  // Derive unique fee types from data
  const availableFeeTypes = useMemo(() => {
    const set = new Set<string>();
    feePayments.forEach((p) => set.add(p.feeType));
    return Array.from(set);
  }, [feePayments]);

  // SUMMARY CALCULATIONS: OVERALL KPIS
  const totalCollected = useMemo(() => {
    return feePayments.reduce((sum, item) => sum + item.amountPaid, 0);
  }, [feePayments]);

  const totalExpected = useMemo(() => {
    return feePayments.reduce((sum, item) => sum + item.totalFeeAmount, 0);
  }, [feePayments]);

  const totalArrears = useMemo(() => {
    return feePayments.reduce(
      (sum, item) => sum + Math.max(0, item.totalFeeAmount - item.amountPaid),
      0
    );
  }, [feePayments]);

  const collectionEfficiency = useMemo(() => {
    if (totalExpected === 0) return 100;
    return Math.min(100, Math.round((totalCollected / totalExpected) * 100));
  }, [totalCollected, totalExpected]);

  // 1. SUMMARY TABLE: TOTAL COLLECTED FEES BY TYPE
  const feesByTypeSummary = useMemo(() => {
    const typeMap: Record<
      string,
      { feeType: string; totalCollected: number; totalExpected: number; count: number }
    > = {};

    feePayments.forEach((item) => {
      if (!typeMap[item.feeType]) {
        typeMap[item.feeType] = {
          feeType: item.feeType,
          totalCollected: 0,
          totalExpected: 0,
          count: 0
        };
      }
      typeMap[item.feeType].totalCollected += item.amountPaid;
      typeMap[item.feeType].totalExpected += item.totalFeeAmount;
      typeMap[item.feeType].count += 1;
    });

    return Object.values(typeMap).sort((a, b) => b.totalCollected - a.totalCollected);
  }, [feePayments]);

  // 2. BREAKDOWN OF PENDING VS. PAID VS. PARTIAL STATUSES
  const statusBreakdown = useMemo(() => {
    const stats = {
      Paid: { count: 0, totalAmount: 0, label: 'Paid in Full', color: 'emerald' },
      Partial: { count: 0, totalAmount: 0, label: 'Partial Payment', color: 'amber' },
      Pending: { count: 0, totalAmount: 0, label: 'Pending / Unpaid', color: 'rose' }
    };

    feePayments.forEach((item) => {
      const st = (item.status || 'Pending') as PaymentStatus;
      if (stats[st]) {
        stats[st].count += 1;
        stats[st].totalAmount += item.amountPaid;
      }
    });

    const totalCount = feePayments.length || 1;
    return [
      {
        status: 'Paid',
        label: 'Paid in Full',
        count: stats.Paid.count,
        totalAmount: stats.Paid.totalAmount,
        percentage: Math.round((stats.Paid.count / totalCount) * 100),
        colorClass: 'bg-emerald-500',
        textClass: 'text-emerald-400',
        borderClass: 'border-emerald-500/30',
        bgClass: 'bg-emerald-500/10'
      },
      {
        status: 'Partial',
        label: 'Partial Payment',
        count: stats.Partial.count,
        totalAmount: stats.Partial.totalAmount,
        percentage: Math.round((stats.Partial.count / totalCount) * 100),
        colorClass: 'bg-amber-500',
        textClass: 'text-amber-400',
        borderClass: 'border-amber-500/30',
        bgClass: 'bg-amber-500/10'
      },
      {
        status: 'Pending',
        label: 'Pending / Unpaid',
        count: stats.Pending.count,
        totalAmount: stats.Pending.totalAmount,
        percentage: Math.round((stats.Pending.count / totalCount) * 100),
        colorClass: 'bg-rose-500',
        textClass: 'text-rose-400',
        borderClass: 'border-rose-500/30',
        bgClass: 'bg-rose-500/10'
      }
    ];
  }, [feePayments]);

  // 3. FILTERED PAYMENTS FOR THE STUDENT SEARCH TABLE
  const filteredPayments = useMemo(() => {
    return feePayments.filter((item) => {
      if (filterClass !== 'ALL' && item.className !== filterClass) return false;
      if (filterFeeType !== 'ALL' && item.feeType !== filterFeeType) return false;
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.studentName.toLowerCase().includes(q);
        const matchReceipt = item.receiptNumber.toLowerCase().includes(q);
        const matchType = item.feeType.toLowerCase().includes(q);
        const matchRemarks = (item.remarks || '').toLowerCase().includes(q);
        if (!matchName && !matchReceipt && !matchType && !matchRemarks) return false;
      }
      return true;
    });
  }, [feePayments, filterClass, filterFeeType, filterStatus, searchQuery]);

  // Export filtered ledger to CSV
  const handleExportCSV = () => {
    const headers = [
      'Receipt Number',
      'Student Name',
      'Class',
      'Fee Type',
      'Total Payable (GHS)',
      'Amount Paid (GHS)',
      'Balance Arrears (GHS)',
      'Payment Method',
      'Status',
      'Payment Date',
      'Remarks'
    ];
    const rows = filteredPayments.map((p) => [
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
      `"${(p.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Fees_Summary_Report_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* HEADER WITH CALL TO ACTION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#210747] p-6 rounded-2xl border border-white/20 shadow-lg no-print">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-purple-300" />
            <span>School Fees Financial Dashboard</span>
          </h2>
          <p className="text-xs sm:text-sm text-gray-300 mt-1">
            Real-time revenue summary by fee type, collection status breakdown, and pupil payment lookup
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-center">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-xl border border-white/20 transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-purple-300" />
            <span>Export Financial CSV</span>
          </button>
          {feePayments.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all fee receipt records?')) {
                  setFeePayments([]);
                  localStorage.removeItem('ea_fee_payments');
                }
              }}
              className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-extrabold text-xs rounded-xl border border-rose-400/30 transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <span>Clear All Receipts</span>
            </button>
          )}
          {onRecordNewPayment && (
            <button
              onClick={onRecordNewPayment}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer uppercase tracking-wider"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record New Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* TOP KPI OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="p-5 rounded-2xl border border-white/15 bg-[#210747] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              Total Fees Collected
            </span>
            <span className="text-2xl font-extrabold text-white mt-1.5 block">
              GH₵ {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{collectionEfficiency}% collection efficiency</span>
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/15 bg-[#210747] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              Total Expected Revenue
            </span>
            <span className="text-2xl font-extrabold text-white mt-1.5 block">
              GH₵ {totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-purple-300 font-bold mt-1 block">
              Billed across {feePayments.length} records
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <School className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/15 bg-[#210747] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              Outstanding Arrears
            </span>
            <span className="text-2xl font-extrabold text-amber-300 mt-1.5 block">
              GH₵ {totalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[11px] text-amber-400 font-bold mt-1 block">
              Unpaid balances pending collection
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl border border-white/15 bg-[#210747] shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-gray-300 block">
              Total Receipts Issued
            </span>
            <span className="text-2xl font-extrabold text-white mt-1.5 block">
              {feePayments.length}
            </span>
            <span className="text-[11px] text-blue-300 font-bold mt-1 block">
              Verified academy transactions
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 2-COLUMN SECTION: TOTAL COLLECTED BY TYPE & PENDING VS PAID BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        {/* SUMMARY TABLE: TOTAL COLLECTED FEES BY TYPE (7 COLS) */}
        <div className="lg:col-span-7 bg-[#210747] p-6 rounded-2xl border border-white/20 shadow-lg flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-300" />
                <span>Summary by Fee Type</span>
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                Total collections and revenue contribution per fee category
              </p>
            </div>
            <span className="text-xs font-extrabold text-purple-300 uppercase tracking-wider">
              {feesByTypeSummary.length} Categories
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/20 text-gray-300 text-xs font-extrabold uppercase tracking-wider">
                  <th className="py-3 px-3">Fee Type</th>
                  <th className="py-3 px-3 text-right">Collected (GHS)</th>
                  <th className="py-3 px-3 text-right">Count</th>
                  <th className="py-3 px-3 text-right">Share (%)</th>
                  <th className="py-3 px-3 w-32">Revenue Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-xs">
                {feesByTypeSummary.length > 0 ? (
                  feesByTypeSummary.map((item) => {
                    const sharePercent =
                      totalCollected > 0
                        ? Math.round((item.totalCollected / totalCollected) * 100)
                        : 0;
                    return (
                      <tr key={item.feeType} className="hover:bg-white/5 transition">
                        <td className="py-3.5 px-3 font-extrabold text-white">
                          {item.feeType}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-extrabold text-emerald-300">
                          GH₵ {item.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-3 text-right font-bold text-gray-200">
                          {item.count}
                        </td>
                        <td className="py-3.5 px-3 text-right font-mono font-bold text-white">
                          {sharePercent}%
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-emerald-400 h-2.5 rounded-full transition-all duration-300"
                              style={{ width: `${sharePercent}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-300 font-bold">
                      No fee payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* BREAKDOWN OF PENDING VS PAID STATUSES (5 COLS) */}
        <div className="lg:col-span-5 bg-[#210747] p-6 rounded-2xl border border-white/20 shadow-lg space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/15 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-300" />
                  <span>Paid vs. Pending Breakdown</span>
                </h3>
                <p className="text-xs text-gray-300 mt-0.5">
                  Collection status distribution across all student records
                </p>
              </div>
            </div>

            {/* STATUS CARDS */}
            <div className="space-y-3">
              {statusBreakdown.map((item) => (
                <div
                  key={item.status}
                  onClick={() => setFilterStatus(item.status)}
                  className={`p-4 rounded-xl border ${item.borderClass} ${item.bgClass} flex items-center justify-between cursor-pointer hover:opacity-95 transition`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${item.colorClass}`} />
                    <div>
                      <span className="font-extrabold text-white text-sm block">
                        {item.label}
                      </span>
                      <span className="text-xs text-gray-300">
                        {item.count} payment record{item.count !== 1 ? 's' : ''} ({item.percentage}%)
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className={`font-extrabold text-sm block ${item.textClass}`}>
                      GH₵ {item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      Click to filter
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* VISUAL STACKED BAR FOR RATIO */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex justify-between text-xs font-bold text-gray-300">
              <span>Collection Status Ratio</span>
              <span>{collectionEfficiency}% Collected</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-3 flex overflow-hidden">
              {statusBreakdown.map((s) => (
                <div
                  key={s.status}
                  className={`${s.colorClass} h-full transition-all duration-300`}
                  style={{ width: `${s.percentage}%` }}
                  title={`${s.label}: ${s.percentage}%`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH & FILTER INPUT TO LOCATE SPECIFIC PAYMENT RECORDS BY STUDENT NAME */}
      <div className="bg-[#210747] p-6 rounded-2xl border border-white/20 shadow-lg space-y-5 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/15 pb-4">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-300" />
              <span>Student Payment Records Lookup ({filteredPayments.length})</span>
            </h3>
            <p className="text-xs text-gray-300 mt-0.5">
              Locate specific student payment transactions by student name, receipt number, class, or fee type
            </p>
          </div>

          {(filterClass !== 'ALL' ||
            filterFeeType !== 'ALL' ||
            filterStatus !== 'ALL' ||
            searchQuery.trim() !== '') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterClass('ALL');
                setFilterFeeType('ALL');
                setFilterStatus('ALL');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* INTERACTIVE SEARCH & FILTER CONTROLS */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* 1. Student Name / Receipt Number Search */}
          <div className="relative sm:col-span-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student name, receipt..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/30 bg-[#1A0438] text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {/* 2. Filter by Class / Form */}
          <div>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="ALL" className="bg-[#1A0438] text-white">All Classes / Forms</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls} className="bg-[#1A0438] text-white font-bold">
                  {cls}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Filter by Fee Type */}
          <div>
            <select
              value={filterFeeType}
              onChange={(e) => setFilterFeeType(e.target.value)}
              className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="ALL" className="bg-[#1A0438] text-white">All Fee Types</option>
              {availableFeeTypes.map((ft) => (
                <option key={ft} value={ft} className="bg-[#1A0438] text-white font-bold">
                  {ft}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Filter by Status */}
          <div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-3 rounded-xl border border-white/30 bg-[#1A0438] text-white text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="ALL" className="bg-[#1A0438] text-white">All Statuses</option>
              <option value="Paid" className="bg-[#1A0438] text-white">Paid in Full</option>
              <option value="Partial" className="bg-[#1A0438] text-white">Partial Payment</option>
              <option value="Pending" className="bg-[#1A0438] text-white">Pending / Unpaid</option>
            </select>
          </div>
        </div>

        {/* RESULTS TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/20 text-gray-300 text-xs font-extrabold uppercase tracking-wider">
                <th className="py-3.5 px-3">Receipt No.</th>
                <th className="py-3.5 px-3">Student Name</th>
                <th className="py-3.5 px-3">Class</th>
                <th className="py-3.5 px-3">Fee Type</th>
                <th className="py-3.5 px-3 text-right">Amount Paid</th>
                <th className="py-3.5 px-3 text-right">Total Payable</th>
                <th className="py-3.5 px-3">Method</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-3">Date</th>
                <th className="py-3.5 px-3 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 text-xs">
              {filteredPayments.length > 0 ? (
                filteredPayments.map((p) => {
                  const isPaid = p.status === 'Paid';
                  const isPartial = p.status === 'Partial';
                  return (
                    <tr key={p.id} className="hover:bg-white/5 transition">
                      <td className="py-3.5 px-3 font-mono font-extrabold text-purple-300 whitespace-nowrap">
                        {p.receiptNumber}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-extrabold text-white block">
                          {p.studentName}
                        </span>
                        {p.remarks && (
                          <span className="text-[11px] text-gray-300 block max-w-xs truncate">
                            {p.remarks}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-gray-200">
                        {p.className}
                      </td>
                      <td className="py-3.5 px-3 font-extrabold text-white">
                        {p.feeType}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-extrabold text-emerald-300">
                        GH₵ {p.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-gray-300">
                        GH₵ {p.totalFeeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-3 font-bold text-gray-200">
                        {p.paymentMethod}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
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
                      <td className="py-3.5 px-3 font-mono text-gray-300 whitespace-nowrap">
                        {p.paymentDate}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => setActiveReceiptModal(p)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-lg transition inline-flex items-center gap-1.5 shadow-sm cursor-pointer border border-purple-400/30"
                          title="Open official student fee receipt"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-gray-300 font-bold">
                    No fee payment records match your search or filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OFFICIAL SCHOOL FEES RECEIPT MODAL */}
      {activeReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-300 max-h-[90vh] flex flex-col print:max-h-none print:shadow-none print:border-none print:rounded-none">
            {/* NO-PRINT HEADER */}
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

            {/* RECEIPT PRINTABLE AREA */}
            <div className="p-8 space-y-6 overflow-y-auto bg-white text-gray-900 print-container font-sans">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b-2 border-purple-900 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#1C053E] text-white flex items-center justify-center font-serif font-extrabold text-2xl shadow">
                    {(config?.schoolName || 'EA').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-[#1C053E] uppercase tracking-tight font-display">
                      {config?.schoolName || 'Eastfield Academy'}
                    </h2>
                    <p className="text-xs text-gray-600 font-bold uppercase tracking-wider">
                      {config?.schoolMotto || 'Excellence in Academic Discipline & Leadership'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Academic Year {config?.schoolYear || '2025/2026'} • {config?.term || 'Term 1'}
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

              {/* STUDENT & PAYMENT DETAILS */}
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

              {/* TABLE */}
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

              {/* REMARKS & SIGNATURE */}
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
                      {config?.principalName || 'Bursar / Accounts Officer'}
                    </span>
                  </div>
                  <span className="text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                    Authorized Cashier Signature & Stamp
                  </span>
                </div>
              </div>

              <div className="text-center pt-4 border-t border-gray-100 text-[10px] text-gray-400 uppercase tracking-widest">
                Official Computer-Generated Receipt • {config?.schoolName || 'Eastfield Academy'} Accounts Ledger
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
