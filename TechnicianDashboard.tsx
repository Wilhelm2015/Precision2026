import React, { useState, useRef, useEffect } from 'react';
import { Technician } from '../types';
import TechBadgeModal from './TechBadgeModal';
import { compressImage, syncService, getProxiedImageUrl } from '../services/registryService';
import * as pdfjs from 'pdfjs-dist';

// Set worker source for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TechnicianManagerProps {
  technicians: Technician[];
  onAdd: (tech: Technician) => void | Promise<void>;
  onUpdate: (tech: Technician) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
}

const TechnicianManager: React.FC<TechnicianManagerProps> = ({ technicians, onAdd, onUpdate, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [isAddingSubUser, setIsAddingSubUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [editingSubUser, setEditingSubUser] = useState<{ techId: string, subUser: any } | null>(null);
  const [viewingBadge, setViewingBadge] = useState<Technician | null>(null);
  const [formData, setFormData] = useState({ name: '', saqcc: '', email: '', cellphone: '', pin: '', role: 'technician' as 'admin' | 'technician' | 'manager' });
  const [subUserFormData, setSubUserFormData] = useState({ name: '', pin: '', parentTechId: '' });
  const [subUserSignature, setSubUserSignature] = useState<string | null>(null);
  const [subUserSignatureMode, setSubUserSignatureMode] = useState<'draw' | 'type'>('draw');
  const [subUserTypedSignature, setSubUserTypedSignature] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [saqccCards, setSaqccCards] = useState<{ [year: string]: string }>({});
  const [cardPhoto, setCardPhoto] = useState<string | null>(null);
  const [subUserCardPhoto, setSubUserCardPhoto] = useState<string | null>(null);
  const [croppingForSubUser, setCroppingForSubUser] = useState(false);
  const [pendingCardImage, setPendingCardImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'tech' | 'subuser', id: string, name: string, parentId?: string } | null>(null);
  const [cropSelection, setCropSelection] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isDrawingCrop, setIsDrawingCrop] = useState(false);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const subUserCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTech) {
      const cards = editingTech.saqccCards && !Array.isArray(editingTech.saqccCards) ? editingTech.saqccCards : {};
      setSaqccCards(cards);
      setCardPhoto(cards[selectedYear] || editingTech.saqccCardPhoto || null);
    }
  }, [editingTech, selectedYear]);

  useEffect(() => {
    if (isAdding && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
      }
    }
  }, [isAdding]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    if ('touches' in e) e.preventDefault();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    if ('touches' in e) e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature(null);
  };

  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
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
            setPendingCardImage(canvas.toDataURL('image/jpeg', 0.8));
            setIsCropping(true);
          }
        } else {
          const reader = new FileReader();
          const result = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          setPendingCardImage(result);
          setIsCropping(true);
        }
      } catch (err: any) {
        console.error("Card processing error:", err);
        alert("Failed to process file: " + err.message);
      }
    }
    e.target.value = '';
  };

  const handleCropComplete = () => {
    if (!pendingCardImage || !cropSelection.width || !cropSelection.height) return;
    
    const img = new Image();
    img.src = pendingCardImage;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Reduced resolution for the card to save data
      canvas.width = 600; 
      canvas.height = 380;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(
          img, 
          cropSelection.x, cropSelection.y, cropSelection.width, cropSelection.height,
          0, 0, canvas.width, canvas.height
        );
        if (croppingForSubUser) {
          setSubUserCardPhoto(canvas.toDataURL('image/jpeg', 0.4));
        } else {
          const newPhoto = canvas.toDataURL('image/jpeg', 0.4);
          setCardPhoto(newPhoto);
          setSaqccCards(prev => ({ ...prev, [selectedYear]: newPhoto }));
        }
        setIsCropping(false);
        setPendingCardImage(null);
        setCropSelection({ x: 0, y: 0, width: 0, height: 0 });
        setCroppingForSubUser(false);
      }
    };
  };

  const handleRotateCard = () => {
    if (!cardPhoto) return;
    const img = new Image();
    img.src = cardPhoto;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(90 * Math.PI / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        setCardPhoto(canvas.toDataURL('image/jpeg', 0.5));
      }
    };
  };

  const startCropDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawingCrop(true);
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    setCropSelection({ x, y, width: 0, height: 0 });
  };

  const drawCrop = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingCrop) return;
    const canvas = cropCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const currentX = (clientX - rect.left) * (canvas.width / rect.width);
    const currentY = (clientY - rect.top) * (canvas.height / rect.height);
    
    setCropSelection(prev => ({
      ...prev,
      width: currentX - prev.x,
      height: currentY - prev.y
    }));
  };

  const stopCropDrawing = () => {
    setIsDrawingCrop(false);
  };

  useEffect(() => {
    if (isCropping && pendingCardImage && cropCanvasRef.current) {
      const canvas = cropCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.src = pendingCardImage;
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
      };
    }
  }, [isCropping, pendingCardImage]);

  const handleSubUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subUserFormData.parentTechId) {
      alert("Please select a technician to allocate this sub-user to.");
      return;
    }
    if (subUserFormData.pin.length !== 5) {
      alert("PIN must be exactly 5 digits.");
      return;
    }

    setIsSaving(true);
    try {
      const parentTech = technicians.find(t => t.id === subUserFormData.parentTechId);
      if (!parentTech) throw new Error("Parent technician not found. Please refresh and try again.");

      console.log("Creating sub-user for tech:", parentTech.name, "ID:", parentTech.id);

      let finalSubSignature = subUserSignature;
      if (subUserSignatureMode === 'type' && subUserTypedSignature) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 200;
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
          tctx.fillStyle = 'white';
          tctx.fillRect(0, 0, 400, 200);
          tctx.font = 'italic 40px "Brush Script MT", cursive';
          tctx.fillStyle = '#0f172a';
          tctx.textAlign = 'center';
          tctx.fillText(subUserTypedSignature, 200, 110);
          finalSubSignature = tempCanvas.toDataURL('image/jpeg', 0.3);
        }
      } else if (subUserCanvasRef.current) {
        const isBlank = !ctxIsModified(subUserCanvasRef.current);
        if (!isBlank) {
          const canvas = subUserCanvasRef.current;
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tctx = tempCanvas.getContext('2d');
          if (tctx) {
            tctx.fillStyle = 'white';
            tctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tctx.drawImage(canvas, 0, 0);
            finalSubSignature = tempCanvas.toDataURL('image/jpeg', 0.3);
          }
        }
      }

      const safeEmail = (parentTech.email || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
      const subUserId = editingSubUser?.subUser.id || Math.random().toString(36).substr(2, 9);
      
      let uploadedSubSignature = finalSubSignature;
      if (finalSubSignature && finalSubSignature.startsWith('data:image')) {
        uploadedSubSignature = await syncService.uploadImage(finalSubSignature, `techs/${safeEmail}/sub_${subUserId}_sig_${Date.now()}.png`);
      }

      let uploadedSubCard = subUserCardPhoto;
      if (subUserCardPhoto && subUserCardPhoto.startsWith('data:image')) {
        uploadedSubCard = await syncService.uploadImage(subUserCardPhoto, `techs/${safeEmail}/sub_${subUserId}_card_${Date.now()}.jpg`);
      }

      const newSubUser = {
        id: subUserId,
        name: subUserFormData.name,
        pin: subUserFormData.pin,
        signature: uploadedSubSignature || undefined,
        saqccCardPhoto: uploadedSubCard || undefined
      };

      // Ensure subUsers is an array
      const currentSubUsers = Array.isArray(parentTech.subUsers) ? parentTech.subUsers : [];

      const updatedTech = {
        ...parentTech,
        subUsers: editingSubUser 
          ? currentSubUsers.map(s => s.id === editingSubUser.subUser.id ? newSubUser : s)
          : [...currentSubUsers, newSubUser]
      };

      console.log("Saving updated tech with sub-users:", updatedTech.subUsers.length);
      await onUpdate(updatedTech);
      console.log("Successfully updated technician with new sub-user");
      setIsAddingSubUser(false);
      setEditingSubUser(null);
      setSubUserFormData({ name: '', pin: '', parentTechId: '' });
      setSubUserSignature(null);
      setSubUserTypedSignature('');
      setSubUserCardPhoto(null);
      
      // Clear sub-user canvas after submit
      if (subUserCanvasRef.current) {
        const ctx = subUserCanvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, subUserCanvasRef.current.width, subUserCanvasRef.current.height);
      }
    } catch (err: any) {
      alert("Sub-User Registry Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubUser = async (techId: string, subUserId: string, subUserName: string) => {
    setConfirmAction({ type: 'subuser', id: subUserId, name: subUserName, parentId: techId });
  };

  const executeDelete = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === 'tech') {
      try {
        await onDelete(confirmAction.id);
      } catch (err: any) {
        alert("Error removing technician: " + err.message);
      }
    } else if (confirmAction.type === 'subuser' && confirmAction.parentId) {
      const tech = technicians.find(t => t.id === confirmAction.parentId);
      if (!tech) return;

      const updatedTech = {
        ...tech,
        subUsers: (tech.subUsers || []).filter(s => s.id !== confirmAction.id)
      };

      try {
        await onUpdate(updatedTech);
      } catch (err: any) {
        alert("Error removing sub-user: " + err.message);
      }
    }
    setConfirmAction(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.pin.length !== 5) {
      alert("SANS Standard Security requires exactly 5 digits for a technician PIN.");
      return;
    }

    setIsSaving(true);
    try {
      const canvas = canvasRef.current;
      let finalSignature = signature;
      
      if (signatureMode === 'type' && typedSignature) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 200;
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
          tctx.fillStyle = 'white';
          tctx.fillRect(0, 0, 400, 200);
          tctx.font = 'italic 40px "Brush Script MT", cursive';
          tctx.fillStyle = '#0f172a';
          tctx.textAlign = 'center';
          tctx.fillText(typedSignature, 200, 110);
          finalSignature = tempCanvas.toDataURL('image/jpeg', 0.3);
        }
      } else if (canvas) {
        const isBlank = !ctxIsModified(canvas);
        if (!isBlank) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tctx = tempCanvas.getContext('2d');
          if (tctx) {
            tctx.fillStyle = 'white';
            tctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tctx.drawImage(canvas, 0, 0);
            finalSignature = tempCanvas.toDataURL('image/jpeg', 0.3);
          }
        }
      }

      const techId = editingTech?.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9));
      const safeEmail = formData.email.replace(/[^a-zA-Z0-9]/g, '_');
      
      let uploadedSignature = finalSignature;
      if (finalSignature && finalSignature.startsWith('data:image')) {
        uploadedSignature = await syncService.uploadImage(finalSignature, `techs/${safeEmail}/${techId}_sig_${Date.now()}.png`);
      }

      let uploadedCardPhoto = cardPhoto;
      if (cardPhoto && cardPhoto.startsWith('data:image')) {
        uploadedCardPhoto = await syncService.uploadImage(cardPhoto, `techs/${safeEmail}/${techId}_card_${Date.now()}.jpg`);
      }

      const uploadedSaqccCards: { [year: string]: string } = {};
      for (const [year, card] of Object.entries(saqccCards)) {
        if (card.startsWith('data:image')) {
          uploadedSaqccCards[year] = await syncService.uploadImage(card, `techs/${safeEmail}/${techId}_card_${year}_${Date.now()}.jpg`);
        } else {
          uploadedSaqccCards[year] = card;
        }
      }

      if (editingTech) {
        await onUpdate({ 
          ...editingTech, 
          ...formData, 
          signature: uploadedSignature || undefined, 
          saqccCardPhoto: uploadedCardPhoto || undefined,
          saqccCards: uploadedSaqccCards
        });
        setEditingTech(null);
      } else {
        await onAdd({ 
          id: techId, 
          userid: formData.email, 
          ...formData,
          signature: uploadedSignature || undefined,
          saqccCardPhoto: uploadedCardPhoto || undefined,
          saqccCards: uploadedSaqccCards,
          subUsers: []
        });
        setIsAdding(false);
      }
      setFormData({ name: '', saqcc: '', email: '', cellphone: '', pin: '', role: 'technician' });
      setSignature(null);
      setTypedSignature('');
      setCardPhoto(null);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    } catch (err: any) {
      alert("Technician Registry Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const ctxIsModified = (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const pixelBuffer = new Uint32Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer);
    return pixelBuffer.some(color => color !== 0);
  };

  const handleEdit = (tech: Technician) => {
    setEditingTech(tech);
    setFormData({ 
      name: tech.name, 
      saqcc: tech.saqcc, 
      email: tech.email, 
      cellphone: tech.cellphone || '', 
      pin: tech.pin || '',
      role: tech.role || 'technician'
    });
    setSignature(tech.signature || null);
    setTypedSignature('');
    setCardPhoto(tech.saqccCardPhoto || null);
    
    // Clear canvas when starting edit
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    
    setIsAdding(true);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {viewingBadge && <TechBadgeModal technician={viewingBadge} onClose={() => setViewingBadge(null)} />}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Technician Fleet</h2>
          <p className="text-sm text-slate-500">Manage SAQCC certified technicians authorized to use this platform.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { 
              setIsAddingSubUser(true); 
              setIsAdding(false);
              setEditingSubUser(null);
              setSubUserFormData({ name: '', pin: '', parentTechId: technicians[0]?.id || '' }); 
              setSubUserSignature(null);
              setSubUserTypedSignature('');
              setSubUserCardPhoto(null);
              
              // Clear sub-user canvas
              if (subUserCanvasRef.current) {
                const ctx = subUserCanvasRef.current.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, subUserCanvasRef.current.width, subUserCanvasRef.current.height);
              }
            }}
            className="bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest px-8 py-4 rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-900/20 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            Add Sub-User
          </button>
          <button 
            onClick={() => { 
              setIsAdding(true); 
              setIsAddingSubUser(false);
              setEditingTech(null); 
              setSignature(null);
              setTypedSignature('');
              setCardPhoto(null);
              setFormData({ name: '', saqcc: '', email: '', cellphone: '', pin: '', role: 'technician' }); 
              
              // Clear canvas for new tech
              const canvas = canvasRef.current;
              if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
              }
            }}
            className="bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest px-8 py-4 rounded-2xl hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
            Add Technician
          </button>
        </div>
      </div>

      {isAddingSubUser && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-2 border-blue-100 animate-in slide-in-from-top duration-500 mb-8">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight leading-none">
                {editingSubUser ? 'Edit Sub-User Profile' : 'Register New Sub-User'}
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                {editingSubUser ? 'Update credentials and identity' : 'Assign a new sub-user to a parent technician'}
              </p>
            </div>
          </div>
          <form onSubmit={handleSubUserSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assistant Name</label>
              <input required value={subUserFormData.name} onChange={e => setSubUserFormData({...subUserFormData, name: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-semibold" placeholder="Full Name" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access PIN (5 Digits)</label>
              <input required type="text" pattern="[0-9]{5}" maxLength={5} value={subUserFormData.pin} onChange={e => setSubUserFormData({...subUserFormData, pin: e.target.value.replace(/\D/g, '')})} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-black tracking-[1em] text-center bg-slate-50" placeholder="00000" />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Allocate to Technician</label>
              <select required value={subUserFormData.parentTechId} onChange={e => setSubUserFormData({...subUserFormData, parentTechId: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-black text-sm appearance-none bg-white" disabled={!!editingSubUser}>
                <option value="">Select Parent Tech</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name} ({t.saqcc})</option>)}
              </select>
            </div>

            <div className="md:col-span-3 space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assistant SAQCC Card</label>
                {subUserCardPhoto && (
                  <button type="button" onClick={() => setSubUserCardPhoto(null)} className="text-[8px] font-black text-red-600 uppercase px-2 py-1">Remove Card</button>
                )}
              </div>
              
              <div 
                onClick={() => {
                  setCroppingForSubUser(true);
                  fileInputRef.current?.click();
                }}
                className={`aspect-[1.58/1] w-full max-w-md mx-auto rounded-3xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group ${subUserCardPhoto ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'}`}
              >
                {subUserCardPhoto ? (
                  <>
                    <img src={getProxiedImageUrl(subUserCardPhoto)} className="w-full h-full object-cover" alt="Sub-User Card" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white font-black uppercase text-[10px] tracking-widest">Change Card</p>
                    </div>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scan Assistant Card</p>
                  </>
                )}
              </div>
            </div>

            <div className="md:col-span-3 space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assistant Signature</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSubUserSignatureMode('draw')} className={`text-[8px] font-black uppercase px-2 py-1 rounded ${subUserSignatureMode === 'draw' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>Draw</button>
                  <button type="button" onClick={() => setSubUserSignatureMode('type')} className={`text-[8px] font-black uppercase px-2 py-1 rounded ${subUserSignatureMode === 'type' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>Type</button>
                  <button type="button" onClick={() => { 
                    const canvas = subUserCanvasRef.current;
                    if (canvas) {
                      const ctx = canvas.getContext('2d');
                      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                    setSubUserSignature(null); 
                    setSubUserTypedSignature(''); 
                  }} className="text-[8px] font-black text-red-600 uppercase px-2 py-1">Clear</button>
                </div>
              </div>
              
              {subUserSignatureMode === 'type' ? (
                <div className="h-[160px] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6 space-y-2">
                  <input 
                    type="text" 
                    value={subUserTypedSignature} 
                    onChange={e => setSubUserTypedSignature(e.target.value)} 
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-3 outline-none focus:border-red-500 font-bold text-center text-lg italic" 
                    placeholder="Type Assistant Name" 
                  />
                  <div className="text-2xl italic text-slate-800 font-serif" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                    {subUserTypedSignature || 'Signature Preview'}
                  </div>
                </div>
              ) : (
                <div className="relative h-[160px] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden">
                  <canvas 
                    ref={subUserCanvasRef} 
                    width={400} 
                    height={160} 
                    onMouseDown={(e) => {
                      const canvas = subUserCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      ctx.strokeStyle = '#0f172a';
                      ctx.lineWidth = 3;
                      ctx.lineCap = 'round';
                      const rect = canvas.getBoundingClientRect();
                      ctx.beginPath();
                      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
                      (canvas as any).isDrawing = true;
                    }}
                    onMouseMove={(e) => {
                      const canvas = subUserCanvasRef.current;
                      if (!canvas || !(canvas as any).isDrawing) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                      ctx.stroke();
                    }}
                    onMouseUp={() => {
                      const canvas = subUserCanvasRef.current;
                      if (canvas) (canvas as any).isDrawing = false;
                    }}
                    onMouseLeave={() => {
                      const canvas = subUserCanvasRef.current;
                      if (canvas) (canvas as any).isDrawing = false;
                    }}
                    onTouchStart={(e) => {
                      const canvas = subUserCanvasRef.current;
                      if (!canvas) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      ctx.strokeStyle = '#0f172a';
                      ctx.lineWidth = 3;
                      ctx.lineCap = 'round';
                      const rect = canvas.getBoundingClientRect();
                      const touch = e.touches[0];
                      ctx.beginPath();
                      ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
                      (canvas as any).isDrawing = true;
                      e.preventDefault();
                    }}
                    onTouchMove={(e) => {
                      const canvas = subUserCanvasRef.current;
                      if (!canvas || !(canvas as any).isDrawing) return;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      const rect = canvas.getBoundingClientRect();
                      const touch = e.touches[0];
                      ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
                      ctx.stroke();
                      e.preventDefault();
                    }}
                    onTouchEnd={(e) => {
                      const canvas = subUserCanvasRef.current;
                      if (canvas) (canvas as any).isDrawing = false;
                      e.preventDefault();
                    }}
                    className="w-full h-full cursor-crosshair touch-none"
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-3 flex gap-3 mt-4 pt-6 border-t border-slate-50">
              <button disabled={isSaving} type="submit" className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-red-700 transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                {isSaving ? 'Syncing...' : editingSubUser ? 'Update Assistant' : 'Save Sub-User'}
              </button>
              <button disabled={isSaving} type="button" onClick={() => { setIsAddingSubUser(false); setEditingSubUser(null); }} className="px-8 border border-slate-200 rounded-2xl text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {isAdding && (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden p-8 animate-in slide-in-from-top-4 duration-300">
          <h3 className="font-black text-slate-900 uppercase tracking-tighter mb-6">{editingTech ? 'Edit Profile' : 'Register New Member'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Basic Details</label>
              <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-semibold" placeholder="Full Name" />
              <input required value={formData.saqcc} onChange={e => setFormData({...formData, saqcc: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-semibold" placeholder="SAQCC No. (e.g. 15/104)" />
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-semibold" placeholder="Work Email" />
              <input value={formData.cellphone} onChange={e => setFormData({...formData, cellphone: e.target.value})} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-semibold" placeholder="Cellphone" />
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Access PIN (Exactly 5 Digits)</label>
                <input required type="text" pattern="[0-9]{5}" maxLength={5} value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-black tracking-[1em] text-center bg-slate-50" placeholder="00000" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Platform Role</label>
                <select 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value as 'admin' | 'technician' | 'manager'})}
                  className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-bold text-sm bg-white"
                >
                  <option value="technician">Field Technician</option>
                  <option value="admin">System Administrator</option>
                  <option value="manager">Site Manager</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Regulatory SAQCC Card</label>
              <div className="flex gap-2 items-center mb-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year:</label>
                <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold">
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className={`relative aspect-[1.58/1] w-full max-w-[320px] mx-auto bg-slate-50 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden shadow-inner ${cardPhoto ? 'border-emerald-200 shadow-emerald-50/50' : 'border-slate-200 shadow-slate-100/50'}`}>
                {cardPhoto ? (
                  <div className="absolute inset-0">
                    <img src={getProxiedImageUrl(cardPhoto)} className="w-full h-full object-cover" alt="SAQCC Card" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                       <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-white text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-xl hover:scale-105 transition-transform">Replace</button>
                       <button type="button" onClick={handleRotateCard} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-xl flex items-center gap-2 hover:scale-105 transition-transform">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Rotate
                       </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-slate-400 hover:text-slate-600 transition-all">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                    <span className="text-[10px] font-black uppercase">Capture Card</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={handleCardUpload} />
              </div>
              <p className="text-[9px] text-slate-400 font-medium leading-relaxed italic text-center">
                Capture the front of the SAQCC registration card for {selectedYear}.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Official Signature</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSignatureMode('draw')} className={`text-[8px] font-black uppercase px-2 py-1 rounded ${signatureMode === 'draw' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>Draw</button>
                  <button type="button" onClick={() => setSignatureMode('type')} className={`text-[8px] font-black uppercase px-2 py-1 rounded ${signatureMode === 'type' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>Type</button>
                  <button type="button" onClick={() => { clearSignature(); setTypedSignature(''); }} className="text-[8px] font-black text-red-600 uppercase px-2 py-1">Clear</button>
                </div>
              </div>
              
              {signatureMode === 'type' ? (
                <div className="h-[240px] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-6 space-y-4">
                  <input 
                    type="text" 
                    value={typedSignature} 
                    onChange={e => setTypedSignature(e.target.value)} 
                    className="w-full bg-white border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-bold text-center text-xl italic" 
                    placeholder="Type Name for Signature" 
                  />
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Preview</p>
                  <div className="text-3xl italic text-slate-800 font-serif" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                    {typedSignature || 'Signature Preview'}
                  </div>
                </div>
              ) : (
                <div className="relative h-[240px] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden">
                  {signature && !isDrawing ? (
                     <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                        <img src={getProxiedImageUrl(signature)} className="max-h-full opacity-80" alt="Current Signature" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-slate-900/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                           <span className="bg-white px-4 py-2 rounded-full text-[10px] font-black uppercase shadow-lg">Click Pad to Recapture</span>
                        </div>
                     </div>
                  ) : null}
                  <canvas 
                    ref={canvasRef} 
                    width={400} 
                    height={240} 
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="w-full h-full cursor-crosshair touch-none"
                  />
                </div>
              )}
            </div>

            <div className="lg:col-span-3 flex gap-3 mt-4 pt-6 border-t border-slate-50">
              <button disabled={isSaving} type="submit" className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-red-700 transition-all uppercase tracking-widest text-xs disabled:opacity-50">
                {isSaving ? 'Syncing to Registry...' : editingTech ? 'Update Registry' : 'Save Technician'}
              </button>
              <button disabled={isSaving} type="button" onClick={() => setIsAdding(false)} className="px-8 border border-slate-200 rounded-2xl text-slate-400 font-bold uppercase tracking-widest text-[10px]">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicians.map(tech => (
          <div key={tech.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-20">
              <button onClick={() => handleEdit(tech)} className="bg-slate-100 p-2 rounded-xl text-slate-600 hover:bg-slate-200 shadow-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
              <button onClick={() => setConfirmAction({ type: 'tech', id: tech.id, name: tech.name })} className="bg-red-50 p-2 rounded-xl text-red-600 hover:bg-red-100 shadow-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h7" /></svg></button>
            </div>
            <div className="flex flex-col items-center text-center space-y-4 flex-1">
              <div className="w-20 h-20 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center font-black text-2xl shadow-xl relative overflow-hidden">
                {tech.name.charAt(0)}
              </div>
              <div>
                <h4 className="font-black text-slate-900 uppercase tracking-tighter">{tech.name}</h4>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">SAQCC: {tech.saqcc}</p>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${tech.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'}`}>
                    {tech.role || 'technician'}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-center gap-2 mt-2">
                 <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${tech.saqccCardPhoto ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                   {tech.saqccCardPhoto ? 'Card Linked' : 'No Card'}
                 </div>
                 <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${tech.signature ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                   {tech.signature ? 'Signed' : 'No Sign'}
                 </div>
              </div>

              {tech.subUsers && tech.subUsers.length > 0 && (
                <div className="w-full pt-4 mt-4 border-t border-slate-50 space-y-2">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-left">Assistants:</p>
                  <div className="space-y-1">
                    {tech.subUsers.map(sub => (
                      <div key={sub.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-700">{sub.name}</span>
                        <div className="flex items-center gap-2">
                          {sub.saqccCardPhoto && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]" title="SAQCC Card Linked"></div>
                          )}
                          <span className="text-[8px] font-black text-slate-400 tracking-widest">{sub.pin}</span>
                          <button onClick={() => {
                                setEditingSubUser({ techId: tech.id, subUser: sub });
                                setSubUserFormData({ name: sub.name, pin: sub.pin, parentTechId: tech.id });
                                setSubUserSignature(sub.signature || null);
                                setSubUserTypedSignature('');
                                setSubUserCardPhoto(sub.saqccCardPhoto || null);
                                setIsAddingSubUser(true);
                                
                                // Clear sub-user canvas when starting edit
                                if (subUserCanvasRef.current) {
                                  const ctx = subUserCanvasRef.current.getContext('2d');
                                  if (ctx) ctx.clearRect(0, 0, subUserCanvasRef.current.width, subUserCanvasRef.current.height);
                                }
                              }} className="text-slate-300 hover:text-blue-600 transition-colors">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => handleDeleteSubUser(tech.id, sub.id, sub.name)} className="text-slate-300 hover:text-red-600 transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isCropping && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">Scan SAQCC Card</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Drag a box over the card on the page</p>
              </div>
              <button onClick={() => setIsCropping(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center relative">
              <div className="relative cursor-crosshair shadow-2xl">
                <canvas 
                  ref={cropCanvasRef}
                  onMouseDown={startCropDrawing}
                  onMouseMove={drawCrop}
                  onMouseUp={stopCropDrawing}
                  onMouseLeave={stopCropDrawing}
                  onTouchStart={startCropDrawing}
                  onTouchMove={drawCrop}
                  onTouchEnd={stopCropDrawing}
                  className="max-w-full h-auto block"
                />
                {cropSelection.width !== 0 && (
                  <div 
                    className="absolute border-4 border-red-500 bg-red-500/10 pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
                    style={{
                      left: `${(Math.min(cropSelection.x, cropSelection.x + cropSelection.width) / (cropCanvasRef.current?.width || 1)) * 100}%`,
                      top: `${(Math.min(cropSelection.y, cropSelection.y + cropSelection.height) / (cropCanvasRef.current?.height || 1)) * 100}%`,
                      width: `${(Math.abs(cropSelection.width) / (cropCanvasRef.current?.width || 1)) * 100}%`,
                      height: `${(Math.abs(cropSelection.height) / (cropCanvasRef.current?.height || 1)) * 100}%`
                    }}
                  />
                )}
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-100 flex gap-4">
              <button 
                onClick={handleCropComplete}
                disabled={!cropSelection.width || !cropSelection.height}
                className="flex-1 bg-red-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-red-700 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
              >
                Capture Selected Area
              </button>
              <button 
                onClick={() => setIsCropping(false)}
                className="px-8 border border-slate-200 rounded-2xl text-slate-400 font-bold uppercase tracking-widest text-[10px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 px-8 py-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Critical Action</h3>
              <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest mt-1">Permanent Removal</p>
            </div>
            <div className="p-8 text-center">
              <p className="text-slate-600 font-bold text-sm leading-relaxed">
                Are you sure you want to permanently remove <span className="text-slate-900 font-black">"{confirmAction.name}"</span>? 
                This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button 
                  onClick={() => setConfirmAction(null)}
                  className="bg-slate-100 text-slate-600 font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeDelete}
                  className="bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-red-700 shadow-lg shadow-red-200 transition-colors"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TechnicianManager;