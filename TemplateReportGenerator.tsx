import React, { useState, useRef, useMemo } from 'react';
import { Client } from '../types';
import { SACAS_PERMIT_NUMBER } from '../constants';
import { BrandLogo } from './Brand';
import { getProxiedImageUrl } from '../services/registryService';
import { QRCodeSVG } from 'qrcode.react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { getAppBaseUrl } from '../utils';

interface WelcomePackGeneratorProps {
  client: Client;
  records: any[];
  onBack: () => void;
  branding?: any[];
}

const WelcomePackGenerator: React.FC<WelcomePackGeneratorProps> = ({ client, records, onBack, branding }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const packRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => window.print();
  
  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  const handleDownloadPdf = async () => {
    if (!packRef.current) return;
    setIsGeneratingPdf(true);
    await new Promise(r => setTimeout(r, 500));
    const pdf = new jsPDF('p', 'mm', 'a4', false);
    const canvas = await html2canvas(packRef.current.querySelector('.welcome-pack-page') as HTMLElement, { 
      scale: 3, 
      useCORS: true, 
      allowTaint: true, 
      backgroundColor: '#ffffff', 
      imageTimeout: 0,
      windowWidth: 1200
    });
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    pdf.save(`${client.name}_Welcome_Pack.pdf`);
    setIsGeneratingPdf(false);
  };
  const portalUrl = `${getAppBaseUrl()}/?portal=${client.id}`;

  const managerSignature = getProxiedImageUrl(branding?.find(b => b.id === 'pfs_manager_signature')?.content || '');
  const managerTypedName = branding?.find(b => b.id === 'pfs_manager_typed_name')?.content;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 animate-in fade-in duration-500 font-sans no-print-bg">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="no-print flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-slate-900 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Registry Hub
          </button>
          <div className="flex gap-3">
            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50">
              {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95">
              Print Onboarding Pack
            </button>
          </div>
        </div>

        <div className="bg-white p-16 md:p-24 shadow-2xl border-t-[20px] border-slate-900 print:shadow-none print:border-none print:p-0 print:m-0 welcome-pack-page" ref={packRef}>
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-12 mb-12">
            <div className="flex items-center gap-8">
              <BrandLogo className="w-24 h-24" />
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tight leading-none mb-2">Registry Onboarding</h1>
                <p className="text-[12px] text-red-600 font-black uppercase tracking-[0.4em]">Official SANS Digital Clearance Pack</p>
              </div>
            </div>
            <div className="text-right">
                <div className="inline-block bg-slate-900 text-white p-4 rounded-3xl shadow-xl">
                   <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Property UID</p>
                   <p className="text-lg font-black tracking-widest">{client.id.toUpperCase()}</p>
                </div>
            </div>
          </div>

          <div className="space-y-12 text-slate-800">
            <div className="space-y-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">{new Date(finalizedDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">{client.name}</h2>
              <div className="flex items-center gap-2">
                 <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">{client.address}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                 <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight border-l-4 border-red-600 pl-4">Digital Asset Integration</h3>
                 <p className="text-[13px] leading-relaxed text-slate-600 font-medium italic">
                    "Your property infrastructure is now managed under a centralized SANS 1475 digital governance node."
                 </p>
                 <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Key Management Features:</h4>
                    <ul className="space-y-3">
                       {[
                         "Immutable Technical Audit Logs",
                         "Dynamic 5-Year Overhaul Reminders",
                         "Digital COM Retrieval",
                         "SAQCC Personnel Verification"
                       ].map((f, i) => (
                         <li key={i} className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full shrink-0" />
                            <p className="text-[11px] font-black uppercase text-slate-700 tracking-tight">{f}</p>
                         </li>
                       ))}
                    </ul>
                 </div>
              </div>
              
              <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200 flex flex-col items-center text-center space-y-6">
                  <div className="w-16 h-16 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg border-4 border-white">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black uppercase text-red-900 tracking-widest mb-1">Compliance Mandate</h4>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed uppercase tracking-tight">
                      SANS 10105-1 requires monthly visual inspections. Sites failing to log a registry scan within the first 7 days of the month will be flagged as "Non-Compliant".
                    </p>
                  </div>
              </div>
            </div>

            <div className="bg-slate-900 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-10 opacity-5">
                  <BrandLogo className="w-40 h-40" />
               </div>
               <div className="relative z-10 space-y-10">
                  <div className="flex justify-between items-center border-b border-white/10 pb-4">
                     <h4 className="text-sm font-black uppercase tracking-[0.4em] text-red-500">Secure Access Tokens</h4>
                     <span className="text-[8px] font-black uppercase tracking-widest text-white/30">PRECISION-VAULT-AUTHENTICATION</span>
                  </div>
                  <div className="flex flex-col md:flex-row items-center gap-12">
                     <div className="bg-white p-3 rounded-[2.5rem] shadow-2xl shrink-0">
                        <QRCodeSVG 
                          value={portalUrl} 
                          size={180} 
                          level="H" 
                          includeMargin={false}
                          imageSettings={{
                            src: "/pfs-logo.png",
                            x: undefined,
                            y: undefined,
                            height: 40,
                            width: 40,
                            excavate: true,
                          }}
                        />
                     </div>
                     <div className="flex-1 space-y-6">
                        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl">
                           <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-2">Registry PIN Code</p>
                           <div className="text-6xl font-black tracking-[0.4em] text-white">{client.portalPin}</div>
                        </div>
                        <p className="text-[12px] text-slate-400 font-medium leading-relaxed">
                          Scan the Secure Registry Link or visit our hub to access technical files. Use the PIN above to authorize technical document issuance and ledger downloads.
                        </p>
                     </div>
                  </div>
               </div>
            </div>
          </div>

          <div className="mt-24 pt-10 border-t border-slate-100 flex justify-between items-end">
            <div className="space-y-4">
              <div className="h-16 w-48 border-b border-slate-300 flex items-center justify-center overflow-hidden">
                {managerSignature ? (
                  <img src={managerSignature} className="max-h-full max-w-full object-contain" alt="Manager Signature" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                ) : managerTypedName ? (
                  <span className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">
                    {managerTypedName}
                  </span>
                ) : (
                  <span className="italic text-slate-200 uppercase font-black text-[10px]">Registry Authorization Signature</span>
                )}
              </div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-900 leading-none">Precision Fire Services (Pty) Ltd</p>
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest space-y-1 leading-none">
                 <p>Technical Division: Groblerpark, Roodepoort</p>
                 <p>24/7 Support: info@precisionfireservices.co.za</p>
              </div>
            </div>
            <div className="text-right">
               <p className="text-2xl font-black text-slate-900 leading-none">078 173 7245</p>
               <p className="text-[8px] font-black text-red-600 uppercase tracking-[0.5em] mt-2">SANS MASTER REGISTRY NODE</p>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .no-print-bg { background: white !important; padding: 0 !important; }
          @page { margin: 0; size: A4 portrait; }
        }
      `}</style>
    </div>
  );
};

export default WelcomePackGenerator;