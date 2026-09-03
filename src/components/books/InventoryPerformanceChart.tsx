/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { BookStockItem, BookStockCategory } from '../../types';
import {
  BarChart3,
  TrendingUp,
  Package,
  Layers,
  Sparkles,
  AlertTriangle,
  Flame,
  ArrowUpDown,
  Coins
} from 'lucide-react';

interface InventoryPerformanceChartProps {
  items: BookStockItem[];
}

type GroupByMode = 'items' | 'categories' | 'subjects';
type MetricMode = 'quantity' | 'value';

export default function InventoryPerformanceChart({
  items
}: InventoryPerformanceChartProps) {
  const [groupBy, setGroupBy] = useState<GroupByMode>('items');
  const [metricMode, setMetricMode] = useState<MetricMode>('quantity');
  const [categoryFilter, setCategoryFilter] = useState<'All' | BookStockCategory>('All');
  const [itemLimit, setItemLimit] = useState<number>(10);
  const [sortBy, setSortBy] = useState<'sales' | 'remaining' | 'turnover'>('sales');

  // Compute Overall KPI Metrics
  const summary = useMemo(() => {
    const totalSold = items.reduce((sum, item) => sum + item.quantitySold, 0);
    const totalRemaining = items.reduce((sum, item) => sum + item.quantityRemaining, 0);
    const totalStock = items.reduce((sum, item) => sum + item.quantityInStock, 0);
    const totalSalesValue = items.reduce((sum, item) => sum + item.quantitySold * item.unitPrice, 0);
    const totalRemainingValue = items.reduce((sum, item) => sum + item.quantityRemaining * item.unitPrice, 0);
    const turnoverRate = totalStock > 0 ? Math.round((totalSold / totalStock) * 100) : 0;

    // Top selling item
    let topSeller: BookStockItem | null = null;
    let maxSold = -1;
    items.forEach((it) => {
      if (it.quantitySold > maxSold) {
        maxSold = it.quantitySold;
        topSeller = it;
      }
    });

    const lowStockCount = items.filter((it) => it.quantityRemaining <= it.lowStockThreshold).length;

    return {
      totalSold,
      totalRemaining,
      totalStock,
      totalSalesValue,
      totalRemainingValue,
      turnoverRate,
      topSeller,
      lowStockCount
    };
  }, [items]);

  // Prepare chart dataset
  const chartData = useMemo(() => {
    if (items.length === 0) return [];

    if (groupBy === 'categories') {
      const catMap: Record<
        string,
        {
          name: string;
          shortName: string;
          totalSold: number;
          remainingStock: number;
          inStock: number;
          soldValue: number;
          remainingValue: number;
          itemsCount: number;
        }
      > = {
        'Textbook': {
          name: 'Textbooks',
          shortName: 'Textbooks',
          totalSold: 0,
          remainingStock: 0,
          inStock: 0,
          soldValue: 0,
          remainingValue: 0,
          itemsCount: 0
        },
        'Customised Exercise Book': {
          name: 'Custom Exercise Books',
          shortName: 'Exercise Books',
          totalSold: 0,
          remainingStock: 0,
          inStock: 0,
          soldValue: 0,
          remainingValue: 0,
          itemsCount: 0
        },
        'Customised Textbook': {
          name: 'Customised Textbooks',
          shortName: 'Custom Textbooks',
          totalSold: 0,
          remainingStock: 0,
          inStock: 0,
          soldValue: 0,
          remainingValue: 0,
          itemsCount: 0
        }
      };

      items.forEach((item) => {
        const entry = catMap[item.category] || {
          name: item.category,
          shortName: item.category,
          totalSold: 0,
          remainingStock: 0,
          inStock: 0,
          soldValue: 0,
          remainingValue: 0,
          itemsCount: 0
        };
        entry.totalSold += item.quantitySold;
        entry.remainingStock += item.quantityRemaining;
        entry.inStock += item.quantityInStock;
        entry.soldValue += item.quantitySold * item.unitPrice;
        entry.remainingValue += item.quantityRemaining * item.unitPrice;
        entry.itemsCount += 1;
        catMap[item.category] = entry;
      });

      return Object.values(catMap).map((d) => ({
        ...d,
        soldValue: Math.round(d.soldValue * 100) / 100,
        remainingValue: Math.round(d.remainingValue * 100) / 100,
        turnoverRate: d.inStock > 0 ? Math.round((d.totalSold / d.inStock) * 100) : 0
      }));
    }

    if (groupBy === 'subjects') {
      const subjectMap: Record<
        string,
        {
          name: string;
          shortName: string;
          totalSold: number;
          remainingStock: number;
          inStock: number;
          soldValue: number;
          remainingValue: number;
          itemsCount: number;
        }
      > = {};

      items.forEach((item) => {
        const subj = (item.subjectType || 'Other').trim();
        if (!subjectMap[subj]) {
          subjectMap[subj] = {
            name: subj,
            shortName: subj.length > 14 ? subj.slice(0, 12) + '…' : subj,
            totalSold: 0,
            remainingStock: 0,
            inStock: 0,
            soldValue: 0,
            remainingValue: 0,
            itemsCount: 0
          };
        }
        subjectMap[subj].totalSold += item.quantitySold;
        subjectMap[subj].remainingStock += item.quantityRemaining;
        subjectMap[subj].inStock += item.quantityInStock;
        subjectMap[subj].soldValue += item.quantitySold * item.unitPrice;
        subjectMap[subj].remainingValue += item.quantityRemaining * item.unitPrice;
        subjectMap[subj].itemsCount += 1;
      });

      const list = Object.values(subjectMap).map((d) => ({
        ...d,
        soldValue: Math.round(d.soldValue * 100) / 100,
        remainingValue: Math.round(d.remainingValue * 100) / 100,
        turnoverRate: d.inStock > 0 ? Math.round((d.totalSold / d.inStock) * 100) : 0
      }));

      // Sort by sales descending
      list.sort((a, b) => b.totalSold - a.totalSold);
      return list.slice(0, itemLimit);
    }

    // Default: 'items'
    let filtered = [...items];
    if (categoryFilter !== 'All') {
      filtered = filtered.filter((it) => it.category === categoryFilter);
    }

    if (sortBy === 'sales') {
      filtered.sort((a, b) => b.quantitySold - a.quantitySold);
    } else if (sortBy === 'remaining') {
      filtered.sort((a, b) => b.quantityRemaining - a.quantityRemaining);
    } else if (sortBy === 'turnover') {
      filtered.sort((a, b) => {
        const tA = a.quantityInStock > 0 ? a.quantitySold / a.quantityInStock : 0;
        const tB = b.quantityInStock > 0 ? b.quantitySold / b.quantityInStock : 0;
        return tB - tA;
      });
    }

    const limited = filtered.slice(0, itemLimit);

    return limited.map((it) => {
      const shortTitle = it.title.length > 16 ? it.title.slice(0, 15) + '…' : it.title;
      return {
        name: it.title,
        shortName: shortTitle,
        category: it.category,
        publication: it.publication,
        targetClass: it.targetClass,
        unitPrice: it.unitPrice,
        inStock: it.quantityInStock,
        totalSold: it.quantitySold,
        remainingStock: it.quantityRemaining,
        soldValue: Math.round(it.quantitySold * it.unitPrice * 100) / 100,
        remainingValue: Math.round(it.quantityRemaining * it.unitPrice * 100) / 100,
        turnoverRate:
          it.quantityInStock > 0 ? Math.round((it.quantitySold / it.quantityInStock) * 100) : 0
      };
    });
  }, [items, groupBy, categoryFilter, itemLimit, sortBy]);

  // Custom Chart Tooltip
  const renderCustomTooltip = ({
    active,
    payload
  }: {
    active?: boolean;
    payload?: Array<{
      payload: {
        name: string;
        category?: string;
        publication?: string;
        targetClass?: string;
        unitPrice?: number;
        inStock: number;
        totalSold: number;
        remainingStock: number;
        soldValue: number;
        remainingValue: number;
        turnoverRate: number;
        itemsCount?: number;
      };
    }>;
  }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;

    return (
      <div className="p-3.5 bg-[#1c063b] border-2 border-violet-400/60 rounded-2xl shadow-2xl backdrop-blur-md text-xs space-y-2 max-w-xs z-50">
        <div className="border-b border-violet-400/30 pb-1.5">
          <div className="font-black text-white text-sm leading-snug">{data.name}</div>
          {data.category && (
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white font-bold">
              <span>{data.category}</span>
              {data.publication && <span>• {data.publication}</span>}
              {data.targetClass && <span>• Class: {data.targetClass}</span>}
            </div>
          )}
          {data.itemsCount !== undefined && (
            <div className="text-[10px] text-white/90 font-semibold mt-0.5">
              Includes {data.itemsCount} registered inventory titles
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-400/40">
            <span className="block text-[10px] text-emerald-300 font-black uppercase tracking-wider">
              Total Sold
            </span>
            <div className="font-mono font-black text-white text-sm">
              {data.totalSold} copies
            </div>
            <div className="text-[10px] text-emerald-300 font-mono font-bold">
              GH₵ {data.soldValue.toFixed(2)}
            </div>
          </div>

          <div className="p-2 rounded-xl bg-violet-950/80 border border-violet-400/40">
            <span className="block text-[10px] text-white font-black uppercase tracking-wider">
              Remaining Stock
            </span>
            <div className="font-mono font-black text-white text-sm">
              {data.remainingStock} copies
            </div>
            <div className="text-[10px] text-amber-300 font-mono font-bold">
              GH₵ {data.remainingValue.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-violet-400/30 text-[11px] text-white font-bold">
          <span>Sales Velocity / Turnover:</span>
          <span className="font-mono font-black text-amber-300">{data.turnoverRate}% sold</span>
        </div>
      </div>
    );
  };

  if (items.length === 0) {
    return (
      <div className="p-8 bg-gradient-to-b from-[#220747] to-[#14032b] rounded-2xl border-2 border-violet-500/40 text-center space-y-2 shadow-xl">
        <BarChart3 className="w-10 h-10 text-amber-300 mx-auto" />
        <h4 className="text-white font-black text-sm">No Inventory Data for Performance Chart</h4>
        <p className="text-xs text-white font-medium max-w-md mx-auto">
          Add books or custom exercise books to the stock register to visualize Total Sales vs.
          Remaining Stock performance.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 sm:p-6 bg-gradient-to-b from-[#24084d] via-[#1a0538] to-[#120228] rounded-3xl border-2 border-violet-500/40 shadow-2xl space-y-5">
      {/* 1. HEADER & CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-violet-800 text-white border border-violet-400/50 flex items-center justify-center shadow-lg">
              <BarChart3 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Total Sales vs. Remaining Stock
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-white border border-emerald-400/50 text-[10px] font-black uppercase tracking-wider">
                  Recharts Visualizer
                </span>
              </h3>
              <p className="text-xs text-white font-medium">
                Comparative analysis of sales volume versus available stock to guide replenishment and catalog demand.
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Metric Mode Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Group By Selector */}
          <div className="flex bg-[#14032b] p-1 rounded-xl border border-violet-500/40 shadow-inner">
            <button
              type="button"
              onClick={() => setGroupBy('items')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'items'
                  ? 'bg-amber-400 text-slate-950 shadow-md border border-amber-300'
                  : 'text-white hover:bg-violet-900/60'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>By Item</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('categories')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'categories'
                  ? 'bg-amber-400 text-slate-950 shadow-md border border-amber-300'
                  : 'text-white hover:bg-violet-900/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>By Category</span>
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('subjects')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                groupBy === 'subjects'
                  ? 'bg-amber-400 text-slate-950 shadow-md border border-amber-300'
                  : 'text-white hover:bg-violet-900/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>By Subject</span>
            </button>
          </div>

          {/* Metric Toggle: Units vs GH₵ */}
          <div className="flex bg-[#14032b] p-1 rounded-xl border border-violet-500/40 shadow-inner">
            <button
              type="button"
              onClick={() => setMetricMode('quantity')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                metricMode === 'quantity'
                  ? 'bg-emerald-500 text-white shadow-md border border-emerald-400'
                  : 'text-white hover:bg-violet-900/60'
              }`}
              title="Compare quantities in copies / units"
            >
              <Package className="w-3.5 h-3.5" />
              <span>Copies</span>
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('value')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                metricMode === 'value'
                  ? 'bg-amber-400 text-slate-950 shadow-md border border-amber-300'
                  : 'text-white hover:bg-violet-900/60'
              }`}
              title="Compare monetary value in Ghana Cedis (GH₵)"
            >
              <Coins className="w-3.5 h-3.5" />
              <span>Value (GH₵)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. SUMMARY INSIGHT CHIPS (VIBRANT VIOLET CONTAINERS WITH CRISP WHITE TEXT) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-gradient-to-br from-violet-950 to-purple-900 rounded-2xl border border-violet-400/50 flex items-center justify-between shadow-lg">
          <div>
            <span className="block text-[10px] text-white font-black uppercase tracking-wider">
              Total Copies Sold
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-300">
              {summary.totalSold} copies
            </span>
            <div className="text-[11px] text-white font-mono font-bold">
              GH₵ {summary.totalSalesValue.toFixed(2)}
            </div>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="p-3.5 bg-gradient-to-br from-violet-950 to-purple-900 rounded-2xl border border-violet-400/50 flex items-center justify-between shadow-lg">
          <div>
            <span className="block text-[10px] text-white font-black uppercase tracking-wider">
              Total Stock Remaining
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-white">
              {summary.totalRemaining} copies
            </span>
            <div className="text-[11px] text-white font-mono font-bold">
              GH₵ {summary.totalRemainingValue.toFixed(2)}
            </div>
          </div>
          <Package className="w-5 h-5 text-amber-300" />
        </div>

        <div className="p-3.5 bg-gradient-to-br from-violet-950 to-purple-900 rounded-2xl border border-violet-400/50 flex items-center justify-between shadow-lg">
          <div>
            <span className="block text-[10px] text-white font-black uppercase tracking-wider">
              Stock Turnover Rate
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-amber-300">
              {summary.turnoverRate}%
            </span>
            <div className="text-[10px] text-white font-bold">of total stock sold</div>
          </div>
          <Flame className="w-5 h-5 text-amber-400" />
        </div>

        <div className="p-3.5 bg-gradient-to-br from-violet-950 to-purple-900 rounded-2xl border border-violet-400/50 flex items-center justify-between shadow-lg">
          <div>
            <span className="block text-[10px] text-white font-black uppercase tracking-wider">
              Top Selling Item
            </span>
            <span className="text-xs sm:text-sm font-black text-white truncate max-w-[130px] block" title={summary.topSeller?.title || 'None'}>
              {summary.topSeller?.title || 'None'}
            </span>
            <div className="text-[11px] text-emerald-300 font-mono font-bold">
              {summary.topSeller ? `${summary.topSeller.quantitySold} sold` : '-'}
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-amber-300" />
        </div>
      </div>

      {/* 3. SECONDARY CONTROLS (Item limit, Category & Sort Filter when groupBy === 'items') */}
      {groupBy === 'items' && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-violet-500/20 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-white font-black mr-1 uppercase tracking-wider text-[11px]">Category:</span>
            {(['All', 'Textbook', 'Customised Exercise Book', 'Customised Textbook'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-xl font-black transition cursor-pointer text-xs ${
                    categoryFilter === cat
                      ? 'bg-amber-400 text-slate-950 shadow border border-amber-300'
                      : 'bg-violet-950/80 text-white hover:bg-violet-900 border border-violet-500/30'
                  }`}
                >
                  {cat === 'All' ? 'All Items' : cat}
                </button>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-white font-black text-xs">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'sales' | 'remaining' | 'turnover')}
                className="bg-white border-2 border-violet-400 rounded-xl text-slate-900 px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm cursor-pointer"
              >
                <option value="sales">Highest Sales Volume</option>
                <option value="remaining">Highest Remaining Stock</option>
                <option value="turnover">Highest Turnover Rate (%)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-white font-black text-xs">Show:</span>
              <select
                value={itemLimit}
                onChange={(e) => setItemLimit(Number(e.target.value))}
                className="bg-white border-2 border-violet-400 rounded-xl text-slate-900 px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm cursor-pointer"
              >
                <option value={6}>Top 6 Items</option>
                <option value={10}>Top 10 Items</option>
                <option value={15}>Top 15 Items</option>
                <option value={25}>Top 25 Items</option>
                <option value={50}>Top 50 Items</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 4. RECHARTS BAR CHART CONTAINER */}
      <div className="p-3 sm:p-4 bg-[#14032b] rounded-2xl border-2 border-violet-500/30 shadow-xl">
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 25, left: 10, bottom: groupBy === 'items' ? 50 : 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#7c3aed" opacity={0.25} />
              <XAxis
                dataKey="shortName"
                stroke="#c084fc"
                tick={{ fill: '#ffffff', fontSize: 11, fontWeight: 'bold' }}
                angle={groupBy === 'items' || groupBy === 'subjects' ? -25 : 0}
                textAnchor={groupBy === 'items' || groupBy === 'subjects' ? 'end' : 'middle'}
                interval={0}
                height={groupBy === 'items' || groupBy === 'subjects' ? 55 : 30}
              />
              <YAxis
                stroke="#c084fc"
                tick={{ fill: '#ffffff', fontSize: 11, fontWeight: 'bold' }}
                tickFormatter={(value: number) =>
                  metricMode === 'value' ? `GH₵${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}` : `${value}`
                }
              />
              <Tooltip content={renderCustomTooltip} cursor={{ fill: 'rgba(168, 85, 247, 0.15)' }} />
              <Legend
                wrapperStyle={{
                  paddingTop: '8px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#ffffff'
                }}
              />
              <Bar
                dataKey={metricMode === 'quantity' ? 'totalSold' : 'soldValue'}
                name={
                  metricMode === 'quantity'
                    ? 'Total Sales (Copies Sold)'
                    : 'Total Sales Revenue (GH₵)'
                }
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey={metricMode === 'quantity' ? 'remainingStock' : 'remainingValue'}
                name={
                  metricMode === 'quantity'
                    ? 'Remaining Stock (In Hand)'
                    : 'Remaining Stock Valuation (GH₵)'
                }
                fill="#a855f7"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. FOOTER NOTES */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-white font-bold pt-1">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm" />
          <span>Green: Total Sold</span>
          <span className="w-3 h-3 rounded-full bg-purple-500 inline-block ml-3 shadow-sm" />
          <span>Purple: Remaining Stock</span>
        </div>
        {summary.lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 text-amber-300 font-black">
            <AlertTriangle className="w-4 h-4" />
            <span>{summary.lowStockCount} item(s) are at or below low stock threshold</span>
          </div>
        )}
      </div>
    </div>
  );
}
