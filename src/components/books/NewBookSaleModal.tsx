/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookStockItem, BookSaleRecord, BookSaleItem, Student } from '../../types';
import { X, ShoppingCart, Plus, Trash2, AlertCircle, CheckCircle2, User, Search, BookOpen, CreditCard } from 'lucide-react';

interface NewBookSaleModalProps {
  stockItems: BookStockItem[];
  students: Student[];
  preSelectedBookId?: string;
  onCompleteSale: (sale: BookSaleRecord, updatedStock: BookStockItem[]) => void;
  onClose: () => void;
}

export default function NewBookSaleModal({
  stockItems,
  students,
  preSelectedBookId,
  onCompleteSale,
  onClose
}: NewBookSaleModalProps) {
  // Buyer information
  const [buyerType, setBuyerType] = useState<'Parent' | 'Student' | 'Teacher' | 'Walk-in'>('Parent');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [className, setClassName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  // Cart items
  const [cartItems, setCartItems] = useState<BookSaleItem[]>(() => {
    if (preSelectedBookId) {
      const found = stockItems.find((b) => b.id === preSelectedBookId);
      if (found && found.quantityRemaining > 0) {
        return [
          {
            bookId: found.id,
            title: found.title,
            category: found.category,
            publication: found.publication,
            subjectType: found.subjectType,
            quantity: 1,
            unitPrice: found.unitPrice,
            totalPrice: found.unitPrice
          }
        ];
      }
    }
    return [];
  });

  // Adding single book to cart
  const [selectedBookId, setSelectedBookId] = useState(
    preSelectedBookId || (stockItems.length > 0 ? stockItems[0].id : '')
  );
  const [itemQuantity, setItemQuantity] = useState<number | ''>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<number | ''>(() => {
    const b = stockItems.find((item) => item.id === (preSelectedBookId || stockItems[0]?.id));
    return b ? b.unitPrice : 15;
  });

  // Payment details
  const [discount, setDiscount] = useState<number | ''>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Cheque' | 'Card'>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saleTime, setSaleTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [remarks, setRemarks] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // When selected student changes
  const handleStudentSelect = (stId: string) => {
    setSelectedStudentId(stId);
    if (!stId) return;
    const st = students.find((s) => s.id === stId);
    if (st) {
      if (buyerType === 'Parent') {
        setBuyerName(st.guardianName || `${st.name}'s Guardian`);
      } else {
        setBuyerName(st.name);
      }
      setClassName(st.className);
      setContactNumber(st.guardianPhone || '');
    }
  };

  // When selected book to add changes
  const handleBookSelectionChange = (bookId: string) => {
    setSelectedBookId(bookId);
    const book = stockItems.find((b) => b.id === bookId);
    if (book) {
      setItemUnitPrice(book.unitPrice);
      setItemQuantity(1);
    }
  };

  // Add item to cart
  const handleAddToCart = () => {
    setErrorMsg('');
    const book = stockItems.find((b) => b.id === selectedBookId);
    if (!book) {
      setErrorMsg('Please select a book from inventory.');
      return;
    }

    const qty = Number(itemQuantity);
    const price = Number(itemUnitPrice);

    if (!qty || qty <= 0) {
      setErrorMsg('Please specify a valid quantity greater than 0.');
      return;
    }
    if (isNaN(price) || price < 0) {
      setErrorMsg('Please specify a valid price.');
      return;
    }

    // Check stock limit including already added in cart
    const alreadyInCart = cartItems.find((ci) => ci.bookId === book.id);
    const totalQtyRequested = (alreadyInCart ? alreadyInCart.quantity : 0) + qty;

    if (totalQtyRequested > book.quantityRemaining) {
      setErrorMsg(
        `Insufficient stock for "${book.title}". Available: ${book.quantityRemaining} copies (Already in cart: ${alreadyInCart?.quantity || 0}).`
      );
      return;
    }

    if (alreadyInCart) {
      setCartItems((prev) =>
        prev.map((ci) => {
          if (ci.bookId === book.id) {
            const newQ = ci.quantity + qty;
            return {
              ...ci,
              quantity: newQ,
              unitPrice: price,
              totalPrice: newQ * price
            };
          }
          return ci;
        })
      );
    } else {
      const newItem: BookSaleItem = {
        bookId: book.id,
        title: book.title,
        category: book.category,
        publication: book.publication,
        subjectType: book.subjectType,
        quantity: qty,
        unitPrice: price,
        totalPrice: qty * price
      };
      setCartItems((prev) => [...prev, newItem]);
    }

    // Reset single item quantity to 1
    setItemQuantity(1);
  };

  const handleRemoveCartItem = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Subtotal & Grand Total computation
  const subtotal = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountVal = Number(discount) || 0;
  const grandTotal = Math.max(0, subtotal - discountVal);

  // Filter students for search
  const filteredStudents = students.filter(
    (st) =>
      st.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
      st.rollNumber.toLowerCase().includes(studentSearchTerm.toLowerCase()) ||
      st.className.toLowerCase().includes(studentSearchTerm.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!buyerName.trim()) {
      setErrorMsg('Please enter the buyer name or student/parent name.');
      return;
    }
    if (cartItems.length === 0) {
      setErrorMsg('Please add at least one book or exercise book to the sale.');
      return;
    }

    // Verify stock availability once more
    for (const ci of cartItems) {
      const stock = stockItems.find((b) => b.id === ci.bookId);
      if (!stock || stock.quantityRemaining < ci.quantity) {
        setErrorMsg(
          `Stock balance error: "${ci.title}" only has ${stock?.quantityRemaining ?? 0} available.`
        );
        return;
      }
    }

    // Generate receipt number
    const timestamp = Date.now().toString().slice(-4);
    const receiptNumber = `BK-${new Date().getFullYear()}-${timestamp}`;

    const newSale: BookSaleRecord = {
      id: `sale-${Date.now()}`,
      receiptNumber,
      buyerName: buyerName.trim(),
      buyerType,
      studentId: selectedStudentId || undefined,
      className: className.trim() || undefined,
      contactNumber: contactNumber.trim() || undefined,
      items: cartItems,
      subtotal,
      discount: discountVal,
      totalAmount: grandTotal,
      paymentMethod,
      paymentReference: paymentReference.trim() || undefined,
      saleDate,
      saleTime,
      recordedBy: 'Administrator',
      remarks: remarks.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    // Update stock items: increment quantitySold and decrement quantityRemaining
    const updatedStock = stockItems.map((stock) => {
      const boughtItem = cartItems.find((ci) => ci.bookId === stock.id);
      if (boughtItem) {
        const newSold = stock.quantitySold + boughtItem.quantity;
        const newRemaining = Math.max(0, stock.quantityInStock - newSold);
        return {
          ...stock,
          quantitySold: newSold,
          quantityRemaining: newRemaining,
          updatedAt: new Date().toISOString()
        };
      }
      return stock;
    });

    onCompleteSale(newSale, updatedStock);
  };

  const currentBook = stockItems.find((b) => b.id === selectedBookId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-gradient-to-b from-[#24084d] via-[#1a0538] to-[#120228] text-white rounded-2xl shadow-2xl max-w-3xl w-full border-2 border-violet-500/50 overflow-hidden my-auto max-h-[96vh] flex flex-col">
        {/* MODAL HEADER */}
        <div className="px-5 py-4 bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 border-b-2 border-violet-500/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm">
              <ShoppingCart className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-base sm:text-lg text-white">
                Record Book / Exercise Book Sale & Generate Receipt
              </h3>
              <p className="text-xs text-purple-100 font-medium">
                Point of Sale cashier counter with instant stock deduction
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

        {/* BODY */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-500/30 border-2 border-rose-400 rounded-xl text-white font-bold flex items-center gap-2 shadow-md">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. BUYER DETAILS SECTION (VIOLET CONTAINER WITH BRIGHT TEXT) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#260850] to-[#1c063d] border-2 border-violet-500/40 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                <User className="w-4 h-4 text-amber-300" />
                <span>Buyer Information</span>
              </h4>
              <div className="flex gap-1.5">
                {(['Parent', 'Student', 'Teacher', 'Walk-in'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setBuyerType(type)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                      buyerType === type
                        ? 'bg-amber-400 text-slate-950 shadow border border-amber-300'
                        : 'bg-violet-950 text-white hover:bg-violet-900 border border-violet-500/30 font-bold'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* QUICK STUDENT LOOKUP */}
            {(buyerType === 'Parent' || buyerType === 'Student') && (
              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Optional: Link to Enrolled Student
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-purple-300" />
                    <input
                      type="text"
                      placeholder="Search enrolled student by name, roll no, or class..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-[#14032b] border-2 border-violet-500/40 rounded-xl text-white placeholder:text-purple-200/50 text-xs font-medium focus:outline-none focus:border-violet-300 shadow-inner"
                    />
                  </div>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => handleStudentSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-violet-400 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm cursor-pointer"
                  >
                    <option value="">-- Select Student ({filteredStudents.length} available) --</option>
                    {filteredStudents.slice(0, 30).map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.className} - {st.rollNumber})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Buyer Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="e.g. Charles Osei / Abena Osei"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Class / Grade
                </label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Primary 4 or JHS 2"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Buyer Phone / Contact No.
                </label>
                <input
                  type="text"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +233 24 123 4567"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* 2. ADD BOOKS TO SALE CART (VIOLET CONTAINER WITH BRIGHT TEXT) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#260850] to-[#1c063d] border-2 border-violet-500/40 space-y-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
                <BookOpen className="w-4 h-4 text-amber-300" />
                <span>Select Books / Customized Exercise Books To Sell</span>
              </h4>
              {currentBook && (
                <div className="text-xs text-white flex items-center gap-1.5">
                  <span className="font-bold">Stock Remaining:</span>
                  <span className={`font-mono font-black px-2.5 py-0.5 rounded-lg text-xs ${
                    currentBook.quantityRemaining <= 0
                      ? 'bg-rose-500/40 text-rose-100 border border-rose-400'
                      : currentBook.quantityRemaining <= currentBook.lowStockThreshold
                      ? 'bg-amber-500/40 text-amber-100 border border-amber-300'
                      : 'bg-emerald-500/40 text-emerald-100 border border-emerald-400'
                  }`}>
                    {currentBook.quantityRemaining} copies
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-6">
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Choose Book from Stock
                </label>
                <select
                  value={selectedBookId}
                  onChange={(e) => handleBookSelectionChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-bold shadow-sm cursor-pointer"
                >
                  {stockItems.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.quantityRemaining <= 0}>
                      {b.title} — {b.publication} ({b.subjectType}) [Avail: {b.quantityRemaining}] - GH₵{b.unitPrice.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max={currentBook ? currentBook.quantityRemaining : 9999}
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2.5 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono text-center font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Unit Price (GH₵)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={itemUnitPrice}
                  onChange={(e) => setItemUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-2.5 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono text-center font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!currentBook || currentBook.quantityRemaining <= 0}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-slate-950 font-black rounded-xl transition flex items-center justify-center gap-1 cursor-pointer shadow-md border border-amber-300 uppercase tracking-wider text-xs"
                >
                  <Plus className="w-4 h-4 text-slate-950" />
                  <span>Add Item</span>
                </button>
              </div>
            </div>

            {/* CART ITEMS TABLE (VIOLET CONTAINER WITH BRIGHT TEXT) */}
            {cartItems.length > 0 ? (
              <div className="border-2 border-violet-500/40 rounded-xl overflow-hidden mt-3 bg-[#14032b] shadow-inner">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gradient-to-r from-violet-950 to-purple-900 text-white font-black uppercase text-[11px] tracking-wider border-b border-violet-500/40">
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-2">Publication / Subject</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-right">Unit Price</th>
                      <th className="py-2.5 px-2 text-right">Total</th>
                      <th className="py-2.5 px-2 text-center w-10">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-violet-500/20">
                    {cartItems.map((ci, idx) => (
                      <tr key={idx} className="hover:bg-violet-600/10">
                        <td className="py-2.5 px-3">
                          <div className="font-black text-white text-xs">{ci.title}</div>
                          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-violet-800 text-white font-bold border border-violet-400/40">
                            {ci.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-purple-100 text-xs font-medium">
                          {ci.publication} • {ci.subjectType}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-black text-white text-xs">
                          {ci.quantity}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-bold text-purple-100">
                          GH₵ {ci.unitPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-black text-amber-300 text-xs">
                          GH₵ {ci.totalPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(idx)}
                            className="p-1.5 rounded-lg bg-rose-500/30 hover:bg-rose-500 text-white transition cursor-pointer border border-rose-400/40"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-5 bg-[#14032b] rounded-xl border-2 border-dashed border-violet-500/30 text-purple-100 font-medium text-xs">
                No items added to cart yet. Select a textbook or exercise book above and click &quot;Add Item&quot;.
              </div>
            )}
          </div>

          {/* 3. PAYMENT DETAILS & COMPUTATION (VIOLET CONTAINER WITH BRIGHT TEXT) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#260850] to-[#1c063d] border-2 border-violet-500/40 space-y-3.5 shadow-md">
            <h4 className="font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5 text-xs">
              <CreditCard className="w-4 h-4 text-amber-300" />
              <span>Payment & Receipt Details</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Payment Method *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-violet-400 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-violet-400 text-xs shadow-sm cursor-pointer"
                >
                  <option value="Cash">Cash</option>
                  <option value="Mobile Money">Mobile Money (MTN / Telecel / AT)</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Card">POS Card Payment</option>
                </select>
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Payment Reference / MoMo Ref
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. MM-4829381 or Cheque #004"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Discount (GH₵)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Sale Date & Time
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                  <input
                    type="time"
                    value={saleTime}
                    onChange={(e) => setSaleTime(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white font-bold mb-1.5 text-xs">
                  Remarks / Receipt Note
                </label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Complete term starter pack"
                  className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-xl text-blue-700 placeholder:text-slate-400 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>

            {/* SUMMARY NUMBERS BOX (VIOLET HIGHLIGHT CONTAINER WITH BRIGHT TEXT) */}
            <div className="p-4 bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 rounded-xl border-2 border-violet-400/50 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div>
                <span className="block text-[10px] text-white font-black uppercase tracking-wider">Total Items:</span>
                <span className="font-mono font-black text-white text-sm">
                  {cartItems.reduce((sum, item) => sum + item.quantity, 0)} Copies
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-white font-black uppercase tracking-wider">Subtotal:</span>
                <span className="font-mono font-black text-white text-sm">GH₵ {subtotal.toFixed(2)}</span>
              </div>
              {discountVal > 0 && (
                <div>
                  <span className="block text-[10px] text-rose-300 font-black uppercase tracking-wider">Discount:</span>
                  <span className="font-mono font-black text-rose-200 text-sm">- GH₵ {discountVal.toFixed(2)}</span>
                </div>
              )}
              <div className="text-right">
                <span className="block text-xs text-amber-300 font-black uppercase tracking-wider">Total Amount to Pay:</span>
                <span className="font-mono font-black text-amber-300 text-lg sm:text-xl">
                  GH₵ {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
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
              disabled={cartItems.length === 0}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer text-sm border border-emerald-400/40 uppercase tracking-wider"
              id="confirm-record-sale-btn"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>Record Sale & Issue Receipt</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
