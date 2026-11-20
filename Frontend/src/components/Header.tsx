/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Camera,
  AlertTriangle,
  TrendingUp,
  FileCheck,
  RefreshCw,
  Database,
  Sliders,
  CheckCircle,
  AlertCircle,
  Share2,
  Menu,
  X as XIcon
} from 'lucide-react';
import { api, getApiBaseUrl, getMockMode, setMockMode } from '../api';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSchedulerTriggered: (msg: string) => void;
}

export default function Header({ activeTab, setActiveTab, onSchedulerTriggered }: HeaderProps) {
  const [backendStatus, setBackendStatus] = useState<'healthy' | 'unhealthy' | 'offline' | 'checking'>('checking');
  const [isMock, setIsMock] = useState<boolean>(getMockMode());
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const [backendUrlInput, setBackendUrlInput] = useState(getApiBaseUrl());
  const [showConfig, setShowConfig] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const checkConnection = async () => {
    setBackendStatus('checking');
    try {
      const res = await api.checkHealth();
      setBackendStatus(res.status as any);
    } catch {
      setBackendStatus('offline');
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 15000); // check every 15s
    return () => clearInterval(interval);
  }, []);

  const handleToggleMock = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setMockMode(val);
    setIsMock(val);
    window.location.reload(); // Refresh to apply changes and reset API caches
  };

  const handleRunScheduler = async () => {
    if (isRunningScheduler) return;
    setIsRunningScheduler(true);
    try {
      const res = await api.triggerSchedulerRun();
      onSchedulerTriggered(res.message || 'Risk recalculation scheduler executed successfully.');
    } catch (err: any) {
      onSchedulerTriggered(`Scheduler failed: ${err?.message || 'Server error'}`);
    } finally {
      setIsRunningScheduler(false);
    }
  };

  const handleSaveUrl = () => {
    (window as any).__VITE_API_BASE_URL__ = backendUrlInput;
    localStorage.setItem('fims_custom_api_url', backendUrlInput);
    setShowConfig(false);
    checkConnection();
    window.location.reload();
  };

  // Synchronize localStorage backup of URL if it exists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fims_custom_api_url');
      if (saved) {
        (window as any).__VITE_API_BASE_URL__ = saved;
        setBackendUrlInput(saved);
      }
    }
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'scan', label: 'Scan & Add', icon: Camera },
    { id: 'alerts', label: 'Alert Center', icon: AlertTriangle },
    { id: 'analytics', label: 'Analytics & Recipes', icon: TrendingUp },
    { id: 'compliance', label: 'Compliance Report', icon: FileCheck },
    { id: 'surplus', label: 'Surplus Network', icon: Share2 },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">

          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-200">
              <Database className="h-5.5 w-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-slate-900">AI-Powered Food Inventory</span>
                <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-700 uppercase">
                  Hack 2026
                </span>
              </div>
              <p className="hidden text-xs text-slate-500 sm:block">Food Inventory & Expiry Management</p>
            </div>
          </div>

          {/* Connection Status and Controls */}
          <div className="flex items-center gap-2 sm:gap-3">

            {/* Quick Demo Mode Toggle — hidden on mobile */}
            <div className="hidden md:flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-100">
              <Sliders className="h-4 w-4 text-slate-500" />
              <label className="flex cursor-pointer items-center gap-1.5 select-none">
                <span className="text-xs font-medium text-slate-600">Mock Mode</span>
                <input
                  type="checkbox"
                  checked={isMock}
                  onChange={handleToggleMock}
                  className="peer h-3.5 w-7 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors duration-200 checked:bg-emerald-600 focus:outline-hidden"
                />
              </label>
            </div>

            {/* API Health Status Dot */}
            <div className="relative">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 sm:px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 bg-white min-h-[36px]"
                title="Click to configure API Base URL"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${isMock ? 'bg-amber-500' :
                  backendStatus === 'healthy' ? 'bg-emerald-500 animate-pulse' :
                    backendStatus === 'checking' ? 'bg-blue-400 animate-pulse' : 'bg-rose-500'
                  }`} />
                <span className="hidden sm:inline">
                  {isMock ? 'Mock Demo' :
                    backendStatus === 'healthy' ? 'API Online' :
                      backendStatus === 'checking' ? 'Connecting...' : 'API Offline'}
                </span>
              </button>

              {/* API Configuration Dropdown */}
              {showConfig && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 z-50">
                  <h4 className="font-display font-semibold text-slate-800 text-sm mb-1">Backend Configuration</h4>
                  <p className="text-xs text-slate-500 mb-3">Configure your local or production FastAPI endpoint URL.</p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Base API URL</label>
                      <input
                        type="text"
                        value={backendUrlInput}
                        onChange={(e) => setBackendUrlInput(e.target.value)}
                        placeholder="http://localhost:8000"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveUrl}
                        className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs py-1.5 transition-colors"
                      >
                        Apply & Reload
                      </button>
                      <button
                        onClick={() => setShowConfig(false)}
                        className="rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs px-3 py-1.5"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Run Daily Check Dev Button */}
            <button
              onClick={handleRunScheduler}
              disabled={isRunningScheduler}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2 sm:px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors disabled:opacity-75 min-h-[36px]"
              title="Manual Recalculation Trigger (For Judges)"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRunningScheduler ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Run Daily Check</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 min-h-[36px] min-w-[36px] cursor-pointer"
            >
              {mobileMenuOpen ? <XIcon className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Tab Navigation — scrollable on mobile */}
        <div className="hidden md:flex h-11 border-t border-slate-100 overflow-x-auto scrollbar-none">
          <nav className="flex space-x-6 md:space-x-8" aria-label="Tabs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 border-b-2 py-3 px-1 text-xs md:text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${isActive
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                    }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-500'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile dropdown nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white py-2 px-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition cursor-pointer ${isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}

            {/* Mock mode toggle on mobile */}
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-slate-50 mt-2">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Mock Mode</span>
              </div>
              <input
                type="checkbox"
                checked={isMock}
                onChange={handleToggleMock}
                className="peer h-4 w-8 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors duration-200 checked:bg-emerald-600 focus:outline-hidden"
              />
            </div>
          </div>
        )}

      </div>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-bottom">
        <nav className="flex justify-around py-1">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition cursor-pointer min-w-[48px] ${isActive ? 'text-emerald-600' : 'text-slate-400'
                  }`}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[9px] font-semibold truncate max-w-[56px]">
                  {item.id === 'dashboard' ? 'Home' :
                    item.id === 'scan' ? 'Scan' :
                      item.id === 'alerts' ? 'Alerts' :
                        item.id === 'analytics' ? 'AI' :
                          item.id === 'compliance' ? 'FSSAI' : item.label}
                </span>
              </button>
            );
          })}
          {/* More button for surplus */}
          <button
            onClick={() => { setActiveTab('surplus'); setMobileMenuOpen(false); }}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg transition cursor-pointer min-w-[48px] ${activeTab === 'surplus' ? 'text-emerald-600' : 'text-slate-400'
              }`}
          >
            <Share2 className="h-5 w-5" />
            <span className="text-[9px] font-semibold">Surplus</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
