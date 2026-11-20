/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Share2, 
  Building2, 
  MapPin, 
  Plus, 
  Check, 
  X, 
  Zap, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle,
  Truck,
  Mail,
  Phone,
  Layers,
  Sparkles,
  Clock,
  Package,
  Navigation,
  CheckSquare,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../api';
import { Institution, SurplusMatch, InventoryItem, DiscoveredPlace } from '../types';

interface SurplusViewProps {
  onItemSaved?: () => void;
}

export default function SurplusView({ onItemSaved }: SurplusViewProps) {
  // State for institutions
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstId, setSelectedInstId] = useState<string | number>('');

  // Dual role tabs: 'incoming' (acting as recipient) vs 'outgoing' (acting as donor)
  const [activeRoleTab, setActiveRoleTab] = useState<'incoming' | 'outgoing'>('incoming');

  // State for surplus items and matches
  const [surplusItems, setSurplusItems] = useState<InventoryItem[]>([]);
  const [matches, setMatches] = useState<SurplusMatch[]>([]);

  // Simulation transit progress mapping (matchId -> current stage 0..3)
  const [transitStages, setTransitStages] = useState<Record<string, number>>({});
  // Simulation drivers
  const [drivers, setDrivers] = useState<Record<string, { name: string; phone: string; vehicle: string }>>({});

  // Page level state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [showRegForm, setShowRegForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'hostel',
    latitude: '12.9716',
    longitude: '80.2454',
    contact_email: '',
    contact_phone: ''
  });

  // Nearby Places state
  const [nearbyPlaces, setNearbyPlaces] = useState<DiscoveredPlace[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyFromCache, setNearbyFromCache] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [invitingPlaceId, setInvitingPlaceId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [instsRes, surplusRes, matchesRes] = await Promise.all([
        api.getInstitutions(),
        api.detectSurplus(),
        api.getSurplusMatches()
      ]);
      setInstitutions(Array.isArray(instsRes) ? instsRes : []);
      setSurplusItems(Array.isArray(surplusRes) ? surplusRes : []);
      setMatches(Array.isArray(matchesRes) ? matchesRes : []);

      if (instsRes.length > 0 && !selectedInstId) {
        setSelectedInstId(instsRes[0].id);
      }
    } catch (err) {
      console.error('Failed to load Surplus Network data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle auto-progress simulation for accepted matches
  useEffect(() => {
    const timer = setInterval(() => {
      setTransitStages(prev => {
        const next = { ...prev };
        let updated = false;
        
        matches.forEach(m => {
          if (m.status === 'accepted') {
            const currentStage = next[m.id] !== undefined ? next[m.id] : 0;
            if (currentStage < 3) {
              next[m.id] = currentStage + 1;
              updated = true;
            }
          }
        });

        return updated ? next : prev;
      });
    }, 12000); // Progress logistics every 12 seconds for an automated demo experience

    return () => clearInterval(timer);
  }, [matches]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contact_email || !formData.contact_phone) {
      setMessage({ type: 'error', text: 'Please fill in all required registration fields.' });
      return;
    }

    setActionLoading('register');
    try {
      const created = await api.registerInstitution({
        name: formData.name,
        type: formData.type,
        latitude: parseFloat(formData.latitude) || 12.9716,
        longitude: parseFloat(formData.longitude) || 80.2454,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone
      });

      setInstitutions(prev => [...prev, created]);
      setSelectedInstId(created.id);
      setShowRegForm(false);
      setFormData({
        name: '',
        type: 'hostel',
        latitude: '12.9716',
        longitude: '80.2454',
        contact_email: '',
        contact_phone: ''
      });
      setMessage({ type: 'success', text: `Successfully registered "${created.name}" to the surplus sharing network!` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to register institution. Please check fields.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerMatch = async () => {
    if (!selectedInstId) {
      setMessage({ type: 'error', text: 'Please register or select an active source institution.' });
      return;
    }

    setActionLoading('match');
    setMessage(null);
    try {
      const matchedRes = await api.triggerMatching(selectedInstId);
      setMatches(Array.isArray(matchedRes) ? matchedRes : []);
      setMessage({ type: 'success', text: 'Surplus Intelligence Network run completed! Generated nearby matching proposals.' });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error executing match recommendation query.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunDailyCheck = async () => {
    setActionLoading('daily');
    setMessage(null);
    try {
      const result = await api.runSurplusCheck();
      const matchesRes = await api.getSurplusMatches();
      setMatches(Array.isArray(matchesRes) ? matchesRes : []);
      setMessage({ type: 'success', text: result.message });
      if (onItemSaved) {
        onItemSaved(); // Propagate updates to header alerts counter
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error executing automated daily surplus run.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDiscoverNearby = async (refresh = false) => {
    if (!selectedInstId) {
      setMessage({ type: 'error', text: 'Please select an institution first.' });
      return;
    }
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      // Pass lat/lng directly so the backend can call Google Places API
      // even when the institution is a demo/mock entry not in the DB.
      const inst = institutions.find(i => String(i.id) === String(selectedInstId));
      const result = await api.getNearbyPlaces(
        selectedInstId,
        10,
        refresh,
        inst?.latitude,
        inst?.longitude,
        inst?.name,
      );
      setNearbyPlaces(result.places || []);
      setNearbyFromCache(result.from_cache);
      setNearbyError(result.error);
    } catch (err) {
      console.error('Nearby places error:', err);
      setNearbyError('Failed to discover nearby places.');
    } finally {
      setNearbyLoading(false);
    }
  };

  const handleInvitePlace = async (placeId: string) => {
    setInvitingPlaceId(placeId);
    try {
      await api.invitePlace(placeId);
      setNearbyPlaces(prev =>
        prev.map(p => p.place_id === placeId ? { ...p, invited: true } : p)
      );
      setMessage({ type: 'success', text: 'Invitation intent recorded! This place will be notified when the outreach system is live.' });
    } catch (err) {
      console.error('Invite error:', err);
      setMessage({ type: 'error', text: 'Failed to send invite.' });
    } finally {
      setInvitingPlaceId(null);
    }
  };

  const [addingPlaceId, setAddingPlaceId] = useState<string | null>(null);

  const handleAddPlaceAsKitchen = async (place: DiscoveredPlace) => {
    setAddingPlaceId(place.place_id);
    try {
      // Map place_type to institution type
      const typeMap: Record<string, string> = {
        college: 'canteen',
        hostel: 'hostel',
        restaurant: 'restaurant',
        other: 'hostel',
      };
      const created = await api.registerInstitution({
        name: place.name,
        type: typeMap[place.place_type] || 'hostel',
        latitude: place.latitude,
        longitude: place.longitude,
        contact_email: '',
        contact_phone: '',
      });
      setInstitutions(prev => [...prev, created]);
      setSelectedInstId(created.id);
      // Mark as registered in the nearby list
      setNearbyPlaces(prev =>
        prev.map(p => p.place_id === place.place_id ? { ...p, is_registered: true } : p)
      );
      setMessage({ type: 'success', text: `"${place.name}" added as an Active Sandbox Kitchen!` });
    } catch (err) {
      console.error('Add place error:', err);
      setMessage({ type: 'error', text: `Failed to add "${place.name}" as a kitchen.` });
    } finally {
      setAddingPlaceId(null);
    }
  };

  const getPlaceIcon = (type: string) => {
    switch (type) {
      case 'college': return '🎓';
      case 'hostel': return '🏨';
      case 'restaurant': return '🍽️';
      default: return '📍';
    }
  };

  const handleRespond = async (id: string | number, status: 'accepted' | 'declined') => {
    setActionLoading(`respond_${id}`);
    try {
      const updated = await api.respondToMatch(id, status);
      setMatches(prev => prev.map(m => m.id === id ? updated : m));
      
      if (status === 'accepted') {
        // Initialize mock courier driver info
        const driversList = [
          { name: 'Karthik Raja', phone: '+91 98402 11022', vehicle: 'EcoVan - TN-07-CM-4482' },
          { name: 'Sanjay Kumar', phone: '+91 94441 55901', vehicle: 'MiniTruck - TN-10-AJ-3112' },
          { name: 'Mari Selvam', phone: '+91 91235 60231', vehicle: 'CargoThreeWheeler - TN-19-P-8801' }
        ];
        const randomDriver = driversList[Math.floor(Math.random() * driversList.length)];
        
        setDrivers(prev => ({
          ...prev,
          [id]: randomDriver
        }));

        setTransitStages(prev => ({
          ...prev,
          [id]: 0 // Start from Packaging
        }));
      }

      setMessage({ 
        type: 'success', 
        text: `Match ${status === 'accepted' ? 'ACCEPTED' : 'DECLINED'}. ${status === 'accepted' ? 'Logistics driver dispatched!' : 'Notification updated.'}` 
      });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Error responding to matching recommendation.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualAdvanceStage = (matchId: string | number) => {
    setTransitStages(prev => {
      const current = prev[matchId] !== undefined ? prev[matchId] : 0;
      if (current < 3) {
        return { ...prev, [matchId]: current + 1 };
      }
      return prev;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <Check className="h-3 w-3" /> Accepted
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <X className="h-3 w-3" /> Declined
          </span>
        );
      case 'proposed':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 animate-pulse">
            Proposed
          </span>
        );
    }
  };

  // Filter matches based on chosen role view and acting institution
  const safeMatches = Array.isArray(matches) ? matches : [];
  const incomingMatches = safeMatches.filter(m => String(m.matched_institution_id) === String(selectedInstId));
  const outgoingMatches = safeMatches.filter(m => String(m.source_institution_id) === String(selectedInstId));

  const filteredMatchesByRole = activeRoleTab === 'incoming' ? incomingMatches : outgoingMatches;

  return (
    <div className="space-y-6">
      
      {/* Top Banner introducing the network */}
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/75 p-6 flex flex-col lg:flex-row items-center justify-between gap-6 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-100 shrink-0">
            <Share2 className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-indigo-950 text-base md:text-lg">Cross-Kitchen Surplus Intelligence Network</h3>
              <span className="rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2.5 py-0.5 border border-indigo-200 uppercase tracking-wider">
                B2B Redistribution Grid
              </span>
            </div>
            <p className="text-xs text-indigo-800 leading-relaxed max-w-2xl">
              Prevent kitchen waste by automatically routing surplus food items to nearby hostels, college canteens, and charitable kitchens. The engine utilizes <strong>Haversine math</strong> to match items within a 10km radius.
            </p>
          </div>
        </div>

        {/* Action button section for Demo */}
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
          <button
            onClick={handleRunDailyCheck}
            disabled={actionLoading !== null}
            className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold py-2.5 px-4 text-xs transition-all cursor-pointer shadow-xs"
          >
            {actionLoading === 'daily' ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            )}
            Run Daily Surplus Job (Dev Tool)
          </button>
          
          <button
            onClick={() => setShowRegForm(!showRegForm)}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 text-xs transition-all cursor-pointer shadow-md shadow-indigo-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Kitchen
          </button>
        </div>
      </div>

      {/* Global Status Banner Messages */}
      <AnimatePresence mode="wait">
        {message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`rounded-xl p-4 flex items-start gap-3 border ${
              message.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-900' 
                : 'bg-rose-50 border-rose-100 text-rose-900'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-xs font-medium flex-1">
              {message.text}
            </div>
            <button 
              onClick={() => setMessage(null)} 
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold px-1"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Register Institution Drawer Panel */}
      {showRegForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-600" />
              <h3 className="font-display font-bold text-slate-900 text-sm md:text-base">Register Your Kitchen on the Sharing Grid</h3>
            </div>
            <button 
              onClick={() => setShowRegForm(false)} 
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleRegister} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-5">
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Kitchen / Institution Name *</label>
              <input
                type="text"
                placeholder="e.g. Campus Hostel Block A"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs focus:bg-white focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Facility Type</label>
              <select
                value={formData.type}
                onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs focus:bg-white focus:border-indigo-500"
              >
                <option value="hostel">Hostel Mess / Kitchen</option>
                <option value="canteen">College Canteen</option>
                <option value="restaurant">Restaurant / Eatery</option>
                <option value="charity">Charity / Food Bank</option>
              </select>
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Latitude (GPS) *</label>
              <input
                type="number"
                step="0.000001"
                required
                value={formData.latitude}
                onChange={e => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Longitude (GPS) *</label>
              <input
                type="number"
                step="0.000001"
                required
                value={formData.longitude}
                onChange={e => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-6 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Auditor / Manager Email *</label>
              <input
                type="email"
                placeholder="manager@kitchen.com"
                required
                value={formData.contact_email}
                onChange={e => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-6 space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Contact Telephone *</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                required
                value={formData.contact_phone}
                onChange={e => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div className="md:col-span-12 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowRegForm(false)}
                className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading === 'register'}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-5 py-2.5 text-xs font-semibold transition shadow-md shadow-indigo-100"
              >
                {actionLoading === 'register' ? 'Registering...' : 'Complete Registry'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Main Core Layout: Left column surplus candidates & selection, Right column matches */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (5/12 widths) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Active Demo Identity Selection card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Layers className="h-5 w-5 text-slate-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Demo Simulation Identity</h3>
            </div>
            
            <div className="space-y-3.5">
              <p className="text-xs text-slate-500 leading-relaxed">
                Choose which kitchen you are currently acting on behalf of. The grid is multi-sided; changing this switches who can accept or track items.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 font-sans">Active Sandbox Kitchen</label>
                <select
                  value={selectedInstId}
                  onChange={e => setSelectedInstId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-hidden"
                >
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name} ({inst.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleTriggerMatch}
                disabled={actionLoading !== null || !selectedInstId}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3 text-xs transition shadow-md shadow-indigo-200 cursor-pointer"
              >
                {actionLoading === 'match' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 text-amber-300" />
                )}
                Find Redistribution Matches Now
              </button>
            </div>
          </div>

          {/* Surplus Candidate List panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Surplus Candidates</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600">
                {surplusItems.length} Identified
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              These are critical food stock items expiring soon with high volume and zero recent waste logs. They are ideal candidates for redistribution before spoiling.
            </p>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {surplusItems.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No active critical surplus detected. All fresh!
                </div>
              ) : (
                surplusItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800">{item.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-mono font-medium px-1.5 rounded">
                          {item.category}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Expires {item.expiry_date}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700">{item.quantity} {item.unit}</p>
                      <span className="text-[9px] uppercase font-bold text-rose-600 tracking-wider">
                        Critical Expiry
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Nearby Institutions Discovery Panel */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Navigation className="h-5 w-5 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Nearby Institutions</h3>
              </div>
              <button
                onClick={() => handleDiscoverNearby(false)}
                disabled={nearbyLoading || !selectedInstId}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 px-3 py-1.5 text-[10px] font-bold transition cursor-pointer"
              >
                {nearbyLoading ? (
                  <><RefreshCw className="h-3 w-3 animate-spin" /> Scanning...</>
                ) : (
                  <><MapPin className="h-3 w-3" /> Discover</>
                )}
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Discover real colleges, hostels & hotels near your institution via Google Places. Grow the surplus network by inviting them to join.
            </p>

            {nearbyFromCache && nearbyPlaces.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 italic">Showing cached results</span>
                <button
                  onClick={() => handleDiscoverNearby(true)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-800 font-semibold cursor-pointer"
                >
                  ↑ Refresh from Google
                </button>
              </div>
            )}

            {nearbyError && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-[10px] text-amber-700">⚠️ {nearbyError}</p>
              </div>
            )}

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {nearbyPlaces.length === 0 && !nearbyLoading ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Click "Discover" to scan for nearby institutions
                </div>
              ) : nearbyLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-6 w-6 mx-auto mb-2 text-emerald-500 animate-spin" />
                  <p className="text-xs text-slate-500">Scanning Google Places API...</p>
                </div>
              ) : (
                nearbyPlaces.map(place => (
                  <motion.div
                    key={place.place_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start justify-between p-3 rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50/80 to-emerald-50/30 hover:border-emerald-200 transition-all group"
                  >
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <span className="text-lg mt-0.5">{getPlaceIcon(place.place_type)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{place.name}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{place.address}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[9px] bg-slate-100 text-slate-600 border border-slate-200 font-mono font-medium px-1.5 py-0.5 rounded-full capitalize">
                            {place.place_type}
                          </span>
                          {!place.is_registered && (
                            <span className="text-[9px] bg-orange-50 text-orange-600 border border-orange-100 font-medium px-1.5 py-0.5 rounded-full">
                              Not on platform
                            </span>
                          )}
                          {place.invited && (
                            <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" /> Invited
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 ml-2 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition">
                      {!place.is_registered && (
                        <button
                          onClick={() => handleAddPlaceAsKitchen(place)}
                          disabled={addingPlaceId === place.place_id}
                          className="flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-2.5 py-1.5 text-[10px] font-bold transition cursor-pointer"
                        >
                          {addingPlaceId === place.place_id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Plus className="h-3 w-3" /> Add</>
                          )}
                        </button>
                      )}
                      {place.is_registered && (
                        <span className="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" /> Added
                        </span>
                      )}
                      {!place.invited && !place.is_registered && (
                        <button
                          onClick={() => handleInvitePlace(place.place_id)}
                          disabled={invitingPlaceId === place.place_id}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white px-2.5 py-1.5 text-[10px] font-bold transition cursor-pointer"
                        >
                          {invitingPlaceId === place.place_id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <><Mail className="h-3 w-3" /> Invite</>
                          )}
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {nearbyPlaces.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">
                  {nearbyPlaces.length} places discovered · {nearbyPlaces.filter(p => p.invited).length} invited
                </span>
                <span className="text-[10px] text-slate-400">Powered by Google Places</span>
              </div>
            )}
          </div>

        </div>

        {/* Right Column (7/12 widths) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Two-Sided Role Selector Tabs */}
          <div className="flex rounded-xl bg-slate-200/60 p-1 border border-slate-200">
            <button
              onClick={() => setActiveRoleTab('incoming')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeRoleTab === 'incoming' 
                  ? 'bg-white text-indigo-950 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building2 className="h-4 w-4 text-indigo-600" />
              Incoming Requests (Recipient View)
              {incomingMatches.filter(m => m.status === 'proposed').length > 0 && (
                <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveRoleTab('outgoing')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all cursor-pointer ${
                activeRoleTab === 'outgoing' 
                  ? 'bg-white text-indigo-950 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Share2 className="h-4 w-4 text-indigo-600" />
              Outgoing Dispatches (Donor View)
            </button>
          </div>

          {/* Active matches feed */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4 min-h-[420px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-indigo-600" />
                <h3 className="font-display font-bold text-slate-900 text-sm md:text-base">
                  {activeRoleTab === 'incoming' ? 'Incoming Redistribution Alerts' : 'My Outgoing Transfers'}
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filteredMatchesByRole.length} items listed
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                <RefreshCw className="h-7 w-7 animate-spin text-indigo-500" />
                <p className="text-xs font-medium">Syncing active matching registry...</p>
              </div>
            ) : filteredMatchesByRole.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24 space-y-3">
                <div className="rounded-full bg-slate-50 p-4 border border-slate-100 text-slate-400">
                  <Share2 className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-800">No active transfers found</h4>
                  <p className="text-xs text-slate-400 max-w-sm">
                    {activeRoleTab === 'incoming' 
                      ? 'No incoming surplus proposed to this kitchen. Use the Daily Surplus Job button to mock transfers!' 
                      : 'You have not dispatched or proposed any surplus transfers yet. Click "Find Redistribution Matches" on the left panel to trigger matching!'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {filteredMatchesByRole.map((match) => {
                  const currentStage = transitStages[match.id] !== undefined ? transitStages[match.id] : 0;
                  const driverInfo = drivers[match.id] || {
                    name: 'Amul Logistics Dispatcher',
                    phone: '+91 94441 23450',
                    vehicle: 'EcoVan - TN-07-BY-1234'
                  };

                  return (
                    <motion.div
                      key={match.id}
                      layoutId={`match_${match.id}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4 shadow-xs"
                    >
                      
                      {/* Urgent Warning notification box for Proposed Incoming Items */}
                      {match.status === 'proposed' && activeRoleTab === 'incoming' && (
                        <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 flex items-start gap-2.5">
                          <ShieldAlert className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                          <div className="space-y-0.5">
                            <p className="text-[11px] font-bold text-orange-950 uppercase tracking-wider">Urgent Redistribution Call</p>
                            <p className="text-xs text-orange-800 leading-relaxed">
                              This item will expire shortly. Accept this transfer to schedule immediate dispatch and log onto your hygiene ledger.
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-red-600 animate-ping" />
                              <span className="text-[10px] font-mono text-red-700 font-bold">Estimated expiration countdown: ~24 Hours</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Source / Target visual flow */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-indigo-600" />
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">From (Sender)</p>
                            <span className="text-xs font-bold text-slate-800">{match.source_institution?.name || 'Local Kitchen'}</span>
                          </div>
                        </div>
                        
                        <div className="hidden sm:flex flex-col items-center justify-center px-2 shrink-0">
                          <div className="flex items-center text-indigo-600">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                            <span className="h-[1px] w-12 bg-indigo-200"></span>
                            <Truck className="h-3.5 w-3.5 mx-1 animate-bounce" />
                            <span className="h-[1px] w-12 bg-indigo-200"></span>
                          </div>
                          <span className="text-[9px] font-mono text-slate-400">Haversine 8.2 km</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-emerald-600" />
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">To (Recipient)</p>
                            <span className="text-xs font-bold text-slate-800">{match.matched_institution?.name || 'Recipient'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Proposal description */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800">
                            {match.surplus_item?.name || 'Surplus Item'} ({match.quantity_kg} Units)
                          </span>
                          {getStatusBadge(match.status)}
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed font-sans bg-amber-50/40 p-2.5 rounded-lg border border-amber-100/60 font-medium">
                          {match.message || 'Suggested redistribution.'}
                        </p>
                      </div>

                      {/* Live Logistics Tracker when status is accepted */}
                      {match.status === 'accepted' && (
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Truck className="h-4 w-4 text-indigo-600" /> Real-time Logistics Tracker
                            </span>
                            <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-sm font-semibold uppercase">
                              {currentStage === 0 && 'Packaging'}
                              {currentStage === 1 && 'Driver Assigned'}
                              {currentStage === 2 && 'In Transit'}
                              {currentStage === 3 && 'Delivered & Verified'}
                            </span>
                          </div>

                          {/* Steps progress track */}
                          <div className="relative pt-1.5">
                            <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-200 -z-0" />
                            <div 
                              className="absolute top-4 left-0 h-0.5 bg-indigo-600 -z-0 transition-all duration-1000" 
                              style={{ width: `${(currentStage / 3) * 100}%` }}
                            />
                            
                            <div className="flex justify-between relative z-10">
                              <div className="flex flex-col items-center">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStage >= 0 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                  <Package className="h-3 w-3" />
                                </div>
                                <span className="text-[9px] font-semibold text-slate-500 mt-1">Pack</span>
                              </div>
                              <div className="flex flex-col items-center">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStage >= 1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                  <CheckSquare className="h-3 w-3" />
                                </div>
                                <span className="text-[9px] font-semibold text-slate-500 mt-1">Dispatch</span>
                              </div>
                              <div className="flex flex-col items-center">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStage >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                  <Navigation className="h-3 w-3" />
                                </div>
                                <span className="text-[9px] font-semibold text-slate-500 mt-1">Transit</span>
                              </div>
                              <div className="flex flex-col items-center">
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold ${currentStage >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                                  <Check className="h-3 w-3" />
                                </div>
                                <span className="text-[9px] font-semibold text-slate-500 mt-1">Arrived</span>
                              </div>
                            </div>
                          </div>

                          {/* Driver information & manual advance button */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 text-xs">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 font-mono text-sm uppercase">
                                {driverInfo.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{driverInfo.name} <span className="text-[9px] font-normal text-slate-500">({driverInfo.vehicle})</span></p>
                                <p className="text-[10px] text-slate-500 font-mono">{driverInfo.phone}</p>
                              </div>
                            </div>

                            {currentStage < 3 ? (
                              <button
                                onClick={() => handleManualAdvanceStage(match.id)}
                                className="flex items-center justify-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                              >
                                Advance Logistics Step <ArrowRight className="h-3 w-3" />
                              </button>
                            ) : (
                              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                                <CheckCircle className="h-4 w-4" /> Transfer Completed & Logged!
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Meta info & Action buttons */}
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center gap-3.5 w-full sm:w-auto text-[10px] text-slate-400 font-mono">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{match.matched_institution?.contact_email}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{match.matched_institution?.contact_phone}</span>
                          </div>
                        </div>

                        {match.status === 'proposed' && activeRoleTab === 'incoming' && (
                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                            <button
                              onClick={() => handleRespond(match.id, 'declined')}
                              disabled={actionLoading !== null}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-1.5 cursor-pointer transition"
                            >
                              <X className="h-3.5 w-3.5 text-rose-500" /> Decline
                            </button>
                            <button
                              onClick={() => handleRespond(match.id, 'accepted')}
                              disabled={actionLoading !== null}
                              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-1.5 cursor-pointer transition shadow-sm shadow-indigo-100"
                            >
                              <Check className="h-3.5 w-3.5 text-white" /> Accept Transfer
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
