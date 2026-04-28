import React, { useState } from 'react';
import { FaultReport, Equipment, Client, Technician } from '../types';
import { BrandLogo } from './Brand';
import { syncService, getProxiedImageUrl } from '../services/registryService';
import ImageModal from './ImageModal';

interface FaultTicketDetailProps {
  fault: FaultReport;
  equipment?: Equipment;
  client?: Client;
  technicians: Technician[];
  isManager: boolean;
  onClose: () => void;
  onResolve: (id: string) => void;
  onRefresh: () => void;
}

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-ZA', { 
      day: 'numeric', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  } catch { return dateStr; }
};

const FaultTicketDetail: React.FC<FaultTicketDetailProps> = ({ 
  fault, equipment, client, technicians, isManager, onClose, onResolve, onRefresh 
}) => {
  const [isAllocating, setIsAllocating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionPhotos, setResolutionPhotos] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const assignedTech = technicians.find(t => t.id === fault.assignedTechnicianId);
  const isAllTechs = fault.assignedTechnicianId === 'ALL_TECHS';

  const handleAllocate = async (techId: string) => {
    if (!techId) return;
    setIsAllocating(true);
    try {
      await syncService.assignFaultTechnician(fault.id, techId);
      onRefresh();
    } catch (err: any) {
      alert("Allocation failed: " + err.message);
    } finally {
      setIsAllocating(false);
    }
  };

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      alert("Please provide technical notes for the resolution.");
      return;
    }
    if (resolutionPhotos.length === 0) {
      alert("Technician must take at least one photo for resolution.");
      return;
    }
    setIsResolving(true);
    try {
      await syncService.updateFaultStatus(fault.id, 'Resolved', resolutionNotes, resolutionPhotos);
      onResolve(fault.id);
    } catch (err: any) {
      alert("Resolution failure: " + err.message);
    } finally {
      setIsResolving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const timestamp = Date.now();
        const url = await syncService.uploadImage(base64, `faults/resolution_${fault.id}_${timestamp}_${i}.jpg`);
        setResolutionPhotos(prev => [...prev, `${url}|${timestamp}`]);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Fault Control Center</h2>
              <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em]">Ticket ID: {fault.id.toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* LEFT PANEL: Reported Incident */}
            <div className="space-y-8">
               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] border-b pb-2">Reporter Evidence</h3>
                  <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner space-y-6">
                     <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Observation</p>
                        <p className="text-lg font-bold text-slate-900 leading-relaxed italic">"{fault.description}"</p>
                     </div>
                     <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200">
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Logged By</p>
                           <p className="text-sm font-black text-slate-800">{fault.reporterName}</p>
                           <p className="text-[10px] font-bold text-slate-500 mt-1">{fault.reporterContact}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Timestamp</p>
                           <p className="text-sm font-black text-slate-800">{fault.timestamp ? formatDate(fault.timestamp) : '---'}</p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] border-b pb-2">Visual Documentation</h3>
                  {fault.photos && fault.photos.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                       {fault.photos.map((p, i) => (
                         <div 
                           key={i} 
                           className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-100 shadow-sm bg-white cursor-zoom-in hover:scale-105 transition-transform"
                           onClick={() => setSelectedImage(p.split('|')[0])}
                         >
                            <img src={getProxiedImageUrl(p.split('|')[0])} className="w-full h-full object-cover" alt="Evidence" referrerPolicy="no-referrer" />
                         </div>
                       ))}
                    </div>
                  ) : (
                    <div className="py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-center text-slate-400 font-bold uppercase text-[10px]">No photos provided</div>
                  )}
                  
                  {fault.status === 'Resolved' && fault.resolutionPhotos && fault.resolutionPhotos.length > 0 && (
                    <div className="space-y-4 mt-6">
                      <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em] border-b border-emerald-50 pb-2">Resolution Evidence</h3>
                      <div className="flex flex-wrap gap-3">
                        {fault.resolutionPhotos.map((p, i) => (
                          <div 
                            key={i} 
                            className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-sm bg-white cursor-zoom-in hover:scale-105 transition-transform"
                            onClick={() => setSelectedImage(p.split('|')[0])}
                          >
                            <img src={getProxiedImageUrl(p.split('|')[0])} className="w-full h-full object-cover" alt="Resolution Evidence" referrerPolicy="no-referrer" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
               </div>
            </div>

            {/* RIGHT PANEL: Asset Context & Allocation */}
            <div className="space-y-8">
               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] border-b pb-2">Registry Context</h3>
                  <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white space-y-6 shadow-xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 p-8 opacity-10">
                        <BrandLogo className="w-24 h-24" />
                     </div>
                     <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                           <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Active Incident</span>
                           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">{client?.name}</p>
                        </div>
                        <h4 className="text-3xl font-black uppercase tracking-tight leading-none">{equipment?.serialNumber}</h4>
                        <p className="text-xs text-red-500 font-black uppercase tracking-widest mt-2">{equipment?.type} {equipment?.size ? `• ${equipment.size}` : ''}</p>
                     </div>
                     <div className="relative z-10 pt-6 border-t border-white/10 grid grid-cols-2 gap-4">
                        <div>
                           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Site Location</p>
                           <p className="text-[11px] font-bold uppercase truncate">{equipment?.location}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Site Address</p>
                           <p className="text-[10px] font-bold text-slate-300 truncate">{client?.address}</p>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] border-b pb-2">Fleet Allocation</h3>
                  <div className="p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] space-y-6">
                     <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${assignedTech || isAllTechs ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        </div>
                        <div className="flex-1">
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assigned Specialist</p>
                           <h5 className="font-black text-slate-900 uppercase">
                             {isAllTechs ? 'Fleet Wide (All Technicians)' : (assignedTech ? assignedTech.name : 'Awaiting Allocation')}
                           </h5>
                        </div>
                     </div>

                     {fault.status === 'Open' && (
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                           <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Re-allocate Ticket</label>
                           <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto scrollbar-hide">
                              <button 
                                 onClick={() => handleAllocate('ALL_TECHS')}
                                 disabled={isAllocating}
                                 className={`w-full p-4 rounded-xl border-2 text-left transition-all text-xs font-black uppercase tracking-tight ${isAllTechs ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-900 text-white border-slate-900 hover:bg-black'}`}
                              >
                                 Broadcast to All Technicians
                              </button>
                              <div className="h-px bg-slate-100 my-1" />
                              {technicians.map(t => (
                                 <button 
                                    key={t.id} 
                                    onClick={() => handleAllocate(t.id)}
                                    disabled={isAllocating}
                                    className={`w-full p-4 rounded-xl border-2 text-left transition-all text-xs font-black uppercase tracking-tight ${assignedTech?.id === t.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-100 hover:border-slate-300'}`}
                                 >
                                    {t.name} ({t.saqcc})
                                 </button>
                              ))}
                           </div>
                        </div>
                     )}
                  </div>
               </div>

               {fault.status === 'Open' && !isManager && (
                  <div className="space-y-4">
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] border-b pb-2">Remediation Resolution</h3>
                     <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-200 space-y-6">
                        <textarea 
                           placeholder="Enter technical resolution details..." 
                           value={resolutionNotes}
                           onChange={e => setResolutionNotes(e.target.value)}
                           className="w-full h-32 p-5 bg-white border border-slate-200 rounded-3xl text-sm font-medium outline-none focus:border-red-500 transition-all resize-none"
                        />
                        
                        <div className="space-y-2">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolution Photos</label>
                          <div className="flex flex-wrap gap-2">
                            {resolutionPhotos.map((p, i) => (
                              <div key={i} className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200">
                                <img src={getProxiedImageUrl(p.split('|')[0])} className="w-full h-full object-cover" alt="Resolution" referrerPolicy="no-referrer" />
                              </div>
                            ))}
                            <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-emerald-500 transition-all">
                              <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
                              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </label>
                          </div>
                        </div>

                        <button 
                           onClick={handleResolve}
                           disabled={isResolving || !resolutionNotes.trim()}
                           className="w-full bg-emerald-600 text-white font-black py-5 rounded-3xl shadow-xl hover:bg-emerald-700 active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                        >
                           {isResolving ? 'Updating Registry...' : 'Resolve Ticket'}
                        </button>
                     </div>
                  </div>
               )}
               {fault.status === 'Open' && isManager && (
                 <div className="p-8 bg-amber-50 rounded-[2.5rem] border border-amber-200 text-center">
                   <p className="text-xs font-bold text-amber-800 uppercase tracking-tight">Managerial Oversight Mode</p>
                   <p className="text-[10px] text-amber-600 mt-2">Managers allocate tickets to technicians. Resolution must be performed by the assigned specialist.</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
};

export default FaultTicketDetail;