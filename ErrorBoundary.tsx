
import React from 'react';
import { Equipment, InspectionRecord } from '../types';
import { EQUIPMENT_DEFINITIONS } from '../constants';

interface HistoryModalProps {
  equipment: Equipment;
  records: InspectionRecord[];
  onClose: () => void;
  onViewFullReport: (record: InspectionRecord) => void;
  onStartMaintenance?: (equipment: Equipment) => void;
  onDeleteRecord?: (recordId: string) => void;
  isManager?: boolean;
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

const SAQCCLogoPlaceholder = () => (
  <div className="flex flex-col items-center justify-center bg-white border-2 border-slate-200 rounded-lg p-2 w-[60px] h-[45px]">
    <div className="text-[10px] font-black text-slate-800 leading-none">SAQCC</div>
    <div className="text-[6px] font-bold text-red-600 uppercase mt-0.5">FIRE</div>
  </div>
);

const HistoryModal: React.FC<HistoryModalProps> = ({ 
  equipment, records, onClose, onViewFullReport, onStartMaintenance, onDeleteRecord, isManager 
}) => {
  const history = records
    .filter(r => r.equipmentId === equipment.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getChecklistLabels = (record: InspectionRecord) => {
    const definition = EQUIPMENT_DEFINITIONS.find(d => d.type === record.equipmentType);
    const checklist = definition?.checklists[record.taskType] || [];
    return checklist;
  };

  return (
    <div className="fixed inset-0 z-[600] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300 no-print">
      <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Service History</h3>
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-1">
              SN: {equipment.serialNumber} • {equipment.type}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-4 shrink-0">
           <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Manufacture Date</p>
              <p className="text-[10px] font-black text-slate-900 uppercase">{equipment.manufactureDateUnknown ? 'UNKNOWN' : formatDate(equipment.manufactureDate)}</p>
           </div>
           <div>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Last Pressure Test</p>
              <p className="text-[10px] font-black text-slate-900 uppercase">{equipment.pressureTestDateUnknown ? 'UNKNOWN' : formatDate(equipment.lastPressureTestDate)}</p>
           </div>
           <div className="hidden sm:block">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Fleet Identity</p>
              <p className="text-[10px] font-black text-slate-900 uppercase truncate">{equipment.manufacturer}</p>
           </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          {history.length === 0 ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 text-center space-y-6">
                  <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
                    <SAQCCLogoPlaceholder />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2">New Registry Entry</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                      No service records found for this asset in the cloud registry. This asset is ready for its initial SANS 1475 commissioning or annual maintenance cycle.
                    </p>
                  </div>
                  {onStartMaintenance && (
                    <button 
                      onClick={() => onStartMaintenance(equipment)}
                      className="w-full bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                      Begin Onboarding Audit
                    </button>
                  )}
               </div>
            </div>
          ) : (
            <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {history.map((record) => {
                const checklistItems = getChecklistLabels(record);

                return (
                  <div key={record.id} className="relative flex items-center justify-between group">
                    <div className="flex items-start w-full">
                      {/* Timeline dot */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shadow-sm shrink-0 z-10 transition-colors mt-2 ${
                        record.status === 'Pass' ? 'bg-emerald-500' : 'bg-red-500'
                      }`}>
                        {record.status === 'Pass' ? (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </div>

                      <div className="ml-6 flex-1 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group-hover:border-red-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div>
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block mb-1">
                              {formatDate(record.date)}
                            </span>
                            <h4 className="font-black text-slate-900 uppercase text-xs tracking-tight">
                              {record.taskType}
                            </h4>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => onViewFullReport(record)}
                              className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm"
                            >
                              Report
                            </button>
                            {isManager && onDeleteRecord && (
                                <button 
                                onClick={() => { if(window.confirm("Permanently delete this audit record from the cloud registry?")) onDeleteRecord(record.id); }}
                                className="px-3 py-1.5 bg-slate-100 text-slate-400 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                >
                                    Delete
                                </button>
                            )}
                          </div>
                        </div>

                        {checklistItems.length > 0 && (
                          <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                            <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 border-b border-slate-200 pb-1">Historical SANS Checklist</h5>
                            {checklistItems.map(item => {
                              const result = record.findings[item.id];
                              return (
                                <div key={item.id} className="flex items-center justify-between gap-4 py-0.5">
                                  <span className="text-[9px] font-bold text-slate-600 leading-tight">{item.label}</span>
                                  {result === true ? (
                                    <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                  ) : result === false ? (
                                    <svg className="w-3 h-3 text-red-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" /></svg>
                                  ) : (
                                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter shrink-0">N/A</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        
                        <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
                          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                            Authorised Tech: <span className="text-slate-600">{record.inspectorName}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-6 bg-white border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-black transition-all"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
