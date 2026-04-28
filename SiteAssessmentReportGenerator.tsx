import React, { useMemo } from 'react';
import { calculateSiteStats } from '../src/lib/scoring';
import { Client, Equipment, InspectionRecord } from '../types';
import { BrandLogo } from './Brand';

interface SiteHandoverProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  onViewReport: () => void;
  onViewCOC: () => void;
  onClose: () => void;
  isManager?: boolean;
}

const SiteHandover: React.FC<SiteHandoverProps> = ({ client, equipment, records, onViewReport, onViewCOC, onClose, isManager = false }) => {
  const stats = useMemo(() => {
    const siteAssets = equipment.filter(e => !e.isArchived);
    const siteRecords = records.filter(r => siteAssets.some(a => a.id === (r.equipmentId || r.equipment_id)));
    
    const siteStats = calculateSiteStats(siteAssets, siteRecords);
    return {
      total: siteStats.total,
      passed: siteStats.passed,
      isCompliant: siteStats.isCompliant,
      percentage: siteStats.finalPercentage
    };
  }, [equipment, records]);

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-500">
      <div className="bg-white rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col border border-white/20">
        <div className="bg-slate-900 p-10 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          </div>
          <div className="relative z-10 flex flex-col items-center gap-4">
             <BrandLogo className="w-16 h-16 mb-2" glow />
             <h2 className="text-3xl font-black uppercase tracking-tight leading-none">Audit Summary</h2>
             <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em]">Site Progress Report</p>
          </div>
        </div>

        <div className="p-10 space-y-10">
           <div className="flex flex-col md:flex-row gap-8 items-center bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
              <div className="relative w-24 h-24 shrink-0">
                 <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                    <circle cx="50" cy="50" r="45" fill="none" stroke={stats.isCompliant ? '#10b981' : '#f59e0b'} strokeWidth="10" strokeDasharray={`${(stats.passed / stats.total) * 282} 282`} strokeLinecap="round" />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xl font-black ${stats.isCompliant ? 'text-emerald-600' : 'text-amber-600'}`}>{Math.round((stats.passed / stats.total) * 100)}%</span>
                 </div>
              </div>
              <div>
                 <h3 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">{client.name}</h3>
                 <p className="text-xs text-slate-500 font-medium mt-1">{client.address}</p>
                 <div className="flex gap-4 mt-4 text-[10px] font-black uppercase tracking-widest">
                    <span className="text-emerald-600">PASSED: {stats.passed}</span>
                    <span className="text-slate-400">TOTAL: {stats.total}</span>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={onViewReport}
                className="flex flex-col items-center gap-4 p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-red-500 hover:bg-red-50 transition-all group shadow-sm"
              >
                 <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </div>
                 <div className="text-center">
                    <div className="text-xs font-black text-slate-900 uppercase tracking-widest">Full Comprehensive Report</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">Detailed Technical Registry</div>
                 </div>
              </button>

              <button 
                onClick={onViewCOC}
                className="flex flex-col items-center gap-4 p-6 bg-white border-2 border-slate-100 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group shadow-sm"
              >
                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-inner ${stats.isCompliant ? 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white' : 'bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white'}`}>
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                 </div>
                 <div className="text-center">
                    <div className="text-xs font-black text-slate-900 uppercase tracking-widest">Issue COM / Non-Compliant</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">{stats.isCompliant ? 'Issue Compliance Certificate' : 'Issue Non-Compliance Cert'}</div>
                 </div>
              </button>
           </div>

           <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
              {!stats.isCompliant && (
                <button 
                  onClick={onClose}
                  className="w-full bg-amber-500 text-white font-black py-5 rounded-[2rem] shadow-xl hover:bg-amber-600 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Continue Inspection to Complete Site
                </button>
              )}
              <button 
                onClick={onClose}
                className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-xl hover:bg-black active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                 Return to Fleet Dashboard
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SiteHandover;