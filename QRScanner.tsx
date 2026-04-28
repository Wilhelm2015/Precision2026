import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Equipment, FaultReport, Client, Technician } from '../types';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { BrandLogo } from './Brand';
import { QR_PROTOCOL } from '../constants';
import { compressImage, syncService, getProxiedImageUrl } from '../services/registryService';
import ImageModal from './ImageModal';

interface PublicPortalProps {
  equipmentList: Equipment[];
  clients: Client[];
  onSubmitFault: (report: FaultReport) => Promise<void>;
  onScanTech: (tech: Technician) => void;
  allTechnicians: Technician[];
  validateSubmission: (equipmentId: string) => { allowed: boolean; reason?: string };
}

const PublicPortal: React.FC<PublicPortalProps> = ({ equipmentList, clients, onSubmitFault, onScanTech, allTechnicians, validateSubmission }) => {
  const [step, setStep] = useState<'resolving' | 'scan' | 'form' | 'success' | 'decommissioned'>('resolving');
  const [scannedAsset, setScannedAsset] = useState<Equipment | null>(null);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [lastSubmittedId, setLastSubmittedId] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    description: ''
  });

  const resolveAssetAsync = useCallback(async (code: string) => {
    // If someone scans a full URL instead of just the ID, try to extract the parameter
    let cleanCode = code.trim();
    if (cleanCode.includes('?code=')) cleanCode = cleanCode.split('?code=')[1].split('&')[0];
    else if (cleanCode.includes('?sn=')) cleanCode = cleanCode.split('?sn=')[1].split('&')[0];
    else if (cleanCode.includes('?qr=')) cleanCode = cleanCode.split('?qr=')[1].split('&')[0];
    cleanCode = cleanCode.replace(QR_PROTOCOL, '').trim();

    let found = equipmentList.find(e => 
      e.qrCode === cleanCode || 
      e.serialNumber === cleanCode || 
      e.id === cleanCode
    );

    // If not found locally, try cloud with retries
    if (!found) {
      setStep('resolving');
      for (let i = 0; i < 3; i++) {
        try {
          const cloudData = await syncService.fetchAssetByCode(cleanCode);
          if (cloudData && cloudData.equipment && cloudData.equipment.length > 0) {
            // Find the specific asset in the returned equipment list
            found = cloudData.equipment.find((e: any) => 
              e.qrCode === cleanCode || 
              e.serialNumber === cleanCode || 
              e.id === cleanCode
            );
            if (found) break;
          }
          await new Promise(r => setTimeout(r, 1000)); // wait 1s between retries
        } catch (e) {
          console.warn(`Cloud fetch attempt ${i+1} failed:`, e);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }

    if (found) {
      const validation = validateSubmission(found.id);
      if (!validation.allowed) {
        alert(validation.reason);
        return false;
      }

      setScannedAsset(found);
      const client = clients.find(c => c.id === found?.client_id);
      setActiveClient(client || null);
      
      if (found.isArchived) {
        setStep('decommissioned');
      } else {
        setStep('form');
      }
      return true;
    }
    setStep('scan'); 
    return false;
  }, [equipmentList, clients, validateSubmission]);

  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code') || params.get('sn') || params.get('qr');
    
    const initCode = async () => {
      // If we have a code, try to resolve it. If empty, wait slightly for equipmentList
      if (urlCode) {
        if (equipmentList.length === 0) {
            // Small buffer to wait for data sync
            await new Promise(r => setTimeout(r, 1500));
        }
        if (isMounted) await resolveAssetAsync(urlCode);
      } else {
        if (isMounted) setStep('scan');
      }
    };
    initCode();
    
    return () => { isMounted = false; };
  }, [equipmentList, resolveAssetAsync]); // Run ONLY once on mount to check URL params

  useEffect(() => {
    if (step === 'scan') {
      const qrboxSize = Math.min(window.innerWidth * 0.7, 250);
      const scanner = new Html5QrcodeScanner(
        "portal-scanner",
        { 
          fps: 15, 
          qrbox: { width: qrboxSize, height: qrboxSize }, 
          aspectRatio: 1.0,
          videoConstraints: { facingMode: "environment" }
        },
        false
      );
      
      scanner.render(async (decodedText) => {
        // Immediately try to resolve, and disable camera while it tries
        const success = await resolveAssetAsync(decodedText);
        if (success) {
           scanner.clear().catch(() => {});
        } else {
           // If scan result isn't valid, don't clear the scanner just yet, 
           // but give feedback. Stay on 'scan' step.
           console.warn("Scan result not resolved, retrying...");
        }
      }, (error) => {
          // Ignore scanning errors which are normal as the camera searches
          // console.log("Scanner loop active...");
      });
      
      return () => { 
        scanner.clear().catch(e => console.warn("Scanner clear failed", e)); 
      };
    }
  }, [step, allTechnicians, onScanTech, resolveAssetAsync]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const success = await resolveAssetAsync(manualCode);
    if (!success) {
      alert("ASSET NOT REGISTERED: This ID was not found in the SANS master database.");
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const compressed = await compressImage(reader.result as string, 800);
          const timestamp = Date.now();
          setPhotos(prev => [...prev, `${compressed}|${timestamp}`]);
        };
        reader.readAsDataURL(file as File);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedAsset || isSubmitting) return;

    if (!formData.name.trim() || !formData.contact.trim() || !formData.description.trim()) {
      alert("MANDATORY: Please complete all fields.");
      return;
    }

    if (photos.length === 0) {
      alert("EVIDENCE REQUIRED: Please attach a photo of the fault.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Upload photos to Supabase Storage
      const uploadedPhotoUrls = await Promise.all(
        photos.map(async (photoData, index) => {
          const [base64, timestamp] = photoData.includes('|') ? photoData.split('|') : [photoData, Date.now().toString()];
          const url = await syncService.uploadImage(base64, `public_faults/${scannedAsset.id}/${timestamp}_${index}.jpg`);
          return `${url}|${timestamp}`;
        })
      );

      const reportId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const report: FaultReport = {
        id: reportId,
        equipmentId: scannedAsset.id,
        reporterName: formData.name.trim(),
        reporterContact: formData.contact.trim(),
        description: formData.description.trim(),
        timestamp: new Date().toISOString(),
        status: 'Open',
        photos: uploadedPhotoUrls
      };
      
      await onSubmitFault(report);
      setLastSubmittedId(reportId);
      setStep('success');
    } catch (err: any) {
      alert(`SUBMISSION FAILED: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-y-auto">
      <header className="bg-slate-900 text-white p-6 shadow-xl flex flex-col items-center gap-2 relative overflow-hidden shrink-0">
        <BrandLogo className="w-10 h-10 mb-1" glow />
        <h1 className="text-lg font-black uppercase tracking-[0.2em]">Precision Fire Services</h1>
        <p className="text-[8px] text-red-500 font-black uppercase tracking-[0.4em]">Public Safety Portal</p>
      </header>

      <main className="flex-grow flex flex-col items-center p-4 max-w-lg mx-auto w-full space-y-6 mb-10">
        {step === 'resolving' && (
          <div className="w-full flex flex-col items-center justify-center py-24 space-y-6">
             <div className="w-16 h-16 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin" />
             <div className="text-center">
                <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Registry Syncing</h2>
                <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Cross-referencing SANS Database...</p>
             </div>
          </div>
        )}

        {step === 'scan' && (
          <div className="w-full space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 md:p-10 rounded-[2rem] shadow-2xl border border-slate-100 text-center space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Safety Incident Log</h2>
                <p className="text-slate-500 text-xs font-medium mt-1">Scan an official QR Tag to report a defect.</p>
              </div>
              
              <div id="portal-scanner" className="overflow-hidden rounded-3xl border-4 border-slate-50 shadow-inner bg-slate-900 aspect-square"></div>
              
              <div className="space-y-4 pt-4 border-t border-slate-50">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Entry</p>
                 <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Serial Number" 
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value)}
                      className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-red-500 font-bold text-sm uppercase"
                    />
                    <button type="submit" className="bg-slate-900 text-white px-5 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all">Go</button>
                 </form>
              </div>
            </div>
          </div>
        )}

        {step === 'form' && scannedAsset && (
          <div className="w-full space-y-4 animate-in slide-in-from-bottom-8 duration-500">
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
              <div className="bg-slate-900 p-6 md:p-10 text-white flex flex-col gap-4">
                <div className="flex justify-between items-start">
                   <div className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">Asset Identified</div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[120px]">{activeClient?.name || 'Verified Site'}</p>
                </div>
                <div className="space-y-1">
                   <h3 className="text-2xl font-black uppercase tracking-tight leading-none">{scannedAsset.type}</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">SN: {scannedAsset.serialNumber}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-white/10">
                   <div>
                      <p className="text-[7px] font-black text-slate-500 uppercase">Site Location</p>
                      <p className="text-[10px] font-bold uppercase truncate">{scannedAsset.location}</p>
                   </div>
                   <div>
                      <p className="text-[7px] font-black text-slate-500 uppercase">Registry Status</p>
                      <p className="text-[10px] font-bold uppercase text-emerald-400">Authorized</p>
                   </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 md:p-10 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Your Full Name *</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-3.5 outline-none focus:border-red-500 font-bold text-sm" placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contact Phone *</label>
                    <input required type="tel" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-3.5 outline-none focus:border-red-500 font-bold text-sm" placeholder="082 123 4567" />
                  </div>
                  
                  <div className={`p-5 rounded-3xl border-2 transition-all ${photos.length === 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-transparent'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Attach Evidence Photos *</label>
                      <span className="text-[8px] font-black bg-red-600 text-white px-2 py-0.5 rounded uppercase tracking-tighter">Required</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {photos.map((p, i) => (
                        <div 
                          key={i} 
                          className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white cursor-zoom-in hover:scale-105 transition-transform"
                          onClick={() => setSelectedImage(p.split('|')[0])}
                        >
                          <img src={getProxiedImageUrl(p.split('|')[0])} className="w-full h-full object-cover" alt="Fault Evidence" referrerPolicy="no-referrer" />
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setPhotos(prev => prev.filter((_, idx) => idx !== i)); }}
                            className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-lg shadow-lg z-10"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                      {photos.length < 3 && (
                        <button 
                          type="button" 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-20 h-20 border-2 border-dashed border-red-300 rounded-xl flex flex-col items-center justify-center text-red-500 hover:bg-white transition-all bg-white/50"
                        >
                          <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className="text-[7px] font-black uppercase">Capture</span>
                        </button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Describe the Fault *</label>
                    <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-5 py-3.5 h-24 outline-none focus:border-red-500 font-bold text-sm resize-none" placeholder="Explain the damage or discharge..." />
                  </div>
                </div>
                
                <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-2">
                  {isSubmitting ? 'Logging to Registry...' : 'Submit Incident Report'}
                </button>
              </form>
            </div>
            <button onClick={() => { window.history.pushState({}, '', '/'); setStep('scan'); setScannedAsset(null); setPhotos([]); }} className="w-full text-slate-400 font-black text-[9px] uppercase tracking-widest py-2">Back to Scanner</button>
          </div>
        )}

        {step === 'success' && (
          <div className="w-full animate-in zoom-in-95 duration-500">
            <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-100 text-center space-y-8 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-2 bg-emerald-500" />
              
              <div className="relative">
                <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg border-4 border-white animate-in zoom-in duration-500">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-24 bg-emerald-400/20 rounded-full animate-ping pointer-events-none" />
              </div>

              <div className="space-y-3">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">Submitted</h2>
                <div className="inline-flex items-center gap-2 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Reference No:</span>
                   <span className="text-[10px] font-black text-slate-900 uppercase">{lastSubmittedId}</span>
                </div>
              </div>

              <div className="space-y-4 px-4">
                <p className="text-slate-500 text-xs font-medium leading-relaxed">
                  Thank you for reporting this safety hazard. Our field team has been notified.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => { window.location.href = '/'; }} 
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black active:scale-95 transition-all uppercase tracking-widest text-[11px]"
                >
                  Return to Entry
                </button>
                <button 
                  onClick={() => window.close()} 
                  className="w-full bg-slate-100 text-slate-400 font-black py-4 rounded-2xl hover:bg-slate-200 active:scale-95 transition-all uppercase tracking-widest text-[9px]"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'decommissioned' && scannedAsset && (
          <div className="w-full animate-in zoom-in-95 duration-500">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border-4 border-red-600 text-center space-y-6">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto border-2 border-amber-100">
                 <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Decommissioned</h2>
                <p className="text-[8px] font-black text-red-600 uppercase tracking-[0.3em]">Registry Status: SCRAPPED</p>
              </div>
              <p className="text-slate-500 text-xs font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                Asset (SN: {scannedAsset.serialNumber}) has been formally condemned.
              </p>
              <button 
                onClick={() => { window.history.pushState({}, '', '/'); setStep('scan'); setScannedAsset(null); setPhotos([]); }} 
                className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black uppercase tracking-widest text-[10px]"
              >
                Scan Another Asset
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="p-6 text-center border-t border-slate-200 mt-auto bg-white/50 space-y-1">
        <p className="text-[8px] font-black text-slate-900 uppercase tracking-[0.4em]">Precision Fire Services (Pty) Ltd</p>
        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">SANS 1475 REGULATORY NODE</p>
      </footer>

      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
};

export default PublicPortal;