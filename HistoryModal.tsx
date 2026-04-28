
import React, { useMemo, useState, useRef } from 'react';
import { Client, Equipment, InspectionRecord, TaskType, EquipmentType, Technician } from '../types';
import { SACAS_PERMIT_NUMBER } from '../constants';
import { BrandLogo } from './Brand';
import { getProxiedImageUrl } from '../services/registryService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface FlowCertificateProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  activeTech?: Technician | null;
  onBack: () => void;
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr || 'N/A';
  }
};

const FlowCertificate: React.FC<FlowCertificateProps> = ({ client, equipment, records, activeTech, onBack }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => window.print();

  const managerTypedName = localStorage.getItem('pfs_manager_typed_name');
  const managerSignature = getProxiedImageUrl(localStorage.getItem('pfs_manager_signature') || '');

  const flowTestData = useMemo(() => {
    return equipment
      .filter(item => item.type === EquipmentType.HOSE_REEL || item.type === EquipmentType.HYDRANT)
      .map(item => {
        const flowRecord = records
          .filter(r => r.equipmentId === item.id && r.taskType === TaskType.FLOW_TEST)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        
        return {
          item,
          record: flowRecord
        };
      });
  }, [equipment, records]);

  const isSiteFailed = useMemo(() => {
    return flowTestData.some(td => {
      if (!td.record) return true;
      const status = td.record.status.toLowerCase();
      return status === 'fail' || 
             status === 'service required' ||
             (td.record.calculatedFlowLpm && parseFloat(td.record.calculatedFlowLpm) < 24) || 
             td.record.flow_pressure_kpa === '0';
    });
  }, [flowTestData]);

  const averageHoseReelFlow = useMemo(() => {
    const testedUnits = flowTestData.filter(td => td.record && td.item.type === EquipmentType.HOSE_REEL);
    if (testedUnits.length === 0) return '0.0';
    const totalFlow = testedUnits.reduce((acc, td) => {
      const flow = parseFloat(td.record?.calculatedFlowLpm || '0');
      return acc + flow;
    }, 0);
    return (totalFlow / testedUnits.length).toFixed(1);
  }, [flowTestData]);

  const averageHydrantFlow = useMemo(() => {
    const testedUnits = flowTestData.filter(td => td.record && td.item.type === EquipmentType.HYDRANT);
    if (testedUnits.length === 0) return '0.0';
    const totalFlow = testedUnits.reduce((acc, td) => {
      const flow = parseFloat(td.record?.calculatedFlowLpm || '0');
      return acc + flow;
    }, 0);
    return (totalFlow / testedUnits.length).toFixed(1);
  }, [flowTestData]);

  const hasNoWater = useMemo(() => {
    return flowTestData.some(td => td.record?.flow_pressure_kpa === '0');
  }, [flowTestData]);

  const hasLowWater = useMemo(() => {
    return flowTestData.some(td => {
      if (!td.record?.flow_pressure_kpa) return false;
      const pressure = parseFloat(td.record.flow_pressure_kpa);
      return pressure > 0 && pressure < 100;
    });
  }, [flowTestData]);

  const isLowNoWater = hasNoWater || hasLowWater;

  const latestTestDate = useMemo(() => {
    const dates = records
      .filter(r => r.taskType === TaskType.FLOW_TEST && equipment.some(e => e.id === r.equipmentId))
      .map(r => new Date(r.date).getTime());
    return dates.length > 0 ? new Date(Math.max(...dates)).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  }, [records, equipment]);

  const primaryTech = useMemo(() => {
    if (activeTech) return activeTech;
    const record = records.find(r => r.taskType === TaskType.FLOW_TEST && equipment.some(e => e.id === r.equipmentId));
    return record ? { name: record.inspectorName, signature: record.inspectorSignature } : null;
  }, [records, equipment, activeTech]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 animate-in fade-in duration-500 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex justify-between items-center no-print bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
          <button onClick={onBack} className="text-slate-500 font-bold flex items-center gap-2 hover:text-slate-800 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Flow Matrix
          </button>
          <div className="flex gap-3">
            <button 
              onClick={async () => {
                if (!reportRef.current) return;
                setIsGeneratingPdf(true);
                await new Promise(r => setTimeout(r, 500));
                const pdf = new jsPDF('p', 'mm', 'a4', false);
                const canvas = await html2canvas(reportRef.current.querySelector('.report-page-flow') as HTMLElement, { 
                  scale: 3, 
                  useCORS: true, 
                  allowTaint: true, 
                  backgroundColor: '#ffffff', 
                  imageTimeout: 0,
                  windowWidth: 1200
                });
                const imgData = canvas.toDataURL('image/png');
                pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
                pdf.save(`${client.name}_Flow_Certificate.pdf`);
                setIsGeneratingPdf(false);
              }} 
              disabled={isGeneratingPdf} 
              className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all"
            >
              {isGeneratingPdf ? 'Generating...' : 'Export PDF'}
            </button>
            <button onClick={handlePrint} className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all flex items-center gap-2 active:scale-95">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Flow Cert
            </button>
          </div>
        </div>

        <div className="bg-white p-12 md:p-24 shadow-2xl relative overflow-hidden print:shadow-none border-[16px] border-slate-900 report-page-flow" ref={reportRef}>
           {/* HEADER */}
           <div className="flex justify-between items-end border-b-8 border-slate-900 pb-10 mb-12">
              <div className="flex items-center gap-8">
                 <BrandLogo className="w-24 h-24" />
                 <div className="space-y-1">
                    <h1 className="text-4xl font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                    <p className="text-[12px] text-red-600 font-black uppercase tracking-[0.4em]">Hydraulic Performance Certification</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pt-2">
                        PTY (LTD) • REG: 2014/139488/07 • SACAS: {SACAS_PERMIT_NUMBER}
                    </p>
                    <p className="text-[7px] font-bold text-slate-400 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
                 </div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Certificate Number</p>
                 <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter">FLOW-{client.id.toUpperCase().slice(0, 6)}</p>
                 <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Testing Date: {formatDate(latestTestDate)}</p>
              </div>
           </div>

           <div className="space-y-12">
              <div className="space-y-4">
                 <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Property Authorized</h2>
                 <div>
                    <h3 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">{client.name}</h3>
                    <p className="text-sm text-slate-500 font-black uppercase tracking-widest max-w-2xl">{client.address}</p>
                 </div>
              </div>

              <div className="bg-slate-50 p-10 rounded-[3rem] border border-slate-200 relative overflow-hidden">
                 <div className="relative z-10 space-y-6">
                    <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
                       <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                       </div>
                       <h4 className="text-xs font-black uppercase tracking-widest text-slate-900">Regulatory Flow Declaration</h4>
                    </div>
                    <p className="text-sm font-medium leading-relaxed italic text-slate-700">
                       The hydraulic equipment listed below has been subjected to standardized flow rate validation in accordance with <strong className="text-slate-900">SANS 1128 Parts 1 & 2</strong>. These tests verify the effective delivery of water medium at specified pressures to ensure operational readiness for firefighting intervention. Calculations account for pipe diameter variations between standard 19mm/25mm hose reels and 65mm hydrant valves.
                    </p>
                 </div>
              </div>

              <div className="space-y-6">
                 {hasNoWater && (
                    <div className="bg-red-700 text-white p-6 rounded-[2rem] border-4 border-red-900 shadow-xl animate-pulse">
                       <div className="flex items-center gap-4">
                          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          <div>
                             <p className="text-lg font-black uppercase tracking-tight">Critical Warning: No Water Detected</p>
                             <p className="text-[10px] font-bold uppercase opacity-80">Zero pressure recorded at outlets. Client must log an urgent call with the Water Board immediately to restore fire protection supply.</p>
                          </div>
                       </div>
                    </div>
                 )}
                 <div className="py-16 border-y-4 border-slate-900 my-8 bg-slate-50 rounded-[3rem] p-12 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                       <BrandLogo className="w-48 h-48" />
                    </div>
                    <div className="relative z-10 space-y-8">
                       <h3 className="text-2xl font-black text-slate-900 uppercase tracking-[0.3em]">Certificate of Performance</h3>
                       <div className="space-y-6">
                          <p className="text-lg font-medium text-slate-700 leading-relaxed">
                             This document serves as official verification that <span className="font-black text-slate-900 underline decoration-red-600 decoration-4 underline-offset-4">{flowTestData.filter(td => td.record).length}</span> fire protection units at <span className="font-black text-slate-900">{client.name}</span> have undergone hydraulic flow testing.
                          </p>
                          
                          <div className="flex flex-col items-center justify-center gap-4 py-8">
                             <div className={`text-6xl font-black uppercase tracking-tighter ${isSiteFailed ? 'text-red-700' : 'text-emerald-700'}`}>
                                {isSiteFailed ? 'Flow Test Failed' : 'Flow Test Passed'}
                             </div>
                             <div className={`h-2 w-48 rounded-full ${isSiteFailed ? 'bg-red-600' : 'bg-emerald-600'}`} />
                             <div className="mt-4 flex gap-12 justify-center">
                                <div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Avg Hose Reel Flow</p>
                                   <p className="text-4xl font-black text-slate-900">{averageHoseReelFlow} L/min</p>
                                </div>
                                <div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Avg Hydrant Flow</p>
                                   <p className="text-4xl font-black text-slate-900">{averageHydrantFlow} L/min</p>
                                </div>
                             </div>
                          </div>

                          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed max-w-2xl mx-auto">
                             {isSiteFailed 
                               ? "One or more units failed to meet the minimum regulatory flow requirements. Immediate remedial action is required to ensure site safety compliance."
                               : "All tested units met or exceeded the minimum regulatory flow requirements as per SANS 1128 specifications."}
                          </p>
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-end">
                 <div className="space-y-6">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorised Maintenance Signature</p>
                    <div className="h-28 flex items-center justify-center border-b-4 border-slate-900 relative bg-slate-50 rounded-t-3xl overflow-hidden">
                       {primaryTech?.signature ? (
                         <img src={primaryTech.signature} className="max-h-full opacity-90 scale-125 mix-blend-multiply transition-transform hover:scale-150 duration-500 block mx-auto" alt="Tech Signature" crossOrigin={primaryTech.signature.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />
                       ) : (
                         <p className="text-[10px] font-black text-slate-300 uppercase italic">Digital Authentication Recorded</p>
                       )}
                    </div>
                    <div>
                       <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{primaryTech?.name || 'Authorized Technician'}</p>
                       <p className="text-[8px] font-black text-red-600 uppercase tracking-[0.4em] mt-2">Authorised Maintenance Provider</p>
                    </div>
                 </div>
                 
                 <div className="flex flex-col items-center justify-center space-y-6">
                    <div className={`relative w-40 h-40 rounded-full border-4 flex flex-col items-center justify-center text-center shadow-lg transform rotate-[-12deg] ${isSiteFailed ? 'border-red-600 bg-white' : 'border-amber-500 bg-amber-50'}`}>
                      <div className={`text-[9px] font-black uppercase leading-none mb-1 ${isSiteFailed ? 'text-red-600' : 'text-amber-700'}`}>Official SANS</div>
                      <div className={`text-[15px] font-black uppercase leading-tight ${isSiteFailed ? 'text-red-700' : 'text-amber-800'}`}>
                        {isSiteFailed ? 'NON COMPLIANT' : 'GOLD CERTIFIED'}
                      </div>
                      <div className={`text-[8px] font-bold uppercase mt-1 ${isSiteFailed ? 'text-red-500' : 'text-amber-600'}`}>FLOW VERIFIED</div>
                      <div className={`absolute inset-0 border-2 rounded-full m-1.5 opacity-40 ${isSiteFailed ? 'border-red-400' : 'border-amber-400'}`} />
                    </div>
                    <div className="text-right">
                       <p className="text-[14px] font-black text-slate-900 uppercase tracking-widest leading-none">PRECISION FIRE SERVICES</p>
                       <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-2">Office: 010 035 5246 • Cell: 078 173 7245 • info@precisionfireservices.co.za</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .report-page-flow { 
             width: 210mm; min-height: 297mm; margin: 0 auto; border: none !important; box-shadow: none !important; border-radius: 0 !important;
             padding: 15mm !important; display: flex; flex-direction: column;
          }
          @page { size: portrait; margin: 0; }
        }
      `}</style>
    </div>
  );
};

export default FlowCertificate;
