import React, { useState, useMemo } from 'react';
import { Equipment, InspectionRecord, TaskType, Technician, Client } from '../types';
import { DISCARD_CHECKLIST } from '../constants';
import QRScanner from './QRScanner';
import { syncService } from '../services/registryService';

interface DiscardHubProps {
  equipment: Equipment[];
  records: InspectionRecord[];
  clients: Client[];
  activeTech: Technician | null;
  onRefresh: () => void;
  onViewReport: (equipmentId: string) => void;
  onViewSiteLedger: (clientId: string) => void;
}

const DiscardHub: React.FC<DiscardHubProps> = ({ equipment, records, clients, activeTech, onRefresh, onViewReport, onViewSiteLedger }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [targetAsset, setTargetAsset] = useState<Equipment | null>(null);
  const [findings, setFindings] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const failedUnits = useMemo(() => {
    return equipment.filter(e => {
        const assetRecords = records.filter(r => r.equipmentId === e.id);
        const latest = [...assetRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        // If archived, only show if it was condemned and hasn't been discarded yet
        if (e.isArchived) {
            const isDiscarded = assetRecords.some(r => r.taskType === TaskType.DISCARD);
            const wasCondemned = assetRecords.some(r => r.status === 'Condemned');
            return wasCondemned && !isDiscarded;
        }
        
        return latest?.status === 'Condemned' || latest?.status === 'Service Required' || (e.manufacturer || '').toLowerCase().includes('flash fire');
    });
  }, [equipment, records]);

  const pendingDisposal = useMemo(() => {
    return failedUnits.filter(e => e.isArchived);
  }, [failedUnits]);

  const discardedUnits = useMemo(() => {
    return equipment.filter(e => e.isArchived && records.some(r => r.equipmentId === e.id && r.taskType === TaskType.DISCARD));
  }, [equipment, records]);

  const siteDiscardStats = useMemo(() => {
    const map = new Map<string, number>();
    discardedUnits.forEach(u => {
      // Fix: Used u.client_id instead of u.clientId to match Equipment type definition
      if (u.client_id) {
        map.set(u.client_id, (map.get(u.client_id) || 0) + 1);
      }
    });
    return map;
  }, [discardedUnits]);

  const handleScan = (rawCode: string) => {
    const code = rawCode.startsWith('PFSA-1475:') ? rawCode.replace('PFSA-1475:', '') : rawCode;
    const asset = failedUnits.find(u => u.qrCode === code || u.serialNumber === code);
    if (asset) {
      setTargetAsset(asset);
      setShowScanner(false);
    } else {
      alert("Only units flagged as FAILED or CONDEMNED in the registry can be discarded here.");
    }
  };

  const handleRestore = async (asset: Equipment) => {
    if (window.confirm(`RESTORE ASSET: Are you sure you want to restore ${asset.serialNumber} back to the active registry?`)) {
        try {
            await syncService.saveEquipment({ ...asset, isArchived: false, archivedAt: undefined });
            alert("ASSET RESTORED: Unit is now back in the active registry.");
            onRefresh();
        } catch (e: any) {
            alert(e.message);
        }
    }
  };

  const handleSubmit = async () => {
    if (!targetAsset) return;
    const allChecked = DISCARD_CHECKLIST.every(item => findings[item.id] === true);
    if (!allChecked) {
      alert("All safety checks must be confirmed by Management before discarding.");
      return;
    }

    setIsSubmitting(true);
    try {
      const record: InspectionRecord = {
        id: Math.random().toString(36).substr(2, 9),
        equipmentId: targetAsset.id,
        equipmentType: targetAsset.type,
        taskType: TaskType.DISCARD,
        inspectorName: (activeTech?.name && activeTech.name !== 'Precision Management') ? activeTech.name : 'Authorized Manager',
        inspectorSignature: activeTech?.signature,
        date: new Date().toISOString().split('T')[0],
        status: 'Discarded',
        findings,
        notes: "Asset decommissioned and removed from site inventory by Management."
      };
      
      await syncService.saveInspection(record);
      await syncService.saveEquipment({ ...targetAsset, isArchived: true, archivedAt: record.date });
      
      alert("DISPOSAL LOGGED: Asset has been formally decommissioned.");
      setTargetAsset(null);
      setFindings({});
      onRefresh();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <h2 className="text-3xl font-black uppercase tracking-tight">Discard Hub</h2>
          <p className="text-slate-400 mt-2 max-w-md">Final decommissioning hub for failed SANS equipment. All discards require management verification.</p>
        </div>
        <button 
          onClick={() => setShowScanner(true)}
          className="bg-red-600 text-white px-10 py-5 rounded-3xl font-black uppercase tracking-widest shadow-2xl hover:bg-red-700 active:scale-95 transition-all relative z-10"
        >
          Scan for Disposal
        </button>
      </div>

      {showScanner && <QRScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {targetAsset && (
        <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-8">
           <div className="bg-red-800 p-8 text-white flex justify-between items-center">
              <div>
                 <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Target Decommissioning Asset</p>
                 <h3 className="text-2xl font-black uppercase tracking-tight">{targetAsset.serialNumber}</h3>
                 <p className="text-[10px] font-bold text-red-200 uppercase mt-1">{targetAsset.manufacturer} • {targetAsset.type}</p>
              </div>
              <button onClick={() => setTargetAsset(null)} className="text-white/40 hover:text-white text-2xl">&times;</button>
           </div>
           
           <div className="p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {DISCARD_CHECKLIST.map(item => (
                    <div key={item.id} className={`p-6 rounded-3xl border-2 transition-all flex items-center justify-between gap-4 ${findings[item.id] ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'}`}>
                       <div className="flex-1">
                          <p className="font-black text-slate-900 uppercase text-[11px]">{item.label}</p>
                          <p className="text-[10px] text-slate-500 leading-tight mt-1">{item.description}</p>
                       </div>
                       <button 
                        onClick={() => setFindings({...findings, [item.id]: !findings[item.id]})}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${findings[item.id] ? 'bg-emerald-600 text-white' : 'bg-white border-2 border-slate-200 text-slate-300'}`}
                       >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                       </button>
                    </div>
                 ))}
              </div>
              
              <button 
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-slate-900 text-white font-black py-6 rounded-3xl shadow-2xl uppercase tracking-widest text-sm hover:bg-black active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Logging Disposal...' : 'Confirm Safe Disposal & Archive'}
              </button>
           </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
           <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-1">Pending Disposal</h3>
           <div className="grid grid-cols-1 gap-3">
              {pendingDisposal.length === 0 ? (
                 <div className="py-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold uppercase text-[10px]">No units pending disposal.</div>
              ) : (
                pendingDisposal.map(unit => (
                  <div key={unit.id} className="bg-white p-6 rounded-[2rem] border border-red-100 shadow-sm flex items-center justify-between gap-4">
                      <div>
                        <h4 className="font-black text-slate-900 uppercase tracking-tight">{unit.serialNumber}</h4>
                        <p className="text-[9px] text-red-600 font-black uppercase tracking-widest">CONDEMNED: {unit.archivedAt}</p>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => handleRestore(unit)} className="bg-slate-100 text-slate-600 px-4 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest hover:bg-slate-200 transition-all">
                            Restore
                         </button>
                         <button onClick={() => setTargetAsset(unit)} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg hover:bg-red-700 transition-all">
                            Process
                         </button>
                      </div>
                  </div>
                ))
              )}
           </div>
        </div>

        <div className="space-y-4">
           <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-1">Site Scrapping Ledgers</h3>
           <div className="grid grid-cols-1 gap-3">
              {Array.from(siteDiscardStats.keys()).length === 0 ? (
                 <div className="py-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold uppercase text-[10px]">No site ledgers available.</div>
              ) : (
                Array.from(siteDiscardStats.entries()).map(([cid, count]) => {
                  const client = clients.find(c => c.id === cid);
                  return (
                    <div key={cid} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between gap-4">
                        <div>
                          <h4 className="font-black text-slate-900 uppercase tracking-tight">{client?.name || 'Unknown Site'}</h4>
                          <p className="text-[9px] text-red-600 font-black uppercase tracking-widest">{count} Total Decommissioned Units</p>
                        </div>
                        <button onClick={() => onViewSiteLedger(cid)} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg hover:bg-black transition-all flex items-center gap-2">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2" /></svg>
                           Generate Ledger
                        </button>
                    </div>
                  )
                })
              )}
           </div>
        </div>

        <div className="space-y-4">
           <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest px-1">Unit Removal History</h3>
           <div className="grid grid-cols-1 gap-3">
              {discardedUnits.length === 0 ? (
                 <div className="py-12 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 font-bold uppercase text-[10px]">No historical discards logged.</div>
              ) : (
                 discardedUnits.slice(0, 10).map(unit => (
                   <div key={unit.id} className="bg-white p-6 rounded-[2rem] border border-emerald-100 shadow-sm flex items-center justify-between gap-4">
                      <div>
                         <h4 className="font-black text-slate-900 uppercase tracking-tight">{unit.serialNumber}</h4>
                         <p className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">DISPOSED: {unit.archivedAt}</p>
                      </div>
                      <button onClick={() => onViewReport(unit.id)} className="px-6 py-3 bg-slate-50 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-200 transition-all">Report</button>
                   </div>
                 ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default DiscardHub;