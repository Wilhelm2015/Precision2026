
import React, { useMemo } from 'react';
import { Equipment, InspectionRecord, Client, FaultReport, Technician } from '../types';

interface TechnicianDashboardProps {
  activeTech: Technician | null;
  activeSubUser?: { id: string, name: string } | null;
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  onScanRequest: () => void;
  onSearchClient: () => void;
  onNavigateToTab: (tab: string) => void;
  onRefresh?: () => Promise<void>;
  lastUpdated?: string;
}

const TechnicianDashboard: React.FC<TechnicianDashboardProps> = ({ 
  activeTech, activeSubUser, equipment, records, faults, onScanRequest, onSearchClient, onNavigateToTab, onRefresh, lastUpdated 
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 1000);
      }
    }
  };
  
  const stats = useMemo(() => {
    const techRecords = records.filter(r => r.inspectorName.includes(activeTech?.name || '')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const todayRecords = techRecords.filter(r => r.date === today);
    const openFaults = faults.filter(f => f.status === 'Open');
    
    const lastFinalizedDate = techRecords.length > 0 ? techRecords[0].date : null;
    
    return {
      todayCount: todayRecords.length,
      totalCount: techRecords.length,
      openFaults: openFaults.length,
      recentAudits: techRecords.slice(0, 10),
      lastFinalizedDate
    };
  }, [records, activeTech, today, faults]);

  const getEquipmentTypeIcon = (type: string) => {
    switch (type) {
      case 'Fire Extinguisher': return '🧯';
      case 'Fire Hose Reel': return '🌀';
      case 'Fire Hydrant': return '⛲';
      default: return '🛡️';
    }
  };

  return (
    <div className="space-y-4 md:space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-900 p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <h2 className="text-xl md:text-3xl font-black uppercase tracking-tight">
            Welcome, {activeTech?.name || 'Technician'}
            {activeSubUser && <span className="text-red-500 ml-2 text-lg md:text-xl">({activeSubUser.name})</span>}
          </h2>
          <p className="text-slate-400 mt-1 md:mt-2 font-bold uppercase tracking-widest text-[8px] md:text-xs">
            SANS Field Operations • {stats.lastFinalizedDate ? `Finalized: ${new Date(stats.lastFinalizedDate).toLocaleDateString('en-ZA')}` : today} {lastUpdated && `• Sync: ${lastUpdated}`}
          </p>
          
          <div className="mt-6 md:mt-10 flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4">
            <button 
              onClick={onScanRequest}
              className="bg-red-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-sm shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2 md:gap-3 active:scale-95"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              Start Fleet Scan
            </button>
            <button 
              onClick={onSearchClient}
              className="bg-slate-800 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-sm shadow-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2 md:gap-3 active:scale-95 border border-white/10"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Search Client
            </button>
            <button 
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-sm shadow-xl transition-all flex items-center justify-center gap-2 md:gap-3 active:scale-95 border ${isRefreshing ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
            >
              <svg className={`w-5 h-5 md:w-6 md:h-6 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-4 md:p-8 opacity-10">
           <svg className="w-24 h-24 md:w-48 md:h-48" fill="currentColor" viewBox="0 0 24 24">
             <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
           </svg>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-4 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Audits</p>
          <p className="text-2xl md:text-4xl font-black text-slate-900 mt-1 md:mt-2">{stats.todayCount}</p>
        </div>
        <div className="bg-white p-4 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Open Faults</p>
          <p className="text-2xl md:text-4xl font-black text-red-600 mt-1 md:mt-2">{stats.openFaults}</p>
        </div>
        <div className="bg-white p-4 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm col-span-2 md:col-span-1">
          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Fleet Audits</p>
          <p className="text-2xl md:text-4xl font-black text-slate-900 mt-1 md:mt-2">{stats.totalCount}</p>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] md:text-sm">Quick Actions</h3>
        </div>
        <div className="p-4 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
           <button onClick={() => onNavigateToTab('reports')} className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all text-center space-y-2 md:space-y-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-xl md:rounded-2xl shadow-sm flex items-center justify-center mx-auto text-slate-900">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2" /></svg>
              </div>
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-600">Reports</p>
           </button>
           <button onClick={() => onNavigateToTab('coc')} className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all text-center space-y-2 md:space-y-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-xl md:rounded-2xl shadow-sm flex items-center justify-center mx-auto text-emerald-600">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              </div>
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-600">Certs</p>
           </button>
           <button onClick={() => onNavigateToTab('technical-hub')} className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all text-center space-y-2 md:space-y-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-xl md:rounded-2xl shadow-sm flex items-center justify-center mx-auto text-amber-600">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-600">Tech Hub</p>
           </button>
           <button onClick={() => onNavigateToTab('faults')} className="p-4 md:p-6 rounded-2xl md:rounded-3xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all text-center space-y-2 md:space-y-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-white rounded-xl md:rounded-2xl shadow-sm flex items-center justify-center mx-auto text-red-600">
                <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-600">Faults</p>
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] md:rounded-[3rem] border border-slate-200 overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] md:text-sm">My Recent Audits</h3>
          <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Last 10 Records</span>
        </div>
        <div className="p-3 md:p-4">
          {stats.recentAudits.length === 0 ? (
            <div className="py-8 md:py-12 text-center">
              <p className="text-slate-300 font-black uppercase tracking-widest text-[8px] md:text-[10px]">No recent audits found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentAudits.map((record) => {
                const asset = equipment.find(e => e.id === record.equipmentId);
                return (
                  <div key={record.id} className="flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white border border-slate-200 flex items-center justify-center text-base md:text-xl shadow-sm">
                        {getEquipmentTypeIcon(record.equipmentType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-black text-slate-900 uppercase text-[9px] md:text-[11px] tracking-tight">{asset?.serialNumber || 'Unknown'}</p>
                          <span className={`px-1.5 md:px-2 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-widest border ${record.status === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {record.status}
                          </span>
                        </div>
                        <p className="text-[7px] md:text-[9px] font-bold text-slate-400 uppercase tracking-widest">{record.equipmentType} • {record.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] md:text-[10px] font-black text-slate-900 uppercase tracking-tighter truncate max-w-[60px] md:max-w-none">{asset?.location || 'N/A'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TechnicianDashboard;
