/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookSaleRecord, ReportConfig } from '../../types';
import { Printer, X, CheckCircle2, BookOpen, ShieldCheck, Tag } from 'lucide-react';

interface BookReceiptModalProps {
  sale: BookSaleRecord;
  config: ReportConfig;
  onClose: () => void;
  onPrint?: () => void;
}

export default function BookReceiptModal({
  sale,
  config,
  onClose,
  onPrint
}: BookReceiptModalProps) {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const totalCopies = sale.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto no-print">
      <div className="bg-gradient-to-b from-[#24084d] via-[#1a0538] to-[#120228] text-white rounded-2xl shadow-2xl max-w-2xl w-full border-2 border-violet-500/50 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* MODAL CONTROLS BAR (HIDDEN IN PRINT) */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 border-b-2 border-violet-500/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/30">
              <BookOpen className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white">
                Official Book Sales Receipt
              </h3>
              <p className="text-xs text-purple-100 font-mono font-bold">
                Receipt #{sale.receiptNumber}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer uppercase tracking-wider border border-emerald-400/40"
              id="print-book-receipt-btn"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-violet-900/80 hover:bg-violet-800 text-white transition cursor-pointer border border-violet-400/30"
              title="Close receipt preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE RECEIPT CONTENT CONTAINER */}
        <div className="p-4 sm:p-6 overflow-y-auto bg-slate-900/60">
          <div
            id="printable-book-receipt"
            className="bg-white text-slate-900 rounded-xl p-5 sm:p-7 shadow-lg border border-slate-200 max-w-xl mx-auto space-y-4 text-xs font-sans print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-full"
          >
            {/* SCHOOL HEADER */}
            <div className="text-center pb-4 border-b-2 border-slate-800">
              <div className="flex items-center justify-center gap-3 mb-1">
                {config.schoolLogoUrl ? (
                  <img
                    src={config.schoolLogoUrl}
                    alt="School Logo"
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-purple-900 text-amber-300 font-black flex items-center justify-center text-sm shadow">
                    EA
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                    {config.schoolName || 'Eastfield Academy'}
                  </h1>
                  {config.schoolMotto && (
                    <p className="text-[10px] text-slate-600 italic font-serif">
                      &quot;{config.schoolMotto}&quot;
                    </p>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-slate-600 font-medium">
                P.O. Box 1234, Accra, Ghana • Tel: +233 (0) 24 123 4567 / +233 (0) 55 987 6543
              </p>
              <div className="mt-2 inline-block px-3 py-0.5 bg-slate-900 text-amber-300 text-[11px] font-black uppercase tracking-widest rounded">
                Official Book & Stationery Receipt
              </div>
            </div>

            {/* RECEIPT META INFORMATION */}
            <div className="grid grid-cols-2 gap-3 py-2 border-b border-slate-200 text-[11px]">
              <div>
                <p className="text-slate-500 font-medium">Receipt No:</p>
                <p className="font-mono font-black text-slate-900 text-xs sm:text-sm">
                  {sale.receiptNumber}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-500 font-medium">Date & Time:</p>
                <p className="font-bold text-slate-800">
                  {sale.saleDate} at {sale.saleTime || '12:00'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-medium">Buyer / Student:</p>
                <p className="font-extrabold text-slate-900">
                  {sale.buyerName} {sale.className ? `(${sale.className})` : ''}
                </p>
                {sale.contactNumber && (
                  <p className="text-[10px] text-slate-600 font-mono">
                    Tel: {sale.contactNumber}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-slate-500 font-medium">Payment Mode:</p>
                <p className="font-bold text-slate-900">
                  <span className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono">
                    {sale.paymentMethod}
                  </span>
                </p>
                {sale.paymentReference && (
                  <p className="text-[10px] text-slate-600 font-mono">
                    Ref: {sale.paymentReference}
                  </p>
                )}
              </div>
            </div>

            {/* ITEMIZED ITEMS TABLE */}
            <div>
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-y border-slate-300">
                    <th className="py-2 px-2 w-8 text-center">#</th>
                    <th className="py-2 px-2">Book / Stationery Description</th>
                    <th className="py-2 px-2 text-center w-12">Qty</th>
                    <th className="py-2 px-2 text-right w-20">Unit (GH₵)</th>
                    <th className="py-2 px-2 text-right w-20">Total (GH₵)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sale.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-2 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-2">
                        <div className="font-bold text-slate-900">{item.title}</div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                          <span className="font-medium text-purple-900">{item.publication}</span>
                          <span>•</span>
                          <span>{item.subjectType}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center font-bold text-slate-800">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-slate-700">
                        {item.unitPrice.toFixed(2)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                        {item.totalPrice.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TOTALS COMPUTATION */}
            <div className="border-t-2 border-slate-800 pt-3 space-y-1.5 text-right text-[11px]">
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Total Quantity:</span>
                <span className="font-bold text-slate-900">{totalCopies} Copies</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span className="font-medium">Subtotal Amount:</span>
                <span className="font-mono text-slate-900">GH₵ {sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between items-center text-rose-600 font-bold">
                  <span>Discount / Concession:</span>
                  <span className="font-mono">- GH₵ {sale.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-slate-900 text-sm sm:text-base font-black pt-1.5 border-t border-slate-200">
                <span>Grand Total Paid:</span>
                <span className="font-mono text-emerald-800">GH₵ {sale.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-emerald-700 font-extrabold pt-0.5">
                <span>Payment Status:</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono font-bold">
                  COMPLETELY PAID (BALANCE: GH₵ 0.00)
                </span>
              </div>
            </div>

            {sale.remarks && (
              <div className="p-2 rounded bg-slate-50 border border-slate-200 text-[10px] text-slate-700">
                <strong className="font-bold">Remarks:</strong> {sale.remarks}
              </div>
            )}

            {/* SIGNATURE & STAMP FOOTER */}
            <div className="pt-6 grid grid-cols-2 gap-6 border-t border-slate-200 text-center">
              <div>
                <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                  <span className="font-serif italic text-slate-600 text-xs">
                    {sale.recordedBy || 'Store Administrator'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                  Cashier / Store Manager Signature
                </p>
              </div>
              <div>
                <div className="h-10 border-b border-dashed border-slate-400 flex items-end justify-center pb-1">
                  <div className="w-16 h-8 border border-emerald-600 text-emerald-800 text-[9px] font-black uppercase flex items-center justify-center rotate-[-3deg] opacity-80">
                    PAID / OFFICIAL
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                  Official School Stamp
                </p>
              </div>
            </div>

            <div className="text-center pt-2 text-[9px] text-slate-400">
              * Note: Books and customized stationery once bought are non-refundable after writing on. Thank you for your patronage!
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-violet-950 to-[#17042c] border-t-2 border-violet-500/40 flex items-center justify-between text-xs">
          <div className="text-purple-200 text-xs font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Record saved in database & ledger</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow border border-emerald-400/40 text-xs uppercase tracking-wider"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-violet-900/80 hover:bg-violet-800 text-white font-bold rounded-xl transition cursor-pointer border border-violet-400/40"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
