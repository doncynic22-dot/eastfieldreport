/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookStockItem } from '../../types';
import { X, PackagePlus, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RestockModalProps {
  item: BookStockItem;
  onConfirm: (itemId: string, addedQuantity: number, updatedUnitPrice?: number, restockNotes?: string) => void;
  onClose: () => void;
}

export default function RestockModal({
  item,
  onConfirm,
  onClose
}: RestockModalProps) {
  const [addedQuantity, setAddedQuantity] = useState<number | ''>(50);
  const [unitPrice, setUnitPrice] = useState<number | ''>(item.unitPrice);
  const [restockNotes, setRestockNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRestock = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(addedQuantity);
    if (!qty || qty <= 0) {
      setErrorMsg('Please enter a valid quantity greater than 0.');
      return;
    }
    const price = unitPrice !== '' ? Number(unitPrice) : item.unitPrice;
    onConfirm(item.id, qty, price, restockNotes);
  };

  const newTotalStock = item.quantityInStock + (Number(addedQuantity) || 0);
  const newRemaining = item.quantityRemaining + (Number(addedQuantity) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gradient-to-b from-[#24084d] via-[#1a0538] to-[#120228] text-white rounded-2xl shadow-2xl max-w-md w-full border-2 border-violet-500/50 overflow-hidden my-auto">
        <div className="px-5 py-4 bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 border-b-2 border-violet-500/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm">
              <PackagePlus className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-black text-sm sm:text-base text-white">
                Restock Inventory
              </h3>
              <p className="text-xs text-purple-100 font-medium">
                Receive new batch from publisher or printer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-violet-900/80 hover:bg-violet-800 text-white transition cursor-pointer border border-violet-400/30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleRestock} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-500/30 border-2 border-rose-400 rounded-xl text-white font-bold flex items-center gap-2 shadow-md">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ITEM SUMMARY CONTAINER */}
          <div className="p-3.5 bg-gradient-to-r from-[#260850] to-[#1c063d] border-2 border-violet-500/40 rounded-xl space-y-1.5 shadow-md">
            <div className="text-[10px] uppercase font-black text-amber-300 tracking-wider">
              {item.category}
            </div>
            <div className="font-black text-white text-sm">{item.title}</div>
            <div className="text-purple-200 text-xs font-medium">
              {item.publication} • {item.subjectType}
            </div>
            <div className="pt-2.5 grid grid-cols-3 gap-2 text-center text-xs border-t border-violet-500/30 mt-2">
              <div>
                <span className="block text-purple-200 text-[10px] font-bold uppercase">Total Stock</span>
                <span className="font-mono font-black text-white text-sm">{item.quantityInStock}</span>
              </div>
              <div>
                <span className="block text-purple-200 text-[10px] font-bold uppercase">Total Sold</span>
                <span className="font-mono font-black text-emerald-300 text-sm">{item.quantitySold}</span>
              </div>
              <div>
                <span className="block text-purple-200 text-[10px] font-bold uppercase">Remaining</span>
                <span className="font-mono font-black text-amber-300 text-sm">{item.quantityRemaining}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-white font-bold mb-1.5 text-xs">
              Quantity to Add to Stock *
            </label>
            <input
              type="number"
              min="1"
              required
              autoFocus
              value={addedQuantity}
              onChange={(e) => setAddedQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 50"
              className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono font-black text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>

          <div className="p-3 rounded-xl bg-gradient-to-r from-violet-950 to-purple-900 border-2 border-violet-400/50 flex items-center justify-between text-xs shadow-md">
            <span className="text-white font-bold">Updated Remaining Stock:</span>
            <span className="font-mono font-black text-amber-300 text-sm">
              {newRemaining} Copies
            </span>
          </div>

          <div>
            <label className="block text-white font-bold mb-1.5 text-xs">
              Selling Price per Unit (GH₵)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-white font-bold mb-1.5 text-xs">
              Supply Batch / Delivery Note
            </label>
            <input
              type="text"
              value={restockNotes}
              onChange={(e) => setRestockNotes(e.target.value)}
              placeholder="e.g. New delivery batch invoice #8921"
              className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
            />
          </div>

          <div className="pt-3 border-t border-violet-500/30 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-violet-900/80 hover:bg-violet-800 text-white font-bold rounded-xl transition cursor-pointer border border-violet-400/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-950/50 cursor-pointer border border-emerald-400/40 uppercase tracking-wider"
            >
              <PackagePlus className="w-4 h-4" />
              <span>Confirm Restock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
