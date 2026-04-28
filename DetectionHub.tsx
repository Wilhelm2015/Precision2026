import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Client, Equipment, InspectionRecord, EquipmentType } from '../types';
import { SACAS_PERMIT_NUMBER, COMPANY_LOGO_URL } from '../constants';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface DetectionCOCGeneratorProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  onBack: () => void;
  activeTech?: any;
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

const COCLogo = ({ type, className }: { type: 'company' | 'saqcc' | 'sacas', className?: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const keys = { company: 'pfs_custom_logo', saqcc: 'pfs_custom_saqcc', sacas: 'pfs_custom_sacas' };
    const dist = localStorage.getItem(`pfs_dist_${type}`) || 'both';
    const canShow = dist === 'coc' || dist === 'both';
    const stored = localStorage.getItem(keys[type]);
    if (canShow) {
      if (stored) { setSrc(stored); setIsVisible(true); }
      else if (type === 'company') { setSrc(COMPANY_LOGO_URL); setIsVisible(true); }
      else { setIsVisible(false); }
    } else { setIsVisible(false); }
  }, [type]);

  if (!isVisible) return null;
  const isDataUrl = src?.startsWith('data:');
  return <img src={src!} className={`${className} object-contain`} alt={`${type} logo`} crossOrigin={isDataUrl ? undefined : "anonymous"} referrerPolicy="no-referrer" />;
};

export const DetectionCOCGenerator: React.FC<DetectionCOCGeneratorProps> = ({ client, equipment, records, onBack, activeTech }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const cocContainerRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!cocContainerRef.current) return;
    setIsGeneratingPdf(true);
    await new Promise(r => setTimeout(r, 500));
    const pdf = new jsPDF('p', 'mm', 'a4', false);
    const canvas = await html2canvas(cocContainerRef.current.querySelector('.a4-page') as HTMLElement, { 
      scale: 3, 
      useCORS: true, 
      allowTaint: true, 
      backgroundColor: '#ffffff', 
      imageTimeout: 0,
      windowWidth: 1200
    });
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    pdf.save(`${client.name}_Detection_Maintenance_Certificate.pdf`);
    setIsGeneratingPdf(false);
  };

  const { defectiveAssets, equipmentTypeSummary } = useMemo(() => {
    const defective: Equipment[] = [];
    const typeCounts: Record<string, number> = {};
    const detectionOnly = equipment.filter(e => 
      e.type === EquipmentType.SMOKE_DETECTOR || 
      e.type === EquipmentType.FIRE_DOOR
    );

    detectionOnly.forEach(item => {
      const latest = records.filter(r => r.equipmentId === item.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (latest?.status === 'Pass') typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
      else defective.push(item);
    });
    return { defectiveAssets: defective, equipmentTypeSummary: Object.entries(typeCounts) };
  }, [equipment, records]);

  const isPartial = defectiveAssets.length > 0;
  const sealColorClass = isPartial ? 'text-red-600 border-red-600' : 'text-amber-600 border-amber-600';
  const latestClientRecord = useMemo(() => records.filter(r => equipment.some(e => e.id === r.equipmentId)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0], [equipment, records]);
  const maintenanceDate = latestClientRecord?.date || new Date().toISOString().split('T')[0];
  const nextMaintenanceDate = new Date(new Date(maintenanceDate).setFullYear(new Date(maintenanceDate).getFullYear() + 1)).toISOString().split('T')[0];
  const cocNumber = `D-CERT-${client.id.toUpperCase().slice(0, 4)}-${new Date(maintenanceDate).getFullYear()}`;

  return (
    <div className="min-h-screen bg-slate-100 font-sans p-0 md:p-8">
      <div className="no-print flex flex-col items-center justify-center p-6 space-y-6 max-w-4xl mx-auto">
        <div className="w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200">
           <div className="p-8 text-white flex justify-between items-center bg-slate-900">
              <div className="flex items-center gap-4">
                <COCLogo type="company" className="w-12 h-12" />
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Detection Maintenance Certification (COM)</h2>
              </div>
              <button onClick={onBack} className="bg-white/20 hover:bg-white/30 p-3 rounded-xl transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
           </div>
           <div className="p-10 text-center space-y-6">
              <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">{client.name}</h3>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">SANS 10139 ELECTRONIC SYSTEM CERTIFICATION</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={handlePrint} className="w-full py-5 rounded-2xl font-black text-white shadow-xl bg-slate-900 hover:bg-black uppercase tracking-widest text-xs">Print Maintenance Certificate (COM)</button>
                <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="w-full py-5 rounded-2xl font-black text-white shadow-xl bg-red-600 hover:bg-red-700 uppercase tracking-widest text-xs">
                  {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
           </div>
        </div>
      </div>

      <div className="print-coc-container" ref={cocContainerRef}>
        <div className="a4-page bg-white relative flex flex-col border border-slate-200 m-0">
          <div className="px-12 py-10 flex-1 flex flex-col overflow-hidden">
            <div className="flex justify-between items-start border-b border-slate-900 pb-6 mb-6">
               <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <COCLogo type="company" className="w-14 h-14" />
                    <div><h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Precision Fire Services</h1><div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Safety Compliance Node</div></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black text-slate-900 uppercase tracking-widest">
                     <span>PTY (LTD)</span><span className="w-1 h-1 bg-slate-300 rounded-full" /><span>REG: 2014/139488/07</span><span className="w-1 h-1 bg-slate-300 rounded-full" /><span>SACAS PERMIT: {SACAS_PERMIT_NUMBER}</span>
                  </div>
               </div>
               <div className="flex flex-col items-end gap-3">
                 <div className="flex gap-4 items-center scale-90">
                   <COCLogo type="saqcc" className="w-[60px] h-[45px]" />
                   <COCLogo type="sacas" className="w-[60px] h-[45px]" />
                 </div>
                 <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Detection Cert Ref: {cocNumber}</p></div>
               </div>
            </div>

            <div className="flex-1 flex flex-col">
               <div className="text-center space-y-1 mb-6">
                  <h2 className="text-4xl font-black text-amber-600 uppercase tracking-tighter leading-tight">Fire Detection Maintenance Certificate</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">SANS 10139 & SANS 10400-T ELECTRONIC CLEARANCE</p>
               </div>

               <div className="space-y-6 text-center py-6 border-y border-slate-100 mb-6">
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold italic uppercase tracking-widest leading-none">This document formally certifies the fire detection system maintenance at:</p>
                    <h3 className="text-3xl font-black text-slate-900 uppercase leading-tight">{client.name}</h3>
                    <p className="text-sm text-slate-600 font-bold uppercase tracking-wide leading-tight">{client.address}</p>
                  </div>

                  <div className="max-w-2xl mx-auto p-6 bg-slate-50 rounded-[1.5rem] border border-slate-200">
                    <p className="text-[12px] text-slate-800 font-black leading-relaxed uppercase tracking-tight text-center">
                      This certificate confirms that the fire detection, smoke sensing, and passive fire door systems have been functionally tested and maintained in accordance with SANS 10139 and SANS 10400-T (Section T4.43).
                    </p>
                  </div>

                  <div className="max-w-xl mx-auto mt-4 p-4 border-2 border-amber-100 rounded-2xl bg-amber-50/30">
                    <p className="text-[9px] text-amber-900 font-black uppercase tracking-tight leading-normal">
                      NOTICE: This document certifies system maintenance and testing only. This certificate does NOT substitute for a Fire Clearance Certificate or Occupancy Certificate issued by the Local Authority or Fire Department.
                    </p>
                  </div>
               </div>

               <div className="grid grid-cols-12 gap-10 items-start flex-1">
                  <div className="col-span-7 space-y-6">
                     <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-1.5">Electronic System Audit</h4>
                     <div className="space-y-2">
                        {equipmentTypeSummary.length > 0 ? equipmentTypeSummary.map(([type, count]) => (
                          <div key={type} className="flex justify-between items-center py-1 border-b border-slate-50">
                             <span className="text-xs font-black text-slate-800 uppercase">{type}</span>
                             <span className="text-[10px] font-black text-slate-900 px-3 py-0.5 bg-slate-100 rounded">QTY: {count}</span>
                          </div>
                        )) : <p className="text-xs italic text-slate-400">No detection assets audited in this cycle.</p>}
                     </div>
                     
                     <div className="bg-slate-50 p-6 rounded-3xl border grid grid-cols-2 gap-8 mt-6">
                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Test Date</p><p className="text-sm font-black text-slate-900 uppercase">{formatDate(maintenanceDate)}</p></div>
                        <div><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Renewal Due</p><p className="text-sm font-black text-red-600 uppercase">{formatDate(nextMaintenanceDate)}</p></div>
                     </div>

                     <div className="pt-6 space-y-4">
                        <div className="flex items-center gap-6 bg-slate-50 p-6 rounded-3xl border shadow-sm">
                          <div className="w-36 h-18 border-b-2 bg-white rounded-t-xl overflow-hidden flex items-center justify-center">
                            {latestClientRecord?.inspectorSignature && <img src={latestClientRecord.inspectorSignature} className="max-h-full mix-blend-multiply scale-110" alt="Sign" />}
                          </div>
                          <div className="flex-1">
                            <p className="text-lg font-black text-slate-900 uppercase leading-none">{activeTech?.name || latestClientRecord?.inspectorName || 'Authorised System Tech'}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">SANS ACCREDITED PERSONNEL</p>
                          </div>
                        </div>
                     </div>
                  </div>

                  <div className="col-span-5 flex flex-col items-center justify-center space-y-12">
                     <div className={`relative w-40 h-40 rounded-full border-4 bg-white flex flex-col items-center justify-center text-center shadow-md transform rotate-[5deg] ${sealColorClass}`}>
                        <div className="text-[9px] font-black uppercase mb-0.5">SANS 10139</div>
                        <div className="text-[16px] font-black uppercase leading-none my-0.5 tracking-tighter">{isPartial ? 'PARTIAL' : 'OPERATIONAL'}</div>
                        <div className="text-[7px] font-bold uppercase opacity-50">MAINTAINED</div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-8 pt-6 border-t flex justify-between items-end shrink-0">
               <div className="space-y-1">
                  <p className="text-sm font-black text-slate-900 uppercase leading-none">Precision Fire Services</p>
                  <p className="text-[8px] font-bold text-slate-500 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">SANS 1475 & SANS 10139 Integrated Registry</p>
               </div>
               <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Digital SANS Node v2.5</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .print-coc-container { width: 210mm; margin: 0 auto; box-shadow: 0 40px 100px rgba(0,0,0,0.1); background: white; }
        .a4-page { width: 210mm; height: 297mm; background: white; overflow: hidden; display: flex; flex-direction: column; }
        @media print {
          body, html { background: white !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; overflow: hidden !important; height: 297mm !important; }
          .no-print { display: none !important; }
          .print-coc-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 210mm !important; height: 297mm !important; margin: 0 !important; box-shadow: none !important; display: block !important; }
          @page { size: A4 portrait; margin: 0; }
          body * { visibility: hidden; }
          .print-coc-container, .print-coc-container * { visibility: visible; }
        }
      `}</style>
    </div>
  );
};

export default DetectionCOCGenerator;