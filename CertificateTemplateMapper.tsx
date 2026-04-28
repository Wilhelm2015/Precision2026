import React, { useState, useRef, useEffect } from 'react';
import { Equipment, Client, InspectionRecord, FaultReport } from '../types';
import { compressImage, syncService } from '../services/registryService';
import { supabase } from '../supabase';
import CertificateTemplateMapper from './CertificateTemplateMapper';
import BulkImport from './BulkImport';
import QuoteCatalogImport from './QuoteCatalogImport';
import * as pdfjs from 'pdfjs-dist';
import JSZip from 'jszip';

// Set worker source for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface AdminHubProps {
  branding: any[];
  equipment: Equipment[];
  clients: Client[];
  records: InspectionRecord[];
  faults: FaultReport[];
  onRetry: () => void;
  onPurge: () => void;
  onExport: () => void;
  onOpenTemplateMapper: () => void;
  onRefreshData: () => void;
}

type Distribution = 'audit' | 'coc' | 'both';

const AdminHub: React.FC<AdminHubProps> = ({ branding, clients, equipment, records, faults, onRetry, onPurge, onExport, onOpenTemplateMapper, onRefreshData }) => {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showCatalogImport, setShowCatalogImport] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<'signature' | 'saqcc' | 'card' | 'saqcc_cert' | 'company' | 'sacas' | 'sacas_cert' | 'manager' | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessing(true);
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (window.confirm("CRITICAL: This will overwrite existing data with the backup contents. Proceed?")) {
        await syncService.restoreRegistry(data);
        alert("Registry restored successfully!");
        onRefreshData();
      }
    } catch (err: any) {
      alert("Restore failed: " + err.message);
    } finally {
      setIsProcessing(false);
      if (restoreInputRef.current) restoreInputRef.current.value = '';
    }
  };

  const handleBulkPhotoBackup = async () => {
    if (!window.confirm("This will download all photos from the cloud registry as a ZIP file. Depending on the number of photos, this may take several minutes. Proceed?")) return;
    
    setIsBackingUp(true);
    setBackupProgress(0);
    
    try {
      const zip = new JSZip();
      const photoUrls: { url: string; name: string }[] = [];
      
      // Collect all photo URLs
      equipment.forEach(e => {
        (e.photos || []).forEach((url, i) => {
          photoUrls.push({ url, name: `equipment/${e.serialNumber || e.id}_${i}.jpg` });
        });
      });
      
      records.forEach(r => {
        (r.photos || []).forEach((url, i) => {
          photoUrls.push({ url, name: `inspections/${r.equipmentId}/${r.id}_${i}.jpg` });
        });
      });
      
      faults.forEach(f => {
        (f.photos || []).forEach((url, i) => {
          photoUrls.push({ url, name: `faults/${f.equipmentId || 'general'}/${f.id}_${i}.jpg` });
        });
      });

      if (photoUrls.length === 0) {
        alert("No photos found in the registry.");
        setIsBackingUp(false);
        return;
      }

      const total = photoUrls.length;
      let processed = 0;

      // Download and add to ZIP
      for (const item of photoUrls) {
        try {
          const response = await fetch(item.url);
          if (!response.ok) throw new Error("Failed to fetch");
          const blob = await response.blob();
          zip.file(item.name, blob);
        } catch (err) {
          console.error(`Failed to backup photo: ${item.url}`, err);
        }
        processed++;
        setBackupProgress(Math.round((processed / total) * 100));
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SANS_Photo_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      
      alert(`Backup complete! ${processed} photos downloaded.`);
    } catch (err: any) {
      alert("Backup failed: " + err.message);
    } finally {
      setIsBackingUp(false);
      setBackupProgress(0);
    }
  };

  const [logos, setLogos] = useState({
    company: localStorage.getItem('pfs_custom_logo') || '',
    saqcc: localStorage.getItem('pfs_custom_saqcc') || '',
    sacas: localStorage.getItem('pfs_custom_sacas') || '',
    sacas_cert: localStorage.getItem(`pfs_sacas_cert_${selectedYear}`) || localStorage.getItem('pfs_sacas_cert') || '',
    manager: localStorage.getItem('pfs_manager_signature') || '',
    managerTyped: localStorage.getItem('pfs_manager_typed_name') || ''
  });

  const [dist, setDist] = useState({
    company: (localStorage.getItem('pfs_dist_company') as Distribution) || 'both',
    saqcc: (localStorage.getItem('pfs_dist_saqcc') as Distribution) || 'both',
    sacas: (localStorage.getItem('pfs_dist_sacas') as Distribution) || 'both',
    sacas_cert: (localStorage.getItem(`pfs_dist_sacas_cert_${selectedYear}`) as Distribution) || (localStorage.getItem('pfs_dist_sacas_cert') as Distribution) || 'both',
    manager: (localStorage.getItem('pfs_dist_manager') as Distribution) || 'both',
    managerTyped: (localStorage.getItem('pfs_dist_manager_typed') as Distribution) || 'both'
  });

  // Sync internal state with cloud data passed via props
  useEffect(() => {
    if (branding) {
      const newLogos = { company: '', saqcc: '', sacas: '', sacas_cert: '', manager: '', managerTyped: '' };
      const newDist = { company: 'both' as Distribution, saqcc: 'both' as Distribution, sacas: 'both' as Distribution, sacas_cert: 'both' as Distribution, manager: 'both' as Distribution, managerTyped: 'both' as Distribution };

      branding.forEach(item => {
        if (item.id === 'pfs_custom_logo') {
          newLogos.company = item.content;
          newDist.company = (item.distribution as Distribution) || 'both';
        } else if (item.id === 'pfs_custom_saqcc') {
          newLogos.saqcc = item.content;
          newDist.saqcc = (item.distribution as Distribution) || 'both';
        } else if (item.id === 'pfs_custom_sacas') {
          newLogos.sacas = item.content;
          newDist.sacas = (item.distribution as Distribution) || 'both';
        } else if (item.id === 'pfs_sacas_cert' || item.id === `pfs_sacas_cert_${selectedYear}`) {
          // Year-specific takes precedence
          if (item.id === `pfs_sacas_cert_${selectedYear}` || !newLogos.sacas_cert) {
            newLogos.sacas_cert = item.content;
            newDist.sacas_cert = (item.distribution as Distribution) || 'both';
          }
        } else if (item.id === 'pfs_manager_signature') {
          newLogos.manager = item.content;
          newDist.manager = (item.distribution as Distribution) || 'both';
        } else if (item.id === 'pfs_manager_typed_name') {
          newLogos.managerTyped = item.content;
          newDist.managerTyped = (item.distribution as Distribution) || 'both';
        }
      });

      setLogos(newLogos);
      setDist(newDist);
    }
  }, [branding, selectedYear]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null);
    });
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadTarget) {
      setIsProcessing(true);
      
      try {
        let imageData: string;

        if (file.type === 'application/pdf') {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (context) {
            await page.render({ canvasContext: context, viewport, canvas }).promise;
            imageData = canvas.toDataURL('image/jpeg', 0.5);
          } else {
            throw new Error("Could not create canvas context");
          }
        } else {
          const reader = new FileReader();
          imageData = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        const compressed = await compressImage(imageData, uploadTarget === 'sacas_cert' ? 1200 : 800);
        const storageKey = uploadTarget === 'company' ? 'pfs_custom_logo' : 
                          uploadTarget === 'saqcc' ? 'pfs_custom_saqcc' : 
                          uploadTarget === 'sacas' ? 'pfs_custom_sacas' : 
                          uploadTarget === 'sacas_cert' ? `pfs_sacas_cert_${selectedYear}` : 'pfs_manager_signature';
        
        // Upload to Firebase Storage (or R2)
        const uploadedUrl = await syncService.uploadImage(compressed, `${storageKey}_${Date.now()}.jpg`);

        const currentDist = uploadTarget === 'company' ? dist.company : 
                           uploadTarget === 'saqcc' ? dist.saqcc : 
                           uploadTarget === 'sacas' ? dist.sacas : 
                           uploadTarget === 'sacas_cert' ? dist.sacas_cert : dist.manager;

        await syncService.saveBranding(storageKey, uploadedUrl, currentDist);
        localStorage.setItem(storageKey, uploadedUrl);
        setLogos(prev => ({ ...prev, [uploadTarget]: uploadedUrl }));
        setUploadTarget(null);
      } catch (err: any) {
        console.error("Upload error:", err);
        alert("Failed to process file: " + err.message);
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    }
  };

  const updateDist = async (target: 'company' | 'saqcc' | 'sacas' | 'sacas_cert' | 'manager' | 'managerTyped', val: Distribution) => {
    const storageKey = target === 'company' ? 'pfs_custom_logo' : 
                      target === 'saqcc' ? 'pfs_custom_saqcc' : 
                      target === 'sacas' ? 'pfs_custom_sacas' : 
                      target === 'sacas_cert' ? `pfs_sacas_cert_${selectedYear}` : 
                      target === 'manager' ? 'pfs_manager_signature' : 'pfs_manager_typed_name';
    const distKey = target === 'sacas_cert' ? `pfs_dist_sacas_cert_${selectedYear}` : `pfs_dist_${target}`;
    
    setIsProcessing(true);
    const content = logos[target];
    if (content) {
      await syncService.saveBranding(storageKey, content, val);
    }
    localStorage.setItem(distKey, val);
    setDist(prev => ({ ...prev, [target]: val }));
    setIsProcessing(false);
  };

  const handleTypedSignatureChange = async (val: string) => {
    setIsProcessing(true);
    const storageKey = 'pfs_manager_typed_name';
    await syncService.saveBranding(storageKey, val, dist.managerTyped);
    localStorage.setItem(storageKey, val);
    setLogos(prev => ({ ...prev, managerTyped: val }));
    setIsProcessing(false);
  };

  const clearLogo = async (target: 'company' | 'saqcc' | 'sacas' | 'sacas_cert' | 'manager' | 'managerTyped') => {
    let storageKey = '';
    let distKey = '';

    if (target === 'sacas_cert') {
      // Check if we have a year-specific one first
      const yearKey = `pfs_sacas_cert_${selectedYear}`;
      if (localStorage.getItem(yearKey)) {
        storageKey = yearKey;
        distKey = `pfs_dist_sacas_cert_${selectedYear}`;
      } else {
        storageKey = 'pfs_sacas_cert';
        distKey = 'pfs_dist_sacas_cert';
      }
    } else {
      storageKey = target === 'company' ? 'pfs_custom_logo' : 
                   target === 'saqcc' ? 'pfs_custom_saqcc' : 
                   target === 'sacas' ? 'pfs_custom_sacas' : 
                   target === 'manager' ? 'pfs_manager_signature' : 'pfs_manager_typed_name';
      distKey = `pfs_dist_${target}`;
    }
    
    setIsProcessing(true);
    await syncService.deleteBranding(storageKey);
    localStorage.removeItem(storageKey);
    localStorage.removeItem(distKey);
    setLogos(prev => ({ ...prev, [target]: '' }));
    setIsProcessing(false);
  };

  const DistributionSelector = ({ target }: { target: 'company' | 'saqcc' | 'sacas' | 'sacas_cert' | 'manager' | 'managerTyped' }) => (
    <div className="flex bg-slate-100 p-1 rounded-xl mt-4">
      {(['audit', 'coc', 'both'] as Distribution[]).map((d) => (
        <button
          key={d}
          disabled={isProcessing}
          onClick={() => updateDist(target, d)}
          className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${
            dist[target] === d ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {d === 'both' ? 'Universal' : d}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 p-8 text-white">
          <h2 className="text-xl font-black uppercase tracking-tight">Identity & Branding</h2>
          <p className="text-slate-400 text-xs mt-1">Personalize reports and portals with your technical credentials.</p>
        </div>
        
        <div className="p-8">
           <div className="flex justify-end mb-6">
             <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Year:</span>
               <select 
                 value={selectedYear} 
                 onChange={(e) => setSelectedYear(e.target.value)}
                 className="bg-white border-2 border-slate-200 rounded-xl px-4 py-2 font-black text-slate-900 uppercase tracking-tight focus:border-red-600 focus:outline-none transition-all text-xs"
               >
                 {[2024, 2025, 2026, 2027, 2028].map(y => (
                   <option key={y} value={y.toString()}>{y}</option>
                 ))}
               </select>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-5 gap-10">
              {(['company', 'saqcc', 'sacas', 'sacas_cert', 'manager'] as const).map((key) => (
                <div key={key} className="space-y-4">
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                     {key === 'company' ? 'Primary Logo' : key === 'saqcc' ? 'SAQCC Badge' : key === 'sacas' ? 'SANS Permit' : key === 'sacas_cert' ? `SACAS Cert (${selectedYear})` : 'Manager Signature'}
                   </label>
                   <div className="aspect-square bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex flex-col items-center justify-center p-6 relative group overflow-hidden shadow-inner">
                      {logos[key] ? (
                        <>
                         <img src={logos[key]} className="max-full max-h-full object-contain" alt="Branding" referrerPolicy="no-referrer" />
                         <button onClick={() => clearLogo(key)} className="absolute top-4 right-4 bg-red-600 text-white p-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth={2.5}/></svg>
                         </button>
                        </>
                      ) : (
                        <button onClick={() => { setUploadTarget(key); fileInputRef.current?.click(); }} className="flex flex-col items-center gap-3 text-slate-300 hover:text-red-600 transition-all">
                           <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                           </div>
                           <span className="text-[10px] font-black uppercase tracking-widest">Upload File</span>
                        </button>
                      )}
                   </div>
                   {logos[key] && (
                     <div className="animate-in slide-in-from-top-2">
                       <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Target Usage</p>
                       <DistributionSelector target={key} />
                     </div>
                   )}
                </div>
              ))}
           </div>

           <div className="mt-12 pt-12 border-t border-slate-100">
              <div className="max-w-md space-y-4">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                   Manager Name (Typed Signature)
                 </label>
                 <div className="relative">
                    <input 
                      type="text"
                      value={logos.managerTyped}
                      onChange={(e) => handleTypedSignatureChange(e.target.value)}
                      placeholder="Type Full Name for Digital Signature..."
                      className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-6 py-4 font-black text-slate-900 uppercase tracking-tight focus:border-red-600 focus:outline-none transition-all"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-black text-slate-300 uppercase tracking-widest">
                      Digital Auth
                    </div>
                 </div>
                 <p className="text-[9px] text-slate-400 font-medium italic ml-1">This name will be used as a fallback or alternative to the uploaded signature image on all compliance documents.</p>
                 {logos.managerTyped && (
                   <div className="animate-in slide-in-from-top-2">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1">Target Usage</p>
                     <DistributionSelector target="managerTyped" />
                   </div>
                 )}
              </div>
           </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleLogoUpload} />
      </div>

      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 p-8 text-white">
            <h2 className="text-xl font-black uppercase tracking-tight">Cloud Registry Management</h2>
            <p className="text-slate-400 text-xs mt-1">Maintain your high-availability secure data store.</p>
        </div>
        <div className="p-8 space-y-6">
            <div className="p-8 bg-purple-50 border-4 border-purple-600 rounded-[2.5rem] space-y-4 shadow-2xl shadow-purple-200">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-purple-900 uppercase tracking-tight">Custom Certificate</h3>
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">AI-Powered Template Mapping</p>
                 </div>
              </div>
              <button 
                onClick={onOpenTemplateMapper}
                className="w-full bg-purple-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-purple-700 active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Map Custom Certificate Template
              </button>
           </div>

           <div className="p-8 bg-red-50 border-4 border-red-600 rounded-[2.5rem] space-y-4 shadow-2xl shadow-red-200">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-red-900 uppercase tracking-tight">Cloud Purge</h3>
                    <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">Irreversible Account Action</p>
                 </div>
              </div>
              <button 
                onClick={onPurge}
                className="w-full bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Request Cloud Data Purge
              </button>
           </div>

            <div className="p-8 bg-blue-50 border-4 border-blue-600 rounded-[2.5rem] space-y-4 shadow-2xl shadow-blue-200">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Data Portability</h3>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Export or Restore Registry Records</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={onExport}
                  className="bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-blue-700 active:scale-95 transition-all uppercase tracking-widest text-xs"
                >
                  Download Master Data
                </button>
                <button 
                  onClick={() => restoreInputRef.current?.click()}
                  className="bg-white text-blue-600 border-2 border-blue-600 font-black py-5 rounded-2xl shadow-xl hover:bg-blue-50 active:scale-95 transition-all uppercase tracking-widest text-xs"
                >
                  Restore from Backup
                </button>
                <input 
                  type="file" 
                  ref={restoreInputRef} 
                  onChange={handleRestore} 
                  accept=".json" 
                  className="hidden" 
                />
              </div>
           </div>

           <div className="p-8 bg-green-50 border-4 border-green-600 rounded-[2.5rem] space-y-4 shadow-2xl shadow-green-200">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 17v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m32 4l-4-4m0 0l-4 4m4-4V4" /></svg>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-green-900 uppercase tracking-tight">Bulk Import</h3>
                    <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Import Equipment from Excel</p>
                 </div>
              </div>
              <button 
                onClick={() => setShowBulkImport(true)}
                className="w-full bg-green-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-green-700 active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Upload Excel Spreadsheet
              </button>
           </div>

           <div className="p-8 bg-emerald-50 border-4 border-emerald-600 rounded-[2.5rem] space-y-4 shadow-2xl shadow-emerald-200">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-emerald-900 uppercase tracking-tight">Quote Catalog</h3>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Global Searchable Equipment List</p>
                 </div>
              </div>
              <button 
                onClick={() => setShowCatalogImport(true)}
                className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-emerald-700 active:scale-95 transition-all uppercase tracking-widest text-xs"
              >
                Upload Excel Equipment List
              </button>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 p-8 text-white flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Cloud Authentication</h2>
              <p className="text-slate-400 text-xs mt-1">Manage administrative access to the cloud registry.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${currentUser ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {currentUser ? 'Authenticated' : 'Not Signed In'}
              </span>
            </div>
        </div>
        <div className="p-8">
            <div className="p-8 bg-blue-50 border-4 border-blue-600 rounded-[2.5rem] space-y-6 shadow-2xl shadow-blue-200 max-w-md mx-auto">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-blue-900 uppercase tracking-tight">Identity Management</h3>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Secure Admin Access</p>
                 </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-white/50 rounded-2xl border-2 border-blue-100 space-y-2">
                  {currentUser ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-blue-900 uppercase tracking-widest">Active Session</p>
                        <span className="bg-emerald-100 text-emerald-700 text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Secure</span>
                      </div>
                      <p className="text-xs font-bold text-blue-600 truncate">{currentUser.email}</p>
                      <button 
                        onClick={() => supabase.auth.signOut()}
                        className="w-full bg-red-600 text-white text-[10px] font-black py-3 rounded-xl uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-black text-red-900 uppercase tracking-widest">Session Expired</p>
                        <span className="bg-red-100 text-red-700 text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Locked</span>
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            await supabase.auth.signInWithOAuth({ provider: 'google' });
                          } catch (err: any) {
                            alert("Login failed: " + err.message);
                          }
                        }}
                        className="w-full bg-blue-600 text-white text-[10px] font-black py-4 rounded-xl uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center gap-3"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.92 3.36-2.08 4.52-1.16 1.16-2.88 2.4-5.76 2.4-4.6 0-8.36-3.72-8.36-8.32s3.76-8.32 8.36-8.32c2.48 0 4.36.96 5.68 2.2l2.32-2.32C18.52 2.44 15.88 1 12.48 1 6.48 1 1.6 5.88 1.6 11.88s4.88 10.88 10.88 10.88c3.24 0 5.68-1.08 7.64-3.12 2-2 2.64-4.8 2.64-7.12 0-.44-.04-.88-.12-1.32h-10.16z"/></svg>
                        Sign In with Google
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 p-8 text-white">
            <h2 className="text-xl font-black uppercase tracking-tight">Cloud Settings</h2>
            <p className="text-slate-400 text-xs mt-1">Configure advanced cloud synchronization and recovery options.</p>
        </div>
        <div className="p-8 space-y-6">
           <div className="p-8 bg-slate-50 border-4 border-slate-900 rounded-[2.5rem] space-y-4 shadow-2xl shadow-slate-200">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                 </div>
                 <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Registry Sync Fix</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolve "Schema Cache" or "Empty Registry" Errors</p>
                 </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                <p className="text-[10px] font-bold text-slate-600 uppercase leading-relaxed">
                  If your registry is empty or you see missing column errors, you can retry the cloud synchronization.
                </p>
                <div className="flex gap-2">
                  <button 
                    onClick={onRetry}
                    className="flex-1 bg-slate-900 text-white font-black py-3 rounded-xl text-[9px] uppercase tracking-widest hover:bg-black transition-all"
                  >
                    Retry Cloud Sync
                  </button>
                </div>
              </div>
           </div>
        </div>
      </div>

      {showBulkImport && (
        <BulkImport 
          clients={clients}
          onComplete={() => {
            setShowBulkImport(false);
            onRefreshData();
          }}
          onCancel={() => setShowBulkImport(false)}
        />
      )}

      {showCatalogImport && (
        <QuoteCatalogImport 
          onComplete={() => {
            setShowCatalogImport(false);
            onRefreshData();
          }}
          onCancel={() => setShowCatalogImport(false)}
        />
      )}
    </div>
  );
};

export default AdminHub;
