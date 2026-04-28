import React, { useMemo, useEffect, useState, useRef } from 'react';
import { calculateSiteStats } from '../src/lib/scoring';
import { Client, Equipment, InspectionRecord, Technician, TaskType } from '../types';
import { SACAS_PERMIT_NUMBER, COMPANY_LOGO_URL, isSaqccCardValid } from '../constants';
import { getProxiedImageUrl } from '../services/registryService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface COCGeneratorProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  activeTech?: Technician | null;
  activeSubUser?: any | null;
  technicians?: Technician[];
  onBack: () => void;
  isPublic?: boolean;
  selectedYear?: number;
  branding?: any[];
  onlyCertificate?: boolean;
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

const COCLogo = ({ type, className, branding }: { type: 'company' | 'saqcc' | 'sacas' | 'manager', className?: string, branding?: any[] }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const keys = {
      company: 'pfs_custom_logo',
      saqcc: 'pfs_custom_saqcc',
      sacas: 'pfs_custom_sacas',
      manager: 'pfs_manager_signature'
    };
    
    let dist = localStorage.getItem(`pfs_dist_${type}`) || 'both';
    let stored = localStorage.getItem(keys[type]);
    let typed = type === 'manager' ? localStorage.getItem('pfs_manager_typed_name') : null;

    // Use branding from cloud if available
    if (branding) {
      const item = branding.find(b => b.id === keys[type]);
      if (item) {
        stored = item.content;
        dist = item.distribution || 'both';
      }
      if (type === 'manager') {
        const typedItem = branding.find(b => b.id === 'pfs_manager_typed_name');
        if (typedItem) typed = typedItem.content;
      }
    }
    
    const canShow = dist === 'coc' || dist === 'both';
    setTypedName(typed);

    if (canShow) {
      if (stored) {
        setSrc(getProxiedImageUrl(stored));
        setIsVisible(true);
      } else if (type === 'company') {
        setSrc(COMPANY_LOGO_URL);
        setIsVisible(true);
      } else if (typed) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    } else {
      setIsVisible(false);
    }
  }, [type, branding]);

  if (!isVisible) return null;
  
  if (type === 'manager' && !src && typedName) {
    return (
      <span className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">
        {typedName}
      </span>
    );
  }

  return (
    <img 
      src={src!} 
      className={`${className} object-contain`} 
      alt={`${type} logo`}
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
    />
  );
};

const CompanyFooter = () => (
  <div className="w-full pt-4 border-t flex justify-between items-end shrink-0">
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
      <p className="text-[8px] font-bold text-slate-500 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
      <p className="text-[8px] font-black text-red-600 uppercase tracking-widest">Office: 010 035 5246 • Emergency: 078 173 7245 • PROJECT_FINAL_V12.18</p>
    </div>
    <div className="text-right">
      <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Digital SANS Registry Node</p>
    </div>
  </div>
);

export const COCGenerator: React.FC<COCGeneratorProps> = ({ 
  client, equipment, records, activeTech, activeSubUser, technicians = [], onBack, selectedYear, branding = [], onlyCertificate = false
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const cocContainerRef = useRef<HTMLDivElement>(null);

  const latestRecord = useMemo(() => {
    if (records.length === 0) return null;
    return [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [records]);

  const finalizedDate = latestRecord?.date || new Date().toISOString();

  const siteTechnicians = useMemo(() => {
    // If the client has a technicianId, we only show that specific technician (locked to creator)
    if (client.technicianId) {
      const creator = technicians.find(t => t.id === client.technicianId);
      if (creator && creator.name !== 'Precision Management') return [creator];
      if (creator && creator.name === 'Precision Management') return [];
    }

    const techNames = Array.from(new Set(records.map(r => String(r.inspectorName)))) as string[];
    const found: any[] = [];
    technicians.forEach(t => {
      // Skip Precision Management from the Personnel Audit section
      if (t.name === 'Precision Management') return;

      const subMatch = t.subUsers?.find(s => techNames.some(name => name.includes(`(${s.name})`)));
      if (subMatch) {
        found.push({ ...t, name: `${t.name} (${subMatch.name})`, signature: subMatch.signature || t.signature, saqccCardPhoto: subMatch.saqccCardPhoto || t.saqccCardPhoto, saqccCards: subMatch.saqccCards || t.saqccCards });
      } else if (techNames.some(name => name.startsWith(t.name))) {
        found.push(t);
      }
    });

    // Only show activeTech if no creator and not management
    if (found.length === 0 && activeTech && activeTech.name !== 'Precision Management') {
      return [activeTech];
    }

    return found;
  }, [records, technicians, client.technicianId, activeTech]);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!cocContainerRef.current) return;
    setIsGeneratingPdf(true);
    await new Promise(r => setTimeout(r, 500));
    
    // Use a lower scale for mobile to prevent memory issues
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const scale = isMobile ? 1.5 : 2;
    
    const pdf = new jsPDF('p', 'mm', 'a4', true); // Use compression
    try {
      const pages = cocContainerRef.current.querySelectorAll('.report-page');
      
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i] as HTMLElement, { 
          scale: scale,
          useCORS: true, 
          backgroundColor: '#ffffff', 
          imageTimeout: 0,
          windowWidth: 1200,
          windowHeight: 1600
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG for smaller file size
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        
        // Small delay to keep UI responsive
        await new Promise(r => setTimeout(r, 50));
      }
      
      const fileName = `${client.name}_Maintenance_Certificate.pdf`;
      
      if (isMobile) {
        const blob = pdf.output('blob');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
      } else {
        pdf.save(fileName);
      }
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const filteredRecords = useMemo(() => {
    return records;
  }, [records]);

  const { defectiveAssets, defectiveAssetsChunks, equipmentTypeSummary, stats } = useMemo(() => {
    // Include archived assets if they were condemned/failed in the latest record
    const relevantEquipment = equipment.filter(e => {
      if (!e.isArchived) return true;
      const latest = filteredRecords.filter(r => (r.equipmentId || r.equipment_id) === e.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return latest?.status === 'Condemned' || latest?.status === 'Fail';
    });

    const siteStats = calculateSiteStats(equipment, filteredRecords);

    const defective: { asset: Equipment, record: InspectionRecord | null }[] = [];
    const typeCounts: Record<string, number> = {};
    let hasLowPressure = false;
    let hasPressureTestDue = false;
    
    relevantEquipment.forEach(item => {
      const latest = filteredRecords.filter(r => (r.equipmentId || r.equipment_id) === item.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const isPressureTestDue = latest?.pressureTestOption === 'later';
      const m = (item.manufacturer || '').toLowerCase();
      const mk = (item.make || '').toLowerCase();
      const isFlashFire = m.includes('flash fire') || m.includes('flashfire') || mk.includes('flash fire') || mk.includes('flashfire');
      const isFailed = latest && (latest.status === 'Fail' || latest.status === 'Condemned' || latest.status === 'Service Required');
      const hasVesselFailure = latest?.findings?.vessel_condition === false;

      if (latest?.status === 'Pass' && !isPressureTestDue && !isFlashFire && !hasVesselFailure) {
        typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
        if (latest.flow_pressure_kpa && parseFloat(latest.flow_pressure_kpa) < 100) {
          hasLowPressure = true;
        }
      } else {
        if (isPressureTestDue) hasPressureTestDue = true;
        defective.push({ asset: item, record: latest || null });
      }
    });
    
    // Site is compliant only if score is 100%, NO low pressure, NO pressure tests due, and NO defective items
    const isCompliant = siteStats.isCompliant && !hasLowPressure && !hasPressureTestDue && defective.length === 0;

    const chunks = [];
    for (let i = 0; i < defective.length; i += 12) {
      chunks.push(defective.slice(i, i + 12));
    }

    return { 
      defectiveAssets: defective, 
      defectiveAssetsChunks: chunks,
      equipmentTypeSummary: Object.entries(typeCounts),
      stats: {
        ...siteStats,
        hasLowPressure,
        hasPressureTestDue,
        isCompliant,
        equipmentTypeSummary: Object.entries(typeCounts)
      }
    };
  }, [equipment, filteredRecords]);

  const isPartial = defectiveAssets.length > 0;
  const sealColorClass = !stats.isCompliant ? 'text-red-600 border-red-600' : 'text-amber-600 border-amber-600';

  const latestClientRecord = useMemo(() => {
    const clientRecords = filteredRecords.filter(r => equipment.some(e => e.id === (r.equipmentId || r.equipment_id)));
    // Prefer Maintenance records for the certificate date
    const maintenanceRecords = clientRecords.filter(r => r.taskType === TaskType.MAINTENANCE || r.task_type === TaskType.MAINTENANCE);
    if (maintenanceRecords.length > 0) {
      return maintenanceRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    }
    // Fallback to any record if no maintenance record exists
    return clientRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [equipment, filteredRecords]);

  const maintenanceDate = latestClientRecord?.date || new Date().toISOString().split('T')[0];
  const nextMaintenanceDate = new Date(new Date(maintenanceDate).setFullYear(new Date(maintenanceDate).getFullYear() + 1)).toISOString().split('T')[0];
  const rectificationDueDate = new Date(new Date(maintenanceDate).setDate(new Date(maintenanceDate).getDate() + 30)).toISOString().split('T')[0];
  const cocNumber = `${isPartial ? 'P' : ''}CERT-${client.id.toUpperCase().slice(0, 4)}-${new Date(maintenanceDate).getFullYear()}${(new Date(maintenanceDate).getMonth() + 1).toString().padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-slate-100 font-sans p-0 md:p-8">
      <div className="no-print flex flex-col items-center justify-center p-6 space-y-6 max-w-4xl mx-auto">
        <div className="w-full bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200">
           <div className="p-8 text-white flex justify-between items-center bg-slate-900">
              <div className="flex items-center gap-4">
                <COCLogo type="company" className="w-12 h-12" branding={branding} />
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Maintenance Certification (COM)</h2>
              </div>
              <button onClick={onBack} className="bg-white/20 hover:bg-white/30 p-3 rounded-xl transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
           </div>
           <div className="p-10 text-center space-y-6">
              <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">{client.name}</h3>
              
              {!stats.isCompliant && (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl mb-4 text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h4 className="font-black text-amber-900 uppercase text-xs">Non-Compliance Detected</h4>
                  </div>
                  <p className="text-[10px] text-amber-800 font-bold uppercase leading-relaxed">
                    This site has failed units or low water pressure. A "Defective Equipment Registry" page will be automatically included in the certificate.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={handlePrint} className="w-full py-5 rounded-2xl font-black text-white shadow-xl bg-slate-900 hover:bg-black uppercase tracking-widest text-xs">Print Certificate</button>
                <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="w-full py-5 rounded-2xl font-black text-white shadow-xl bg-red-600 hover:bg-red-700 uppercase tracking-widest text-xs">
                  {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
                </button>
              </div>
           </div>
        </div>
      </div>
      <div className="print-coc-container" ref={cocContainerRef}>
        <div className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto relative overflow-hidden">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
               <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-28 flex items-center justify-center">
                      <COCLogo type="company" className="w-full h-full" branding={branding} />
                    </div>
                    <div className="text-left"><h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Precision Fire Services</h1><div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Official Fire Equipment Registry</div></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black text-slate-900 uppercase tracking-widest text-left">
                     <span>PTY (LTD)</span><span className="w-1 h-1 bg-slate-300 rounded-full" /><span>REG: 2014/139488/07</span><span className="w-1 h-1 bg-slate-300 rounded-full" /><span>SACAS PERMIT: {SACAS_PERMIT_NUMBER}</span>
                  </div>
               </div>
               <div className="flex flex-col items-end gap-3">
                 <div className="flex gap-4 items-center scale-90">
                   <COCLogo type="saqcc" className="w-[60px] h-[45px]" branding={branding} />
                   <COCLogo type="sacas" className="w-[60px] h-[45px]" branding={branding} />
                 </div>
                 <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Certificate Ref: {cocNumber}</p></div>
               </div>
            </div>

            <div className="flex-1 flex flex-col">
               <div className="text-center space-y-1 mb-4">
                  <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter leading-tight">
                    {!stats.isCompliant ? 'Partial Maintenance Certificate (COM)' : 'Fire Equipment Maintenance Certificate (COM)'}
                  </h2>
                  <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">SANS 1475 PART 1 & 2 REGULATORY MAINTENANCE RECORD</p>
               </div>

               <div className="space-y-4 text-center py-4 border-y border-slate-100 mb-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold italic uppercase tracking-widest leading-none">This document formally certifies the fire equipment maintenance at:</p>
                    <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">{client.name}</h3>
                    <p className="text-xs text-slate-600 font-bold uppercase tracking-wide leading-tight">{client.address}</p>
                  </div>
                  <div className="max-w-2xl mx-auto p-4 bg-slate-50 rounded-[1.5rem] border border-slate-200">
                    <p className="text-[11px] text-slate-800 font-black leading-relaxed uppercase tracking-tight text-center">
                      This certificate serves to confirm that the portable firefighting equipment (Extinguishers, Hose Reels and Hydrant Valves) at the above premises have been serviced and maintained in accordance with SANS 1475 Parts 1 & 2, SANS 10105-1 and the Occupational Health and Safety Act.
                    </p>
                  </div>
                  <div className="max-w-xl mx-auto mt-2 p-3 border-2 border-red-100 rounded-2xl bg-red-50/30">
                    <p className="text-[8px] text-red-700 font-black uppercase tracking-tight leading-normal">
                      NOTICE: This document certifies that maintenance has been performed on the specified equipment only. This certificate does NOT substitute for a Fire Clearance Certificate or any other statutory certification required for occupancy as issued by a Local Authority or Fire Department.
                    </p>
                  </div>

                  {/* Removed CRITICAL: LOW WATER PRESSURE DETECTED as per user request */}
               </div>

               <div className="grid grid-cols-12 gap-8 items-start flex-1 text-left">
                  <div className="col-span-8 space-y-4">
                     <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-1">Technical Audit Summary</h4>
                     <div className="space-y-1">
                        {(stats.equipmentTypeSummary as [string, number][]).map(([type, count]) => (
                          <div key={type} className="flex justify-between items-center py-0.5 border-b border-slate-50">
                             <span className="text-[10px] font-black text-slate-800 uppercase">{type}</span>
                             <span className="text-[9px] font-black text-slate-900 px-2 py-0.5 bg-slate-100 rounded">QTY: {count}</span>
                          </div>
                        ))}
                     </div>
                     <div className="bg-slate-50 p-4 rounded-2xl border grid grid-cols-2 gap-6 mt-4">
                        <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Maintenance Date</p><p className="text-xs font-black text-slate-900 uppercase">{formatDate(maintenanceDate)}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Next Service Due</p><p className="text-xs font-black text-red-600 uppercase">{formatDate(nextMaintenanceDate)}</p></div>
                     </div>
                  </div>
                  <div className="col-span-4 flex flex-col items-center justify-center pt-10">
                     <div className={`relative w-32 h-32 rounded-full border-4 bg-white flex flex-col items-center justify-center text-center shadow-md transform rotate-[-5deg] ${stats.percentage < 100 ? 'border-red-600' : 'border-amber-600'}`}>
                        <div className={`text-[8px] font-black uppercase mb-0.5 ${stats.percentage < 100 ? 'text-red-700' : 'text-amber-700'}`}>SANS 1475</div>
                        <div className={`text-[14px] font-black uppercase leading-none my-0.5 tracking-tighter ${stats.percentage < 100 ? 'text-red-800' : 'text-amber-800'}`}>
                          {stats.percentage < 100 ? 'NON-COMPLIANT' : 'COMPLIANT'}
                        </div>
                        {stats.percentage < 100 && (
                          <div className="text-[10px] font-black text-red-600 leading-none mb-1">SCORE: {stats.percentage}%</div>
                        )}
                        <div className={`text-[6px] font-bold uppercase opacity-50 ${stats.percentage < 100 ? 'text-red-700' : 'text-amber-700'}`}>REGISTRY SEAL</div>
                     </div>
                  </div>
               </div>

               {/* Technician Details on COM */}
               <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                  {(() => {
                    const tech = technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management') ||
                                 technicians.find(t => (t.name === records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.inspectorName) && t.name !== 'Precision Management') ||
                                 (activeTech?.name !== 'Precision Management' ? activeTech : null);
                    if (!tech) return null;

                    const inspectionDate = records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || new Date().toISOString();
                    const validCards = Object.entries(tech.saqccCards || {})
                      .filter(([year, card]) => isSaqccCardValid(inspectionDate, year))
                      .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA));
                    const cardToDisplay = validCards.length > 0 ? validCards[0][1] : tech.saqccCardPhoto;

                    return (
                      <>
                        <div className="text-left">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Authorised Technician</p>
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">{tech.name}</h4>
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mt-1">SAQCC Registration: {tech.saqcc}</p>
                          <div className="mt-2 h-12 flex items-center">
                            {tech.signature && <img src={tech.signature} className="max-h-full mix-blend-multiply opacity-90" alt="Signature" crossOrigin={tech.signature.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />}
                          </div>
                        </div>
                        {cardToDisplay && (
                          <div className="w-48 aspect-[1.58/1] rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-50">
                            <img src={getProxiedImageUrl(cardToDisplay)} className="w-full h-full object-contain" alt="SAQCC Card" crossOrigin={cardToDisplay.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </>
                    );
                  })()}
               </div>
            </div>
            <CompanyFooter />
          </div>

          {/* PAGE: DEFECTIVE ASSETS (Auto-included if non-compliant) */}
          {stats.percentage < 100 && defectiveAssetsChunks.map((chunk, pageIdx) => (
            <div key={`defective-page-${pageIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto relative overflow-hidden mt-8">
              <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
              <div className="flex justify-between items-start border-b-4 border-red-600 pb-6 mb-8">
                 <div className="flex items-center gap-4 text-left"><COCLogo type="company" className="w-12 h-12" branding={branding} /><div><h2 className="text-xl font-black uppercase tracking-tight text-left text-red-600">Defective Equipment Registry</h2><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-left">Non-Compliant Units & Remediation Requirements</p></div></div>
                 <div className="text-right">
                   <p className="text-[10px] font-black uppercase">REF-{client.id.toUpperCase().slice(0,4)}-DEFECTS</p>
                   <p className="text-[7px] font-bold text-slate-400 uppercase">Page {pageIdx + 1} of {defectiveAssetsChunks.length}</p>
                 </div>
              </div>
              
              <div className="flex-1 space-y-4 text-left overflow-hidden">
                {pageIdx === 0 && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex justify-between items-center">
                    <div className="max-w-[70%]">
                      <p className="text-[10px] font-black text-red-800 uppercase leading-tight">
                        The following units failed the technical audit and must be repaired or replaced to achieve full site compliance.
                      </p>
                      <p className="text-[8px] font-bold text-red-600 uppercase mt-2 italic">
                        * ALL DEFECTS LISTED BELOW MUST BE RECTIFIED WITHIN 30 DAYS OF THE INSPECTION DATE TO MAINTAIN REGULATORY COMPLIANCE.
                      </p>
                    </div>
                    <div className="text-right bg-white p-3 rounded-xl border-2 border-red-600 shadow-sm">
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Rectification Due By</p>
                      <p className="text-lg font-black text-red-600 leading-none">{formatDate(rectificationDueDate)}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {chunk.map(({ asset, record }, idx) => (
                    <div key={asset.id} className="p-3 border border-slate-100 rounded-xl bg-white shadow-sm flex gap-3 items-start">
                      <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                        <span className="text-white font-black text-xs">{ (pageIdx * 12) + idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-[10px] font-black text-slate-900 uppercase truncate">{asset.type} - {asset.serialNumber}</h4>
                            <p className="text-[7px] font-bold text-slate-400 uppercase">{asset.location}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase ${
                            (record?.status === 'Condemned' || (asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire')) ? 'bg-red-600 text-white' : 
                            record?.pressureTestOption === 'later' ? 'bg-amber-600 text-white' :
                            'bg-amber-50 text-white'
                          }`}>
                            {(asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire') ? 'CONDEMNED (ILLEGAL)' : (record?.pressureTestOption === 'later' ? 'Pressure Test Due' : (record?.status || 'Pending'))}
                          </span>
                        </div>
                        <div className="mt-1 p-1.5 bg-slate-50 rounded-lg">
                          <p className="text-[8px] font-black text-slate-600 uppercase tracking-tight">Failure Reason:</p>
                          <p className="text-[8px] font-medium text-slate-500 mt-0.5 italic">
                            {(() => {
                              if ((asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire')) return 'FLASH FIRE UNIT - Equipment is not SABS approved and must be condemned immediately.';
                              if (record?.pressureTestOption === 'later') return 'PRESSURE TEST DUE - Unit must be removed for hydrostatic testing.';
                              if (record?.status === 'Condemned') return 'UNIT CONDEMNED - Equipment is unsafe and must be replaced immediately.';
                              return record?.notes || 'Unit failed visual or technical inspection. Remediation required.';
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <CompanyFooter />
            </div>
          ))}

          {/* PAGE: PERSONNEL VERIFICATION & ACCREDITATION */}
          {!onlyCertificate && siteTechnicians.length > 0 && (
            <div className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto relative overflow-hidden mt-8">
              <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
              <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                 <div className="flex items-center gap-4 text-left"><COCLogo type="company" className="w-12 h-12" branding={branding} /><div><h2 className="text-xl font-black uppercase tracking-tight text-left">Technician Verification</h2><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-left">Technician Credentials</p></div></div>
                 <div className="text-right"><p className="text-[10px] font-black uppercase">DATA-NODE-{client.id.toUpperCase().slice(0,4)}</p></div>
              </div>
              <div className="flex-1 space-y-8 text-left">
                 <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-200">
                    <p className="text-xs font-black text-slate-800 uppercase leading-relaxed text-center italic">"All listed technicians are SAQCC registered and authorized under the Precision Fire Services SANS 1475 Permit."</p>
                 </div>
                 <div className="grid grid-cols-1 gap-12">
                    {siteTechnicians.map(tech => (
                       <div key={tech.id} className="flex gap-8 items-start border-b border-slate-100 pb-12 last:border-0 break-inside-avoid">
                          <div className="w-32 h-32 bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl border-4 border-white shrink-0">
                             <span className="text-4xl font-black text-white">{tech.name.charAt(0)}</span>
                          </div>
                          <div className="flex-1 space-y-6">
                             <div className="text-left">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{tech.name}</h3>
                                <p className="text-red-600 font-black uppercase tracking-[0.2em] text-[10px] mt-1">SAQCC Registration: {tech.saqcc}</p>
                             </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-slate-50 rounded-xl text-left">
                                   <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Authorization</p>
                                   <p className="text-[9px] font-black text-emerald-600 uppercase">VALID & ACTIVE</p>
                                </div>
                                <div className="p-3 bg-slate-50 rounded-xl text-left">
                                   <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Specimen Signature</p>
                                   <div className="h-16 flex items-center">{tech.signature && <img src={tech.signature} className="max-h-full mix-blend-multiply scale-110 origin-left" alt="Sign" />}</div>
                                </div>
                             </div>
                             <div className="space-y-2 text-left">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Accreditation Image</p>
                                <div className="aspect-[1.58/1] w-full bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-200 flex items-center justify-center shadow-inner relative">
                                   {(() => {
                                      const inspectionDate = records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || new Date().toISOString();
                                      const validCards = Object.entries(tech.saqccCards || {})
                                        .filter(([year, card]) => isSaqccCardValid(inspectionDate, year))
                                        .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA));
                                      const cardToDisplay = validCards.length > 0 ? validCards[0][1] : tech.saqccCardPhoto;
                                      return cardToDisplay ? (
                                         <img src={cardToDisplay} className="absolute inset-0 w-full h-full object-cover" crossOrigin={cardToDisplay.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" alt="SAQCC Card" />
                                      ) : (
                                         <div className="text-[7px] font-black text-slate-300 uppercase">Card Image Pending Upload</div>
                                      );
                                   })()}
                                </div>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
              <CompanyFooter />
            </div>
          )}

          {/* PAGE: TECHNICAL ASSET INVENTORY (Attached to COM) */}
          {!onlyCertificate && equipment.length > 0 && (
            <>
              {(() => {
                const itemsPerPage = 25;
                const chunks = [];
                const sortedEquipment = [...equipment].sort((a, b) => a.location.localeCompare(b.location));
                for (let i = 0; i < sortedEquipment.length; i += itemsPerPage) {
                  chunks.push(sortedEquipment.slice(i, i + itemsPerPage));
                }
                
                return chunks.map((chunk, chunkIdx) => (
                  <div key={`inventory-page-${chunkIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto relative overflow-hidden mt-8">
                    <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
                    <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                       <div className="flex items-center gap-4 text-left"><COCLogo type="company" className="w-12 h-12" branding={branding} /><div><h2 className="text-xl font-black uppercase tracking-tight text-left">Technical Asset Inventory</h2><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-left">Site Registry Page {chunkIdx + 1} of {chunks.length}</p></div></div>
                       <div className="text-right"><p className="text-[10px] font-black uppercase">{client.name}</p></div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white">
                            <th className="px-2 py-2 text-[7px] font-black uppercase tracking-widest border-r border-slate-800">Asset SN</th>
                            <th className="px-2 py-2 text-[7px] font-black uppercase tracking-widest border-r border-slate-800">Type / Size</th>
                            <th className="px-2 py-2 text-[7px] font-black uppercase tracking-widest border-r border-slate-800">Location</th>
                            <th className="px-2 py-2 text-[7px] font-black uppercase tracking-widest text-center border-r border-slate-800">Last Srv</th>
                            <th className="px-2 py-2 text-[7px] font-black uppercase tracking-widest text-center border-r border-slate-800">Next Srv</th>
                            <th className="px-2 py-2 text-[7px] font-black uppercase tracking-widest text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {chunk.map(item => {
                            const record = records.filter(r => (r.equipmentId || r.equipment_id) === item.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-2 py-1.5 text-[9px] font-black text-slate-900 uppercase tracking-tight border-r border-slate-50">{item.serialNumber}</td>
                                <td className="px-2 py-1.5 border-r border-slate-50">
                                  <p className="text-[8px] font-black text-slate-800 uppercase leading-none">{item.type}</p>
                                  <p className="text-[7px] font-bold text-slate-400 uppercase mt-0.5">{item.size || 'N/A'}</p>
                                </td>
                                <td className="px-2 py-1.5 text-[8px] font-medium text-slate-500 uppercase truncate max-w-[150px] border-r border-slate-50">{item.location}</td>
                                <td className="px-2 py-1.5 text-[8px] font-medium text-slate-500 text-center uppercase border-r border-slate-50">{formatDate(item.lastInspectionDate)}</td>
                                <td className="px-2 py-1.5 text-[8px] font-black text-slate-900 text-center uppercase border-r border-slate-50">{formatDate(item.nextServiceDate)}</td>
                                <td className="px-2 py-1.5 text-right">
                                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest ${record?.status === 'Pass' ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                                    {record?.status || 'Active'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <CompanyFooter />
                  </div>
                ));
              })()}
            </>
          )}
        </div>

      <style>{`
        .print-coc-container { width: 210mm; margin: 0 auto; box-shadow: 0 40px 100px rgba(0,0,0,0.1); background: white; }
        .report-page { page-break-after: always !important; break-after: page !important; }
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

export default COCGenerator;
