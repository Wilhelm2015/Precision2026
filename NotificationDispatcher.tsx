import React, { useMemo, useState, useRef } from 'react';
import { Equipment, Client, InspectionRecord, FaultReport, TaskType } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PerformanceHubProps {
  equipment: Equipment[];
  clients: Client[];
  records: InspectionRecord[];
  faults: FaultReport[];
}

const PerformanceHub: React.FC<PerformanceHubProps> = ({ equipment, clients, records, faults }) => {
  const [activeQuarter, setActiveQuarter] = useState<number>(Math.floor((new Date().getMonth() + 3) / 3));
  const [selectedClientId, setSelectedClientId] = useState<string>('ALL');
  const [isGenerating, setIsGenerating] = useState(false);
  const hubRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Filter source data by client if needed
    const filteredEquipment = selectedClientId === 'ALL' 
      ? equipment 
      : equipment.filter(e => e.client_id === selectedClientId);
    
    const assetIds = new Set(filteredEquipment.map(e => e.id));

    const filteredRecords = selectedClientId === 'ALL'
      ? records
      : records.filter(r => assetIds.has(r.equipmentId));

    const filteredFaults = selectedClientId === 'ALL'
      ? faults
      : faults.filter(f => assetIds.has(f.equipmentId));

    // Scheduled Maintenance KPI
    const totalFleet = filteredEquipment.filter(e => !e.isArchived).length;
    const completedMaintenance = filteredEquipment.filter(e => {
      if (e.isArchived) return false;
      return filteredRecords.some(r => r.equipmentId === e.id && r.taskType === TaskType.MAINTENANCE && new Date(r.date).getFullYear() === currentYear);
    }).length;
    
    const maintenanceCompletionRate = totalFleet > 0 ? Math.round((completedMaintenance / totalFleet) * 100) : 0;

    // Response Time Adherence KPI (Faults)
    const totalFaultsCount = filteredFaults.length;
    const resolvedFaults = filteredFaults.filter(f => f.status === 'Resolved');
    
    const onTimeResolutions = resolvedFaults.filter(f => {
      if (!f.slaDeadline) return true;
      return (f.timestamp ? new Date(f.timestamp) : new Date()) < new Date(f.slaDeadline);
    }).length;

    const responseAdherenceRate = totalFaultsCount > 0 ? Math.round((onTimeResolutions / totalFaultsCount) * 100) : 100;

    // Corrective Action Closure Rate
    const failedInspections = filteredRecords.filter(r => r.status === 'Fail' || r.status === 'Service Required').length;
    const resolvedActions = resolvedFaults.length + filteredRecords.filter(r => r.status === 'Pass' && r.taskType !== TaskType.INSPECTION).length;
    
    const closureRate = (failedInspections + totalFaultsCount) > 0 
      ? Math.round((resolvedActions / (failedInspections + totalFaultsCount)) * 100) 
      : 100;

    return {
      maintenanceCompletionRate,
      responseAdherenceRate,
      closureRate,
      totalFleet,
      completedMaintenance,
      totalFaults: totalFaultsCount,
      resolvedFaults: resolvedFaults.length
    };
  }, [equipment, records, faults, selectedClientId]);

  const chartData = [
    { name: 'Maintenance', value: metrics.maintenanceCompletionRate, color: '#ef4444' },
    { name: 'Response', value: metrics.responseAdherenceRate, color: '#10b981' },
    { name: 'Closure', value: metrics.closureRate, color: '#3b82f6' }
  ];

  const currentClient = clients.find(c => c.id === selectedClientId);

  const handleDownloadPdf = async () => {
    if (!hubRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(hubRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#f8fafc',
        logging: false,
        windowWidth: 1200
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4', false);
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`Performance_Hub_${selectedClientId === 'ALL' ? 'Global' : currentClient?.name}.pdf`);
    } catch (err) {
      console.error("PDF Error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div ref={hubRef} className="space-y-8 animate-in fade-in duration-500 p-4 bg-slate-50 rounded-[3rem]">
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-2xl no-print">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em]">Operations Analytics</span>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tight leading-none">Performance Hub</h2>
          <p className="text-slate-400 text-sm font-medium max-w-md">Real-time KPI monitoring for SANS 1475 maintenance delivery and service level adherence.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 relative z-10 w-full md:w-auto">
           <select 
             value={selectedClientId} 
             onChange={(e) => setSelectedClientId(e.target.value)}
             className="bg-white/10 border border-white/20 text-white rounded-2xl px-6 py-4 font-black uppercase text-[10px] tracking-widest outline-none focus:border-emerald-500 transition-all appearance-none min-w-[240px]"
           >
             <option value="ALL" className="bg-slate-900 text-white font-bold">Fleet Global View</option>
             {clients.map(c => (
               <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
             ))}
           </select>
           <button 
             onClick={handleDownloadPdf}
             disabled={isGenerating}
             className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 00-2 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
             {isGenerating ? 'Syncing...' : 'Export PDF'}
           </button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4">
        <div className={`w-2 h-2 rounded-full ${selectedClientId === 'ALL' ? 'bg-red-500' : 'bg-emerald-500'}`} />
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
          Context: {selectedClientId === 'ALL' ? 'Global Portfolio' : currentClient?.name}
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* KPI 1: Maintenance */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-64 group hover:border-red-500 transition-all">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Maintenance Completion</span>
              <div className="w-8 h-8 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 10-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>
              </div>
            </div>
            <h3 className="text-4xl font-black text-slate-900">{metrics.maintenanceCompletionRate}%</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Annual SANS Cycle Integrity</p>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${metrics.maintenanceCompletionRate}%` }} />
          </div>
        </div>

        {/* KPI 2: Adherence */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-64 group hover:border-emerald-500 transition-all">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SLA Response Adherence</span>
              <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <h3 className="text-4xl font-black text-slate-900">{metrics.responseAdherenceRate}%</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Target vs. Actual Remediation</p>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${metrics.responseAdherenceRate}%` }} />
          </div>
        </div>

        {/* KPI 3: Closure Rate */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between h-64 group hover:border-blue-500 transition-all">
          <div>
            <div className="flex justify-between items-start mb-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Corrective Action Closure</span>
              <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
            </div>
            <h3 className="text-4xl font-black text-slate-900">{metrics.closureRate}%</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">Defect Remediation Throughput</p>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${metrics.closureRate}%` }} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden p-10">
        <div className="flex flex-col md:flex-row justify-between items-start mb-10 gap-6">
          <div>
             <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Performance Trends</h3>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comparative KPI Distribution</p>
          </div>
          <div className="flex gap-2">
             {[1, 2, 3, 4].map(q => (
               <button 
                 key={q}
                 onClick={() => setActiveQuarter(q)}
                 className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeQuarter === q ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
               >
                 Q{q}
               </button>
             ))}
          </div>
        </div>

        <div className="h-[400px] w-full">
           <ResponsiveContainer width="100%" height="100%">
             <BarChart data={chartData}>
               <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
               <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} />
               <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} domain={[0, 100]} />
               <Tooltip 
                cursor={{fill: '#f8fafc'}}
                contentStyle={{borderRadius: '1.5rem', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '1rem'}}
               />
               <Bar dataKey="value" radius={[15, 15, 0, 0]} barSize={80}>
                 {chartData.map((entry, index) => (
                   <Cell key={`cell-${index}`} fill={entry.color} />
                 ))}
               </Bar>
             </BarChart>
           </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-6 border-b border-slate-200 pb-2">Operational Insight</h4>
            <ul className="space-y-4">
               <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 shadow-sm text-xs font-black">1</div>
                  <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                    {selectedClientId === 'ALL' ? 'Fleet global' : `The property "${currentClient?.name}" has a`} maintenance completion of <span className="font-black text-slate-900">{metrics.maintenanceCompletionRate}%</span> which indicates current annual cycle progress for the context fleet of {metrics.totalFleet} units.
                  </p>
               </li>
               <li className="flex items-start gap-4">
                  <div className="w-6 h-6 bg-white rounded-lg border border-slate-200 flex items-center justify-center shrink-0 shadow-sm text-xs font-black">2</div>
                  <p className="text-[11px] font-medium text-slate-600 leading-relaxed">
                    Corrective action closure rate of <span className="font-black text-slate-900">{metrics.closureRate}%</span> monitors how effectively technical failures are being remediated through the registry for this specific selection.
                  </p>
               </li>
            </ul>
         </div>
         <div className="bg-white p-8 rounded-[2.5rem] border-2 border-red-600 shadow-2xl shadow-red-100 flex flex-col justify-center text-center space-y-4">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em]">
              {selectedClientId === 'ALL' ? 'Fleet' : 'Property'} Integrity Score
            </p>
            <div className="text-7xl font-black text-slate-900">{Math.round((metrics.maintenanceCompletionRate + metrics.responseAdherenceRate + metrics.closureRate) / 3)}%</div>
            <p className="text-xs font-bold text-slate-400 uppercase">Quarterly Composite Rating</p>
         </div>
      </div>
    </div>
  );
};

export default PerformanceHub;