import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Client } from '../types';
import { SACAS_PERMIT_NUMBER } from '../constants';
import { BrandLogo } from './Brand';
import { getProxiedImageUrl } from '../services/registryService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface SLAGeneratorProps {
  client: Client;
  records: any[];
  onBack: () => void;
  autoDownload?: boolean;
  branding?: any[];
}

const SLAGenerator: React.FC<SLAGeneratorProps> = ({ client, records, onBack, autoDownload = false, branding }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const slaAmount = client.slaAmount || '0.00';

  const managerSignature = getProxiedImageUrl(branding?.find(b => b.id === 'pfs_manager_signature')?.content || '');
  const managerTypedName = branding?.find(b => b.id === 'pfs_manager_typed_name')?.content;

  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setIsGenerating(true);
    
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4', false);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`SLA_Agreement_${client.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("PDF Generation failed:", error);
      alert("Failed to generate PDF. Please try the Print option.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (autoDownload) {
      const timer = setTimeout(() => {
        handleDownloadPdf();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoDownload]);

  const handlePrint = () => window.print();

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 animate-in fade-in duration-500 font-sans no-print-bg">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="no-print flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-slate-900 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back
          </button>
          <div className="flex gap-3">
            <button 
              onClick={handleDownloadPdf} 
              disabled={isGenerating}
              className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50"
            >
              {isGenerating ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button onClick={handlePrint} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-emerald-700 transition-all active:scale-95">
              Print Agreement
            </button>
          </div>
        </div>

        <div ref={printRef} className="bg-white p-16 md:p-24 shadow-2xl border-t-[24px] border-slate-900 print:shadow-none print:border-none print:p-0 print:m-0">
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-10 mb-12 break-inside-avoid">
            <div className="flex items-center gap-6">
              <BrandLogo className="w-20 h-20" />
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight leading-none">Service Level Agreement</h1>
                <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.4em] mt-1">Managed Digital Registry & Asset Oversight</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-900 uppercase">Contractual Ref</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SANS-SLA-{client.id.toUpperCase().slice(0, 6)}</p>
            </div>
          </div>

          <div className="space-y-8 text-slate-800 text-[12px] leading-relaxed">
            <div className="space-y-4 break-inside-avoid">
               <p className="font-bold">This Professional Service Agreement ("Agreement") is executed on this {new Date(finalizedDate).toLocaleDateString('en-ZA')} by and between:</p>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                     <p className="font-black uppercase tracking-widest text-slate-400 text-[9px]">The Service Provider:</p>
                     <p className="font-black text-slate-900 uppercase">Precision Fire Services (Pty) Ltd</p>
                     <p className="font-medium text-slate-600">739 Corlett Avenue, Groblerpark, Roodepoort</p>
                     <p className="font-medium text-slate-600">Reg: 2014/139488/07</p>
                  </div>
                  <div className="space-y-2">
                     <p className="font-black uppercase tracking-widest text-slate-400 text-[9px]">The Client:</p>
                     <p className="font-black text-slate-900 uppercase">{client.name}</p>
                     <p className="font-medium text-slate-600">{client.address}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-slate-100">
               <section className="space-y-3 break-inside-avoid">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight border-l-4 border-slate-900 pl-4">1. DEFINITIONS AND SCOPE OF WORK</h3>
                  <p className="text-slate-600">The Provider shall implement and maintain a high-availability Digital Regulatory Registry for the Client. This includes the provision of QR-linked asset tracking, cloud storage for technical compliance documentation (COCs), and real-time portal access for property management.</p>
               </section>

               <section className="space-y-3 break-inside-avoid">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight border-l-4 border-slate-900 pl-4">2. DATA INTEGRITY AND SECURITY</h3>
                  <p className="text-slate-600">The Digital Registry Node is governed by SANS 1475 and SANS 10105 frameworks. All technical records, inspection timestamps, and technician credentials are archived in an immutable cloud database, ensuring 99.9% uptime for regulatory inspections by local fire authorities.</p>
               </section>

               <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-6 shadow-2xl relative overflow-hidden break-inside-avoid">
                  <h3 className="text-lg font-black uppercase tracking-tight text-emerald-400">3. FINANCIAL CONSIDERATIONS</h3>
                  <p className="text-sm font-medium opacity-80">
                    To maintain the continuous integrity of the Digital Registry and Site Portal, a professional service subscription is mandatory for the duration of this Agreement.
                  </p>
                  <div className="flex flex-col items-center py-8 bg-white/5 rounded-[2.5rem] border border-white/10">
                     <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em] mb-2">Monthly Professional Service Fee</p>
                     <div className="text-6xl font-black tracking-tighter">R {slaAmount}</div>
                     <p className="text-[8px] text-slate-400 font-medium mt-4 uppercase tracking-widest">Fixed Term: 12 Months • Billed Monthly in Advance • (Excl. VAT)</p>
                  </div>
               </div>

               <section className="space-y-3 break-inside-avoid">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight border-l-4 border-slate-900 pl-4">4. DURATION AND CANCELLATION</h3>
                  <p className="text-slate-600">4.1 This Agreement is valid for an initial period of twelve (12) months from the date of activation. <br/> 
                  4.2 Either party may terminate this Agreement by providing thirty (30) days written notice prior to the expiration of the current term.</p>
               </section>

               <section className="space-y-3 break-inside-avoid">
                  <h3 className="font-black text-slate-900 uppercase tracking-tight border-l-4 border-slate-900 pl-4">5. CLIENT OBLIGATIONS</h3>
                  <p className="text-slate-600">The Client acknowledges that regulatory compliance requires periodic visual inspections. The Digital Registry facilitates this through the Site Portal; failure to record mandatory monthly scans may impact the site's "Compliance Health Score" as required for insurance and fire safety purposes.</p>
               </section>
            </div>

            <div className="pt-12 grid grid-cols-2 gap-16 break-inside-avoid">
               <div className="space-y-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">For Precision Fire Services</p>
                    <div className="h-16 border-b border-slate-300 flex items-center justify-center overflow-hidden">
                      {managerSignature ? (
                        <img src={managerSignature} className="max-h-full max-w-full object-contain" alt="Manager Signature" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                      ) : managerTypedName ? (
                        <span className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">
                          {managerTypedName}
                        </span>
                      ) : (
                        <span className="italic text-slate-200 uppercase font-black text-[10px]">Management Authorization Signature</span>
                      )}
                    </div>
                    <p className="text-[10px] font-black uppercase">Technical Director</p>
                  </div>
               </div>
               <div className="space-y-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">For The Client</p>
                    <div className="h-16 border-b border-slate-300 flex items-center justify-center text-slate-200 font-black uppercase text-[10px] italic">
                      Client Acceptance Signature
                    </div>
                    <p className="text-[10px] font-black uppercase">Authorized Site Representative</p>
                  </div>
               </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Precision Fire Services (Pty) Ltd</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Master Registry Node • South Africa</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-red-600 leading-none">010 035 5246</p>
              <p className="text-[8px] text-slate-300 font-black uppercase mt-1">SLA-V3.5-PREMIUM</p>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .no-print-bg { background: white !important; padding: 0 !important; }
          @page { margin: 10mm; size: A4 portrait; }
        }
      `}</style>
    </div>
  );
};

export default SLAGenerator;