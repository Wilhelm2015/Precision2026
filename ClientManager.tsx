
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Equipment, InspectionRecord, TaskType, EquipmentType } from '../types';
import { EQUIPMENT_DEFINITIONS } from '../constants';
import { compressImage, syncService, getProxiedImageUrl } from '../services/registryService';
import ImageModal from './ImageModal';

interface ChecklistFormProps {
  equipment: Equipment;
  taskType: TaskType;
  onComplete: (record: InspectionRecord, scanNext?: boolean) => void;
  onCancel: () => void;
  activeTech?: { name: string, saqcc: string, email: string, signature?: string } | null;
  activeSubUser?: { id: string, name: string, signature?: string } | null;
  existingRecords?: InspectionRecord[];
  branding?: any[];
}

const ChecklistForm: React.FC<ChecklistFormProps> = ({ equipment, taskType, onComplete, onCancel, activeTech, activeSubUser, existingRecords = [], branding = [] }) => {
  const [errorField, setErrorField] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const [maintenanceDate, setMaintenanceDate] = useState(today);

  useEffect(() => {
    setFindings({});
    setNotes('');
    setRecordedMass('');
    setPressureKpa('');
    setFlowLpm('');
    setTestedToKpa('');
    setSealSerialNumber('');
    setPhotos([]);
    setTempSignature(null);
    setErrorField(null);
  }, [equipment.id, taskType]);

  const isLocked = useMemo(() => {
    if (taskType === TaskType.FAULT) return false;
    if (taskType === TaskType.INSPECTION) {
      const currentMonth = maintenanceDate.substring(0, 7); // YYYY-MM
      return existingRecords.some(r => 
        r.equipmentId === equipment.id && 
        r.date.startsWith(currentMonth) && 
        r.taskType === TaskType.INSPECTION
      );
    }
    return existingRecords.some(r => 
      r.equipmentId === equipment.id && 
      r.date === maintenanceDate && 
      r.taskType === taskType &&
      !(taskType === TaskType.PRESSURE_TEST && r.pressureTestOption === 'later')
    );
  }, [existingRecords, equipment.id, maintenanceDate, taskType]);

  const isCO2 = useMemo(() => equipment.size?.toLowerCase().includes('co2'), [equipment.size]);
  const definition = useMemo(() => {
    if (isCO2) {
      return EQUIPMENT_DEFINITIONS.find(d => d.type === EquipmentType.CO2_EXTINGUISHER) || 
             EQUIPMENT_DEFINITIONS.find(d => d.type === equipment.type);
    }
    return EQUIPMENT_DEFINITIONS.find(d => d.type === equipment.type);
  }, [isCO2, equipment.type]);

  const isFlashFire = useMemo(() => {
    const m = (equipment.manufacturer || '').toLowerCase();
    const result = m.includes('flash fire') || m.includes('flashfire');
    console.log('DEBUG: isFlashFire', { manufacturer: equipment.manufacturer, result });
    return result;
  }, [equipment.manufacturer]);

  const rawChecklistItems = definition?.checklists[taskType] || [];
  
  const [hydrantType, setHydrantType] = useState<'Wheel' | 'Tamperproof' | ''>('');

  const checklistItems = useMemo(() => {
    if (equipment.type === EquipmentType.HYDRANT && hydrantType === 'Tamperproof') {
      return rawChecklistItems.filter(item => item.id !== 'hy_wheel');
    }
    return rawChecklistItems;
  }, [rawChecklistItems, equipment.type, hydrantType]);

  const [findings, setFindings] = useState<Record<string, boolean>>({});

  // Flash Fire Auto-Fail
  useEffect(() => {
    if (isFlashFire) {
      const failedFindings: Record<string, boolean> = {};
      checklistItems.forEach(item => {
        failedFindings[item.id] = false;
      });
      setFindings(failedFindings);
      setNotes('FLASH FIRE EQUIPMENT DETECTED: Unit is not SABS approved and must be condemned immediately.');
    }
  }, [isFlashFire, checklistItems]);
  const [notes, setNotes] = useState('');
  const [recordedMass, setRecordedMass] = useState('');
  const [pressureKpa, setPressureKpa] = useState('');
  const [flowLpm, setFlowLpm] = useState('');
  const [testedToKpa, setTestedToKpa] = useState('');
  const [sealSerialNumber, setSealSerialNumber] = useState('');
  const [pressureTestOption, setPressureTestOption] = useState<'now' | 'later' | ''>('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [tempSignature, setTempSignature] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showVesselWarning, setShowVesselWarning] = useState(false);

  const isFlowRelated = taskType === TaskType.FLOW_TEST || (taskType === TaskType.MAINTENANCE && (equipment.type === EquipmentType.HOSE_REEL || equipment.type === EquipmentType.HYDRANT));
  const isMaintenance = taskType === TaskType.MAINTENANCE;

  // SANS 1128 Flow Rate Self-Calculation
  useEffect(() => {
    if (isFlowRelated && pressureKpa && !isNaN(parseFloat(pressureKpa))) {
      const p = parseFloat(pressureKpa);
      if (p > 0) {
        if (equipment.type === EquipmentType.HOSE_REEL) {
          // SANS Approved Coefficient for Hose Reels: 24L/min @ 200kPa
          const k = 24 / Math.sqrt(200);
          const calculatedFlow = (k * Math.sqrt(p)).toFixed(1);
          setFlowLpm(calculatedFlow);
        } else if (equipment.type === EquipmentType.HYDRANT) {
          // SANS 1128-1 Hydrant Flow Calculation (Approximate for 65mm outlet)
          // Note: Hydrants usually require direct measurement, but we provide a baseline calculation
          const k_hydrant = 1200 / Math.sqrt(300); // Baseline: 1200L/min @ 300kPa
          const calculatedFlow = (k_hydrant * Math.sqrt(p)).toFixed(1);
          setFlowLpm(calculatedFlow);
        }
      }
    }
  }, [pressureKpa, isFlowRelated, equipment.type]);

  // AUTO-FILL LOGIC: Carry over kPa and Flow Rate for the same client maintenance session
  useEffect(() => {
    if (isFlowRelated && !pressureKpa && !flowLpm && existingRecords.length > 0) {
      const sharedRecord = existingRecords.find(r => 
        r.date === maintenanceDate && 
        (r.equipmentType === EquipmentType.HOSE_REEL || r.equipmentType === EquipmentType.HYDRANT) &&
        r.flow_pressure_kpa && 
        r.calculatedFlowLpm
      );

      if (sharedRecord) {
        setPressureKpa(sharedRecord.flow_pressure_kpa || '');
        setFlowLpm(sharedRecord.calculatedFlowLpm || '');
        
        if (taskType === TaskType.FLOW_TEST || taskType === TaskType.MAINTENANCE) {
           const autoPassItems: Record<string, boolean> = {};
           checklistItems.forEach(item => {
             if (item.id.includes('flow') || item.id.includes('static') || item.id.includes('discharge')) {
               autoPassItems[item.id] = true;
             }
           });
           setFindings(prev => ({ ...prev, ...autoPassItems }));
        }
      }
    }
  }, [isFlowRelated, existingRecords, today, taskType, checklistItems]);

  const handleFindingChange = (id: string, value: boolean) => {
    if (id === 'vessel_condition' && value === false) {
      setShowVesselWarning(true);
    }
    setFindings(prev => ({ ...prev, [id]: value }));
  };

  const confirmVesselFailure = () => {
    const failedFindings: Record<string, boolean> = {};
    checklistItems.forEach(item => {
      failedFindings[item.id] = false;
    });
    setFindings(failedFindings);
    setNotes(prev => `[CRITICAL: VESSEL FAILURE] ${prev}`);
    setShowVesselWarning(false);
  };

  const triggerComplete = async (scanNext?: boolean) => {
    if (isSubmitting || isLocked) return;
    
    const incompleteItem = checklistItems.find(item => findings[item.id] === undefined);
    if (incompleteItem) {
      setErrorField(incompleteItem.id);
      return;
    }

    // MANDATORY SANS 1475 REGULATORY DATA
    const isExtinguisher = equipment.type === EquipmentType.EXTINGUISHER || equipment.type === EquipmentType.CO2_EXTINGUISHER;
    const isHoseReel = equipment.type === EquipmentType.HOSE_REEL;
    const isHydrant = equipment.type === EquipmentType.HYDRANT;
    
    const isLowPressure = (isHoseReel || isHydrant) && pressureKpa && parseFloat(pressureKpa) < 100;
    
    const isClient = activeTech?.saqcc === 'INTERNAL';
    const finalSignature = isClient ? 'CLIENT_NO_SIGNATURE' : (activeTech?.signature || tempSignature);

    // Update this block in triggerComplete
    if (isMaintenance && isExtinguisher && !isFlashFire) {
      if (!recordedMass.trim()) {
        setErrorField('recordedMass');
        alert("MANDATORY: Recorded Mass (kg) is required for fire extinguishers.");
        return;
      }
    }

    const needsSeal = isMaintenance && (
      equipment.type === EquipmentType.EXTINGUISHER || 
      equipment.type === EquipmentType.CO2_EXTINGUISHER || 
      equipment.type === EquipmentType.HOSE_REEL || 
      (equipment.type === EquipmentType.HYDRANT && hydrantType === 'Wheel')
    );

    if (needsSeal && !isFlashFire && !sealSerialNumber.trim()) {
      setErrorField('sealSerialNumber');
      alert("MANDATORY: Seal Serial Number is required for this equipment.");
      return;
    }

    if (photos.length === 0) {
      alert("LEGAL COMPLIANCE: At least one (1) clear photo of the asset is mandatory for audit submission.");
      return;
    }

    if (!finalSignature) {
      alert("MANDATORY: Technician signature is missing. Please sign in the pad provided below.");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Upload signature if it's temporary
      let uploadedSignature = finalSignature;
      if (tempSignature && !activeTech?.signature && !isClient) {
        uploadedSignature = await syncService.uploadImage(tempSignature, `techs/${activeTech?.email || 'unknown'}/temp_signature_${Date.now()}.png`);
      }

      // Upload photos to Supabase Storage
      const uploadedPhotoUrls = await Promise.all(
        photos.map(async (photoData, index) => {
          const [base64, timestamp] = photoData.includes('|') ? photoData.split('|') : [photoData, Date.now().toString()];
          if (base64.startsWith('http')) return photoData;
          const url = await syncService.uploadImage(base64, `inspections/${equipment.id}/${timestamp}_${index}.jpg`);
          return `${url}|${timestamp}`;
        })
      );

      const isNoWater = isFlowRelated && pressureKpa === '0';
      const effectiveFindings = (isLowPressure || pressureTestOption === 'later') ? Object.fromEntries(checklistItems.map(i => [i.id, false])) : findings;
      const allPassed = checklistItems.every(item => effectiveFindings[item.id] === true) && !isNoWater && !isLowPressure && pressureTestOption !== 'later';
      
      const failedChecksCount = Object.values(effectiveFindings).filter(v => v === false).length;
      const isFlashFire = (() => {
        const m = (equipment.manufacturer || '').toLowerCase();
        return m.includes('flash fire') || m.includes('flashfire');
      })();
      const sabsMarkFailed = effectiveFindings['sabs_mark'] === false;
      const isCondemned = failedChecksCount > 3 || isFlashFire || sabsMarkFailed;

      const record: InspectionRecord = {
        id: Math.random().toString(36).substr(2, 9),
        equipmentId: equipment.id,
        equipmentType: equipment.type,
        taskType: taskType,
        inspectorName: activeTech ? `${activeTech.name} (${activeTech.saqcc})` : 'Unknown Tech',
        inspectorSignature: uploadedSignature,
        technicianId: activeTech?.email ? undefined : undefined, // Placeholder for logic
        subUserId: activeSubUser?.id,
        sub_user_id: activeSubUser?.id,
        date: maintenanceDate,
        status: isCondemned ? 'Condemned' : ((isNoWater || isLowPressure || pressureTestOption === 'later') ? 'Fail' : (allPassed ? 'Pass' : 'Service Required')),
        findings: effectiveFindings,
        notes: isNoWater ? `[CRITICAL: NO WATER DETECTED] ${notes}` : (isLowPressure ? `[CRITICAL: LOW PRESSURE DETECTED <100kPa] ${notes}` : (pressureTestOption === 'later' ? `[PRESSURE TEST DUE] ${notes}` : notes)),
        photos: uploadedPhotoUrls,
        recordedMass: recordedMass || undefined,
        flow_pressure_kpa: pressureKpa || undefined,
        calculatedFlowLpm: flowLpm || undefined,
        sealSerialNumber: sealSerialNumber || undefined,
        testedToKpa: testedToKpa || undefined,
        hydrantType: hydrantType === '' ? undefined : hydrantType as 'Wheel' | 'Tamperproof',
        pressureTestOption: pressureTestOption || undefined
      };

      await onComplete(record, scanNext);
    } catch (err) {
      console.error("Submission failed:", err);
      alert("Failed to upload photos or save record.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const remainingSlots = 4 - photos.length;
      if (remainingSlots <= 0) {
        alert("MAXIMUM REACHED: You can only attach up to 4 photos per audit record.");
        return;
      }
      
      const filesToProcess = Array.from(files).slice(0, remainingSlots);
      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const compressed = await compressImage(reader.result as string, 0.6); // Slightly more compression
          const timestamp = Date.now();
          setPhotos(prev => {
            if (prev.length >= 4) return prev;
            return [...prev, `${compressed}|${timestamp}`];
          });
        };
        reader.readAsDataURL(file as File);
      });
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = ('touches' in e) ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
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
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
    if ('touches' in e) e.preventDefault();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Create a temporary canvas to fill white background
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.fillStyle = '#ffffff';
          tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          tempCtx.drawImage(canvas, 0, 0);
          setTempSignature(tempCanvas.toDataURL('image/jpeg', 0.3));
        }
      }
    }
  };

  useEffect(() => {
    if (!activeTech?.signature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
      }
    }
  }, [activeTech?.signature]);

  if (isLocked) {
    return (
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6 max-w-sm w-full">
        <div className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border-2 border-amber-100">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <h2 className="text-xl font-black uppercase text-slate-900">Task Already Recorded</h2>
        <p className="text-sm text-slate-500">
          {taskType === TaskType.INSPECTION 
            ? `Asset ${equipment.serialNumber} has already been inspected this month. SANS 10105-1 visual checks are limited to one per month.`
            : `Asset ${equipment.serialNumber} already has a ${taskType} record for today. You cannot duplicate this specific audit type on the same day.`}
        </p>
        <button onClick={onCancel} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px]">Back to Tasks</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-2xl relative">
      <div className="px-8 py-6 bg-slate-900 text-white flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="lg:hidden p-2 -ml-2 text-white/60 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight">{taskType} Audit</h2>
            <p className="text-[8px] text-red-500 font-black uppercase tracking-widest mt-1">SANS Regulatory Chain</p>
          </div>
        </div>
        <button onClick={onCancel} className="text-white/40 hover:text-white text-2xl">&times;</button>
      </div>
      
      <div className="p-8 space-y-6 max-h-[65vh] overflow-y-auto scrollbar-hide">
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-4">
          <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Maintenance Date</label>
          <input 
            type="date" 
            value={maintenanceDate} 
            onChange={e => setMaintenanceDate(e.target.value)} 
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isMaintenance && (equipment.type === EquipmentType.EXTINGUISHER || equipment.type === EquipmentType.CO2_EXTINGUISHER) && (
              <div className={`p-4 rounded-2xl border transition-all ${errorField === 'recordedMass' ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-slate-100'} ${isFlashFire ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Recorded Mass (kg) {!isFlashFire && '*'}</label>
                 <input type="number" step="0.01" value={recordedMass} onChange={e => { setRecordedMass(e.target.value); setErrorField(null); }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm" placeholder={isFlashFire ? "N/A" : "e.g. 13.42"} disabled={isFlashFire} />
              </div>
            )}
            {isMaintenance && (
              equipment.type === EquipmentType.EXTINGUISHER || 
              equipment.type === EquipmentType.CO2_EXTINGUISHER || 
              equipment.type === EquipmentType.HOSE_REEL || 
              (equipment.type === EquipmentType.HYDRANT && hydrantType === 'Wheel')
            ) && (
              <div className={`p-4 rounded-2xl border transition-all ${errorField === 'sealSerialNumber' ? 'bg-red-50 border-red-500' : 'bg-slate-50 border-slate-100'} ${isFlashFire ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Seal Serial Number {!isFlashFire && '*'}</label>
                 <input type="text" value={sealSerialNumber} onChange={e => { setSealSerialNumber(e.target.value); setErrorField(null); }} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm" placeholder={isFlashFire ? "N/A" : "e.g. S-12345"} disabled={isFlashFire} />
              </div>
            )}
           {isMaintenance && equipment.type === EquipmentType.HYDRANT && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Hydrant Configuration</label>
                 <select value={hydrantType} onChange={e => setHydrantType(e.target.value as any)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm">
                    <option value="">Select Type...</option>
                    <option value="Wheel">Wheel Type</option>
                    <option value="Tamperproof">Tamperproof Type</option>
                 </select>
              </div>
           )}
           {taskType === TaskType.PRESSURE_TEST && (
              <div className={`p-4 bg-amber-50 rounded-2xl border border-amber-100 space-y-4 ${isFlashFire ? 'opacity-50 pointer-events-none' : ''}`}>
                 <label className="block text-[9px] font-black text-amber-600 uppercase mb-1.5 ml-1">Pressure Test Protocol</label>
                 <div className="flex gap-2">
                    <button 
                      onClick={() => setPressureTestOption('now')}
                      disabled={isFlashFire}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pressureTestOption === 'now' ? 'bg-amber-600 text-white' : 'bg-white text-amber-600 border border-amber-200'}`}
                    >
                      Force Now
                    </button>
                    <button 
                      onClick={() => setPressureTestOption('later')}
                      disabled={isFlashFire}
                      className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${pressureTestOption === 'later' ? 'bg-red-600 text-white' : 'bg-white text-red-600 border border-red-200'}`}
                    >
                      Do Later
                    </button>
                 </div>
                 {pressureTestOption === 'now' && (
                   <input type="number" value={testedToKpa} onChange={e => setTestedToKpa(e.target.value)} className="w-full bg-white border border-amber-200 rounded-xl px-4 py-2 font-bold text-sm" placeholder="e.g. 2500" disabled={isFlashFire} />
                 )}
              </div>
           )}
           {isFlowRelated && (
              <>
                 <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <label className="block text-[9px] font-black text-emerald-600 uppercase mb-1.5 ml-1">Static Pressure (kPa)</label>
                    <input type="number" value={pressureKpa} onChange={e => setPressureKpa(e.target.value)} className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 font-bold text-sm" placeholder="e.g. 600" />
                 </div>
                 <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <label className="block text-[9px] font-black text-emerald-600 uppercase mb-1.5 ml-1">Flow Rate (L/min)</label>
                    <input type="number" value={flowLpm} onChange={e => setFlowLpm(e.target.value)} className="w-full bg-white border border-emerald-200 rounded-xl px-4 py-2 font-bold text-sm" placeholder="e.g. 28" />
                 </div>
              </>
           )}
        </div>

        {isFlashFire && (
          <div className="p-6 bg-red-50 border-2 border-red-600 rounded-3xl space-y-3 animate-pulse">
            <div className="flex items-center gap-3 text-red-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="font-black uppercase tracking-tight">Flash Fire Alert</p>
            </div>
            <p className="text-[10px] text-red-800 font-bold leading-tight uppercase">
              This unit is identified as Flash Fire. It is NOT SABS approved and cannot be serviced. All checks have been auto-failed. Please commit this audit to condemn the unit.
            </p>
          </div>
        )}

        {checklistItems.map(item => (
          <div key={item.id} className={`p-5 rounded-3xl border-2 transition-all ${errorField === item.id ? 'border-red-500 bg-red-50' : 'border-slate-50 bg-slate-50'}`}>
            <p className="font-black text-xs uppercase text-slate-900">{item.label}</p>
            <p className="text-[10px] text-slate-400 font-medium mt-1">{item.description}</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleFindingChange(item.id, true)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${findings[item.id] === true ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400'}`}>Verified / Pass</button>
              <button 
                onClick={() => handleFindingChange(item.id, false)} 
                className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${findings[item.id] === false ? 'bg-red-600 text-white' : 'bg-white text-slate-400'}`}
              >
                {findings[item.id] === false && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
                Fail / Critical
              </button>
            </div>
          </div>
        ))}

        {showVesselWarning && (
          <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl border-4 border-red-600 text-center space-y-6">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 uppercase">Vessel Failure Detected</h3>
                <p className="text-sm text-slate-500 font-medium">Failing the vessel condition check will automatically condemn this unit and fail all other checklist items. Do you wish to proceed?</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { handleFindingChange('vessel_condition', true); setShowVesselWarning(false); }} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-[10px] tracking-widest">Cancel</button>
                <button onClick={confirmVesselFailure} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Confirm Condemn</button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3 p-5 bg-slate-50 rounded-3xl border border-slate-100">
           <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Evidence Capture</label>
           <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <div 
                  key={i} 
                  className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 cursor-zoom-in hover:scale-105 transition-transform"
                  onClick={() => setSelectedImage(p.split('|')[0])}
                >
                  <img src={getProxiedImageUrl(p.split('|')[0])} className="w-full h-full object-cover" alt="Audit" referrerPolicy="no-referrer" />
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 hover:text-red-600 bg-white">+</button>
           </div>
           <input ref={fileInputRef} type="file" multiple capture="environment" className="hidden" onChange={handlePhotoCapture} />
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
           <label className="block text-[9px] font-black text-slate-400 uppercase mb-1.5 ml-1">Technical Remarks</label>
           <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-20 bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-xs resize-none" placeholder="Enter any additional observations..." />
        </div>

        {!activeTech?.signature && activeTech?.saqcc !== 'INTERNAL' && (
          <div className="p-5 bg-amber-50 rounded-3xl border-2 border-amber-200 space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-amber-700 ml-1">Technician Signature Required</label>
              <button type="button" onClick={() => {
                const canvas = canvasRef.current;
                if (canvas) {
                  const ctx = canvas.getContext('2d');
                  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
                  setTempSignature(null);
                }
              }} className="text-[8px] font-black text-red-600 uppercase">Clear</button>
            </div>
            <div className="h-32 bg-white rounded-2xl border-2 border-slate-100 overflow-hidden relative">
              <canvas 
                ref={canvasRef}
                width={600}
                height={128}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="w-full h-full cursor-crosshair touch-none"
              />
              {!tempSignature && !isDrawing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-[10px] font-black text-slate-300 uppercase italic">Sign here to authorize audit</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-8 border-t border-slate-100 bg-slate-50 space-y-3">
        <button onClick={() => triggerComplete(true)} disabled={isSubmitting} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2">
           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
           {isSubmitting ? 'Syncing...' : 'Submit Entry & Scan Next'}
        </button>
        <button onClick={() => triggerComplete(false)} disabled={isSubmitting} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all">
          {isSubmitting ? 'Syncing...' : 'Commit Audit to Master Registry'}
        </button>
      </div>

      {selectedImage && (
        <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
      )}
    </div>
  );
};

export default ChecklistForm;
