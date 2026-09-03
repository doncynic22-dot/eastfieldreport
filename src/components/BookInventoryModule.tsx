/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  BookStockItem,
  BookSaleRecord,
  BookStockCategory,
  Student,
  ReportConfig
} from '../types';
import {
  fetchSupabaseBookStock,
  saveSupabaseBookStock,
  deleteSupabaseBookStockItem,
  fetchSupabaseBookSales,
  saveSupabaseBookSales,
  deleteSupabaseBookSale
} from '../lib/supabase';
import BookReceiptModal from './books/BookReceiptModal';
import BookStockItemModal from './books/BookStockItemModal';
import RestockModal from './books/RestockModal';
import NewBookSaleModal from './books/NewBookSaleModal';
import InventoryPerformanceChart from './books/InventoryPerformanceChart';
import {
  BookOpen,
  Plus,
  ShoppingCart,
  Receipt,
  Search,
  Filter,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  PackageCheck,
  Building2,
  Trash2,
  Edit,
  PackagePlus,
  ArrowUpDown,
  FileSpreadsheet,
  Coins,
  DollarSign,
  TrendingUp,
  RefreshCw,
  Library,
  BarChart3,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';

interface BookInventoryModuleProps {
  students: Student[];
  config: ReportConfig;
}

type SubTab = 'inventory' | 'sales_ledger' | 'visual_analytics';

export default function BookInventoryModule({
  students,
  config
}: BookInventoryModuleProps) {
  // State
  const [stockItems, setStockItems] = useState<BookStockItem[]>([]);
  const [salesRecords, setSalesRecords] = useState<BookSaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('inventory');
  const [showChartInInventory, setShowChartInInventory] = useState(true);

  // Filters for Stock
  const [categoryFilter, setCategoryFilter] = useState<'All' | BookStockCategory>('All');
  const [stockSearchTerm, setStockSearchTerm] = useState('');
  const [publicationFilter, setPublicationFilter] = useState<string>('All');
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Filters for Sales Ledger
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedSaleDate, setSelectedSaleDate] = useState<string>(todayStr);
  const [salesSearchTerm, setSalesSearchTerm] = useState('');
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('All');

  // Modals state
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BookStockItem | null>(null);

  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockItem, setRestockItem] = useState<BookStockItem | null>(null);

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [preSelectedBookId, setPreSelectedBookId] = useState<string | undefined>(undefined);

  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptSale, setReceiptSale] = useState<BookSaleRecord | null>(null);

  // Deletion modal state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'stock' | 'sale';
    id: string;
    title: string;
  } | null>(null);

  // Instant notification toast state
  const [toastNotification, setToastNotification] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Load initial data from Supabase / localStorage
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [stocks, sales] = await Promise.all([
        fetchSupabaseBookStock(),
        fetchSupabaseBookSales()
      ]);
      setStockItems(stocks);
      setSalesRecords(sales);
    } catch (e) {
      console.warn('Error loading book stock/sales:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for updates from other tabs
    const handleStockUpdate = () => {
      fetchSupabaseBookStock().then(setStockItems).catch(() => {});
    };
    const handleSalesUpdate = () => {
      fetchSupabaseBookSales().then(setSalesRecords).catch(() => {});
    };

    window.addEventListener('ea_book_stock_updated', handleStockUpdate);
    window.addEventListener('ea_book_sales_updated', handleSalesUpdate);

    return () => {
      window.removeEventListener('ea_book_stock_updated', handleStockUpdate);
      window.removeEventListener('ea_book_sales_updated', handleSalesUpdate);
    };
  }, []);

  // Compute metric summaries
  const metrics = useMemo(() => {
    // Textbooks
    const textbooks = stockItems.filter((b) => b.category === 'Textbook');
    const tbTotalStock = textbooks.reduce((sum, b) => sum + b.quantityInStock, 0);
    const tbTotalSold = textbooks.reduce((sum, b) => sum + b.quantitySold, 0);
    const tbTotalRemaining = textbooks.reduce((sum, b) => sum + b.quantityRemaining, 0);

    // Customised Exercise Books
    const exerciseBooks = stockItems.filter((b) => b.category === 'Customised Exercise Book');
    const ebTotalStock = exerciseBooks.reduce((sum, b) => sum + b.quantityInStock, 0);
    const ebTotalSold = exerciseBooks.reduce((sum, b) => sum + b.quantitySold, 0);
    const ebTotalRemaining = exerciseBooks.reduce((sum, b) => sum + b.quantityRemaining, 0);

    // Customised Textbooks
    const customTextbooks = stockItems.filter((b) => b.category === 'Customised Textbook');
    const ctbTotalStock = customTextbooks.reduce((sum, b) => sum + b.quantityInStock, 0);
    const ctbTotalSold = customTextbooks.reduce((sum, b) => sum + b.quantitySold, 0);
    const ctbTotalRemaining = customTextbooks.reduce((sum, b) => sum + b.quantityRemaining, 0);

    // Today's sales
    const todaySales = salesRecords.filter((s) => s.saleDate === todayStr);
    const todayTotalAmount = todaySales.reduce((sum, s) => sum + s.totalAmount, 0);
    const todayCopiesSold = todaySales.reduce(
      (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.quantity, 0),
      0
    );

    // All-time sales revenue
    const allTimeRevenue = salesRecords.reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      tbTotalStock,
      tbTotalSold,
      tbTotalRemaining,
      ebTotalStock,
      ebTotalSold,
      ebTotalRemaining,
      ctbTotalStock,
      ctbTotalSold,
      ctbTotalRemaining,
      todayTotalAmount,
      todayCopiesSold,
      todaySalesCount: todaySales.length,
      allTimeRevenue
    };
  }, [stockItems, salesRecords, todayStr]);

  // Unique publications & subjects for filters
  const uniquePublications = useMemo(() => {
    const pubs = new Set<string>();
    stockItems.forEach((b) => {
      if (b.publication) pubs.add(b.publication.trim());
    });
    return Array.from(pubs).sort();
  }, [stockItems]);

  const uniqueSubjects = useMemo(() => {
    const subs = new Set<string>();
    stockItems.forEach((b) => {
      if (b.subjectType) subs.add(b.subjectType.trim());
    });
    return Array.from(subs).sort();
  }, [stockItems]);

  // Filtered Stock Items
  const filteredStockItems = useMemo(() => {
    return stockItems.filter((item) => {
      if (categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (publicationFilter !== 'All' && item.publication !== publicationFilter) return false;
      if (subjectFilter !== 'All' && item.subjectType !== subjectFilter) return false;
      if (onlyLowStock && item.quantityRemaining > item.lowStockThreshold) return false;

      if (stockSearchTerm.trim()) {
        const q = stockSearchTerm.toLowerCase();
        const matches =
          item.title.toLowerCase().includes(q) ||
          item.publication.toLowerCase().includes(q) ||
          item.subjectType.toLowerCase().includes(q) ||
          item.targetClass.toLowerCase().includes(q) ||
          (item.shelfLocation && item.shelfLocation.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [stockItems, categoryFilter, publicationFilter, subjectFilter, onlyLowStock, stockSearchTerm]);

  // Filtered Sales for Selected Date / Search
  const filteredSalesRecords = useMemo(() => {
    return salesRecords.filter((sale) => {
      if (selectedSaleDate && sale.saleDate !== selectedSaleDate) return false;
      if (salesPaymentFilter !== 'All' && sale.paymentMethod !== salesPaymentFilter) return false;

      if (salesSearchTerm.trim()) {
        const q = salesSearchTerm.toLowerCase();
        const matches =
          sale.receiptNumber.toLowerCase().includes(q) ||
          sale.buyerName.toLowerCase().includes(q) ||
          (sale.className && sale.className.toLowerCase().includes(q)) ||
          (sale.contactNumber && sale.contactNumber.toLowerCase().includes(q)) ||
          (sale.paymentReference && sale.paymentReference.toLowerCase().includes(q)) ||
          sale.items.some(
            (i) =>
              i.title.toLowerCase().includes(q) ||
              i.publication.toLowerCase().includes(q) ||
              i.subjectType.toLowerCase().includes(q)
          );
        if (!matches) return false;
      }

      return true;
    });
  }, [salesRecords, selectedSaleDate, salesPaymentFilter, salesSearchTerm]);

  // Daily summary for selected date in sales ledger
  const selectedDateStats = useMemo(() => {
    const totalAmount = filteredSalesRecords.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCopies = filteredSalesRecords.reduce(
      (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.quantity, 0),
      0
    );
    const cashTotal = filteredSalesRecords
      .filter((s) => s.paymentMethod === 'Cash')
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const momoTotal = filteredSalesRecords
      .filter((s) => s.paymentMethod === 'Mobile Money')
      .reduce((sum, s) => sum + s.totalAmount, 0);
    const bankTotal = filteredSalesRecords
      .filter((s) => s.paymentMethod === 'Bank Transfer' || s.paymentMethod === 'Cheque' || s.paymentMethod === 'Card')
      .reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      totalAmount,
      totalCopies,
      receiptsCount: filteredSalesRecords.length,
      cashTotal,
      momoTotal,
      bankTotal
    };
  }, [filteredSalesRecords]);

  // Handlers
  const handleSaveStockItem = async (item: BookStockItem) => {
    setIsSaving(true);
    try {
      let updated: BookStockItem[];
      const exists = stockItems.some((b) => b.id === item.id);
      if (exists) {
        updated = stockItems.map((b) => (b.id === item.id ? item : b));
      } else {
        updated = [item, ...stockItems];
      }
      setStockItems(updated);
      await saveSupabaseBookStock(updated);
      setShowStockModal(false);
      setEditingItem(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestockConfirm = async (
    itemId: string,
    addedQty: number,
    updatedPrice?: number,
    notes?: string
  ) => {
    setIsSaving(true);
    try {
      const updated = stockItems.map((b) => {
        if (b.id === itemId) {
          const newInStock = b.quantityInStock + addedQty;
          const newRemaining = Math.max(0, newInStock - b.quantitySold);
          return {
            ...b,
            quantityInStock: newInStock,
            quantityRemaining: newRemaining,
            unitPrice: updatedPrice !== undefined ? updatedPrice : b.unitPrice,
            notes: notes ? `${b.notes ? b.notes + ' | ' : ''}Restocked +${addedQty} (${notes})` : b.notes,
            updatedAt: new Date().toISOString()
          };
        }
        return b;
      });

      setStockItems(updated);
      await saveSupabaseBookStock(updated);
      setShowRestockModal(false);
      setRestockItem(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaleCompleted = async (newSale: BookSaleRecord, updatedStock: BookStockItem[]) => {
    setIsSaving(true);
    try {
      const newSalesList = [newSale, ...salesRecords];
      setSalesRecords(newSalesList);
      setStockItems(updatedStock);

      await Promise.all([
        saveSupabaseBookSales(newSalesList),
        saveSupabaseBookStock(updatedStock)
      ]);

      setShowSaleModal(false);
      setPreSelectedBookId(undefined);

      // Instantly pop up the official receipt preview for the buyer!
      setReceiptSale(newSale);
      setShowReceiptModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteConfirmation) return;
    const target = { ...deleteConfirmation };
    // Close modal INSTANTLY so user is not blocked or experiencing lag
    setDeleteConfirmation(null);
    setIsSaving(true);
    try {
      if (target.type === 'stock') {
        setStockItems((prev) => prev.filter((b) => b.id !== target.id));
        setToastNotification({
          type: 'success',
          message: `Stock record "${target.title}" was deleted immediately and database synced.`
        });
        await deleteSupabaseBookStockItem(target.id);
      } else {
        setSalesRecords((prev) => prev.filter((s) => s.id !== target.id));
        setToastNotification({
          type: 'success',
          message: `Sales receipt "${target.title}" was deleted immediately and database synced.`
        });
        await deleteSupabaseBookSale(target.id);
      }
    } catch (err) {
      console.error('Delete execution error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // CSV Export for Book Stock Register
  const handleExportStockCSV = () => {
    if (stockItems.length === 0) return;
    const headers = [
      'Category',
      'Title',
      'Publication',
      'Subject/Type',
      'Target Class',
      'Unit Price (GHS)',
      'Total in Stock',
      'Quantity Sold',
      'Quantity Remaining',
      'Total Sales Revenue (GHS)',
      'Low Stock Alert Level',
      'Storage Location',
      'Notes'
    ];

    const rows = stockItems.map((b) => [
      `"${b.category}"`,
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.publication.replace(/"/g, '""')}"`,
      `"${b.subjectType.replace(/"/g, '""')}"`,
      `"${b.targetClass.replace(/"/g, '""')}"`,
      b.unitPrice.toFixed(2),
      b.quantityInStock,
      b.quantitySold,
      b.quantityRemaining,
      (b.quantitySold * b.unitPrice).toFixed(2),
      b.lowStockThreshold,
      `"${(b.shelfLocation || '').replace(/"/g, '""')}"`,
      `"${(b.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eastfield_Book_Stock_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for Sales Ledger
  const handleExportSalesCSV = () => {
    if (salesRecords.length === 0) return;
    const headers = [
      'Receipt Number',
      'Sale Date',
      'Sale Time',
      'Buyer Name',
      'Buyer Type',
      'Class/Grade',
      'Contact',
      'Books Purchased',
      'Total Copies',
      'Subtotal (GHS)',
      'Discount (GHS)',
      'Total Paid (GHS)',
      'Payment Method',
      'Reference',
      'Cashier/Recorded By',
      'Remarks'
    ];

    const rows = salesRecords.map((s) => {
      const itemsSummary = s.items.map((i) => `${i.quantity}x ${i.title} (${i.publication})`).join('; ');
      const totalCopies = s.items.reduce((acc, i) => acc + i.quantity, 0);
      return [
        `"${s.receiptNumber}"`,
        s.saleDate,
        s.saleTime || '',
        `"${s.buyerName.replace(/"/g, '""')}"`,
        s.buyerType,
        `"${(s.className || '').replace(/"/g, '""')}"`,
        `"${(s.contactNumber || '').replace(/"/g, '""')}"`,
        `"${itemsSummary.replace(/"/g, '""')}"`,
        totalCopies,
        s.subtotal.toFixed(2),
        s.discount.toFixed(2),
        s.totalAmount.toFixed(2),
        s.paymentMethod,
        `"${(s.paymentReference || '').replace(/"/g, '""')}"`,
        `"${(s.recordedBy || '').replace(/"/g, '""')}"`,
        `"${(s.remarks || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Eastfield_Book_Sales_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. TOP HEADER & ACTION BANNER */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-violet-950 via-purple-900 to-[#28074d] rounded-3xl border-2 border-violet-500/50 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 border-2 border-amber-300 flex items-center justify-center shadow-xl shrink-0">
              <Library className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Textbooks & Customised Exercise Books Stock
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/50 text-[10px] font-black uppercase tracking-wider">
                  Live Stock Ledger
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                  POS & Inventory
                </span>
              </div>
              <p className="text-xs sm:text-sm text-white font-medium mt-1 leading-relaxed">
                Track Ghanaian syllabus textbooks, school-customized exercise books, incoming deliveries, copies sold, remaining stock balances, daily revenue, and official cashier receipts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setPreSelectedBookId(undefined);
                setShowSaleModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer uppercase tracking-wider border border-emerald-400/30"
              id="header-record-sale-btn"
            >
              <ShoppingCart className="w-4 h-4 text-white" />
              <span>Record Sale (POS)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setShowStockModal(true);
              }}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer uppercase tracking-wider border border-amber-300"
              id="header-add-book-btn"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>Add Book Stock</span>
            </button>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              className="p-2.5 bg-violet-900/60 hover:bg-violet-800 text-white border border-violet-400/40 rounded-xl transition cursor-pointer shadow"
              title="Refresh stock ledger from Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* INSTANT TOAST NOTIFICATION */}
        {toastNotification && (
          <div className="mt-4 p-3 bg-emerald-950/95 border-2 border-emerald-400 text-white rounded-xl flex items-center justify-between text-xs font-bold shadow-xl animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastNotification.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastNotification(null)}
              className="text-white hover:text-emerald-200 p-1 cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 2. SUMMARY METRICS CARDS (RICH VIOLET TEXT CONTAINERS WITH BRIGHT TEXT) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-violet-500/30">
          {/* TEXTBOOKS */}
          <div className="p-4 bg-[#26084e] rounded-2xl border-2 border-violet-500/40 space-y-1.5 shadow-xl hover:border-violet-400 transition">
            <div className="flex items-center justify-between text-white text-xs font-black uppercase tracking-wider">
              <span>Textbooks Stock</span>
              <div className="p-1 rounded-lg bg-blue-500/20 text-blue-300">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {metrics.tbTotalRemaining}
              </span>
              <span className="text-xs text-white font-semibold">
                left / <strong className="text-amber-300">{metrics.tbTotalStock}</strong> in stock
              </span>
            </div>
            <div className="text-xs text-emerald-300 font-bold flex items-center gap-1">
              <span>✓ {metrics.tbTotalSold} copies sold</span>
            </div>
          </div>

          {/* CUSTOMISED EXERCISE BOOKS */}
          <div className="p-4 bg-[#26084e] rounded-2xl border-2 border-violet-500/40 space-y-1.5 shadow-xl hover:border-violet-400 transition">
            <div className="flex items-center justify-between text-white text-xs font-black uppercase tracking-wider">
              <span>Custom Exercise Books</span>
              <div className="p-1 rounded-lg bg-amber-500/20 text-amber-300">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                {metrics.ebTotalRemaining}
              </span>
              <span className="text-xs text-white font-semibold">
                left / <strong className="text-amber-300">{metrics.ebTotalStock}</strong> printed
              </span>
            </div>
            <div className="text-xs text-emerald-300 font-bold flex items-center gap-1">
              <span>✓ {metrics.ebTotalSold} copies sold</span>
            </div>
          </div>

          {/* CUSTOMISED TEXTBOOKS */}
          <div className="p-4 bg-[#26084e] rounded-2xl border-2 border-violet-500/40 space-y-1.5 shadow-xl hover:border-violet-400 transition">
            <div className="flex items-center justify-between text-white text-xs font-black uppercase tracking-wider">
              <span>Custom Textbooks</span>
              <div className="p-1 rounded-lg bg-purple-500/20 text-purple-300">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {metrics.ctbTotalRemaining}
              </span>
              <span className="text-xs text-white font-semibold">
                left / <strong className="text-amber-300">{metrics.ctbTotalStock}</strong> in stock
              </span>
            </div>
            <div className="text-xs text-emerald-300 font-bold flex items-center gap-1">
              <span>✓ {metrics.ctbTotalSold} copies sold</span>
            </div>
          </div>

          {/* TODAY'S SALES REVENUE */}
          <div className="p-4 bg-gradient-to-br from-emerald-950 via-[#142e20] to-[#250849] rounded-2xl border-2 border-emerald-500/50 space-y-1.5 shadow-xl hover:border-emerald-400 transition">
            <div className="flex items-center justify-between text-white text-xs font-black uppercase tracking-wider">
              <span>Today&apos;s Book Sales</span>
              <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-300">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-300 font-mono">
                GH₵ {metrics.todayTotalAmount.toFixed(2)}
              </span>
            </div>
            <div className="text-xs text-white font-bold">
              {metrics.todayCopiesSold} copies sold across {metrics.todaySalesCount} receipt(s)
            </div>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-violet-500/30 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('inventory')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer uppercase tracking-wider ${
              activeSubTab === 'inventory'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40 border-2 border-amber-300 ring-2 ring-amber-300'
                : 'bg-violet-950/80 text-white hover:bg-violet-800 border border-violet-500/40 shadow-sm'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Stock Register & Inventory ({stockItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('visual_analytics')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer uppercase tracking-wider ${
              activeSubTab === 'visual_analytics'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40 border-2 border-amber-300 ring-2 ring-amber-300'
                : 'bg-violet-950/80 text-white hover:bg-violet-800 border border-violet-500/40 shadow-sm'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Total Sales vs Stock Chart</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('sales_ledger')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer uppercase tracking-wider ${
              activeSubTab === 'sales_ledger'
                ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-950/40 border-2 border-amber-300 ring-2 ring-amber-300'
                : 'bg-violet-950/80 text-white hover:bg-violet-800 border border-violet-500/40 shadow-sm'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Daily Sales Ledger & Receipts ({salesRecords.length})</span>
          </button>
        </div>

        {activeSubTab === 'inventory' ? (
          <button
            type="button"
            onClick={handleExportStockCSV}
            className="px-3.5 py-2 bg-violet-900 hover:bg-violet-800 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-violet-400/40 shadow uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Stock CSV</span>
          </button>
        ) : activeSubTab === 'sales_ledger' ? (
          <button
            type="button"
            onClick={handleExportSalesCSV}
            className="px-3.5 py-2 bg-violet-900 hover:bg-violet-800 text-white font-black text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-violet-400/40 shadow uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Sales CSV</span>
          </button>
        ) : null}
      </div>

      {/* 4. TAB 1: STOCK REGISTER */}
      {activeSubTab === 'inventory' && (
        <div className="space-y-5">
          {/* TOTAL SALES VS REMAINING STOCK BAR CHART (COLLAPSIBLE) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-wider">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                <span>Total Sales vs. Remaining Stock Performance</span>
              </div>
              <button
                type="button"
                onClick={() => setShowChartInInventory(!showChartInInventory)}
                className="px-3 py-1.5 bg-violet-900 hover:bg-violet-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-violet-400/40 shadow-sm"
              >
                {showChartInInventory ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-amber-300" />
                    <span>Hide Chart</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-amber-300" />
                    <span>Show Chart</span>
                  </>
                )}
              </button>
            </div>

            {showChartInInventory && (
              <InventoryPerformanceChart items={stockItems} />
            )}
          </div>

          {/* SEARCH & FILTERS BAR (VIBRANT VIOLET TEXT CONTAINER) */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#260850] via-[#1f0642] to-[#260850] rounded-2xl border-2 border-violet-500/40 space-y-3.5 shadow-xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-white mr-1 uppercase tracking-wider">Category:</span>
              {(['All', 'Textbook', 'Customised Exercise Book', 'Customised Textbook'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-amber-400 text-slate-950 shadow-md border-2 border-amber-300'
                      : 'bg-violet-950/90 text-white hover:bg-violet-800 border border-violet-500/40 font-bold'
                  }`}
                >
                  {cat === 'All' ? 'All Items' : cat}
                </button>
              ))}

              <div className="ml-auto">
                <button
                  type="button"
                  onClick={() => setOnlyLowStock(!onlyLowStock)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                    onlyLowStock
                      ? 'bg-amber-400 text-slate-950 border-2 border-amber-300 shadow-md'
                      : 'bg-violet-950/90 text-amber-300 hover:bg-violet-800 border border-amber-400/50 font-bold'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Low Stock Warnings Only</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-violet-500/20">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-white" />
                <input
                  type="text"
                  placeholder="Search by title, subject, publisher, class..."
                  value={stockSearchTerm}
                  onChange={(e) => setStockSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-[#16032d] border-2 border-violet-500/40 rounded-xl text-white placeholder:text-white/75 font-semibold text-xs focus:outline-none focus:border-violet-300 shadow-inner"
                />
              </div>

              <div>
                <select
                  value={publicationFilter}
                  onChange={(e) => setPublicationFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-violet-400 rounded-xl text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm cursor-pointer"
                >
                  <option value="All">All Publications ({uniquePublications.length})</option>
                  {uniquePublications.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border-2 border-violet-400 rounded-xl text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm cursor-pointer"
                >
                  <option value="All">All Subjects / Types ({uniqueSubjects.length})</option>
                  {uniqueSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* STOCK ITEMS TABLE (VIOLET CONTAINER WITH CRISP WHITE TEXT) */}
          <div className="bg-gradient-to-b from-[#220747] via-[#1a0536] to-[#14032b] rounded-2xl border-2 border-violet-500/40 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 text-white border-b-2 border-violet-500/50 font-black uppercase tracking-wider text-xs">
                    <th className="py-3.5 px-4 text-white">Book / Exercise Book Description</th>
                    <th className="py-3.5 px-3 text-white">Publication</th>
                    <th className="py-3.5 px-3 text-white">Type / Subject</th>
                    <th className="py-3.5 px-2 text-center text-white">Class</th>
                    <th className="py-3.5 px-3 text-right text-white">Price</th>
                    <th className="py-3.5 px-3 text-center text-white">In Stock</th>
                    <th className="py-3.5 px-3 text-center text-white">Sold</th>
                    <th className="py-3.5 px-3 text-center text-white">Remaining</th>
                    <th className="py-3.5 px-3 text-right text-white">Revenue Sold</th>
                    <th className="py-3.5 px-3 text-center text-white">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-500/20">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-white font-medium text-sm">
                        No book stock items found matching your filter criteria. Click &quot;Add Book Stock&quot; to create a new stock item.
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((item) => {
                      const isLowStock = item.quantityRemaining <= item.lowStockThreshold;
                      const isOutOfStock = item.quantityRemaining <= 0;
                      const revenueGenerated = item.quantitySold * item.unitPrice;

                      return (
                        <tr key={item.id} className="hover:bg-violet-600/10 transition">
                          {/* TITLE & CATEGORY */}
                          <td className="py-3.5 px-4">
                            <div className="font-black text-white text-sm tracking-tight">
                              {item.title}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                item.category === 'Textbook'
                                  ? 'bg-blue-500/30 text-white border border-blue-400/50'
                                  : item.category === 'Customised Exercise Book'
                                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50'
                                  : 'bg-purple-500/30 text-white border border-purple-400/50'
                              }`}>
                                {item.category}
                              </span>
                              {item.shelfLocation && (
                                <span className="text-[11px] text-white font-bold">
                                  Loc: {item.shelfLocation}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* PUBLICATION */}
                          <td className="py-3.5 px-3">
                            <div className="font-bold text-white text-xs">
                              {item.publication}
                            </div>
                          </td>

                          {/* SUBJECT TYPE */}
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-1 rounded-lg bg-violet-900/90 text-white font-bold border border-violet-400/40 text-xs inline-block">
                              {item.subjectType}
                            </span>
                          </td>

                          {/* TARGET CLASS */}
                          <td className="py-3.5 px-2 text-center text-white font-black text-xs">
                            {item.targetClass}
                          </td>

                          {/* UNIT PRICE */}
                          <td className="py-3.5 px-3 text-right font-mono font-black text-amber-300 text-sm">
                            GH₵ {item.unitPrice.toFixed(2)}
                          </td>

                          {/* IN STOCK */}
                          <td className="py-3.5 px-3 text-center font-mono font-black text-white text-sm">
                            {item.quantityInStock}
                          </td>

                          {/* SOLD */}
                          <td className="py-3.5 px-3 text-center font-mono font-black text-emerald-300 text-sm">
                            {item.quantitySold}
                          </td>

                          {/* REMAINING WITH BADGE */}
                          <td className="py-3.5 px-3 text-center font-mono">
                            <span
                              className={`inline-block px-3 py-1 rounded-lg font-black text-xs ${
                                isOutOfStock
                                  ? 'bg-rose-500/40 text-rose-100 border-2 border-rose-400 shadow-sm'
                                  : isLowStock
                                  ? 'bg-amber-500/40 text-amber-100 border-2 border-amber-300 shadow-sm'
                                  : 'bg-emerald-500/40 text-emerald-100 border-2 border-emerald-400 shadow-sm'
                              }`}
                            >
                              {item.quantityRemaining}
                            </span>
                          </td>

                          {/* REVENUE SOLD */}
                          <td className="py-3.5 px-3 text-right font-mono font-black text-white text-sm">
                            GH₵ {revenueGenerated.toFixed(2)}
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setPreSelectedBookId(item.id);
                                  setShowSaleModal(true);
                                }}
                                disabled={isOutOfStock}
                                className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-30 cursor-pointer shadow border border-emerald-400/30"
                                title="Sell / Issue Receipt"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 text-white" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setRestockItem(item);
                                  setShowRestockModal(true);
                                }}
                                className="p-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold transition cursor-pointer shadow border border-amber-300"
                                title="Restock new batch"
                              >
                                <PackagePlus className="w-3.5 h-3.5 text-slate-950" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setShowStockModal(true);
                                }}
                                className="p-2 rounded-xl bg-violet-800 hover:bg-violet-700 text-white transition cursor-pointer shadow border border-violet-400/40"
                                title="Edit stock item"
                              >
                                <Edit className="w-3.5 h-3.5 text-white" />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmation({
                                    type: 'stock',
                                    id: item.id,
                                    title: item.title
                                  })
                                }
                                className="p-2 rounded-xl bg-rose-500/30 hover:bg-rose-500 text-white transition cursor-pointer border border-rose-400/40"
                                title="Delete stock item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: DAILY SALES LEDGER & RECEIPTS */}
      {activeSubTab === 'sales_ledger' && (
        <div className="space-y-4">
          {/* DATE FILTER & SUMMARY BANNER (VIBRANT VIOLET TEXT CONTAINER) */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-[#260850] via-[#1f0642] to-[#260850] rounded-2xl border-2 border-violet-500/40 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-amber-300" />
                  <span>Select Date:</span>
                </span>
                <input
                  type="date"
                  value={selectedSaleDate}
                  onChange={(e) => setSelectedSaleDate(e.target.value)}
                  className="px-3 py-2 bg-[#16032d] border-2 border-violet-500/40 rounded-xl text-white text-xs font-mono font-bold focus:outline-none focus:border-violet-300 shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setSelectedSaleDate(todayStr)}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer uppercase tracking-wider ${
                    selectedSaleDate === todayStr
                      ? 'bg-amber-400 text-slate-950 border-2 border-amber-300 shadow'
                      : 'bg-violet-950/90 text-white hover:bg-violet-800 border border-violet-500/40 font-bold'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSaleDate('')}
                  className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer uppercase tracking-wider ${
                    selectedSaleDate === ''
                      ? 'bg-amber-400 text-slate-950 border-2 border-amber-300 shadow'
                      : 'bg-violet-950/90 text-white hover:bg-violet-800 border border-violet-500/40 font-bold'
                  }`}
                >
                  All Dates
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-white" />
                  <input
                    type="text"
                    placeholder="Search receipt #, buyer name..."
                    value={salesSearchTerm}
                    onChange={(e) => setSalesSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-[#16032d] border-2 border-violet-500/40 rounded-xl text-white placeholder:text-white/75 font-semibold text-xs focus:outline-none focus:border-violet-300 shadow-inner"
                  />
                </div>
                <select
                  value={salesPaymentFilter}
                  onChange={(e) => setSalesPaymentFilter(e.target.value)}
                  className="px-3 py-2 bg-white border-2 border-violet-400 rounded-xl text-slate-900 font-bold text-xs focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm cursor-pointer"
                >
                  <option value="All">All Payment Modes</option>
                  <option value="Cash">Cash</option>
                  <option value="Mobile Money">Mobile Money</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
            </div>

            {/* DAILY TOTAL AMOUNT SOLD HIGHLIGHT BANNER */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-violet-950 via-purple-900 to-[#2c0859] rounded-2xl border-2 border-violet-400/50 shadow-xl flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="block text-xs text-white font-black uppercase tracking-wider">
                  Total Amount Sold on {selectedSaleDate || 'All Recorded Dates'}
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                  GH₵ {selectedDateStats.totalAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex flex-wrap gap-3 text-xs">
                <div className="text-center px-4 py-2 bg-violet-900/90 rounded-xl border border-violet-400/50 shadow-sm">
                  <span className="block text-white font-black text-[10px] uppercase tracking-wider">Receipts Issued</span>
                  <span className="font-mono font-black text-white text-sm">{selectedDateStats.receiptsCount}</span>
                </div>
                <div className="text-center px-4 py-2 bg-violet-900/90 rounded-xl border border-violet-400/50 shadow-sm">
                  <span className="block text-white font-black text-[10px] uppercase tracking-wider">Copies Sold</span>
                  <span className="font-mono font-black text-emerald-300 text-sm">{selectedDateStats.totalCopies}</span>
                </div>
                <div className="text-center px-4 py-2 bg-violet-900/90 rounded-xl border border-violet-400/50 shadow-sm">
                  <span className="block text-white font-black text-[10px] uppercase tracking-wider">Cash</span>
                  <span className="font-mono font-black text-white text-sm">GH₵ {selectedDateStats.cashTotal.toFixed(2)}</span>
                </div>
                <div className="text-center px-4 py-2 bg-violet-900/90 rounded-xl border border-violet-400/50 shadow-sm">
                  <span className="block text-white font-black text-[10px] uppercase tracking-wider">MoMo / Bank</span>
                  <span className="font-mono font-black text-amber-300 text-sm">
                    GH₵ {(selectedDateStats.momoTotal + selectedDateStats.bankTotal).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SALES RECORDS TABLE (VIOLET CONTAINER WITH CRISP WHITE TEXT) */}
          <div className="bg-gradient-to-b from-[#220747] via-[#1a0536] to-[#14032b] rounded-2xl border-2 border-violet-500/40 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gradient-to-r from-violet-950 via-purple-900 to-violet-950 text-white border-b-2 border-violet-500/50 font-black uppercase tracking-wider text-xs">
                    <th className="py-3.5 px-4 text-white">Receipt #</th>
                    <th className="py-3.5 px-3 text-white">Date & Time</th>
                    <th className="py-3.5 px-3 text-white">Buyer Name & Class</th>
                    <th className="py-3.5 px-4 text-white">Items Purchased (Subject & Publisher)</th>
                    <th className="py-3.5 px-2 text-center text-white">Copies</th>
                    <th className="py-3.5 px-3 text-right text-white">Amount Paid</th>
                    <th className="py-3.5 px-3 text-white">Payment Method</th>
                    <th className="py-3.5 px-3 text-center text-white">Receipt & Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-violet-500/20">
                  {filteredSalesRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-white font-medium text-sm">
                        No sales recorded for this date. Click &quot;Record Sale (POS)&quot; to sell books and issue a receipt.
                      </td>
                    </tr>
                  ) : (
                    filteredSalesRecords.map((sale) => {
                      const totalCopies = sale.items.reduce((sum, item) => sum + item.quantity, 0);

                      return (
                        <tr key={sale.id} className="hover:bg-violet-600/10 transition">
                          {/* RECEIPT NUMBER */}
                          <td className="py-3.5 px-4 font-mono font-black text-amber-300 text-sm">
                            {sale.receiptNumber}
                          </td>

                          {/* DATE & TIME */}
                          <td className="py-3.5 px-3">
                            <div className="font-black text-white text-xs">{sale.saleDate}</div>
                            <div className="text-[11px] text-white font-mono font-bold">
                              {sale.saleTime || '12:00'}
                            </div>
                          </td>

                          {/* BUYER NAME */}
                          <td className="py-3.5 px-3">
                            <div className="font-black text-white text-sm">
                              {sale.buyerName}
                            </div>
                            <div className="text-[11px] text-white font-bold">
                              {sale.buyerType} {sale.className ? `• ${sale.className}` : ''}
                            </div>
                            {sale.contactNumber && (
                              <div className="text-[11px] text-white font-mono">
                                {sale.contactNumber}
                              </div>
                            )}
                          </td>

                          {/* ITEMS LIST */}
                          <td className="py-3.5 px-4">
                            <div className="space-y-1.5 max-w-sm">
                              {sale.items.map((it, idx) => (
                                <div key={idx} className="text-xs flex items-center gap-1.5">
                                  <span className="font-mono font-black text-amber-300">
                                    {it.quantity}x
                                  </span>
                                  <span className="text-white font-bold truncate">
                                    {it.title}
                                  </span>
                                  <span className="text-[11px] text-white/90 font-medium">
                                    ({it.publication})
                                  </span>
                                </div>
                              ))}
                            </div>
                          </td>

                          {/* COPIES */}
                          <td className="py-3.5 px-2 text-center font-mono font-black text-white text-sm">
                            {totalCopies}
                          </td>

                          {/* TOTAL PAID */}
                          <td className="py-3.5 px-3 text-right font-mono font-black text-emerald-300 text-sm">
                            GH₵ {sale.totalAmount.toFixed(2)}
                          </td>

                          {/* PAYMENT METHOD */}
                          <td className="py-3.5 px-3">
                            <span className="px-2.5 py-1 rounded-lg bg-violet-900/90 border border-violet-400/50 font-black text-white text-xs inline-block">
                              {sale.paymentMethod}
                            </span>
                            {sale.paymentReference && (
                              <div className="text-[10px] text-white font-mono font-bold mt-0.5">
                                Ref: {sale.paymentReference}
                              </div>
                            )}
                          </td>

                          {/* ACTIONS */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setReceiptSale(sale);
                                  setShowReceiptModal(true);
                                }}
                                className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md border border-amber-300 uppercase tracking-wider"
                                title="View & Print Receipt"
                              >
                                <Receipt className="w-3.5 h-3.5 text-slate-950" />
                                <span>Receipt</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteConfirmation({
                                    type: 'sale',
                                    id: sale.id,
                                    title: `Receipt #${sale.receiptNumber} (${sale.buyerName})`
                                  })
                                }
                                className="p-2 rounded-xl bg-rose-500/30 hover:bg-rose-500 text-white transition cursor-pointer border border-rose-400/40"
                                title="Delete sale record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB 3: VISUAL ANALYTICS (TOTAL SALES VS REMAINING STOCK) */}
      {activeSubTab === 'visual_analytics' && (
        <div className="space-y-5">
          <InventoryPerformanceChart items={stockItems} />
        </div>
      )}

      {/* 7. MODALS */}

      {/* RECEIPT MODAL */}
      {showReceiptModal && receiptSale && (
        <BookReceiptModal
          sale={receiptSale}
          config={config}
          onClose={() => {
            setShowReceiptModal(false);
            setReceiptSale(null);
          }}
        />
      )}

      {/* NEW SALE (POS) MODAL */}
      {showSaleModal && (
        <NewBookSaleModal
          stockItems={stockItems}
          students={students}
          preSelectedBookId={preSelectedBookId}
          onCompleteSale={handleSaleCompleted}
          onClose={() => {
            setShowSaleModal(false);
            setPreSelectedBookId(undefined);
          }}
        />
      )}

      {/* ADD / EDIT BOOK STOCK MODAL */}
      {showStockModal && (
        <BookStockItemModal
          initialItem={editingItem}
          categories={['Textbook', 'Customised Exercise Book', 'Customised Textbook']}
          onSave={handleSaveStockItem}
          onClose={() => {
            setShowStockModal(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* RESTOCK MODAL */}
      {showRestockModal && restockItem && (
        <RestockModal
          item={restockItem}
          onConfirm={handleRestockConfirm}
          onClose={() => {
            setShowRestockModal(false);
            setRestockItem(null);
          }}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#1e073d] text-white rounded-2xl max-w-md w-full border-2 border-rose-500/50 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <span className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-black text-base text-white">
                  Confirm Deletion
                </h3>
                <p className="text-xs text-rose-200 font-bold">
                  {deleteConfirmation.type === 'stock'
                    ? 'Delete book stock inventory record'
                    : 'Delete book sales receipt record'}
                </p>
              </div>
            </div>

            <p className="text-xs text-white leading-relaxed font-semibold">
              Are you sure you want to permanently delete{' '}
              <strong className="text-white font-black">&quot;{deleteConfirmation.title}&quot;</strong>?
              This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-violet-500/30">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 bg-violet-900/80 hover:bg-violet-800 text-white font-bold rounded-xl transition cursor-pointer text-xs border border-violet-400/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeDelete}
                disabled={isSaving}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-black rounded-xl transition cursor-pointer text-xs shadow-lg shadow-rose-950/50 border border-rose-400/40"
              >
                {isSaving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
