import React, { useState } from 'react';
import { calculateSiteStats } from '../src/lib/scoring';
import { Client, Equipment, InspectionRecord } from '../types';

interface COCTabProps {
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  onGenerateCOC: (clientId: string) => void;
}

const COCTab: React.FC<COCTabProps> = ({ clients, equipment, records, onGenerateCOC }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const getComplianceStatus = (clientId: string) => {
    const clientEquipment = equipment.filter(e => e.client_id === clientId && !e.isArchived);
    if (clientEquipment.length === 0) return { eligible: false, message: 'No active assets registered.' };

    const clientRecords = records.filter(r => clientEquipment.some(e => e.id === (r.equipmentId || r.equipment_id)));
    const stats = calculateSiteStats(clientEquipment, clientRecords);

    // SANS Update: A Partial maintenance cert can be issued if at least one unit has passed the technical audit
    const isFullyCompliant = stats.isCompliant;
    const isPartiallyCompliant = stats.passed > 0 && !stats.isCompliant;
    const eligible = stats.passed > 0;

    return {
      eligible,
      isFullyCompliant,
      isPartiallyCompliant,
      passed: stats.passed,
      failed: stats.failed,
      pending: stats.pending,
      total: stats.total,
      percentage: stats.finalPercentage
    };
  };

  const filteredClients = clients
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.address.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-2">Maintenance Certificates (COM)</h2>
          <p className="text-slate-400 max-w-xl">
            Issuing an official Maintenance Certificate confirms that fire protection equipment has been serviced to SANS 1475 standards. Partial certificates can be generated for sites with ongoing remediations.
          </p>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border shadow-sm">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search sites by name or address..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 sm:text-sm transition-colors"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400 italic">No clients found matching your search.</p>
          </div>
        ) : (
          filteredClients.map(client => {
            const status = getComplianceStatus(client.id);
            return (
              <div key={client.id} className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col ${status.isFullyCompliant ? 'border-emerald-200' : status.isPartiallyCompliant ? 'border-amber-200' : 'border-slate-200'}`}>
                <div className="p-6 flex-1 space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{client.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 truncate">{client.address}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Site Health</span>
                      <span className={`text-lg font-black ${status.isFullyCompliant ? 'text-emerald-600' : 'text-amber-600'}`}>{status.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ${status.isFullyCompliant ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                        style={{ width: `${status.percentage}%` }}
                      ></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-100">
                        <div className="text-[10px] font-bold text-emerald-600 uppercase">Passed</div>
                        <div className="text-lg font-black text-emerald-700">{status.passed}</div>
                      </div>
                      <div className="bg-red-50 p-2 rounded-xl border border-red-100">
                        <div className="text-[10px] font-bold text-red-600 uppercase">Defective</div>
                        <div className="text-lg font-black text-red-700">{status.failed}</div>
                      </div>
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Pending</div>
                        <div className="text-lg font-black text-slate-600">{status.pending}</div>
                      </div>
                    </div>
                  </div>

                  {status.isPartiallyCompliant && (
                    <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <p className="text-xs text-amber-800 leading-relaxed font-medium">
                        Property has {status.passed} passed units. A Partial Maintenance Cert can be issued, but {status.failed + status.pending} units remain non-compliant.
                      </p>
                    </div>
                  )}

                  {!status.eligible && (
                    <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      <p className="text-xs text-red-800 leading-relaxed font-medium">
                        Ineligible for Certification. No equipment has passed inspection for the current maintenance cycle.
                      </p>
                    </div>
                  )}
                </div>

                <div className="px-6 pb-6 pt-2">
                  <button 
                    disabled={!status.eligible}
                    onClick={() => onGenerateCOC(client.id)}
                    className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 ${
                      status.isFullyCompliant 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700' 
                      : status.eligible 
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 hover:bg-amber-600'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    {status.isFullyCompliant ? 'Issue Full Certificate' : status.eligible ? 'Issue Partial COM' : 'Issue COM'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default COCTab;