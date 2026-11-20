/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, 
  CalendarDays, 
  AlertTriangle, 
  XCircle, 
  Filter, 
  Sparkles, 
  CheckCircle2, 
  Flame, 
  Plus, 
  Edit3, 
  UtensilsCrossed, 
  Trash2,
  ChevronRight,
  RefreshCw,
  Search,
  Database,
  Share2
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../api';
import { InventoryItem, DashboardStats, RiskLevel } from '../types';
import EditItemModal from './EditItemModal';
import ActionModal from './ActionModal';

interface DashboardViewProps {
  onNavigateToAdd: () => void;
  onNavigateToSurplus?: () => void;
  onAlertRefreshNeeded: () => void;
  schedulerTriggerCount: number;
}

export default function DashboardView({ onNavigateToAdd, onNavigateToSurplus, onAlertRefreshNeeded, schedulerTriggerCount }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [surplusMatchesCount, setSurplusMatchesCount] = useState<number>(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal controls
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [actionMode, setActionMode] = useState<'consume' | 'waste' | null>(null);

  // Load stats and inventory data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const activeRisk = selectedRisk === 'ALL' ? undefined : selectedRisk;
      const [statsRes, itemsRes, matchesRes] = await Promise.all([
        api.getStats(),
        api.getInventory(activeRisk),
        api.getSurplusMatches().catch(() => [])
      ]);
      setStats(statsRes);
      setItems(itemsRes);
      setSurplusMatchesCount(matchesRes.filter(m => m.status === 'proposed').length);
    } catch (err: any) {
      console.error('Error loading dashboard data:', err);
      setError('Could not connect to the FastAPI inventory backend. Please verify your server status or switch to Mock Demo Mode in the header.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedRisk, schedulerTriggerCount]);

  // Handle Edit Action Save
  const handleEditSave = async (id: string | number, updatedFields: Partial<InventoryItem>) => {
    try {
      await api.updateItem(id, updatedFields);
      // Reload everything
      await loadData();
      onAlertRefreshNeeded();
    } catch (err) {
      console.error('Failed to update item:', err);
      throw err;
    }
  };

  // Handle Consume/Waste submission
  const handleActionConfirm = async (id: string | number, quantity: number) => {
    try {
      if (actionMode === 'consume') {
        await api.consumeItem(id, quantity);
      } else if (actionMode === 'waste') {
        await api.wasteItem(id, quantity);
      }
      await loadData();
      onAlertRefreshNeeded();
    } catch (err) {
      console.error(`Failed to submit ${actionMode}:`, err);
      throw err;
    }
  };

  const getRiskStyle = (level: RiskLevel) => {
    switch (level) {
      case 'FRESH':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          bullet: 'bg-emerald-500',
          label: 'Fresh'
        };
      case 'EXPIRING_SOON':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          bullet: 'bg-amber-500',
          label: 'Expiring Soon'
        };
      case 'CRITICAL':
        return {
          bg: 'bg-orange-50 text-orange-700 border-orange-200',
          bullet: 'bg-orange-500',
          label: 'Critical'
        };
      case 'EXPIRED':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          bullet: 'bg-rose-500',
          label: 'Expired'
        };
    }
  };

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      {/* Loading Overlay */}
      {loading && !stats && (
        <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-xs">
          <RefreshCw className="h-10 w-10 animate-spin text-emerald-600 mb-3" />
          <p className="font-display font-semibold text-slate-800">Synchronizing Stock Data...</p>
          <p className="text-xs text-slate-500">Contacting FastAPI endpoints</p>
        </div>
      )}

      {/* Error Alert Display */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-xs">
          <div className="flex items-start gap-3">
            <XCircle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-display font-bold text-rose-900">Backend Connection Refused</h3>
              <p className="text-sm text-rose-700 leading-relaxed">{error}</p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={loadData}
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3.5 py-1.5 transition-colors cursor-pointer"
                >
                  Retry Connection
                </button>
                <button
                  onClick={() => {
                    // Turn on mock mode
                    localStorage.setItem('fims_mock_mode', 'true');
                    window.location.reload();
                  }}
                  className="rounded-lg border border-rose-300 hover:bg-rose-100 text-rose-800 text-xs font-semibold px-3.5 py-1.5 transition-colors cursor-pointer"
                >
                  Enable Demo Mock Mode
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Stats Panel */}
      {stats && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
        >
          {/* Card 1: Total Items */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Items</span>
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-slate-800">{stats.total_items}</span>
              <span className="text-xs text-slate-500">tracked</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-500" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Card 2: Expiring Soon */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expiring Soon</span>
              <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                <CalendarDays className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-amber-700">{stats.expiring_soon}</span>
              <span className="text-xs text-slate-500">within 5 days</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
              <div 
                className="h-full rounded-full bg-amber-500" 
                style={{ width: `${stats.total_items > 0 ? (stats.expiring_soon / stats.total_items) * 100 : 0}%` }} 
              />
            </div>
          </div>

          {/* Card 3: Critical Level */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Critical Level</span>
              <div className="rounded-xl bg-orange-50 p-2 text-orange-600">
                <Flame className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-orange-700">{stats.critical}</span>
              <span className="text-xs text-slate-500">expires in &lt;48h</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
              <div 
                className="h-full rounded-full bg-orange-500" 
                style={{ width: `${stats.total_items > 0 ? (stats.critical / stats.total_items) * 100 : 0}%` }} 
              />
            </div>
          </div>

          {/* Card 4: Expired Stock */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Expired</span>
              <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-rose-700">{stats.expired}</span>
              <span className="text-xs text-slate-500">unusable stock</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
              <div 
                className="h-full rounded-full bg-rose-500" 
                style={{ width: `${stats.total_items > 0 ? (stats.expired / stats.total_items) * 100 : 0}%` }} 
              />
            </div>
          </div>

          {/* Card 5: Surplus Matches Available */}
          <button 
            onClick={onNavigateToSurplus}
            className="relative overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-xs transition-all hover:shadow-md cursor-pointer text-left focus:outline-hidden hover:border-indigo-300 group col-span-2 md:col-span-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">Surplus Grid</span>
              <div className="rounded-xl bg-indigo-600 p-2 text-white shadow-xs group-hover:scale-105 transition-transform">
                <Share2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-indigo-950">{surplusMatchesCount}</span>
              <span className="text-xs text-indigo-600 font-bold">Active Matches</span>
            </div>
            <div className="mt-2 text-[10px] text-indigo-600 font-semibold flex items-center gap-0.5 group-hover:text-indigo-800">
              Waste Transfer Network <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        </motion.div>
      )}

      {/* Main Stock Table and Filtering Panel */}
      {stats && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          
          {/* Filtering Header Panel */}
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Risk Category Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-2">Filter Risk:</span>
              {[
                { id: 'ALL', label: 'All Stock' },
                { id: 'FRESH', label: 'Fresh' },
                { id: 'EXPIRING_SOON', label: 'Expiring Soon' },
                { id: 'CRITICAL', label: 'Critical' },
                { id: 'EXPIRED', label: 'Expired' }
              ].map(riskTab => (
                <button
                  key={riskTab.id}
                  onClick={() => setSelectedRisk(riskTab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    selectedRisk === riskTab.id
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {riskTab.label}
                </button>
              ))}
            </div>

            {/* Search and Action Buttons */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-1.5 text-xs md:text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
                />
              </div>

              <button
                onClick={onNavigateToAdd}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs md:text-sm font-semibold px-4 py-2 transition-colors cursor-pointer shadow-sm shadow-emerald-100 shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add Stock
              </button>
            </div>

          </div>

          {/* Table Container */}
          <div className="overflow-x-auto">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="rounded-full bg-slate-100 p-3 text-slate-400 mb-3">
                  <Filter className="h-6 w-6" />
                </div>
                <h4 className="font-display font-semibold text-slate-800">No Food Items Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  {searchQuery 
                    ? `No products match your search query "${searchQuery}".` 
                    : `No food items in inventory match the ${selectedRisk.toLowerCase().replace('_', ' ')} risk category.`}
                </p>
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-xs font-semibold text-emerald-600 hover:underline"
                  >
                    Clear Search Filter
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop and Tablet Table Structure */}
                <table className="hidden md:table w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 font-display text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="px-6 py-3">Product Info</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">In Stock</th>
                      <th className="px-6 py-3">Dates</th>
                      <th className="px-6 py-3">FSSAI / Storage</th>
                      <th className="px-6 py-3">Risk Assessment</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                    {filteredItems.map((item) => {
                      const style = getRiskStyle(item.risk_level);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          
                          {/* Product Info */}
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            <p className="text-[10px] font-mono text-slate-400">ID: {item.id}</p>
                          </td>

                          {/* Category */}
                          <td className="px-6 py-4">
                            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200">
                              {item.category}
                            </span>
                          </td>

                          {/* In Stock */}
                          <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800">
                            {item.quantity} {item.unit}
                          </td>

                          {/* Dates */}
                          <td className="px-6 py-4 space-y-0.5 text-xs">
                            <p className="text-slate-500">
                              Added: <span className="font-mono font-medium text-slate-700">{item.entry_date}</span>
                            </p>
                            <p className="text-slate-500">
                              Expires: <span className="font-mono font-semibold text-rose-600">{item.expiry_date}</span>
                            </p>
                          </td>

                          {/* FSSAI & Storage */}
                          <td className="px-6 py-4 max-w-xs text-xs text-slate-500">
                            {item.fssai_license_no && (
                              <p className="font-semibold">FSSAI: <span className="font-mono font-normal text-slate-600">{item.fssai_license_no}</span></p>
                            )}
                            <p className="truncate italic" title={item.storage_instructions || 'Standard storage'}>
                              {item.storage_instructions || 'Standard pantry storage'}
                            </p>
                          </td>

                          {/* Risk Level Badge */}
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.bg}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${style.bullet}`} />
                              {style.label}
                            </span>
                          </td>

                          {/* Table Actions */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setActionMode('consume');
                                  setIsActionOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1.5 transition-colors cursor-pointer"
                                title="Mark Stock as Consumed"
                              >
                                <UtensilsCrossed className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Consume</span>
                              </button>
                              
                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setActionMode('waste');
                                  setIsActionOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold px-2.5 py-1.5 transition-colors cursor-pointer"
                                title="Mark Stock as Waste"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Wasted</span>
                              </button>

                              <button
                                onClick={() => {
                                  setSelectedItem(item);
                                  setIsEditOpen(true);
                                }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Item Details"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Card Layout (Hidden on Desktop) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const style = getRiskStyle(item.risk_level);
                    return (
                      <div key={item.id} className="p-4 space-y-3 bg-white">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold text-slate-900 text-sm">{item.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                {item.category}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500">
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                          </div>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style.bg}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${style.bullet}`} />
                            {style.label}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 border-t border-b border-slate-50 py-2">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Added</p>
                            <p className="font-mono font-medium text-slate-700">{item.entry_date}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400">Expiry Date</p>
                            <p className="font-mono font-bold text-rose-600">{item.expiry_date}</p>
                          </div>
                          {item.fssai_license_no && (
                            <div className="col-span-2">
                              <p className="text-[10px] uppercase font-bold text-slate-400">FSSAI License No.</p>
                              <p className="font-mono text-slate-700">{item.fssai_license_no}</p>
                            </div>
                          )}
                          {item.storage_instructions && (
                            <div className="col-span-2">
                              <p className="text-[10px] uppercase font-bold text-slate-400">Storage Details</p>
                              <p className="italic text-slate-600">{item.storage_instructions}</p>
                            </div>
                          )}
                        </div>

                        {/* Mobile Actions Button Row */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setActionMode('consume');
                              setIsActionOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold py-2 transition-colors cursor-pointer"
                          >
                            <UtensilsCrossed className="h-3.5 w-3.5" />
                            Consume
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setActionMode('waste');
                              setIsActionOpen(true);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold py-2 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Wasted
                          </button>

                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setIsEditOpen(true);
                            }}
                            className="px-3 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* Edit Item Dialog Modal */}
      <EditItemModal
        item={selectedItem}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedItem(null);
        }}
        onSave={handleEditSave}
      />

      {/* Action Dialog Modal (Consume/Waste) */}
      <ActionModal
        item={selectedItem}
        mode={actionMode}
        isOpen={isActionOpen}
        onClose={() => {
          setIsActionOpen(false);
          setSelectedItem(null);
          setActionMode(null);
        }}
        onConfirm={handleActionConfirm}
      />

    </div>
  );
}
