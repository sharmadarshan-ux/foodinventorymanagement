/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Check, Trash2, AlertTriangle } from 'lucide-react';
import { InventoryItem } from '../types';

interface ActionModalProps {
  item: InventoryItem | null;
  mode: 'consume' | 'waste' | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string | number, quantity: number) => Promise<void>;
}

export default function ActionModal({ item, mode, isOpen, onClose, onConfirm }: ActionModalProps) {
  const [qty, setQty] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setQty(item.quantity);
      setError(null);
    }
  }, [item, mode]);

  if (!isOpen || !item || !mode) return null;

  const isConsume = mode === 'consume';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }
    if (qty > item.quantity) {
      setError(`Quantity cannot exceed current stock (${item.quantity} ${item.unit}).`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(item.id, qty);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit action. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-100 ${
          isConsume ? 'bg-emerald-50' : 'bg-rose-50'
        }`}>
          <div className="flex items-center gap-2">
            {isConsume ? (
              <Check className="h-5 w-5 text-emerald-700" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-rose-700" />
            )}
            <h3 className={`font-display font-bold text-sm md:text-base ${
              isConsume ? 'text-emerald-900' : 'text-rose-900'
            }`}>
              {isConsume ? 'Mark Stock as Consumed' : 'Mark Stock as Wasted'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Item Selected</p>
            <p className="font-display font-bold text-slate-800 text-sm">{item.name}</p>
            <p className="text-xs text-slate-500">
              Current Available Stock: <span className="font-semibold text-slate-700">{item.quantity} {item.unit}</span>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-100 p-2.5 text-rose-700 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Quantity to {isConsume ? 'Consume' : 'Report as Waste'} ({item.unit})
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.01"
                step="any"
                max={item.quantity}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                placeholder={`Max ${item.quantity}`}
                required
              />
              <button
                type="button"
                onClick={() => setQty(item.quantity)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 transition-colors"
              >
                Max
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {isConsume 
                ? 'Consumed quantities are recorded in analytics to estimate consumption speed.' 
                : 'Wasted quantities increase the waste rate and trigger predictive reduction advices.'}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl text-white font-semibold py-2 text-sm transition-colors cursor-pointer ${
                isConsume 
                  ? 'bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400' 
                  : 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400'
              }`}
            >
              {isConsume ? <Check className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
              {isSubmitting 
                ? 'Processing...' 
                : isConsume 
                  ? 'Confirm Consumption' 
                  : 'Confirm Waste'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-medium text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
