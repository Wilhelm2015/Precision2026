import React, { useState, useMemo } from 'react';
import { Client, Equipment, InspectionRecord, TaskType, EquipmentType, Technician, FaultReport, SavedReport } from '../types';
import TechnicalLedgerGenerator from './TechnicalLedgerGenerator';
import WelcomePackGenerator from './WelcomePackGenerator';
import IntroductionLetter from './IntroductionLetter';
import SLAGenerator from './SLAGenerator';
import ReportGenerator from './ReportGenerator';
import TechnicalReportGenerator from './TechnicalReportGenerator';
import ComprehensiveHydrostaticReport from './ComprehensiveHydrostaticReport';
import { COCGenerator } from './COCGenerator';

import { calculateSiteStats } from '../src/lib/scoring';

interface ReportsTabProps {
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  technicians: Technician[];
  activeTech?: Technician | null;
  branding?: any[];
  reports?: SavedReport[];
  onSaveReport?: (report: SavedReport) => void;
  onGenerateReport: (clientId: string) => void;
  onGenerateTechnicalReport: (clientId: string) => void;
  onGenerateInspectionReport: (clientId: string, date?: string) => void;
  onResumeAudit?: (clientId: string) => void;
  isManager?: boolean;
  autoOpenClientId?: string | null;
  autoOpenType?: 'technical' | 'coc' | null;
  onClearAutoOpen?: () => void;
}

type SubTab = 'sites' | 'inspection-history' | 'pressure-tests' | 'recharges' | 'saved-reports';

const ReportsTab: React.FC<ReportsTabProps> = ({ 
  clients, equipment, records, faults, technicians, activeTech, branding, reports = [], onSaveReport, onGenerateReport, onGenerateTechnicalReport, 
  onGenerateInspectionReport, onResumeAudit, isManager = false,
  autoOpenClientId, autoOpenType, onClearAutoOpen
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('sites');
  const [selectedLedgerClient, setSelectedLedgerClient] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  
  const years = useMemo(() => {
    const recordYears = records.map(r => new Date(r.date).getFullYear()).filter(y => !isNaN(y));
    const uniqueYears = Array.from(new Set([...recordYears, new Date().getFullYear()]));
    return uniqueYears.sort((a, b) => b - a);
  }, [records]);
  
  // Document state management
  const [showWelcomePack, setShowWelcomePack] = useState<Client | null>(null);
  const [showIntroLetter, setShowIntroLetter] = useState<Client | null>(null);
  const [showSLA, setShowSLA] = useState<Client | null>(null);
  
  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  const [showFullTechnicalReport, setShowFullTechnicalReport] = useState<string | null>(null);
  const [showFullHydrostaticReport, setShowFullHydrostaticReport] = useState<string | null>(null);
  const [showFullCOC, setShowFullCOC] = useState<{ clientId: string; onlyCertificate: boolean } | null>(null);
  const [viewingSavedReport, setViewingSavedReport] = useState<SavedReport | null>(null);

  React.useEffect(() => {
    if (autoOpenClientId) {
      if (autoOpenType === 'coc') {
        setShowFullCOC({ clientId: autoOpenClientId, onlyCertificate: true });
      } else if (autoOpenType === 'technical') {
        setShowFullTechnicalReport(autoOpenClientId);
      } else {
        // Default behavior
        if (isManager) {
          setShowFullTechnicalReport(autoOpenClientId);
        } else {
          setShowFullCOC({ clientId: autoOpenClientId, onlyCertificate: true });
        }
      }
      if (onClearAutoOpen) onClearAutoOpen();
    }
  }, [autoOpenClientId, autoOpenType, onClearAutoOpen, isManager]);

  const getClientStats = (clientId: string) => {
    const clientEquipment = equipment.filter(e => (String(e.clientId || e.client_id || '').trim() === String(clientId).trim()) && !e.isArchived);
    const siteRecords = records.filter(r => {
      const rid = String(r.equipmentId || r.equipment_id || r.asset_id || '').trim();
      return clientEquipment.some(a => String(a.id).trim() === rid);
    });
    const stats = calculateSiteStats(clientEquipment, siteRecords, faults);
    
    return { 
      total: stats.total, 
      passed: stats.passed, 
      complianceRate: stats.finalPercentage 
    };
  };

  const inspectionHistory = useMemo(() => {
    if (!isManager) return [];
    const inspectionRecords = records.filter(r => {
      const isInspection = r.taskType === TaskType.INSPECTION || r.taskType === TaskType.MAINTENANCE || r.taskType === TaskType.FLOW_TEST;
      if (!selectedYear) return isInspection;
      return isInspection && new Date(r.date).getFullYear() === selectedYear;
    });
    const uniqueDates = Array.from(new Set(inspectionRecords.map(r => r.date).filter(Boolean))) as string[];
    
    uniqueDates.sort((a, b) => {
      const timeA = new Date(a).getTime();
      const timeB = new Date(b).getTime();
      if (isNaN(timeA)) return 1;
      if (isNaN(timeB)) return -1;
      return timeB - timeA;
    });
    
    return uniqueDates.map(date => {
      const recordsOnDate = inspectionRecords.filter(r => r.date === date);
      const affectedClients = Array.from(new Set(recordsOnDate.map(r => {
        const eq = equipment.find(e => e.id === r.equipmentId);
        return eq?.client_id;
      }))).filter(Boolean) as string[];

      const filteredAffectedClients = affectedClients.filter(cid => {
        const client = clients.find(c => c.id === cid);
        return client?.name.toLowerCase().includes(searchTerm.toLowerCase());
      });

      return {
        date,
        clients: filteredAffectedClients.map(cid => ({
          client: clients.find(c => c.id === cid)!,
          count: recordsOnDate.filter(r => equipment.find(e => e.id === r.equipmentId)?.client_id === cid).length
        }))
      };
    }).filter(day => day.clients.length > 0);
  }, [records, equipment, clients, isManager, selectedYear, searchTerm]);

  const filteredClients = useMemo(() => {
    let result = clients;
    if (activeSubTab !== 'sites' && activeSubTab !== 'inspection-history') {
      result = clients.filter(client => {
        const clientAssets = equipment.filter(e => e.client_id === client.id && !e.isArchived);
        if (activeSubTab === 'pressure-tests') return clientAssets.some(e => e.type === EquipmentType.EXTINGUISHER);
        if (activeSubTab === 'recharges') return clientAssets.some(e => e.type === EquipmentType.EXTINGUISHER);
        return true;
      });
    }
    
    if (searchTerm) {
      result = result.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    
    // Sort by creation date descending (newest first)
    return result.sort((a, b) => {
      const dateA = new Date(a.created_at || a.createdAt || 0).getTime();
      const dateB = new Date(b.created_at || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [clients, activeSubTab, equipment, searchTerm]);

  // Document Overlays
  if (showWelcomePack) return <WelcomePackGenerator client={showWelcomePack} records={records} onBack={() => setShowWelcomePack(null)} branding={branding} />;
  if (showIntroLetter) return <IntroductionLetter client={showIntroLetter} records={records} onBack={() => setShowIntroLetter(null)} branding={branding} />;
  if (showSLA) return <SLAGenerator client={showSLA} records={records} onBack={() => setShowSLA(null)} branding={branding} />;
  
  if (showFullTechnicalReport) {
    const client = clients.find(c => c.id === showFullTechnicalReport)!;
    const clientAssets = equipment.filter(e => e.clientId === showFullTechnicalReport || e.client_id === showFullTechnicalReport);
    return <ReportGenerator client={client} equipment={clientAssets} records={records} faults={faults} technicians={technicians} activeTech={activeTech} onBack={() => setShowFullTechnicalReport(null)} selectedYear={selectedYear} branding={branding} />;
  }

  if (showFullHydrostaticReport) {
    const client = clients.find(c => c.id === showFullHydrostaticReport)!;
    const clientAssets = equipment.filter(e => e.clientId === showFullHydrostaticReport || e.client_id === showFullHydrostaticReport);
    return <ComprehensiveHydrostaticReport client={client} equipment={clientAssets} records={records} faults={faults} technicians={technicians} activeTech={activeTech} onBack={() => setShowFullHydrostaticReport(null)} selectedYear={selectedYear} />;
  }

  if (showFullCOC) {
    const client = clients.find(c => c.id === showFullCOC.clientId)!;
    const clientAssets = equipment.filter(e => (e.clientId === showFullCOC.clientId || e.client_id === showFullCOC.clientId) && !e.isArchived);
    return <COCGenerator client={client} equipment={clientAssets} records={records} technicians={technicians} activeTech={activeTech} onBack={() => setShowFullCOC(null)} selectedYear={selectedYear} branding={branding} onlyCertificate={showFullCOC.onlyCertificate} />;
  }

  if (viewingSavedReport) {
    const client = clients.find(c => c.id === viewingSavedReport.client_id)!;
    return (
      <ReportGenerator 
        client={client} 
        equipment={viewingSavedReport.data.equipment} 
        records={viewingSavedReport.data.records} 
        faults={viewingSavedReport.data.faults} 
        technicians={technicians} 
        activeTech={activeTech} 
        onBack={() => setViewingSavedReport(null)} 
        selectedYear={parseInt(viewingSavedReport.date.split('-')[0])}
        isReadOnly={true}
      />
    );
  }

  if (selectedLedgerClient) {
    const client = clients.find(c => c.id === selectedLedgerClient)!;
    const clientAssets = equipment.filter(e => e.client_id === selectedLedgerClient && !e.isArchived);
    return (
      <TechnicalLedgerGenerator 
        client={client}
        equipment={clientAssets}
        records={records}
        mode={activeSubTab === 'pressure-tests' ? 'PRESSURE_TEST' : 'RECHARGE'}
        onBack={() => setSelectedLedgerClient(null)}
        selectedYear={selectedYear}
        activeTech={activeTech}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Compliance Reports</h2>
          <p className="text-sm text-slate-500 font-medium">SANS 1475 Regulatory Documentation Hub.</p>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1 md:w-64 flex gap-2">
            <div className="relative flex-1">
              <input 
                type="text"
                placeholder="Search sites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white px-4 py-2 pl-10 rounded-2xl border border-slate-200 shadow-sm font-bold text-xs focus:outline-none focus:ring-2 focus:ring-red-500/20 transition-all"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button className="bg-red-600 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-sm active:scale-95">
              Search
            </button>
          </div>
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Archive Year:</span>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-transparent font-black text-slate-900 text-xs focus:outline-none cursor-pointer"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="flex border-b border-slate-200 no-print overflow-x-auto scrollbar-hide pt-4">
        <button onClick={() => setActiveSubTab('sites')} className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all border-b-4 ${activeSubTab === 'sites' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Site Audits
        </button>
        <button onClick={() => setActiveSubTab('inspection-history')} className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all border-b-4 ${activeSubTab === 'inspection-history' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Inspection Archive
        </button>
        <button onClick={() => setActiveSubTab('pressure-tests')} className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all border-b-4 ${activeSubTab === 'pressure-tests' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Pressure Tests
        </button>
        <button onClick={() => setActiveSubTab('recharges')} className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all border-b-4 ${activeSubTab === 'recharges' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Medium Recharges
        </button>
        <button onClick={() => setActiveSubTab('saved-reports')} className={`px-6 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all border-b-4 ${activeSubTab === 'saved-reports' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
          Saved Reports
        </button>
      </div>

      {activeSubTab === 'inspection-history' ? (
        <div className="space-y-6">
           {inspectionHistory.map(day => (
             <div key={day.date} className="space-y-4">
                <div className="flex items-center gap-4">
                   <div className="h-px bg-slate-200 flex-1" />
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(day.date).toLocaleDateString('en-ZA', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                   <div className="h-px bg-slate-200 flex-1" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {day.clients.map(({ client, count }) => (
                     <div key={client.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-emerald-500 transition-all">
                        <div className="min-w-0">
                           <h4 className="font-black text-slate-900 uppercase text-xs truncate">{client.name}</h4>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{count} Units Inspected</p>
                        </div>
                        <button 
                          onClick={() => onGenerateInspectionReport(client.id, day.date)}
                          className="bg-emerald-50 text-emerald-600 p-3 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm"
                        >
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        </button>
                     </div>
                   ))}
                </div>
             </div>
           ))}
           {inspectionHistory.length === 0 && (
             <div className="py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
               <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No historical monthly inspections found.</p>
             </div>
           )}
        </div>
      ) : activeSubTab === 'saved-reports' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(() => {
            const latestReports: Record<string, SavedReport> = {};
            reports.forEach(r => {
              if (!latestReports[r.client_id] || new Date(r.created_at) > new Date(latestReports[r.client_id].created_at)) {
                latestReports[r.client_id] = r;
              }
            });
            const latestReportsList = Object.values(latestReports);
            return latestReportsList.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No saved reports found.</p>
              </div>
            ) : (
              latestReportsList.map(report => {
                const client = clients.find(c => c.id === report.client_id);
                return (
                  <div key={report.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h4 className="font-black text-slate-900 uppercase text-sm">{client?.name || 'Unknown Client'}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Latest Report: {new Date(report.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">
                        {report.type}
                      </span>
                    </div>
                    <button 
                      onClick={() => setViewingSavedReport(report)}
                      className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-black transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                      View Latest Report
                    </button>
                  </div>
                );
              })
            );
          })()}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No sites matching this service criteria found.</p>
            </div>
          ) : (
            filteredClients.map(client => {
              const stats = getClientStats(client.id);
              const isIncomplete = stats.complianceRate < 100;
              
              return (
                <div key={client.id} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden hover:shadow-xl transition-all flex flex-col group">
                  <div className="p-8 space-y-6 flex-1">
                    <div>
                      <h4 className="font-black text-slate-900 text-xl leading-none uppercase tracking-tighter">{client.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 truncate">{client.address}</p>
                      {(() => {
                        const techName = (() => {
                          const creator = technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management');
                          if (creator) return creator.name;
                          if (activeTech?.name && activeTech.name !== 'Precision Management') return activeTech.name;
                          return null;
                        })();
                        if (!techName) return null;
                        return (
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                            Technician: {techName} | {new Date(finalizedDate).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        );
                      })()}
                    </div>

                    <div className="flex flex-wrap gap-2">
                       <button onClick={() => setShowWelcomePack(client)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all">Welcome Pack</button>
                       <button onClick={() => setShowIntroLetter(client)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all">Intro Letter</button>
                       <button onClick={() => setShowSLA(client)} className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-emerald-900 hover:text-white transition-all">SLA Sub</button>
                    </div>                    <div className="flex flex-col gap-2">
                      {activeSubTab === 'sites' ? (
                        <>
                          <button onClick={() => onGenerateInspectionReport(client.id)} className="w-full font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95 bg-emerald-600 text-white shadow-lg hover:bg-emerald-700">
                             Visual Inspection Report
                          </button>
                          <button onClick={() => setShowFullHydrostaticReport(client.id)} className="w-full font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95 bg-amber-600 text-white shadow-lg hover:bg-amber-700">
                             Hydrostatic Validation Report
                          </button>
                          <button onClick={() => setShowFullTechnicalReport(client.id)} className="w-full font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95 bg-slate-900 text-white shadow-lg hover:bg-black">
                             Comprehensive Technical Report
                          </button>
                          <button onClick={() => onGenerateTechnicalReport(client.id)} className="w-full font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95 bg-slate-100 text-slate-900 border-2 border-slate-200 hover:bg-slate-200">
                             Technical Asset Report
                          </button>
                          <button onClick={() => setShowFullCOC({ clientId: client.id, onlyCertificate: true })} className="w-full font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest active:scale-95 bg-amber-500 text-white shadow-lg hover:bg-amber-600">
                             Certificate of Maintenance (COM)
                          </button>
                          {isIncomplete && onResumeAudit && (
                            <button onClick={() => onResumeAudit(client.id)} className="w-full bg-slate-100 text-slate-400 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all text-xs uppercase tracking-widest">
                              Resume Audit
                            </button>
                          )}
                        </>
                      ) : (
                        <button onClick={() => setSelectedLedgerClient(client.id)} className={`w-full text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${activeSubTab === 'pressure-tests' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                           Generate Ledger
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsTab;
