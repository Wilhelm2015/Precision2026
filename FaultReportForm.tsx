import React, { useState, useMemo } from 'react';
import { FaultReport, Equipment, Client, Technician } from '../types';
import FaultTicketDetail from './FaultTicketDetail';
import FaultReportForm from './FaultReportForm';
import { syncService } from '../services/registryService';

interface FaultHubProps {
  faults: FaultReport[];
  equipment: Equipment[];
  clients: Client[];
  technicians: Technician[];
  onRefresh: () => void;
  onScanRequest: () => void;
  activeTech: Technician | null;
  isManager: boolean;
  onFaultLogged?: (report: FaultReport) => void;
  validateSubmission: (equipmentId: string) => { allowed: boolean; reason?: string };
}

const getSLADetails = (fault: FaultReport) => {
  if (!fault.slaDeadline || fault.status === 'Resolved') return null;
  const deadline = new Date(fault.slaDeadline);
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  const hoursRemaining = Math.round(diff / (1000 * 60 * 60));
  
  let color = 'text-emerald-600 bg-emerald-50';
  if (hoursRemaining <= 0) color = 'text-red-600 bg-red-50 animate-pulse';
  else if (hoursRemaining <= 24) color = 'text-amber-600 bg-amber-50';

  return {
    hours: hoursRemaining,
    label: hoursRemaining <= 0 ? 'SLA BREACHED' : `${hoursRemaining}h remaining`,
    color
  };
};

const FaultHub: React.FC<FaultHubProps> = ({ faults, equipment, clients, technicians, onRefresh, onScanRequest, activeTech, isManager, onFaultLogged, validateSubmission }) => {
  const [activeTab, setActiveTab] = useState<'open' | 'resolved'>('open');
  const [selectedFaultId, setSelectedFaultId] = useState<string | null>(null);
  const [showLogForm, setShowLogForm] = useState(false);

  const filteredFaults = useMemo(() => {
    return faults.filter(f => {
      const statusMatch = activeTab === 'open' ? f.status === 'Open' : f.status === 'Resolved';
      const asset = equipment.find(e => e.id === f.equipmentId);
      if (activeTab === 'open' && asset?.isArchived) return false;
      return statusMatch;
    });
  }, [faults, activeTab, equipment]);

  const selectedFault = useMemo(() => faults.find(f => f.id === selectedFaultId), [faults, selectedFaultId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-red-600 p-10 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden shadow-2xl shadow-red-200">
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em]">Fleet Incident Pulse</span>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tight leading-none">Fault Hub</h2>
          <p className="text-red-100 text-sm font-medium max-w-md">Central monitoring for malfunctioning safety equipment. remediations are tracked via SANS 1475 SLA protocols.</p>
        </div>
        <div className="flex gap-3 relative z-10">
           <button 
             onClick={() => setShowLogForm(true)}
             className="bg-white text-red-600 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-slate-50 transition-all active:scale-95 flex items-center gap-2"
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
             Save New Fault
           </button>
           <button 
             onClick={onScanRequest}
             className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-2"
           >
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
             Scan to Fix
           </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('open')}
          className={`px-8 py-4 font-black text-[10px] uppercase tracking-widest transition-all border-b-4 ${activeTab === 'open' ? 'border-red-600 text-red-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Active Incidents ({faults.filter(f => f.status === 'Open').length})
        </button>
        <button 
          onClick={() => setActiveTab('resolved')}
          className={`px-8 py-4 font-black text-[10px] uppercase tracking-widest transition-all border-b-4 ${activeTab === 'resolved' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          Remediation Archive
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFaults.length === 0 ? (
          <div className="col-span-full py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No {activeTab} faults found in registry.</p>
          </div>
        ) : (
          filteredFaults.map(fault => {
            const asset = equipment.find(e => e.id === fault.equipmentId);
            const client = clients.find(c => c.id === asset?.client_id);
            const isAllTechs = fault.assignedTechnicianId === 'ALL_TECHS';
            const assignedTo = isAllTechs ? null : technicians.find(t => t.id === fault.assignedTechnicianId);
            const sla = getSLADetails(fault);
            
            return (
              <div 
                key={fault.id}
                onClick={() => setSelectedFaultId(fault.id)}
                className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 space-y-6 hover:border-red-500 hover:shadow-xl transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                       <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none group-hover:text-red-600 transition-colors">{asset?.serialNumber || 'UNKNOWN'}</h4>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[150px]">{client?.name || 'Unassigned Site'}</p>
                    </div>
                    <div className={`p-2 rounded-xl ${activeTab === 'open' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={activeTab === 'open' ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z' : 'M5 13l4 4L19 7'} />
                       </svg>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {fault.severity && (
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${
                        fault.severity === 'Critical' ? 'bg-red-600 text-white' : 
                        fault.severity === 'Urgent' ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'
                      }`}>
                        {fault.severity}
                      </span>
                    )}
                    {sla && (
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${sla.color}`}>
                        {sla.label}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-bold text-slate-600 italic leading-relaxed line-clamp-3">"{fault.description}"</p>
                  
                  <div className="flex flex-wrap gap-2 pt-2">
                     <div className={`px-3 py-1.5 rounded-full border border-slate-100 flex items-center gap-2 ${isAllTechs ? 'bg-blue-50 border-blue-100' : 'bg-slate-50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${assignedTo || isAllTechs ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className={`text-[8px] font-black uppercase tracking-widest ${isAllTechs ? 'text-blue-600' : 'text-slate-500'}`}>
                           {isAllTechs ? 'All Technicians (Broadcast)' : (assignedTo ? assignedTo.name : 'Unallocated')}
                        </span>
                     </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50">
                  <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[9px] group-hover:bg-red-600 transition-all">Control Ticket</button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedFault && (
        <FaultTicketDetail 
          fault={selectedFault}
          equipment={equipment.find(e => e.id === selectedFault.equipmentId)}
          client={clients.find(c => c.id === equipment.find(e => e.id === selectedFault.equipmentId)?.client_id)}
          technicians={technicians}
          isManager={isManager}
          onClose={() => setSelectedFaultId(null)}
          onResolve={() => { onRefresh(); setSelectedFaultId(null); }}
          onRefresh={onRefresh}
        />
      )}

      {showLogForm && (
        <FaultReportForm 
          equipment={equipment}
          clients={clients}
          onClose={() => setShowLogForm(false)}
          onSave={(report) => {
            if (onFaultLogged) onFaultLogged(report);
            onRefresh();
          }}
          validateSubmission={validateSubmission}
        />
      )}
    </div>
  );
};

export default FaultHub;