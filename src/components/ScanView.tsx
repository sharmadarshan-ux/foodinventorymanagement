/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  FileText, 
  AlertCircle, 
  PlusCircle, 
  CheckCircle, 
  RefreshCw, 
  ArrowLeft,
  X,
  HelpCircle,
  HelpCircle as InfoIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import { ScanResult, InventoryItem } from '../types';

interface ScanViewProps {
  onItemSaved: () => void;
  departmentCode?: string;
}

export default function ScanView({ onItemSaved, departmentCode }: ScanViewProps) {
  const [activeSubMode, setActiveSubMode] = useState<'scan' | 'manual'>('scan');
  
  // File Scanning states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form confirmation states
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('Dairy');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('Liters');
  const [expiryDate, setExpiryDate] = useState('');
  const [fssaiLicense, setFssaiLicense] = useState('');
  const [storageInstructions, setStorageInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['Dairy', 'Bakery', 'Produce', 'Pantry', 'Meat/Fish', 'Frozen', 'Beverages', 'Spices', 'Other'];
  const units = ['Liters', 'Grams', 'Pieces', 'Pack', 'Loaf', 'Kgs', 'Units'];

  // Handle Drag Events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, or WEBP).');
      return;
    }
    
    setSelectedFile(file);
    setError(null);
    setSaveSuccess(false);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // Perform Gemini Scan
  const handleScanSubmit = async () => {
    if (!selectedFile) return;

    setIsScanning(true);
    setError(null);
    setScanResult(null);

    // Progressive scanning statuses to show off Gemini's multi-step capabilities
    const steps = [
      'Sending food label to Google Gemini Vision...',
      'Analyzing label OCR and regulatory seals...',
      'Extracting product name and category...',
      'Parsing expiration date...',
      'Verifying FSSAI registration records...',
      'Mapping climate storage guidelines...'
    ];

    let stepIndex = 0;
    setScanStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIndex++;
      if (stepIndex < steps.length) {
        setScanStep(steps[stepIndex]);
      }
    }, 450);

    try {
      const result = await api.scanLabel(selectedFile);
      clearInterval(stepInterval);
      setScanResult(result);
      
      // Seed the editable confirmation form
      setProductName(result.product_name);
      setCategory(result.category || 'Dairy');
      setQuantity(result.quantity || 1);
      setUnit(result.unit || 'Liters');
      setExpiryDate(result.expiry_date);
      setFssaiLicense(result.fssai_license_no || '');
      setStorageInstructions(result.storage_instructions || '');

    } catch (err: any) {
      clearInterval(stepInterval);
      setError('Failed to scan label with Gemini. Would you like to enter details manually?');
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  // Submit final item to /api/inventory
  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      setError('Product Name is required.');
      return;
    }
    if (!expiryDate) {
      setError('Expiry Date is required.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than 0.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await api.createItem({
        name: productName.trim(),
        category,
        quantity: Number(quantity),
        unit,
        entry_date: todayStr,
        expiry_date: expiryDate,
        fssai_license_no: fssaiLicense.trim() || undefined,
        storage_instructions: storageInstructions.trim() || undefined,
        ...(departmentCode ? { department: departmentCode } : {})
      });
      
      setSaveSuccess(true);
      onItemSaved(); // trigger reload on main page
      
      // Reset form
      if (activeSubMode === 'scan') {
        setSelectedFile(null);
        setImagePreview(null);
        setScanResult(null);
      } else {
        setProductName('');
        setQuantity(1);
        setExpiryDate('');
        setFssaiLicense('');
        setStorageInstructions('');
      }

    } catch (err: any) {
      setError(err?.message || 'Failed to add item to inventory. Check database connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    setImagePreview(null);
    setScanResult(null);
    setError(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      
      {/* Mode Selector Tab Header */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveSubMode('scan');
            setError(null);
            setSaveSuccess(false);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubMode === 'scan'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Camera className="h-4 w-4" />
          AI Label Scanner
        </button>
        <button
          onClick={() => {
            setActiveSubMode('manual');
            setError(null);
            setSaveSuccess(false);
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeSubMode === 'manual'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          Manual Entry Form
        </button>
      </div>

      <AnimatePresence mode="wait">
        
        {/* SUCCESS ALERT BANNER */}
        {saveSuccess && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-start gap-3 shadow-xs"
          >
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">Stock Added Successfully!</p>
              <p className="text-xs text-emerald-700 mt-0.5">
                The food item was saved and risk metrics recalculated. Check the Dashboard to view real-time warnings.
              </p>
            </div>
            <button 
              onClick={() => setSaveSuccess(false)}
              className="ml-auto text-emerald-600 hover:text-emerald-800 text-xs font-bold"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* ERROR DISPLAY */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-start gap-3"
          >
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Operation Failed</p>
              <p className="text-xs text-rose-700 mt-0.5">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)}
              className="p-1 rounded text-rose-500 hover:bg-rose-100"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* 1. AI LABEL SCANNER PAGE */}
        {activeSubMode === 'scan' && (
          <motion.div
            key="scan-mode"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            
            {/* FILE DROP ZONE OR SCAN LOADING */}
            {!imagePreview && !isScanning && (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`flex flex-col items-center justify-center p-12 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                  isDragActive 
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99]' 
                    : 'border-slate-300 hover:border-emerald-400 bg-white'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />
                
                <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
                  <Upload className="h-6 w-6" />
                </div>
                
                <h4 className="font-display font-bold text-slate-800 mb-1 text-center">
                  Drag and Drop Food Label Photo
                </h4>
                <p className="text-xs text-slate-500 mb-4 text-center max-w-sm">
                  Support JPEG, PNG, or WebP. Take a photo of the packet or barcode, or click to browse files.
                </p>
                <div className="rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-3 py-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Gemini API Auto-Fills Expiry & FSSAI
                </div>
              </div>
            )}

            {/* AI SCANNING ANIMATED PANEL */}
            {isScanning && (
              <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-slate-200 bg-white shadow-xs text-center">
                <div className="relative mb-6">
                  <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-emerald-600 animate-spin" />
                  <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-emerald-600 animate-pulse" />
                </div>
                <h4 className="font-display font-bold text-slate-800 text-base">Gemini Intelligent Extraction</h4>
                <p className="text-xs font-mono text-emerald-700 mt-2 bg-emerald-50 px-3 py-1 rounded-full animate-pulse">
                  {scanStep}
                </p>
                <div className="w-full max-w-xs bg-slate-100 h-1 rounded-full mt-5 overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full animate-[shimmer_1.5s_infinite_linear]" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {/* IMAGE PREVIEW AND CONFIRM PANEL */}
            {imagePreview && !isScanning && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Photo Preview Column */}
                <div className="md:col-span-5 space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-black flex items-center justify-center aspect-square">
                    <img 
                      src={imagePreview} 
                      alt="Food label preview" 
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      onClick={handleClearImage}
                      className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors"
                      title="Clear photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {!scanResult ? (
                    <button
                      onClick={handleScanSubmit}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 text-sm transition-all shadow-md shadow-emerald-100 cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4 animate-bounce" />
                      Scan with Gemini Vision
                    </button>
                  ) : (
                    <button
                      onClick={handleClearImage}
                      className="w-full text-center text-slate-500 hover:text-slate-700 text-xs font-semibold"
                    >
                      Scan a different package
                    </button>
                  )}
                </div>

                {/* Editable Confirmation Form Column */}
                <div className="md:col-span-7">
                  {scanResult ? (
                    <motion.form 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onSubmit={handleSaveInventory} 
                      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4"
                    >
                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3">
                        <Sparkles className="h-4 w-4 text-emerald-600" />
                        <div>
                          <h4 className="font-display font-bold text-slate-800 text-sm">Review Extracted Data</h4>
                          <p className="text-[10px] text-slate-500">Gemini scanned values. Please confirm accuracy.</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                          <input
                            type="text"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-hidden"
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                            <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
                            >
                              {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Type</label>
                            <select
                              value={unit}
                              onChange={(e) => setUnit(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-hidden bg-white"
                            >
                              {units.map(ut => (
                                <option key={ut} value={ut}>{ut}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={quantity}
                              onChange={(e) => setQuantity(Number(e.target.value))}
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-hidden"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date *</label>
                            <input
                              type="date"
                              value={expiryDate}
                              onChange={(e) => setExpiryDate(e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-rose-700 font-bold focus:border-emerald-500 focus:outline-hidden"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">FSSAI License No.</label>
                          <input
                            type="text"
                            maxLength={14}
                            value={fssaiLicense}
                            onChange={(e) => setFssaiLicense(e.target.value.replace(/\D/g, ''))}
                            placeholder="14-digit FSSAI"
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Instructions</label>
                          <textarea
                            value={storageInstructions}
                            onChange={(e) => setStorageInstructions(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-hidden"
                          />
                        </div>

                      </div>

                      <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-2.5 text-sm transition-colors shadow-xs mt-4 cursor-pointer"
                      >
                        <PlusCircle className="h-4 w-4" />
                        {isSaving ? 'Saving to Inventory...' : 'Confirm & Save to Inventory'}
                      </button>
                    </motion.form>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50 flex flex-col items-center justify-center h-full min-h-[300px]">
                      <Sparkles className="h-8 w-8 text-slate-300 mb-2 animate-bounce" />
                      <h4 className="font-display font-bold text-slate-700 text-sm">Review Details</h4>
                      <p className="text-xs text-slate-400 max-w-xs mt-1">
                        Select "Scan with Gemini Vision" on the left to activate auto-fill, or switch to manual entry above.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}

          </motion.div>
        )}

        {/* 2. MANUAL ENTRY FALLBACK FORM */}
        {activeSubMode === 'manual' && (
          <motion.div
            key="manual-mode"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs max-w-xl mx-auto"
          >
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-5">
              <FileText className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="font-display font-bold text-slate-950 text-base">Direct Food Registration</h3>
                <p className="text-xs text-slate-500">Add an item without label scanning fallback</p>
              </div>
            </div>

            <form onSubmit={handleSaveInventory} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Britannia Mozzarella Cheese"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date *</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-rose-700 font-bold focus:border-emerald-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">FSSAI License No.</label>
                <input
                  type="text"
                  maxLength={14}
                  value={fssaiLicense}
                  onChange={(e) => setFssaiLicense(e.target.value.replace(/\D/g, ''))}
                  placeholder="14-digit FSSAI license (e.g. 10015022003595)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Instructions</label>
                <textarea
                  value={storageInstructions}
                  onChange={(e) => setStorageInstructions(e.target.value)}
                  rows={2}
                  placeholder="e.g. Refrigerate at 4°C. Consume within 3 days of opening."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold py-2.5 text-sm transition-colors shadow-xs mt-4 cursor-pointer"
              >
                <PlusCircle className="h-4 w-4" />
                {isSaving ? 'Adding Stock...' : 'Save to Inventory'}
              </button>

            </form>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
}
