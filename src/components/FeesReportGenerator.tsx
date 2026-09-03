/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FeePayment } from '../types';
import {
  Calendar,
  FileText,
  Printer,
  Download,
  PieChart,
  BarChart3,
  TrendingUp,
  DollarSign,
  School,
  Clock,
  Receipt,
  X,
  Filter,
  Table
} from 'lucide-react';

interface FeesReportGeneratorProps {
  feePayments: FeePayment[];
  isModal?: boolean;
  onCloseModal?: () => void;
}

export default function FeesReportGenerator({
  feePayments = [],
  isModal = false,
  onCloseModal
}: FeesReportGeneratorProps) {
  // PERIOD TYPE & PARAMETERS
  const [reportPeriod, setReportPeriod] = useState<'DAILY' | 'MONTHLY' | 'YEARLY' | 'ALL_TIME'>('DAILY');
  const [reportDate, setReportDate] = useState<string>(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [reportMonth, setReportMonth] = useState<string>(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [reportYear, setReportYear] = useState<string>(() => new Date().toISOString().slice(0, 4)); // YYYY

  // FEE TYPE FILTER ("ON ALL TYPES OF FEES" default)
  const [reportFeeType, setReportFeeType] = useState<string>('ALL');

  // DISPLAY VIEW TAB
  const [activeTab, setActiveTab] = useState<'SUMMARY_BY_TYPE' | 'DETAILED_TRANSACTIONS'>('SUMMARY_BY_TYPE');

  // OFFICIAL PRINT MODAL
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // DERIVE ALL AVAILABLE FEE TYPES IN ACADEMY RECORDS
  const availableFeeTypes = useMemo(() => {
    const set = new Set<string>();
    feePayments.forEach((p) => {
      if (p.feeType) set.add(p.feeType);
    });
    // Ensure core standard types are present if empty
    ['School Fees', 'Daily Collection', 'Uniform Fee', 'Feeding Fee', 'PTA Levy', 'Mock Examination Fee'].forEach((t) =>
      set.add(t)
    );
    return Array.from(set).sort();
  }, [feePayments]);

  // FILTER PAYMENTS BY PERIOD & FEE TYPE
  const reportFilteredPayments = useMemo(() => {
    return feePayments.filter((p) => {
      // 1. Fee Type filter
      if (reportFeeType !== 'ALL' && p.feeType !== reportFeeType) {
        return false;
      }

      // 2. Period filter
      const pDateStr = (p.paymentDate || '').slice(0, 10);
      if (reportPeriod === 'DAILY') {
        if (pDateStr !== reportDate) return false;
      } else if (reportPeriod === 'MONTHLY') {
        if (pDateStr.slice(0, 7) !== reportMonth) return false;
      } else if (reportPeriod === 'YEARLY') {
        if (pDateStr.slice(0, 4) !== reportYear) return false;
      }
      return true;
    });
  }, [feePayments, reportPeriod, reportDate, reportMonth, reportYear, reportFeeType]);

  // PERIOD LABEL
  const reportPeriodLabel = useMemo(() => {
    if (reportPeriod === 'DAILY') {
      const d = new Date(reportDate + 'T00:00:00');
      return isNaN(d.getTime())
        ? reportDate
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    } else if (reportPeriod === 'MONTHLY') {
      const [year, month] = reportMonth.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return isNaN(d.getTime())
        ? reportMonth
        : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } else if (reportPeriod === 'YEARLY') {
      return `Academic Year ${reportYear}`;
    }
    return 'All-Time Financial Collection';
  }, [reportPeriod, reportDate, reportMonth, reportYear]);

  // SUMMARY CALCULATIONS FOR SELECTED PERIOD
  const reportTotalCollected = useMemo(() => {
    return reportFilteredPayments.reduce((sum, item) => sum + item.amountPaid, 0);
  }, [reportFilteredPayments]);

  const reportTotalExpected = useMemo(() => {
    return reportFilteredPayments.reduce((sum, item) => sum + item.totalFeeAmount, 0);
  }, [reportFilteredPayments]);

  const reportTotalArrears = useMemo(() => {
    return reportFilteredPayments.reduce(
      (sum, item) => sum + Math.max(0, item.totalFeeAmount - item.amountPaid),
      0
    );
  }, [reportFilteredPayments]);

  const reportEfficiency = useMemo(() => {
    if (reportTotalExpected === 0) return 100;
    return Math.min(100, Math.round((reportTotalCollected / reportTotalExpected) * 100));
  }, [reportTotalCollected, reportTotalExpected]);

  // GROUP BY FEE TYPE (SUMMARY BREAKDOWN ON ALL TYPES OF FEES)
  const reportFeeTypeSummary = useMemo(() => {
    const map: Record<
      string,
      {
        feeType: string;
        collected: number;
        expected: number;
        arrears: number;
        count: number;
      }
    > = {};

    reportFilteredPayments.forEach((p) => {
      if (!map[p.feeType]) {
        map[p.feeType] = {
          feeType: p.feeType,
          collected: 0,
          expected: 0,
          arrears: 0,
          count: 0
        };
      }
      map[p.feeType].collected += p.amountPaid;
      map[p.feeType].expected += p.totalFeeAmount;
      map[p.feeType].arrears += Math.max(0, p.totalFeeAmount - p.amountPaid);
      map[p.feeType].count += 1;
    });

    return Object.values(map).sort((a, b) => b.collected - a.collected);
  }, [reportFilteredPayments]);

  // EXPORT PERIOD REPORT AS CSV
  const handleExportReportCSV = () => {
    const headers = [
      'Receipt Number',
      'Student Name',
      'Class',
      'Fee Type',
      'Amount Payable / Due (GHS)',
      'Amount Paid (GHS)',
      'Outstanding Arrears (GHS)',
      'Payment Method',
      'Status',
      'Payment Date',
      'Remarks'
    ];

    const rows = reportFilteredPayments.map((p) => [
      p.receiptNumber,
      p.studentName,
      p.className,
      p.feeType,
      p.totalFeeAmount.toFixed(2),
      p.amountPaid.toFixed(2),
      Math.max(0, p.totalFeeAmount - p.amountPaid).toFixed(2),
      p.paymentMethod,
      p.status,
      p.paymentDate,
      `"${(p.remarks || '').replace(/"/g, '""')}"`
    ]);

    const titleLine = `"EMMANUEL EXCELLENCE ACADEMY - OFFICIAL FEES COLLECTION REPORT"\n`;
    const periodLine = `"Report Period:","${reportPeriodLabel}"\n`;
    const scopeLine = `"Fee Scope:","${reportFeeType === 'ALL' ? 'All Types of Fees' : reportFeeType}"\n`;
    const summaryLine = `"Total Collected (GHS):","${reportTotalCollected.toFixed(2)}","Total Expected (GHS):","${reportTotalExpected.toFixed(2)}","Arrears (GHS):","${reportTotalArrears.toFixed(2)}","Receipts:","${reportFilteredPayments.length}"\n\n`;

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      titleLine +
      periodLine +
      scopeLine +
      summaryLine +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const fileNameDate =
      reportPeriod === 'DAILY'
        ? reportDate
        : reportPeriod === 'MONTHLY'
        ? reportMonth
        : reportPeriod === 'YEARLY'
        ? reportYear
        : 'All_Time';
    link.setAttribute('download', `Fees_${reportPeriod}_Report_${fileNameDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // MAIN GENERATOR CONTENT
  const content = (
    <div className="bg-[#210747] p-6 rounded-2xl border border-purple-400/30 shadow-xl space-y-6 animate-fadeIn no-print">
      {/* HEADER WITH CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/15 pb-4">
        <div>
          <h3 className="text-xl font-extrabold text-white flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-purple-300" />
            <span>Daily, Monthly & Yearly Fees Report Generator</span>
          </h3>
          <p className="text-xs text-gray-300 mt-1">
            Generate financial accounting reports on <strong className="text-purple-200">all types of fees</strong> or filter by specific fee categories
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Report</span>
          </button>

          <button
            type="button"
            onClick={handleExportReportCSV}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-xl border border-white/20 transition flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-purple-300" />
            <span>Export Report CSV</span>
          </button>

          {isModal && onCloseModal && (
            <button
              type="button"
              onClick={onCloseModal}
              className="p-2 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-xl transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* STEP 1: PERIOD TYPE & FILTER BAR */}
      <div className="bg-[#1A0438] p-5 rounded-xl border border-white/10 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* PERIOD TABS */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#2A0E54] p-1.5 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => setReportPeriod('DAILY')}
              className={`px-4 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                reportPeriod === 'DAILY'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Daily Report</span>
            </button>
            <button
              type="button"
              onClick={() => setReportPeriod('MONTHLY')}
              className={`px-4 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                reportPeriod === 'MONTHLY'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Monthly Report</span>
            </button>
            <button
              type="button"
              onClick={() => setReportPeriod('YEARLY')}
              className={`px-4 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                reportPeriod === 'YEARLY'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>Yearly Report</span>
            </button>
            <button
              type="button"
              onClick={() => setReportPeriod('ALL_TIME')}
              className={`px-4 py-2 rounded-lg font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                reportPeriod === 'ALL_TIME'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>All-Time Summary</span>
            </button>
          </div>

          {/* DYNAMIC DATE/MONTH/YEAR PICKER */}
          <div className="flex items-center gap-3 flex-wrap">
            {reportPeriod === 'DAILY' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-purple-300 whitespace-nowrap">
                  Select Date:
                </label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#2A0E54] border border-purple-400/40 text-white font-bold text-xs focus:ring-2 focus:ring-purple-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setReportDate(new Date().toISOString().slice(0, 10))}
                  className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 font-bold text-[11px] transition cursor-pointer"
                >
                  Today
                </button>
              </div>
            )}

            {reportPeriod === 'MONTHLY' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-purple-300 whitespace-nowrap">
                  Select Month:
                </label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-[#2A0E54] border border-purple-400/40 text-white font-bold text-xs focus:ring-2 focus:ring-purple-400 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setReportMonth(new Date().toISOString().slice(0, 7))}
                  className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 font-bold text-[11px] transition cursor-pointer"
                >
                  Current Month
                </button>
              </div>
            )}

            {reportPeriod === 'YEARLY' && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-purple-300 whitespace-nowrap">
                  Select Year:
                </label>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border-2 border-purple-300 text-mauve-950 font-bold text-xs focus:ring-2 focus:ring-purple-400 outline-none shadow-sm cursor-pointer"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                    <option key={yr} value={String(yr)}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setReportYear(new Date().toISOString().slice(0, 4))}
                  className="px-2.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-purple-200 font-bold text-[11px] transition cursor-pointer"
                >
                  Current Year
                </button>
              </div>
            )}

            {/* FEE TYPE SELECTOR ("ON ALL TYPES OF FEES") */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-purple-300 whitespace-nowrap">
                Fee Type:
              </label>
              <select
                value={reportFeeType}
                onChange={(e) => setReportFeeType(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border-2 border-purple-300 text-mauve-950 font-bold text-xs focus:ring-2 focus:ring-purple-400 outline-none shadow-sm cursor-pointer"
              >
                <option value="ALL">All Types of Fees (Comprehensive)</option>
                {availableFeeTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ACTIVE PERIOD SUMMARY BANNER */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-extrabold text-white">
              Reporting Window: <span className="text-purple-300">{reportPeriodLabel}</span>
            </span>
            <span className="text-[11px] text-gray-400">
              • Scope: <strong className="text-white">{reportFeeType === 'ALL' ? 'All Types of Fees' : reportFeeType}</strong>
            </span>
          </div>
          <span className="text-xs text-gray-300 font-medium">
            Found <strong className="text-white">{reportFilteredPayments.length}</strong> payment record(s)
          </span>
        </div>
      </div>

      {/* STEP 2: SUMMARY KPI OVERVIEW FOR SELECTED PERIOD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300 block">
              Total Collected
            </span>
            <span className="text-xl font-extrabold text-white mt-1 block">
              GH₵ {reportTotalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-emerald-400 font-bold mt-0.5 block">
              {reportEfficiency}% collection rate
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-purple-300 block">
              Total Expected / Billed
            </span>
            <span className="text-xl font-extrabold text-white mt-1 block">
              GH₵ {reportTotalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-purple-300 font-bold mt-0.5 block">
              Across {reportFilteredPayments.length} pupil bills
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center">
            <School className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 block">
              Outstanding Arrears
            </span>
            <span className="text-xl font-extrabold text-amber-300 mt-1 block">
              GH₵ {reportTotalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-amber-400 font-bold mt-0.5 block">
              Unpaid balances in period
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-300 block">
              Transactions Count
            </span>
            <span className="text-xl font-extrabold text-white mt-1 block">
              {reportFilteredPayments.length}
            </span>
            <span className="text-[10px] text-blue-300 font-bold mt-0.5 block">
              Verified receipts issued
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* STEP 3: TABS FOR SUMMARY BY FEE TYPE vs DETAILED TRANSACTIONS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-white/15 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('SUMMARY_BY_TYPE')}
              className={`px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'SUMMARY_BY_TYPE'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <PieChart className="w-4 h-4" />
              <span>Summary by Fee Type ({reportFeeTypeSummary.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('DETAILED_TRANSACTIONS')}
              className={`px-4 py-2 rounded-xl font-extrabold text-xs transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'DETAILED_TRANSACTIONS'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Detailed Transaction Log ({reportFilteredPayments.length})</span>
            </button>
          </div>

          <span className="text-xs font-bold text-gray-300 hidden sm:inline">
            Showing <strong className="text-white">{reportPeriodLabel}</strong>
          </span>
        </div>

        {/* TAB 1: SUMMARY BY FEE TYPE */}
        {activeTab === 'SUMMARY_BY_TYPE' && (
          <div className="overflow-x-auto rounded-xl border border-white/15 bg-[#1A0438]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/20 text-gray-300 text-xs font-extrabold uppercase tracking-wider bg-white/5">
                  <th className="py-3.5 px-4">Fee Category / Type</th>
                  <th className="py-3.5 px-4 text-right">Collected (GH₵)</th>
                  <th className="py-3.5 px-4 text-right">Expected (GH₵)</th>
                  <th className="py-3.5 px-4 text-right">Arrears (GH₵)</th>
                  <th className="py-3.5 px-4 text-right">Transactions</th>
                  <th className="py-3.5 px-4 text-right">Share (%)</th>
                  <th className="py-3.5 px-4 w-32">Collection Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-xs">
                {reportFeeTypeSummary.length > 0 ? (
                  reportFeeTypeSummary.map((item) => {
                    const share =
                      reportTotalCollected > 0
                        ? Math.round((item.collected / reportTotalCollected) * 100)
                        : 0;
                    return (
                      <tr key={item.feeType} className="hover:bg-white/5 transition">
                        <td className="py-3.5 px-4 font-extrabold text-white flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />
                          <span>{item.feeType}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400 font-mono">
                          GH₵ {item.collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-gray-200 font-mono">
                          GH₵ {item.expected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-amber-300 font-mono">
                          GH₵ {item.arrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-white">
                          {item.count}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-purple-300">
                          {share}%
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-purple-400 h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, share)}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Calendar className="w-8 h-8 text-purple-300/60" />
                        <p className="text-sm font-bold text-white">No fee collection data for {reportPeriodLabel}</p>
                        <p className="text-xs text-gray-400">
                          Try switching to a different date, month, year, or select the All-Time Summary tab.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {reportFeeTypeSummary.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-white/30 bg-white/5 font-extrabold text-white text-xs">
                    <td className="py-3.5 px-4">TOTAL ACADEMY COLLECTIONS</td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                      GH₵ {reportTotalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-gray-200">
                      GH₵ {reportTotalExpected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-amber-300">
                      GH₵ {reportTotalArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right">{reportFilteredPayments.length}</td>
                    <td className="py-3.5 px-4 text-right">100%</td>
                    <td className="py-3.5 px-4" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* TAB 2: DETAILED TRANSACTION LOG */}
        {activeTab === 'DETAILED_TRANSACTIONS' && (
          <div className="overflow-x-auto rounded-xl border border-white/15 bg-[#1A0438]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/20 text-gray-300 text-xs font-extrabold uppercase tracking-wider bg-white/5">
                  <th className="py-3.5 px-3">Receipt #</th>
                  <th className="py-3.5 px-3">Date</th>
                  <th className="py-3.5 px-3">Student Name</th>
                  <th className="py-3.5 px-3">Class</th>
                  <th className="py-3.5 px-3">Fee Type</th>
                  <th className="py-3.5 px-3 text-right">Paid (GH₵)</th>
                  <th className="py-3.5 px-3 text-right">Arrears</th>
                  <th className="py-3.5 px-3">Method</th>
                  <th className="py-3.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-xs">
                {reportFilteredPayments.length > 0 ? (
                  reportFilteredPayments.map((p, idx) => {
                    const arrears = Math.max(0, p.totalFeeAmount - p.amountPaid);
                    return (
                      <tr key={`${p.id || p.receiptNumber}-${idx}`} className="hover:bg-white/5 transition">
                        <td className="py-3 px-3 font-mono font-extrabold text-purple-300">
                          {p.receiptNumber}
                        </td>
                        <td className="py-3 px-3 text-gray-300 whitespace-nowrap">
                          {p.paymentDate}
                        </td>
                        <td className="py-3 px-3 font-extrabold text-white">
                          {p.studentName}
                        </td>
                        <td className="py-3 px-3 text-gray-300">
                          {p.className}
                        </td>
                        <td className="py-3 px-3 font-bold text-purple-200">
                          {p.feeType}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-400">
                          {p.amountPaid.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-amber-300">
                          {arrears > 0 ? arrears.toFixed(2) : '0.00'}
                        </td>
                        <td className="py-3 px-3 text-gray-300">
                          {p.paymentMethod}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                              p.status === 'Paid'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : p.status === 'Partial'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {p.status || 'Pending'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Table className="w-8 h-8 text-purple-300/60" />
                        <p className="text-sm font-bold text-white">No payment transactions found for {reportPeriodLabel}</p>
                        <p className="text-xs text-gray-400">
                          Select a different period or fee type to generate the transaction log.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // IF RENDERED AS MODAL vs EMBEDDED
  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
        <div className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#210747] border border-purple-400/30 shadow-2xl">
          {content}

          {/* OFFICIAL PRINTABLE REPORT MODAL WHEN USER CLICKS PRINT */}
          {showPrintModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto animate-fadeIn">
              <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-8 relative">
                {/* ACTION HEADER (NO PRINT) */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-6 no-print">
                  <div className="flex items-center gap-2">
                    <Printer className="w-5 h-5 text-purple-700" />
                    <span className="font-extrabold text-gray-800 text-base">Official Printable Document Preview</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-5 py-2 bg-purple-700 hover:bg-purple-600 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Print Document Now</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPrintModal(false)}
                      className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>

                {/* FORMAL PRINTABLE REPORT BODY */}
                <div className="space-y-6">
                  {/* SCHOOL HEADER & LOGO */}
                  <div className="text-center border-b-2 border-purple-900 pb-5">
                    <h1 className="text-2xl font-black text-purple-950 uppercase tracking-wider">
                      EMMANUEL EXCELLENCE ACADEMY
                    </h1>
                    <p className="text-xs font-bold text-gray-600 tracking-widest mt-0.5">
                      DISCIPLINE, EXCELLENCE & SERVICE
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Official Financial Fees Collection Accounting Report
                    </p>
                    <div className="inline-block mt-3 px-4 py-1.5 bg-purple-100 text-purple-900 font-black text-sm rounded-full border border-purple-300">
                      OFFICIAL {reportPeriod} FEES REPORT: {reportPeriodLabel.toUpperCase()}
                    </div>
                  </div>

                  {/* METADATA STRIP */}
                  <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div>
                      <span className="text-gray-500 block">Report Period:</span>
                      <strong className="text-gray-900">{reportPeriodLabel}</strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Fee Categories Included:</span>
                      <strong className="text-gray-900">
                        {reportFeeType === 'ALL' ? 'All Types of Fees (Comprehensive)' : reportFeeType}
                      </strong>
                    </div>
                    <div>
                      <span className="text-gray-500 block">Generated Date & Time:</span>
                      <strong className="text-gray-900">{new Date().toLocaleString()}</strong>
                    </div>
                  </div>

                  {/* SUMMARY KPIS */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 block">
                        Total Collected
                      </span>
                      <span className="text-lg font-black text-purple-950 mt-1 block font-mono">
                        GHS {reportTotalCollected.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700 block">
                        Total Expected
                      </span>
                      <span className="text-lg font-black text-gray-900 mt-1 block font-mono">
                        GHS {reportTotalExpected.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                        Outstanding Arrears
                      </span>
                      <span className="text-lg font-black text-amber-900 mt-1 block font-mono">
                        GHS {reportTotalArrears.toFixed(2)}
                      </span>
                    </div>

                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                        Collection Rate
                      </span>
                      <span className="text-lg font-black text-emerald-900 mt-1 block">
                        {reportEfficiency}% ({reportFilteredPayments.length} receipts)
                      </span>
                    </div>
                  </div>

                  {/* SECTION 1: BREAKDOWN BY FEE TYPE */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-950 mb-2">
                      1. Summary Breakdown by Fee Type
                    </h3>
                    <table className="w-full text-left border-collapse border border-gray-300 text-xs">
                      <thead>
                        <tr className="bg-purple-100 text-purple-950 font-bold uppercase text-[10px]">
                          <th className="p-2.5 border border-gray-300">Fee Category / Type</th>
                          <th className="p-2.5 border border-gray-300 text-right">Collected (GHS)</th>
                          <th className="p-2.5 border border-gray-300 text-right">Expected (GHS)</th>
                          <th className="p-2.5 border border-gray-300 text-right">Arrears (GHS)</th>
                          <th className="p-2.5 border border-gray-300 text-right">Receipts</th>
                          <th className="p-2.5 border border-gray-300 text-right">Share (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportFeeTypeSummary.map((item) => {
                          const share =
                            reportTotalCollected > 0
                              ? Math.round((item.collected / reportTotalCollected) * 100)
                              : 0;
                          return (
                            <tr key={item.feeType}>
                              <td className="p-2.5 border border-gray-300 font-bold text-gray-900">
                                {item.feeType}
                              </td>
                              <td className="p-2.5 border border-gray-300 text-right font-mono font-bold text-emerald-700">
                                {item.collected.toFixed(2)}
                              </td>
                              <td className="p-2.5 border border-gray-300 text-right font-mono text-gray-700">
                                {item.expected.toFixed(2)}
                              </td>
                              <td className="p-2.5 border border-gray-300 text-right font-mono text-amber-800">
                                {item.arrears.toFixed(2)}
                              </td>
                              <td className="p-2.5 border border-gray-300 text-right">{item.count}</td>
                              <td className="p-2.5 border border-gray-300 text-right font-bold">
                                {share}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* SECTION 2: TRANSACTION LEDGER */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-purple-950 mb-2">
                      2. Detailed Collection Ledger
                    </h3>
                    <table className="w-full text-left border-collapse border border-gray-300 text-[11px]">
                      <thead>
                        <tr className="bg-gray-100 text-gray-900 font-bold uppercase text-[10px]">
                          <th className="p-2 border border-gray-300">Receipt #</th>
                          <th className="p-2 border border-gray-300">Date</th>
                          <th className="p-2 border border-gray-300">Student Name</th>
                          <th className="p-2 border border-gray-300">Class</th>
                          <th className="p-2 border border-gray-300">Fee Type</th>
                          <th className="p-2 border border-gray-300 text-right">Paid (GHS)</th>
                          <th className="p-2 border border-gray-300 text-right">Arrears</th>
                          <th className="p-2 border border-gray-300">Method</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportFilteredPayments.length > 0 ? (
                          reportFilteredPayments.map((p, idx) => {
                            const arr = Math.max(0, p.totalFeeAmount - p.amountPaid);
                            return (
                              <tr key={`${p.id || p.receiptNumber}-${idx}`}>
                                <td className="p-2 border border-gray-300 font-mono font-bold text-purple-900">
                                  {p.receiptNumber}
                                </td>
                                <td className="p-2 border border-gray-300 whitespace-nowrap">
                                  {p.paymentDate}
                                </td>
                                <td className="p-2 border border-gray-300 font-bold text-gray-900">
                                  {p.studentName}
                                </td>
                                <td className="p-2 border border-gray-300">{p.className}</td>
                                <td className="p-2 border border-gray-300">{p.feeType}</td>
                                <td className="p-2 border border-gray-300 text-right font-mono font-bold text-emerald-700">
                                  {p.amountPaid.toFixed(2)}
                                </td>
                                <td className="p-2 border border-gray-300 text-right font-mono text-amber-800">
                                  {arr > 0 ? arr.toFixed(2) : '0.00'}
                                </td>
                                <td className="p-2 border border-gray-300">{p.paymentMethod}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={8} className="p-6 text-center text-gray-500 italic">
                              No payment transactions recorded for {reportPeriodLabel}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SIGNATURES */}
                  <div className="pt-10 grid grid-cols-3 gap-8 text-xs font-bold text-gray-800 border-t border-gray-300 mt-12">
                    <div className="text-center">
                      <div className="border-b border-gray-500 h-8 mb-2" />
                      <span>Prepared By (Bursar / Cashier)</span>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-gray-500 h-8 mb-2" />
                      <span>Official Stamp & Date</span>
                    </div>
                    <div className="text-center">
                      <div className="border-b border-gray-500 h-8 mb-2" />
                      <span>Approved By (Director)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // DEFAULT INLINE RENDER (EMBEDDED) + OFFICIAL PRINT MODAL
  return (
    <>
      {content}

      {showPrintModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto animate-fadeIn">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-8 relative">
            {/* ACTION HEADER (NO PRINT) */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-6 no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-purple-700" />
                <span className="font-extrabold text-gray-800 text-base">Official Printable Document Preview</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-600 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>

            {/* FORMAL PRINTABLE REPORT BODY */}
            <div className="space-y-6">
              {/* SCHOOL HEADER & LOGO */}
              <div className="text-center border-b-2 border-purple-900 pb-5">
                <h1 className="text-2xl font-black text-purple-950 uppercase tracking-wider">
                  EMMANUEL EXCELLENCE ACADEMY
                </h1>
                <p className="text-xs font-bold text-gray-600 tracking-widest mt-0.5">
                  DISCIPLINE, EXCELLENCE & SERVICE
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Official Financial Fees Collection Accounting Report
                </p>
                <div className="inline-block mt-3 px-4 py-1.5 bg-purple-100 text-purple-900 font-black text-sm rounded-full border border-purple-300">
                  OFFICIAL {reportPeriod} FEES REPORT: {reportPeriodLabel.toUpperCase()}
                </div>
              </div>

              {/* METADATA STRIP */}
              <div className="grid grid-cols-3 gap-4 text-xs font-medium text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div>
                  <span className="text-gray-500 block">Report Period:</span>
                  <strong className="text-gray-900">{reportPeriodLabel}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Fee Categories Included:</span>
                  <strong className="text-gray-900">
                    {reportFeeType === 'ALL' ? 'All Types of Fees (Comprehensive)' : reportFeeType}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Generated Date & Time:</span>
                  <strong className="text-gray-900">{new Date().toLocaleString()}</strong>
                </div>
              </div>

              {/* SUMMARY KPIS */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-700 block">
                    Total Collected
                  </span>
                  <span className="text-lg font-black text-purple-950 mt-1 block font-mono">
                    GHS {reportTotalCollected.toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-700 block">
                    Total Expected
                  </span>
                  <span className="text-lg font-black text-gray-900 mt-1 block font-mono">
                    GHS {reportTotalExpected.toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                    Outstanding Arrears
                  </span>
                  <span className="text-lg font-black text-amber-900 mt-1 block font-mono">
                    GHS {reportTotalArrears.toFixed(2)}
                  </span>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                    Collection Rate
                  </span>
                  <span className="text-lg font-black text-emerald-900 mt-1 block">
                    {reportEfficiency}% ({reportFilteredPayments.length} receipts)
                  </span>
                </div>
              </div>

              {/* SECTION 1: BREAKDOWN BY FEE TYPE */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-950 mb-2">
                  1. Summary Breakdown by Fee Type
                </h3>
                <table className="w-full text-left border-collapse border border-gray-300 text-xs">
                  <thead>
                    <tr className="bg-purple-100 text-purple-950 font-bold uppercase text-[10px]">
                      <th className="p-2.5 border border-gray-300">Fee Category / Type</th>
                      <th className="p-2.5 border border-gray-300 text-right">Collected (GHS)</th>
                      <th className="p-2.5 border border-gray-300 text-right">Expected (GHS)</th>
                      <th className="p-2.5 border border-gray-300 text-right">Arrears (GHS)</th>
                      <th className="p-2.5 border border-gray-300 text-right">Receipts</th>
                      <th className="p-2.5 border border-gray-300 text-right">Share (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportFeeTypeSummary.map((item) => {
                      const share =
                        reportTotalCollected > 0
                          ? Math.round((item.collected / reportTotalCollected) * 100)
                          : 0;
                      return (
                        <tr key={item.feeType}>
                          <td className="p-2.5 border border-gray-300 font-bold text-gray-900">
                            {item.feeType}
                          </td>
                          <td className="p-2.5 border border-gray-300 text-right font-mono font-bold text-emerald-700">
                            {item.collected.toFixed(2)}
                          </td>
                          <td className="p-2.5 border border-gray-300 text-right font-mono text-gray-700">
                            {item.expected.toFixed(2)}
                          </td>
                          <td className="p-2.5 border border-gray-300 text-right font-mono text-amber-800">
                            {item.arrears.toFixed(2)}
                          </td>
                          <td className="p-2.5 border border-gray-300 text-right">{item.count}</td>
                          <td className="p-2.5 border border-gray-300 text-right font-bold">
                            {share}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* SECTION 2: TRANSACTION LEDGER */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-purple-950 mb-2">
                  2. Detailed Collection Ledger
                </h3>
                <table className="w-full text-left border-collapse border border-gray-300 text-[11px]">
                  <thead>
                    <tr className="bg-gray-100 text-gray-900 font-bold uppercase text-[10px]">
                      <th className="p-2 border border-gray-300">Receipt #</th>
                      <th className="p-2 border border-gray-300">Date</th>
                      <th className="p-2 border border-gray-300">Student Name</th>
                      <th className="p-2 border border-gray-300">Class</th>
                      <th className="p-2 border border-gray-300">Fee Type</th>
                      <th className="p-2 border border-gray-300 text-right">Paid (GHS)</th>
                      <th className="p-2 border border-gray-300 text-right">Arrears</th>
                      <th className="p-2 border border-gray-300">Method</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportFilteredPayments.length > 0 ? (
                      reportFilteredPayments.map((p, idx) => {
                        const arr = Math.max(0, p.totalFeeAmount - p.amountPaid);
                        return (
                          <tr key={`${p.id || p.receiptNumber}-${idx}`}>
                            <td className="p-2 border border-gray-300 font-mono font-bold text-purple-900">
                              {p.receiptNumber}
                            </td>
                            <td className="p-2 border border-gray-300 whitespace-nowrap">
                              {p.paymentDate}
                            </td>
                            <td className="p-2 border border-gray-300 font-bold text-gray-900">
                              {p.studentName}
                            </td>
                            <td className="p-2 border border-gray-300">{p.className}</td>
                            <td className="p-2 border border-gray-300">{p.feeType}</td>
                            <td className="p-2 border border-gray-300 text-right font-mono font-bold text-emerald-700">
                              {p.amountPaid.toFixed(2)}
                            </td>
                            <td className="p-2 border border-gray-300 text-right font-mono text-amber-800">
                              {arr > 0 ? arr.toFixed(2) : '0.00'}
                            </td>
                            <td className="p-2 border border-gray-300">{p.paymentMethod}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-gray-500 italic">
                          No payment transactions recorded for {reportPeriodLabel}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* SIGNATURES */}
              <div className="pt-10 grid grid-cols-3 gap-8 text-xs font-bold text-gray-800 border-t border-gray-300 mt-12">
                <div className="text-center">
                  <div className="border-b border-gray-500 h-8 mb-2" />
                  <span>Prepared By (Bursar / Cashier)</span>
                </div>
                <div className="text-center">
                  <div className="border-b border-gray-500 h-8 mb-2" />
                  <span>Official Stamp & Date</span>
                </div>
                <div className="text-center">
                  <div className="border-b border-gray-500 h-8 mb-2" />
                  <span>Approved By (Director)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
