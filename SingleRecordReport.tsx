import React, { useMemo, useState, useRef, useEffect } from 'react';
import { calculateSiteStats } from '../src/lib/scoring';
import { Client, Equipment, InspectionRecord, Technician, TaskType, EquipmentType, FaultReport, SavedReport } from '../types';
import { SACAS_PERMIT_NUMBER, EQUIPMENT_DEFINITIONS, COMPANY_LOGO_URL, isSaqccCardValid } from '../constants';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import ImageModal from './ImageModal';
import { getProxiedImageUrl } from '../services/registryService';

interface ReportGeneratorProps {
  client: Client;
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  technicians: Technician[];
  activeTech?: Technician | null;
  onBack: () => void;
  selectedYear?: number;
  branding?: any[];
  isReadOnly?: boolean;
  onSaveReport?: (report: SavedReport) => void;
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr || dateStr === 'N/A') return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr || 'N/A';
  }
};

const CLAUSE_MAPPING: Record<string, string> = {
  vessel_condition: 'SANS 1475-1 Clause 4.1.1',
  internal_inspect: 'SANS 1475-1 Clause 5.1',
  valve_overhaul: 'SANS 1475-1 Clause 5.2',
  pressure_gauge: 'SANS 1475-1 Clause 5.3',
  safety_pin: 'SANS 1475-1 Clause 5.6',
  hose_nozzle: 'SANS 1475-1 Clause 5.5',
  mass_check: 'SANS 1475-1 Clause 5.4.1',
  operating_label: 'SANS 1475-1 Clause 5.7',
  service_label: 'SANS 1475-1 Clause 6',
  hr_mounting: 'SANS 1475-2 Clause 4.1',
  hr_rotation: 'SANS 1475-2 Clause 4.2',
  hr_hose: 'SANS 1475-2 Clause 5.2.2',
  hr_nozzle: 'SANS 1475-2 Clause 5.3',
  hr_gland: 'SANS 1475-2 Clause 5.4',
  hr_isolating: 'SANS 1475-2 Clause 5.5',
  hr_operating_label: 'SANS 1475-2 Clause 5.7',
  hr_signage: 'SANS 1186-1',
  hy_wheel: 'SANS 1475-2 Clause 6.1',
  hy_washer: 'SANS 1475-2 Clause 6.2',
  hy_threads: 'SANS 1475-2 Clause 6.3',
  hy_cap: 'SANS 1475-2 Clause 6.4',
  hy_packing: 'SANS 1475-2 Clause 6.1.3',
  bc_accessibility: 'SANS 1475-2 Clause 7.1',
  bc_couplings: 'SANS 1475-2 Clause 7.2',
  bc_caps: 'SANS 1475-2 Clause 7.3',
  bc_non_return: 'SANS 1475-2 Clause 7.2.1',
  bc_drain: 'SANS 1475-2 Clause 7.4',
  bc_signage: 'SANS 1186-1',
  unapproved_brand: 'SANS 1475-1 / SABS PERMIT',
  wall_thinning: 'SANS 1475-1 Clause 4.2',
  dent_limit: 'SANS 1475-1 Clause 4.3'
};

export const ReportLogo = ({ type, className, branding }: { type: 'company' | 'saqcc' | 'sacas' | 'fire', className?: string, branding?: any[] }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const keys = { 
      company: 'pfs_custom_logo', 
      saqcc: 'pfs_custom_saqcc', 
      sacas: 'pfs_custom_sacas',
      fire: 'pfs_custom_fire'
    };
    
    let dist = localStorage.getItem(`pfs_dist_${type}`) || 'both';
    let stored = localStorage.getItem(keys[type]);

    // Use branding from cloud if available
    if (branding) {
      const item = branding.find(b => b.id === keys[type]);
      if (item) {
        stored = item.content;
        dist = item.distribution || 'both';
      }
    }

    const canShow = dist === 'audit' || dist === 'both' || dist === 'report';
    if (canShow) {
      if (stored) { 
        setSrc(getProxiedImageUrl(stored)); 
        setIsVisible(true); 
      } else if (type === 'company') { 
        setSrc(COMPANY_LOGO_URL); 
        setIsVisible(true); 
      } else if (type === 'saqcc') {
        setSrc("https://pfsa.co.za/wp-content/uploads/2023/10/SAQCC-Fire-Logo-1.png");
        setIsVisible(true);
      } else if (type === 'sacas') {
        setSrc("https://pfsa.co.za/wp-content/uploads/2023/10/SACAS-Logo.png");
        setIsVisible(true);
      } else if (type === 'fire') {
        setSrc("https://pfsa.co.za/wp-content/uploads/2023/10/FIRE-Logo.png");
        setIsVisible(true);
      } else { 
        setIsVisible(false); 
      }
    } else { 
      setIsVisible(false); 
    }
  }, [type, branding]);

  if (!isVisible) return null;
  return <img src={src!} className={`${className} object-contain max-w-full max-h-full`} alt={`${type} logo`} crossOrigin="anonymous" referrerPolicy="no-referrer" />;
};

const CompanyFooter = ({ branding = [] }: { branding?: any[] }) => (
  <div className="w-full pt-2 border-t flex justify-between items-end shrink-0">
    <div className="space-y-0.5 text-left">
      <p className="text-[9px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
      <p className="text-[7px] font-bold text-slate-500 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
      <p className="text-[7px] font-black text-red-600 uppercase tracking-widest">Office: 010 035 5246 • Emergency: 078 173 7245 • PROJECT_FINAL_V12.18</p>
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">Digital SANS Registry Node</p>
      </div>
      <div className="flex gap-2 items-center">
        <ReportLogo type="saqcc" className="w-[40px] h-[30px]" branding={branding} />
        <ReportLogo type="sacas" className="w-[40px] h-[30px]" branding={branding} />
      </div>
    </div>
  </div>
);

export const ReportGenerator: React.FC<ReportGeneratorProps> = ({ 
  client, equipment, records, faults, technicians, activeTech, onBack, selectedYear,
  isReadOnly = false, onSaveReport, branding = []
}) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  const displayTechnician = useMemo(() => {
    return technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management');
  }, [technicians, client.technicianId]);

  const activeAssets = useMemo(() => {
    const filtered = equipment.filter(e => {
      // Get ALL records for this asset, sorted by date DESC
      const assetRecords = records
        .filter(r => String(r.equipmentId || r.equipment_id || '').trim() === String(e.id || '').trim())
        .sort((a, b) => {
          const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
          if (dateDiff !== 0) return dateDiff;
          // Tie-breaker: TaskType.DISCARD should always be "latest" if on same day
          if (b.taskType === TaskType.DISCARD) return 1;
          if (a.taskType === TaskType.DISCARD) return -1;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
      
      const latest = assetRecords[0];
      
      // If the unit has been formally discarded, it is NEVER active
      if (latest?.status === 'Discarded' || latest?.taskType === TaskType.DISCARD) return false;
      
      // If not archived, it's active
      if (!e.isArchived) return true;
      
      // If archived, only include if it's currently in a failed/condemned state awaiting disposal
      // (This allows Condemned units to show on the report until they are formally Discarded)
      const isActive = latest?.status === 'Condemned' || latest?.status === 'Fail' || latest?.status === 'Service Required';
      if (isActive) console.log('Active archived asset:', e.id, latest?.status);
      return isActive;
    });

    const typeOrder: Record<string, number> = {
      [EquipmentType.EXTINGUISHER]: 1,
      [EquipmentType.CO2_EXTINGUISHER]: 1,
      [EquipmentType.HOSE_REEL]: 2,
      [EquipmentType.HYDRANT]: 3,
      [EquipmentType.BOOSTER_CONNECTION]: 4
    };

    return [...filtered].sort((a, b) => {
      const orderA = typeOrder[a.type] || 99;
      const orderB = typeOrder[b.type] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return String(a.serialNumber || '').localeCompare(String(b.serialNumber || ''));
    });
  }, [equipment, records]);
  
  const filteredRecords = useMemo(() => {
    if (!selectedYear) return records;
    return records.filter(r => {
      const date = r.date || r.created_at || '';
      if (!date) return false;
      return new Date(date).getFullYear() === selectedYear;
    });
  }, [records, selectedYear]);

  const hasFlashFire = useMemo(() => activeAssets.some(e => {
    const m = (e.manufacturer || '').toLowerCase().replace(/\s/g, '');
    return m.includes('flashfire');
  }), [activeAssets]);
  const hasPressureTests = useMemo(() => filteredRecords.some(r => r.taskType === TaskType.PRESSURE_TEST && activeAssets.some(a => a.id === r.equipmentId)), [filteredRecords, activeAssets]);
  const hasRecharges = useMemo(() => filteredRecords.some(r => r.taskType === TaskType.RECHARGE && activeAssets.some(a => a.id === r.equipmentId)), [filteredRecords, activeAssets]);
  const hasFlowTests = useMemo(() => filteredRecords.some(r => r.taskType === TaskType.FLOW_TEST && activeAssets.some(a => a.id === r.equipmentId && (a.type === EquipmentType.HOSE_REEL || a.type === EquipmentType.HYDRANT))), [filteredRecords, activeAssets]);

  const finalizedDate = useMemo(() => {
    if (filteredRecords.length === 0) return new Date().toISOString();
    
    // Prefer Maintenance records for the report date
    const maintenanceRecords = filteredRecords.filter(r => r.taskType === TaskType.MAINTENANCE || r.task_type === TaskType.MAINTENANCE);
    const recordsToUse = maintenanceRecords.length > 0 ? maintenanceRecords : filteredRecords;

    const sorted = [...recordsToUse].sort((a, b) => {
      const dateA = a.date || a.created_at || '';
      const dateB = b.date || b.created_at || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    const latest = sorted[0];
    return latest.date || latest.created_at || new Date().toISOString();
  }, [filteredRecords]);

  const maintenanceDate = useMemo(() => finalizedDate.split('T')[0], [finalizedDate]);
  const nextMaintenanceDate = useMemo(() => new Date(new Date(maintenanceDate).setFullYear(new Date(maintenanceDate).getFullYear() + 1)).toISOString().split('T')[0], [maintenanceDate]);
  const rectificationDueDate = useMemo(() => new Date(new Date(maintenanceDate).setDate(new Date(maintenanceDate).getDate() + 30)).toISOString().split('T')[0], [maintenanceDate]);
  const cocNumber = useMemo(() => `CERT-${client.id.toUpperCase().slice(0, 4)}-${new Date(maintenanceDate).getFullYear()}`, [client.id, maintenanceDate]);

  const defectiveAssets = useMemo(() => {
    return activeAssets.filter(item => {
      const assetId = String(item.id || '').trim();
      const latest = records
        .filter(r => String(r.equipmentId || r.equipment_id || '').trim() === assetId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const isPressureTestDue = latest?.pressureTestOption === 'later';
      const m = (item.manufacturer || '').toLowerCase();
      const mk = (item.make || '').toLowerCase();
      const isFlashFire = m.includes('flash fire') || m.includes('flashfire') || mk.includes('flash fire') || mk.includes('flashfire');
      const hasVesselFailure = latest?.findings?.vessel_condition === false;

      return !(latest?.status === 'Pass' && !isPressureTestDue && !isFlashFire && !hasVesselFailure);
    }).map(item => {
      const latest = records
        .filter(r => String(r.equipmentId || r.equipment_id || '').trim() === String(item.id || '').trim())
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      return { asset: item, record: latest || null };
    });
  }, [activeAssets, records]);


  const failedItems = useMemo(() => {
    const itemsFromRecords = activeAssets.map(asset => {
      const assetId = String(asset.id || '').trim();
      const record = records
        .filter(r => String(r.equipmentId || r.equipment_id || '').trim() === assetId)
        .sort((a, b) => {
          const dateA = a.date || a.created_at || '';
          const dateB = b.date || b.created_at || '';
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })[0];
      
      if (!record) return null;
      
      const isCO2 = asset.size?.toLowerCase().includes('co2');
      const definition = isCO2 
        ? (EQUIPMENT_DEFINITIONS.find(d => d.type === EquipmentType.CO2_EXTINGUISHER) || EQUIPMENT_DEFINITIONS.find(d => d.type === asset.type))
        : EQUIPMENT_DEFINITIONS.find(d => d.type === asset.type);
      const checklistItems = definition?.checklists[record.taskType] || [];
      
      const failedChecks = Object.entries(record.findings || {})
        .filter(([_, val]) => val === false)
        .map(([id]) => checklistItems.find(item => item.id === id))
        .filter(Boolean) as { id: string, label: string }[];

      if (record.status !== 'Pass' || failedChecks.length > 0) {
        return { asset, record, failedChecks, source: 'record' as const };
      }
      return null;
    }).filter(Boolean);

    const itemsFromFaults = faults
      .filter(f => f.status === 'Open')
      .map(f => {
        const asset = equipment.find(e => e.id === f.equipmentId);
        if (!asset) return null;
        return { 
          asset, 
          record: { status: 'Fail', notes: f.description, date: f.timestamp } as any, 
          failedChecks: [{ id: 'fault', label: f.description }],
          source: 'fault' as const
        };
      })
      .filter(Boolean);

    // Merge and deduplicate by asset ID (preferring record if both exist)
    const merged: { asset: Equipment, record: InspectionRecord, failedChecks: { id: string, label: string }[], source: 'record' | 'fault' }[] = [...itemsFromRecords] as any;
    itemsFromFaults.forEach(fItem => {
      if (fItem && !merged.some(m => m.asset.id === fItem.asset.id)) {
        merged.push(fItem as any);
      }
    });

    return merged;
  }, [activeAssets, filteredRecords, faults, equipment]);

  const failedItemsForDisplay = useMemo(() => {
    if (!hasPressureTests) return failedItems;
    return failedItems.filter(item => !item.record.notes?.includes('PRESSURE TEST DUE'));
  }, [failedItems, hasPressureTests]);

  const defectiveAssetsChunks = useMemo(() => {
    const chunks = [];
    // Defective registry can fit more items per page with smaller fonts
    for (let i = 0; i < defectiveAssets.length; i += 12) {
      chunks.push(defectiveAssets.slice(i, i + 12));
    }
    return chunks;
  }, [defectiveAssets]);

  const failedItemsChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < failedItemsForDisplay.length; i += 6) {
      chunks.push(failedItemsForDisplay.slice(i, i + 6));
    }
    return chunks;
  }, [failedItemsForDisplay]);

  const failedItemsLetterChunks = useMemo(() => {
    const chunks = [];
    // Letter has more space, can fit maybe 8 items
    for (let i = 0; i < failedItemsForDisplay.length; i += 8) {
      chunks.push(failedItemsForDisplay.slice(i, i + 8));
    }
    return chunks;
  }, [failedItemsForDisplay]);

  const stats = useMemo(() => {
    const siteStats = calculateSiteStats(activeAssets, records);
    
    const typeCounts: Record<string, number> = {};
    activeAssets.filter(a => !a.isArchived).forEach(item => {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });

    const lowPressureAssets = activeAssets.filter(e => !e.isArchived).filter(e => {
      const latest = records.filter(r => String(r.equipmentId || r.equipment_id || '').trim() === String(e.id || '').trim()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      const m = (e.manufacturer || '').toLowerCase();
      const mk = (e.make || '').toLowerCase();
      const isFlashFire = m.includes('flash fire') || m.includes('flashfire') || mk.includes('flash fire') || mk.includes('flashfire');
      
      return (e.type === EquipmentType.HOSE_REEL || e.type === EquipmentType.HYDRANT) && 
             latest?.flow_pressure_kpa && parseFloat(latest.flow_pressure_kpa) < 100 && parseFloat(latest.flow_pressure_kpa) !== 0 &&
             !isFlashFire;
    });
    const hasLowPressure = lowPressureAssets.length > 0 && !hasFlashFire;

    const typeOrder: Record<string, number> = {
      [EquipmentType.EXTINGUISHER]: 1,
      [EquipmentType.CO2_EXTINGUISHER]: 1,
      [EquipmentType.HOSE_REEL]: 2,
      [EquipmentType.HYDRANT]: 3,
      [EquipmentType.BOOSTER_CONNECTION]: 4
    };

    const sortedSummary = Object.entries(typeCounts).sort((a, b) => {
      const orderA = typeOrder[a[0]] || 99;
      const orderB = typeOrder[b[0]] || 99;
      return orderA - orderB;
    });

    return { 
      total: siteStats.total, 
      passed: siteStats.passed, 
      finalPercentage: siteStats.finalPercentage,
      percentage: siteStats.finalPercentage, 
      equipmentTypeSummary: sortedSummary,
      hasLowPressure,
      lowPressureAssets,
      deferredPTCount: siteStats.deferredPTCount,
      isCompliant: siteStats.isCompliant && !hasLowPressure,
      maintenanceDate: maintenanceDate,
      nextMaintenanceDate: nextMaintenanceDate,
      rectificationDueDate: rectificationDueDate,
      sortedSummary
    };
  }, [activeAssets, records, faults, maintenanceDate, nextMaintenanceDate, rectificationDueDate, hasFlashFire]);

  const flowTestData = useMemo(() => {
    return activeAssets
      .filter(asset => asset.type === EquipmentType.HOSE_REEL || asset.type === EquipmentType.HYDRANT)
      .map(asset => {
        const record = records
          .filter(r => String(r.equipmentId || r.equipment_id || '').trim() === String(asset.id || '').trim() && r.taskType === TaskType.FLOW_TEST)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        return { asset, record };
      }).filter(td => td.record);
  }, [activeAssets, records]);

  const isFlowTestFailed = useMemo(() => {
    return flowTestData.some(({ record }) => {
      if (!record) return false;
      // Flow test only fails if status is Fail AND flow or pressure is low
      return record.status === 'Fail' && (
             (record.calculatedFlowLpm && parseFloat(record.calculatedFlowLpm) < 24) || 
             (record.flow_pressure_kpa && parseFloat(record.flow_pressure_kpa) < 100)
      );
    });
  }, [flowTestData]);

  const averageHoseReelFlow = useMemo(() => {
    const testedUnits = flowTestData.filter(td => td.record && td.asset.type === EquipmentType.HOSE_REEL);
    if (testedUnits.length === 0) return '0.0';
    const totalFlow = testedUnits.reduce((acc, { record }) => {
      const flow = parseFloat(record?.calculatedFlowLpm || '0');
      return acc + flow;
    }, 0);
    return (totalFlow / testedUnits.length).toFixed(1);
  }, [flowTestData]);

  const averageHydrantFlow = useMemo(() => {
    const testedUnits = flowTestData.filter(td => td.record && td.asset.type === EquipmentType.HYDRANT);
    if (testedUnits.length === 0) return '0.0';
    const totalFlow = testedUnits.reduce((acc, { record }) => {
      const flow = parseFloat(record?.calculatedFlowLpm || '0');
      return acc + flow;
    }, 0);
    return (totalFlow / testedUnits.length).toFixed(1);
  }, [flowTestData]);

  const latestClientRecord = useMemo(() => {
    const clientRecords = records.filter(r => activeAssets.some(e => e.id === (r.equipmentId || r.equipment_id)));
    // Prefer Maintenance records for the report date
    const maintenanceRecords = clientRecords.filter(r => r.taskType === TaskType.MAINTENANCE || r.task_type === TaskType.MAINTENANCE);
    if (maintenanceRecords.length > 0) {
      return maintenanceRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    }
    return clientRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  }, [activeAssets, records]);

  const formatMonthYear = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
  };

  const siteTechnicians = useMemo(() => {
    // If the client has a technicianId, we only show that specific technician (locked to creator)
    if (client.technicianId) {
      const creator = technicians.find(t => t.id === client.technicianId);
      if (creator && creator.name !== 'Precision Management') return [creator];
      if (creator && creator.name === 'Precision Management') return [];
    }

    const techNames = Array.from(new Set(filteredRecords.filter(r => activeAssets.some(a => a.id === (r.equipmentId || r.equipment_id))).map(r => String(r.inspectorName)))) as string[];
    
    const found: any[] = [];
    technicians.forEach(t => {
      // Skip Precision Management from the Personnel Audit section
      if (t.name === 'Precision Management') return;

      const subMatch = t.subUsers?.find(s => techNames.some(name => name.includes(`(${s.name})`)));
      if (subMatch) {
        found.push({
          ...t,
          id: subMatch.id,
          name: `${t.name} (${subMatch.name})`,
          signature: subMatch.signature || t.signature,
          saqccCardPhoto: subMatch.saqccCardPhoto || t.saqccCardPhoto
        });
      } else if (techNames.some(name => name.includes(t.name) || name.includes(t.saqcc))) {
        found.push(t);
      }
    });

    // Only show displayTechnician if no creator and not management
    if (found.length === 0 && displayTechnician && displayTechnician.name !== 'Precision Management') {
      return [displayTechnician];
    }

    return found;
  }, [filteredRecords, activeAssets, technicians, activeTech, client.technicianId]);

  const pressureTestChunks = useMemo(() => {
    const pts = records.filter(r => r.taskType === TaskType.PRESSURE_TEST && activeAssets.some(a => a.id === r.equipmentId));
    const chunks = [];
    for (let i = 0; i < pts.length; i += 20) {
      chunks.push(pts.slice(i, i + 20));
    }
    return chunks;
  }, [records, activeAssets]);

  const rechargeChunks = useMemo(() => {
    const recs = records.filter(r => r.taskType === TaskType.RECHARGE && activeAssets.some(a => a.id === r.equipmentId));
    const chunks = [];
    for (let i = 0; i < recs.length; i += 20) {
      chunks.push(recs.slice(i, i + 20));
    }
    return chunks;
  }, [records, activeAssets]);

  const flowTestChunks = useMemo(() => {
    const flows = records.filter(r => r.taskType === TaskType.FLOW_TEST && activeAssets.some(a => a.id === r.equipmentId));
    const chunks = [];
    for (let i = 0; i < flows.length; i += 20) {
      chunks.push(flows.slice(i, i + 20));
    }
    return chunks;
  }, [records, activeAssets]);

  const maintenanceChunks = useMemo(() => {
    const chunks = [];
    // Increase to 45 items per page with even smaller fonts
    for (let i = 0; i < activeAssets.length; i += 45) {
      chunks.push(activeAssets.slice(i, i + 45));
    }
    return chunks;
  }, [activeAssets]);

  const sacasCertUrl = useMemo(() => {
    const yearKey = `pfs_sacas_cert_${selectedYear}`;
    const item = branding.find(b => b.id === yearKey) || branding.find(b => b.id === 'pfs_sacas_cert');
    if (item?.content) return getProxiedImageUrl(item.content);
    return null;
  }, [branding, selectedYear]);

  const handleDownloadPdf = async () => {
    if (!reportContainerRef.current) return;
    setIsGeneratingPdf(true);
    
    // Temporarily reset zoom for clean capture
    const originalTransform = reportContainerRef.current.style.transform;
    reportContainerRef.current.style.transform = 'none';
    
    await new Promise(r => setTimeout(r, 500));
    try {
      const pdf = new jsPDF('p', 'mm', 'a4', false);
      const pages = reportContainerRef.current.querySelectorAll('.report-page');
      
      if (pages.length === 0) {
        throw new Error("No report pages found to capture.");
      }

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        page.classList.add('generating-pdf');
        
        setPdfProgress(Math.round(((i + 1) / pages.length) * 100));
        
        if (i > 0) pdf.addPage();
        
        // Increased delay to ensure images are fully rendered before capture
        await new Promise(r => setTimeout(r, 300));

        const canvas = await html2canvas(page, {
            scale: 1.5, // Reduced scale for better mobile performance and smaller file size
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            windowWidth: 1200,
            onclone: (clonedDoc) => {
              const images = clonedDoc.getElementsByTagName('img');
              for (let img of Array.from(images)) {
                img.setAttribute('crossOrigin', 'anonymous');
              }
            }
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.75); // Use JPEG with more compression
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        
        page.classList.remove('generating-pdf');
      }
      
      const fileName = `${client.name}_Comprehensive_SANS_Report.pdf`;
      
      // Mobile-friendly download approach
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(url);
      }, 500);
    } catch (err) {
      console.error("PDF generation failed", err);
      const debugInfo = `Canvas dimensions: ${reportContainerRef.current?.offsetWidth}x${reportContainerRef.current?.offsetHeight}`;
      alert(`PDF generation failed: ${err instanceof Error ? err.message : 'Unknown error'}. Debug: ${debugInfo}. Please try again.`);
    } finally {
      if (reportContainerRef.current) {
        reportContainerRef.current.style.transform = originalTransform;
      }
      setIsGeneratingPdf(false);
      setPdfProgress(0);
    }
  };

  const handleSave = () => {
    if (!onSaveReport) return;
    
    const report: SavedReport = {
      id: `report_${Date.now()}`,
      client_id: client.id,
      type: 'Comprehensive',
      date: new Date().toISOString(),
      data: {
        equipment: activeAssets,
        records: filteredRecords,
        faults: faults
      },
      created_at: new Date().toISOString()
    };
    
    onSaveReport(report);
    alert("Report issued and saved to archive.");
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center">
      <div className="no-print p-6 flex justify-between items-center bg-white border-b sticky top-0 z-[100] w-full shadow-md">
        <button onClick={onBack} className="text-slate-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 px-4 py-2 border rounded-xl hover:bg-slate-50">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Back
        </button>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border mr-4">
            <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" /></svg>
            </button>
            <span className="text-[10px] font-black text-slate-600 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            </button>
          </div>
          <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg relative overflow-hidden">
            <span className="relative z-10">
              {isGeneratingPdf ? `Generating ${pdfProgress}%` : 'Export PDF Report'}
            </span>
            {isGeneratingPdf && (
              <div 
                className="absolute inset-y-0 left-0 bg-red-600 transition-all duration-300" 
                style={{ width: `${pdfProgress}%` }}
              />
            )}
          </button>
          {!isReadOnly && onSaveReport && (
            <button 
              onClick={handleSave}
              className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 002-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              Issue & Save Report
            </button>
          )}
          <button onClick={() => window.print()} className="bg-red-600 text-white px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">Print Report</button>
        </div>
      </div>

      <div ref={reportContainerRef} className="print-area w-full max-w-[210mm] space-y-8 py-4 origin-top transition-transform duration-200" style={{ transform: `scale(${zoom})` }}>
        
        {/* PAGE 1: COVER PAGE */}
        <div className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col items-center justify-between text-center border shadow-lg mx-auto relative">
          <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
          <div className="flex-1 flex flex-col items-center justify-center space-y-8 w-full">
            <ReportLogo type="company" className="w-56 h-56" branding={branding} />
            <div className="space-y-4">
              <h1 className="text-5xl font-black text-slate-900 uppercase tracking-tight leading-none">Comprehensive <br/> Technical Registry</h1>
              <p className="text-red-600 font-black uppercase tracking-[0.4em] text-sm">SANS 1475 Regulatory Evidence</p>
            </div>
            <div className="h-1 w-40 bg-slate-900 rounded-full" />
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-800 uppercase leading-tight">{client.name}</h2>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">{client.address}</p>
              <p className="text-red-600 font-black uppercase tracking-[0.2em] text-xs mt-2">
                Maintenance Cycle: {formatMonthYear(maintenanceDate)} to {formatMonthYear(nextMaintenanceDate)}
              </p>
            </div>
            <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl flex flex-col items-center justify-center text-center">
               <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Compliance Score</p>
               <p className="text-7xl font-black">{stats.finalPercentage}%</p>
               <div className="mt-4 px-4 py-1 rounded-full bg-white/10 text-[9px] font-black uppercase tracking-widest">
                 Official Maintenance Record
               </div>
            </div>
            <div className="max-w-md mx-auto p-4 bg-amber-50 border border-amber-200 rounded-2xl">
               <p className="text-[9px] text-amber-800 font-black uppercase leading-relaxed">
                 REGULATORY REMINDER: In accordance with SANS 1475-1:2010 Clause 5.10, all fire equipment registers and maintenance records must be maintained and kept for a minimum period of 5 years.
               </p>
            </div>
            <div className="max-w-md mx-auto p-3 border-2 border-slate-900 rounded-2xl bg-white shadow-sm">
              <p className="text-[8px] text-slate-900 font-black uppercase tracking-tight leading-normal text-center">
                REGULATORY AUDIT NOTICE: This report is officially linked with the SACAS regulatory body. All maintenance records and physical assets documented herein are subject to random verification audits by SACAS to ensure strict adherence to SANS 1475 quality standards.
              </p>
            </div>
          </div>
          <div className="w-full space-y-4">
            <div className="flex justify-between items-center px-4">
               <div className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest space-y-1">
                 <p>SACAS Permit: {SACAS_PERMIT_NUMBER}</p>
               </div>
               <div className="flex gap-4 items-center scale-90">
                 <ReportLogo type="saqcc" className="w-[60px] h-[45px]" branding={branding} />
                 <ReportLogo type="sacas" className="w-[60px] h-[45px]" branding={branding} />
               </div>
            </div>
            <CompanyFooter />
          </div>
        </div>
        
        {/* PAGE 2: SACAS CERTIFICATE */}
        {sacasCertUrl && (
          <div className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto relative overflow-hidden">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-8">
               <div className="flex items-center gap-4 text-left">
                 <ReportLogo type="company" className="w-12 h-12" branding={branding} />
                 <div>
                   <h2 className="text-xl font-black uppercase tracking-tight text-left">SANS 1475 Accreditation</h2>
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-left">Official Regulatory Permit</p>
                 </div>
               </div>
               <div className="text-right">
                 <p className="text-[10px] font-black uppercase">PERMIT-{SACAS_PERMIT_NUMBER}</p>
               </div>
            </div>
            <div className="flex-1 flex items-center justify-center bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 overflow-hidden p-4">
               <img 
                 src={sacasCertUrl} 
                 className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" 
                 alt="SACAS Certificate" 
                 crossOrigin="anonymous" 
                 referrerPolicy="no-referrer" 
               />
            </div>
            <div className="mt-8">
              <CompanyFooter branding={branding} />
            </div>
          </div>
        )}

        {/* PAGE 3: MAINTENANCE CERTIFICATE (COM) */}
        <div className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto relative overflow-hidden">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-4">
               <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-28 h-28 flex items-center justify-center">
                      <ReportLogo type="company" className="w-full h-full" branding={branding} />
                    </div>
                    <div className="text-left"><h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-1">Precision Fire Services</h1><div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Official Fire Equipment Registry</div></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-black text-slate-900 uppercase tracking-widest text-left">
                     <span>PTY (LTD)</span><span className="w-1 h-1 bg-slate-300 rounded-full" /><span>REG: 2014/139488/07</span><span className="w-1 h-1 bg-slate-300 rounded-full" /><span>SACAS PERMIT: {SACAS_PERMIT_NUMBER}</span>
                  </div>
               </div>
               <div className="flex flex-col items-end gap-3">
                 <div className="flex gap-4 items-center scale-90">
                   <ReportLogo type="saqcc" className="w-[60px] h-[45px]" branding={branding} />
                   <ReportLogo type="sacas" className="w-[60px] h-[45px]" branding={branding} />
                 </div>
                 <div className="text-right"><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Certificate Ref: {cocNumber}</p></div>
               </div>
            </div>

            <div className="flex-1 flex flex-col">
               <div className="text-center space-y-1 mb-4">
                  <h2 className="text-3xl font-black text-red-600 uppercase tracking-tighter leading-tight">
                    {stats.percentage < 100 ? 'Partial Maintenance Certificate (COM)' : 'Fire Equipment Maintenance Certificate (COM)'}
                  </h2>
                  <p className="text-slate-500 font-bold uppercase tracking-[0.3em] text-[10px]">SANS 1475 PART 1 & 2 REGULATORY MAINTENANCE RECORD</p>
               </div>

               <div className="space-y-4 text-center py-4 border-y border-slate-100 mb-4 text-left">
                  <div className="space-y-1 text-center">
                    <p className="text-[10px] text-slate-400 font-bold italic uppercase tracking-widest leading-none">This document formally certifies the fire equipment maintenance at:</p>
                    <h3 className="text-2xl font-black text-slate-900 uppercase leading-tight">{client.name}</h3>
                    <p className="text-xs text-slate-600 font-bold uppercase tracking-wide leading-tight">{client.address}</p>
                  </div>
                  <div className="max-w-2xl mx-auto p-4 bg-slate-50 rounded-[1.5rem] border border-slate-200">
                    <p className="text-[11px] text-slate-800 font-black leading-relaxed uppercase tracking-tight text-center">
                      This certificate serves to confirm that the portable firefighting equipment (Extinguishers, Hose Reels and Hydrant Valves) at the above premises have been serviced and maintained in accordance with SANS 1475 Parts 1 & 2, SANS 10105-1 and the Occupational Health and Safety Act.
                    </p>
                  </div>
                  <div className="max-w-xl mx-auto mt-2 p-3 border-2 border-red-100 rounded-2xl bg-red-50/30">
                    <p className="text-[8px] text-red-700 font-black uppercase tracking-tight leading-normal text-center">
                      NOTICE: This document certifies that maintenance has been performed on the specified equipment only. This certificate does NOT substitute for a Fire Clearance Certificate or any other statutory certification required for occupancy as issued by a Local Authority or Fire Department.
                    </p>
                  </div>
               </div>

               <div className="grid grid-cols-12 gap-8 items-start flex-1 text-left">
                  <div className="col-span-8 space-y-4">
                     <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-1">Technical Audit Summary</h4>
                     <div className="space-y-1">
                        {(stats.equipmentTypeSummary as [string, number][]).map(([type, count]) => (
                          <div key={type} className="flex justify-between items-center py-0.5 border-b border-slate-50">
                             <span className="text-[10px] font-black text-slate-800 uppercase">{type}</span>
                             <span className="text-[9px] font-black text-slate-900 px-2 py-0.5 bg-slate-100 rounded">QTY: {count}</span>
                          </div>
                        ))}
                     </div>
                     <div className="bg-slate-50 p-4 rounded-2xl border grid grid-cols-2 gap-6 mt-4">
                        <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Maintenance Date</p><p className="text-xs font-black text-slate-900 uppercase">{formatDate(maintenanceDate)}</p></div>
                        <div><p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Next Service Due</p><p className="text-xs font-black text-red-600 uppercase">{formatDate(nextMaintenanceDate)}</p></div>
                     </div>
                  </div>
                  <div className="col-span-4 flex flex-col items-center justify-center pt-10">
                      <div className={`relative w-40 h-40 rounded-full border-8 bg-white flex flex-col items-center justify-center text-center shadow-xl transform rotate-[-5deg] ${stats.finalPercentage < 100 ? 'border-red-600' : 'border-emerald-600'}`}>
                         <div className={`text-[10px] font-black uppercase mb-1 ${stats.finalPercentage < 100 ? 'text-red-700' : 'text-emerald-700'}`}>SANS 1475</div>
                         <div className={`text-[16px] font-black uppercase leading-none my-1 tracking-tighter ${stats.finalPercentage < 100 ? 'text-red-800' : 'text-emerald-800'}`}>
                           {stats.finalPercentage < 100 ? 'NON-COMPLIANT' : 'COMPLIANT'}
                         </div>
                         {stats.finalPercentage < 100 && (
                           <div className="text-[12px] font-black text-red-600 leading-none mb-1">KPA: {stats.finalPercentage}%</div>
                         )}
                         <div className={`text-[8px] font-bold uppercase opacity-50 ${stats.finalPercentage < 100 ? 'text-red-700' : 'text-emerald-700'}`}>REGISTRY SEAL</div>
                      </div>
                  </div>
               </div>

               <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-end">
                  {(() => {
                    const tech = technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management') ||
                                 technicians.find(t => (t.name === records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.inspectorName) && t.name !== 'Precision Management') ||
                                 (activeTech?.name !== 'Precision Management' ? activeTech : null);
                    if (!tech) return null;

                    const inspectionDate = records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || new Date().toISOString();
                    const validCards = Object.entries(tech.saqccCards || {})
                      .filter(([year, card]) => isSaqccCardValid(inspectionDate, year))
                      .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA));
                    const cardToDisplay = validCards.length > 0 ? validCards[0][1] : tech.saqccCardPhoto;

                    return (
                      <>
                        <div className="text-left">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Authorised Technician</p>
                          <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none">{tech.name}</h4>
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mt-1">SAQCC Registration: {tech.saqcc}</p>
                          <div className="mt-2 h-12 flex items-center">
                            {tech.signature && <img src={tech.signature} className="max-h-full mix-blend-multiply opacity-90" alt="Signature" crossOrigin={tech.signature.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />}
                          </div>
                        </div>
                        {cardToDisplay && (
                          <div className="w-48 aspect-[1.58/1] rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm bg-slate-50">
                            <img src={getProxiedImageUrl(cardToDisplay)} className="w-full h-full object-contain" alt="SAQCC Card" crossOrigin={cardToDisplay.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </>
                    );
                  })()}
               </div>
            </div>
            <CompanyFooter branding={branding} />
        </div>

        {/* PAGE 4: REGULATORY FAULT NOTIFICATION LETTER (FAULT REPORT) */}
        {failedItemsLetterChunks.map((chunk, pageIdx) => (
          <div key={`fault-letter-${pageIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto overflow-hidden text-slate-900 relative">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
              <div className="flex items-center gap-4">
                <ReportLogo type="company" className="w-16 h-16" branding={branding} />
                <div className="text-left">
                  <h1 className="text-2xl font-black uppercase tracking-tighter">Precision Fire Services</h1>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Official Fire Equipment Registry</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black uppercase">Date: {formatDate(maintenanceDate)}</p>
                <p className="text-xs font-bold text-slate-500 uppercase">Ref: {cocNumber}/FAULT/{pageIdx + 1}</p>
              </div>
            </div>

            <div className="flex-1 space-y-6 text-left">
              {pageIdx === 0 && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm font-bold uppercase">To: {client.name}</p>
                    <p className="text-sm font-bold uppercase">Subject: OFFICIAL NOTIFICATION OF TECHNICAL NON-CONFORMANCE & REGULATORY FAULTS</p>
                  </div>

                  <div className="space-y-4 text-xs leading-relaxed">
                    <p>Dear Management,</p>
                    <p>
                      During the technical audit conducted on <strong className="font-black">{formatDate(maintenanceDate)}</strong>, several fire protection assets were identified with critical faults. These faults render the equipment non-compliant with the <strong className="font-black">Occupational Health and Safety Act (Act 85 of 1993)</strong> and the <strong className="font-black">Pressure Equipment Regulations</strong>.
                    </p>
                    <div className="bg-red-50 p-4 rounded-xl border-2 border-red-600 shadow-sm mt-4">
                      <p className="text-[10px] font-black text-red-800 uppercase leading-tight">
                        RECTIFICATION DEADLINE: {formatDate(rectificationDueDate)}
                      </p>
                      <p className="text-[8px] font-bold text-red-600 uppercase mt-1 italic">
                        * ALL LISTED FAULTS MUST BE RECTIFIED WITHIN 30 DAYS TO MAINTAIN SITE COMPLIANCE.
                      </p>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-widest border-b border-slate-300 pb-1">
                  {pageIdx === 0 ? 'Summary of Detected Faults & Regulatory Clauses' : 'Detected Faults (Continued)'}
                </h3>
                <div className="overflow-hidden border border-slate-200 rounded-lg">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2 text-[9px] font-black uppercase">Asset SN</th>
                        <th className="px-3 py-2 text-[9px] font-black uppercase">Type</th>
                        <th className="px-3 py-2 text-[9px] font-black uppercase">Fault Detected</th>
                        <th className="px-3 py-2 text-[9px] font-black uppercase">Regulatory Clause</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chunk.map((item, idx) => (
                        <tr key={idx}>
                          <td className="px-3 py-2 text-[10px] font-black">{item.asset.serialNumber}</td>
                          <td className="px-3 py-2 text-[9px] font-bold text-slate-500">{item.asset.type}</td>
                          <td className="px-3 py-2 text-[9px] font-bold text-red-600 uppercase">
                            {(() => {
                              const isFlashFire = (() => {
                                const m = (item.asset.manufacturer || '').toLowerCase();
                                return m.includes('flash fire') || m.includes('flashfire');
                              })();
                              if (isFlashFire) return 'CONDEMNED (ILLEGAL)';
                              return item.failedChecks.map(c => c.label).join(', ') || item.record.status;
                            })()}
                          </td>
                          <td className="px-3 py-2 text-[9px] font-black text-slate-700">
                            {item.failedChecks.map(c => CLAUSE_MAPPING[c.id] || 'SANS 1475').filter((v, i, a) => a.indexOf(v) === i).join(', ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Technical Justification moved to separate page */}
            </div>
            <div className="mt-4">
              <CompanyFooter branding={branding} />
            </div>
          </div>
        ))}

        {/* PAGE 5: DEFECTIVE REGISTRY */}
        {stats.percentage < 100 && defectiveAssetsChunks.map((chunk, pageIdx) => (
          <div key={`defective-page-${pageIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto relative overflow-hidden">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-start border-b-4 border-red-600 pb-4 mb-6">
               <div className="flex items-center gap-4 text-left"><ReportLogo type="company" className="w-10 h-10" branding={branding} /><div><h2 className="text-lg font-black uppercase tracking-tight text-left text-red-600">Defective Equipment Registry</h2><p className="text-[7px] font-black text-slate-500 uppercase tracking-widest text-left">Non-Compliant Units & Remediation Requirements</p></div></div>
               <div className="text-right">
                 <p className="text-[8px] font-black uppercase">REF-{client.id.toUpperCase().slice(0,4)}-DEFECTS</p>
                 <p className="text-[7px] font-bold text-slate-400 uppercase">Page {pageIdx + 1} of {defectiveAssetsChunks.length}</p>
               </div>
            </div>
            
            <div className="flex-1 space-y-3 text-left overflow-hidden">
              {pageIdx === 0 && (
                <div className="p-2 bg-red-50 border border-red-100 rounded-xl flex justify-between items-center">
                  <div className="max-w-[75%]">
                    <p className="text-[8px] font-black text-red-800 uppercase leading-tight">
                      The following units failed the technical audit and must be repaired or replaced to achieve full site compliance.
                    </p>
                    <p className="text-[6px] font-bold text-red-600 uppercase mt-1 italic">
                      * ALL DEFECTS LISTED BELOW MUST BE RECTIFIED WITHIN 30 DAYS OF THE INSPECTION DATE TO MAINTAIN REGULATORY COMPLIANCE.
                    </p>
                  </div>
                  <div className="text-right bg-white p-1.5 rounded-lg border-2 border-red-600 shadow-sm">
                    <p className="text-[5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Rectification Due By</p>
                    <p className="text-sm font-black text-red-600 leading-none">{formatDate(rectificationDueDate)}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {chunk.map(({ asset, record }, idx) => (
                  <div key={asset.id} className="p-2 border border-slate-100 rounded-xl bg-white shadow-sm flex gap-2 items-start">
                    <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-white font-black text-[8px]">{ (pageIdx * 12) + idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-[8px] font-black text-slate-900 uppercase truncate">{asset.type} - {asset.serialNumber}</h4>
                          <p className="text-[5px] font-bold text-slate-400 uppercase">{asset.location}</p>
                        </div>
                        <span className={`px-1 py-0.5 rounded text-[5px] font-black uppercase ${
                          (record?.status === 'Condemned' || (asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire')) ? 'bg-red-600 text-white' : 
                          record?.pressureTestOption === 'later' ? 'bg-amber-600 text-white' :
                          'bg-amber-50 text-white'
                        }`}>
                          {(asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire') ? 'CONDEMNED (ILLEGAL)' : (record?.pressureTestOption === 'later' ? 'Pressure Test Due' : (record?.status || 'Pending'))}
                        </span>
                      </div>
                      <div className="mt-0.5 p-1 bg-slate-50 rounded-md">
                        <p className="text-[6px] font-black text-slate-600 uppercase tracking-tight">Failure Reason:</p>
                        <p className="text-[6px] font-medium text-slate-500 mt-0.5 italic">
                          {(() => {
                            if ((asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire')) return 'FLASH FIRE UNIT - Equipment is not SABS approved and must be condemned immediately.';
                            if (record?.pressureTestOption === 'later') return 'PRESSURE TEST DUE - Unit must be removed for hydrostatic testing.';
                            if (record?.status === 'Condemned') return 'UNIT CONDEMNED - Equipment is unsafe and must be replaced immediately.';
                            return record?.notes || 'Unit failed visual or technical inspection. Remediation required.';
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <CompanyFooter branding={branding} />
          </div>
        ))}

        {/* PAGE: SANS REGULATIONS & TECHNICAL JUSTIFICATION */}
        {failedItems.length > 0 && (
          <div className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto overflow-hidden text-slate-900 relative">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
              <div className="flex items-center gap-4">
                <ReportLogo type="company" className="w-16 h-16" branding={branding} />
                <div className="text-left">
                  <h1 className="text-2xl font-black uppercase tracking-tighter">Precision Fire Services</h1>
                  <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Regulatory Compliance Standards</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black uppercase">Date: {formatDate(maintenanceDate)}</p>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">SANS REGULATORY ANNEXURE</p>
              </div>
            </div>

            <div className="flex-1 space-y-8 text-left">
              {failedItems.some(item => (item.asset.manufacturer || '').toLowerCase().includes('flash fire')) && (
                <div className="bg-red-50 p-6 border-l-4 border-red-600 space-y-3 rounded-r-xl">
                  <p className="text-xs font-black text-red-700 uppercase tracking-widest">Critical Regulatory Alert: Flash Fire Equipment</p>
                  <p className="text-xs font-bold leading-relaxed text-red-900 italic">
                    "It is a requirement of SANS 1475 and its permit conditions that permit holders shall comply with all regulatory and statutory requirements. Flash Fire handheld fire extinguishers and hose reels are not SABS approved nor approved by any other accredited certification body. As such, Flash Fire fire extinguishers and hose reels may not be serviced. Any previous service provider should not have serviced any Flash Fire equipment as it would be considered an illegal service. These units must be condemned and removed from service immediately."
                  </p>
                </div>
              )}

              <div className="space-y-6">
                <div className="space-y-4">
                  <h4 className="text-sm font-black uppercase border-b-2 border-slate-900 pb-2 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full" />
                    Technical Justification & Regulatory Clauses
                  </h4>
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-4 text-xs leading-relaxed text-slate-700">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-black text-slate-900 mb-1 uppercase tracking-tight">SANS 1475-1 Clause 4: Structural Integrity</p>
                        <p>Mandates that any cylinder showing signs of external corrosion, deep pitting, or mechanical damage exceeding 10% of the wall thickness must be condemned. This ensures the pressure vessel remains safe under operational loads.</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-black text-slate-900 mb-1 uppercase tracking-tight">SANS 1475-1 Clause 5.4: Mass Verification</p>
                        <p>Requires precise mass verification of the charge. Loss of mass exceeding 10% of the rated charge renders the unit inoperable and non-compliant, as it cannot effectively suppress a fire.</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-black text-slate-900 mb-1 uppercase tracking-tight">SANS 1475-2 Clause 5.2: Hose Integrity</p>
                        <p>Specifies that fire hoses must be free of cracks, perishing, or leaks. High-pressure integrity is critical for the delivery of water or foam to the fire source.</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="font-black text-slate-900 mb-1 uppercase tracking-tight">SANS 10400-T: National Building Regulations</p>
                        <p>Requires all fire equipment to be maintained in a fully operative state at all times. Non-compliance is a violation of building safety laws.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 p-6 border border-amber-200 rounded-2xl space-y-3">
                  <p className="text-xs font-black text-amber-900 uppercase tracking-widest">Legal Responsibility Notice</p>
                  <p className="text-xs leading-relaxed text-amber-800">
                    Continued use of non-compliant equipment may invalidate your insurance coverage and poses a significant risk to life and property. In accordance with the <strong className="font-black">Occupational Health and Safety Act (Act 85 of 1993)</strong>, the responsible person must ensure all fire protection measures are functional.
                  </p>
                </div>
              </div>

              <div className="pt-8 flex justify-between items-end border-t border-slate-200">
                <div className="space-y-4">
                  <div className="h-16 w-48 border-b-2 border-slate-900 relative">
                    {displayTechnician?.signature && displayTechnician.name !== 'Precision Management' && (
                      <img src={displayTechnician.signature} className="max-h-full opacity-90 mix-blend-multiply absolute bottom-0 left-0" alt="Technician Signature" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black uppercase tracking-tight">{(displayTechnician?.name && displayTechnician.name !== 'Precision Management') ? displayTechnician.name : 'Authorized Technician'}</p>
                    <p className="text-[10px] font-bold text-red-600 uppercase tracking-[0.2em]">SAQCC Registered Competent Person: {(displayTechnician?.name && displayTechnician.name !== 'Precision Management') ? (displayTechnician.saqcc || 'Registered') : 'Registered'}</p>
                  </div>
                </div>
                <div className="flex gap-6 items-center grayscale opacity-60">
                  <ReportLogo type="saqcc" className="w-16 h-12" branding={branding} />
                  <ReportLogo type="sacas" className="w-16 h-12" branding={branding} />
                </div>
              </div>
            </div>
            <div className="mt-8">
              <CompanyFooter />
            </div>
          </div>
        )}

        {/* PAGE: REMARKS & FAILED ITEMS (Conditional) */}
        {failedItemsChunks.map((chunk, pageIdx) => (
          <div key={`failed-page-${pageIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-16 flex flex-col border shadow-lg mx-auto overflow-hidden relative">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4 mb-6">
              <div className="flex items-center gap-4 text-left">
                <ReportLogo type="company" className="w-10 h-10" branding={branding} />
                <div>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">Technical Audit</p>
                  <h3 className="text-lg font-black uppercase text-slate-900">Remarks & Remedial Actions</h3>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Registry Ref: REM-{client.id.toUpperCase().slice(0,4)}</p>
                <p className="text-[7px] font-bold text-slate-400 uppercase">Page {pageIdx + 1} of {failedItemsChunks.length}</p>
              </div>
            </div>

            <div className="flex-1 space-y-4 text-left">
              {pageIdx === 0 && (
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                  <p className="text-[10px] font-black text-red-800 uppercase tracking-tight">
                    The following assets have been identified with technical non-conformities or require immediate remedial action to restore full regulatory compliance.
                  </p>
                </div>
              )}

              <div className="overflow-hidden border border-slate-100 rounded-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest">Asset SN / QR / Type</th>
                      <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest">Failed Checks / Technician Remarks</th>
                      <th className="px-3 py-2 text-[8px] font-black uppercase tracking-widest text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {chunk.map(({ asset, record, failedChecks }, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 align-top">
                          <p className="text-[10px] font-black text-slate-900 uppercase">{asset.serialNumber}</p>
                          <p className="text-[7px] font-black text-red-600 uppercase tracking-tighter">QR: {asset.qrCode || asset.id.toUpperCase()}</p>
                          <p className="text-[7px] font-bold text-slate-400 uppercase">
                            {asset.type} - {(asset.type === EquipmentType.HOSE_REEL && (!asset.size || asset.size === 'N/A' || asset.size === 'Not Applicable')) ? '20mm (30m)' : (asset.size || 'N/A')}
                          </p>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="space-y-1">
                            {failedChecks.map(c => (
                              <p key={c.id} className="text-[8px] font-bold text-red-600 uppercase flex items-center gap-1">
                                <span className="w-1 h-1 bg-red-600 rounded-full" /> {c.label}
                              </p>
                            ))}
                            {record.notes && (
                              <p className="text-[8px] text-slate-600 italic font-medium mt-1">
                                Tech Remark: "{record.notes}"
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-right">
                          <span className={`text-[7px] font-black px-2 py-0.5 rounded uppercase ${
                            (record.status === 'Condemned' || (asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire')) ? 'bg-red-700 text-white' : 'bg-red-100 text-red-700'
                          }`}>
                            {(asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire') ? 'CONDEMNED (ILLEGAL)' : record.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <CompanyFooter />
          </div>
        ))}

        {/* PAGE 3: FLASH FIRE DOCUMENT (Conditional) */}
        {hasFlashFire && (
          <div className="report-page bg-white w-[210mm] h-[297mm] p-16 flex flex-col border shadow-lg mx-auto relative">
             <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
             <div className="flex justify-between items-start mb-10">
                <div className="flex flex-col gap-1 text-[10px] font-bold text-slate-600">
                  <p>www.saqccfire.co.za</p>
                  <p>+ 27(0) 11 455 3157</p>
                  <p>1475@saqccfire.co.za</p>
                </div>
                <div className="flex flex-col items-center">
                  <div className="border-4 border-red-600 p-2 text-red-600 font-black text-xl italic tracking-tighter">S.A.Q.C.C. FIRE</div>
                  <p className="text-[7px] font-bold text-center mt-1 uppercase max-w-[200px]">South African Qualification and Certification Committee for the Fire Industry</p>
                </div>
                <div className="text-right text-[8px] font-bold text-slate-500">
                  <p>Postnet Suite #86,</p>
                  <p>Private Bag X10020, Edenvale, 1610</p>
                  <p>1st Floor West, SamiG Office Square,</p>
                  <p>Greenvale Road, Wilbart, Germiston</p>
                </div>
             </div>

             <div className="flex-1 space-y-6 text-slate-800 text-sm leading-relaxed text-left">
                <h3 className="font-black uppercase tracking-widest border-b-2 border-slate-900 pb-2 mb-8">TO WHOM IT MAY CONCERN</h3>
                <p className="font-bold bg-red-50 p-4 border-l-4 border-red-600">Flash Fire equipment is not approved and in fact, any previous service provider should not have serviced any Flash Fire equipment as it would be considered an illegal service.</p>
                <p>SANS 1475 comprises of Part 1 for the reconditioning of fire extinguishers and Part 2 for the reconditioning of hose reels & hydrants.</p>
                <p>Compliance with SANS 1475 Part 1 is regulated under the Pressure Equipment Regulation and SANS 1475 Part 2 has become a legal requirement based on the requirements of the Application of the National Building Regulation: Fire Protection (SANS 10400 Part T) which states:</p>
                <p className="italic pl-6 border-l-2">"... Any hose reel installed in such building shall comply with the requirements in SANS 543, shall be installed in accordance with SANS 10105-1 and SANS 10400-W, and shall be maintained in accordance with the requirements in SANS 1475-2..." ; " ... Any hose reel so installed in any building shall bear, in a prominent position on the reel disc facing the user, the mark of certification from an accredited certification body."</p>
                <p>It is a requirement of SANS 1475 and its permit conditions that permit holders shall comply with all regulatory and statutory requirements. Flash Fire handheld fire extinguishers and hose reels are not SABS approved nor approved by any other accredited certification body. As such Flash Fire fire extinguishers and hose reels may not be serviced.</p>
             </div>

             <div className="mt-auto pt-8 border-t border-slate-200 text-center">
                <p className="text-[10px] font-bold text-slate-500">Directors: N. Allan (Chairperson); L. Davel (Vice Chairperson); M. Kielty (Treasurer); B. van der Merwe (1475 Chairperson); B. Birch (D&GS Chairman); General Manager: R. Cowan</p>
                <CompanyFooter />
             </div>
          </div>
        )}

        {/* PAGE 9: FLOW CERTIFICATE (Conditional) */}
        {hasFlowTests && (
          <div className="report-page bg-white w-[210mm] h-[297mm] p-4 flex flex-col border shadow-lg mx-auto break-after-page overflow-hidden relative">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-end border-b-2 border-slate-900 pb-1 mb-2">
              <div className="flex items-center gap-3">
                <ReportLogo type="company" className="w-12 h-12" branding={branding} />
                <div className="text-left space-y-0">
                  <h1 className="text-lg font-black uppercase tracking-tight leading-none text-slate-900">Precision Fire Services</h1>
                  <p className="text-[7px] text-red-600 font-black uppercase tracking-[0.3em]">Hydraulic Performance Certification</p>
                  <p className="text-[5px] font-bold text-slate-400 uppercase tracking-widest">
                      PTY (LTD) • REG: 2014/139488/07 • SACAS: {SACAS_PERMIT_NUMBER}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Certificate Number</p>
                <p className="text-sm font-black text-slate-900 uppercase tracking-tighter">FLOW-{client.id.toUpperCase().slice(0, 6)}</p>
                <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest">Testing Date: {formatDate(new Date().toISOString())}</p>
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="space-y-0.5 text-left">
                <h2 className="text-[6px] font-black text-slate-400 uppercase tracking-[0.3em]">Property Authorized</h2>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">{client.name}</h3>
                  <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest max-w-2xl">{client.address}</p>
                </div>
              </div>

              <div className="bg-slate-50 p-2 rounded-[1rem] border border-slate-200 text-left">
                <p className="text-[9px] font-medium leading-tight italic text-slate-700">
                  The hydraulic equipment listed below has been subjected to standardized flow rate validation in accordance with <strong className="text-slate-900">SANS 1128 Parts 1 & 2</strong>. These tests verify the effective delivery of water medium at specified pressures to ensure operational readiness for firefighting intervention.
                </p>
              </div>

              <div className="py-10 border-y-2 border-slate-900 my-4 bg-slate-50 rounded-[2rem] p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                  <ReportLogo type="company" className="w-32 h-32" branding={branding} />
                </div>
                <div className="relative z-10 space-y-4">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-[0.3em]">Certificate of Performance</h3>
                  <div className="space-y-4">
                    <p className="text-[10px] font-medium text-slate-700 leading-relaxed">
                      This document serves as official verification that <span className="font-black text-slate-900 underline decoration-red-600 decoration-2 underline-offset-2">{flowTestData.length}</span> fire protection units at <span className="font-black text-slate-900">{client.name}</span> have undergone hydraulic flow testing.
                    </p>
                    
                    <div className="flex flex-col items-center justify-center gap-2 py-4">
                      <div className={`text-3xl font-black uppercase tracking-tighter ${isFlowTestFailed ? 'text-red-700' : 'text-emerald-700'}`}>
                        {isFlowTestFailed ? 'Flow Test Failed' : 'Flow Test Passed'}
                      </div>
                      <div className={`h-1 w-32 rounded-full ${isFlowTestFailed ? 'bg-red-600' : 'bg-emerald-600'}`} />
                      <div className="mt-2 flex gap-8 justify-center">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Avg Hose Reel Flow</p>
                          <p className="text-xl font-black text-slate-900">{averageHoseReelFlow} L/min</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Avg Hydrant Flow</p>
                          <p className="text-xl font-black text-slate-900">{averageHydrantFlow} L/min</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed max-w-xl mx-auto">
                      {isFlowTestFailed 
                        ? "One or more units failed to meet the minimum regulatory flow requirements. Immediate remedial action is required to ensure site safety compliance."
                        : "All tested units met or exceeded the minimum regulatory flow requirements as per SANS 1128 specifications."}
                    </p>
                    {stats.hasLowPressure && (
                      <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                        <p className="text-[10px] font-black text-red-800 uppercase tracking-widest">
                          WARNING: LOW WATER PRESSURE DETECTED. IMMEDIATE REMEDIAL ACTION REQUIRED.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-1 flex justify-between items-end">
                <div className="space-y-1 text-left">
                  <p className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Authorised Maintenance Signature</p>
                  <div className="h-12 w-40 border-b-2 border-slate-900 relative bg-slate-50 rounded-t-lg overflow-hidden flex items-center justify-center px-2">
                    {displayTechnician?.signature && displayTechnician.name !== 'Precision Management' ? (
                      <img src={displayTechnician.signature} className="max-h-full opacity-90 mix-blend-multiply" alt="Tech Signature" crossOrigin={displayTechnician.signature.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />
                    ) : (latestClientRecord?.inspectorSignature && latestClientRecord.inspectorName !== 'Precision Management') ? (
                      <img src={latestClientRecord.inspectorSignature} className="max-h-full opacity-90 mix-blend-multiply" alt="Tech Signature" crossOrigin={latestClientRecord.inspectorSignature.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />
                    ) : (siteTechnicians.find(t => t.name !== 'Precision Management')?.signature) ? (
                      <img src={siteTechnicians.find(t => t.name !== 'Precision Management')!.signature} className="max-h-full opacity-90 mix-blend-multiply" alt="Tech Signature" crossOrigin={siteTechnicians.find(t => t.name !== 'Precision Management')!.signature.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />
                    ) : (
                      <p className="text-[6px] font-black text-slate-300 uppercase italic">Digital Authentication Recorded</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-none">
                      {(() => {
                        if (displayTechnician?.name && displayTechnician.name !== 'Precision Management') return displayTechnician.name;
                        if (latestClientRecord?.inspectorName && latestClientRecord.inspectorName !== 'Precision Management') return latestClientRecord.inspectorName;
                        const siteTech = siteTechnicians.find(t => t.name !== 'Precision Management');
                        if (siteTech) return siteTech.name;
                        return 'Authorized SANS Personnel';
                      })()}
                    </p>
                    <p className="text-[5px] font-black text-red-600 uppercase tracking-[0.3em] mt-0.5">Authorised Maintenance Provider</p>
                  </div>
                </div>
                
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div className={`relative w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center text-center shadow-md transform rotate-[-12deg] ${stats.hasLowPressure ? 'border-red-600 bg-white' : 'border-amber-500 bg-amber-50'}`}>
                    <div className={`text-[5px] font-black uppercase leading-none mb-0.5 ${stats.hasLowPressure ? 'text-red-600' : 'text-amber-700'}`}>Official SANS</div>
                    <div className={`text-[8px] font-black uppercase leading-tight ${stats.hasLowPressure ? 'text-red-700' : 'text-amber-800'}`}>
                      {stats.hasLowPressure ? 'NON COMPLIANT' : 'COMPLIANT'}
                    </div>
                    <div className={`text-[4px] font-bold uppercase mt-0.5 ${stats.hasLowPressure ? 'text-red-500' : 'text-amber-600'}`}>FLOW VERIFIED</div>
                  </div>
                </div>
              </div>
            </div>
            <CompanyFooter branding={branding} />
          </div>
        )}

        {/* PAGE 10: INSPECTION REGISTRY (Paginated) */}
        {maintenanceChunks.map((chunk, chunkIdx) => (
          <div key={`maint-${chunkIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-4 flex flex-col border shadow-lg mx-auto overflow-hidden relative">
            <div className="absolute top-1 right-4 text-[5px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="border-b-2 border-slate-900 pb-1 mb-1 flex justify-between items-end text-left">
              <div className="flex items-center gap-4">
                <ReportLogo type="company" className="w-8 h-8" branding={branding} />
                <div className="text-left">
                  <h1 className="text-base font-black uppercase tracking-tight">Precision Fire Services</h1>
                  <p className="text-[6px] font-black text-slate-500 uppercase tracking-widest">Technical Maintenance Ledger</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-lg font-black uppercase tracking-tighter">Official Fire Equipment Registry</h2>
                <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest">SANS 1475 Audit Trail • Page {chunkIdx + 1} of {maintenanceChunks.length}</p>
              </div>
            </div>

            <div className="flex-1 space-y-1">
               {chunkIdx === 0 && (
                 <div className="bg-slate-50 p-1.5 rounded-xl border border-slate-100 text-left">
                    <p className="text-[8px] font-black text-slate-800 leading-tight uppercase tracking-tight">
                      This ledger provides a comprehensive audit trail of all fire protection assets inspected during the current maintenance cycle, confirming operational status and regulatory compliance.
                    </p>
                 </div>
               )}
               <div className="overflow-hidden border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="px-1 py-0.5 text-[3.5px] font-black uppercase tracking-widest">Asset SN</th>
                        <th className="px-1 py-0.5 text-[3.5px] font-black uppercase tracking-widest">Seal #</th>
                        <th className="px-1 py-0.5 text-[3.5px] font-black uppercase tracking-widest">Type</th>
                        <th className="px-1 py-0.5 text-[3.5px] font-black uppercase tracking-widest text-center">Last Date</th>
                        <th className="px-1 py-0.5 text-[3.5px] font-black uppercase tracking-widest text-center">Next Due</th>
                        <th className="px-1 py-0.5 text-[3.5px] font-black uppercase tracking-widest text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {chunk.map(asset => {
                        const assetRecords = records.filter(r => String(r.equipmentId || r.equipment_id || '').trim() === String(asset.id || '').trim()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        const latest = assetRecords[0];
                        
                        // Find the latest record that actually has a seal serial number
                        const latestWithSeal = assetRecords.find(r => (r.sealSerialNumber || r.seal_serial_number) && (r.sealSerialNumber || r.seal_serial_number) !== '---');
                        const displaySeal = latestWithSeal?.sealSerialNumber || latestWithSeal?.seal_serial_number || latest?.sealSerialNumber || latest?.seal_serial_number || asset.sealSerialNumber || '---';

                        return (
                          <tr key={asset.id}>
                            <td className="px-1 py-0 text-[4px] font-black uppercase">{asset.serialNumber}</td>
                            <td className="px-1 py-0 text-[3.5px] font-bold text-slate-600 uppercase">{displaySeal}</td>
                            <td className="px-1 py-0 text-[3.5px] font-bold text-slate-500 uppercase">{asset.type}</td>
                            <td className="px-1 py-0 text-[4px] font-bold text-center">{latest ? formatDate(latest.date) : '---'}</td>
                            <td className="px-1 py-0 text-[4px] font-black text-center">{formatDate(asset.nextServiceDate)}</td>
                            <td className="px-1 py-0 text-right">
                              {latest ? (
                                <span className={`text-[3px] font-black px-1 py-0 rounded uppercase ${
                                  (latest.status === 'Pass' && !(asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire')) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {(asset.manufacturer || '').toLowerCase().replace(/\s/g, '').includes('flashfire') ? 'CONDEMNED (ILLEGAL)' : latest.status}
                                </span>
                              ) : (
                                <span className="text-[3px] font-black px-1 py-0 rounded uppercase bg-slate-100 text-slate-500">Pending</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </div>
            <CompanyFooter branding={branding} />
          </div>
        ))}

        {/* PAGE 11: PRESSURE TEST VALIDATION (Conditional & Paginated) */}
        {hasPressureTests && pressureTestChunks.map((chunk, chunkIdx) => (
          <div key={`pt-${chunkIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-4 md:p-6 flex flex-col border shadow-lg mx-auto overflow-hidden relative">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="border-b-4 border-amber-600 pb-1 md:pb-2 mb-1 md:mb-2 flex justify-between items-end">
              <div className="flex items-center gap-4 md:gap-6">
                <ReportLogo type="company" className="w-8 h-8 md:w-10 md:h-10" branding={branding} />
                <div className="text-left">
                  <h1 className="text-base md:text-lg font-black uppercase tracking-tight">Precision Fire Services</h1>
                  <p className="text-[6px] md:text-[7px] font-black text-amber-600 uppercase tracking-widest">Pressure Test Registry</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter">
                  {activeAssets.some(a => (a.manufacturer || '').toLowerCase().includes('co2') || (a.size || '').toLowerCase().includes('co2')) 
                    ? 'Hydrostatic Validation' 
                    : 'Pressure Test Validation'}
                </h2>
                <p className="text-[6px] md:text-[7px] font-bold text-slate-400 uppercase tracking-widest">Regulatory Cycle: 5-Year Overhaul • Page {chunkIdx + 1} of {pressureTestChunks.length}</p>
              </div>
            </div>

            <div className="flex-1 space-y-1 md:space-y-2">
               {chunkIdx === 0 && (
                 <div className="bg-amber-50 p-1 md:p-2 rounded-xl md:rounded-2xl border border-amber-100 text-left">
                    <p className="text-[8px] md:text-[9px] font-black text-amber-800 leading-relaxed uppercase tracking-tight">
                      This ledger confirms that the specified vessels have been tested to standard test pressures to verify elastic expansion and structural integrity in accordance with SANS 1475-1 Clause 6.
                    </p>
                 </div>
               )}
               <div className="overflow-hidden border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest">Asset SN</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest">Type</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-center">Test Date</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-center">kPa Tested</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-center">Next Test Due</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {chunk.map(r => {
                        const asset = activeAssets.find(a => a.id === r.equipmentId);
                        if (!asset) return null;
                        return (
                          <tr key={r.id}>
                            <td className="px-2 py-0 text-[8px] font-black uppercase">{asset.serialNumber}</td>
                            <td className="px-2 py-0 text-[7px] font-bold text-slate-500 uppercase">{asset.type}</td>
                            <td className="px-2 py-0 text-[8px] font-bold text-center">{formatDate(r.date)}</td>
                            <td className="px-2 py-0 text-[8px] font-black text-center text-amber-600">{r.testedToKpa || r.flow_pressure_kpa || '---'}</td>
                            <td className="px-2 py-0 text-[8px] font-black text-center">{formatDate(new Date(new Date(r.date).setFullYear(new Date(r.date).getFullYear() + 5)).toISOString())}</td>
                            <td className="px-2 py-0 text-right">
                              <span className={`text-[6px] font-black px-1 py-0 rounded uppercase ${r.status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {r.status === 'Pass' ? 'PASSED' : 'FAILED'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </div>
            <CompanyFooter branding={branding} />
          </div>
        ))}

        {/* PAGE 12: FLOW TEST REPORT (Conditional & Paginated) */}
        {hasFlowTests && flowTestChunks.map((chunk, chunkIdx) => (
          <div key={`flow-${chunkIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-4 md:p-6 flex flex-col border shadow-lg mx-auto break-after-page overflow-hidden relative">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="border-b-4 border-blue-600 pb-1 md:pb-2 mb-1 md:mb-2 flex justify-between items-end">
              <div className="flex items-center gap-4 md:gap-6">
                <ReportLogo type="company" className="w-8 h-8 md:w-10 md:h-10" branding={branding} />
                <div className="text-left">
                  <h1 className="text-base md:text-lg font-black uppercase tracking-tight">Precision Fire Services</h1>
                  <p className="text-[6px] md:text-[7px] font-black text-blue-600 uppercase tracking-widest">Flow Performance Ledger</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter">Flow Test Report</h2>
                <p className="text-[6px] md:text-[7px] font-bold text-slate-400 uppercase tracking-widest">Standard: SANS 1128 Part 1 & 2 • Page {chunkIdx + 1} of {flowTestChunks.length}</p>
              </div>
            </div>

            <div className="flex-1 space-y-1 md:space-y-2">
               {chunkIdx === 0 && (
                 <div className="bg-blue-50 p-1 md:p-2 rounded-xl md:rounded-2xl border border-blue-100 text-left">
                    <p className="text-[8px] md:text-[9px] font-black text-blue-800 leading-relaxed uppercase tracking-tight">
                      Flow rate validation confirms effective discharge of water medium from Hose Reels and Hydrants at dynamic pressures to ensure fire suppression capability.
                    </p>
                 </div>
               )}
               <div className="overflow-hidden border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest">Asset SN</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-center">Static kPa</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-center">Flow L/min</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {chunk.map(r => {
                        const asset = activeAssets.find(a => a.id === r.equipmentId);
                        if (!asset) return null;
                        return (
                          <tr key={r.id}>
                            <td className="px-2 py-0 text-[8px] font-black uppercase">{asset.serialNumber}</td>
                            <td className="px-2 py-0 text-[8px] font-bold text-center">{r.flow_pressure_kpa || '---'}</td>
                            <td className="px-2 py-0 text-[8px] font-black text-center">{r.calculatedFlowLpm || '---'}</td>
                            <td className="px-2 py-0 text-right">
                              <span className={`text-[6px] font-black px-1 py-0 rounded uppercase ${
                                (r.status === 'Fail' || (r.calculatedFlowLpm && parseFloat(r.calculatedFlowLpm) < 24) || r.flow_pressure_kpa === '0' || (r.flow_pressure_kpa && parseFloat(r.flow_pressure_kpa) < 100))
                                  ? 'bg-red-100 text-red-700' 
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}>
                                {(r.status === 'Fail' || (r.calculatedFlowLpm && parseFloat(r.calculatedFlowLpm) < 24) || r.flow_pressure_kpa === '0' || (r.flow_pressure_kpa && parseFloat(r.flow_pressure_kpa) < 100))
                                  ? 'FAIL' 
                                  : 'VALID'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </div>
            <CompanyFooter branding={branding} />
          </div>
        ))}

        {/* PAGE 13: RECHARGE PROTOCOL REPORT (Conditional & Paginated) */}
        {hasRecharges && rechargeChunks.map((chunk, chunkIdx) => (
          <div key={`recharge-${chunkIdx}`} className="report-page bg-white w-[210mm] h-[297mm] p-4 md:p-6 flex flex-col border shadow-lg mx-auto break-after-page overflow-hidden relative">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="border-b-4 border-red-600 pb-1 md:pb-2 mb-1 md:mb-2 flex justify-between items-end">
              <div className="flex items-center gap-4 md:gap-6">
                <ReportLogo type="company" className="w-8 h-8 md:w-10 md:h-10" branding={branding} />
                <div className="text-left">
                  <h1 className="text-base md:text-lg font-black uppercase tracking-tight">Precision Fire Services</h1>
                  <p className="text-[6px] md:text-[7px] font-black text-red-600 uppercase tracking-widest">Recharge & Overhaul Ledger</p>
                </div>
              </div>
              <div className="text-right">
                <h2 className="text-lg md:text-xl font-black uppercase tracking-tighter">Recharge Protocol Report</h2>
                <p className="text-[6px] md:text-[7px] font-bold text-slate-400 uppercase tracking-widest">Standard: SANS 1475-1 • Page {chunkIdx + 1} of {rechargeChunks.length}</p>
              </div>
            </div>

            <div className="flex-1 space-y-1 md:space-y-2">
               {chunkIdx === 0 && (
                 <div className="bg-red-50 p-1 md:p-2 rounded-xl md:rounded-2xl border border-red-100 text-left">
                    <p className="text-[8px] md:text-[9px] font-black text-red-800 leading-relaxed uppercase tracking-tight">
                      This ledger confirms that the specified units have undergone a full recharge or overhaul, including the replacement of extinguishing medium and internal inspection.
                    </p>
                 </div>
               )}
               <div className="overflow-hidden border border-slate-100 rounded-2xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white">
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest">Asset SN</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest">Type</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-center">Recharge Date</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-center">Medium</th>
                        <th className="px-2 py-1 text-[7px] font-black uppercase tracking-widest text-right">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {chunk.map(r => {
                        const asset = activeAssets.find(a => a.id === r.equipmentId);
                        if (!asset) return null;
                        return (
                          <tr key={r.id}>
                            <td className="px-2 py-0 text-[8px] font-black uppercase">{asset.serialNumber}</td>
                            <td className="px-2 py-0 text-[7px] font-bold text-slate-500 uppercase">{asset.type}</td>
                            <td className="px-2 py-0 text-[8px] font-bold text-center">{formatDate(r.date)}</td>
                            <td className="px-2 py-0 text-[8px] font-black text-center">{asset.size || '---'}</td>
                            <td className="px-2 py-0 text-right">
                              <span className={`text-[6px] font-black px-1 py-0 rounded uppercase ${r.status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {r.status === 'Pass' ? 'PASSED' : 'FAILED'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </div>
            </div>
            <CompanyFooter branding={branding} />
          </div>
        ))}

        {/* PAGE 4: MAINTENANCE CERTIFICATE (COM) - REMOVED PLACEHOLDER */}
        {/* ASSET DETAIL PAGES (One per equipment) */}
        {activeAssets.map((asset) => {
          const assetRecords = records.filter(r => String(r.equipmentId || r.equipment_id || '').trim() === String(asset.id || '').trim()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const displayPhotos = (assetRecords.flatMap(r => Array.isArray(r.photos) ? r.photos : []).length > 0) 
            ? assetRecords.flatMap(r => Array.isArray(r.photos) ? r.photos : []) 
            : (Array.isArray(asset.photos) ? asset.photos : []);
          const latestRecord = assetRecords[0];

          // Determine which checklists should be shown
          const isCO2 = asset.size?.toLowerCase().includes('co2');
          const definition = isCO2 
            ? (EQUIPMENT_DEFINITIONS.find(d => d.type === EquipmentType.CO2_EXTINGUISHER) || EQUIPMENT_DEFINITIONS.find(d => d.type === asset.type))
            : EQUIPMENT_DEFINITIONS.find(d => d.type === asset.type);
            
          const allTaskTypes = Object.keys(definition?.checklists || {}) as TaskType[];
          const taskTypesWithChecklists = allTaskTypes.filter(t => (definition?.checklists[t] || []).length > 0);
          
          // We want to show checklists that have records
          const taskTypesToShow = Array.from(new Set(assetRecords.map(r => r.taskType)))
            .filter(t => taskTypesWithChecklists.includes(t));

          return (
            <div key={asset.id} className="report-page bg-white w-[210mm] h-[297mm] p-12 flex flex-col border shadow-lg mx-auto break-after-page overflow-hidden relative">
               <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
               
                {/* Watermark - OVERLAY V12.19 */}
                {latestRecord && (
                  <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-35deg] opacity-[0.35] pointer-events-none select-none z-[100]">
                    <span className={`text-[230px] font-black uppercase tracking-[0.15em] ${latestRecord.status === 'Pass' ? 'text-emerald-500' : 'text-red-600'}`}>
                      {latestRecord.status === 'Pass' ? 'PASS' : (latestRecord.status === 'Condemned' ? 'CONDEMND' : 'FAIL')}
                    </span>
                  </div>
                )}

               <div className="flex justify-between items-start border-b-2 border-slate-900 pb-3 mb-4 relative z-10">
                  <div className="flex items-center gap-3 text-left">
                    <ReportLogo type="company" className="w-10 h-10" branding={branding} />
                    <div>
                      <h3 className="text-xl font-black uppercase text-slate-900 tracking-tight leading-none">Technical Record</h3>
                      <div className="mt-1 text-left">
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{client.name}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase">{client.building ? `${client.building}, ` : ''}{client.address}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex gap-3 items-center">
                      <ReportLogo type="saqcc" className="w-auto h-6" branding={branding} />
                      <ReportLogo type="sacas" className="w-auto h-6" branding={branding} />
                    </div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest">Registry UID: {asset.id.toUpperCase()}</p>
                  </div>
               </div>
               
               <div className="bg-slate-900 text-white p-5 rounded-2xl flex justify-between items-center shadow-md mb-6 text-left relative z-10">
                  <div>
                    <p className="text-[8px] font-black text-red-500 uppercase tracking-[0.3em] mb-1">Technical Identification</p>
                    <h4 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">
                      {asset.serialNumber}
                    </h4>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tight">
                      {asset.type} • {(asset.type === EquipmentType.HOSE_REEL && (!asset.size || asset.size === 'N/A' || asset.size === 'Not Applicable')) ? '20mm (30m)' : (asset.size || 'N/A')} • {asset.location}
                    </p>
                  </div>
                  {(() => {
                    const latestWithSeal = assetRecords.find(r => (r.sealSerialNumber || r.seal_serial_number) && (r.sealSerialNumber || r.seal_serial_number) !== '---');
                    const displaySeal = latestWithSeal?.sealSerialNumber || latestWithSeal?.seal_serial_number || assetRecords[0]?.sealSerialNumber || assetRecords[0]?.seal_serial_number || asset.sealSerialNumber;
                    if (!displaySeal || displaySeal === '---') return null;
                    return (
                      <div className="text-right">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Seal</p>
                        <p className="text-xl font-black text-white uppercase tracking-tighter">{displaySeal}</p>
                      </div>
                    );
                  })()}
               </div>

               <div className="flex-1 overflow-hidden text-left relative z-10">
                  <div className="grid grid-cols-1 gap-4">
                    {taskTypesToShow.map(taskType => {
                      const record = assetRecords.find(r => r.taskType === taskType);
                      const checklistItems = (definition?.checklists[taskType] || []);
                      if (checklistItems.length === 0) return null;

                      return (
                        <div key={taskType} className="space-y-2">
                           <div className="flex items-center justify-between border-b border-slate-900 pb-1">
                             <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">{taskType} Checklist</h5>
                             <span className={`text-[8px] font-black uppercase tracking-widest ${record ? 'text-slate-400' : 'text-red-600 animate-pulse'}`}>
                               {record ? formatDate(record.date) : 'PENDING AUDIT'}
                             </span>
                           </div>
                           <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                             {checklistItems.map(item => {
                               const result = record?.findings?.[item.id];
                               return (
                                 <div key={item.id} className="flex justify-between items-center py-1 border-b border-slate-50">
                                   <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tight">{item.label}</span>
                                   <div className={`w-4 h-4 rounded-md flex items-center justify-center shadow-sm ${result === true ? 'bg-emerald-500 text-white' : result === false ? 'bg-red-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-200'}`}>
                                     {result === true ? (
                                       <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                     ) : result === false ? (
                                       <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                     ) : (
                                       <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                                     )}
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                           {record?.notes && <p className="text-[9px] text-slate-500 font-bold italic mt-1 bg-slate-50 p-2 rounded-xl border border-slate-100 shadow-inner">Remarks: "{record.notes}"</p>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-4 pt-2">
                     <h5 className="text-[9px] font-black text-slate-900 uppercase tracking-[0.2em] border-b border-slate-900 pb-1">Visual Evidence & Technical Data</h5>
                     <div className="grid grid-cols-12 gap-4 items-start">
                        {/* 4 Photo Grid - V12.19 */}
                        <div className="col-span-12 md:col-span-6 grid grid-cols-2 gap-2">
                          {(displayPhotos.slice(0, 4).length > 0) ? (
                            displayPhotos.slice(0, 4).map((p, pIdx) => (
                              <div key={pIdx} className="flex flex-col items-center">
                                <div className="w-full h-[110px] rounded-xl overflow-hidden border-2 border-slate-100 shadow-md">
                                  <img 
                                    src={getProxiedImageUrl(p.includes('|') ? p.split('|')[0] : p)} 
                                    className="w-full h-full object-cover" 
                                    alt={`Evidence ${pIdx + 1}`} 
                                    crossOrigin="anonymous" 
                                    referrerPolicy="no-referrer" 
                                  />
                                </div>
                                {p.includes('|') && (
                                  <p className="text-[5px] font-black text-slate-400 uppercase mt-0.5 tracking-tighter">
                                    {new Date(parseInt(p.split('|')[1])).toLocaleString('en-ZA', { day: 'numeric', month: 'short' })}
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 w-full h-[110px] rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center">
                              <p className="text-[8px] font-black text-slate-300 uppercase underline">Legal Requirement: No Photo Logged</p>
                            </div>
                          )}
                        </div>

                        {/* Table on the right - COMPACT V12.19 */}
                        <div className="col-span-12 md:col-span-6 bg-white/60 backdrop-blur-sm border border-slate-100 rounded-xl overflow-hidden shadow-inner font-mono">
                           <div className="grid grid-cols-1 divide-y divide-slate-50">
                              <div className="flex justify-between items-center p-1.5 px-3 hover:bg-slate-50 transition-colors">
                                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Manufacturer</span>
                                 <span className="text-[8px] font-black text-slate-900 uppercase">{asset.manufacturer || 'N/A'}</span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 px-3 hover:bg-slate-50 transition-colors">
                                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Manufacture Date</span>
                                 <span className="text-[8px] font-black text-slate-900 uppercase">{asset.manufactureDateUnknown ? 'UNK' : formatDate(asset.manufactureDate)}</span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 px-3 hover:bg-slate-50 transition-colors bg-amber-50/30">
                                 <span className="text-[6px] font-black text-amber-700 uppercase tracking-widest">Pressure Test (kPa)</span>
                                 <span className="text-[7px] font-black text-amber-900 uppercase">
                                   {(() => {
                                      const r = assetRecords.find(rec => rec.tested_to_kpa || rec.testedToKpa || rec.flow_pressure_kpa || rec.pressure_kpa);
                                      return r?.tested_to_kpa || r?.testedToKpa || r?.flow_pressure_kpa || r?.pressure_kpa || '---';
                                   })()} 
                                 </span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 px-3 hover:bg-slate-50 transition-colors bg-emerald-50/30">
                                 <span className="text-[6px] font-black text-emerald-700 uppercase tracking-widest">Flow Rate (L/min)</span>
                                 <span className="text-[7px] font-black text-emerald-900 uppercase">
                                   {(() => {
                                      const r = assetRecords.find(rec => rec.calculated_flow_lpm || rec.calculatedFlowLpm || rec.flow_lpm);
                                      return r?.calculated_flow_lpm || r?.calculatedFlowLpm || r?.flow_lpm || '---';
                                   })()}
                                 </span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 px-3 hover:bg-slate-50 transition-colors">
                                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Next Pressure Test</span>
                                 <span className="text-[8px] font-black text-amber-600 uppercase">
                                   {formatDate(asset.nextPressureTestDate)}
                                 </span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 px-3 hover:bg-slate-50 transition-colors">
                                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Weight Captured</span>
                                 <span className="text-[8px] font-black text-slate-900 uppercase">{latestRecord?.recordedMass || assetRecords.find(r => r.recordedMass)?.recordedMass || 'N/A'} kg</span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 px-3 hover:bg-slate-50 transition-colors">
                                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Next Service Due</span>
                                 <span className="text-[8px] font-black text-red-600 uppercase">{formatDate(asset.nextServiceDate)}</span>
                              </div>
                              <div className="flex justify-between items-center p-1.5 px-3 hover:bg-slate-50 transition-colors">
                                 <span className="text-[6px] font-black text-slate-400 uppercase tracking-widest">Technical Signature</span>
                                 <span className="text-[6px] font-bold text-slate-500 uppercase truncate max-w-[100px]">{displayTechnician?.name || 'Authorized'}</span>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="mt-4 pt-2 border-t border-slate-100 flex justify-between items-center relative z-10">
                  <CompanyFooter />
               </div>
            </div>
          );
        })}

        {/* PAGE 14: TECHNICIAN DETAILS PAGE */}
        {siteTechnicians.length > 0 && (
          <div className="report-page bg-white w-[210mm] h-[297mm] p-16 flex flex-col border shadow-lg mx-auto relative">
            <div className="absolute top-2 right-4 text-[6px] text-slate-500 font-bold uppercase tracking-widest opacity-50 z-[100]">© 2026 Precision Fire Services. All rights reserved.</div>
            <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
               <div className="flex items-center gap-4 text-left"><ReportLogo type="company" className="w-12 h-12" branding={branding} /><div><h2 className="text-xl font-black uppercase tracking-tight text-left">Technician Verification</h2><p className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-left">Technician Credentials</p></div></div>
               <div className="text-right">
                 <p className="text-[10px] font-black uppercase">DATA-NODE-{client.id.toUpperCase().slice(0,4)}</p>
                 {(() => {
                    const techName = (() => {
                      const creatorTech = technicians.find(t => t.id === client.technicianId && t.name !== 'Precision Management');
                      if (creatorTech) return creatorTech.name;
                      const latestRecord = records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
                      const inspector = technicians.find(t => (t.name === latestRecord?.inspectorName || t.saqcc === latestRecord?.inspectorName) && t.name !== 'Precision Management');
                      if (inspector) return inspector.name;
                      if (displayTechnician?.name !== 'Precision Management') return displayTechnician?.name;
                      return null;
                    })();
                    if (!techName) return null;
                    return (
                      <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        Technician: {techName} | {new Date(finalizedDate).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    );
                 })()}
               </div>
            </div>
            <div className="flex-1 space-y-8 text-left">
               <div className="bg-slate-50 p-6 rounded-[1.5rem] border border-slate-200">
                  <p className="text-xs font-black text-slate-800 uppercase leading-relaxed text-center italic">"All listed technicians are SAQCC registered and authorized under the Precision Fire Services SANS 1475 Permit."</p>
               </div>
               <div className="grid grid-cols-1 gap-12">
                  {siteTechnicians.map(tech => (
                     <div key={tech.id} className="flex gap-8 items-start border-b border-slate-100 pb-12 last:border-0 break-inside-avoid">
                        <div className="w-32 h-32 bg-slate-900 rounded-3xl flex items-center justify-center shadow-xl border-4 border-white shrink-0">
                           <span className="text-4xl font-black text-white">{tech.name.charAt(0)}</span>
                        </div>
                        <div className="flex-1 space-y-6">
                           <div className="text-left">
                              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{tech.name}</h3>
                              <p className="text-red-600 font-black uppercase tracking-[0.2em] text-[10px] mt-1">SAQCC Registration: {tech.saqcc}</p>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-slate-50 rounded-xl text-left">
                                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Authorization</p>
                                 <p className="text-[9px] font-black text-emerald-600 uppercase">VALID & ACTIVE</p>
                              </div>
                              <div className="p-3 bg-slate-50 rounded-xl text-left">
                                 <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Specimen Signature</p>
                                 <div className="h-16 flex items-center">{tech.signature && <img src={getProxiedImageUrl(tech.signature)} className="max-h-full mix-blend-multiply scale-110 origin-left" alt="Sign" crossOrigin={tech.signature.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" />}</div>
                              </div>
                           </div>
                           <div className="space-y-2 text-left">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Accreditation Image</p>
                              <div 
                                className="aspect-[1.58/1] w-full bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-200 flex items-center justify-center shadow-inner relative cursor-zoom-in hover:opacity-90 transition-opacity"
                                onClick={() => tech.saqccCardPhoto && setSelectedImage(tech.saqccCardPhoto)}
                              >
                                 {(() => {
                                    const inspectionDate = records.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.date || new Date().toISOString();
                                    const validCards = Object.entries(tech.saqccCards || {})
                                      .filter(([year, card]) => isSaqccCardValid(inspectionDate, year))
                                      .sort(([yearA], [yearB]) => parseInt(yearB) - parseInt(yearA));
                                    const cardToDisplay = validCards.length > 0 ? validCards[0][1] : tech.saqccCardPhoto;
                                    return cardToDisplay ? (
                                       <img src={getProxiedImageUrl(cardToDisplay)} className="absolute inset-0 w-full h-full object-cover" crossOrigin={cardToDisplay.startsWith('data:') ? undefined : "anonymous"} referrerPolicy="no-referrer" alt="SAQCC Card" />
                                    ) : (
                                       <div className="text-[7px] font-black text-slate-300 uppercase">Card Image Pending Upload</div>
                                    );
                                 })()}
                              </div>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
            <CompanyFooter branding={branding} />
          </div>
        )}

        {selectedImage && (
          <ImageModal src={selectedImage} onClose={() => setSelectedImage(null)} />
        )}

      </div>
      
      <style>{`
        .report-page { page-break-after: always !important; break-after: page !important; }
        @media screen and (max-width: 768px) {
          .report-page { width: 100% !important; height: auto !important; padding: 1rem !important; margin-bottom: 2rem !important; }
          .a4-page { width: 100% !important; height: auto !important; padding: 1rem !important; }
        }
        @media print {
          body { background: white !important; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-area { padding: 0 !important; margin: 0 !important; max-width: none !important; }
          .report-page { border: none !important; box-shadow: none !important; margin: 0 !important; page-break-after: always !important; width: 210mm !important; height: 297mm !important; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>
    </div>
  );
};

export default ReportGenerator;