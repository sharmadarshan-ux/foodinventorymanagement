/**
 * Department Scoped View — Restricted UI for department staff.
 * Shows only: Scan tab + My Logs tab.
 * All items are auto-tagged with the department code.
 */

import React, { useState, useEffect } from 'react';
import {
  Camera,
  ClipboardList,
  LogOut,
  Package,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../api';
import { InventoryItem } from '../types';
import ScanView from './ScanView';

interface DepartmentSession {
  dept_code: string;
  name: string;
  icon: string;
}

interface DepartmentScopedViewProps {
  session: DepartmentSession;
  onLogout: () => void;
}

type ScopedTab = 'scan' | 'logs';

export default function DepartmentScopedView({ session, onLogout }: DepartmentScopedViewProps) {
  const [activeTab, setActiveTab] = useState<ScopedTab>('scan');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    try {
      const res = await api.getDepartmentItems(session.dept_code);
      setItems(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load department items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [session.dept_code]);

  const handleItemSaved = () => {
    loadItems(); // Refresh logs after scan
  };

  const getRiskStyle = (risk: string) => {
    switch (risk) {
      case 'EXPIRED':
        return { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: <XCircle className="h-4 w-4 text-rose-500" /> };
      case 'CRITICAL':
        return { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: <AlertCircle className="h-4 w-4 text-orange-500" /> };
      case 'EXPIRING_SOON':
        return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <Calendar className="h-4 w-4 text-amber-500" /> };
      default:
        return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Department Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{session.icon}</span>
            <div>
              <h1 className="text-sm font-bold text-slate-900 font-display">{session.name} Department</h1>
              <p className="text-[10px] text-slate-500 font-mono">Code: {session.dept_code} · Scoped Access</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold px-2.5 py-1 rounded-full">
              {items.length} items logged
            </span>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 px-3 py-2 text-xs font-semibold transition cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tab Switcher */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex rounded-xl bg-slate-200/60 p-1 border border-slate-200 max-w-md">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'scan'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="h-4 w-4" />
            Scan & Add
          </button>
          <button
            onClick={() => { setActiveTab('logs'); loadItems(); }}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-white text-indigo-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            My Logs
            {items.length > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {activeTab === 'scan' ? (
          <div>
            {/* Info banner */}
            <div className="mb-4 rounded-xl bg-indigo-50 border border-indigo-100 p-3 flex items-start gap-2.5">
              <Package className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-indigo-900">Scanning as {session.icon} {session.name} Department</p>
                <p className="text-[10px] text-indigo-700 mt-0.5">
                  All items you scan will be automatically tagged with department code <span className="font-mono font-bold">{session.dept_code}</span>.
                </p>
              </div>
            </div>

            <ScanView
              onItemSaved={handleItemSaved}
              departmentCode={session.dept_code}
            />
          </div>
        ) : (
          /* My Logs */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 font-display">
                {session.icon} {session.name} Inventory Logs
              </h2>
              <button
                onClick={loadItems}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 text-[10px] font-bold transition cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="h-6 w-6 mx-auto mb-2 text-indigo-500 animate-spin" />
                <p className="text-xs text-slate-500">Loading department logs...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-slate-200 bg-white">
                <ClipboardList className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <h3 className="text-sm font-bold text-slate-700">No Items Logged Yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Switch to the "Scan & Add" tab to scan your first product for the {session.name} department.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item, index) => {
                  const risk = getRiskStyle(item.risk_level || 'FRESH');
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`rounded-xl border p-4 space-y-2.5 ${risk.bg}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {item.name || item.product_name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                            {item.category || 'Uncategorized'} · {item.quantity} {item.unit}
                          </p>
                        </div>
                        {risk.icon}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${risk.text} bg-white/60`}>
                          {item.risk_level || 'FRESH'}
                        </span>
                        {item.expiry_date && (
                          <span className="text-[10px] text-slate-500">
                            Exp: {item.expiry_date}
                          </span>
                        )}
                        {item.fssai_license_no && (
                          <span className="text-[10px] font-mono text-slate-400">
                            FSSAI: {item.fssai_license_no}
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-slate-400">
                        Added: {item.entry_date ? new Date(item.entry_date).toLocaleDateString() : 'Unknown'}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
