/**
 * Department Login Page — Staff members select their department and enter a password
 * to access the scoped scanning & logs view.
 */

import React, { useState, useEffect } from 'react';
import { Lock, LogIn, ChevronDown, ShieldCheck, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '../api';

interface DepartmentLoginPageProps {
  onLogin: (session: { dept_code: string; name: string; icon: string }) => void;
  onBack: () => void;
}

interface DeptOption {
  id: string;
  dept_code: string;
  name: string;
  icon: string;
}

export default function DepartmentLoginPage({ onLogin, onBack }: DepartmentLoginPageProps) {
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDepts = async () => {
      try {
        const depts = await api.listDepartments();
        setDepartments(Array.isArray(depts) ? depts : []);
        if (depts.length > 0) setSelectedDept(depts[0].dept_code);
      } catch {
        // Fallback departments
        const fallback = [
          { id: '1', dept_code: 'SNACKS', name: 'Snacks', icon: '🍿' },
          { id: '2', dept_code: 'DRINKS', name: 'Drinks', icon: '🥤' },
          { id: '3', dept_code: 'DAIRY', name: 'Dairy', icon: '🥛' },
          { id: '4', dept_code: 'PRODUCE', name: 'Produce', icon: '🥬' },
          { id: '5', dept_code: 'BAKERY', name: 'Bakery', icon: '🍞' },
          { id: '6', dept_code: 'SPICES', name: 'Spices', icon: '🧂' },
        ];
        setDepartments(fallback);
        setSelectedDept(fallback[0].dept_code);
      }
    };
    loadDepts();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !password) {
      setError('Please select a department and enter the password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.departmentLogin(selectedDept, password);
      // Store session
      localStorage.setItem('dept_session', JSON.stringify({
        dept_code: result.dept_code,
        name: result.name,
        icon: result.icon,
      }));
      onLogin({ dept_code: result.dept_code, name: result.name, icon: result.icon });
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedDeptObj = departments.find(d => d.dept_code === selectedDept);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-medium mb-6 transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Admin Dashboard
        </button>

        {/* Login card */}
        <div className="rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-emerald-500 mb-2">
              <ShieldCheck className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white font-display">Department Login</h1>
            <p className="text-sm text-slate-400">
              Sign in to access scanning & inventory logs for your department
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Department Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Department</label>
              <div className="relative">
                <select
                  value={selectedDept}
                  onChange={e => setSelectedDept(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 cursor-pointer"
                >
                  {departments.map(dept => (
                    <option key={dept.dept_code} value={dept.dept_code} className="bg-slate-900 text-white">
                      {dept.icon} {dept.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Selected department preview */}
            {selectedDeptObj && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="text-2xl">{selectedDeptObj.icon}</span>
                <div>
                  <p className="text-sm font-bold text-white">{selectedDeptObj.name} Department</p>
                  <p className="text-[10px] text-slate-400 font-mono">Code: {selectedDeptObj.dept_code}</p>
                </div>
              </div>
            )}

            {/* Password */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter department password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-xs text-rose-300"
              >
                {error}
              </motion.div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold py-3 text-sm transition shadow-lg shadow-indigo-500/20 cursor-pointer"
            >
              {loading ? (
                <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Authenticating...</>
              ) : (
                <><LogIn className="h-4 w-4" /> Sign In to {selectedDeptObj?.name || 'Department'}</>
              )}
            </button>
          </form>

          {/* Hint */}
          <p className="text-center text-[10px] text-slate-500">
            Default password: <span className="font-mono text-slate-400">[dept_code]123</span> (e.g. snacks123)
          </p>
        </div>
      </motion.div>
    </div>
  );
}
