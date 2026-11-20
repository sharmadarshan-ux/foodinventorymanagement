/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Flame, 
  AlertCircle, 
  Calendar, 
  XCircle, 
  RefreshCw, 
  CheckCircle,
  Clock,
  ShieldCheck,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../api';
import { AlertItem, AlertSummary } from '../types';

interface AlertsViewProps {
  schedulerTriggerCount: number;
}

export default function AlertsView({ schedulerTriggerCount }: AlertsViewProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const [alertsRes, summaryRes] = await Promise.all([
        api.getAlerts(),
        api.getAlertSummary()
      ]);
      setAlerts(alertsRes);
      setSummary(summaryRes);
    } catch (err: any) {
      console.error('Failed to load alerts:', err);
      setError('Could not sync with warning alerts backend. Please ensure the FastAPI server is reachable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [schedulerTriggerCount]);

  const getAlertIcon = (risk: string) => {
    switch (risk) {
      case 'EXPIRED':
        return <XCircle className="h-5 w-5 text-rose-600 animate-pulse" />;
      case 'CRITICAL':
        return <Flame className="h-5 w-5 text-orange-500 animate-bounce" />;
      case 'EXPIRING_SOON':
        return <Calendar className="h-5 w-5 text-amber-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-blue-500" />;
    }
  };

  const getAlertBg = (risk: string) => {
    switch (risk) {
      case 'EXPIRED':
        return 'border-rose-200 bg-rose-50 text-rose-950';
      case 'CRITICAL':
        return 'border-orange-200 bg-orange-50 text-orange-950';
      case 'EXPIRING_SOON':
        return 'border-amber-200 bg-amber-50/50 text-amber-950';
      default:
        return 'border-slate-200 bg-slate-50 text-slate-900';
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'EXPIRED':
        return 'Expired';
      case 'CRITICAL':
        return 'Critical';
      case 'EXPIRING_SOON':
        return 'Expiring Soon';
      default:
        return 'Low Risk';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Loading placeholder */}
      {loading && !summary && (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-xs">
          <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
          <p className="text-sm font-semibold text-slate-800">Recalculating expiry thresholds...</p>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-xs md:text-sm">
          <div className="flex gap-2">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-semibold">Unable to fetch warnings</p>
              <p className="opacity-90">{error}</p>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Summary Panel / Quick Status */}
          <div className="md:col-span-4 space-y-4">
            
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <h3 className="font-display font-bold text-slate-900 text-base mb-3">Threat Summary</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-xs font-semibold text-rose-900">Expired Stock</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-rose-700 bg-white px-2.5 py-0.5 rounded-md border border-rose-100">
                    {summary.EXPIRED}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50/70 border border-orange-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-xs font-semibold text-orange-900">Critical Stock</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-orange-700 bg-white px-2.5 py-0.5 rounded-md border border-orange-100">
                    {summary.CRITICAL}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/70 border border-amber-100">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-semibold text-amber-900">Expiring Soon</span>
                  </div>
                  <span className="font-mono font-bold text-sm text-amber-700 bg-white px-2.5 py-0.5 rounded-md border border-amber-100">
                    {summary.EXPIRING_SOON}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Last recalculated just now. FSSAI safe.</span>
              </div>
            </div>

            {/* Smart Advisory Tip Card */}
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 p-5 shadow-xs">
              <div className="flex gap-2">
                <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-display font-bold text-indigo-950 text-xs uppercase tracking-wide">AI Compliance Tip</h4>
                  <p className="text-xs text-indigo-900 leading-relaxed mt-1">
                    FSSAI mandates that expired or decaying items are strictly separated from consumable ingredients to prevent cross-contamination. Flag them as 'Wasted' promptly to log regulatory reports.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Warning Feed Log list */}
          <div className="md:col-span-8 space-y-4">
            
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="font-display font-bold text-slate-900 text-base">Active Warning Feed</h3>
                <span className="text-[11px] font-semibold text-slate-400 font-mono uppercase tracking-wider">
                  {alerts.length} Warnings Active
                </span>
              </div>

              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="rounded-full bg-emerald-50 p-3 text-emerald-600 mb-3">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <h4 className="font-display font-bold text-slate-800">No Alerts Triggered</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Your entire kitchen stock is currently fresh! No food products are within the expiring threat range. Excellent management!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => {
                    const bgClass = getAlertBg(alert.risk_level);
                    const icon = getAlertIcon(alert.risk_level);
                    const label = getRiskLabel(alert.risk_level);

                    return (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-shadow hover:shadow-xs ${bgClass}`}
                      >
                        <div className="flex gap-3">
                          <div className="mt-0.5 shrink-0">{icon}</div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-display font-bold text-sm text-slate-950">{alert.item_name}</h4>
                              <span className="rounded bg-black/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-700">
                                {label}
                              </span>
                            </div>
                            
                            <p className="text-xs text-slate-700 mt-1.5 leading-relaxed">
                              {alert.message || `Attention required. Stock is in the high-risk ${label.toLowerCase()} category.`}
                            </p>
                          </div>
                        </div>

                        {/* Expiry Clock */}
                        <div className="flex items-center gap-1.5 font-mono text-xs font-semibold px-3 py-1 bg-black/5 rounded-lg text-slate-800 shrink-0 self-start sm:self-center">
                          <Clock className="h-3.5 w-3.5 text-slate-600" />
                          <span>
                            {alert.days_remaining === 0 ? 'Expires today' :
                             alert.days_remaining < 0 ? `Expired ${Math.abs(alert.days_remaining)}d ago` :
                             `Expires in ${alert.days_remaining}d`}
                          </span>
                        </div>

                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
