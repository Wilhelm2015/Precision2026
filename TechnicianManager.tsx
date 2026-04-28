import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Client, Equipment, InspectionRecord, TaskType, Technician } from '../types';
import { SACAS_PERMIT_NUMBER } from '../constants';
import { BrandLogo } from './Brand';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface TechnicalLedgerGeneratorProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  mode: 'PRESSURE_TEST' | 'RECHARGE';
  onBack: () => void;
  onIssue?: () => void;
  selectedYear?: number;
  activeTech?: Technician | null;
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr || 'N/A';
  }
};

const CompanyFooter = () => (
  <div className="w-full pt-4 border-t flex justify-between items-end shrink-0 mt-8">
    <div className="space-y-1">
      <p className="text-[10px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
      <p className="text-[8px] font-bold text-slate-500 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
      <p className="text-[8px] font-black text-red-600 uppercase tracking-widest">Office: 010 035 5246 • Emergency: 078 173 7245</p>
    </div>
    <div className="text-right">
      <p className="text-[8px] font-black text-slate-300 uppercase tracking-[0.4em]">Digital SANS Registry Node</p>
    </div>
  </div>
);

const TechnicalLedgerGenerator: React.FC<TechnicalLedgerGeneratorProps> = ({ client, equipment, records, mode, onBack, onIssue, selectedYear, activeTech }) => {
  const [isIssuing, setIsIssuing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [issueSuccess, setIssueSuccess] = useState(false);
  const [precompiledPdf, setPrecompiledPdf] = useState<jsPDF | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const ledgerRef = useRef<HTMLDivElement>(null);
  const isPT = mode === 'PRESSURE_TEST';

  const filteredRecords = useMemo(() => {
    return records;
  }, [records]);

  const ledgerData = useMemo(() => {
    // Filter out equipment that has been discarded
    const activeEquipment = equipment.filter(e => {
      const assetRecords = records.filter(r => r.equipmentId === e.id);
      const latest = [...assetRecords].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        if (b.taskType === TaskType.DISCARD) return 1;
        if (a.taskType === TaskType.DISCARD) return -1;
        return String(b.id || '').localeCompare(String(a.id || ''));
      })[0];
      
      return !(latest?.status === 'Discarded' || latest?.taskType === TaskType.DISCARD);
    });

    return activeEquipment.map(item => {
      const taskType = isPT ? TaskType.PRESSURE_TEST : TaskType.RECHARGE;
      const relevantRecords = filteredRecords
        .filter(r => r.equipmentId === item.id && r.taskType === taskType)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const latestRecord = relevantRecords[0];

      let secondaryDate = 'N/A';
      if (latestRecord) {
        if (isPT) {
           const d = new Date(latestRecord.date);
           d.setFullYear(d.getFullYear() + 5);
           secondaryDate = d.toISOString().split('T')[0];
        } else {
           secondaryDate = item.nextServiceDate || 'N/A';
        }
      }

      return {
        item,
        lastDate: latestRecord?.date || 'N/A',
        nextDate: secondaryDate,
        status: latestRecord?.status || 'Pending',
        signature: latestRecord?.inspectorSignature,
        techName: latestRecord?.inspectorName,
        testedToKpa: latestRecord?.testedToKpa || latestRecord?.flow_pressure_kpa,
        sealSerialNumber: latestRecord?.sealSerialNumber || '---',
        notes: latestRecord?.notes
      };
    });
  }, [equipment, records, isPT]);

  const ledgerChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < ledgerData.length; i += 35) {
      chunks.push(ledgerData.slice(i, i + 35));
    }
    return chunks;
  }, [ledgerData]);

  const isSiteFailed = useMemo(() => {
    return ledgerData.some(d => d.status !== 'Pass');
  }, [ledgerData]);

  const handleIssueReport = async () => {
    setIsIssuing(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsIssuing(false);
    setIssueSuccess(true);
    if (onIssue) onIssue();
    setTimeout(() => setIssueSuccess(false), 3000);
  };

  const handleEmailWithAttachment = async () => {
    setIsSharing(true);
    const typeLabel = isPT ? 'Pressure Test Ledger' : 'Recharge Protocol Log';
    try {
      const title = `${typeLabel} - ${client.name}`;
      const text = `Dear Client,\n\nPlease find the attached official ${typeLabel} for fire equipment maintained at ${client.name}.\n\nRecords processed: ${ledgerData.length}`;
      
      if (navigator.share) {
        await navigator.share({
          title: title,
          text: text,
          url: window.location.href
        });
      } else {
        window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + "\n\nLink: " + window.location.href)}`;
      }
    } catch (err) {
      console.error("Ledger sharing failed", err);
    } finally {
      setIsSharing(false);
    }
  };

  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  const handlePrint = async () => {
    if (precompiledPdf) {
      precompiledPdf.save(`${client.name}_${isPT ? 'Pressure_Test' : 'Recharge'}_Ledger.pdf`);
    } else {
      setIsCompiling(true);
      await compileLedger();
      setIsCompiling(false);
    }
  };

  const compileLedger = async () => {
    if (!ledgerRef.current) return;
    try {
      const pdf = new jsPDF('p', 'mm', 'a4', false);
      const pages = ledgerRef.current.querySelectorAll('.report-page');
      
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        
        await pdf.html(pages[i] as HTMLElement, {
            x: 0,
            y: 0,
            width: 210,
            windowWidth: 1200,
            margin: 0
        });
      }
      setPrecompiledPdf(pdf);
      return pdf;
    } catch (err) {
      console.error("Background compilation failed", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      compileLedger();
    }, 2000); // Wait 2 seconds for everything to settle before background compile
    return () => clearTimeout(timer);
  }, [ledgerData]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 animate-in fade-in duration-500 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center no-print bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Back to Hub
          </button>
          <div className="flex gap-3">
             <button onClick={handleEmailWithAttachment} disabled={isSharing} className="bg-slate-100 text-slate-700 px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                {isSharing ? 'Preparing...' : 'Email'}
             </button>
             <button disabled={isIssuing} onClick={handleIssueReport} className={`px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${issueSuccess ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}>
               {isIssuing ? 'Saving...' : issueSuccess ? 'Registry Updated' : 'Authorize & Save'}
             </button>
             <button onClick={handlePrint} className={`text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all ${isPT ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
               {isCompiling ? 'Compiling...' : precompiledPdf ? 'Download PDF' : 'Print PDF'}
             </button>
          </div>
        </div>

        <div ref={ledgerRef} className="space-y-8">
          {ledgerChunks.map((chunk, chunkIdx) => (
            <div key={chunkIdx} className="bg-white p-6 shadow-2xl border border-slate-200 print:shadow-none print:border-none relative overflow-hidden flex flex-col h-[297mm] w-[210mm] mx-auto report-page">
              <div className={`border-b-4 pb-2 mb-2 flex justify-between items-end ${isPT ? 'border-amber-600' : 'border-blue-600'}`}>
                 <div className="flex items-center gap-4">
                    <BrandLogo className="w-10 h-10" />
                    <div>
                       <h1 className="text-lg font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                       <p className="text-[7px] font-black text-red-600 uppercase tracking-[0.4em] mt-0.5">PTY (LTD) • REG: 2014/139488/07 • SACAS: {SACAS_PERMIT_NUMBER}</p>
                       <div className="text-[5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</div>
                       <p className={`text-[9px] font-black uppercase tracking-widest mt-1 ${isPT ? 'text-amber-600' : 'text-blue-600'}`}>
                          {isPT 
                            ? (ledgerData.some(d => (d.item.manufacturer || '').toLowerCase().includes('co2') || (d.item.size || '').toLowerCase().includes('co2')) 
                              ? 'SANS 1475 Hydrostatic Validation Registry' 
                              : 'SANS 1475 Pressure Test Validation Registry')
                            : 'Medium Replenishment & Recharge Log'}
                       </p>
                    </div>
                 </div>
                 <div className="text-right">
                    <h2 className="text-xl font-black uppercase tracking-tighter leading-none mb-1">{client.name}</h2>
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest max-w-sm truncate">{client.address}</p>
                    {(() => {
                      const techName = (activeTech?.name && activeTech.name !== 'Precision Management') ? activeTech.name : null;
                      if (!techName) return null;
                      return (
                        <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest mt-1">
                          Technician: {techName} | {new Date(finalizedDate).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      );
                    })()}
                    <p className="mt-1 text-[6px] font-black text-slate-900 uppercase">Registry Update: {new Date(finalizedDate).toLocaleDateString('en-ZA')} • Page {chunkIdx + 1} of {ledgerChunks.length}</p>
                 </div>
              </div>

              <div className="overflow-x-auto flex-1">
                 <table className="w-full text-left border-collapse">
                    <thead>
                       <tr className="bg-slate-50 border-y border-slate-100">
                          <th className="px-2 py-1 text-[7px] font-black text-slate-900 uppercase tracking-widest">Asset SN</th>
                          <th className="px-2 py-1 text-[7px] font-black text-slate-900 uppercase tracking-widest">Seal SN</th>
                          <th className="px-2 py-1 text-[7px] font-black text-slate-900 uppercase tracking-widest">Equipment Class</th>
                          <th className="px-2 py-1 text-[7px] font-black text-slate-900 uppercase tracking-widest text-center">
                            {isPT ? 'Hydro Test Date' : 'Recharge Date'}
                          </th>
                          {isPT && (
                            <th className="px-2 py-1 text-[7px] font-black text-slate-900 uppercase tracking-widest text-center">kPa Tested</th>
                          )}
                          <th className="px-2 py-1 text-[7px] font-black text-slate-900 uppercase tracking-widest text-center">
                            {isPT ? 'Next Hydro Due (5yr)' : 'Next Annual Maintenance'}
                          </th>
                          <th className="px-2 py-1 text-[7px] font-black text-slate-900 uppercase tracking-widest text-right">Registry Status</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {chunk.map(({ item, lastDate, nextDate, status, testedToKpa, sealSerialNumber, notes }, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                             <td className="px-2 py-0.5 text-[8px] font-black text-slate-900 uppercase tracking-tight">{item.serialNumber}</td>
                             <td className="px-2 py-0.5 text-[8px] font-black text-blue-600 uppercase tracking-tight">{sealSerialNumber || '---'}</td>
                             <td className="px-2 py-0.5">
                                <div className="text-[7px] font-bold text-slate-600 uppercase leading-none">{item.type}</div>
                                <div className="text-[6px] text-slate-400 font-bold uppercase">{item.size || 'N/A'}</div>
                             </td>
                             <td className="px-2 py-0.5 text-center font-bold text-slate-800 text-[8px] leading-none">
                                {lastDate === 'N/A' ? <span className="text-slate-300">PENDING</span> : formatDate(lastDate)}
                             </td>
                             {isPT && (
                                <td className="px-2 py-0.5 text-center font-black text-amber-600 text-[8px] uppercase leading-none">
                                   {testedToKpa || '0'}
                                </td>
                             )}
                             <td className="px-2 py-0.5 text-center font-black text-slate-900 text-[8px] uppercase leading-none">
                                {nextDate === 'N/A' ? <span className="text-slate-300">PENDING</span> : formatDate(nextDate)}
                             </td>
                             <td className="px-2 py-0.5 text-right leading-none">
                                {status === 'Condemned' || status === 'Discarded' ? (
                                  <span className="text-[6px] font-black px-1 py-0 rounded uppercase bg-red-100 text-red-700 border border-red-200">
                                    (Discarded)
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className="text-[6px] font-black px-1 py-0 rounded uppercase bg-blue-100 text-blue-700 border border-blue-200">
                                      (not discarded)
                                    </span>
                                    {notes && <span className="text-[5px] text-slate-500 italic mt-0.5 max-w-[80px] truncate">{notes}</span>}
                                  </div>
                                )}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              {chunkIdx === ledgerChunks.length - 1 && (
                <div className="mt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1 p-2 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner">
                      <h4 className="text-[7px] font-black text-slate-400 uppercase tracking-widest">SANS Regulatory Compliance Note</h4>
                      <p className="text-[8px] text-slate-600 leading-relaxed font-medium">
                        {isPT 
                          ? "SANS 1475-1 requires pressure validation of fire extinguishers every 5 years. This ledger tracks the validation of vessel structural integrity."
                          : "Recharge services are mandatory after any discharge or during specialized 5/10 year maintenance. This log confirms replenishment of medium."
                        }
                      </p>
                   </div>
                   
                   <div className="flex flex-col items-center justify-center space-y-1">
                      <div className={`relative w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center text-center shadow-lg transform rotate-[-12deg] ${isSiteFailed ? 'border-red-600 bg-white' : 'border-amber-500 bg-amber-50'}`}>
                        <div className={`text-[4px] font-black uppercase leading-none mb-0.5 ${isSiteFailed ? 'text-red-600' : 'text-amber-700'}`}>Official SANS</div>
                        <div className={`text-[7px] font-black uppercase leading-tight ${isSiteFailed ? 'text-red-700' : 'text-amber-800'}`}>
                          {isSiteFailed ? 'NON COMPLIANT' : 'COMPLIANT'}
                        </div>
                        <div className={`absolute inset-0 border rounded-full m-0.5 opacity-40 ${isSiteFailed ? 'border-red-400' : 'border-amber-400'}`} />
                      </div>
                      <div className="text-right">
                         <BrandLogo className="w-6 h-6 mb-0.5 ml-auto grayscale opacity-40" />
                         <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Precision Fire Services</p>
                      </div>
                   </div>
                </div>
              )}
              
              <CompanyFooter />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TechnicalLedgerGenerator;