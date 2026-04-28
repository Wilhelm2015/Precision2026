import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Client, Equipment, InspectionRecord, FaultReport, Technician } from '../types';
import { COMPANY_LOGO_URL, SACAS_PERMIT_NUMBER } from '../constants';
import { getProxiedImageUrl } from '../services/registryService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { calculateSiteStats } from '../src/lib/scoring';

interface QuoteItem {
  id: string;
  description: string;
  size?: string;
  type: 'maintenance' | 'replacement' | 'recharge' | 'signage' | 'other';
  quantity: number;
}

interface SiteAssessmentReportGeneratorProps {
  client: Client;
  items: QuoteItem[];
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  technicians: Technician[];
  onBack: () => void;
  activeTech?: any;
  branding?: any[];
}

const ReportLogo = ({ type, className, branding = [] }: { type: 'company' | 'saqcc' | 'sacas', className?: string, branding?: any[] }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const keys = { company: 'pfs_custom_logo', saqcc: 'pfs_custom_saqcc', sacas: 'pfs_custom_sacas' };
    const dist = localStorage.getItem(`pfs_dist_${type}`) || 'both';
    const canShow = dist === 'audit' || dist === 'both';
    
    // Check cloud branding first
    const cloudLogo = branding.find(b => b.id === keys[type])?.content;
    const stored = cloudLogo || localStorage.getItem(keys[type]);

    if (canShow) {
      if (stored) { setSrc(getProxiedImageUrl(stored)); setIsVisible(true); }
      else if (type === 'company') { setSrc(COMPANY_LOGO_URL); setIsVisible(true); }
      else { setIsVisible(false); }
    } else { setIsVisible(false); }
  }, [type, branding]);

  if (!isVisible) return null;
  return <img src={src!} className={`${className} object-contain`} alt={`${type} logo`} crossOrigin="anonymous" referrerPolicy="no-referrer" />;
};

const CompanyFooter = ({ branding = [] }: { branding?: any[] }) => (
  <div className="w-full pt-2 border-t flex justify-between items-end shrink-0">
    <div className="space-y-0.5 text-left">
      <p className="text-[9px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
      <p className="text-[7px] font-bold text-slate-500 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
      <p className="text-[7px] font-black text-red-600 uppercase tracking-widest">Office: 010 035 5246 • Emergency: 078 173 7245</p>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex gap-2 items-center">
        <ReportLogo type="saqcc" className="w-[40px] h-[30px]" branding={branding} />
        <ReportLogo type="sacas" className="w-[40px] h-[30px]" branding={branding} />
      </div>
      <div className="text-right">
        <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">Digital SANS Registry Node</p>
      </div>
    </div>
  </div>
);

const SiteAssessmentReportGenerator: React.FC<SiteAssessmentReportGeneratorProps> = ({ 
  client, items, equipment, records, faults, technicians, onBack, activeTech, branding = [] 
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const handlePrint = () => window.print();

  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => {
      const dateA = a.created_at || a.date;
      const dateB = b.created_at || b.date;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    return sorted[0].created_at || sorted[0].date;
  }, [records]);

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPdf(true);
    
    const pdf = new jsPDF('p', 'mm', 'a4', false);
    
    await pdf.html(reportRef.current, {
        x: 0,
        y: 0,
        width: 210,
        windowWidth: 1200,
        margin: 0
    });
    
    pdf.save(`${client.name}_Site_Assessment.pdf`);
    setIsGeneratingPdf(false);
  };

  const complianceScore = React.useMemo(() => {
    const activeEquipment = equipment.filter(e => e.client_id === client.id && !e.isArchived);
    const stats = calculateSiteStats(activeEquipment, records, faults);
    return stats.finalPercentage;
  }, [client.id, equipment, records, faults]);

  const isCompliant = complianceScore === 100;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 animate-in fade-in duration-500 font-sans no-print-bg">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="no-print flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Hub
          </button>
          <div className="flex gap-3">
            <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all active:scale-95 disabled:opacity-50">
              {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95">
              Print Assessment Report
            </button>
          </div>
        </div>

        <div className="bg-white p-12 md:p-16 shadow-2xl rounded-[2.5rem] border border-slate-200 print:shadow-none print:border-none print:rounded-none relative overflow-hidden flex flex-col min-h-[297mm] assessment-report-page" ref={reportRef}>
          {/* Document Header */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-8 mb-10">
            <div className="flex items-center gap-6">
              <ReportLogo type="company" className="w-16 h-16" branding={branding} />
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mt-1">Site Assessment & Requirements</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Safety Compliance Division</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Assessment Report</h2>
              <div className="flex flex-col items-end gap-1 mt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date: {new Date(finalizedDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                {(() => {
                  const techName = (() => {
                    const creatorTech = technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management');
                    if (creatorTech) return creatorTech.name;
                    const latestRecord = records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                    const inspector = technicians.find(t => (t.name === latestRecord?.inspectorName || t.saqcc === latestRecord?.inspectorName) && t.name !== 'Precision Management');
                    if (inspector) return inspector.name;
                    if (activeTech?.name !== 'Precision Management') return activeTech?.name;
                    return null;
                  })();
                  if (!techName) return null;
                  return (
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">
                      Technician: {techName} | {new Date(finalizedDate).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
            <div className="space-y-2">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">Client / Site Identification</h3>
              <p className="text-2xl font-black text-slate-900 uppercase leading-tight">{client.name}</p>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{client.address}</p>
            </div>
            <div className="bg-slate-900 text-white p-6 rounded-3xl flex justify-between items-center shadow-xl">
               <div>
                  <p className="text-[8px] font-black text-red-500 uppercase tracking-widest mb-1">Assessment Summary</p>
                  <p className="text-3xl font-black">{items.length} Items</p>
               </div>
               <div className="text-center px-4 border-x border-slate-800">
                  <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Compliance Score</p>
                  <p className={`text-3xl font-black ${complianceScore < 100 ? 'text-red-500' : 'text-emerald-500'}`}>{complianceScore}%</p>
                  <p className={`text-[7px] font-black uppercase tracking-widest mt-1 ${isCompliant ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isCompliant ? 'Compliant' : 'Non-Compliant'}
                  </p>
               </div>
               <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Quantity</p>
                  <p className="text-xl font-black">{items.reduce((acc, item) => acc + item.quantity, 0)} Units</p>
               </div>
            </div>
          </div>

          {/* Assessment Ledger */}
          <div className="space-y-6 flex-1">
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] border-b-2 border-slate-100 pb-2">Required Actions & Equipment Matrix</h3>
            
            <div className="overflow-hidden rounded-3xl border border-slate-100">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Type</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Description</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest">Size</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="break-inside-avoid">
                      <td className="px-6 py-4">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                          item.type === 'maintenance' ? 'bg-blue-50 text-blue-600' :
                          item.type === 'replacement' ? 'bg-emerald-50 text-emerald-600' :
                          item.type === 'recharge' ? 'bg-amber-50 text-amber-600' :
                          item.type === 'signage' ? 'bg-purple-50 text-purple-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">{item.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.size || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="bg-slate-100 px-3 py-1 rounded-lg font-black text-slate-900 text-xs">{item.quantity}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer */}
          <CompanyFooter branding={branding} />
        </div>
      </div>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          @page { margin: 10mm; size: A4 portrait; }
        }
      `}</style>
    </div>
  );
};

export default SiteAssessmentReportGenerator;
