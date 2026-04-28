import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Equipment } from '../types';
import { COMPANY_LOGO_URL } from '../constants';
import { getProxiedImageUrl } from '../services/registryService';
import { getAppBaseUrl } from '../utils';

interface SingleAssetLabelProps {
  equipment: Equipment;
  onClose: () => void;
}

const SingleAssetLabel: React.FC<SingleAssetLabelProps> = ({ equipment, onClose }) => {
  // Use a helper to safely get the logo
  const getLogo = () => {
    try {
      const stored = localStorage.getItem('pfs_custom_logo');
      if (stored) return getProxiedImageUrl(stored);
    } catch (e) {}
    return COMPANY_LOGO_URL;
  };

  const logoSrc = getLogo();

  const getPublicUrl = () => {
    return `${getAppBaseUrl()}/?code=${equipment.serialNumber}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[600] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
      
      {/* ON-SCREEN MODAL */}
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] no-print">
        <div className="bg-slate-900 p-6 md:p-8 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
            </button>
            <div>
              <h3 className="text-lg md:text-xl font-black uppercase tracking-tight">Identity Tag (40mm)</h3>
              <p className="text-[8px] md:text-[10px] text-red-500 font-black uppercase tracking-widest mt-1">SANS Registry Point</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 md:p-10 space-y-8 overflow-y-auto scrollbar-hide flex-1">
          <div className="flex flex-col items-center gap-6">
            {/* MAIN TAG PREVIEW */}
            <div className="bg-white border-2 border-slate-100 p-6 md:p-8 rounded-[2rem] flex flex-col items-center text-center shadow-xl w-56 md:w-64">
              <div className="text-[8px] md:text-[9px] font-black text-slate-400 mb-4 md:mb-6 uppercase tracking-[0.3em]">Precision Fire Services</div>
              <div className="bg-white p-3 md:p-4 rounded-3xl shadow-inner border border-slate-50 relative">
                <QRCodeSVG 
                  value={getPublicUrl()} 
                  size={160} 
                  level="H" 
                  includeMargin={true} 
                  className="md:w-[180px] md:h-[180px]"
                  imageSettings={{
                    src: logoSrc,
                    height: 34,
                    width: 34,
                    excavate: true,
                  }}
                />
              </div>
              <div className="mt-4 md:mt-6 space-y-1 w-full">
                <div className="text-[8px] md:text-[10px] font-black text-red-600 uppercase tracking-widest pt-3 border-t border-red-50 w-full">SCAN TO LOG FAULT</div>
              </div>
            </div>

            {/* SECONDARY BLOCK PREVIEW (1cm x 4cm) */}
            <div className="bg-white border-2 border-dashed border-slate-900 p-2 rounded-xl flex flex-col items-center justify-center text-center shadow-md w-48 h-12">
              <div className="text-[9px] font-black text-slate-900 uppercase tracking-tight leading-tight">Precision Fire Services</div>
              <div className="text-[12px] font-black text-slate-800 mt-0.5">{equipment.serialNumber}</div>
              <div className="text-[6px] text-slate-400 mt-1 uppercase tracking-widest font-bold">Secondary Cut-Out (1x4cm)</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-slate-50 p-5 md:p-6 rounded-3xl border border-slate-100 space-y-2">
              <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Technical Ref</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-slate-400 font-bold uppercase text-[7px]">Serial No</span>
                  <span className="font-black text-slate-800 block text-[10px] md:text-xs">{equipment.serialNumber}</span>
                </div>
                <div>
                  <span className="block text-slate-400 font-bold uppercase text-[7px]">Equipment</span>
                  <span className="font-black text-slate-800 truncate block text-[10px] md:text-xs">{equipment.type}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button 
                onClick={handlePrint}
                className="flex-[2] bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Label
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
      </div>

      {/* PRINT-ONLY TAG */}
      <div className="print-only hidden print:flex fixed inset-0 bg-white items-center justify-center flex-col gap-4">
         <div className="print-sticker-single flex flex-col items-center justify-between p-1.5 h-[40mm] w-[40mm] bg-white border-[0.3mm] border-dashed border-slate-900 rounded-[3mm] overflow-hidden">
            <div className="text-[6pt] font-black text-slate-900 uppercase">Precision Fire Services</div>
            <div className="flex-1 flex items-center justify-center">
              <QRCodeSVG 
                value={getPublicUrl()} 
                size={90} 
                level="H" 
                includeMargin={false}
                imageSettings={{
                  src: logoSrc,
                  height: 18,
                  width: 18,
                  excavate: true,
                }}
              />
            </div>
            <div className="text-center w-full">
               <div className="text-[7pt] font-black text-red-600 uppercase border-t border-slate-100 pt-1">Scan to Log Fault</div>
               <div className="text-[5pt] font-bold text-slate-400 uppercase">SN: {equipment.serialNumber}</div>
            </div>
         </div>

         {/* SECONDARY CUT-OUT BLOCK (1cm x 4cm) */}
         <div className="print-sticker-secondary flex flex-col items-center justify-center p-1 h-[10mm] w-[40mm] bg-white border-[0.3mm] border-dashed border-slate-900 rounded-[1mm] overflow-hidden">
            <div className="text-[6pt] font-black text-slate-900 uppercase leading-none">Precision Fire Services</div>
            <div className="text-[10pt] font-black text-slate-800 mt-0.5">{equipment.serialNumber}</div>
         </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          .print-only { 
            display: flex !important; 
            align-items: center; 
            justify-content: center; 
            background: white !important;
            position: relative;
            visibility: visible !important;
            min-height: 100vh;
          }
          /* Force hide layout elements */
          header, aside, nav, .BrandSplash { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; display: block !important; overflow: visible !important; }
          
          .print-sticker-single {
            height: 40mm !important;
            width: 40mm !important;
            padding: 2mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            visibility: visible !important;
          }
          .print-sticker-secondary {
            height: 10mm !important;
            width: 40mm !important;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: white !important;
            visibility: visible !important;
          }
          @page { margin: 0; size: auto; }
        }
      `}</style>
    </div>
  );
};

export default SingleAssetLabel;