import React, { useState, useMemo } from 'react';
import { Client, Equipment, InspectionRecord, TaskType, EquipmentType, Technician } from '../types';
import FlowCertificate from './FlowCertificate';

interface FlowHubProps {
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  activeTech?: Technician | null;
  onRefresh: () => void;
}

const FlowHub: React.FC<FlowHubProps> = ({ clients, equipment, records, activeTech, onRefresh }) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const siteStats = useMemo(() => {
    return clients.map(client => {
      const siteAssets = equipment.filter(e => e.client_id === client.id && !e.isArchived && 
        (e.type === EquipmentType.HOSE_REEL || e.type === EquipmentType.HYDRANT));
      
      const flowRecords = records.filter(r => 
        r.taskType === TaskType.FLOW_TEST && 
        siteAssets.some(a => a.id === r.equipmentId)
      );

      return {
        client,
        total: siteAssets.length,
        tested: flowRecords.length,
        percentage: siteAssets.length > 0 ? Math.round((flowRecords.length / siteAssets.length) * 100) : 0
      };
    }).filter(s => s.total > 0).sort((a, b) => b.percentage - a.percentage);
  }, [clients, equipment, records]);

  if (selectedClientId) {
    const client = clients.find(c => c.id === selectedClientId)!;
    const siteEquipment = equipment.filter(e => e.client_id === selectedClientId && !e.isArchived && 
        (e.type === EquipmentType.HOSE_REEL || e.type === EquipmentType.HYDRANT));
    
    return (
      <FlowCertificate 
        client={client}
        equipment={siteEquipment}
        records={records}
        activeTech={activeTech}
        onBack={() => setSelectedClientId(null)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl bg-slate-900 border-b-8 border-red-600">
        <div className="relative z-10">
          <h2 className="text-3xl font-black uppercase tracking-tight">Flow Matrix</h2>
          <p className="text-slate-400 mt-2 max-w-md">Dedicated SANS 1128-2 Flow Pressure Validation. Centralized monitoring for site-wide hydraulic performance.</p>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24">
             <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
           </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {siteStats.map(({ client, tested, total, percentage }) => (
          <div key={client.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col">
            <div className="p-8 flex-1 space-y-6">
              <div>
                <h3 className="font-black text-slate-900 text-xl leading-none uppercase tracking-tighter">{client.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 truncate">{client.address}</p>
              </div>

              <div className="space-y-4">
                 <div className="flex justify-between items-end">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Test Coverage</span>
                    <span className="text-sm font-black text-slate-900">{percentage}%</span>
                 </div>
                 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600 transition-all duration-700" style={{ width: `${percentage}%` }} />
                 </div>
                 <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Hydraulic Assets</p>
                        <p className="text-xl font-black text-slate-900">{total}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                        <p className="text-[8px] font-black text-red-600 uppercase tracking-widest">Tests Logged</p>
                        <p className="text-xl font-black text-red-700">{tested}</p>
                    </div>
                 </div>
              </div>
            </div>

            <div className="px-8 pb-8">
              <button 
                onClick={() => setSelectedClientId(client.id)}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Flow Test Certificate
              </button>
            </div>
          </div>
        ))}
      </div>

      {siteStats.length === 0 && (
        <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No hydraulic assets (Reels/Hydrants) found in registry.</p>
        </div>
      )}
    </div>
  );
};

export default FlowHub;