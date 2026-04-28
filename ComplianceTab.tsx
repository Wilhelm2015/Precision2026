import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Client, Equipment, InspectionRecord, TaskType, Technician, FaultReport, EquipmentType, ChecklistItem } from '../types';
import { SACAS_PERMIT_NUMBER, COMPANY_LOGO_URL, EQUIPMENT_DEFINITIONS } from '../constants';
import { getProxiedImageUrl } from '../services/registryService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ComprehensiveHydrostaticReportProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  technicians: Technician[];
  activeTech?: Technician | null;
  onBack: () => void;
  selectedYear?: number;
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr || dateStr === 'N/A') return '---';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return dateStr || '---';
  }
};

const CLAUSE_MAPPING: Record<string, string> = {
  vessel_condition: 'SANS 1475-1 Clause 4.1.1',
  internal_inspect: 'SANS 1475-1 Clause 5.1',
  valve_overhaul: 'SANS 1475-1 Clause 5.2',
  pressure_gauge: 'SANS 1475-1 Clause 5.3',
  safety_pin: 'SANS 1475-1 Clause 5.6',
  hose_nozzle: 'SANS 1475-1 Clause 5.5',
  mass_check: 'SANS 1475-1 Clause 5.4.1',
  operating_label: 'SANS 1475-1 Clause 5.7',
  service_label: 'SANS 1475-1 Clause 6',
  hr_mounting: 'SANS 1475-2 Clause 4.1',
  hr_rotation: 'SANS 1475-2 Clause 4.2',
  hr_hose: 'SANS 1475-2 Clause 5.2.2',
  hr_nozzle: 'SANS 1475-2 Clause 5.3',
  hr_gland: 'SANS 1475-2 Clause 5.4',
  hr_isolating: 'SANS 1475-2 Clause 5.5',
  hr_signage: 'SANS 1186-1',
  hy_wheel: 'SANS 1475-2 Clause 6.1',
  hy_washer: 'SANS 1475-2 Clause 6.2',
  hy_threads: 'SANS 1475-2 Clause 6.3',
  hy_cap: 'SANS 1475-2 Clause 6.4',
  hy_packing: 'SANS 1475-2 Clause 6.1.3',
  bc_accessibility: 'SANS 1475-2 Clause 7.1',
  bc_couplings: 'SANS 1475-2 Clause 7.2',
  bc_caps: 'SANS 1475-2 Clause 7.3',
  bc_non_return: 'SANS 1475-2 Clause 7.2.1',
  bc_drain: 'SANS 1475-2 Clause 7.4',
  bc_signage: 'SANS 1186-1',
  unapproved_brand: 'SANS 1475-1 / SABS PERMIT',
  wall_thinning: 'SANS 1475-1 Clause 4.2',
  dent_limit: 'SANS 1475-1 Clause 4.3'
};

const ReportLogo = ({ type, className }: { type: 'company' | 'saqcc' | 'sacas', className?: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const keys = { company: 'pfs_custom_logo', saqcc: 'pfs_custom_saqcc', sacas: 'pfs_custom_sacas' };
    const dist = localStorage.getItem(`pfs_dist_${type}`) || 'both';
    const stored = localStorage.getItem(keys[type]);
    
    if (stored) {
      setSrc(getProxiedImageUrl(stored));
      setIsVisible(true);
    } else if (type === 'company') {
      setSrc(COMPANY_LOGO_URL);
      setIsVisible(true);
    }
  }, [type]);

  if (!isVisible) return null;
  return <img src={src!} className={`${className} object-contain`} alt={`${type} logo`} crossOrigin="anonymous" referrerPolicy="no-referrer" />;
};

const CompanyFooter = () => (
  <div className="w-full pt-2 border-t flex justify-between items-end shrink-0">
    <div className="space-y-0.5 text-left">
      <p className="text-[9px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
      <p className="text-[7px] font-bold text-slate-500 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
      <p className="text-[7px] font-black text-red-600 uppercase tracking-widest">Office: 010 035 5246 • Emergency: 078 173 7245</p>
    </div>
    <div className="text-right">
      <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">Digital SANS Registry Node</p>
    </div>
  </div>
);

const ComprehensiveHydrostaticReport: React.FC<ComprehensiveHydrostaticReportProps> = ({ 
  client, equipment, records, faults, technicians, activeTech, onBack, selectedYear
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [precompiledPdf, setPrecompiledPdf] = useState<jsPDF | null>(null);
  const [isPrecompiling, setIsPrecompiling] = useState(false);
  const [zoom, setZoom] = useState(1);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  const activeAssets = useMemo(() => {
    const typeOrder: Record<string, number> = {
      [EquipmentType.EXTINGUISHER]: 1,
      [EquipmentType.CO2_EXTINGUISHER]: 1,
      [EquipmentType.HOSE_REEL]: 2,
      [EquipmentType.HYDRANT]: 3,
      [EquipmentType.BOOSTER_CONNECTION]: 4,
      [EquipmentType.FIRE_BLANKET]: 5
    };

    return [...equipment]
      .filter(e => !e.isArchived)
      .sort((a, b) => {
        const orderA = typeOrder[a.type] || 99;
        const orderB = typeOrder[b.type] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.location || '').localeCompare(String(b.location || ''));
      });
  }, [equipment]);

  const filteredRecords = useMemo(() => {
    if (!selectedYear) return records;
    return records.filter(r => {
      const date = r.date || r.created_at || '';
      if (!date) return false;
      return new Date(date).getFullYear() === selectedYear;
    });
  }, [records, selectedYear]);

  const reportData = useMemo(() => {
    return activeAssets.map(asset => {
      const allAssetRecords = filteredRecords
        .filter(r => r.equipmentId === asset.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const latestPT = allAssetRecords.find(r => r.taskType === TaskType.PRESSURE_TEST);
      const latestMain = allAssetRecords.find(r => r.taskType === TaskType.MAINTENANCE || r.taskType === TaskType.INSPECTION);

      return {
        asset,
        latestPT,
        latestMain,
        status: allAssetRecords[0]?.status || 'Pending'
      };
    });
  }, [activeAssets, records]);

  const finalizedDate = useMemo(() => {
    if (filteredRecords.length === 0) return new Date().toISOString();
    const sorted = [...filteredRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [filteredRecords]);

  const reportChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < reportData.length; i += 35) {
      chunks.push(reportData.slice(i, i + 35));
    }
    return chunks;
  }, [reportData]);

  const failedItems = useMemo(() => {
    const itemsFromRecords = activeAssets.map(asset => {
      const record = records.filter(r => r.equipmentId === asset.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (!record) return null;
      
      const isCO2 = asset.size?.toLowerCase().includes('co2');
      const definition = isCO2 
        ? (EQUIPMENT_DEFINITIONS.find(d => d.type === EquipmentType.CO2_EXTINGUISHER) || EQUIPMENT_DEFINITIONS.find(d => d.type === asset.type))
        : EQUIPMENT_DEFINITIONS.find(d => d.type === asset.type);
      const checklistItems = definition?.checklists[record.taskType] || [];
      
      const failedChecks = Object.entries(record.findings || {})
        .filter(([_, val]) => val === false)
        .map(([id]) => checklistItems.find(item => item.id === id))
        .filter((item): item is ChecklistItem => !!item);

      if (record.status !== 'Pass' || failedChecks.length > 0) {
        return { asset, record, failedChecks, source: 'record' as const };
      }
      return null;
    }).filter(Boolean);

    const itemsFromFaults = faults
      .filter(f => f.status === 'Open')
      .map(f => {
        const asset = equipment.find(e => e.id === f.equipmentId);
        if (!asset) return null;
        return { 
          asset, 
          record: { status: 'Fail', notes: f.description, date: f.timestamp } as any, 
          failedChecks: [{ id: 'fault', label: f.description }],
          source: 'fault' as const
        };
      })
      .filter(Boolean);

    // Merge and deduplicate by asset ID (preferring record if both exist)
    const merged: { asset: Equipment, record: InspectionRecord, failedChecks: { id: string, label: string }[], source: 'record' | 'fault' }[] = [...itemsFromRecords] as any;
    itemsFromFaults.forEach(fItem => {
      if (fItem && !merged.some(m => m.asset.id === fItem.asset.id)) {
        merged.push(fItem as any);
      }
    });

    return merged;
  }, [activeAssets, records, faults, equipment]);

  const failedItemsLetterChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < failedItems.length; i += 8) {
      chunks.push(failedItems.slice(i, i + 8));
    }
    return chunks;
  }, [failedItems]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!precompiledPdf && !isPrecompiling && reportContainerRef.current) {
        compileInBackground();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [reportData]);

  const compileInBackground = async () => {
    if (!reportContainerRef.current) return;
    setIsPrecompiling(true);
    const originalTransform = reportContainerRef.current.style.transform;
    reportContainerRef.current.style.transform = 'none';
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4', false);
      const pages = reportContainerRef.current.querySelectorAll('.report-page');
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        page.classList.add('generating-pdf');
        
        if (i > 0) pdf.addPage();
        
        await pdf.html(page, {
            x: 0,
            y: 0,
            width: 210,
            windowWidth: 1200,
            margin: 0
        });
        
        page.classList.remove('generating-pdf');
        await new Promise(r => setTimeout(r, 100));
      }
      setPrecompiledPdf(pdf);
    } catch (err) {
      console.error("Background sync failed", err);
    } finally {
      if (reportContainerRef.current) {
        reportContainerRef.current.style.transform = originalTransform;
      }
      setIsPrecompiling(false);
    }
  };

  const handleDownload = async () => {
    if (precompiledPdf) {
      precompiledPdf.save(`${client.name}_Hydrostatic_Validation_Summary.pdf`);
      return;
    }
    if (!reportContainerRef.current) return;
    setIsGenerating(true);
    // Temporarily reset zoom for clean capture
    const originalTransform = reportContainerRef.current.style.transform;
    reportContainerRef.current.style.transform = 'none';
    
    // Use a lower scale for mobile to prevent memory issues
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const scale = isMobile ? 1.5 : 2;
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4', true); // Use compression
      const pages = reportContainerRef.current.querySelectorAll('.report-page');
      
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i] as HTMLElement, {
          scale: scale,
          useCORS: true,
          backgroundColor: '#ffffff',
          imageTimeout: 0,
          logging: false,
          windowWidth: 1200
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.8); // Use JPEG for smaller file size
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        
        // Small delay to keep UI responsive
        await new Promise(r => setTimeout(r, 50));
      }
      
      const fileName = `${client.name}_Hydrostatic_Validation_Summary.pdf`;
      
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
      console.error("PDF Error:", err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`);
    } finally {
      if (reportContainerRef.current) {
        reportContainerRef.current.style.transform = originalTransform;
      }
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 flex flex-col items-center">
      <div className="no-print w-full max-w-4xl bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 flex justify-between items-center">
        <button onClick={onBack} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Back
        </button>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border mr-4">
            <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
            </button>
            <span className="text-[10px] font-black text-slate-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <button onClick={handleDownload} disabled={isGenerating} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">
            {isGenerating ? 'Syncing Layout...' : precompiledPdf ? 'Download PDF Report' : isPrecompiling ? 'Preparing Background...' : 'Export PDF Report'}
          </button>
          <button onClick={() => window.print()} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Print</button>
        </div>
      </div>

      <div ref={reportContainerRef} className="w-full max-w-[210mm] space-y-8 py-4 origin-top transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
        {reportChunks.map((chunk, chunkIdx) => (
          <div key={chunkIdx} className="report-page bg-white w-[210mm] h-[297mm] p-4 shadow-2xl border border-slate-200 print:shadow-none print:border-none flex flex-col relative overflow-hidden mx-auto">
            {/* Regulatory Watermark - OVERLAY V12.19 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] pointer-events-none select-none z-[110] opacity-30">
              <span className="text-[120px] font-black uppercase text-slate-900/60 tracking-[0.2em]">VALIDATED</span>
            </div>
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-1 mb-1 flex justify-between items-end">
              <div className="flex items-center gap-3">
                <img src={COMPANY_LOGO_URL} className="w-10 h-10 object-contain" alt="Logo" referrerPolicy="no-referrer" />
                <div className="text-left">
                  <h1 className="text-lg font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                  <p className="text-[7px] font-black text-red-600 uppercase tracking-[0.3em] mt-0.5">Hydrostatic Validation & Technical Registry</p>
                  <p className="text-[5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Permit: {SACAS_PERMIT_NUMBER} • SANS 1475 Compliance</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-base font-black uppercase tracking-tighter leading-none mb-0.5">{client.name}</h2>
                <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{client.address}</p>
                <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                  Technician: {(() => {
                    if (activeTech?.name && activeTech.name !== 'Precision Management') return activeTech.name;
                    const creatorTech = technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management');
                    if (creatorTech) return creatorTech.name;
                    const latestRecord = records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const inspector = technicians.find(t => (t.name === latestRecord?.inspectorName || t.saqcc === latestRecord?.inspectorName) && t.name !== 'Precision Management');
                    if (inspector) return inspector.name;
                    return 'System';
                  })()} | {new Date(finalizedDate).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
                <p className="text-[5px] font-black text-slate-900 uppercase mt-0.5">Registry Date: {new Date(finalizedDate).toLocaleDateString('en-ZA')} • Page {chunkIdx + 1} of {reportChunks.length}</p>
              </div>
            </div>

            {/* Summary Stats - Only on first page */}
            {chunkIdx === 0 && (
              <div className="grid grid-cols-4 gap-2 mb-1">
                <div className="bg-slate-900 text-white p-1 rounded-lg text-center">
                  <p className="text-[5px] font-black uppercase opacity-60">Total Assets</p>
                  <p className="text-sm font-black leading-none">{activeAssets.length}</p>
                </div>
                <div className="bg-amber-500 text-white p-1 rounded-lg text-center">
                  <p className="text-[5px] font-black uppercase opacity-60">Hydro Validated</p>
                  <p className="text-sm font-black leading-none">{reportData.filter(d => d.latestPT).length}</p>
                </div>
                <div className="bg-emerald-600 text-white p-1 rounded-lg text-center">
                  <p className="text-[5px] font-black uppercase opacity-60">Service Compliant</p>
                  <p className="text-sm font-black leading-none">{reportData.filter(d => d.status === 'Pass').length}</p>
                </div>
                <div className="bg-slate-100 text-slate-900 p-1 rounded-lg text-center border border-slate-200">
                  <p className="text-[5px] font-black uppercase opacity-60 text-slate-400">Registry Score</p>
                  <p className="text-sm font-black leading-none">
                    {(() => {
                      if (activeAssets.length === 0) return '0%';
                      
                      const flashFireAssets = activeAssets.filter(e => (e.manufacturer || '').toLowerCase().includes('flash fire'));
                      const flashFireDeduction = flashFireAssets.length * 5;
                      
                      const failedChecksCount = failedItems
                        .filter(item => !(item.asset.manufacturer || '').toLowerCase().includes('flash fire'))
                        .reduce((acc, item) => acc + item.failedChecks.length, 0);
                      
                      const otherDeduction = failedChecksCount * 2;
                      
                      const finalScore = Math.max(0, 100 - flashFireDeduction - otherDeduction);
                      return `${finalScore}%`;
                    })()}
                  </p>
                </div>
                {/* Removed Regulatory Alert: Low Water Flow Detected as per user request */}
              </div>
            )}

            {/* Main Table - High Density */}
            <div className="flex-1 overflow-hidden">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="w-[10%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest border-r border-slate-800">Asset SN</th>
                      <th className="w-[10%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest border-r border-slate-800">Seal</th>
                      <th className="w-[15%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest border-r border-slate-800">Class / Type</th>
                      <th className="w-[15%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest border-r border-slate-800">Location</th>
                      <th className="w-[8%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest text-center border-r border-slate-800">Last Hyd</th>
                      <th className="w-[8%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest text-center border-r border-slate-800">Next Hyd</th>
                      <th className="w-[6%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest text-center border-r border-slate-800">kPa</th>
                      <th className="w-[7%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest text-center border-r border-slate-800">Flow</th>
                      <th className="w-[7%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest text-center border-r border-slate-800">Press</th>
                      <th className="w-[8%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest text-center border-r border-slate-800">Last Mnt</th>
                      <th className="w-[6%] px-1 py-0.5 text-[5px] font-black uppercase tracking-widest text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chunk.map(({ asset, latestPT, latestMain, status }, idx) => (
                    <tr key={asset.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                      <td className="px-1 py-0 text-[6px] font-black text-slate-900 uppercase tracking-tight border-r border-slate-100 truncate">{asset.serialNumber}</td>
                      <td className="px-1 py-0 text-[5px] font-bold text-slate-600 uppercase border-r border-slate-100 truncate">
                        {(() => {
                          const assetRecords = records.filter(r => r.equipmentId === asset.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                          const latestWithSeal = assetRecords.find(r => r.sealSerialNumber && r.sealSerialNumber !== '---');
                          return latestWithSeal?.sealSerialNumber || assetRecords[0]?.sealSerialNumber || asset.sealSerialNumber || '---';
                        })()}
                      </td>
                      <td className="px-1 py-0 border-r border-slate-100 truncate">
                        <span className="text-[5px] font-black text-slate-800 uppercase leading-none block truncate">{asset.type}</span>
                        <span className="text-[4px] font-bold text-slate-400 uppercase block truncate">{asset.size || 'N/A'}</span>
                      </td>
                      <td className="px-1 py-0 text-[5px] font-bold text-slate-500 uppercase truncate border-r border-slate-100">{asset.location}</td>
                      <td className="px-1 py-0 text-[5px] font-black text-slate-800 text-center border-r border-slate-100">
                        {asset.pressureTestDateUnknown ? 'UNK' : formatDate(asset.lastPressureTestDate)}
                      </td>
                      <td className="px-1 py-0 text-[5px] font-black text-amber-600 text-center border-r border-slate-100">
                        {asset.pressureTestDateUnknown ? 'UNK' : formatDate(asset.nextPressureTestDate)}
                      </td>
                      <td className="px-1 py-0 text-[5px] font-black text-slate-50 text-center border-r border-slate-100 bg-slate-900/5">
                        {latestPT?.testedToKpa || latestPT?.tested_to_kpa || latestPT?.pressure_kpa || '---'}
                      </td>
                      <td className="px-1 py-0 text-[5px] font-black text-center border-r border-slate-100 text-blue-600">
                        {latestMain?.calculatedFlowLpm || latestMain?.calculated_flow_lpm || latestMain?.flow_lpm || '---'}
                      </td>
                      <td className="px-1 py-0 text-[5px] font-black text-center border-r border-slate-100 text-blue-600">
                        {latestMain?.flow_pressure_kpa || latestMain?.pressure_kpa || '---'}
                      </td>
                      <td className="px-1 py-0 text-[5px] font-black text-slate-800 text-center border-r border-slate-100">
                        {formatDate(asset.lastInspectionDate)}
                      </td>
                      <td className="px-1 py-0 text-right">
                        <span className={`text-[4px] font-black px-1 py-0 rounded uppercase tracking-widest ${
                          status === 'Pass' ? 'text-emerald-700' : 
                          status === 'Condemned' ? 'text-red-700' :
                          'text-amber-700'
                        }`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activeAssets.length === 0 && (
                <div className="py-20 text-center text-[8px] font-black text-slate-300 uppercase tracking-widest">No assets registered</div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
                <p className="text-[6px] font-bold text-slate-500 uppercase tracking-widest">SANS 1475 Regulatory Maintenance Provider • SACAS Permit: {SACAS_PERMIT_NUMBER}</p>
                <p className="text-[6px] font-black text-red-600 uppercase tracking-widest mt-1">Digital Registry Node • Comprehensive Site Audit Log</p>
              </div>
              <div className="text-right space-y-2">
                <div className="flex flex-col items-end">
                  <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-1">Authorised Signature</p>
                  <div className="h-8 w-32 border-b border-slate-900 relative">
                    {activeTech?.signature && (
                      <img src={activeTech.signature} className="max-h-full opacity-80 mix-blend-multiply absolute right-0 bottom-0" alt="Signature" />
                    )}
                  </div>
                  <p className="text-[7px] font-black text-slate-900 uppercase mt-1">{(activeTech?.name && activeTech.name !== 'Precision Management') ? activeTech.name : 'Authorised Personnel'}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* REGULATORY FAULT NOTIFICATION LETTER (Paginated) */}
        {failedItemsLetterChunks.map((chunk, pageIdx) => (
          <div key={`fault-letter-${pageIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto mt-8">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-8">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <ReportLogo type="company" className="w-14 h-14" />
                  <div className="text-left">
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Precision Fire Services</h1>
                    <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Official Fire Equipment Registry</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black text-slate-900 uppercase tracking-widest text-left">
                  <span>PTY (LTD)</span><span className="w-1 h-1 bg-slate-300 rounded-full" /><span>REG: 2014/139488/07</span><span className="w-1 h-1 bg-slate-300 rounded-full" /><span>SACAS PERMIT: {SACAS_PERMIT_NUMBER}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="bg-red-600 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest mb-2">Regulatory Notification</div>
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Ref: GEN/{new Date().getFullYear()}/RF-{pageIdx + 1}</p>
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Technician: {(() => {
                    if (activeTech?.name && activeTech.name !== 'Precision Management') return activeTech.name;
                    const creatorTech = technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management');
                    if (creatorTech) return creatorTech.name;
                    const latestRecord = records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const inspector = technicians.find(t => (t.name === latestRecord?.inspectorName || t.saqcc === latestRecord?.inspectorName) && t.name !== 'Precision Management');
                    if (inspector) return inspector.name;
                    return 'System';
                  })()} | {new Date(finalizedDate).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>

            <div className="flex-1 space-y-6 text-slate-800 text-[11px] leading-relaxed text-left">
              {pageIdx === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-8 mb-8">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Attention:</p>
                      <p className="font-black text-slate-900 uppercase">{client.name}</p>
                      <p className="font-bold text-slate-600 uppercase">{client.address}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Date of Issue:</p>
                      <p className="font-black text-slate-900 uppercase">{new Date(finalizedDate).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-red-600 pl-6 py-2">
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">Subject: OFFICIAL NOTIFICATION OF TECHNICAL NON-CONFORMANCE & REGULATORY FAULTS</h2>
                    <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest">URGENT ACTION REQUIRED - SANS 1475 COMPLIANCE ALERT</p>
                  </div>

                  <p>Dear Valued Client,</p>
                  
                  <p>During our recent technical audit and maintenance cycle conducted at your premises, our SANS 1475 qualified technicians identified specific fire protection assets that failed to meet the mandatory safety standards and regulatory requirements. These items have been classified as <strong>NON-COMPLIANT</strong> and pose a significant risk to life and property safety.</p>
                </>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden my-6">
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="bg-slate-900 text-white uppercase tracking-widest">
                      <th className="p-3 text-left">Asset / Serial</th>
                      <th className="p-3 text-left">Identified Fault / Non-Conformance</th>
                      <th className="p-3 text-left">Regulatory Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {chunk.map((item, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-red-50/30 transition-colors">
                          <td className="p-3">
                            <p className="font-black text-slate-900 uppercase">{item.asset.type}</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase">{item.asset.serialNumber}</p>
                          </td>
                          <td className="p-3">
                            <ul className="list-disc list-inside space-y-0.5">
                              {item.failedChecks.map((c, cIdx) => (
                                <li key={cIdx} className="font-bold text-red-600 uppercase">{c.label}</li>
                              ))}
                              {item.record.notes && <li className="text-slate-500 italic">{item.record.notes}</li>}
                            </ul>
                          </td>
                          <td className="p-3 font-black text-slate-700 uppercase">
                            {item.failedChecks.map(c => CLAUSE_MAPPING[c.id] || 'SANS 1475').filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-200 flex justify-between items-end">
              <div className="space-y-1">
                <p className="text-[8px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
                <p className="text-[6px] font-bold text-slate-500 uppercase tracking-widest">SANS 1475 Regulatory Maintenance Provider</p>
              </div>
              <div className="text-right space-y-2">
                <div className="flex flex-col items-end">
                  <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mb-1">Technician Signature</p>
                  <div className="h-8 w-32 border-b border-slate-900 relative">
                    {activeTech?.signature && (
                      <img src={activeTech.signature} className="max-h-full opacity-80 mix-blend-multiply absolute right-0 bottom-0" alt="Signature" />
                    )}
                  </div>
                  <p className="text-[7px] font-black text-slate-900 uppercase mt-1">{(activeTech?.name && activeTech.name !== 'Precision Management') ? activeTech.name : 'Authorised Technician'}</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* PAGE: SANS REGULATIONS & LEGAL RESPONSIBILITY */}
        {failedItems.length > 0 && (
          <div className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto overflow-hidden text-slate-900 relative mt-8">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
              <div className="flex items-center gap-4">
                <ReportLogo type="company" className="w-16 h-16" />
                <div className="text-left">
                  <h1 className="text-2xl font-black uppercase tracking-tighter">Precision Fire Services</h1>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Regulatory Compliance Standards</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black uppercase tracking-widest">SANS REGULATORY ANNEXURE</p>
              </div>
            </div>

            <div className="flex-1 space-y-8 text-left">
              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase border-b-2 border-slate-900 pb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full" />
                    Technical Justification & Regulatory Clauses
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-4 text-[10px] leading-relaxed text-slate-700">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-black text-slate-900 mb-1 uppercase tracking-tight">SANS 1475-1 Clause 4: Structural Integrity</p>
                        <p>Mandates that any cylinder showing signs of external corrosion, deep pitting, or mechanical damage exceeding 10% of the wall thickness must be condemned. This ensures the pressure vessel remains safe under operational loads.</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-black text-slate-900 mb-1 uppercase tracking-tight">SANS 1475-1 Clause 5.4: Mass Verification</p>
                        <p>Requires precise mass verification of the charge. Loss of mass exceeding 10% of the rated charge renders the unit inoperable and non-compliant, as it cannot effectively suppress a fire.</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-black text-slate-900 mb-1 uppercase tracking-tight">SANS 1475-2 Clause 5.2: Hose Integrity</p>
                        <p>Specifies that fire hoses must be free of cracks, perishing, or leaks. High-pressure integrity is critical for the delivery of water or foam to the fire source.</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-black text-slate-900 mb-1 uppercase tracking-tight">SANS 10400-T: National Building Regulations</p>
                        <p>Requires all fire equipment to be maintained in a fully operative state at all times. Non-compliance is a violation of building safety laws.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-6 border border-amber-200 rounded-2xl space-y-3">
                  <p className="text-xs font-black text-amber-900 uppercase tracking-widest">Legal Responsibility & Insurance Compliance</p>
                  <p className="text-xs leading-relaxed text-amber-800">
                    In accordance with the <strong className="font-black">Occupational Health and Safety Act (Act 85 of 1993)</strong> and the <strong className="font-black">Pressure Equipment Regulations</strong>, it is the responsibility of the building owner or designated responsible person to ensure that all fire protection equipment is maintained in a fully operational state. Failure to rectify these faults may result in the invalidation of your insurance cover and potential legal liability in the event of a fire emergency.
                  </p>
                </div>
              </div>

              <div className="pt-8 flex justify-between items-end border-t border-slate-200">
                <div className="space-y-4">
                  <div className="h-16 w-48 border-b-2 border-slate-900 relative">
                    {activeTech?.signature && (
                      <img src={activeTech.signature} className="max-h-full opacity-90 mix-blend-multiply absolute bottom-0 left-0" alt="Technician Signature" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">{(activeTech?.name && activeTech.name !== 'Precision Management') ? activeTech.name : 'Authorized SANS Personnel'}</p>
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-[0.2em]">SANS 1475 Competent Person</p>
                  </div>
                </div>
                <div className="flex gap-6 items-center grayscale opacity-60">
                  <ReportLogo type="saqcc" className="h-12" />
                  <ReportLogo type="sacas" className="h-12" />
                </div>
              </div>
            </div>
            <div className="mt-8">
              <CompanyFooter />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </div>
  );
};

export default ComprehensiveHydrostaticReport;
