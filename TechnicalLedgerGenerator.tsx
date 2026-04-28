import React, { useRef } from 'react';
import { Client, Equipment, InspectionRecord, EquipmentType, SavedReport, Technician, TaskType } from '../types';
import { SACAS_PERMIT_NUMBER, EQUIPMENT_DEFINITIONS } from '../constants';
import { BrandLogo } from './Brand';
import { ReportLogo } from './ReportGenerator';
import { getProxiedImageUrl } from '../services/registryService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TechnicalReportGeneratorProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  technicians: Technician[];
  onBack: () => void;
  isPublic?: boolean;
  isReadOnly?: boolean;
  onSaveReport?: (report: SavedReport) => void;
  activeTech?: any;
  branding?: any[];
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

const TechnicalReportGenerator: React.FC<TechnicalReportGeneratorProps> = ({ 
  client, equipment, records, technicians, onBack, isPublic = false, isReadOnly = false, onSaveReport, activeTech, branding = [] 
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = React.useState(false);
  const reportRef = React.useRef<HTMLDivElement>(null);
  
  const handlePrint = () => window.print();

  const handleSave = () => {
    if (!onSaveReport) return;
    
    const report: SavedReport = {
      id: `report_tech_${Date.now()}`,
      client_id: client.id,
      type: 'Technical Asset Ledger',
      date: new Date().toISOString(),
      data: {
        equipment: activeAssets,
        records: records,
        faults: [] 
      },
      created_at: new Date().toISOString()
    };
    
    onSaveReport(report);
    alert("Technical Ledger issued and saved to archive.");
  };

  const displayTechnician = React.useMemo(() => {
    const creatorTech = technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management');
    if (creatorTech) return creatorTech;
    
    const latestRecord = records.sort((a, b) => {
      const dateA = a.date || a.created_at || '';
      const dateB = b.date || b.created_at || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    })[0];
    const inspector = technicians.find(t => (t.name === latestRecord?.inspectorName || t.saqcc === latestRecord?.inspectorName) && t.name !== 'Precision Management');
    if (inspector) return inspector;
    
    return activeTech;
  }, [technicians, client.technicianId, records, activeTech]);

  const getLatestRecord = (equipmentId: string) => {
    const assetId = String(equipmentId || '').trim();
    return records
      .filter(r => String(r.equipmentId || r.equipment_id || '').trim() === assetId)
      .sort((a, b) => {
        const dateA = a.date || a.created_at || '';
        const dateB = b.date || b.created_at || '';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      })[0];
  };

  const activeAssets = React.useMemo(() => {
    const filtered = equipment.filter(e => {
      const assetId = String(e.id || '').trim();
      const assetRecords = records
        .filter(r => String(r.equipmentId || r.equipment_id || '').trim() === assetId)
        .sort((a, b) => {
          const dateA = a.date || a.created_at || '';
          const dateB = b.date || b.created_at || '';
          const dateDiff = new Date(dateB).getTime() - new Date(dateA).getTime();
          if (dateDiff !== 0) return dateDiff;
          if (b.taskType === TaskType.DISCARD) return 1;
          if (a.taskType === TaskType.DISCARD) return -1;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
      
      const latest = assetRecords[0];
      
      if (latest?.status === 'Discarded' || latest?.taskType === TaskType.DISCARD) return false;
      
      if (!e.isArchived) return true;
      return latest?.status === 'Condemned';
    });

    const order = [
      EquipmentType.EXTINGUISHER, 
      EquipmentType.CO2_EXTINGUISHER, 
      EquipmentType.HOSE_REEL, 
      EquipmentType.HYDRANT,
      EquipmentType.BOOSTER_CONNECTION
    ];
    return filtered.sort((a, b) => {
      const indexA = order.indexOf(a.type);
      const indexB = order.indexOf(b.type);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [equipment, records]);

  const itemsPerPage = 18; // Further increased items per page
  const assetChunks = React.useMemo(() => {
    const chunks = [];
    for (let i = 0; i < activeAssets.length; i += itemsPerPage) {
      chunks.push(activeAssets.slice(i, i + itemsPerPage));
    }
    return chunks;
  }, [activeAssets]);

  const finalizedDate = React.useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => {
      const dateA = a.date || a.created_at || '';
      const dateB = b.date || b.created_at || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    return sorted[0].date || sorted[0].created_at;
  }, [records]);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4', false);
      const pages = reportRef.current.querySelectorAll('.report-page-inventory');
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        page.classList.add('generating-pdf');
        
        if (i > 0) pdf.addPage('a4', 'l');
        
        await pdf.html(page, {
            x: 0,
            y: 0,
            width: 297,
            windowWidth: 1600,
            margin: 0
        });
        
        page.classList.remove('generating-pdf');
      }
      
      pdf.save(`${client.name}_Technical_Asset_Ledger.pdf`);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again or refresh the page.`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    const publicUrl = `${window.location.origin}/?view=inventory&cid=${client.id}`;
    const shareData = {
      title: `Technical Asset Ledger - ${client.name}`,
      text: `Precision Fire: Technical Inventory Report for ${client.name}. Total Assets: ${equipment.length}. View Report: ${publicUrl}`,
      url: publicUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(publicUrl);
        alert("Public link copied! You can now send this link to the client.");
      }
    } catch (err) {
      console.error("Error sharing report:", err);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-100 p-4 md:p-8 animate-in fade-in duration-500 font-sans ${isPublic ? 'pt-16' : ''}`}>
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* STICKY HEADER */}
        <div className="sticky top-4 z-[100] flex justify-between items-center no-print bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-slate-200">
          <button onClick={onBack} className="text-slate-900 font-black flex items-center gap-3 hover:text-red-600 transition-all group">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-red-50 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </div>
            <span className="uppercase tracking-widest text-xs">{isPublic ? 'Back Home' : 'Back to Registry'}</span>
          </button>
          <div className="flex gap-3">
            {!isReadOnly && onSaveReport && (
              <button 
                onClick={handleSave}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 002-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                Issue & Save Ledger
              </button>
            )}
            {!isPublic && (
              <button onClick={handleShare} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Share Report
              </button>
            )}
            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 shadow-lg shadow-red-200 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={handlePrint} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black shadow-lg active:scale-95 transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Ledger
            </button>
          </div>
        </div>

        <div ref={reportRef} className="space-y-4">
          {assetChunks.length > 0 ? (
            assetChunks.map((chunk, chunkIdx) => (
              <div key={`page-${chunkIdx}`} className="bg-white shadow-2xl rounded-[3rem] overflow-hidden border border-slate-200 print:shadow-none print:border-none print:rounded-none report-page-inventory mb-8 last:mb-0 min-h-[794px] flex flex-col">
                {/* HEADER */}
                <div className="bg-slate-900 text-white p-6 border-b-4 border-red-600 flex justify-between items-end shrink-0 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full -mr-16 -mt-16 blur-2xl opacity-50"></div>
                  <div className="absolute top-1 right-4 text-[6px] text-slate-500 font-black uppercase tracking-[0.4em] opacity-50 z-10">© 2026 Precision Fire Services.</div>
                  <div className="flex items-center gap-4 relative z-10">
                    <BrandLogo className="w-12 h-12" glow branding={branding} />
                    <div className="text-left">
                      <h1 className="text-xl font-black uppercase tracking-tighter leading-none mb-1">Precision Fire Services</h1>
                      <p className="text-[8px] text-red-500 font-black uppercase tracking-[0.3em]">SANS 1475 TECHNICAL ASSET LEDGER {assetChunks.length > 1 ? `• PAGE ${chunkIdx + 1}/${assetChunks.length}` : ''}</p>
                      <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Permit: {SACAS_PERMIT_NUMBER}</p>
                    </div>
                  </div>
                  <div className="text-right relative z-10">
                    <h2 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1 text-white">{client.name}</h2>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex gap-2">
                        <ReportLogo type="saqcc" className="w-auto h-6" branding={branding} />
                      </div>
                      <p className="text-[7px] text-slate-400 font-black uppercase tracking-widest">Registry Record: {finalizedDate ? new Date(finalizedDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 flex-1 bg-white">
                  <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white">
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest">Asset SN</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest">Seal SN</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest">Type / Class</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest">Capacity</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest">Manufacturer</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest text-center">Mfg Date</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest text-center">Weight</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest text-center">Last Srv</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest text-center">Next Srv</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest text-center">Last Hydro</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest text-center">Next Hydro</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest">Location</th>
                          <th className="px-2 py-3 text-[7px] font-black uppercase tracking-widest text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {chunk.map(item => {
                          const record = getLatestRecord(item.id);
                          const isFlashFire = (() => {
                            const m = (item.manufacturer || '').toLowerCase();
                            return m.includes('flash fire') || m.includes('flashfire');
                          })();
                          const isCondemned = record?.status === 'Condemned' || isFlashFire;
                          const isServiceOverdue = new Date(item.nextServiceDate) < new Date();
                          
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-2 py-2 text-[10px] font-black text-slate-900 uppercase tracking-tight leading-none">{item.serialNumber}</td>
                              <td className="px-2 py-2 text-[9px] font-black text-blue-600 uppercase leading-none">{(() => {
                                const assetRecords = records.filter(r => r.equipmentId === item.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                                const record = assetRecords[0];
                                const latestWithSeal = assetRecords.find(r => r.sealSerialNumber && r.sealSerialNumber !== '---');
                                return latestWithSeal?.sealSerialNumber || record?.sealSerialNumber || '---';
                              })()}</td>
                              <td className="px-2 py-2 text-[8px] font-bold text-slate-500 uppercase">
                                <span className="text-slate-900 font-black">{item.type}</span>
                                {record?.hydrantType && <div className="text-[7px] text-red-600 font-black mt-0.5 uppercase tracking-widest">{record.hydrantType}</div>}
                              </td>
                              <td className="px-2 py-2 text-[8px] font-black text-slate-700 uppercase">{item.size || 'N/A'}</td>
                              <td className="px-2 py-2 text-[8px] font-bold text-slate-500 uppercase">{item.manufacturer}</td>
                              <td className="px-2 py-2 text-[8px] font-medium text-slate-500 text-center uppercase">{item.manufactureDateUnknown ? 'UNK' : formatDate(item.manufactureDate)}</td>
                              <td className="px-2 py-2 text-[8px] font-black text-slate-900 text-center uppercase">{record?.recordedMass || '---'}</td>
                              <td className="px-2 py-2 text-[8px] font-medium text-slate-500 text-center uppercase">{formatDate(item.lastInspectionDate)}</td>
                              <td className={`px-2 py-2 text-[8px] font-black text-center uppercase ${isServiceOverdue ? 'text-red-600' : 'text-slate-900'}`}>{formatDate(item.nextServiceDate)}</td>
                              <td className="px-2 py-2 text-[8px] font-medium text-slate-500 text-center uppercase">{item.pressureTestDateUnknown ? 'UNK' : formatDate(item.lastPressureTestDate)}</td>
                              <td className={`px-2 py-2 text-[8px] font-bold text-center uppercase ${item.pressureTestDateUnknown ? 'text-slate-500' : 'text-amber-600'}`}>{item.pressureTestDateUnknown ? 'UNK' : formatDate(item.nextPressureTestDate)}</td>
                              <td className="px-2 py-2 text-[8px] font-medium text-slate-400 uppercase truncate max-w-[100px]">{item.location}</td>
                              <td className="px-2 py-2 text-right">
                                {isCondemned ? (
                                  <span className="text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest bg-red-700 text-white shadow-sm">
                                    {isFlashFire ? 'CONDEMNED (ILLEGAL)' : 'CONDEMNED'}
                                  </span>
                                ) : (
                                  <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest border shadow-sm ${record?.status === 'Pass' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                    {record?.status || 'Active'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* FOOTER - Only on last page */}
                {chunkIdx === assetChunks.length - 1 && (
                  <div className="p-6 border-t border-slate-100 bg-slate-50/50">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <h3 className="text-[8px] font-black text-slate-900 uppercase tracking-widest">Inventory Certification</h3>
                        <p className="text-[8px] text-slate-500 leading-relaxed font-medium">
                          The above assets constitute the full registered fire protection inventory for this property as recorded in the Precision Fire Services cloud registry. This ledger provides the technical lifecycle data required for SANS 1475 Parts 1 & 2 audit compliance.
                        </p>
                      </div>
                      <div className="flex flex-col items-end justify-end">
                        <div className="flex gap-3 items-center mb-1">
                           <img src={getProxiedImageUrl(branding.find(b => b.id === 'pfs_custom_saqcc')?.content || localStorage.getItem('pfs_custom_saqcc') || '')} className="w-[30px] h-[20px] object-contain opacity-80" alt="saqcc" referrerPolicy="no-referrer" />
                        </div>
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Precision Fire Services (Pty) Ltd</p>
                        <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Digital Registry Hub • Permit: {SACAS_PERMIT_NUMBER}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="bg-white shadow-2xl rounded-[3rem] p-20 text-center text-slate-400 uppercase font-black tracking-widest text-[10px] border border-slate-200">Registry Empty</div>
          )}
        </div>
      </div>
      <style>{`
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .report-page-inventory { 
             width: 297mm; min-height: 210mm; margin: 0 auto; border: none !important; box-shadow: none !important; border-radius: 0 !important;
             padding: 10mm !important; display: flex; flex-direction: column;
          }
          @page {
            size: landscape;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default TechnicalReportGenerator;