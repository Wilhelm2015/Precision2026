import React, { useMemo } from 'react';
import { Client } from '../types';
import { SACAS_PERMIT_NUMBER } from '../constants';
import { BrandLogo } from './Brand';

interface ComplianceReminderLetterProps {
  client: Client;
  records: any[];
  onBack: () => void;
}

const ComplianceReminderLetter: React.FC<ComplianceReminderLetterProps> = ({ client, records, onBack }) => {
  const handlePrint = () => window.print();
  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  const currentMonthName = new Date(finalizedDate).toLocaleString('en-ZA', { month: 'long' });

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 animate-in fade-in duration-500 font-sans no-print-bg">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="no-print flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:text-slate-900 transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Registry Hub
          </button>
          <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95">
            Print Compliance Alert
          </button>
        </div>

        <div className="bg-white p-16 md:p-24 shadow-2xl border-t-[16px] border-red-600 print:shadow-none print:border-none print:p-0">
          <div className="flex justify-between items-start border-b-2 border-red-50 pb-10 mb-12">
            <div className="flex items-center gap-6">
              <BrandLogo className="w-20 h-20" />
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em] mt-1">Regulatory Compliance Node</p>
                <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                  Reg: 2014/139488/07 • SACAS: {SACAS_PERMIT_NUMBER}
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="bg-red-600 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-[0.2em]">Compliance Overdue</span>
            </div>
          </div>

          <div className="space-y-10 text-slate-800">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(finalizedDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <h2 className="text-xl font-black uppercase tracking-tight">Attention: Safety Compliance Officer</h2>
              <p className="text-lg font-black text-slate-900 uppercase">{client.name}</p>
            </div>

            <h3 className="text-2xl font-black text-red-600 uppercase tracking-tight leading-tight">Formal Notice: Mandatory Monthly Inspection Window Breached</h3>
            
            <p className="text-sm leading-relaxed font-bold">
              Our Digital SANS Registry indicates that the mandatory fire equipment inspection for <span className="underline">{currentMonthName}</span> has not yet been performed for your property.
            </p>

            <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100 space-y-6">
              <p className="text-xs text-slate-600 leading-relaxed">
                As per your Service Level Agreement and SANS 10105-1 safety protocols, monthly internal audits must be completed and logged within the <strong>first 7 days of the month</strong>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="p-6 bg-white rounded-3xl border border-red-100 shadow-sm space-y-3">
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Inspection Status</p>
                    <p className="text-xl font-black text-slate-900 uppercase">OVERDUE</p>
                 </div>
                 <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mandatory Cut-off</p>
                    <p className="text-xl font-black text-slate-900 uppercase">7th of {currentMonthName}</p>
                 </div>
              </div>
            </div>

            <div className="space-y-4">
               <h4 className="text-xs font-black uppercase tracking-widest text-slate-900 underline decoration-red-500 decoration-2">Risk Implications:</h4>
               <ul className="space-y-3">
                  {[
                    "Insurance validity may be impacted due to missed regulatory audits.",
                    "Site compliance score has been automatically adjusted to 'Critical'.",
                    "Asset lifecycle tracking for hydrostatic testing is currently non-verified.",
                    "Fire Marshal inspection readiness is now at risk."
                  ].map((risk, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs font-bold text-slate-600">
                      <div className="w-1.5 h-1.5 bg-red-600 rounded-full mt-1.5 shrink-0" />
                      {risk}
                    </li>
                  ))}
               </ul>
            </div>

            <div className="p-8 bg-red-600 rounded-[2rem] text-white space-y-4 shadow-xl">
               <h4 className="text-xs font-black uppercase tracking-widest">Required Action:</h4>
               <p className="text-sm leading-relaxed font-black uppercase tracking-tight">
                 Please scan your site QR tags immediately to perform the {currentMonthName} audit. 
               </p>
               <p className="text-[11px] opacity-80 leading-relaxed font-medium">
                 Your Site Portal PIN (<span className="font-black underline">{client.portalPin}</span>) remains active. Log into the portal to review specific equipment that requires immediate visual inspection.
               </p>
            </div>

            <div className="pt-8">
              <p className="text-sm font-bold">Registry Compliance Office,</p>
              <div className="h-16 w-48 border-b-2 border-red-600 mb-2 mt-4 flex items-center justify-center italic text-slate-200 uppercase font-black text-[10px]">
                Compliance Alert Issued
              </div>
              <p className="text-sm font-black uppercase tracking-tight">Precision Fire Services</p>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-end">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Precision Fire Services (Pty) Ltd</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
            </div>
            <div className="text-right">
              <p className="text-[14px] font-black text-red-600 leading-none">078 173 7245</p>
              <p className="text-[8px] text-slate-300 font-black uppercase mt-1">SANS-OVERDUE-V2.0</p>
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

export default ComplianceReminderLetter;