
import React from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Technician } from '../types';
import { BrandLogo } from './Brand';

interface TechBadgeModalProps {
  technician: Technician;
  onClose: () => void;
}

const TechBadgeModal: React.FC<TechBadgeModalProps> = ({ technician, onClose }) => {
  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 no-print">
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Technician ID Badge</h3>
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mt-1">SAQCC Verification Portal</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-10 space-y-10">
          {/* Badge Preview */}
          <div className="flex justify-center">
            <div className="w-64 h-[400px] bg-slate-900 rounded-[2.5rem] p-6 flex flex-col items-center text-center shadow-2xl relative border-4 border-white/10 overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-red-600" />
               <div className="mt-4 mb-6">
                  <BrandLogo className="w-12 h-12" glow />
               </div>
               
               <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center text-3xl font-black text-slate-900 mb-4 shadow-xl border-4 border-slate-800">
                  {technician.name.charAt(0)}
               </div>

               <div className="space-y-1 mb-6">
                  <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none">{technician.name}</h4>
                  <p className="text-red-500 font-black uppercase tracking-[0.2em] text-[8px]">SAQCC Registered Tech</p>
               </div>

               <div className="bg-white p-3 rounded-2xl shadow-lg mb-4">
                  <QRCodeSVG value={`PFST-${technician.id}`} size={120} level="H" includeMargin={true} />
               </div>

               <div className="mt-auto pt-4 border-t border-white/5 w-full">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Registration No.</p>
                  <p className="text-sm font-black text-white">{technician.saqcc}</p>
               </div>
            </div>
          </div>

          <div className="flex gap-3">
             <button 
              onClick={handlePrint}
              className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
               Print Badge
             </button>
             <button 
              onClick={onClose}
              className="flex-1 bg-slate-100 text-slate-400 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-[10px]"
             >
               Close
             </button>
          </div>
        </div>
      </div>

      {/* Print-Only ID Badge Card */}
      <div className="print-only fixed inset-0 bg-white z-[2000]">
         <div className="flex items-center justify-center h-screen">
            <div className="w-[54mm] h-[86mm] border-[2px] border-slate-900 rounded-[12px] p-4 flex flex-col items-center text-center relative overflow-hidden bg-slate-900 text-white">
               <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
               <div className="mt-4 mb-4">
                  <BrandLogo className="w-10 h-10" />
               </div>
               
               <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-2xl font-black text-slate-900 mb-3 border-[3px] border-slate-700">
                  {technician.name.charAt(0)}
               </div>

               <div className="space-y-1 mb-4">
                  <h4 className="text-[12px] font-black uppercase tracking-tight leading-none">{technician.name}</h4>
                  <p className="text-red-500 font-black uppercase tracking-widest text-[6px]">SAQCC REGISTERED</p>
               </div>

               <div className="bg-white p-2 rounded-lg mb-3">
                  <QRCodeCanvas value={`PFST-${technician.id}`} size={100} level="H" includeMargin={true} />
               </div>

               <div className="mt-auto pt-2 border-t border-white/10 w-full">
                  <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Technician Reg No.</p>
                  <p className="text-[10px] font-black text-white">{technician.saqcc}</p>
                  <p className="text-[5px] font-bold text-slate-500 uppercase mt-4">Precision Fire Services (Pty) Ltd</p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default TechBadgeModal;
