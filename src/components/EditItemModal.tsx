/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { InventoryItem } from '../types';

interface EditItemModalProps {
  item: InventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string | number, updatedFields: Partial<InventoryItem>) => Promise<void>;
}

export default function EditItemModal({ item, isOpen, onClose, onSave }: EditItemModalProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Dairy');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('Liters');
  const [expiryDate, setExpiryDate] = useState('');
  const [entryDate, setEntryDate] = useState('');
  const [fssaiLicense, setFssaiLicense] = useState('');
  const [storageInstructions, setStorageInstructions] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = ['Dairy', 'Bakery', 'Produce', 'Pantry', 'Meat/Fish', 'Frozen', 'Beverages', 'Spices', 'Other'];
  const units = ['Liters', 'Grams', 'Pieces', 'Pack', 'Loaf', 'Kgs', 'Units'];

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCategory(item.category || 'Dairy');
      setQuantity(item.quantity);
      setUnit(item.unit || 'Liters');
      setExpiryDate(item.expiry_date);
      setEntryDate(item.entry_date);
      setFssaiLicense(item.fssai_license_no || '');
      setStorageInstructions(item.storage_instructions || '');
      setError(null);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product Name is required.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }
    if (!expiryDate) {
      setError('Expiry Date is required.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave(item.id, {
        name,
        category,
        quantity: Number(quantity),
        unit,
        expiry_date: expiryDate,
        entry_date: entryDate,
        fssai_license_no: fssaiLicense.trim() || undefined,
        storage_instructions: storageInstructions.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h3 className="font-display font-bold text-slate-900 text-lg">Edit Inventory Item</h3>
            <p className="text-xs text-slate-500">Update food product details and tracking stats</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-100 p-3 text-rose-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            
            {/* Product Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                placeholder="e.g. Pasteurised Fresh Milk"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Units Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Type</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
              >
                {units.map(ut => (
                  <option key={ut} value={ut}>{ut}</option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Quantity *</label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                required
              />
            </div>

            {/* FSSAI License Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">FSSAI License No.</label>
              <input
                type="text"
                maxLength={14}
                value={fssaiLicense}
                onChange={(e) => setFssaiLicense(e.target.value.replace(/\D/g, ''))} // numbers only
                placeholder="14-digit FSSAI"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Entry Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date *</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden text-rose-700 font-medium"
                required
              />
            </div>

            {/* Storage Instructions */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Instructions</label>
              <textarea
                value={storageInstructions}
                onChange={(e) => setStorageInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. Keep refrigerated below 4 degrees. Do not freeze."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium py-2 text-sm transition-colors cursor-pointer"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving Changes...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
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
