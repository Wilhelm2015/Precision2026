import React, { useState, useMemo } from 'react';
import { Equipment, Client, InspectionRecord, EquipmentType, TaskType, Technician } from '../types';
import { syncService } from '../services/registryService';

interface DetectionHubProps {
  equipment: Equipment[];
  clients: Client[];
  records: InspectionRecord[];
  activeClientId: string | null;
  activeTech: Technician | null;
  onRefresh: () => void;
  onRequestClientPicker: () => void;
  onGenerateDetectionCOC: (clientId: string) => void;
}

const DetectionHub: React.FC<DetectionHubProps> = ({ equipment, clients, records, activeClientId, activeTech, onRefresh, onRequestClientPicker, onGenerateDetectionCOC }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(activeClientId || '');
  
  const [formData, setFormData] = useState({
    type: EquipmentType.SMOKE_DETECTOR,
    location: '',
    quantity: '1',
    manufacturer: 'Nittan'
  });

  useMemo(() => {
    if (activeClientId) setSelectedSiteId(activeClientId);
  }, [activeClientId]);

  const detectionAssets = useMemo(() => {
    return equipment.filter(e => 
      e.type === EquipmentType.SMOKE_DETECTOR || 
      e.type === EquipmentType.FIRE_DOOR
    );
  }, [equipment]);

  const filteredDetection = useMemo(() => {
    if (!selectedSiteId || selectedSiteId === 'All') return detectionAssets;
    return detectionAssets.filter(e => e.client_id === selectedSiteId);
  }, [detectionAssets, selectedSiteId]);

  const canGenerateCOC = useMemo(() => {
    if (!selectedSiteId || selectedSiteId === 'All') return false;
    return filteredDetection.length > 0;
  }, [filteredDetection, selectedSiteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSiteId || selectedSiteId === 'All') {
      alert("MANDATORY: Please select or register a site first.");
      onRequestClientPicker();
      return;
    }

    setIsSubmitting(true);
    try {
      const qty = parseInt(formData.quantity) || 1;
      const assets: Equipment[] = [];
      
      for (let i = 0; i < qty; i++) {
        assets.push({
          id: Math.random().toString(36).substr(2, 9),
          serialNumber: `DET-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`,
          type: formData.type,
          manufacturer: formData.manufacturer,
          location: formData.location,
          lastInspectionDate: null,
          nextServiceDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
          client_id: selectedSiteId,
          isArchived: false,
          photos: []
        });
      }

      await syncService.saveEquipment(assets);
      onRefresh();
      setIsAdding(false);
      setFormData({ ...formData, location: '', quantity: '1' });
    } catch (err: any) {
      alert("Registration failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAudit = async (asset: Equipment) => {
    const record: InspectionRecord = {
      id: Math.random().toString(36).substr(2, 9),
      equipmentId: asset.id,
      equipmentType: asset.type,
      taskType: TaskType.MAINTENANCE,
      inspectorName: activeTech ? activeTech.name : 'Authorised Tech',
      date: new Date().toISOString().split('T')[0],
      status: 'Pass',
      findings: { 'functional_test': true, 'clean_condition': true },
      notes: "Routine detection system functional test passed."
    };

    try {
      await syncService.saveInspection(record);
      onRefresh();
    } catch (err: any) {
      alert("Sync failed: " + err.message);
    }
  };

  const currentClient = clients.find(c => c.id === selectedSiteId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em]">Detection Node</span>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tight leading-none">Detection Hub</h2>
          <p className="text-slate-400 text-sm font-medium max-w-md">Quantity-based tracking for smoke detectors, heat sensors, and fire doors.</p>
        </div>
        <div className="flex flex-wrap gap-3 relative z-10 justify-center">
           <button 
             onClick={onRequestClientPicker}
             className="bg-white/10 text-white px-8 py-5 rounded-3xl font-black uppercase tracking-widest border border-white/20 hover:bg-white/20 transition-all text-xs"
           >
             {currentClient ? 'Change Site' : 'Link Property'}
           </button>
           <button 
             onClick={() => setIsAdding(true)}
             className="bg-red-600 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-red-700 active:scale-95 transition-all text-xs"
           >
             Add Batch Units
           </button>
           {canGenerateCOC && (
             <button 
               onClick={() => onGenerateDetectionCOC(selectedSiteId)}
               className="bg-amber-50 text-white px-8 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-amber-600 active:scale-95 transition-all text-xs flex items-center gap-2"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
               Detection COM
             </button>
           )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 no-print">
        <div className="flex-1">
           <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Current Active Site</label>
           <div className="bg-white border-2 border-slate-100 rounded-2xl px-6 py-4 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-4">
                 <div className={`w-3 h-3 rounded-full ${currentClient ? 'bg-emerald-500' : 'bg-red-500'}`} />
                 <span className="font-black uppercase text-xs text-slate-900">
                    {currentClient ? currentClient.name : 'NO SITE SELECTED - REGISTRATION LOCKED'}
                 </span>
              </div>
              {!currentClient && (
                <button onClick={onRequestClientPicker} className="text-[9px] font-black text-red-600 uppercase underline decoration-2">Setup Property Now</button>
              )}
           </div>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase tracking-tight">Bulk Detection Registration</h3>
                 <button onClick={() => setIsAdding(false)} className="text-white/40 hover:text-white text-2xl">&times;</button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Asset Type</label>
                       <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm">
                          <option value={EquipmentType.SMOKE_DETECTOR}>Smoke Detector</option>
                          <option value={EquipmentType.FIRE_DOOR}>Fire Door</option>
                       </select>
                    </div>
                    <div>
                       <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Batch Quantity</label>
                       <input type="number" min="1" max="100" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" />
                    </div>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Manufacturer/Brand</label>
                    <input type="text" value={formData.manufacturer} onChange={e => setFormData({...formData, manufacturer: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5">Floor / Location</label>
                    <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Ground Floor Passage" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm" />
                 </div>
                 <button disabled={isSubmitting} type="submit" className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                    {isSubmitting ? 'Writing to Registry...' : 'Authorize Batch Entry'}
                 </button>
              </form>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDetection.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
             <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No detection units registered for this site.</p>
          </div>
        ) : (
          filteredDetection.map(item => (
            <div key={item.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
              <div>
                 <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">{item.type}</h4>
                 <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{item.location}</p>
                 <p className="text-[8px] text-red-600 font-black uppercase tracking-widest mt-1">BRAND: {item.manufacturer}</p>
              </div>
              <button 
                onClick={() => handleAudit(item)}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all active:scale-95"
              >
                Test Pass
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DetectionHub;