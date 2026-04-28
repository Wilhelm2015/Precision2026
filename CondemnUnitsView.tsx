
import React, { useMemo, useState } from 'react';
import { Client, Equipment, InspectionRecord, TaskType, FaultReport } from '../types';
import ComplianceReminderLetter from './ComplianceReminderLetter';
import { calculateSiteStats } from '../src/lib/scoring';

interface ComplianceTabProps {
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
}

const ComplianceTab: React.FC<ComplianceTabProps> = ({ clients, equipment, records, faults }) => {
  const [showReminder, setShowReminder] = useState<Client | null>(null);

  const complianceData = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    
    return clients.map(client => {
      const siteAssets = equipment.filter(e => e.client_id === client.id && !e.isArchived);
      const siteRecords = records.filter(r => siteAssets.some(a => a.id === (r.equipmentId || r.equipment_id)));
      
      const hasInspectionThisMonth = records.some(r => 
        r.taskType === TaskType.INSPECTION &&
        siteAssets.some(a => a.id === r.equipmentId) &&
        r.date >= firstOfMonth
      );

      const stats = calculateSiteStats(siteAssets, siteRecords, faults);
      const score = stats.finalPercentage;

      // SANS Regulation: Monthly inspections must be logged within first 7 days
      // AND Site must be 100% compliant per user request
      const isBreached = (client.portalAccessGranted && currentDay > 7 && !hasInspectionThisMonth && siteAssets.length > 0) || (score < 100 && siteAssets.length > 0);
      
      return {
        client,
        isBreached,
        hasInspectionThisMonth,
        assetCount: siteAssets.length,
        score,
        passed: stats.passed,
        failed: stats.failed,
        condemned: stats.failed, // Simplified for UI
        flashFireCount: stats.flashFireCount
      };
    }).sort((a, b) => (a.isBreached === b.isBreached ? 0 : a.isBreached ? -1 : 1));
  }, [clients, equipment, records, faults]);

  const breachedCount = complianceData.filter(d => d.isBreached).length;

  if (showReminder) {
    return <ComplianceReminderLetter client={showReminder} records={records} onBack={() => setShowReminder(null)} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-2xl">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500">Regulatory Oversight</span>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tight leading-none">Compliance Hub</h2>
          <p className="text-slate-400 text-sm font-medium max-w-md">Monitoring mandatory SANS 10105 monthly inspection windows. Corrective action required for sites past the 7th-of-the-month cut-off.</p>
        </div>
        <div className="bg-red-600/20 border-2 border-red-600/30 p-6 rounded-[2rem] text-center shrink-0">
           <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-1">Active Breaches</p>
           <p className="text-4xl font-black text-white">{breachedCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {complianceData.length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
             <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No properties registered for monitoring.</p>
          </div>
        ) : (
          complianceData.map(({ client, isBreached, hasInspectionThisMonth, assetCount, score, passed, failed, condemned, flashFireCount }) => (
            <div 
              key={client.id} 
              className={`bg-white rounded-[2.5rem] p-8 border-2 transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${isBreached ? 'border-red-500 shadow-xl shadow-red-50' : 'border-slate-100'}`}
            >
              <div className="flex items-center gap-6 flex-1 min-w-0">
                <div className={`w-16 h-16 rounded-3xl flex items-center justify-center shrink-0 ${isBreached ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isBreached ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    )}
                  </svg>
                </div>
                <div className="min-w-0">
                   <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-black text-slate-900 uppercase truncate leading-none">{client.name}</h3>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${score >= 90 ? 'bg-emerald-100 text-emerald-700' : score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        Score: {score}%
                      </span>
                      {isBreached && <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase animate-pulse">Breached</span>}
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{client.address}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-[8px] font-black uppercase tracking-widest">
                       <span className="bg-slate-100 px-2 py-1 rounded text-slate-500">{assetCount} Managed Assets</span>
                       <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded border border-emerald-100">{passed} Passed</span>
                       <span className="bg-amber-50 text-amber-600 px-2 py-1 rounded border border-amber-100">{failed} Failed</span>
                       <span className="bg-red-50 text-red-600 px-2 py-1 rounded border border-red-100">{condemned} Condemned</span>
                       {flashFireCount > 0 && (
                         <span className="bg-red-700 text-white px-2 py-1 rounded animate-pulse">Flash Fire: {flashFireCount}</span>
                       )}
                    </div>
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto">
                {isBreached && (
                  <button 
                    onClick={() => setShowReminder(client)}
                    className="flex-1 md:flex-none bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 active:scale-95 transition-all"
                  >
                    Issue Reminder
                  </button>
                )}
                <div className={`px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2 ${isBreached ? 'bg-white border-red-100 text-red-600' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                  {isBreached ? 'Window Closed' : 'Compliance Pass'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ComplianceTab;
