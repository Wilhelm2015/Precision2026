import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (decodedText: string, isCondemnationMode?: boolean) => void;
  onClose: () => void;
  onSearchClient?: () => void;
  onFinalize?: () => void;
  activeClientName?: string;
  permissionGranted?: boolean;
  onPermissionGranted?: () => void;
  scannedCount?: number;
}

const QRScanner: React.FC<QRScannerProps> = ({ onScan, onClose, onSearchClient, onFinalize, activeClientName, permissionGranted, onPermissionGranted, scannedCount }) => {
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied'>(permissionGranted ? 'granted' : 'prompt');
  const [cameras, setCameras] = useState<{ id: string, label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isStarting, setIsStarting] = useState(false);
  const [isFlashFire, setIsFlashFire] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannerInstance = useRef<Html5Qrcode | null>(null);

  const requestPermissionAndStart = async () => {
    try {
      setIsStarting(true);
      setError(null);
      
      // Explicitly trigger system prompt via native Web API
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Release hardware immediately for the dedicated library instance
      stream.getTracks().forEach(track => track.stop());
      
      // Enumerate hardware now that access is validated
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        setPermissionState('granted');
        if (onPermissionGranted) onPermissionGranted();
        setCameras(devices.map(d => ({ id: d.id, label: d.label })));
        
        const backCamera = devices.find(d => 
          d.label.toLowerCase().includes('back') || 
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('0') ||
          d.label.toLowerCase().includes('environment') ||
          d.label.toLowerCase().includes('facing back')
        );
        
        const targetId = backCamera ? backCamera.id : devices[0].id;
        setSelectedCameraId(targetId);
        
        // Delay ensures React has finished mounting #qr-reader-internal
        setTimeout(() => startScanning(targetId), 750);
      } else {
        setError("Hardware Registry Error: No camera sensors detected on this device.");
        setPermissionState('denied');
      }
    } catch (err: any) {
      setPermissionState('denied');
      setError("Permission Blocked: Camera access was declined or is restricted by your system settings. Please click the 'Lock' icon in your browser address bar, reset permissions, and retry.");
    } finally {
      setIsStarting(false);
    }
  };

  useEffect(() => {
    if (permissionGranted && permissionState === 'granted') {
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices.map(d => ({ id: d.id, label: d.label })));
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('0') ||
            d.label.toLowerCase().includes('environment') ||
            d.label.toLowerCase().includes('facing back')
          );
          const targetId = backCamera ? backCamera.id : devices[0].id;
          setSelectedCameraId(targetId);
          setTimeout(() => startScanning(targetId), 500);
        }
      });
    }
    return () => { stopScanning(); };
  }, [permissionGranted]);

  const startScanning = async (cameraId: string) => {
    await stopScanning();
    try {
      const container = document.getElementById("qr-reader-internal");
      if (!container) {
        // Retry logic for slow DOM injection
        setTimeout(() => startScanning(cameraId), 250);
        return;
      }

      const html5QrCode = new Html5Qrcode("qr-reader-internal", false);
      scannerInstance.current = html5QrCode;
      
      const config = {
        fps: 10,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.75);
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
        disableFlip: true,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: false
        }
      };

      await html5QrCode.start(
        cameraId,
        config,
        (decodedText) => {
          if (navigator.vibrate) navigator.vibrate(50);
          onScan(decodedText, isFlashFire);
          if (!isFlashFire) stopScanning();
        },
        () => {} 
      );
    } catch (err: any) {
      setError(`Scanner initialization failed: ${err?.message}`);
    }
  };

  const stopScanning = async () => {
    if (scannerInstance.current && (scannerInstance.current as any).isScanning) {
      try {
        await scannerInstance.current.stop();
        scannerInstance.current = null;
      } catch (e) {}
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim(), isFlashFire);
      setManualCode('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-6 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
            </div>
            <div>
              <h3 className="font-black uppercase tracking-tight text-[10px]">SANS Tag Entry</h3>
              <div className="flex items-center gap-2">
                <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[150px]">{activeClientName || 'Site Selection Pending'}</p>
                {scannedCount !== undefined && scannedCount > 0 && (
                  <span className="bg-emerald-500 text-white text-[7px] px-1.5 py-0.5 rounded-full font-black">
                    {scannedCount} SCANNED
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6 overflow-y-auto scrollbar-hide">
          {permissionState !== 'granted' ? (
            <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem] text-center space-y-6">
              <div className="w-16 h-16 bg-white text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </div>
              <div className="space-y-2">
                <p className="text-slate-900 font-black uppercase text-xs tracking-widest">Scanner Activation</p>
                <p className="text-[10px] text-slate-500 font-bold leading-relaxed">Tap below to trigger the secure camera authorization prompt for this device.</p>
              </div>
              <button 
                onClick={requestPermissionAndStart}
                disabled={isStarting}
                className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
              >
                {isStarting ? 'Requesting Access...' : 'Open Camera Sensor'}
              </button>
              {error && (
                <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-100 animate-in shake duration-500">
                   <p className="text-[9px] text-red-600 font-black uppercase leading-tight">{error}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <div id="qr-reader-internal" className="w-full overflow-hidden rounded-3xl border-4 border-slate-50 shadow-inner bg-slate-900 aspect-square"></div>
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                 <div className="w-[70%] h-[70%] border-2 border-white/30 rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50 blur-sm animate-[scan_2s_ease-in-out_infinite]" />
                 </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Registry Search</span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>

            <button 
              onClick={onSearchClient}
              className="w-full bg-slate-50 border-2 border-slate-200 text-slate-900 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 hover:bg-slate-100 transition-all active:scale-95 shadow-sm"
            >
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              Search Site Registry
            </button>

            <div className="flex items-center gap-4">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Or Enter Code</span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>
            
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input 
                type="text" 
                placeholder="e.g. 51 or 000012"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-4 font-black uppercase outline-none focus:border-red-500 transition-all text-sm"
              />
              <button 
                type="submit"
                disabled={!manualCode.trim()}
                className="bg-slate-900 text-white px-8 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black active:scale-95 disabled:opacity-30 transition-all"
              >
                Go
              </button>
            </form>
          </div>
          
          <div className="text-center pt-2">
            {onFinalize && activeClientName && (
              <button 
                onClick={onFinalize}
                className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all uppercase tracking-widest text-[11px] flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                Finalize Audit
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        #qr-reader-internal video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
        }
        .shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};

export default QRScanner;