import React, { useMemo, useState, useEffect } from 'react';
import { Client, Equipment, InspectionRecord, TaskType, FaultReport } from '../types';
import { SACAS_PERMIT_NUMBER, EQUIPMENT_DEFINITIONS, COMPANY_LOGO_URL } from '../constants';
import { getProxiedImageUrl } from '../services/registryService';

import { calculateSiteStats } from '../src/lib/scoring';

interface InspectionReportGeneratorProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  onBack: () => void;
  targetDate?: string; // Optional: To view a specific historical report
  branding?: any[];
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return dateStr || 'N/A'; }
};

const ReportLogo = ({ type, className, branding = [] }: { type: 'company' | 'saqcc' | 'sacas', className?: string, branding?: any[] }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const keys = { company: 'pfs_custom_logo', saqcc: 'pfs_custom_saqcc', sacas: 'pfs_custom_sacas' };
    const dist = localStorage.getItem(`pfs_dist_${type}`) || 'both';
    const canShow = dist === 'audit' || dist === 'both';
    
    // Check cloud branding first
    const cloudLogo = branding.find(b => b.id === keys[type])?.content;
    const stored = cloudLogo || localStorage.getItem(keys[type]);

    if (canShow) {
      if (stored) { setSrc(getProxiedImageUrl(stored)); setIsVisible(true); }
      else if (type === 'company') { setSrc(COMPANY_LOGO_URL); setIsVisible(true); }
      else { setIsVisible(false); }
    } else { setIsVisible(false); }
  }, [type, branding]);

  if (!isVisible) return null;
  return <img src={src!} className={`${className} object-contain`} alt={`${type} logo`} crossOrigin="anonymous" referrerPolicy="no-referrer" />;
};

const CompanyFooter = ({ branding = [] }: { branding?: any[] }) => (
  <div className="w-full pt-2 border-t flex justify-between items-end shrink-0">
    <div className="space-y-0.5 text-left">
      <p className="text-[9px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
      <p className="text-[7px] font-bold text-slate-500 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
      <p className="text-[7px] font-black text-red-600 uppercase tracking-widest">Office: 010 035 5246 • Emergency: 078 173 7245</p>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex gap-2 items-center">
        <ReportLogo type="saqcc" className="w-[40px] h-[30px]" branding={branding} />
        <ReportLogo type="sacas" className="w-[40px] h-[30px]" branding={branding} />
      </div>
      <div className="text-right">
        <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">Digital SANS Registry Node</p>
      </div>
    </div>
  </div>
);

const InspectionReportGenerator: React.FC<InspectionReportGeneratorProps> = ({ client, equipment, records, faults, onBack, targetDate, branding = [] }) => {
  const handlePrint = () => window.print();

  const inspectionData = useMemo(() => {
    return equipment.filter(e => {
      const assetId = String(e.id || '').trim();
      if (!e.isArchived) return true;
      const latest = records
        .filter(r => String(r.equipmentId || r.equipment_id || '').trim() === assetId)
        .sort((a, b) => {
          const dateA = a.date || a.created_at || '';
          const dateB = b.date || b.created_at || '';
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })[0];
      return latest?.status === 'Condemned';
    }).map(asset => {
      const assetId = String(asset.id || '').trim();
      const relevantRecords = records
        .filter(r => {
          const isMatch = String(r.equipmentId || r.equipment_id || '').trim() === assetId && (r.taskType === TaskType.INSPECTION || r.taskType === TaskType.MAINTENANCE || r.taskType === TaskType.FLOW_TEST);
          if (targetDate) return isMatch && (r.date === targetDate || r.created_at?.startsWith(targetDate));
          return isMatch;
        })
        .sort((a, b) => {
          const dateA = a.date || a.created_at || '';
          const dateB = b.date || b.created_at || '';
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
      
      const latest = relevantRecords[0];
      const definition = EQUIPMENT_DEFINITIONS.find(d => d.type === asset.type);
      const checklist = definition?.checklists[TaskType.INSPECTION] || [];

      return { asset, latest, checklist };
    });
  }, [equipment, records, targetDate]);

  const stats = useMemo(() => {
    const complianceData = inspectionData.filter(d => !d.asset.isArchived);
    const activeAssets = complianceData.map(d => d.asset);
    const siteStats = calculateSiteStats(activeAssets, records, faults);

    return { 
      total: siteStats.total, 
      inspected: complianceData.filter(d => d.latest).length, 
      passed: siteStats.passed, 
      percent: siteStats.finalPercentage 
    };
  }, [inspectionData, faults, equipment, records]);

  const displayDate = targetDate || new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 animate-in fade-in duration-500 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="no-print flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Registry Hub
          </button>
          <div className="flex items-center gap-4">
            {targetDate && (
              <div className="hidden md:flex flex-col items-end">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Viewing Historical Log</span>
                <span className="text-[10px] font-black text-emerald-600 uppercase">{formatDate(targetDate)}</span>
              </div>
            )}
            <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95">
              Download Inspection Report
            </button>
          </div>
        </div>

        <div className="bg-white p-12 md:p-16 shadow-2xl rounded-[2.5rem] border border-slate-200 print:shadow-none print:border-none print:rounded-none relative overflow-hidden flex flex-col min-h-[297mm]">
          {/* Document Header */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-10 relative z-10">
            <div className="flex items-center gap-6">
              <ReportLogo type="company" className="w-20 h-20" branding={branding} />
              <div className="text-left">
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none text-slate-900">Precision Fire Services</h1>
                <p className="text-[11px] text-red-600 font-black uppercase tracking-[0.4em] mt-2">SANS 10105-1 Technical Registry</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Permit: {SACAS_PERMIT_NUMBER}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Asset Ledger</h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Date: {formatDate(displayDate)}</p>
              <div className="flex gap-2 justify-end mt-4">
                <ReportLogo type="saqcc" className="w-auto h-10" branding={branding} />
                <ReportLogo type="sacas" className="w-auto h-10" branding={branding} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 relative z-10">
            <div className="md:col-span-2 space-y-3 text-left">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Client / Site Identification</h3>
              <p className="text-3xl font-black text-slate-900 uppercase leading-tight tracking-tighter">{client.name}</p>
              <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">{client.address}</p>
            </div>
            <div className="bg-slate-900 text-white p-8 rounded-[2rem] flex justify-between items-center shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
               <div className="relative z-10">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-[0.4em] mb-2">Registry Site Score</p>
                  <p className="text-5xl font-black tracking-tighter">{stats.percent}%</p>
               </div>
               <div className="text-right relative z-10">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Operational Units</p>
                  <p className="text-2xl font-black">{stats.passed} / {stats.total}</p>
               </div>
            </div>
          </div>

          {/* Inspection Ledger */}
          <div className="space-y-8 flex-1 relative z-10">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-4">
              <h3 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.5em]">Equipment Inspection Matrix</h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SANS 1475 Audit Trail</span>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {inspectionData.map(({ asset, latest, checklist }, idx) => (
                <div key={asset.id} className="border border-slate-100 rounded-[2.5rem] p-8 bg-slate-50/30 flex flex-col md:flex-row gap-8 items-start justify-between break-inside-avoid shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-4 mb-3">
                       <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{asset.serialNumber}</h4>
                       <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${latest?.status === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                          {latest?.status || 'NOT INSPECTED'}
                       </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                      <span className="text-slate-900 font-black">{asset.type}</span>
                      <span className="text-slate-300">•</span>
                      <span>{asset.location}</span>
                      <span className="text-slate-300">•</span>
                      <span>Seal: <span className="text-blue-600 font-black">{latest?.sealSerialNumber || '---'}</span></span>
                    </p>

                    {/* Checklist Display */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                       {checklist.map(item => {
                         const passed = latest?.findings[item.id] === true;
                         const failed = latest?.findings[item.id] === false;
                         return (
                           <div key={item.id} className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
                             <div className={`w-5 h-5 rounded-lg flex items-center justify-center shadow-sm ${passed ? 'bg-emerald-500 text-white' : failed ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                               {passed ? (
                                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                               ) : failed ? (
                                 <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                               ) : (
                                 <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                               )}
                             </div>
                             <span className="text-[10px] font-black text-slate-700 uppercase tracking-tight leading-none">{item.label}</span>
                           </div>
                         );
                       })}
                    </div>
                  </div>

                  <div className="w-full md:w-56 text-right space-y-3">
                     <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Next Service Date</p>
                        <p className="text-[12px] font-black text-slate-900 uppercase">{formatDate(asset.nextServiceDate)}</p>
                     </div>
                     <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Inspected By</p>
                        <p className="text-[11px] font-bold text-slate-700 uppercase truncate">{latest?.inspectorName || 'Pending'}</p>
                     </div>
                     {latest?.notes && (
                       <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
                         <p className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-1">Remarks</p>
                         <p className="text-[10px] font-bold text-slate-600 italic leading-tight">"{latest.notes}"</p>
                       </div>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <CompanyFooter branding={branding} />
        </div>
      </div>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          @page { margin: 10mm; size: A4 portrait; }
        }
      `}</style>
    </div>
  );
};

export default InspectionReportGenerator;