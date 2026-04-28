import React, { useState } from 'react';
import { SANSCode, EquipmentType, AdvisorResponse, TaskType } from '../types';
import { geminiService } from '../services/geminiService';
import { EQUIPMENT_DEFINITIONS, FLASH_FIRE_WARNING } from '../constants';
import { BrandLogo } from './Brand';

type StandardTab = '1475-1' | '1475-2' | '10105-1' | '10400-T';

const SANSChecklistRef: React.FC = () => {
  const [activeTab, setActiveTab] = useState<StandardTab>('1475-1');
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<AdvisorResponse | null>(null);
  const [explainingItem, setExplainingItem] = useState<{label: string, text: string} | null>(null);

  const handleConsultAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await geminiService.getRegulationAdvice(query);
      setAiAdvice(res);
    } catch (err) {
      alert("Consultation failed. Check connection.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleExplainItem = async (asset: string, label: string, desc: string) => {
    setExplainingItem({ label, text: 'Consulting SANS Digital Node...' });
    try {
      const res = await geminiService.explainChecklistItem(asset, label, desc);
      setExplainingItem({ label, text: res.text });
    } catch (err) {
      setExplainingItem({ label, text: 'Unable to fetch technical guidance.' });
    }
  };

  const handlePrintFieldSheet = () => {
    window.print();
  };

  const ChecklistGrid = ({ items, title, code }: { items: any[], title: string, code: string }) => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4">
        <div>
           <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{title}</h3>
           <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.3em] mt-1">{code} Regulatory Checklist</p>
        </div>
        <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 hidden sm:block">
           <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Mandatory Frequency</p>
           <p className="text-[10px] font-black text-slate-900 uppercase">{code.includes('10105') ? 'Monthly' : 'Annual'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item, i) => (
          <div key={i} className="group bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex gap-4">
            <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 font-black text-[10px] shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.label}</h4>
                <button 
                  onClick={() => handleExplainItem(title, item.label, item.description)}
                  className="text-[7px] font-black text-slate-400 uppercase tracking-widest hover:text-red-600 transition-colors"
                >
                  Clause Info
                </button>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1.5">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const extinguisherItems = EQUIPMENT_DEFINITIONS.find(d => d.type === EquipmentType.EXTINGUISHER)?.checklists[TaskType.MAINTENANCE] || [];
  const waterItems = EQUIPMENT_DEFINITIONS.find(d => d.type === EquipmentType.HOSE_REEL)?.checklists[TaskType.MAINTENANCE] || [];
  const inspectionItems = EQUIPMENT_DEFINITIONS.find(d => d.type === EquipmentType.EXTINGUISHER)?.checklists[TaskType.INSPECTION] || [];

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-24">
      {/* Header Panel */}
      <div className="bg-slate-900 p-10 rounded-[3rem] text-white relative overflow-hidden shadow-2xl border-b-8 border-red-600 no-print">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500">Registry Source Code</span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tight leading-none">Regulatory Matrix</h2>
            <p className="text-slate-400 text-sm font-medium max-w-md">Precision Fire Services digitized technical handbook for South African National Standards compliance.</p>
          </div>
          
          <div className="w-full lg:w-96 space-y-4">
            <div className="bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-md">
               <form onSubmit={handleConsultAdvisor} className="space-y-3">
                  <label className="text-[9px] font-black uppercase text-slate-500 tracking-widest ml-1">SANS AI Technical Advisor</label>
                  <div className="relative">
                     <input 
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Ask about a SANS clause..." 
                      className="w-full bg-white/10 border border-white/20 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:border-red-500 transition-all placeholder:text-slate-600"
                     />
                     <button type="submit" disabled={isSearching} className="absolute right-1.5 top-1.5 h-9 w-9 bg-red-600 rounded-xl flex items-center justify-center hover:bg-red-700 transition-all active:scale-90">
                        {isSearching ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>}
                     </button>
                  </div>
               </form>
            </div>
            <button 
              onClick={handlePrintFieldSheet}
              className="w-full bg-white text-slate-900 font-black py-4 rounded-[1.5rem] uppercase tracking-widest text-[10px] shadow-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-3"
            >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
               Generate Field Audit Sheet
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24">
             <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.332 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
           </svg>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 no-print overflow-x-auto scrollbar-hide">
        {[
          { id: '1475-1', label: 'Portable Extinguishers', code: 'SANS 1475-1' },
          { id: '1475-2', label: 'Hose Reels & Hydrants', code: 'SANS 1475-2' },
          { id: '10105-1', label: 'Monthly Inspections', code: 'SANS 10105' },
          { id: '10400-T', label: 'Building Code', code: 'SANS 10400-T' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as StandardTab)}
            className={`px-8 py-5 font-black text-[10px] uppercase tracking-widest transition-all border-b-4 whitespace-nowrap ${
              activeTab === tab.id ? 'border-red-600 text-red-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label} <span className="block text-[7px] opacity-60 mt-1">{tab.code}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="space-y-12">
        {/* Advisor Response */}
        {aiAdvice && (
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border-2 border-red-100 animate-in slide-in-from-top-4 duration-500 space-y-6 no-print">
             <div className="flex items-center justify-between border-b-2 border-red-50 pb-4">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-red-600 text-white rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                   </div>
                   <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">SANS Regulatory Opinion</h4>
                </div>
                <button onClick={() => setAiAdvice(null)} className="text-slate-300 hover:text-slate-900">&times;</button>
             </div>
             <p className="text-sm font-medium text-slate-700 leading-relaxed italic border-l-4 border-red-600 pl-6">"{aiAdvice.text}"</p>
             {aiAdvice.sources.length > 0 && (
               <div className="pt-4 flex flex-wrap gap-2">
                  <span className="text-[8px] font-black uppercase text-slate-400 mr-2">Grounding:</span>
                  {aiAdvice.sources.slice(0,3).map((s, i) => (
                     <a key={i} href={s.web?.uri} target="_blank" className="bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-[9px] font-bold text-slate-500 hover:text-red-600 transition-colors uppercase truncate max-w-[150px]">{s.web?.title}</a>
                  ))}
               </div>
             )}
          </div>
        )}

        {/* Explanation Overlay */}
        {explainingItem && (
           <div className="bg-slate-900 p-8 rounded-[2.5rem] border-l-8 border-emerald-500 animate-in zoom-in-95 duration-200 no-print">
              <div className="flex justify-between items-start mb-4">
                 <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest">Clause context: {explainingItem.label}</h4>
                 <button onClick={() => setExplainingItem(null)} className="text-white/40 hover:text-white text-xl">&times;</button>
              </div>
              <p className="text-sm font-medium text-slate-200 leading-relaxed">{explainingItem.text}</p>
           </div>
        )}

        {/* Main Matrix Content */}
        <div className="no-print">
          {activeTab === '1475-1' && <ChecklistGrid title="Extinguisher Maintenance" code="SANS 1475-1" items={extinguisherItems} />}
          {activeTab === '1475-2' && <ChecklistGrid title="Water Supply Units" code="SANS 1475-2" items={waterItems} />}
          {activeTab === '10105-1' && <ChecklistGrid title="Visual Site Audits" code="SANS 10105-1" items={inspectionItems} />}
          {activeTab === '10400-T' && (
            <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8 animate-in fade-in">
               <div className="border-b-2 border-slate-900 pb-4">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">National Building Regulations</h3>
                  <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.3em] mt-1">SANS 10400 Part T: Fire Protection</p>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                     <h4 className="text-xs font-black text-slate-900 uppercase">Occupancy Safety</h4>
                     <p className="text-xs text-slate-600 leading-relaxed">
                        Part T regulates the provision of firefighting equipment based on building occupancy type (e.g. A1, H3). It mandates the minimum travel distances to equipment and the specific height for mounting.
                     </p>
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-xs font-black text-slate-900 uppercase">Maintenance Mandate</h4>
                     <p className="text-xs text-slate-600 leading-relaxed">
                        Clause T4.43 explicitly states that all fire protection systems installed in a building must be maintained in accordance with the relevant SANS standard (1475, 10139, etc.) by a competent person.
                     </p>
                  </div>
               </div>
            </div>
          )}
        </div>

        {/* Prohibited Brands Alert */}
        <div className="bg-red-50 p-8 rounded-[3rem] border-4 border-red-600 border-dashed space-y-4 no-print">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div>
                 <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Regulatory Alert</h3>
                 <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Unauthorized Equipment Protocol</p>
              </div>
           </div>
           <p className="text-xs text-red-800 font-bold leading-relaxed">{FLASH_FIRE_WARNING}</p>
           <p className="text-[10px] text-red-600 italic">Vessels not bearing the SABS mark or an accredited equivalent certification must be condemned and removed from site registry immediately.</p>
        </div>
      </div>

      {/* PRINT-ONLY FIELD AUDIT SHEET */}
      <div className="hidden print:block print:p-0 print:m-0 bg-white">
        <div className="p-12 border-b-4 border-slate-900 flex justify-between items-end">
           <div className="flex items-center gap-6">
              <BrandLogo className="w-16 h-16" />
              <div>
                <h1 className="text-2xl font-black uppercase">Field Audit Sheet</h1>
                <p className="text-[10px] text-red-600 font-black uppercase">Precision Fire Services Technical Ledger</p>
              </div>
           </div>
           <div className="text-right">
              <p className="text-[8px] font-black text-slate-400 uppercase">SANS Code</p>
              <p className="text-sm font-black text-slate-900">{activeTab}</p>
           </div>
        </div>
        
        <div className="p-12 space-y-10">
           <div className="grid grid-cols-2 gap-10">
              <div className="border-b-2 border-slate-100 pb-2"><p className="text-[8px] font-black text-slate-400 uppercase">Client / Site Name</p><p className="h-6"></p></div>
              <div className="border-b-2 border-slate-100 pb-2"><p className="text-[8px] font-black text-slate-400 uppercase">Asset Serial Number</p><p className="h-6"></p></div>
           </div>

           <div className="space-y-4">
              <h4 className="text-xs font-black uppercase border-b-2 border-slate-900 pb-2">Technical Checklist (Pass/Fail)</h4>
              <div className="grid grid-cols-1 gap-4">
                 {(activeTab === '1475-1' ? extinguisherItems : activeTab === '1475-2' ? waterItems : inspectionItems).map((item, i) => (
                    <div key={i} className="flex items-center justify-between border-b py-3">
                       <div className="flex-1 pr-10">
                          <p className="text-[10px] font-black uppercase">{item.label}</p>
                          <p className="text-[8px] text-slate-400">{item.description}</p>
                       </div>
                       <div className="flex gap-4">
                          <div className="w-6 h-6 border-2 border-slate-900 rounded flex items-center justify-center text-[10px] font-black">P</div>
                          <div className="w-6 h-6 border-2 border-slate-900 rounded flex items-center justify-center text-[10px] font-black">F</div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           <div className="pt-10 grid grid-cols-2 gap-10">
              <div><p className="text-[8px] font-black text-slate-400 uppercase mb-4">Technician Signature</p><div className="h-16 border-b-2 border-slate-300"></div></div>
              <div><p className="text-[8px] font-black text-slate-400 uppercase mb-4">SAQCC Registration No.</p><div className="h-16 border-b-2 border-slate-300"></div></div>
           </div>
        </div>
        
        <div className="fixed bottom-10 left-12 right-12 flex justify-between items-end border-t pt-4">
           <p className="text-[7px] text-slate-400 uppercase font-black">Precision Fire Digital Node v2.5 • SANS Regulatory Integrity</p>
           <p className="text-[7px] text-slate-400 uppercase font-black">Ref: {new Date().toISOString()}</p>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .hidden { display: none !important; }
          .no-print { display: none !important; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
          @page { margin: 10mm; size: portrait; }
        }
      `}</style>
    </div>
  );
};

export default SANSChecklistRef;