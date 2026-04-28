import React, { useState, useMemo, useEffect } from 'react';
import { calculateSiteStats } from '../src/lib/scoring';
import { Client, Equipment, InspectionRecord, Technician, TaskType, FaultReport } from '../types';
import { BrandLogo } from './Brand';
import IntroductionLetter from './IntroductionLetter';
import ReportGenerator from './ReportGenerator';
import { COCGenerator } from './COCGenerator';

interface ClientPortalProps {
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  technicians: Technician[];
  onGenerateReport: (clientId: string) => void;
  onGenerateCOC: (clientId: string) => void;
  onExit: () => void;
  onScanRequest?: (type?: 'inspection' | 'fault') => void;
  onLogin?: (client: Client) => void;
  authenticatedClient?: Client | null;
  activeTech?: Technician | null;
}

const ClientPortal: React.FC<ClientPortalProps> = ({ 
  clients, equipment, records, faults, technicians, onGenerateReport, onGenerateCOC, onExit, onScanRequest, onLogin, authenticatedClient, activeTech 
}) => {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [pin, setPin] = useState(authenticatedClient?.portalPin || '');
  const [activeClient, setActiveClient] = useState<Client | null>(authenticatedClient || null);
  const [step, setStep] = useState<'identify' | 'verify'>(authenticatedClient ? 'verify' : 'identify');
  const [isError, setIsError] = useState(false);
  const [showIntroLetter, setShowIntroLetter] = useState(false);
  const [viewMode, setViewMode] = useState<'dashboard' | 'audit-logs' | 'maintenance-com' | 'inspection-reports'>('dashboard');
  const [selectedInspectionDate, setSelectedInspectionDate] = useState<string | null>(null);

  useEffect(() => {
    if (authenticatedClient) return;
    const params = new URLSearchParams(window.location.search);
    const portalId = params.get('portal');
    if (portalId) {
      const found = clients.find(c => c.id === portalId);
      if (found) {
        setActiveClient(found);
        setStep('verify');
      }
    }
  }, [clients, authenticatedClient]);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeClient?.portalPin === pin) {
      setIsError(false);
      if (onLogin && activeClient) {
        onLogin(activeClient);
      }
    } else {
      setIsError(true);
    }
  };

  const stats = useMemo(() => {
    if (!activeClient || activeClient.portalPaused || !activeClient.portalAccessGranted) return null;
    const myAssets = equipment.filter(e => e.client_id === activeClient.id && !e.isArchived);
    const myRecords = records.filter(r => myAssets.some(a => a.id === (r.equipmentId || r.equipment_id)));
    
    const siteStats = calculateSiteStats(myAssets, myRecords);

    return { 
      total: siteStats.total, 
      passed: siteStats.passed, 
      percentage: siteStats.finalPercentage, 
      myAssets 
    };
  }, [activeClient, equipment, records]);

  const hasMonthlyInspection = useMemo(() => {
    if (!activeClient) return false;
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return records.some(r => 
      r.taskType === TaskType.INSPECTION && 
      r.date >= firstOfMonth &&
      equipment.find(e => e.id === r.equipmentId)?.client_id === activeClient.id
    );
  }, [activeClient, records, equipment]);

  const [searchQuery, setSearchQuery] = useState('');
  const filteredClients = useMemo(() => {
    if (!searchQuery) return [];
    return clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [clients, searchQuery]);

  const [isInspecting, setIsInspecting] = useState(false);
  const [scannedAssets, setScannedAssets] = useState<string[]>([]);
  const [missingAssets, setMissingAssets] = useState<Equipment[]>([]);
  const [markedMissing, setMarkedMissing] = useState<string[]>([]);
  const [showMissingModal, setShowMissingModal] = useState(false);
  const handleFinishInspection = () => {
    if (!activeClient) return;
    const clientEquipment = equipment.filter(e => e.client_id === activeClient.id && !e.isArchived);
    const missing = clientEquipment.filter(e => !scannedAssets.includes(e.id) && !markedMissing.includes(e.id));
    if (missing.length > 0) {
      setMissingAssets(missing);
      setShowMissingModal(true);
    } else {
      setIsInspecting(false);
      setScannedAssets([]);
      setMarkedMissing([]);
      setViewMode('inspection-reports');
      // We don't necessarily want to exit the portal, just show the reports
      // onGenerateReport(activeClient.id); 
    }
  };

  const inspectionHistory = useMemo(() => {
    if (!activeClient) return [];
    const myAssets = equipment.filter(e => e.client_id === activeClient.id);
    const myAssetIds = new Set(myAssets.map(a => a.id));
    const inspectionRecords = records.filter(r => r.taskType === TaskType.INSPECTION && myAssetIds.has(r.equipmentId));
    const uniqueDates = Array.from(new Set(inspectionRecords.map(r => r.date).filter(Boolean))) as string[];
    return uniqueDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [activeClient, records, equipment]);

  const isCorrectPin = activeClient && activeClient.portalPin === pin;
  const isSubscribed = activeClient && activeClient.portalAccessGranted;
  const isNotPaused = activeClient && !activeClient.portalPaused;
  const isAuthenticated = (isCorrectPin && isSubscribed && isNotPaused) || !!authenticatedClient;

  if (showIntroLetter && activeClient) {
    return <IntroductionLetter client={activeClient} records={records} onBack={() => setShowIntroLetter(false)} />;
  }

  if (viewMode === 'audit-logs' && activeClient) {
    return <ReportGenerator client={activeClient} equipment={equipment.filter(e => e.client_id === activeClient.id)} records={records} faults={faults} technicians={technicians} activeTech={activeTech} onBack={() => setViewMode('dashboard')} />;
  }

  if (viewMode === 'maintenance-com' && activeClient) {
    return <COCGenerator client={activeClient} equipment={equipment.filter(e => e.client_id === activeClient.id && !e.isArchived)} records={records} activeTech={activeTech} onBack={() => setViewMode('dashboard')} />;
  }

  if (viewMode === 'inspection-reports' && activeClient) {
    if (selectedInspectionDate) {
      // We don't have a dedicated "InspectionReportGenerator" but ReportGenerator with a specific filter or a simplified view could work.
      // For now, let's use ReportGenerator but we might need to filter records by date.
      const filteredRecords = records.filter(r => r.date === selectedInspectionDate);
      return <ReportGenerator client={activeClient} equipment={equipment.filter(e => e.client_id === activeClient.id)} records={filteredRecords} faults={faults} technicians={technicians} activeTech={activeTech} onBack={() => setSelectedInspectionDate(null)} />;
    }

    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col">
        <header className="bg-slate-900 text-white p-6 rounded-3xl shadow-md flex justify-between items-center mb-8">
          <h2 className="text-xl font-black uppercase tracking-tight">Monthly Inspection History</h2>
          <button onClick={() => setViewMode('dashboard')} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest">Back</button>
        </header>
        <div className="max-w-4xl mx-auto w-full space-y-4">
          {inspectionHistory.map(date => (
            <button key={date} onClick={() => setSelectedInspectionDate(date)} className="w-full bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-red-500 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900 uppercase">{new Date(date).toLocaleDateString('en-ZA', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Visual Compliance Log</p>
                </div>
              </div>
              <svg className="w-5 h-5 text-slate-300 group-hover:text-red-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
            </button>
          ))}
          {inspectionHistory.length === 0 && (
            <div className="py-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No historical monthly inspections found.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
          <div className="bg-slate-900 p-10 text-center text-white flex flex-col items-center">
            <BrandLogo className="w-12 h-12 mb-4" glow />
            <h1 className="text-2xl font-black uppercase tracking-[0.2em]">Safety Portal</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase mt-3">Registry Access Hub</p>
          </div>

          {activeClient && !activeClient.portalAccessGranted ? (
            <div className="p-10 text-center space-y-6">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto border-2 border-blue-100">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase text-slate-900">Subscription Required</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">The digital safety portal for <strong>{activeClient.name}</strong> has not yet been activated. Please contact Precision Fire Services to subscribe and generate your secure access PIN.</p>
              </div>
              <a href="tel:0781737245" className="block w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg">Enquire Now: 078 173 7245</a>
              <button onClick={() => { setActiveClient(null); setStep('identify'); }} className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-4">Return to Entry</button>
            </div>
          ) : activeClient?.portalPaused ? (
            <div className="p-10 text-center space-y-6">
              <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto border-2 border-amber-100">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase text-slate-900">Access Suspended</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">The digital safety registry for <strong>{activeClient.name}</strong> is temporarily offline. Please contact Precision Fire Services for remediation.</p>
              </div>
              <a href="tel:0781737245" className="block w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg">Call Office: 078 173 7245</a>
              <button onClick={() => { setActiveClient(null); setStep('identify'); }} className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-4">Return to Entry</button>
            </div>
          ) : step === 'identify' ? (
            <div className="p-10 text-center space-y-6">
               <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border-2 border-red-100">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
               </div>
               <div className="space-y-2">
                 <h3 className="text-xl font-black uppercase text-slate-900">Site Access</h3>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed">Scan your <strong>Site QR Code</strong> or search for your property below.</p>
               </div>
               
               <div className="space-y-4">
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Search Property Name..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-bold text-sm"
                    />
                  </div>
                  
                  {filteredClients.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-2xl bg-white shadow-inner">
                      {filteredClients.map(c => (
                        <button 
                          key={c.id} 
                          onClick={() => { setActiveClient(c); setStep('verify'); }}
                          className="w-full px-5 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 flex justify-between items-center"
                        >
                          <span className="font-black text-xs uppercase text-slate-900">{c.name}</span>
                          <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      ))}
                    </div>
                  )}
               </div>

               <div className="pt-4 space-y-3">
                 <button onClick={() => onScanRequest?.()} className="w-full bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                    Scan Site QR
                 </button>
                 <button onClick={onExit} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-lg">Return Home</button>
               </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="p-10 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2 ml-1">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Site PIN</label>
                   <button type="button" onClick={() => { setActiveClient(null); setStep('identify'); }} className="text-[9px] font-black text-red-600 uppercase">Change Site</button>
                </div>
                <input required type="password" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} className={`w-full bg-slate-50 border-2 rounded-2xl px-5 py-4 outline-none text-center text-2xl font-black tracking-[0.5em] ${isError ? 'border-red-500' : 'border-slate-50 focus:border-slate-900'}`} placeholder="000000" />
                {isError && <p className="text-[10px] text-red-600 font-bold mt-2 uppercase text-center">Security PIN Verification Failed.</p>}
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs">Unlock Registry Hub</button>
              <div className="text-center">
                 <p className="text-[10px] text-slate-400 font-medium">PIN is located on your printed Welcome Pack.</p>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white p-6 shadow-md flex justify-between items-center no-print">
        <div className="flex items-center gap-4">
          <BrandLogo className="w-10 h-10" glow />
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight leading-none truncate max-w-[200px]">{activeClient?.name}</h1>
            <p className="text-[8px] text-red-500 font-black uppercase mt-1">Safety Registry Portal</p>
          </div>
        </div>
        <button onClick={() => { setActiveClient(null); setPin(''); setStep('identify'); onExit(); }} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Sign Out</button>
      </header>

      <main className="flex-grow max-w-6xl mx-auto w-full p-4 md:p-6 space-y-6 md:space-y-8 animate-in slide-in-from-bottom-4 duration-500">
        {/* Mobile Tab Navigation */}
        <div className="md:hidden flex overflow-x-auto gap-2 pb-2 scrollbar-hide -mx-4 px-4 sticky top-0 bg-slate-50 z-10">
          <button onClick={() => setViewMode('dashboard')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${viewMode === 'dashboard' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>Dashboard</button>
          <button onClick={() => setViewMode('audit-logs')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${viewMode === 'audit-logs' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>Audit Logs</button>
          <button onClick={() => setViewMode('inspection-reports')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${viewMode === 'inspection-reports' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>Inspections</button>
          <button onClick={() => setViewMode('maintenance-com')} className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${viewMode === 'maintenance-com' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>Certificates</button>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6 md:gap-10">
          <div className="relative w-40 h-40 flex items-center justify-center">
             <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                <circle cx="50" cy="50" r="45" fill="none" stroke={stats!.percentage === 100 ? '#10b981' : '#f59e0b'} strokeWidth="10" strokeDasharray={`${stats!.percentage * 2.82} 282`} strokeLinecap="round" />
             </svg>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={`text-4xl font-black ${stats!.percentage === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>{stats!.percentage}%</div>
                <div className="text-[8px] font-black uppercase text-slate-400 tracking-widest">SANS Status</div>
             </div>
          </div>
          <div className="text-center md:text-left space-y-2">
            <h2 className="text-3xl font-black text-slate-900 leading-tight uppercase tracking-tight">Compliance Grade: <br/><span className={stats?.percentage === 100 ? 'text-emerald-600' : 'text-amber-600'}>{stats?.percentage === 100 ? 'Certified Fully Compliant' : 'Remediation Advised'}</span></h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registry ID: {activeClient?.id.toUpperCase()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
           <button 
             onClick={() => { setIsInspecting(true); onScanRequest?.('inspection'); }} 
             className={`p-8 rounded-[2.5rem] border-4 transition-all text-left shadow-2xl group relative overflow-hidden ${hasMonthlyInspection ? 'bg-emerald-50 border-emerald-100 text-emerald-900' : 'bg-emerald-600 border-emerald-700 hover:bg-emerald-700 text-white'}`}
           >
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform text-white"><svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              <h3 className="text-xl font-black uppercase tracking-tight">Monthly Inspection</h3>
              <p className={`text-[10px] mt-2 font-medium ${hasMonthlyInspection ? 'text-emerald-600' : 'text-emerald-100'}`}>
                {hasMonthlyInspection ? 'Inspection already logged for this month' : 'Log visual site check'}
              </p>
           </button>

           {isInspecting && (
             <button 
               onClick={handleFinishInspection}
               className="bg-red-600 p-8 rounded-[2.5rem] border-4 border-red-700 hover:bg-red-700 transition-all text-left shadow-2xl group relative overflow-hidden text-white"
             >
               <h3 className="text-xl font-black uppercase tracking-tight">Finish Inspection</h3>
             </button>
           )}

           <button onClick={() => onScanRequest?.('fault')} className="bg-red-600 p-8 rounded-[2.5rem] border-4 border-red-700 hover:bg-red-700 transition-all text-left shadow-2xl group relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform text-white"><svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
              <h3 className="text-xl font-black uppercase tracking-tight">Report Fault</h3>
              <p className="text-red-100 text-[10px] mt-2 font-medium">Log equipment defect</p>
           </button>

           <button onClick={() => setViewMode('audit-logs')} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 hover:border-red-500 transition-all text-left shadow-lg group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Audit Logs</h3>
              <p className="text-slate-500 text-[10px] mt-2">Technical history</p>
           </button>

           <button disabled={stats?.percentage === 0} onClick={() => setViewMode('maintenance-com')} className={`p-8 rounded-[2.5rem] border-2 transition-all text-left shadow-lg group relative overflow-hidden ${stats && stats.percentage > 0 ? 'bg-white border-slate-100 hover:border-emerald-500' : 'bg-slate-50 opacity-50 cursor-not-allowed'}`}>
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg></div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Maintenance COM</h3>
              <p className="text-slate-500 text-[10px] mt-2">Professional Certificate</p>
           </button>

           <button onClick={() => setViewMode('inspection-reports')} className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 hover:border-emerald-500 transition-all text-left shadow-lg group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform"><svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Inspection Reports</h3>
              <p className="text-slate-500 text-[10px] mt-2">Monthly visual logs</p>
           </button>

           <button onClick={() => setShowIntroLetter(true)} className="bg-slate-900 p-8 rounded-[2.5rem] border-2 border-slate-800 hover:border-red-500 transition-all text-left shadow-lg group relative overflow-hidden text-white">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform text-white"><svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Intro Letter</h3>
              <p className="text-slate-400 text-[10px] mt-2">Compliance Intro</p>
           </button>
        </div>
      </main>

      <footer className="p-10 text-center text-slate-400 space-y-2">
         <p className="text-[10px] font-black uppercase tracking-[0.4em]">Precision Fire Services • South African Regulatory Node</p>
      </footer>
    </div>
  );
};

export default ClientPortal;