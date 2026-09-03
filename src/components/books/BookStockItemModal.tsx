/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookStockItem, BookStockCategory } from '../../types';
import { X, BookOpen, Save, Layers, AlertCircle, Building2, Bookmark, GraduationCap } from 'lucide-react';

interface BookStockItemModalProps {
  initialItem?: BookStockItem | null;
  onSave: (item: BookStockItem) => void;
  onClose: () => void;
  categories: BookStockCategory[];
}

const COMMON_PUBLICATIONS = [
  'Aki-Ola Publications',
  'Approachers Series',
  'Alpha & Omega',
  'Pearson Ghana',
  'Winmat Publishers',
  'Sedco Publishing',
  'Excellence Publications',
  'Afram Publications',
  'Sam-Woode Ltd',
  'Eastfield Academy Press / Crest Edition',
  'Adwinsa Publications',
  'Kingdom Books'
];

const COMMON_SUBJECTS = [
  'Mathematics',
  'English Language',
  'Integrated Science / Science',
  'Social Studies',
  'Computing / ICT',
  'Religious and Moral Education (RME)',
  'Akuapem Twi',
  'Asante Twi',
  'Fante',
  'Ga',
  'French',
  'Creative Arts & Design',
  'Career Technology',
  'General / Writing',
  'General / Notes',
  'Phonics & Literacy',
  'Mental Math / Drills'
];

const COMMON_CLASSES = [
  'All Classes',
  'Nursery 1 & 2',
  'Kindergarten 1 & 2',
  'Primary 1 - Primary 3 (Lower Primary)',
  'Primary 4 - Primary 6 (Upper Primary)',
  'Primary 1 - Primary 6',
  'JHS 1',
  'JHS 2',
  'JHS 3',
  'JHS 1 - JHS 3 (All JHS)'
];

export default function BookStockItemModal({
  initialItem,
  onSave,
  onClose,
  categories
}: BookStockItemModalProps) {
  const isEditing = Boolean(initialItem);

  const [category, setCategory] = useState<BookStockCategory>(
    initialItem?.category || 'Textbook'
  );
  const [title, setTitle] = useState(initialItem?.title || '');
  const [publication, setPublication] = useState(
    initialItem?.publication || (category.includes('Customised') ? 'Eastfield Academy Press / Crest Edition' : '')
  );
  const [subjectType, setSubjectType] = useState(initialItem?.subjectType || '');
  const [targetClass, setTargetClass] = useState(initialItem?.targetClass || 'All Classes');
  const [unitPrice, setUnitPrice] = useState<number | ''>(
    initialItem?.unitPrice !== undefined ? initialItem.unitPrice : 15
  );
  const [costPrice, setCostPrice] = useState<number | ''>(
    initialItem?.costPrice !== undefined ? initialItem.costPrice : ''
  );
  const [quantityInStock, setQuantityInStock] = useState<number | ''>(
    initialItem?.quantityInStock !== undefined ? initialItem.quantityInStock : 100
  );
  const [quantitySold, setQuantitySold] = useState<number | ''>(
    initialItem?.quantitySold !== undefined ? initialItem.quantitySold : 0
  );
  const [lowStockThreshold, setLowStockThreshold] = useState<number | ''>(
    initialItem?.lowStockThreshold !== undefined ? initialItem.lowStockThreshold : 15
  );
  const [shelfLocation, setShelfLocation] = useState(initialItem?.shelfLocation || '');
  const [notes, setNotes] = useState(initialItem?.notes || '');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCategoryChange = (newCat: BookStockCategory) => {
    setCategory(newCat);
    if (!publication || publication.includes('Crest') || publication.includes('Eastfield') || publication.includes('Aki-Ola')) {
      if (newCat === 'Customised Exercise Book' || newCat === 'Customised Textbook') {
        setPublication('Eastfield Academy Press / Crest Edition');
      } else if (!publication || publication.includes('Eastfield')) {
        setPublication('Aki-Ola Publications');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title.trim()) {
      setErrorMsg('Please enter the book or exercise book title.');
      return;
    }
    if (!publication.trim()) {
      setErrorMsg('Please specify the publication or publisher name.');
      return;
    }
    if (!subjectType.trim()) {
      setErrorMsg('Please specify the subject or type (e.g. Mathematics, English, General Writing).');
      return;
    }
    const qInStock = Number(quantityInStock);
    const qSold = Number(quantitySold) || 0;
    const price = Number(unitPrice);

    if (isNaN(qInStock) || qInStock < 0) {
      setErrorMsg('Total quantity in stock must be a non-negative number.');
      return;
    }
    if (isNaN(price) || price < 0) {
      setErrorMsg('Selling price must be 0 or greater.');
      return;
    }
    if (qSold > qInStock) {
      setErrorMsg('Quantity sold cannot exceed total stock quantity recorded.');
      return;
    }

    const qRemaining = qInStock - qSold;

    const item: BookStockItem = {
      id: initialItem?.id || `bk-${Date.now()}`,
      title: title.trim(),
      category,
      publication: publication.trim(),
      subjectType: subjectType.trim(),
      targetClass: targetClass.trim() || 'All Classes',
      unitPrice: price,
      costPrice: costPrice !== '' ? Number(costPrice) : undefined,
      quantityInStock: qInStock,
      quantitySold: qSold,
      quantityRemaining: qRemaining,
      lowStockThreshold: Number(lowStockThreshold) || 15,
      shelfLocation: shelfLocation.trim(),
      notes: notes.trim(),
      createdAt: initialItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(item);
  };

  const currentRemaining =
    Number(quantityInStock || 0) - Number(quantitySold || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-gradient-to-b from-[#24084d] via-[#1a0538] to-[#120228] text-white rounded-2xl shadow-2xl max-w-2xl w-full border-2 border-violet-500/50 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* HEADER */}
        <div className="px-5 py-4 bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 border-b-2 border-violet-500/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-400/40 shadow-sm">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">
                {isEditing ? 'Edit Book Stock Record' : 'Record New Book / Exercise Book Stock'}
              </h3>
              <p className="text-xs text-purple-100 font-medium">
                Maintain publications, subjects, inventory balances, and selling prices
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-violet-900/80 hover:bg-violet-800 text-white transition cursor-pointer border border-violet-400/30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-500/30 border-2 border-rose-400 rounded-xl text-white font-bold flex items-center gap-2 shadow-md">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* CATEGORY SELECTOR */}
          <div>
            <label className="block text-white font-bold mb-1.5 flex items-center gap-1.5 text-xs">
              <Layers className="w-4 h-4 text-amber-300" />
              <span>Stock Category *</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategoryChange(cat)}
                  className={`p-2.5 rounded-xl border-2 text-center transition font-black cursor-pointer text-xs ${
                    category === cat
                      ? 'bg-amber-400 border-amber-300 text-slate-950 shadow-md'
                      : 'bg-[#14032b] border-violet-500/30 text-white hover:bg-violet-900/40'
                  }`}
                >
                  <div className="leading-tight">{cat}</div>
                </button>
              ))}
            </div>
          </div>

          {/* TITLE */}
          <div>
            <label className="block text-white font-bold mb-1.5 text-xs">
              Title / Name *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Aki-Ola Core Mathematics for JHS or Custom 40-Page Exercise Book"
              className="w-full px-3.5 py-2.5 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold shadow-sm"
            />
          </div>

          {/* PUBLICATION & SUBJECT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-white font-bold mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-300" />
                  <span>Publication / Publisher *</span>
                </span>
              </label>
              <input
                type="text"
                required
                list="publication-suggestions"
                value={publication}
                onChange={(e) => setPublication(e.target.value)}
                placeholder="e.g. Aki-Ola Publications"
                className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold shadow-sm"
              />
              <datalist id="publication-suggestions">
                {COMMON_PUBLICATIONS.map((pub) => (
                  <option key={pub} value={pub} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-white font-bold mb-1.5 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <Bookmark className="w-4 h-4 text-amber-300" />
                  <span>Type / Subject *</span>
                </span>
              </label>
              <input
                type="text"
                required
                list="subject-suggestions"
                value={subjectType}
                onChange={(e) => setSubjectType(e.target.value)}
                placeholder="e.g. Mathematics, Science, General Writing"
                className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold shadow-sm"
              />
              <datalist id="subject-suggestions">
                {COMMON_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
            </div>
          </div>

          {/* TARGET CLASS & LOCATION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-white font-bold mb-1.5 flex items-center gap-1.5 text-xs">
                <GraduationCap className="w-4 h-4 text-amber-300" />
                <span>Target Class / Form</span>
              </label>
              <input
                type="text"
                list="class-suggestions"
                value={targetClass}
                onChange={(e) => setTargetClass(e.target.value)}
                placeholder="e.g. Primary 1 - 6 or JHS 1 - 3"
                className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold shadow-sm"
              />
              <datalist id="class-suggestions">
                {COMMON_CLASSES.map((cls) => (
                  <option key={cls} value={cls} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-white font-bold mb-1.5 text-xs">
                Storage / Shelf Location
              </label>
              <input
                type="text"
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                placeholder="e.g. Shelf A-1, Store Bay 2"
                className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold shadow-sm"
              />
            </div>
          </div>

          {/* QUANTITIES & PRICING (VIOLET CONTAINER WITH BRIGHT TEXT) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#260850] to-[#1c063d] border-2 border-violet-500/40 space-y-3.5 shadow-md">
            <h4 className="font-black text-amber-300 text-xs uppercase tracking-wider">
              Stock Counts & Pricing
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Total in Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={quantityInStock}
                  onChange={(e) => setQuantityInStock(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono text-center font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Total Sold
                </label>
                <input
                  type="number"
                  min="0"
                  value={quantitySold}
                  onChange={(e) => setQuantitySold(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono text-center font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Remaining Stock
                </label>
                <div className={`w-full px-3 py-2 bg-white border-2 rounded-xl font-mono text-center font-black ${
                  currentRemaining <= 0
                    ? 'border-rose-400 text-rose-600'
                    : currentRemaining <= (Number(lowStockThreshold) || 15)
                    ? 'border-amber-400 text-amber-600'
                    : 'border-slate-300 text-blue-700'
                }`}>
                  {currentRemaining}
                </div>
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Low Stock Alert
                </label>
                <input
                  type="number"
                  min="1"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono text-center font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-violet-500/30">
              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Selling Price per Unit (GH₵) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Cost Price per Unit (GH₵) <span className="text-purple-200 font-normal">(Optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. Publisher supply cost"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* NOTES */}
          <div>
            <label className="block text-white font-bold mb-1.5 text-xs">
              Remarks / Description / Curriculum Reference
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. NaCCA approved curriculum edition, 2026 revised syllabus"
              className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none font-bold shadow-sm"
            />
          </div>

          {/* FOOTER ACTIONS */}
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
              className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-black rounded-xl transition flex items-center gap-2 shadow-lg shadow-violet-950/50 cursor-pointer border border-violet-400/40 uppercase tracking-wider text-xs"
            >
              <Save className="w-4 h-4 text-white" />
              <span>{isEditing ? 'Update Stock Item' : 'Save To Stock Register'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
