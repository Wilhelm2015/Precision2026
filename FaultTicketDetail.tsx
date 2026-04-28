import React, { useState, useRef } from 'react';
import { Equipment, Client, FaultReport } from '../types';
import { syncService, compressImage, getProxiedImageUrl } from '../services/registryService';
import ImageModal from './ImageModal';

interface FaultReportFormProps {
  equipment: Equipment[];
  clients: Client[];
  onClose: () => void;
  onSave: (report: FaultReport) => void;
  validateSubmission: (equipmentId: string) => { allowed: boolean; reason?: string };
  preSelectedAssetId?: string;
  preSelectedClientId?: string;
}

const FaultReportForm: React.FC<FaultReportFormProps> = ({ equipment, clients, onClose, onSave, validateSubmission, preSelectedAssetId, preSelectedClientId }) => {
  const [step, setStep] = useState<'site' | 'asset' | 'details' | 'success'>(preSelectedAssetId ? 'details' : 'site');
  const [selectedClientId, setSelectedClientId] = useState(preSelectedClientId || '');
  const [selectedAssetId, setSelectedAssetId] = useState(preSelectedAssetId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastReportId, setLastReportId] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    reporterName: '',
    reporterContact: '',
    description: '',
    severity: 'Standard' as 'Critical' | 'Urgent' | 'Standard'
  });

  const handleBackStep = () => {
    if (step === 'success') {
      onClose();
    } else if (step === 'details') {
      setStep('asset');
    } else if (step === 'asset') {
      setStep('site');
    } else {
      handleClose();
    }
  };

  const handleClose = () => {
    if (formData.description || photos.length > 0) {
      if (window.confirm("Discard fault report details and exit?")) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const filteredEquipment = equipment.filter(e => e.client_id === selectedClientId && !e.isArchived);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const compressed = await compressImage(reader.result as string);
          const timestamp = Date.now();
          setPhotos(prev => [...prev, `${compressed}|${timestamp}`]);
        };
        reader.readAsDataURL(file as File);
      });
    }
  };

  const handleAssetSelect = (assetId: string) => {
    const validation = validateSubmission(assetId);
    if (!validation.allowed) {
      alert(validation.reason);
      return;
    }
    setSelectedAssetId(assetId);
    setStep('details');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || isSubmitting) return;

    const validation = validateSubmission(selectedAssetId);
    if (!validation.allowed) {
      alert(validation.reason);
      onClose();
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload photos to Supabase Storage
      const uploadedPhotoUrls = await Promise.all(
        photos.map(async (photoData, index) => {
          const [base64, timestamp] = photoData.includes('|') ? photoData.split('|') : [photoData, Date.now().toString()];
          const url = await syncService.uploadImage(base64, `faults/${selectedAssetId}/${timestamp}_${index}.jpg`);
          return `${url}|${timestamp}`;
        })
      );

      const now = new Date();
      const deadline = new Date(now);
      if (formData.severity === 'Critical') deadline.setHours(now.getHours() + 24);
      else if (formData.severity === 'Urgent') deadline.setHours(now.getHours() + 48);
      else deadline.setHours(now.getHours() + 72);

      const reportId = Math.random().toString(36).substr(2, 9).toUpperCase();
      const report: FaultReport = {
        id: reportId,
        equipmentId: selectedAssetId,
        reporterName: formData.reporterName,
        reporterContact: formData.reporterContact,
        description: formData.description,
        timestamp: now.toISOString(),
        status: 'Open',
        photos: uploadedPhotoUrls,
        severity: formData.severity,
        slaDeadline: deadline.toISOString()
      };
      await syncService.saveFaultReport(report);
      setLastReportId(reportId);
      onSave(report);
      setStep('success');
    } catch (err: any) {
      alert("Save failed: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95">
        <div className="bg-red-600 p-8 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={handleBackStep} className="p-2 hover:bg-white/10 rounded-xl flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
             </button>
             <div>
               <h3 className="text-xl font-black uppercase tracking-tight">Log Registry Incident</h3>
               <p className="text-[10px] text-red-100 font-black uppercase tracking-widest mt-1">Manual Fault Capture</p>
             </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">&times;</button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto">
          {step === 'site' && (
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Physical Site</label>
              <div className="grid grid-cols-1 gap-2">
                {clients.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => { setSelectedClientId(c.id); setStep('asset'); }}
                    className="w-full p-5 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 text-left transition-all"
                  >
                    <div className="font-black text-slate-900 uppercase text-xs">{c.name}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-1 truncate">{c.address}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'asset' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Malfunctioning Asset</label>
                 <button onClick={() => setStep('site')} className="text-[9px] font-black text-red-600 uppercase underline">Change Site</button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {filteredEquipment.length === 0 ? (
                  <p className="py-10 text-center text-slate-400 uppercase font-black text-[10px]">No assets found for this site.</p>
                ) : filteredEquipment.map(e => (
                  <button 
                    key={e.id} 
                    onClick={() => handleAssetSelect(e.id)}
                    className="w-full p-5 rounded-2xl border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 text-left transition-all"
                  >
                    <div className="font-black text-slate-900 uppercase text-xs">{e.serialNumber}</div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-1">{e.type} • {e.location}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Reporter Name</label>
                      <input required value={formData.reporterName} onChange={e => setFormData({...formData, reporterName: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Contact Number</label>
                      <input required value={formData.reporterContact} onChange={e => setFormData({...formData, reporterContact: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" />
                    </div>
                 </div>

                 <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">SLA Severity (Remediation Window)</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['Critical', 'Urgent', 'Standard'].map(s => (
                        <button 
                          key={s}
                          type="button"
                          onClick={() => setFormData({...formData, severity: s as any})}
                          className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border-2 ${
                            formData.severity === s ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-400 border-slate-100'
                          }`}
                        >
                          {s} {s === 'Critical' ? '(24h)' : s === 'Urgent' ? '(48h)' : '(72h)'}
                        </button>
                      ))}
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incident Photos</label>
                    <div className="flex flex-wrap gap-2">
                       {photos.map((p, i) => (
                         <div 
                           key={i} 
                           className="w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative group bg-white cursor-zoom-in hover:scale-105 transition-transform"
                           onClick={() => setSelectedImage(p.split('|')[0])}
                         >
                           <img src={getProxiedImageUrl(p.split('|')[0])} className="w-full h-full object-cover" alt="Incident" referrerPolicy="no-referrer" />
                         </div>
                       ))}
                       <button type="button" onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-600 transition-all bg-white">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                       </button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                 </div>

                 <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Problem Description</label>
                    <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm h-32 resize-none" />
                 </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                 <button type="submit" disabled={isSubmitting} className="flex-[2] bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-red-700 transition-all uppercase tracking-widest text-[10px]">
                    {isSubmitting ? 'Syncing...' : 'Save Fault Report'}
                 </button>
                 <button type="button" onClick={() => setStep('asset')} className="flex-1 bg-slate-100 text-slate-400 font-black py-5 rounded-2xl hover:bg-slate-200 uppercase tracking-widest text-[10px]">Back</button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-12 space-y-6 animate-in zoom-in-95">
               <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
               </div>
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Submitted</h2>
               <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Ticket ID: <span className="text-slate-900">{lastReportId}</span></p>
               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest px-10 leading-relaxed">The fault has been synchronized with the master registry. Technicians have been notified.</p>
               <div className="pt-8">
                  <button 
                    onClick={onClose}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-black transition-all"
                  >
                    Return to Hub
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>

      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
};

export default FaultReportForm;