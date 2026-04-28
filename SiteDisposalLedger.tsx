import React, { useState } from 'react';
import { InspectionRecord, Equipment, Client, TaskType, EquipmentType } from '../types';
import { SACAS_PERMIT_NUMBER, EQUIPMENT_DEFINITIONS } from '../constants';
import { BrandLogo } from './Brand';
import { getProxiedImageUrl } from '../services/registryService';
import { QRCodeSVG } from 'qrcode.react';
import ImageModal from './ImageModal';
import { getAppBaseUrl } from '../utils';

interface SingleRecordReportProps {
  record: InspectionRecord;
  equipment?: Equipment;
  client?: Client;
  onClose: () => void;
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr || 'N/A';
  }
};

const SingleRecordReport: React.FC<SingleRecordReportProps> = ({ record, equipment, client, onClose }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const handlePrint = () => window.print();
  const photos = record.photos || equipment?.photos || [];

  const brandingStr = typeof window !== 'undefined' ? localStorage.getItem('pfs_branding') : null;
  const branding = brandingStr ? JSON.parse(brandingStr) : {};

  const definition = EQUIPMENT_DEFINITIONS.find(d => d.type === record.equipmentType);
  
  // Get the primary checklist for the task, but fallback to INSPECTION if empty
  let checklistItems = definition?.checklists[record.taskType] || [];
  if (checklistItems.length === 0 && record.taskType !== TaskType.INSPECTION) {
    checklistItems = definition?.checklists[TaskType.INSPECTION] || [];
  }

  const isPressureTest = record.taskType === TaskType.PRESSURE_TEST;
  const isRecharge = record.taskType === TaskType.RECHARGE;
  const isHydraulicAsset = record.equipmentType === EquipmentType.HOSE_REEL || record.equipmentType === EquipmentType.HYDRANT;

  // SANS 1475: Pressure tests are typically valid for a 5-year cycle
  const getNextPressureTestDate = (currentDate: string) => {
    const d = new Date(currentDate);
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().split('T')[0];
  };

  const handleShare = async () => {
    const shareData = {
      title: `${record.taskType} Record - ${equipment?.serialNumber}`,
      text: `Precision Fire Services: ${record.taskType} logged for asset ${equipment?.serialNumber}. Status: ${record.status}.`,
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.text);
        alert("Report summary copied to clipboard.");
      }
    } catch (err) {
      console.error("Error sharing record:", err);
    }
  };

  const isFlashFire = (() => {
    const m = (equipment?.manufacturer || '').toLowerCase();
    const mk = (equipment?.make || '').toLowerCase();
    return m.includes('flash fire') || m.includes('flashfire') || mk.includes('flash fire') || mk.includes('flashfire');
  })();

  const getWatermarkText = () => {
    if (isFlashFire) return 'CONDEMNED (ILLEGAL)';
    if (record.status === 'Condemned') return 'CONDEMNED';
    if (isPressureTest) return 'PRESSURE TEST';
    if (isRecharge) return 'RECHARGE';
    return 'CERTIFIED';
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-100 flex flex-col items-center p-4 md:p-8 overflow-y-auto no-print">
      <div className="max-w-4xl w-full space-y-6">
        {/* Navigation / Actions Bar */}
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4">
             <button 
               onClick={onClose} 
               className="p-3 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all active:scale-90"
               title="Back to Registry"
               aria-label="Go back"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
             </button>
             <div>
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Document Registry Node</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Record: {record.id.slice(0,8)}</p>
             </div>
          </div>
          <div className="flex gap-2">
             <button onClick={handleShare} className="bg-white border-2 border-slate-100 text-slate-700 px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all active:scale-95">
               Share
             </button>
             <button onClick={handlePrint} className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95">
               Export PDF
             </button>
          </div>
        </div>

        {/* Official Document Body */}
        <div id="report-content" className="bg-white w-[210mm] h-[297mm] p-12 flex flex-col shadow-2xl border-2 border-slate-200 print:shadow-none print:border-none print:p-0 relative overflow-hidden mx-auto">
          {/* Regulatory Watermark - OVERLAY V12.19 */}
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rotate-[-35deg] whitespace-nowrap font-black uppercase select-none text-center opacity-[0.35] z-[120] ${isFlashFire || record.status === 'Condemned' ? 'text-red-600 text-[6rem]' : 'text-emerald-500 text-[8rem]'}`}>
            {getWatermarkText()}
          </div>

          {/* Header */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8 relative z-10">
            <div className="flex items-center gap-6">
              <BrandLogo className="w-16 h-16" branding={branding} />
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tighter leading-none text-slate-900">Precision Fire Services</h1>
                <p className="text-[11px] font-black text-red-600 uppercase mt-2 tracking-[0.4em]">SANS Permit: {SACAS_PERMIT_NUMBER}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorised Field Services Node</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">
                {isPressureTest ? 'Pressure Test Validation' : isRecharge ? 'Asset Recharge Log' : 'Technical Record'}
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registry ID: {record.id.toUpperCase()}</p>
            </div>
          </div>

          {/* Asset & Site Summary */}
          <div className="grid grid-cols-2 gap-10 mb-8 relative z-10">
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3 border-l-4 border-slate-200 pl-3">Property Particulars</h4>
                <p className="font-black text-slate-900 text-2xl leading-tight tracking-tighter uppercase">{client?.name || 'Site Registered'}</p>
                {client?.building && <p className="text-[11px] text-slate-600 font-bold uppercase mt-1 tracking-tight">{client.building}</p>}
                <p className="text-[11px] text-slate-500 font-black uppercase mt-1 tracking-widest leading-tight">{client?.address}</p>
              </div>
              
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3 border-l-4 border-slate-200 pl-3">Technical Data</h4>
                <div className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                  <p className="font-black text-white uppercase tracking-tighter text-3xl leading-none mb-2 relative z-10">{equipment?.serialNumber}</p>
                  <p className="text-[12px] text-red-500 font-black uppercase tracking-widest relative z-10">{equipment?.type} {equipment?.size ? `(${equipment.size})` : ''}</p>
                  <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-2 gap-4 text-[9px] font-black uppercase tracking-widest text-slate-400 relative z-10">
                    <div>
                      <span className="opacity-60">Manufacturer:</span>
                      <p className="text-white text-[11px] font-black mt-1">{equipment?.manufacturer || 'Unknown'}</p>
                    </div>
                    <div>
                      <span className="opacity-60">Validation Result:</span>
                      <p className={`text-[11px] font-black mt-1 ${record.status === 'Pass' ? 'text-emerald-400' : 'text-red-500'}`}>
                        {isFlashFire ? 'CONDEMNED (ILLEGAL)' : record.status === 'Condemned' ? 'CONDEMNED' : record.status === 'Pass' ? 'PASSED' : 'DEFECT'}
                      </p>
                    </div>
                    {(record.sealSerialNumber || record.seal_serial_number) && (
                      <div>
                        <span className="opacity-60">Seal SN:</span>
                        <p className="text-blue-400 text-[11px] font-black mt-1">{record.sealSerialNumber || record.seal_serial_number}</p>
                      </div>
                    )}
                    {(record.testedToKpa || record.tested_to_kpa) && (
                      <div>
                        <span className="opacity-60">Tested To P.KPA:</span>
                        <p className="text-amber-400 text-[11px] font-black mt-1">{record.testedToKpa || record.tested_to_kpa} kPa</p>
                      </div>
                    )}
                    {(record.flow_pressure_kpa) && (
                      <div>
                        <span className="opacity-60">Flow Pressure:</span>
                        <p className="text-amber-400 text-[11px] font-black mt-1">{record.flow_pressure_kpa} kPa</p>
                      </div>
                    )}
                    {(record.calculatedFlowLpm || record.calculated_flow_lpm) && (
                      <div>
                        <span className="opacity-60">Calculated Flow:</span>
                        <p className="text-blue-400 text-[11px] font-black mt-1">{record.calculatedFlowLpm || record.calculated_flow_lpm} L/min</p>
                      </div>
                    )}
                    <div>
                      <span className="opacity-60">Next Pressure Test:</span>
                      <p className="text-amber-400 text-[11px] font-black mt-1">
                        {formatDate(equipment?.nextPressureTestDate || (isPressureTest && record.status === 'Pass' ? getNextPressureTestDate(record.date) : 'N/A'))}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Status Panel */}
            <div className={`p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all ${isPressureTest ? 'bg-amber-600' : isRecharge ? 'bg-blue-600' : 'bg-slate-900 border-2 border-slate-800'}`}>
               <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl"></div>
               <div className="relative z-10 flex justify-between items-start">
                 <div>
                   <h4 className="text-[9px] font-black uppercase tracking-[0.4em] mb-3 opacity-80">
                     {isPressureTest ? '5-Year Critical Safety Cycle' : isRecharge ? 'Medium Replenishment Log' : 'Site Compliance Cycle'}
                   </h4>
                   <span className="px-6 py-3 rounded-2xl text-[14px] font-black uppercase tracking-widest shadow-2xl bg-white/10 border border-white/20 backdrop-blur-xl inline-block">
                     {record.taskType}
                   </span>
                 </div>
                 <div className="bg-white p-3 rounded-2xl shadow-2xl">
                    <QRCodeSVG value={`${getAppBaseUrl()}/?sn=${equipment?.serialNumber}`} size={80} level="H" includeMargin={true} />
                 </div>
               </div>

               <div className="relative z-10 pt-6 mt-6 border-t border-white/10">
                 <div className="grid grid-cols-2 gap-6">
                    <div>
                        <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-2">
                            {isPressureTest ? 'Pressure Test Date' : isRecharge ? 'Date of Recharge' : 'Inspection Date'}
                        </p>
                        <p className="text-lg font-black text-white uppercase leading-none tracking-tight">{formatDate(record.date)}</p>
                    </div>
                    {isPressureTest && (
                        <div>
                            <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-2">Next Test Due</p>
                            <p className="text-lg font-black text-white uppercase leading-none tracking-tight">{formatDate(getNextPressureTestDate(record.date))}</p>
                        </div>
                    )}
                 </div>
               </div>
            </div>
          </div>

          {/* Expanded Checklist Section */}
          <div className="space-y-6 mb-8 relative z-10 flex-1 overflow-hidden">
             <div className="flex items-center gap-4 border-b-2 border-slate-900 pb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg ${isPressureTest ? 'bg-amber-600' : isRecharge ? 'bg-blue-600' : 'bg-red-600'}`}>
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.4em]">
                   {isPressureTest ? 'Pressure Integrity Analysis' : isRecharge ? 'Recharge Protocol Checklist' : 'Detailed Finding Matrix'}
                </h3>
             </div>

             <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {checklistItems.map((item) => {
                  const result = record.findings ? record.findings[item.id] : undefined;
                  return (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex-1 pr-4">
                        <span className="text-[10px] text-slate-900 font-black uppercase tracking-tight block leading-none mb-1">{item.label}</span>
                        <span className="text-[8px] text-slate-500 font-bold uppercase block leading-tight opacity-60 line-clamp-1">{item.description}</span>
                      </div>
                      <div className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${result === true ? 'text-emerald-700 bg-emerald-50 border-emerald-100' : result === false ? 'text-red-700 bg-red-50 border-red-100' : 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                         <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}>
                             {result === true 
                                ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                : <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                             }
                         </svg>
                         {result === true ? 'PASS' : result === false ? 'FAIL' : 'N/A'}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>

          {/* Technical Notes & Photos Row */}
          <div className="grid grid-cols-2 gap-10 mb-6 relative z-10">
             {record.notes && (
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-200 shadow-inner">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3 flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      Inspector Remarks
                   </h4>
                   <p className="text-[11px] font-bold text-slate-700 leading-relaxed italic border-l-4 border-red-600/30 pl-4">"{record.notes}"</p>
                </div>
             )}

             {photos.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] border-l-4 border-red-600 pl-4">Evidence Capture</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {photos.slice(0, 4).map((p, i) => (
                      <div 
                        key={i} 
                        className="w-full aspect-square rounded-3xl overflow-hidden border-4 border-slate-100 shadow-xl bg-slate-50 cursor-zoom-in hover:scale-105 transition-transform"
                        onClick={() => setSelectedImage(p.split('|')[0])}
                      >
                        <img src={getProxiedImageUrl(p.split('|')[0])} className="w-full h-full object-cover" alt={`Evidence ${i+1}`} referrerPolicy="no-referrer" />
                      </div>
                    ))}
                  </div>
                </div>
             )}
          </div>

          {/* Footer / Sign-off */}
          <div className="flex justify-between items-end gap-10 pt-8 border-t-4 border-slate-900 relative z-10 mt-auto">
            <div className="space-y-4 w-72">
              <div className="h-24 flex items-center justify-center border-b-4 border-slate-900 bg-slate-50 rounded-t-[2rem] relative overflow-hidden shadow-inner">
                {record.inspectorSignature ? (
                  <img src={getProxiedImageUrl(record.inspectorSignature)} className="max-h-full opacity-90 scale-110 mix-blend-multiply" alt="Tech Signature" referrerPolicy="no-referrer" />
                ) : (
                  <div className="text-[10px] font-black text-slate-300 uppercase italic">Digital Identity Authenticated</div>
                )}
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">{record.inspectorName}</p>
                <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.4em] mt-2">Authorised SANS Personnel</p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">PRECISION FIRE SERVICES</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.4em]">South African SANS Regulatory Node</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
};

export default SingleRecordReport;