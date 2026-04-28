
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Equipment, EquipmentType, TaskType, Technician } from '../types';
import { FLASH_FIRE_WARNING, QR_PROTOCOL } from '../constants';
import { compressImage, syncService, getProxiedImageUrl } from '../services/registryService';
import ImageModal from './ImageModal';

interface EquipmentFormProps {
  clientId: string | null;
  clientName?: string;
  onSave: (equipment: Equipment | Equipment[]) => void;
  onCancel: () => void;
  onChangeSite?: () => void;
  initialCode?: string;
  existingEquipment?: Equipment | null;
  allEquipment?: Equipment[]; 
  activeTech?: Technician | null;
  isCondemnationFlow?: boolean;
  isReplacementFlow?: boolean;
}

const DEFAULT_MANUFACTURERS = [
  'Safequip', 'Safety & Fire', 'Flash Fire', 'Masterguard', 'Centa', 'Chubb', 'Fidelity', 'Woodlands'
];

const EQUIPMENT_SIZES = [
  '1kg', '1.5kg', '2.5kg', '4.5kg', '9kg', '9L', '2kg CO2', '5kg CO2', '25kg Trolley Unit', '500g', '50kg Trolley Unit', '65mm', '25mm', '30m (25mm)', 'Not Applicable'
];

const EquipmentForm: React.FC<EquipmentFormProps> = ({ clientId, clientName, onSave, onCancel, onChangeSite, initialCode, existingEquipment, allEquipment = [], activeTech, isCondemnationFlow = false, isReplacementFlow = false }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<string[]>(existingEquipment?.photos || []);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const manufacturerList = useMemo(() => {
    const registryBrands = allEquipment
      .map(e => e.manufacturer)
      .filter(m => m && m !== 'Other' && m !== 'Unknown' && m !== '');
    
    const combined = [...new Set([...DEFAULT_MANUFACTURERS, ...registryBrands])];
    return (combined as string[]).sort((a, b) => String(a || '').localeCompare(String(b || '')));
  }, [allEquipment]);

  const initialManufacturer = existingEquipment?.manufacturer || '';
  const isPredefined = initialManufacturer && manufacturerList.includes(initialManufacturer);

  const [formData, setFormData] = useState({
    serialNumber: existingEquipment?.serialNumber || initialCode || '',
    type: existingEquipment?.type || EquipmentType.EXTINGUISHER,
    size: existingEquipment?.size || '',
    manufacturer: isPredefined ? initialManufacturer : (initialManufacturer ? 'Other' : ''),
    manufactureDate: existingEquipment?.manufactureDate || '',
    manufactureDateUnknown: existingEquipment?.manufactureDateUnknown || false,
    otherManufacturer: isPredefined ? '' : (initialManufacturer || ''),
    location: existingEquipment?.location || '',
    nextServiceDate: existingEquipment?.nextServiceDate || new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    lastPressureTestDate: existingEquipment?.lastPressureTestDate || '',
    pressureTestDateUnknown: existingEquipment?.pressureTestDateUnknown || false,
    nextPressureTestDate: existingEquipment?.nextPressureTestDate || '',
    isAutoCalculatedPT: !existingEquipment?.lastPressureTestDate
  });

  const isIllegalManufacturer = (m: string) => {
    const low = (m || '').toLowerCase();
    return low.includes('flash fire') || low.includes('flashfire') || low.includes('illegal') || low.includes('unapproved');
  };

  const isFlashFire = isIllegalManufacturer(formData.manufacturer) || (formData.manufacturer === 'Other' && isIllegalManufacturer(formData.otherManufacturer));
  const needsSize = [EquipmentType.EXTINGUISHER, EquipmentType.FIRE_BLANKET, EquipmentType.HYDRANT, EquipmentType.HOSE_REEL].includes(formData.type);
  const needsPressureTest = formData.type === EquipmentType.EXTINGUISHER;

  // Auto-fill size for Hose Reel and Hydrant
  useEffect(() => {
    if (formData.type === EquipmentType.HOSE_REEL && !formData.size) {
      setFormData(prev => ({ ...prev, size: '30m (25mm)' }));
    } else if (formData.type === EquipmentType.HYDRANT && !formData.size) {
      setFormData(prev => ({ ...prev, size: '65mm' }));
    }
  }, [formData.type]);

  // SANS 1475 AUTO-CALCULATION: Last PT based on Manufacture date if never tested
  useEffect(() => {
    if (formData.manufactureDate && !formData.lastPressureTestDate && formData.isAutoCalculatedPT && needsPressureTest) {
      const mfg = new Date(formData.manufactureDate);
      const now = new Date();
      let estimatedPT = new Date(mfg);
      
      const interval = 5;

      while (new Date(estimatedPT.getFullYear() + interval, estimatedPT.getMonth(), estimatedPT.getDate()) <= now) {
        estimatedPT.setFullYear(estimatedPT.getFullYear() + interval);
      }
      setFormData(prev => ({ ...prev, lastPressureTestDate: estimatedPT.toISOString().split('T')[0] }));
    }
  }, [formData.manufactureDate, formData.isAutoCalculatedPT, needsPressureTest, formData.manufacturer, formData.otherManufacturer, formData.size]);

  useEffect(() => {
    if (formData.lastPressureTestDate && !formData.pressureTestDateUnknown) {
      const lastPT = new Date(formData.lastPressureTestDate);
      if (!isNaN(lastPT.getTime())) {
        const interval = 5;
        
        const nextPT = new Date(lastPT);
        nextPT.setFullYear(nextPT.getFullYear() + interval);
        
        const nextPTStr = nextPT.toISOString().split('T')[0];
        if (formData.nextPressureTestDate !== nextPTStr) {
          setFormData(prev => ({ ...prev, nextPressureTestDate: nextPTStr }));
        }
      }
    }
  }, [formData.lastPressureTestDate, formData.pressureTestDateUnknown, formData.size, formData.manufacturer, formData.otherManufacturer]);

  const validate = () => {
    if (photos.length === 0) { setErrorField('photos'); return false; }
    if (!formData.serialNumber.trim()) { setErrorField('serialNumber'); return false; }
    
    // DUPLICATE CHECK: Ensure QR/Serial is unique in the database
    const cleanSn = formData.serialNumber.trim().toUpperCase();
    const isDuplicate = allEquipment.some(e => 
      !e.isArchived && 
      e.id !== existingEquipment?.id && 
      (e.serialNumber?.toUpperCase() === cleanSn || e.qrCode?.toUpperCase() === cleanSn)
    );

    if (isDuplicate) {
      alert(`DUPLICATE ERROR: An active asset with Serial/QR "${cleanSn}" already exists in the registry. Duplicate tags are not permitted.`);
      setErrorField('serialNumber');
      return false;
    }

    if (!formData.manufactureDate && !formData.manufactureDateUnknown) { setErrorField('manufactureDate'); return false; }
    if (needsPressureTest && !formData.lastPressureTestDate && !formData.pressureTestDateUnknown) { setErrorField('lastPressureTestDate'); return false; }
    if (needsSize && !formData.size) { setErrorField('size'); return false; }
    if (!formData.manufacturer) { setErrorField('manufacturer'); return false; }
    if (formData.manufacturer === 'Other' && !formData.otherManufacturer.trim()) { setErrorField('manufacturer'); return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !validate()) return;

    const manufacturerName = formData.manufacturer === 'Other' ? formData.otherManufacturer.trim() : formData.manufacturer;
    const physicalQr = initialCode || formData.serialNumber;

    setIsSubmitting(true);
    try {
      // Upload photos to Supabase Storage
      const uploadedPhotoUrls = await Promise.all(
        photos.map(async (photoData, index) => {
          const [base64, timestamp] = photoData.includes('|') ? photoData.split('|') : [photoData, Date.now().toString()];
          // If it's already a URL (editing existing), don't re-upload
          if (base64.startsWith('http')) return photoData;
          
          // Aggressively compress all photos
          let compressedBase64 = base64;
          try {
            compressedBase64 = await compressImage(base64, 800, 0.4); // Reduce dimensions and quality
          } catch (e) {
            console.warn("Failed to compress photo, using original", e);
          }
          
          return syncService.uploadImage(compressedBase64, `equipment/${formData.serialNumber}/${timestamp}_${index}.jpg`).then(url => `${url}|${timestamp}`);
        })
      );

      const payload: Equipment = {
        id: existingEquipment?.id || Math.random().toString(36).substr(2, 9),
        serialNumber: formData.serialNumber,
        qrCode: physicalQr,
        type: formData.type,
        size: needsSize ? formData.size : undefined,
        manufacturer: manufacturerName,
        manufactureDate: formData.manufactureDateUnknown ? undefined : formData.manufactureDate,
        manufactureDateUnknown: formData.manufactureDateUnknown,
        location: formData.location,
        lastInspectionDate: existingEquipment?.lastInspectionDate || null,
        nextServiceDate: formData.nextServiceDate,
        lastPressureTestDate: formData.pressureTestDateUnknown ? undefined : formData.lastPressureTestDate,
        nextPressureTestDate: formData.nextPressureTestDate,
        pressureTestDateUnknown: formData.pressureTestDateUnknown,
        isPressureTestNonCompliant: formData.pressureTestDateUnknown || (formData.nextPressureTestDate ? new Date(formData.nextPressureTestDate) < new Date() : false),
        client_id: (clientId && clientId !== 'null' && clientId !== 'undefined' && clientId.trim() !== '') ? clientId.trim() : null,
        photos: uploadedPhotoUrls,
        isArchived: existingEquipment?.isArchived ?? false
      };
      await onSave(payload);
      console.log("Successfully saved equipment:", payload.serialNumber);
    } catch (err: any) {
      console.error("Failed to save equipment:", err);
      alert(`Sync Error: ${err.message || 'Unknown error occurred while saving.'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200 max-w-xl w-full">
      <div className={`px-8 py-6 text-white flex flex-col ${isFlashFire ? 'bg-red-800' : 'bg-slate-900'}`}>
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-4">
             <button type="button" onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Back</span>
             </button>
             <h2 className="text-xl font-black uppercase tracking-tight">
               {existingEquipment ? 'Modify Asset' : 'Commissioning'}
             </h2>
           </div>
        </div>
        <div className="mt-4">
           <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Property Link</p>
           <p className="text-sm font-black text-white uppercase tracking-tight truncate">{clientName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto scrollbar-hide">
        <div className={`space-y-4 p-4 rounded-3xl transition-all border-2 ${errorField === 'photos' ? 'border-red-500 bg-red-50' : 'border-transparent bg-slate-50'}`}>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Evidence *</label>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div 
                key={i} 
                className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-slate-100 group shadow-md bg-white cursor-zoom-in hover:scale-105 transition-transform"
                onClick={() => setSelectedImage(p.split('|')[0])}
              >
                <img src={getProxiedImageUrl(p.split('|')[0])} className="w-full h-full object-cover" alt="Asset" referrerPolicy="no-referrer" />
                <button type="button" onClick={(e) => { e.stopPropagation(); setPhotos(prev => prev.filter((_, idx) => idx !== i)); }} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"><svg className="w-3 h-3 fill-none stroke-current stroke-[2]" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            ))}
            {photos.length < 3 && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center hover:bg-slate-50 transition-all text-slate-300 hover:text-red-500 hover:border-red-100 bg-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                <span className="text-[7px] font-black uppercase mt-1">Add</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial Number / QR *</label>
            <input 
              required 
              type="text" 
              inputMode="numeric"
              pattern="[0-9]*"
              value={formData.serialNumber} 
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setFormData({...formData, serialNumber: val});
              }} 
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-red-500 font-black outline-none text-sm" 
            />
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Equipment Type *</label>
            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as EquipmentType})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-red-500 font-black outline-none text-sm appearance-none">
              {Object.values(EquipmentType).map(type => (<option key={type} value={type}>{type}</option>))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Manufacture Date *</label>
            <div className="flex flex-col gap-2">
              <input 
                type="date" 
                disabled={formData.manufactureDateUnknown}
                value={formData.manufactureDate} 
                onChange={e => setFormData({...formData, manufactureDate: e.target.value, isAutoCalculatedPT: true})} 
                className={`w-full bg-slate-50 border-2 rounded-2xl px-5 py-4 outline-none font-bold text-sm ${errorField === 'manufactureDate' ? 'border-red-500' : 'border-slate-100 focus:border-red-500'}`} 
              />
              <label className="flex items-center gap-2 cursor-pointer ml-1">
                <input 
                  type="checkbox" 
                  checked={formData.manufactureDateUnknown} 
                  onChange={e => setFormData({...formData, manufactureDateUnknown: e.target.checked})}
                  className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-[10px] font-black text-slate-500 uppercase">Unknown / Illegible</span>
              </label>
            </div>
          </div>
          
          <div className={`space-y-2 ${isFlashFire ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Pressure Test Date *</label>
            <div className="flex flex-col gap-2">
              <input 
                type="date" 
                disabled={formData.pressureTestDateUnknown || !needsPressureTest || isFlashFire}
                value={formData.lastPressureTestDate} 
                onChange={e => setFormData({...formData, lastPressureTestDate: e.target.value, isAutoCalculatedPT: false})} 
                className={`w-full bg-slate-50 border-2 rounded-2xl px-5 py-4 outline-none font-bold text-sm ${errorField === 'lastPressureTestDate' ? 'border-red-500' : 'border-slate-100 focus:border-red-500'}`} 
              />
              <div className="flex flex-col gap-1 ml-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    disabled={!needsPressureTest || isFlashFire}
                    checked={formData.pressureTestDateUnknown} 
                    onChange={e => setFormData({...formData, pressureTestDateUnknown: e.target.checked})}
                    className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-[10px] font-black text-slate-500 uppercase">Unknown (Force PT Now)</span>
                </label>
                {needsPressureTest && formData.isAutoCalculatedPT && formData.lastPressureTestDate && !formData.pressureTestDateUnknown && (
                  <p className="text-[8px] font-black text-blue-600 uppercase tracking-widest">★ Estimated from Mfg Date</p>
                )}
                {needsPressureTest && formData.nextPressureTestDate && !formData.pressureTestDateUnknown && (
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                    Next PT Due: {formData.nextPressureTestDate}
                  </p>
                )}
                {!needsPressureTest && (
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">
                    Pressure Test Not Applicable
                  </p>
                )}
                {isFlashFire && (
                  <p className="text-[8px] font-black text-red-600 uppercase tracking-widest mt-1">
                    Pressure Test Prohibited for Flash Fire
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Brand/Manufacturer *</label>
            <div className="space-y-3">
              <select 
                required value={formData.manufacturer} 
                onChange={e => {
                  const val = e.target.value;
                  if (val.toLowerCase().includes('flash fire')) {
                    if (!window.confirm("REGULATORY ALERT: Flash Fire equipment is NOT SABS approved and cannot be serviced. Selecting this will mark the unit for immediate condemnation. Are you sure?")) {
                      return;
                    }
                  }
                  setFormData({...formData, manufacturer: val});
                }} 
                className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-black text-sm appearance-none`}
              >
                <option value="">Select Brand</option>
                {manufacturerList.map(m => <option key={m} value={m}>{m}</option>)}
                <option value="Other">-- Add New Brand --</option>
              </select>
              {formData.manufacturer === 'Other' && (
                <input 
                  type="text"
                  required
                  value={formData.otherManufacturer}
                  onChange={e => setFormData({...formData, otherManufacturer: e.target.value})}
                  placeholder="Enter brand name..."
                  className={`w-full bg-white border-2 border-red-100 rounded-2xl px-5 py-4 outline-none font-black text-sm focus:border-red-500 animate-in slide-in-from-top-2`}
                />
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Size/Capacity *</label>
            <select required value={formData.size} onChange={e => setFormData({...formData, size: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-red-500 font-black outline-none text-sm appearance-none">
              <option value="">Select Size</option>
              {EQUIPMENT_SIZES.map(s => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Exact Floor Location *</label>
          <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. 1st Floor North Wing" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-red-500 font-black outline-none text-sm" />
        </div>

        <div className="flex flex-col gap-3 pt-6 border-t border-slate-100">
          <button type="submit" disabled={isSubmitting} className={`w-full text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs active:scale-95 transition-all disabled:opacity-50 ${isFlashFire ? 'bg-red-800' : 'bg-slate-900'}`}>
            {isSubmitting ? 'Syncing...' : (existingEquipment ? 'Update Registry' : 'Commit to Registry')}
          </button>
          <button type="button" onClick={onCancel} className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.4em]">Discard Entry</button>
        </div>
      </form>

      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
};

export default EquipmentForm;
