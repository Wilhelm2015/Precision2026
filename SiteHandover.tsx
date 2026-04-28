
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Client, Equipment, InspectionRecord, Technician, TaskType } from '../types';
import { BrandLogo } from './Brand';
import { geminiService } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface SiteDisposalLedgerProps {
  client: Client;
  discardedAssets: Equipment[];
  records: InspectionRecord[];
  technicians: Technician[];
  onBack: () => void;
}

const SiteDisposalLedger: React.FC<SiteDisposalLedgerProps> = ({ client, discardedAssets, records, technicians, onBack }) => {
  const [aiStatement, setAiStatement] = useState<string>("Generating regulatory justification...");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const ledgerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchJustification = async () => {
      if (discardedAssets.length > 0) {
        const text = await geminiService.generateDiscardJustification(
          discardedAssets[0].type,
          discardedAssets[0].manufacturer || 'Unknown',
          "Failed SANS 1475 Physical Audit or Illegal Manufacturer Brand"
        );
        setAiStatement(text);
      }
    };
    fetchJustification();
  }, [discardedAssets]);

  const handlePrint = () => window.print();

  const handleDownloadPdf = async () => {
    if (!ledgerRef.current) return;
    setIsGeneratingPdf(true);
    try {
      await new Promise(r => setTimeout(r, 500));
      const pdf = new jsPDF('p', 'mm', 'a4', false);
      
      const pages = ledgerRef.current.querySelectorAll('.disposal-page');
      
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i] as HTMLElement, { 
          scale: 3, 
          useCORS: true, 
          allowTaint: true, 
          backgroundColor: '#ffffff',
          logging: false,
          windowWidth: 1200
        });
        
        const imgData = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      }
      
      pdf.save(`${client.name}_Disposal_Ledger_and_Certificate.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Find the primary technician responsible for these discards (locked to creator if possible)
  const primaryTech = useMemo(() => {
    if (client.technicianId) {
      const creator = technicians.find(t => t.id === client.technicianId);
      if (creator && creator.name !== 'Precision Management') return creator;
    }
    const primaryRecord = records.find(r => discardedAssets.some(a => a.id === r.equipmentId));
    return technicians.find(t => t.name !== 'Precision Management' && (primaryRecord?.inspectorName.includes(t.name) || primaryRecord?.inspectorName.includes(t.saqcc)));
  }, [client.technicianId, technicians, records, discardedAssets]);

  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  return (
    <div className="min-h-screen bg-slate-100 p-8 animate-in fade-in duration-500 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center no-print bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-bold flex items-center gap-2 hover:text-slate-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Return to Hub
          </button>
          <div className="flex gap-3">
            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50">
              {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={handlePrint} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black shadow-lg transition-all active:scale-95">Print Formal Ledger</button>
          </div>
        </div>

        <div className="space-y-8 print:space-y-0" ref={ledgerRef}>
          {/* PAGE 1: PROPERTY DISPOSAL REGISTRY */}
          <div className="bg-white p-12 md:p-20 shadow-2xl border-[16px] border-slate-900 relative print:border-none print:shadow-none overflow-hidden disposal-page min-h-[297mm] w-full flex flex-col">
            {/* Watermark */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none rotate-[-45deg] whitespace-nowrap text-[12rem] font-black uppercase text-slate-900 select-none">
              Ledger
            </div>

            <div className="relative z-10 flex flex-col gap-10 flex-grow">
              <div className="flex justify-between items-start border-b-8 border-slate-900 pb-10">
                <div className="flex items-center gap-6">
                  <BrandLogo className="w-20 h-20" />
                  <div>
                    <h1 className="text-3xl font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                    <p className="text-[12px] text-red-600 font-black uppercase tracking-[0.4em] mt-1">Property Disposal Registry</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Ref</p>
                  <p className="text-xl font-black text-slate-900 uppercase">SDL-{client.id.toUpperCase().slice(0, 6)}</p>
                  {primaryTech?.name && (
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      Technician: {primaryTech.name} | {new Date(finalizedDate).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Site Authorization</h2>
                <div>
                  <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">{client.name}</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{client.address}</p>
                </div>
              </div>

              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden shadow-xl">
                <div className="flex items-center gap-4 border-b border-white/10 pb-4">
                  <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-widest">SANS 1475 Regulatory Statement</h4>
                </div>
                <p className="text-xs font-medium leading-relaxed italic opacity-90">{aiStatement}</p>
              </div>

              <div className="space-y-6 flex-grow">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.4em] border-b-2 border-slate-100 pb-2">Decommissioned Equipment Ledger</h3>
                <div className="overflow-hidden border border-slate-100 rounded-3xl shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Asset Serial</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Equipment Class</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Manufacturer</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-900 uppercase tracking-widest text-right">Removal Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {discardedAssets.map(asset => {
                        const assetRecords = records.filter(r => r.equipmentId === asset.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        const latest = assetRecords[0];
                        const reason = latest?.status === 'Condemned' ? 'Condemned' : (latest?.taskType === TaskType.DISCARD ? 'Regulatory Scrapping' : 'Decommissioned');

                        return (
                          <tr key={asset.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-xs font-black text-slate-900 uppercase">{asset.serialNumber}</td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">{asset.type}</td>
                            <td className="px-6 py-4 text-xs font-black text-red-600 uppercase">{asset.manufacturer}</td>
                            <td className="px-6 py-4 text-xs">
                              <span className="text-[8px] font-black px-2 py-0.5 rounded uppercase bg-red-100 text-red-700">
                                {reason}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-medium text-slate-400 text-right">{asset.archivedAt || '---'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-8 flex justify-between items-end border-t border-slate-100">
                <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.5em]">Precision Fire Services (Pty) Ltd</p>
                <p className="text-[8px] text-slate-400 font-black uppercase">Page 1 of {discardedAssets.length + 1}</p>
              </div>
            </div>
          </div>

          {/* PAGE 2+: SCRAP DECOMMISSIONING CERTIFICATES */}
          {discardedAssets.map((asset, index) => {
            const assetRecords = records.filter(r => r.equipmentId === asset.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const latestRecord = assetRecords[0];
            const photos = latestRecord?.photos || [];

            return (
              <div key={asset.id} className="bg-white p-12 md:p-20 shadow-2xl border-[16px] border-slate-900 relative print:border-none print:shadow-none overflow-hidden disposal-page min-h-[297mm] w-full flex flex-col break-before-page">
                {/* Watermark */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] pointer-events-none rotate-[-45deg] whitespace-nowrap text-[12rem] font-black uppercase text-slate-900 select-none">
                  Certified
                </div>

                <div className="relative z-10 flex flex-col gap-12 flex-grow">
                  <div className="text-center space-y-4 border-b-8 border-slate-900 pb-12">
                    <BrandLogo className="w-24 h-24 mx-auto mb-4" />
                    <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none">Scrap Decommissioning Certificate</h2>
                    <p className="text-sm text-red-600 font-black uppercase tracking-[0.4em]">SANS 1475 Regulatory Compliance Record</p>
                  </div>

                  <div className="space-y-8 text-center flex-grow">
                    <div className="space-y-4">
                      <p className="text-lg text-slate-600 font-bold uppercase leading-relaxed max-w-2xl mx-auto">
                        This document formally certifies that the following fire equipment has been decommissioned and removed from active service at:
                      </p>
                      <div className="py-6">
                        <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{client.name}</h3>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-2">{client.address}</p>
                      </div>
                      
                      <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl max-w-xl mx-auto grid grid-cols-2 gap-8 text-left">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Asset Serial</p>
                          <p className="text-xl font-black uppercase">{asset.serialNumber}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Equipment Class</p>
                          <p className="text-xl font-black uppercase">{asset.type}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Manufacturer</p>
                          <p className="text-xl font-black uppercase text-red-500">{asset.manufacturer}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Decommission Date</p>
                          <p className="text-xl font-black uppercase">{asset.archivedAt || '---'}</p>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 font-medium leading-relaxed max-w-2xl mx-auto mt-6">
                        The decommissioning process was conducted in strict accordance with <span className="text-red-600 font-black">SANS 1475 Part 1 & 2</span> regulatory requirements. This unit has been rendered inoperable and processed for regulatory scrapping.
                      </p>
                    </div>
                    
                    {/* Evidence Photo */}
                    {photos.length > 0 ? (
                      <div className="space-y-4 bg-slate-50 p-8 rounded-[3rem] border-2 border-dashed border-slate-200 max-w-2xl mx-auto">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Regulatory Evidence: Decommissioned Unit Photo</p>
                        <div className="aspect-video rounded-2xl overflow-hidden border-4 border-white shadow-md bg-slate-100 max-w-md mx-auto">
                          <img src={photos[0]} className="w-full h-full object-cover" alt={`Evidence ${asset.serialNumber}`} referrerPolicy="no-referrer" />
                        </div>
                        <p className="text-[8px] font-black text-slate-400 uppercase italic">Visual confirmation of unit decommissioning and serial verification</p>
                      </div>
                    ) : (
                      <div className="py-12 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 max-w-2xl mx-auto">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Evidence Photo Available</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-6 text-center max-w-xl mx-auto">
                       <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Disposal Method</p>
                          <p className="text-xs font-black text-red-600 uppercase">Regulatory Scrap</p>
                       </div>
                       <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Certificate ID</p>
                          <p className="text-xs font-black text-slate-900 uppercase">CERT-{asset.id.toUpperCase().slice(0, 8)}</p>
                       </div>
                    </div>
                  </div>

                  <div className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-end border-t-8 border-slate-900">
                    <div className="space-y-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Decommissioning Authorization</p>
                      <div className="h-24 flex items-center justify-center border-b-4 border-slate-900 relative">
                        {primaryTech?.signature ? (
                          <img src={primaryTech.signature} className="max-h-full opacity-90 scale-125 mix-blend-multiply" alt="Tech Signature" />
                        ) : (
                          <p className="text-[9px] font-black text-slate-200 uppercase rotate-[-5deg] border-4 border-slate-100 px-6 py-2">System Authenticated</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 uppercase">{primaryTech?.name || 'Authorized Site Manager'}</p>
                        {primaryTech && (
                          <div className="mt-1">
                            <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.2em]">SAQCC REGISTERED: {primaryTech.saqcc}</p>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                              Date: {new Date(finalizedDate).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-4">
                      <div className="w-36 h-36 border-8 border-slate-900 rounded-full flex flex-col items-center justify-center text-center p-4">
                        <div className="text-[10px] font-black text-red-600 leading-none">SCRAP</div>
                        <div className="text-[18px] font-black text-slate-900 uppercase my-1 leading-none tracking-tighter">VOIDED</div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">SANS 1475</div>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.5em]">Precision Fire Services (Pty) Ltd</p>
                        <p className="text-[8px] text-slate-400 font-black uppercase mt-1">Page {index + 2} of {discardedAssets.length + 1}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SiteDisposalLedger;
