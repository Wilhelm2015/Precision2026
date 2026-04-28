
import React, { useMemo, useState } from 'react';
import { Equipment, InspectionRecord, Client, Technician, TaskType } from '../types';
import { syncService } from '../services/registryService';

interface CondemnUnitsViewProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  activeTech: Technician | null;
  onReplace: (equipment: Equipment) => void;
  onClose: () => void;
  onRefresh: () => void;
}

const CondemnUnitsView: React.FC<CondemnUnitsViewProps> = ({ client, equipment, records, activeTech, onReplace, onClose, onRefresh }) => {
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const condemnUnits = useMemo(() => {
    return equipment.filter(e => {
      if (e.isArchived || e.client_id !== client.id) return false;
      const latest = records
        .filter(r => r.equipmentId === e.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      return latest?.status === 'Condemned' || latest?.status === 'Service Required' || (e.manufacturer || '').toLowerCase().includes('flash fire');
    });
  }, [equipment, records, client.id]);

  const handleRemoveFromSite = async (unit: Equipment) => {
    if (!window.confirm(`Are you sure you want to remove ${unit.serialNumber} from site and move it to the Condemn Hub?`)) return;
    
    setIsProcessing(unit.id);
    try {
      const record: InspectionRecord = {
        id: Math.random().toString(36).substr(2, 9),
        equipmentId: unit.id,
        equipmentType: unit.type,
        taskType: TaskType.DISCARD,
        inspectorName: (activeTech?.name && activeTech.name !== 'Precision Management') ? activeTech.name : 'Technician',
        inspectorSignature: activeTech?.signature,
        date: new Date().toISOString().split('T')[0],
        status: 'Discarded',
        findings: {},
        notes: "Asset removed from site by technician and moved to condemn hub."
      };
      
      await syncService.saveInspection(record);
      await syncService.saveEquipment({ ...unit, isArchived: true, archivedAt: record.date });
      
      alert("Asset removed and archived.");
      onRefresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-red-700 p-8 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
            </button>
            <div>
              <h3 className="text-2xl font-black uppercase tracking-tight">Condemned Assets</h3>
              <p className="text-[10px] font-black text-red-200 uppercase tracking-widest mt-1">{client.name} • Site Inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto space-y-6 scrollbar-hide">
          {condemnUnits.length === 0 ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-100">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-sm font-black text-slate-900 uppercase">No Condemned Units Found</p>
              <p className="text-xs text-slate-400 font-medium">This site is currently compliant with no pending removals.</p>
              <button onClick={onClose} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest mt-4">Close View</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {condemnUnits.map(unit => (
                <div key={unit.id} className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-center gap-6">
                  <div className="text-center sm:text-left">
                    <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight">{unit.serialNumber}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{unit.type} • {unit.size || 'N/A'}</p>
                    <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mt-1">{unit.manufacturer}</p>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button 
                      onClick={() => onReplace(unit)}
                      disabled={!!isProcessing}
                      className="flex-1 sm:flex-none bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      Replace Unit
                    </button>
                    <button 
                      onClick={() => handleRemoveFromSite(unit)}
                      disabled={!!isProcessing}
                      className="flex-1 sm:flex-none bg-red-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isProcessing === unit.id ? 'Removing...' : 'Remove From Site'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
          <p className="text-[9px] text-slate-400 font-bold uppercase text-center leading-relaxed">
            Removing a unit will archive it in the registry and move it to the Disposal Hub for management verification. 
            Replacing a unit will archive the old asset and open the commissioning form for the new replacement.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CondemnUnitsView;
