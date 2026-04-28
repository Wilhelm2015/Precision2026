import React, { useState, useMemo } from 'react';
import { Equipment, Client, InspectionRecord, EquipmentType, TaskType, FaultReport } from '../types';
import HistoryModal from './HistoryModal';
import SingleRecordReport from './SingleRecordReport';
import { MoveAssetModal } from './AssetMover';

interface AssetRegisterProps {
  equipment: Equipment[];
  clients: Client[];
  records: InspectionRecord[];
  faultReports?: FaultReport[];
  isManager?: boolean;
  activeClientId?: string | null;
  onScanRequest?: () => void;
  onBulkQRRequest?: () => void;
  onManualEntryRequest?: () => void;
  onAuditRequest?: (asset: Equipment, type?: TaskType) => void;
  onLabelRequest?: (asset: Equipment) => void;
  onReplaceRequest?: (asset: Equipment) => void;
  onEditRequest?: (asset: Equipment) => void;
  onMoveRequest?: (asset: Equipment, newClientId: string, isNewSite: boolean, newSiteName?: string) => void;
  onDeleteRequest?: (assetId: string) => void;
  onDeleteRecord?: (recordId: string) => void;
  onFinalizeRequest?: () => void;
  sessionInspectedIds?: string[];
  showOnlyDue?: boolean;
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr || 'N/A';
  }
};

const AssetRegister: React.FC<AssetRegisterProps> = ({ 
    equipment, clients, records, faultReports = [], isManager = false, activeClientId, onScanRequest, onBulkQRRequest, onManualEntryRequest,
    onAuditRequest, onLabelRequest, onReplaceRequest, onEditRequest, onDeleteRequest, onDeleteRecord, onFinalizeRequest,
    sessionInspectedIds = [], showOnlyDue = false
}) => {
  const [filterType, setFilterType] = useState<string>('All');
  const [filterClient, setFilterClient] = useState<string>(activeClientId || 'All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDueOnly, setIsDueOnly] = useState(showOnlyDue);
  
  const [historyAsset, setHistoryAsset] = useState<Equipment | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<InspectionRecord | null>(null);
  const [moveAsset, setMoveAsset] = useState<Equipment | null>(null);

  React.useEffect(() => {
    if (activeClientId) setFilterClient(activeClientId);
  }, [activeClientId]);

  React.useEffect(() => {
    if (showOnlyDue) setIsDueOnly(true);
  }, [showOnlyDue]);

  const getLatestRecord = (equipmentId: string) => {
    return records
      .filter(r => r.equipmentId === equipmentId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  };

  const filteredData = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    const now = new Date();
    const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return equipment.filter(eq => {
      if (eq.isArchived) {
        const latest = getLatestRecord(eq.id);
        if (latest?.status !== 'Condemned') return false;
      }
      const matchesType = filterType === 'All' || eq.type === filterType;
      const matchesClient = filterClient === 'All' || eq.client_id === filterClient;
      const matchesSearch = 
        (eq.serialNumber || '').toLowerCase().includes(term) ||
        (eq.location || '').toLowerCase().includes(term) ||
        (eq.unitNumber || '').toLowerCase().includes(term) ||
        (clients.find(c => c.id === eq.client_id)?.name || '').toLowerCase().includes(term);
      
      let matchesDue = true;
      if (isDueOnly) {
        const serviceDate = new Date(eq.nextServiceDate);
        const ptDate = eq.nextPressureTestDate ? new Date(eq.nextPressureTestDate) : null;
        matchesDue = serviceDate <= next30 || (ptDate !== null && ptDate <= next30);
      }

      return matchesType && matchesClient && matchesSearch && matchesDue;
    });
  }, [equipment, filterType, filterClient, searchTerm, isDueOnly]);

  const selectedClientName = useMemo(() => 
    clients.find(c => c.id === filterClient)?.name, 
  [clients, filterClient]);

  const handleDelete = (id: string, sn: string) => {
    if (window.confirm(`CRITICAL ACTION: Permanently delete asset ${sn} and all associated technical records from the registry?`)) {
      onDeleteRequest?.(id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {historyAsset && (
        <HistoryModal 
          equipment={historyAsset} 
          records={records} 
          onClose={() => setHistoryAsset(null)} 
          onViewFullReport={setSelectedRecord} 
          isManager={isManager}
          onDeleteRecord={onDeleteRecord}
          onStartMaintenance={(eq) => {
            setHistoryAsset(null);
            onAuditRequest?.(eq, TaskType.MAINTENANCE);
          }}
        />
      )}
      {selectedRecord && <SingleRecordReport record={selectedRecord} equipment={equipment.find(e => e.id === selectedRecord.equipmentId)} client={clients.find(c => c.id === equipment.find(e => e.id === selectedRecord.equipmentId)?.client_id)} onClose={() => setSelectedRecord(null)} />}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 no-print">
        <div className="flex flex-col gap-2">
          {filterClient !== 'All' && (
            <button 
              onClick={() => {
                setFilterClient('All');
              }} 
              className="group flex items-center gap-2 text-red-600 font-black uppercase text-[10px] tracking-widest hover:text-red-700 transition-colors mb-2"
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              View All Properties
            </button>
          )}
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">
            {filterClient === 'All' ? 'Fleet Registry' : selectedClientName}
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            {filterClient === 'All' ? 'Cloud Registry Monitoring' : 'Site Compliance Ledger'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onBulkQRRequest && (
            <button 
              onClick={onBulkQRRequest}
              className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              QR Station
            </button>
          )}
          {onFinalizeRequest && filterClient !== 'All' && (
            <button 
              onClick={onFinalizeRequest}
              className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-900/10 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              Finalize Audit
            </button>
          )}
          {onManualEntryRequest && (
            <button onClick={onManualEntryRequest} className="bg-slate-100 text-slate-900 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest border border-slate-200 hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Manual entry
            </button>
          )}
          {onScanRequest && (
            <button onClick={onScanRequest} className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-red-700 transition-all flex items-center justify-center gap-2 active:scale-95">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              Scan Tag
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 no-print bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex-1 relative">
          <input 
            type="text" 
            placeholder="Search Serial or Location..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-12 py-4 outline-none focus:border-red-500 transition-all font-bold text-sm"
          />
          <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        <select 
          value={filterType} 
          onChange={e => setFilterType(e.target.value)} 
          className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 font-black uppercase text-[10px] tracking-widest outline-none focus:border-red-500 appearance-none"
        >
          <option value="All">All Equipment</option>
          {Object.values(EquipmentType).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button 
          onClick={() => setIsDueOnly(!isDueOnly)}
          className={`px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border-2 ${isDueOnly ? 'bg-red-600 text-white border-red-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
        >
          {isDueOnly ? 'Showing Due Only' : 'Show All Due'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredData.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No assets match current registry filter.</p>
          </div>
        ) : (
          filteredData.map(item => {
            const latest = getLatestRecord(item.id);
            const client = clients.find(c => c.id === item.client_id);
            const isInspectedThisSession = sessionInspectedIds.includes(item.id);

            return (
              <div key={item.id} className={`bg-white rounded-[2.5rem] p-8 border-2 transition-all group hover:shadow-xl flex flex-col justify-between ${isInspectedThisSession ? 'border-emerald-500 shadow-lg shadow-emerald-50' : 'border-slate-100'}`}>
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none group-hover:text-red-600 transition-colors">{item.serialNumber}</h3>
                        {isInspectedThisSession && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.type} {item.size ? `• ${item.size}` : ''}</p>
                    </div>
                    <div className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                      latest?.status === 'Pass' ? 'bg-emerald-50 text-emerald-600' : 
                      latest?.status === 'Service Required' || latest?.status === 'Fail' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                      {latest?.status || 'NOT AUDITED'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-red-600 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.99 7.99 0 0120 13a7.98 7.98 0 01-2.343 5.657z" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Site Identity</p>
                        <p className="text-[10px] font-black text-slate-800 uppercase truncate">{client?.name || 'Unassigned Site'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Floor Location</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase truncate">{item.location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
                    <div>
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Annual Service</p>
                      <p className={`text-[10px] font-black uppercase ${new Date(item.nextServiceDate) < new Date() ? 'text-red-600 animate-pulse' : 'text-slate-900'}`}>
                        {formatDate(item.nextServiceDate)}
                      </p>
                    </div>
                    {item.nextPressureTestDate && (
                      <div>
                        <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Pressure Test</p>
                        <p className={`text-[10px] font-black uppercase ${item.isPressureTestNonCompliant ? 'text-amber-600' : 'text-slate-900'}`}>
                          {formatDate(item.nextPressureTestDate)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-8 no-print">
                  <button 
                    onClick={() => onAuditRequest?.(item, TaskType.INSPECTION)}
                    className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95"
                  >
                    Quick Scan
                  </button>
                  <button 
                    onClick={() => setHistoryAsset(item)}
                    className="p-3 bg-slate-100 text-slate-400 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                    title="Asset History"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </button>
                  <div className="flex-1 relative group/menu">
                     <button className="w-full h-full p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-1">
                        <div className="w-1 h-1 bg-current rounded-full" /><div className="w-1 h-1 bg-current rounded-full" /><div className="w-1 h-1 bg-current rounded-full" />
                     </button>
                     <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden hidden group-hover/menu:block z-[50]">
                        <button onClick={() => onLabelRequest?.(item)} className="w-full px-5 py-3 text-left text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                           Print Identity Tag
                        </button>
                        <button onClick={() => onReplaceRequest?.(item)} className="w-full px-5 py-3 text-left text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                           Relink / Replace Tag
                        </button>
                        <button onClick={() => onEditRequest?.(item)} className="w-full px-5 py-3 text-left text-[9px] font-black uppercase text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                           Modify Particulars
                        </button>
                        <button onClick={() => setMoveAsset(item)} className="w-full px-5 py-3 text-left text-[9px] font-black uppercase text-blue-600 hover:bg-slate-50 flex items-center gap-3 border-b">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                           Move Unit to Site
                        </button>
                        {isManager && (
                          <button onClick={() => handleDelete(item.id, item.serialNumber)} className="w-full px-5 py-3 text-left text-[9px] font-black uppercase text-red-600 hover:bg-red-50 flex items-center gap-3">
                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h7" /></svg>
                             Purge from Registry
                          </button>
                        )}
                     </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AssetRegister;