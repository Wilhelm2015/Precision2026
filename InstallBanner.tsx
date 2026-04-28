import React, { useState, useRef, useMemo } from 'react';
import { Client } from '../types';
import { SACAS_PERMIT_NUMBER } from '../constants';
import { BrandLogo } from './Brand';
import { getProxiedImageUrl } from '../services/registryService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface IntroductionLetterProps {
  client: Client;
  records: any[];
  onBack: () => void;
  branding?: any[];
}

const IntroductionLetter: React.FC<IntroductionLetterProps> = ({ client, records, onBack, branding }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const letterRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => window.print();
  
  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  const handleDownloadPdf = async () => {
    if (!letterRef.current) return;
    setIsGeneratingPdf(true);
    await new Promise(r => setTimeout(r, 500));
    const pdf = new jsPDF('p', 'mm', 'a4', false);
    const canvas = await html2canvas(letterRef.current as HTMLElement, { 
      scale: 3, 
      useCORS: true, 
      allowTaint: true, 
      backgroundColor: '#ffffff', 
      imageTimeout: 0,
      windowWidth: 1200
    });
    const imgData = canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    pdf.save(`${client.name}_Introduction_Letter.pdf`);
    setIsGeneratingPdf(false);
  };

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
            <div className="flex gap-4">
              <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
              </button>
              <button onClick={handlePrint} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all active:scale-95">
                Print Professional Intro
              </button>
            </div>
          </div>

        <div className="bg-white p-16 md:p-24 shadow-2xl border-l-[16px] border-slate-900 print:shadow-none print:border-none print:p-0 print:m-0 intro-letter-page" ref={letterRef}>
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-10 mb-12">
            <div className="flex items-center gap-6">
              <BrandLogo className="w-20 h-20" />
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mt-1">Specialists in Fire Protection Governance</p>
                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  Reg: 2014/139488/07 • SACAS Permit: {SACAS_PERMIT_NUMBER}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-900 uppercase">Document Reference</p>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">REG-INT-{client.id.toUpperCase().slice(0, 6)}</p>
            </div>
          </div>

          <div className="space-y-8 text-slate-800">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(finalizedDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h2 className="text-xl font-black uppercase tracking-tight">To: The Management Executive</h2>
              <p className="text-lg font-black text-slate-900 uppercase">{client.name}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">{client.address}</p>
            </div>

            <div className="border-y border-slate-100 py-6">
               <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">RE: IMPLEMENTATION OF SANS 1475 DIGITAL COMPLIANCE AND ASSET INTEGRITTY MANAGEMENT</h3>
            </div>
            
            <p className="text-sm leading-relaxed text-slate-700 font-medium">
              We are pleased to confirm that <strong>{client.name}</strong> has been formally integrated into the Precision Fire Services Digital Compliance Ecosystem. This onboarding signifies a transition from traditional manual record-keeping to high-integrity digital governance for your site’s fire protection assets.
            </p>

            <div className="space-y-8">
              <h4 className="text-xs font-black uppercase tracking-widest text-red-600 border-b-2 border-red-50 pb-2">Digital Operations Roadmap:</h4>
              <div className="grid grid-cols-1 gap-8">
                 {[
                   { step: "01", title: "Asset Identity (Scanning)", desc: "Each unit is fitted with a unique SANS Identity Tag. A simple scan verifies the asset's location and technical history in the master registry." },
                   { step: "02", title: "Mandatory Site Audits", desc: "Site personnel use the portal to log mandatory SANS 10105 visual inspections. As per regulatory protocol, these scans must be completed within the first 7 days of each month to ensure the site's compliance integrity." },
                   { step: "03", title: "Instant Incident Reporting", desc: "In the event of a fire or accidental discharge, a 'Fault Report' is logged via the QR portal. This triggers an immediate technical alert for remediation." },
                   { step: "04", title: "Compliance Document Retrieval", desc: "Valid Maintenance Certificates (COM) and technical ledgers are available for instant download, providing evidence for insurance and fire marshal audits." }
                 ].map((item, idx) => (
                   <div key={idx} className="flex gap-6 items-start group">
                      <div className="text-2xl font-black text-slate-100 bg-slate-900 px-3 py-1 rounded-xl shadow-lg shrink-0 group-hover:bg-red-600 transition-colors">{item.step}</div>
                      <div className="space-y-1">
                         <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.title}</p>
                         <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{item.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>
            </div>

            <div className="p-8 border-l-4 border-red-600 bg-slate-50 rounded-r-[2rem] space-y-4">
               <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Managed Subscription Compliance</h4>
               <p className="text-[12px] text-slate-700 leading-relaxed italic">
                 To ensure the security, availability, and regulatory integrity of your digital site files (including Maintenance Certificates (COM) and technical logs), this property is maintained via a Managed Subscription Service. Active status is required to maintain the validity of your digital registry and the site's live compliance health score.
               </p>
            </div>

            <p className="text-sm leading-relaxed text-slate-700">
              We remain committed to providing your property with the highest standard of technical oversight. Your dedicated Site Portal credentials will follow in the accompanying Welcome Pack.
            </p>

            <div className="pt-8">
              <p className="text-sm font-bold">Yours in Regulatory Compliance,</p>
              <div className="h-24 w-64 border-b border-slate-300 mb-2 mt-4 flex items-center justify-center overflow-hidden">
                {managerSignature ? (
                  <img src={managerSignature} className="max-h-full max-w-full object-contain" alt="Manager Signature" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                ) : managerTypedName ? (
                  <span className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic font-serif">
                    {managerTypedName}
                  </span>
                ) : (
                  <span className="italic text-slate-200 uppercase font-black text-[10px]">Authorized Certification Signature</span>
                )}
              </div>
              <p className="text-sm font-black uppercase tracking-tight">The Executive Management Team</p>
              <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">Precision Fire Services (Pty) Ltd</p>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Headquarters: Roodepoort, South Africa</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">Accredited SANS 1475 Permit Holder</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-slate-900 leading-none">010 035 5246</p>
              <p className="text-[8px] text-slate-300 font-black uppercase mt-1">DOC-V7.0-CORP</p>
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

export default IntroductionLetter;