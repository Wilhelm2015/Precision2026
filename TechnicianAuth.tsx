
import React, { useState, useMemo } from 'react';
import { TaskType, Equipment, EquipmentType, FaultReport, InspectionRecord } from '../types';

interface TaskSelectorProps {
  equipment?: Equipment;
  scannedCode?: string;
  onSelect: (type: TaskType) => void;
  onCancel: () => void;
  onFinalize?: () => void;
  onLinkExisting?: () => void;
  onReplaceQR?: () => void;
  onReplaceUnit?: () => void;
  onUpdateSeal?: () => void;
  onMove?: () => void;
  activeClientName?: string;
  faultReports?: FaultReport[];
  records?: InspectionRecord[];
  onResolveFault?: (id: string, notes: string) => Promise<void>;
  isClient?: boolean;
  children?: React.ReactNode;
}

const TaskSelector: React.FC<TaskSelectorProps> = ({ 
  equipment, scannedCode, onSelect, onCancel, onFinalize, onLinkExisting, 
  onReplaceQR, onReplaceUnit, onUpdateSeal, onMove, activeClientName, faultReports = [], records = [], onResolveFault, isClient = false, children 
}) => {
  const [showCommissionForm, setShowCommissionForm] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  
  const completedTasksToday = useMemo(() => {
    if (!equipment) return new Set<TaskType>();
    return new Set(
      records
        .filter(r => r.equipmentId === equipment.id && r.date === today)
        .filter(r => !(r.taskType === TaskType.PRESSURE_TEST && r.pressureTestOption === 'later'))
        .map(r => r.taskType)
    );
  }, [equipment, records, today]);

  const isUnregistered = !!(!equipment && scannedCode);
  
  const manufacturer = equipment?.manufacturer?.toLowerCase() || '';
  const isIllegal = manufacturer.includes('illegal') || manufacturer.includes('flash fire') || manufacturer.includes('unapproved');

  const TaskButton = ({ type, label, sublabel, icon, colorClass, activeColor }: { 
    type: TaskType, label: string, sublabel: string, icon: React.ReactNode, colorClass: string, activeColor: string 
  }) => {
    const isDone = completedTasksToday.has(type);
    
    return (
      <button 
        onClick={() => !isDone && onSelect(type)} 
        disabled={isDone}
        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all group relative overflow-hidden ${
          isDone ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed' : `${colorClass} hover:${activeColor} shadow-lg active:scale-95`
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner transition-all ${
          isDone ? 'bg-slate-200 text-slate-400' : 'bg-white/20 text-current'
        }`}>
          {isDone ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          ) : icon}
        </div>
        <div className="text-left">
          <div className={`font-black uppercase text-[11px] ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>{label}</div>
          <div className="text-[9px] text-slate-500 font-bold uppercase">{isDone ? 'RECORDED IN REGISTRY TODAY' : sublabel}</div>
        </div>
        {isDone && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 bg-emerald-500 text-white text-[7px] font-black px-2 py-1 rounded-full uppercase tracking-widest shadow-sm">
            Locked
          </div>
        )}
      </button>
    );
  };

  if (showCommissionForm && children) {
    return (
      <div className="fixed inset-0 z-[110] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
        <div className="w-full max-w-xl">{children}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[110] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20">
        <div className={`${isUnregistered ? 'bg-blue-600' : (isIllegal ? 'bg-red-800' : 'bg-red-700')} p-6 text-white relative`}>
          <div className="flex justify-between items-center relative z-10">
            <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg flex items-center gap-2 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
            </button>
            <div className="flex gap-2">
               <button onClick={onCancel} className="text-white/40 hover:text-white text-2xl font-light leading-none">&times;</button>
            </div>
          </div>

          <div className="text-center mt-4">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] mb-2">
                {isUnregistered ? 'Unassigned QR Tag' : (isIllegal ? 'ILLEGAL UNIT DETECTED' : 'Asset Identified')}
            </div>
            <h3 className="text-3xl font-black uppercase tracking-tight">
                {isUnregistered ? 'New Code Detected' : equipment?.serialNumber}
            </h3>
          </div>
        </div>
        
        <div className="p-8 space-y-4 bg-slate-50/50 max-h-[60vh] overflow-y-auto scrollbar-hide">
          <div className="grid grid-cols-1 gap-3">
              {isUnregistered ? (
                 <>
                  {!isClient && (
                    <>
                      {activeClientName && (
                        <button 
                          onClick={() => onSelect(TaskType.INSTALLATION)}
                          className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 bg-red-50 border-red-100 hover:border-red-600 shadow-lg active:scale-95 transition-all group"
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white text-red-600 shadow-inner">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div className="text-left">
                            <div className="font-black text-slate-900 uppercase text-[12px]">Add to {activeClientName}</div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase">Commission new equipment at this site</div>
                          </div>
                        </button>
                      )}

                      <button 
                        onClick={() => onSelect(TaskType.LINK_CLIENT)}
                        className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 bg-emerald-50 border-emerald-100 hover:border-emerald-600 shadow-lg active:scale-95 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white text-emerald-600 shadow-inner">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                        </div>
                        <div className="text-left">
                          <div className="font-black text-slate-900 uppercase text-[12px]">Create New Site Registry</div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase">Register a fresh property and link tag</div>
                        </div>
                      </button>

                      <button 
                        onClick={onLinkExisting} 
                        className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 bg-white border-slate-100 hover:border-blue-600 shadow-lg active:scale-95 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 shadow-inner">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <div className="text-left">
                          <div className="font-black text-slate-900 uppercase text-[12px]">Link to Existing Site</div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase">Search registry to assign code</div>
                        </div>
                      </button>

                      <button 
                        onClick={onReplaceQR} 
                        className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 bg-white border-slate-100 hover:border-red-600 shadow-lg active:scale-95 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-50 text-red-600 shadow-inner">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </div>
                        <div className="text-left">
                          <div className="font-black text-slate-900 uppercase text-[12px]">Replace Existing QR</div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase">Swap damaged tag with this code</div>
                        </div>
                      </button>
                    </>
                  )}
                  {isClient && (
                    <div className="p-10 text-center space-y-4">
                      <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border-2 border-red-100">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </div>
                      <p className="text-xs font-black uppercase text-slate-900">Tag Unrecognized</p>
                      <p className="text-[10px] text-slate-500 font-medium">This tag is not registered to your property. Please contact support.</p>
                    </div>
                  )}
                 </>
              ) : (
                <>
                  {!isClient && (
                    <>
                      <TaskButton 
                          type={TaskType.INSPECTION}
                          label="Audit Inspection"
                          sublabel="Monthly / Periodic Visual Check"
                          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                          colorClass="bg-white border-slate-100"
                          activeColor="border-slate-900"
                      />

                      <TaskButton 
                          type={TaskType.INSTALLATION}
                          label="New Installation"
                          sublabel="Commissioning / New Supply"
                          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                          colorClass="bg-red-50 border-red-100"
                          activeColor="border-red-600"
                      />

                      <TaskButton 
                          type={TaskType.MAINTENANCE}
                          label="SANS Maintenance"
                          sublabel="Annual SANS 1475 Service"
                          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 10-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>}
                          colorClass="bg-white border-slate-100"
                          activeColor="border-red-500"
                      />

                      {equipment?.type === EquipmentType.EXTINGUISHER && (
                        <TaskButton 
                            type={TaskType.PRESSURE_TEST}
                            label="Pressure Test"
                            sublabel="5-Year Pressure Overhaul"
                            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                            colorClass="bg-white border-slate-100"
                            activeColor="border-amber-600"
                        />
                      )}

                      {(equipment?.type === EquipmentType.HOSE_REEL || equipment?.type === EquipmentType.HYDRANT) && (
                        <TaskButton 
                            type={TaskType.FLOW_TEST}
                            label="Flow Rate Test"
                            sublabel="Hydraulic Pressure Validation"
                            icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                            colorClass="bg-white border-slate-100"
                            activeColor="border-sky-500"
                        />
                      )}

                      <TaskButton 
                          type={TaskType.RECHARGE}
                          label="Equipment Recharge"
                          sublabel="Replenishment of Medium"
                          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012-2v2M7 7h10" /></svg>}
                          colorClass="bg-white border-slate-100"
                          activeColor="border-blue-500"
                      />

                      <div className="grid grid-cols-3 gap-3 mt-2">
                        <button 
                          onClick={onReplaceUnit}
                          className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-red-600 transition-all group shadow-md"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 text-red-600 mb-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-900">Replace Unit</span>
                        </button>
                        <button 
                          onClick={onReplaceQR}
                          className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-blue-600 transition-all group shadow-md"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 mb-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-900">Replace QR</span>
                        </button>
                        <button 
                          onClick={onUpdateSeal}
                          className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-emerald-600 transition-all group shadow-md"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 mb-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-900">Replace Seal</span>
                        </button>
                        <button 
                          onClick={onMove}
                          className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-amber-600 transition-all group shadow-md"
                        >
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 mb-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-900">Move Asset</span>
                        </button>
                      </div>
                    </>
                  )}

                  {isClient && (
                    <TaskButton 
                        type={TaskType.INSPECTION}
                        label="Audit Inspection"
                        sublabel="Monthly / Periodic Check"
                        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>}
                        colorClass="bg-white border-slate-100"
                        activeColor="border-slate-900"
                    />
                  )}

                  {!isClient && (
                    <div className="pt-6 border-t border-slate-100 mt-2">
                      <button 
                        onClick={onFinalize}
                        className="w-full bg-emerald-600 text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        Finalize & Create Reports
                      </button>
                    </div>
                  )}
                </>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskSelector;
