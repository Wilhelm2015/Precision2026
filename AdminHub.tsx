import React, { useState, useMemo, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Equipment } from '../types';
import { syncService, getProxiedImageUrl } from '../services/registryService';
import { COMPANY_LOGO_URL } from '../constants';
import { getAppBaseUrl } from '../utils';

interface BulkQRManagerProps {
  equipment: Equipment[];
  onClose: () => void;
}

const BulkQRManager: React.FC<BulkQRManagerProps> = ({ equipment, onClose }) => {
  const [lastExported, setLastExported] = useState<number>(() => {
    const saved = localStorage.getItem('pfs_last_exported_qr');
    return saved ? parseInt(saved) : 1611;
  });

  const [startIndex, setStartIndex] = useState(lastExported + 1);
  const [quantity, setQuantity] = useState(24);
  const [isSyncing, setIsSyncing] = useState(false);

  // Retrieve branding logo for QR center
  const logoSrc = useMemo(() => {
    try {
      const stored = localStorage.getItem('pfs_custom_logo');
      if (stored) return getProxiedImageUrl(stored);
    } catch (e) {}
    return COMPANY_LOGO_URL;
  }, []);

  // Sync sequence from cloud on mount
  useEffect(() => {
    const fetchSequence = async () => {
      try {
        const cloudValStr = await syncService.getQRSequence();
        if (cloudValStr) {
          const cloudVal = parseInt(cloudValStr);
          if (!isNaN(cloudVal)) {
            setLastExported(cloudVal);
            localStorage.setItem('pfs_last_exported_qr', cloudVal.toString());
          }
        }
      } catch (err) {
        console.warn("Could not sync QR sequence from cloud, using local fallback.");
      }
    };
    fetchSequence();
  }, []);

  useEffect(() => {
    setStartIndex(lastExported + 1);
  }, [lastExported]);

  const handlePrint = async () => {
    const endOfBatch = startIndex + quantity - 1;
    setIsSyncing(true);
    try {
      await syncService.updateQRSequence(endOfBatch.toString());
      localStorage.setItem('pfs_last_exported_qr', endOfBatch.toString());
      setLastExported(endOfBatch);
      window.print();
    } catch (err) {
      alert("Cloud Sync Failed: Ensure you are online to reserve this QR sequence.");
    } finally {
      setIsSyncing(false);
    }
  };

  const generatedLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i < quantity; i++) {
      const serialNum = (startIndex + i).toString().padStart(6, '0');
      labels.push({
        id: `gen-${serialNum}`,
        serialNumber: serialNum,
        url: `${getAppBaseUrl()}/?code=${serialNum}`
      });
    }
    return labels;
  }, [startIndex, quantity]);

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">
      <div className="flex justify-between items-center mb-8 no-print">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7m0 0l7-7" /></svg>
          </button>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">QR Station</h2>
        </div>
        <button 
          onClick={handlePrint}
          disabled={isSyncing}
          className="bg-red-600 text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {isSyncing ? 'Syncing Sequence...' : 'Print & Reserve Sequence'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 no-print mb-10">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Number</label>
            <span className="text-[8px] font-black text-emerald-500 uppercase bg-emerald-50 px-2 py-0.5 rounded">Auto Next</span>
          </div>
          <input 
            type="number" 
            value={startIndex} 
            onChange={(e) => setStartIndex(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:border-red-500 transition-all"
          />
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
          <input 
            type="number" 
            value={quantity || ''} 
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                setQuantity(0);
              } else {
                const n = parseInt(val);
                if (!isNaN(n)) setQuantity(n);
              }
            }}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 font-bold text-lg outline-none focus:border-red-500 transition-all"
          />
        </div>
        <div className="md:col-span-2 bg-slate-900 p-6 rounded-3xl flex items-center justify-between text-white">
          <div>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Fleet Batch Sequence</p>
            <p className="text-sm font-bold opacity-80">
              Generating <span className="text-white font-black">{quantity}</span> tags from <span className="text-white font-black">{startIndex.toString().padStart(6, '0')}</span> to <span className="text-white font-black">{(startIndex + quantity - 1).toString().padStart(6, '0')}</span>
            </p>
          </div>
          <div className="text-right border-l border-white/10 pl-6">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Next ID Pool</p>
            <p className="text-xs font-black text-amber-400">{lastExported.toString().padStart(6, '0')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 no-print overflow-y-auto pr-2 scrollbar-hide">
        {generatedLabels.map((label) => (
          <div key={label.id} className="flex flex-col gap-3">
            {/* MAIN TAG PREVIEW */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col items-center text-center shadow-sm">
              <div className="text-[6px] font-black text-slate-300 mb-2 uppercase">Precision Fire</div>
              <QRCodeSVG 
                value={label.url} 
                size={80} 
                level="H"
                imageSettings={{
                  src: logoSrc,
                  height: 16,
                  width: 16,
                  excavate: true,
                }}
              />
              <div className="mt-2 font-black text-[8px] text-red-600 uppercase">Scan to Log Fault</div>
              <div className="text-[6px] font-bold text-slate-400 mt-1">SN: {label.serialNumber}</div>
            </div>
            
            {/* SECONDARY BLOCK PREVIEW (1cm x 4cm) */}
            <div className="bg-white border border-dashed border-slate-900 p-1 rounded-lg flex flex-col items-center justify-center text-center h-8">
              <div className="text-[5px] font-black text-slate-900 uppercase leading-none">Precision Fire</div>
              <div className="text-[7px] font-black text-slate-800 mt-0.5">{label.serialNumber}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="print-grid hidden print:block">
        <div className="flex flex-wrap gap-y-2">
          {generatedLabels.map((label) => (
            <div key={label.id} className="w-1/4 p-1 flex flex-col items-center gap-1 break-inside-avoid">
              <div className="print-sticker flex flex-col items-center justify-between p-1.5 h-[40mm] w-[40mm] bg-white border-[0.3mm] border-dashed border-slate-900 rounded-[3mm] overflow-hidden">
                <div className="text-[6pt] font-black text-slate-900 uppercase">Precision Fire Services</div>
                <div className="flex-1 flex items-center justify-center">
                  <QRCodeSVG 
                    value={label.url} 
                    size={85} 
                    level="H"
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
                  <div className="text-[5pt] font-bold text-slate-400 uppercase">SN: {label.serialNumber}</div>
                </div>
              </div>
              
              {/* SECONDARY CUT-OUT BLOCK (1cm x 4cm) */}
              <div className="print-sticker-secondary flex flex-col items-center justify-center p-1 h-[10mm] w-[40mm] bg-white border-[0.3mm] border-dashed border-slate-900 rounded-[1mm] overflow-hidden">
                <div className="text-[6pt] font-black text-slate-900 uppercase leading-none">Precision Fire Services</div>
                <div className="text-[10pt] font-black text-slate-800 mt-0.5">{label.serialNumber}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: white !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
          .print-grid { 
            display: block !important; 
            width: 210mm; 
            padding: 5mm;
            padding-bottom: 20mm;
            margin: 0;
            position: relative;
            visibility: visible !important;
          }
          /* Force hide layout elements */
          header, aside, nav, .BrandSplash { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; display: block !important; overflow: visible !important; }
          .max-w-7xl { max-width: none !important; width: 100% !important; }
          
          .print-sticker {
            height: 40mm !important;
            width: 40mm !important;
            page-break-inside: avoid;
            margin: 0.2mm;
            visibility: visible !important;
          }
          .print-sticker-secondary {
            height: 10mm !important;
            width: 40mm !important;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: white !important;
            margin: 0.2mm;
            visibility: visible !important;
          }
          @page { margin: 0; size: A4 portrait; }
        }
      `}</style>
    </div>
  );
};

export default BulkQRManager;