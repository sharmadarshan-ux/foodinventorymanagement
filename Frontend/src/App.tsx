/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CheckCircle, Info, X, Bell, Users } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import ScanView from './components/ScanView';
import AlertsView from './components/AlertsView';
import AnalyticsView from './components/AnalyticsView';
import ComplianceView from './components/ComplianceView';
import SurplusView from './components/SurplusView';
import DepartmentLoginPage from './components/DepartmentLoginPage';
import DepartmentScopedView from './components/DepartmentScopedView';

interface DepartmentSession {
  dept_code: string;
  name: string;
  icon: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Department session state
  const [appMode, setAppMode] = useState<'admin' | 'dept-login' | 'dept-scoped'>('admin');
  const [deptSession, setDeptSession] = useState<DepartmentSession | null>(null);

  // Track scheduler trigger ticks to propagate automatic refreshes to child components
  const [schedulerTriggerCount, setSchedulerTriggerCount] = useState(0);
  
  // Toast notifications for scheduler or background tasks
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Check for existing department session on mount
  useEffect(() => {
    const stored = localStorage.getItem('dept_session');
    if (stored) {
      try {
        const session = JSON.parse(stored);
        if (session.dept_code && session.name) {
          setDeptSession(session);
          setAppMode('dept-scoped');
        }
      } catch {
        localStorage.removeItem('dept_session');
      }
    }
  }, []);

  const handleSchedulerTriggered = (msg: string) => {
    setToastMessage(msg);
    setSchedulerTriggerCount(prev => prev + 1);
  };

  // Automatically clear toast after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleDeptLogin = (session: DepartmentSession) => {
    setDeptSession(session);
    setAppMode('dept-scoped');
  };

  const handleDeptLogout = () => {
    setDeptSession(null);
    localStorage.removeItem('dept_session');
    setAppMode('admin');
  };

  // ── Department Login Page ──
  if (appMode === 'dept-login') {
    return (
      <DepartmentLoginPage
        onLogin={handleDeptLogin}
        onBack={() => setAppMode('admin')}
      />
    );
  }

  // ── Department Scoped View ──
  if (appMode === 'dept-scoped' && deptSession) {
    return (
      <DepartmentScopedView
        session={deptSession}
        onLogout={handleDeptLogout}
      />
    );
  }

  // ── Admin / Full View ──

  // Render the appropriate panel based on selected tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardView
            onNavigateToAdd={() => setActiveTab('scan')}
            onNavigateToSurplus={() => setActiveTab('surplus')}
            onAlertRefreshNeeded={() => setSchedulerTriggerCount(p => p + 1)}
            schedulerTriggerCount={schedulerTriggerCount}
          />
        );
      case 'scan':
        return (
          <ScanView 
            onItemSaved={() => setSchedulerTriggerCount(p => p + 1)} 
          />
        );
      case 'alerts':
        return (
          <AlertsView 
            schedulerTriggerCount={schedulerTriggerCount} 
          />
        );
      case 'analytics':
        return <AnalyticsView />;
      case 'compliance':
        return <ComplianceView />;
      case 'surplus':
        return (
          <SurplusView 
            onItemSaved={() => setSchedulerTriggerCount(p => p + 1)} 
          />
        );
      default:
        return (
          <div className="text-center py-12">
            <p className="text-slate-500">View not found.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-emerald-500 selection:text-white">
      
      {/* Dynamic Header Component */}
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onSchedulerTriggered={handleSchedulerTriggered} 
      />

      {/* Department Login Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-emerald-600">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <p className="text-[11px] text-white/80">
            <span className="font-semibold text-white">Department staff?</span> Login to access scanning & logs for your section.
          </p>
          <button
            onClick={() => setAppMode('dept-login')}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white px-3 py-1.5 text-[10px] font-bold transition cursor-pointer"
          >
            <Users className="h-3 w-3" />
            Department Login
          </button>
        </div>
      </div>

      {/* Main Layout Content Stage */}
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 pt-8 pb-20 md:pb-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {renderTabContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global Notifications Toast Drawer */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900 text-white rounded-2xl shadow-2xl p-4 border border-slate-800 flex items-start gap-3.5"
          >
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-400 shrink-0">
              <Bell className="h-5 w-5" />
            </div>
            
            <div className="flex-1 space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">System Notification</p>
              <p className="text-xs text-slate-200 leading-relaxed font-normal">{toastMessage}</p>
            </div>

            <button 
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aesthetic Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            <span className="font-semibold text-slate-500">GEN-016 Food Inventory Management</span>
          </div>
          <div>
            Design Framework: React + Tailwind CSS • Deployed to Vercel
          </div>
        </div>
      </footer>

    </div>
  );
}
