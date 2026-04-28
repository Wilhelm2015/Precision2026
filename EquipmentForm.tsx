import React from 'react';
import { Equipment, InspectionRecord, Client, TaskType, Technician } from '../types';
import { BrandLogo } from './Brand';
import { DISCARD_CHECKLIST } from '../constants';

interface DiscardReportProps {
  equipment: Equipment;
  records: InspectionRecord[];
  client?: Client;
  technicians: Technician[];
  onBack: () => void;
}

const DiscardReport: React.FC<DiscardReportProps> = ({ equipment, records, client, technicians, onBack }) => {
  const discardRecord = records.find(r => r.equipmentId === equipment.id && r.taskType === TaskType.DISCARD);
  
  if (!discardRecord) return <div className="p-20 text-center font-black">No discard record found.</div>;

  // Try to find the specific technician metadata for the report
  const tech = technicians.find(t => discardRecord.inspectorName.includes(t.name) || discardRecord.inspectorName.includes(t.saqcc));

  return (
    <div className="min-h-screen bg-slate-100 p-8 animate-in fade-in duration-500 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center no-print bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-bold flex items-center gap-2 hover:text-slate-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Hub
          </button>
          <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black shadow-lg">Print Discard Record</button>
        </div>

        <div className="bg-white p-12 md:p-20 shadow-2xl border-[12px] border-slate-900 print:border-none print:shadow-none">
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-10">
             <div className="flex items-center gap-6">
                <BrandLogo className="w-16 h-16" />
                <div>
                   <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                   <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mt-1">SCRAP DECOMMISSIONING CERTIFICATE</p>
                </div>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disposal Date</p>
                <p className="text-xl font-black text-slate-900 uppercase">{discardRecord.date}</p>
             </div>
          </div>

          <div className="space-y-12">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-6">
                   <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Property Origin</h4>
                      <p className="font-black text-slate-900 text-xl leading-tight uppercase">{client?.name || 'Site Registered'}</p>
                      <p className="text-xs text-slate-500 font-medium uppercase mt-1">{client?.address}</p>
                   </div>
                   
                   <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-4">
                      <p className="text-[10px] font-black text-red-600 uppercase tracking-widest border-b border-red-100 pb-2">Scrapped Unit Details</p>
                      <div>
                         <p className="text-xs font-bold text-slate-400 uppercase">Serial Number / QR</p>
                         <p className="text-2xl font-black text-slate-900">{equipment.serialNumber}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Type</p>
                            <p className="text-[11px] font-black text-slate-800 uppercase">{equipment.type}</p>
                         </div>
                         <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase">Manufacturer</p>
                            <p className="text-[11px] font-black text-red-600 uppercase">{equipment.manufacturer}</p>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="space-y-6">
                   <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] border-b-2 border-slate-100 pb-2">Decommissioning Protocol</h3>
                   <div className="space-y-3">
                      {DISCARD_CHECKLIST.map(check => (
                         <div key={check.id} className="flex items-center gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div className="w-6 h-6 bg-emerald-600 text-white rounded-lg flex items-center justify-center shrink-0">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <div>
                               <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{check.label}</p>
                               <p className="text-[8px] text-emerald-700 font-medium italic">{check.description}</p>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>

             <div className="bg-slate-900 p-10 rounded-[3rem] text-white flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                <div className="relative z-10">
                   <h3 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Final Declaration</h3>
                   <p className="text-xs text-slate-400 leading-relaxed font-medium">
                      This unit has been formally rendered inoperable and removed from the active site safety registry. It is no longer recognized as a valid fire protection asset. All scrap metal components have been designated for safe recycling in accordance with environmental standards.
                   </p>
                </div>
                <div className="shrink-0 relative z-10 w-32 h-32 bg-white rounded-full flex flex-col items-center justify-center text-center p-4">
                   <div className="text-[9px] font-black text-red-600 uppercase leading-none">SCRAPPED</div>
                   <div className="text-[16px] font-black text-slate-900 uppercase my-0.5 leading-none tracking-tighter">VOIDED</div>
                   <div className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">SANS 1475</div>
                </div>
             </div>

             <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-end gap-12">
                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized By Management</p>
                   <div className="h-20 flex items-center justify-center border-b-2 border-slate-900 px-8 relative">
                      {discardRecord.inspectorSignature ? (
                         <img src={discardRecord.inspectorSignature} className="max-h-full opacity-90 scale-125 mix-blend-multiply" alt="Signature" />
                      ) : (
                         <p className="text-sm font-black uppercase tracking-tighter">MANAGEMENT AUTH</p>
                      )}
                   </div>
                   <div className="mt-2">
                     <p className="text-sm font-black text-slate-900 uppercase">{discardRecord.inspectorName}</p>
                     {tech && (
                       <div className="mt-1 space-y-0.5">
                         <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">SAQCC NO: {tech.saqcc}</p>
                         {tech.cellphone && <p className="text-[8px] font-bold text-slate-400 uppercase">Contact: {tech.cellphone}</p>}
                       </div>
                     )}
                   </div>
                </div>
                <div className="text-right">
                   <p className="text-[12px] font-black text-slate-900 uppercase tracking-widest">Precision Fire Services Services Hub</p>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-1">SANS 1475 Authorized Decommissioning</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiscardReport;