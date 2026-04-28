import React, { useState, useMemo } from 'react';
import { Client, Equipment, InspectionRecord, TaskType, EquipmentType } from '../types';
import TechnicalLedgerGenerator from './TechnicalLedgerGenerator';

interface TechnicalHubProps {
  mode: 'PRESSURE_TEST' | 'RECHARGE';
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  onRefresh: () => void;
  onScanRequest?: () => void;
  activeTech?: any;
}

const TechnicalHub: React.FC<TechnicalHubProps> = ({ mode, clients, equipment, records, onRefresh, onScanRequest, activeTech }) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [issuedReports, setIssuedReports] = useState<Set<string>>(new Set());

  const isPT = mode === 'PRESSURE_TEST';
  const taskType = isPT ? TaskType.PRESSURE_TEST : TaskType.RECHARGE;

  const siteStats = useMemo(() => {
    return clients.map(client => {
      // SANS protocol: Standalone PT Ledger is for Extinguishers.
      // Hose Reels/Hydrants are hydrostatic tested during annual maintenance.
      const siteAssets = equipment.filter(e => {
        const isClientAsset = e.client_id === client.id && !e.isArchived;
        if (isPT) return isClientAsset && (e.type === EquipmentType.EXTINGUISHER || records.some(r => r.equipmentId === e.id && r.taskType === TaskType.PRESSURE_TEST));
        return isClientAsset;
      });

      const now = new Date();
      const nextThreshold = new Date();
      nextThreshold.setMonth(now.getMonth() + 2);

      const dueAssets = siteAssets.filter(e => {
        const dateToTrack = isPT ? e.nextPressureTestDate : e.nextServiceDate;
        return dateToTrack && new Date(dateToTrack) <= nextThreshold;
      });

      const completedTotal = records.filter(r => 
        r.taskType === taskType && 
        siteAssets.some(a => a.id === r.equipmentId)
      ).length;

      return {
        client,
        total: siteAssets.length,
        due: dueAssets.length,
        completed: completedTotal
      };
    }).filter(s => s.total > 0).sort((a, b) => b.due - a.due);
  }, [clients, equipment, records, isPT, taskType]);

  if (selectedClientId) {
    const client = clients.find(c => c.id === selectedClientId)!;
    const siteEquipment = equipment.filter(e => {
      const isClientAsset = e.client_id === selectedClientId && !e.isArchived;
      if (isPT) return isClientAsset && (e.type === EquipmentType.EXTINGUISHER || records.some(r => r.equipmentId === e.id && r.taskType === TaskType.PRESSURE_TEST));
      return isClientAsset;
    });

    return (
      <TechnicalLedgerGenerator 
        client={client}
        equipment={siteEquipment}
        records={records}
        mode={mode}
        onBack={() => setSelectedClientId(null)}
        onIssue={() => {
           setIssuedReports(prev => new Set(prev).add(selectedClientId));
           onRefresh();
        }}
        activeTech={activeTech}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className={`p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl ${isPT ? 'bg-amber-600' : 'bg-blue-600'}`}>
        <div className="relative z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-black uppercase tracking-tight">{isPT ? 'Extinguisher Overhaul Registry' : 'Recharge Protocol Hub'}</h2>
              <p className="text-white/80 mt-2 max-w-md">
                {isPT 
                  ? 'SANS 1475-1 5-Year Pressure validation and certification (Extinguishers only).' 
                  : 'Regulatory medium replenishment and service interval tracking.'}
              </p>
            </div>
            {onScanRequest && (
              <button 
                onClick={onScanRequest}
                className="bg-white text-slate-900 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-slate-100 transition-all flex items-center gap-2 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                Fleet Scan
              </button>
            )}
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
           <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24">
             <path d={isPT ? 'M13 10V3L4 14h7v7l9-11h-7z' : 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'} />
           </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {siteStats.map(({ client, due, total, completed }) => (
          <div key={client.id} className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col">
            <div className="p-8 flex-1 space-y-6">
              <div>
                <h3 className="font-black text-slate-900 text-xl leading-none uppercase tracking-tighter">{client.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 truncate">{client.address}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                 <div className={`p-4 rounded-2xl border ${due > 0 ? (isPT ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100') : 'bg-slate-50 border-slate-100'}`}>
                    <p className={`text-[8px] font-black uppercase tracking-widest ${due > 0 ? (isPT ? 'text-amber-600' : 'text-blue-600') : 'text-slate-400'}`}>Load Pending</p>
                    <p className={`text-xl font-black ${due > 0 ? 'text-slate-900' : 'text-slate-300'}`}>{due}</p>
                 </div>
                 <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Issued Logs</p>
                    <p className="text-xl font-black text-emerald-700">{completed}</p>
                 </div>
              </div>
            </div>

            <div className="px-8 pb-8">
              <button 
                onClick={() => setSelectedClientId(client.id)}
                className="w-full font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-black"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Open Registry Log
              </button>
            </div>
          </div>
        ))}
      </div>

      {siteStats.length === 0 && (
        <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
          <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No relevant technical assets found requiring specialized service.</p>
        </div>
      )}
    </div>
  );
};

export default TechnicalHub;