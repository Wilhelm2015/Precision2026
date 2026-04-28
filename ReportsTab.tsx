
import React, { useState, useMemo } from 'react';
import { Equipment, InspectionRecord, Client, TaskType, EquipmentType, FaultReport } from '../types';
import { EQUIPMENT_DEFINITIONS } from '../constants';

interface RectifyTabProps {
  equipment: Equipment[];
  records: InspectionRecord[];
  clients: Client[];
  faults: FaultReport[];
  onUpdateRecord: (record: InspectionRecord) => Promise<void>;
  onUpdateFault: (fault: FaultReport) => Promise<void>;
}

const RectifyTab: React.FC<RectifyTabProps> = ({ equipment, records, clients, faults, onUpdateRecord, onUpdateFault }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRectifying, setIsRectifying] = useState<string | null>(null);

  const activeAssets = useMemo(() => equipment.filter(e => !e.isArchived), [equipment]);

  const failedItems = useMemo(() => {
    return activeAssets.map(asset => {
      const record = records
        .filter(r => r.equipmentId === asset.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      if (!record) return null;
      
      const definition = EQUIPMENT_DEFINITIONS.find(d => d.type === asset.type);
      const checklistItems = definition?.checklists[record.taskType] || [];
      
      const failedChecks = Object.entries(record.findings || {})
        .filter(([_, val]) => val === false)
        .map(([id]) => checklistItems.find(item => item.id === id))
        .filter(Boolean) as { id: string, label: string }[];

      if (record.status !== 'Pass' || failedChecks.length > 0) {
        const client = clients.find(c => c.id === asset.client_id);
        return { asset, record, failedChecks, client };
      }
      return null;
    }).filter(Boolean) as { asset: Equipment, record: InspectionRecord, failedChecks: { id: string, label: string }[], client?: Client }[];
  }, [activeAssets, records, clients]);

  const filteredFailedItems = useMemo(() => {
    if (!searchTerm) return failedItems;
    const lowSearch = searchTerm.toLowerCase();
    return failedItems.filter(item => 
      item.asset.serialNumber.toLowerCase().includes(lowSearch) ||
      item.client?.name.toLowerCase().includes(lowSearch) ||
      item.asset.qrCode?.toLowerCase().includes(lowSearch)
    );
  }, [failedItems, searchTerm]);

  const handleRectify = async (record: InspectionRecord, checkId: string) => {
    let newKpa: string | null = null;
    if (['hr_static', 'hr_flow', 'hy_discharge'].includes(checkId)) {
      newKpa = prompt("Enter new KPA value:");
      if (newKpa === null) return; // User cancelled
    }

    setIsRectifying(`${record.id}-${checkId}`);
    try {
      const updatedFindings = { ...record.findings, [checkId]: true };
      
      // Check if all findings are now true
      const definition = EQUIPMENT_DEFINITIONS.find(d => d.type === record.equipmentType);
      const checklistItems = definition?.checklists[record.taskType] || [];
      const allPassed = checklistItems.every(item => updatedFindings[item.id] === true);

      const updateData: InspectionRecord = {
        ...record,
        findings: updatedFindings,
        status: allPassed ? 'Pass' : record.status
      };
      
      if (newKpa !== null) {
        updateData.flow_pressure_kpa = newKpa;
      }

      await onUpdateRecord(updateData);

      if (allPassed) {
        const fault = faults.find(f => f.equipmentId === record.equipmentId && f.status === 'Open');
        if (fault) {
          await onUpdateFault({ ...fault, status: 'Resolved' });
        }
      }
    } catch (err) {
      console.error("Rectification failed", err);
      alert("Failed to rectify item. Please try again.");
    } finally {
      setIsRectifying(null);
    }
  };

  const handleRectifyAll = async (record: InspectionRecord) => {
    setIsRectifying(record.id);
    try {
      const definition = EQUIPMENT_DEFINITIONS.find(d => d.type === record.equipmentType);
      const checklistItems = definition?.checklists[record.taskType] || [];
      
      const updatedFindings = { ...record.findings };
      checklistItems.forEach(item => {
        updatedFindings[item.id] = true;
      });

      await onUpdateRecord({
        ...record,
        findings: updatedFindings,
        status: 'Pass'
      });

      const fault = faults.find(f => f.equipmentId === record.equipmentId && f.status === 'Open');
      if (fault) {
        await onUpdateFault({ ...fault, status: 'Resolved' });
      }
    } catch (err) {
      console.error("Mass rectification failed", err);
      alert("Failed to rectify all items. Please try again.");
    } finally {
      setIsRectifying(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Rectification Hub</h2>
          <p className="text-sm text-slate-500 font-medium">Correct failed checklist items to restore site compliance and score.</p>
        </div>
        <div className="relative w-full md:w-96">
          <input
            type="text"
            placeholder="Search Serial, Client or QR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 outline-none focus:border-red-500 font-bold transition-all shadow-sm"
          />
          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {filteredFailedItems.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-20 text-center border-2 border-dashed border-slate-100">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">All Systems Operational</h3>
          <p className="text-slate-500 font-medium mt-2">No failed checklist items detected across the fleet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredFailedItems.map(({ asset, record, failedChecks, client }) => (
            <div key={record.id} className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col md:flex-row">
              <div className="w-full md:w-72 bg-slate-900 p-8 text-white flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-2">Asset Identity</p>
                  <h4 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">{asset.serialNumber}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase">{asset.type}</p>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">QR: {asset.qrCode || 'NO TAG'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-slate-500 rounded-full" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 truncate">{client?.name || 'Unlinked Site'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 pt-6 border-t border-white/10">
                  <button 
                    onClick={() => handleRectifyAll(record)}
                    disabled={isRectifying === record.id}
                    className="w-full bg-white text-slate-900 font-black py-3 rounded-xl uppercase tracking-widest text-[10px] hover:bg-emerald-400 transition-colors disabled:opacity-50"
                  >
                    {isRectifying === record.id ? 'Processing...' : 'Rectify All'}
                  </button>
                </div>
              </div>

              <div className="flex-1 p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h5 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Failed Checklist Items</h5>
                    <p className="text-sm font-bold text-slate-600 italic">Correct these items to restore the 2% score deduction per item.</p>
                  </div>
                  <div className="bg-red-50 px-4 py-2 rounded-xl border border-red-100">
                    <span className="text-xs font-black text-red-600 uppercase">-{failedChecks.length * 2}% Impact</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {failedChecks.map((check) => (
                    <div key={check.id} className="group flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <span className="text-[11px] font-black text-slate-700 uppercase leading-tight">{check.label}</span>
                      </div>
                      <button
                        onClick={() => handleRectify(record, check.id)}
                        disabled={isRectifying === `${record.id}-${check.id}`}
                        className="bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-500 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                      >
                        {isRectifying === `${record.id}-${check.id}` ? '...' : 'Fix'}
                      </button>
                    </div>
                  ))}
                </div>

                {record.notes && (
                  <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                    <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-1">Technician Remark</p>
                    <p className="text-xs font-medium text-amber-900 italic">"{record.notes}"</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RectifyTab;
