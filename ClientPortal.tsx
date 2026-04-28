import React, { useState, useEffect } from 'react';
import { Client, Technician } from '../types';
import { geminiService } from '../services/geminiService';

interface ClientPickerProps {
  clients: Client[];
  onSelect: (client: Client) => void;
  onAddClient: (client: Client) => Promise<Client>;
  onCancel: () => void;
  isCondemnationPrompt?: boolean;
  initialSearch?: string;
  activeTech?: Technician | null;
}

const ClientPicker: React.FC<ClientPickerProps> = ({ clients, onSelect, onAddClient, onCancel, isCondemnationPrompt = false, initialSearch = '', activeTech = null }) => {
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isAdding, setIsAdding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    building: '',
    address: '',
    slaAmount: '0.00'
  });

  // Technician Search Logic
  const filteredClients = clients
    .filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (c.building || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.address.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const dateA = a.created_at || a.createdAt || '';
      const dateB = b.created_at || b.createdAt || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  useEffect(() => {
    if (initialSearch && !isAdding) {
      setSearchTerm(initialSearch);
    }
  }, [initialSearch, isAdding]);

  const handleCancelAction = () => {
    if (isAdding && (formData.name || formData.address)) {
      if (window.confirm("Discard new site details and return?")) {
        setIsAdding(false);
      }
    } else if (isAdding) {
      setIsAdding(false);
    } else {
      onCancel();
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    if (!formData.name.trim() || !formData.address.trim()) {
        alert("Site Name and Physical Address are mandatory for SANS compliance.");
        return;
    }

    setIsSaving(true);
    try {
      const newClient: Client = {
        id: Math.random().toString(36).substr(2, 9).toUpperCase(),
        name: formData.name.trim(),
        building: formData.building.trim(),
        address: formData.address.trim(),
        createdAt: new Date().toISOString(),
        portalAccessGranted: false,
        portalPaused: true,
        portalPin: Math.floor(100000 + Math.random() * 900000).toString(),
        slaAmount: formData.slaAmount,
        technicianId: activeTech?.id
      };
      
      const savedClient = await onAddClient(newClient);
      
      // CRITICAL: Immediately select this client to link with the QR tag
      onSelect(savedClient || newClient);
    } catch (err: any) {
      alert(`Registry Error: ${err.message || "Could not save client"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDetectAddress = () => {
    if (!navigator.geolocation) {
      alert("GPS Error: Geolocation is not supported.");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await geminiService.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setFormData(prev => ({ ...prev, address: res.text.trim() }));
      } catch (err) {
        alert("AI Geocode Failed: " + (err as Error).message);
      } finally {
        setIsLocating(false);
      }
    }, (err) => {
      setIsLocating(false);
      alert(`Location Denied: ${err.message}`);
    }, { enableHighAccuracy: true });
  };

  return (
    <div className="bg-white rounded-[2.5rem] w-full overflow-hidden shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
      <div className={`p-8 text-white flex justify-between items-center shrink-0 ${isCondemnationPrompt ? 'bg-red-700' : 'bg-slate-900'}`}>
        <div className="flex items-center gap-4">
          <button onClick={handleCancelAction} className="p-2 hover:bg-white/10 rounded-xl flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
          </button>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">
              {isAdding ? 'Register New Site' : 'Site Selection'}
            </h3>
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-1">
              {isAdding ? 'SANS SITE ONBOARDING' : 'LINK TAG TO PROPERTY'}
            </p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-xl transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {!isAdding ? (
        <div className="p-8 space-y-6 flex flex-col overflow-hidden">
          {/* Technician Search Field */}
          <div className="relative">
            <input 
              autoFocus
              type="text" 
              placeholder="Search existing sites..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-12 py-4 outline-none focus:border-red-500 transition-all font-bold text-sm"
            />
            <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>

          <button 
            onClick={() => setIsAdding(true)}
            className={`w-full py-6 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl ${filteredClients.length === 0 ? 'bg-red-600 text-white shadow-red-200 border-4 border-red-500 animate-pulse' : 'bg-slate-900 text-white hover:bg-black'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
            {filteredClients.length === 0 ? 'Site Not Found - Register New Site' : 'Register New Client'}
          </button>

          <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
            <div className="grid grid-cols-1 gap-3">
              {filteredClients.length > 0 && (
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Existing Registry Matches</p>
              )}
              {filteredClients.map(client => (
                <button 
                  key={client.id}
                  onClick={() => onSelect(client)}
                  className="w-full p-5 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 text-left transition-all group"
                >
                  <div className="flex justify-between items-start">
                     <div className="font-black text-slate-900 uppercase text-xs">{client.name}</div>
                     <svg className="w-4 h-4 text-slate-300 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                  </div>
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1 truncate">{client.address}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleAddSubmit} className="p-8 space-y-6 overflow-y-auto">
          <div className="space-y-4">
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-2">
               <p className="text-[10px] text-emerald-800 font-bold leading-tight uppercase">
                 Creating new registry record. Ensure property details match official billing or physical location.
               </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Company / Entity Name *</label>
                <input required autoFocus value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" placeholder="e.g. Grand Plaza Mall" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Building Ref</label>
                <input value={formData.building} onChange={e => setFormData({...formData, building: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" placeholder="e.g. Block C" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subscription SLA (R)</label>
                <input type="number" step="0.01" value={formData.slaAmount} onChange={e => setFormData({...formData, slaAmount: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" placeholder="0.00" />
              </div>
            </div>
            
            <div className="relative">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Physical Site Address *</label>
              <textarea required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm h-28 resize-none" placeholder="Enter street address..." />
              <button 
                type="button" 
                onClick={handleDetectAddress} 
                disabled={isLocating} 
                className={`absolute right-4 bottom-4 text-[9px] font-black uppercase text-red-600 bg-white border-2 border-red-100 px-4 py-2 rounded-xl shadow-md hover:bg-red-50 active:scale-95 disabled:opacity-50 flex items-center gap-2 ${isLocating ? 'animate-pulse' : ''}`}
              >
                {isLocating ? (
                  <div className="w-3 h-3 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
                Auto-Fill GPS
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="submit" disabled={isSaving} className="flex-[2] bg-red-600 text-white font-black py-5 rounded-3xl shadow-xl hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest text-xs">
              {isSaving ? 'Writing to Registry...' : 'Save Site Details'}
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="flex-1 bg-slate-100 text-slate-400 font-black py-5 rounded-3xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ClientPicker;