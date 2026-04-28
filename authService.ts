import { supabase } from '../supabase';
import { Client, Equipment, InspectionRecord, FaultReport, Technician, SavedReport, EquipmentType } from '../types';
import { ConnectionStatus, checkRegistryConnection } from './connectionService';
import { authService } from './authService';
import { reportService } from './reportService';

export type { ConnectionStatus };
export { checkRegistryConnection };

const upsertWithRetry = async (tableName: string, data: any) => {
  let currentData = Array.isArray(data) ? data.map(item => ({ ...item })) : { ...data };
  let attempts = 0;
  const maxAttempts = 15;

  while (attempts < maxAttempts) {
    try {
      const { data: result, error } = await supabase.from(tableName).upsert(currentData).select();
      if (error) {
        const errorMessage = error.message || String(error);
        const columnMatch = errorMessage.match(/column ["']?([^"'\s]+)["']? (?:of relation|does not exist|in the schema cache)/i) || 
                            errorMessage.match(/Could not find the ["']?([^"'\s]+)["']? column/i) ||
                            errorMessage.match(/column ["']([^"']+)["']/i);
                            
        if (columnMatch && columnMatch[1]) {
          const missingColumn = columnMatch[1];
          console.warn(`Column "${missingColumn}" missing in ${tableName} table, stripping and retrying...`);
          if (Array.isArray(currentData)) {
            currentData = currentData.map(item => {
              const newItem = { ...item };
              delete newItem[missingColumn];
              return newItem;
            });
          } else {
            delete currentData[missingColumn];
          }
          attempts++;
          continue;
        }
        throw error;
      }
      return result;
    } catch (e: any) {
      const errorMessage = e.message || String(e);
      const columnMatch = errorMessage.match(/column ["']?([^"'\s]+)["']? (?:of relation|does not exist|in the schema cache)/i) || 
                          errorMessage.match(/Could not find the ["']?([^"'\s]+)["']? column/i) ||
                          errorMessage.match(/column ["']([^"']+)["']/i);
                          
      if (columnMatch && columnMatch[1] && (errorMessage.includes("column") || errorMessage.includes("not found") || errorMessage.includes("schema cache"))) {
         const missingColumn = columnMatch[1];
         console.warn(`Column "${missingColumn}" missing in ${tableName} table (caught in catch), stripping and retrying...`);
         if (Array.isArray(currentData)) {
            currentData = currentData.map(item => {
              const newItem = { ...item };
              delete newItem[missingColumn];
              return newItem;
            });
          } else {
            delete currentData[missingColumn];
          }
         attempts++;
         continue;
      }
      console.error(`Failed to save to ${tableName}:`, e);
      throw e;
    }
  }
  throw new Error(`Failed to save to ${tableName} after multiple attempts to strip missing columns.`);
};

const toSnakeCase = (obj: any) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const snake: any = {};
  
  for (const key in obj) {
    // DO NOT convert these keys as they are camelCase in the new schema or already handled
    if (['equipmentId', 'clientId', 'technicianId', 'subUserId', 'serialNumber', 'manufactureDate', 'lastInspectionDate', 'nextServiceDate', 'pressureTestDate', 'isArchived', 'companyName', 'contactPerson', 'emailAddress', 'phoneNumber', 'vatNumber', 'technician_id', 'client_id', 'equipment_id', 'sub_user_id', 'createdAt', 'portalPin', 'portalPaused', 'portalAccessGranted', 'slaAmount', 'archivedAt'].includes(key)) {
      snake[key] = obj[key];
      continue;
    }
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snake[snakeKey] = obj[key];
  }
  return snake;
};

export const compressImage = async (base64Str: string, maxWidth = 800, quality = 0.4): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

export const getLastSyncTime = () => localStorage.getItem('pfs_last_sync_time') || '1970-01-01T00:00:00Z';
export const setLastSyncTime = (time: string) => localStorage.setItem('pfs_last_sync_time', time);

export const syncService = {
  ...authService,
  ...reportService,

  async fetchAllData(lastSyncTime?: string, options?: { technicianId?: string; subUserId?: string; todayOnly?: boolean; fetchAllClients?: boolean }) {
    try {
      console.log(`[SYNC] Starting fetchAllData. Last Sync: ${lastSyncTime || 'None'}`);
      let techsData: any[] = [];
      try {
        const query = supabase.from('techs').select('*');
        if (lastSyncTime) query.gt('created_at', lastSyncTime);
        const { data: techs, error: techsError } = await query;
        if (techsError) {
          console.warn("Techs fetch failed, attempting minimal fallback:", techsError.message);
          const { data: fallbackTechs, error: fallbackError } = await supabase.from('techs').select('id, userid, name, saqcc, email, pin, cellphone, signature, saqcc_cards, sub_users');
          techsData = fallbackTechs || [];
        } else {
          techsData = techs || [];
        }
      } catch (e) {
        console.error("Failed to fetch techs:", e);
      }

      const fetchAllTableData = async (tableName: string, orderColumn = 'created_at', pageSize = 500, filterColumn?: string) => {
        let allData: any[] = [];
        let rangeStart = 0;
        let hasMore = true;
        const todayStr = new Date().toISOString().split('T')[0];

        try {
          while (hasMore) {
            const query = supabase
              .from(tableName)
              .select('*')
              .order(orderColumn, { ascending: false })
              .range(rangeStart, rangeStart + pageSize - 1);
            
            if (lastSyncTime) query.gt(filterColumn || 'created_at', lastSyncTime);
            if (options?.todayOnly) query.gte(filterColumn || 'created_at', todayStr);
            if (options?.subUserId && (tableName === 'records' || tableName === 'faults')) {
              query.eq('sub_user_id', options.subUserId);
            }

            const { data, error } = await query;
            if (error) {
              console.warn(`[SYNC] Table ${tableName} fetch failed at range ${rangeStart}:`, error.message);
              // Attempt even simpler fetch if * fails (e.g. schema cache issues)
              const { data: fallback, error: fallbackError } = await supabase.from(tableName).select('id').limit(10);
              if (fallbackError) throw error; // If even ID fails, rethrow
              return allData; // Return what we have
            }

            if (data && data.length > 0) {
              allData = [...allData, ...data];
              if (data.length < pageSize) hasMore = false;
              else rangeStart += pageSize;
            } else {
              hasMore = false;
            }
          }
        } catch (err) {
          console.error(`[SYNC] Final failure for ${tableName}:`, err);
        }
        return allData;
      };

      // Wrap each primary query in a safe promise that never rejects
      const safeFetch = async (query: any, tableName: string): Promise<any[] | any> => {
        try {
          const { data, error } = await query;
          if (error) {
            console.warn(`[SYNC] Safe fetch for ${tableName} failed:`, error.message);
            return null;
          }
          return data;
        } catch (e) {
          console.error(`[SYNC] Safe fetch exception for ${tableName}:`, e);
          return null;
        }
      };

      const clientsQuery = supabase.from('clients').select('*');
      const faultsQuery = supabase.from('faults').select('*').order('timestamp', { ascending: false });
      
      if (lastSyncTime) {
        clientsQuery.gt('createdAt', lastSyncTime);
        faultsQuery.gt('created_at', lastSyncTime);
      }
      
      if (options?.technicianId && !options?.fetchAllClients) {
        clientsQuery.eq('technicianId', options.technicianId);
        faultsQuery.eq('technician_id', options.technicianId);
      }

      console.time('fetchAllData');
      const [
        clients,
        equipment,
        records,
        faults,
        branding,
        reports,
        siteAssessments,
        subUsersFallback
      ] = await Promise.all([
        safeFetch(clientsQuery, 'clients'),
        fetchAllTableData('equipment', 'updated_at', 500, 'updated_at'),
        fetchAllTableData('records', 'date', 500, 'date'),
        safeFetch(faultsQuery, 'faults'),
        safeFetch(supabase.from('branding').select('*'), 'branding'),
        safeFetch(supabase.from('reports').select('*').order('created_at', { ascending: false }), 'reports'),
        safeFetch(supabase.from('site_assessments').select('*'), 'site_assessments'),
        safeFetch(supabase.from('branding').select('content').eq('id', 'sub_users_registry').maybeSingle(), 'sub_users_fallback')
      ]);
      console.timeEnd('fetchAllData');

      console.log(`[SYNC] Load Complete. Clients: ${clients?.length || 0}, Assets: ${equipment?.length || 0}, Records: ${records?.length || 0}`);

      const fallbackSubUsersMap = subUsersFallback?.content ? JSON.parse(subUsersFallback.content) : {};

      return {
        clients: (clients || []).map((c: any) => ({
          ...c,
          id: String(c.id).trim(),
          technicianId: String(c.technicianId || '').trim(),
          contactPerson: c.contactPerson || c.contact_person || '',
          createdAt: c.createdAt || c.created_at || '',
          portalPin: c.portalPin || c.portal_pin || '',
          portalPaused: c.portalPaused ?? c.portal_paused ?? true,
          portalAccessGranted: c.portalAccessGranted ?? c.portal_access_granted ?? false,
          slaAmount: c.slaAmount || c.sla_amount || '0.00',
          isArchived: c.isArchived ?? c.is_archived ?? false,
          archivedAt: c.archivedAt || c.archived_at || '',
          phone: c.phone || ''
        })),
        equipment: (equipment || []).map(eq => ({
          ...eq,
          id: String(eq.id).trim(),
          clientId: String(eq.clientId || eq.client_id || '').trim(),
          client_id: String(eq.clientId || eq.client_id || '').trim(),
          type: String(eq.type || '').trim() as EquipmentType,
          serialNumber: eq.serialNumber || eq.serial_number,
          manufactureDate: eq.manufactureDate || eq.manufacture_date,
          lastInspectionDate: eq.lastInspectionDate || eq.last_inspection_date,
          lastServiceDate: eq.lastServiceDate || eq.last_service_date,
          nextServiceDate: eq.nextServiceDate || eq.next_service_date,
          lastPressureTestDate: eq.lastPressureTestDate || eq.last_pressure_test_date,
          nextPressureTestDate: eq.nextPressureTestDate || eq.next_pressure_test_date,
          pressureTestDateUnknown: eq.pressureTestDateUnknown || eq.pressure_test_date_unknown,
          isPressureTestNonCompliant: eq.isPressureTestNonCompliant || eq.is_pressure_test_non_compliant,
          unitNumber: eq.unitNumber || eq.unit_number,
          sealSerialNumber: eq.sealSerialNumber || eq.seal_serial_number,
          isArchived: eq.isArchived || eq.is_archived,
          archivedAt: eq.archivedAt || eq.archived_at,
          photos: Array.isArray(eq.photos) ? eq.photos : (typeof eq.photos === 'string' ? JSON.parse(eq.photos) : [])
        })),
        records: (records || []).map(r => ({
          ...r,
          id: String(r.id).trim(),
          equipmentId: String(r.equipmentId || r.equipment_id || r.asset_id || '').trim(),
          equipment_id: String(r.equipmentId || r.equipment_id || r.asset_id || '').trim(),
          clientId: String(r.clientId || r.client_id || '').trim(),
          client_id: String(r.clientId || r.client_id || '').trim(),
          technicianId: String(r.technicianId || r.technician_id || '').trim(),
          technician_id: String(r.technicianId || r.technician_id || '').trim(),
          subUserId: String(r.subUserId || r.sub_user_id || '').trim(),
          sub_user_id: String(r.subUserId || r.sub_user_id || '').trim(),
          date: r.date || r.created_at?.split('T')[0] || '',
          equipmentType: r.equipmentType || r.equipment_type,
          taskType: r.taskType || r.task_type,
          inspectorName: r.inspectorName || r.inspector_name,
          inspectorSignature: r.inspectorSignature || r.inspector_signature,
          recordedMass: r.recordedMass || r.recorded_mass,
          calculatedFlowLpm: r.calculatedFlowLpm || r.calculated_flow_lpm,
          manufactureDate: r.manufactureDate || r.manufacture_date,
          lastPressureTestDate: r.lastPressureTestDate || r.last_pressure_test_date,
          sealSerialNumber: r.sealSerialNumber || r.seal_serial_number,
          testedToKpa: r.testedToKpa || r.tested_to_kpa,
          hydrantType: r.hydrantType || r.hydrant_type,
          pressureTestOption: r.pressureTestOption || r.pressure_test_option,
          photos: Array.isArray(r.photos) ? r.photos : (typeof r.photos === 'string' ? JSON.parse(r.photos) : []),
          findings: typeof r.findings === 'string' ? JSON.parse(r.findings) : r.findings || {}
        })),
        faults: (faults || []).map((f: any) => ({
          ...f,
          id: String(f.id).trim(),
          equipmentId: String(f.equipmentId || f.equipment_id || f.asset_id || '').trim(),
          equipment_id: String(f.equipmentId || f.equipment_id || f.asset_id || '').trim(),
          clientId: String(f.client_id || '').trim(),
          client_id: String(f.client_id || '').trim(),
          technicianId: String(f.assignedTechnicianId || f.assigned_technician_id || f.technician_id || '').trim(),
          technician_id: String(f.assignedTechnicianId || f.assigned_technician_id || f.technician_id || '').trim(),
          subUserId: String(f.subUserId || f.sub_user_id || '').trim(),
          sub_user_id: String(f.subUserId || f.sub_user_id || '').trim(),
          date: f.timestamp || f.date || f.created_at || '',
          notes: f.description || f.notes || '',
          description: f.description || f.notes || '',
          resolutionNotes: f.resolutionNotes || f.resolution_notes || '',
          photos: Array.isArray(f.photos) ? f.photos : (typeof f.photos === 'string' ? JSON.parse(f.photos) : []),
          resolutionPhotos: Array.isArray(f.resolutionPhotos) ? f.resolutionPhotos : (typeof f.resolutionPhotos === 'string' ? JSON.parse(f.resolutionPhotos) : [])
        })),
        techs: techsData.map(t => {
          let parsedSubUsers = t.sub_users || t.subUsers || fallbackSubUsersMap[String(t.id)] || [];
          if (typeof parsedSubUsers === 'string') {
            try { parsedSubUsers = JSON.parse(parsedSubUsers); } catch(e) { parsedSubUsers = []; }
          }
          return {
            ...t,
            id: String(t.id),
            role: t.role || 'technician',
            saqccCards: t.saqcc_cards || t.saqccCards || {},
            saqccCardPhoto: t.saqcc_card_photo || t.saqccCardPhoto,
            subUsers: parsedSubUsers
          };
        }),
        branding: Array.isArray(branding) ? branding : [],
        reports: Array.isArray(reports) ? reports : [],
        siteAssessments: Array.isArray(siteAssessments) ? (siteAssessments || []).reduce((acc: any, item: any) => {
          acc[item.client_id || item.clientId] = typeof item.items === 'string' ? JSON.parse(item.items) : item.items || [];
          return acc;
        }, {}) : {}
      };
    } catch (e) {
      console.error("Fetch all data failed:", e);
      throw e;
    }
  },

  async searchGlobalRegistry(term: string) {
    try {
      console.log("Global search for:", term);
      const cleanTerm = term.trim();
      if (!cleanTerm) return null;

      // Search clients by name, building, or address
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .or(`name.ilike.%${cleanTerm}%,building.ilike.%${cleanTerm}%,address.ilike.%${cleanTerm}%`)
        .limit(10);

      if (clientsError) throw clientsError;

      // If we found clients, fetch their equipment and recent records
      if (clients && clients.length > 0) {
        const clientIds = clients.map(c => c.id);
        
        const [
          { data: equipment },
          { data: records },
          { data: faults }
        ] = await Promise.all([
          supabase.from('equipment').select('*').in('client_id', clientIds),
          supabase.from('records').select('*').in('client_id', clientIds).order('date', { ascending: false }).limit(100),
          supabase.from('faults').select('*').in('client_id', clientIds).order('timestamp', { ascending: false }).limit(50)
        ]);

        return {
          clients: clients.map(c => ({
            ...c,
            id: String(c.id).trim(),
            technicianId: String(c.technicianId || '').trim(),
            contactPerson: c.contact_person || '',
            createdAt: c.createdAt || '',
            portalPin: c.portalPin || '',
            portalPaused: c.portalPaused ?? true,
            portalAccessGranted: c.portalAccessGranted ?? false,
            slaAmount: c.slaAmount || '0.00',
            isArchived: c.isArchived ?? false,
            archivedAt: c.archivedAt || '',
            phone: c.phone || ''
          })),
          equipment: (equipment || []).map(eq => ({
            ...eq,
            id: String(eq.id).trim(),
            clientId: String(eq.clientId || eq.client_id || '').trim(),
            client_id: String(eq.clientId || eq.client_id || '').trim(),
            type: String(eq.type || '').trim() as EquipmentType,
            serialNumber: eq.serialNumber || eq.serial_number,
            manufactureDate: eq.manufactureDate || eq.manufacture_date,
            lastInspectionDate: eq.lastInspectionDate || eq.last_inspection_date,
            lastServiceDate: eq.lastServiceDate || eq.last_service_date,
            nextServiceDate: eq.nextServiceDate || eq.next_service_date,
            lastPressureTestDate: eq.lastPressureTestDate || eq.last_pressure_test_date,
            nextPressureTestDate: eq.nextPressureTestDate || eq.next_pressure_test_date,
            pressureTestDateUnknown: eq.pressureTestDateUnknown || eq.pressure_test_date_unknown,
            isPressureTestNonCompliant: eq.isPressureTestNonCompliant || eq.is_pressure_test_non_compliant,
            unitNumber: eq.unitNumber || eq.unit_number,
            sealSerialNumber: eq.sealSerialNumber || eq.seal_serial_number,
            isArchived: eq.isArchived || eq.is_archived,
            archivedAt: eq.archivedAt || eq.archived_at,
            photos: Array.isArray(eq.photos) ? eq.photos : (typeof eq.photos === 'string' ? JSON.parse(eq.photos) : [])
          })),
          records: (records || []).map(r => ({
            ...r,
            id: String(r.id).trim(),
            equipmentId: String(r.equipmentId || r.equipment_id || r.asset_id || '').trim(),
            equipment_id: String(r.equipmentId || r.equipment_id || r.asset_id || '').trim(),
            clientId: String(r.clientId || r.client_id || '').trim(),
            client_id: String(r.clientId || r.client_id || '').trim(),
            technicianId: String(r.technicianId || r.technician_id || '').trim(),
            technician_id: String(r.technicianId || r.technician_id || '').trim(),
            subUserId: String(r.subUserId || r.sub_user_id || '').trim(),
            sub_user_id: String(r.subUserId || r.sub_user_id || '').trim(),
            date: r.date || r.created_at?.split('T')[0] || '',
            equipmentType: r.equipmentType || r.equipment_type,
            taskType: r.taskType || r.task_type,
            inspectorName: r.inspectorName || r.inspector_name,
            inspectorSignature: r.inspectorSignature || r.inspector_signature,
            recordedMass: r.recordedMass || r.recorded_mass,
            calculatedFlowLpm: r.calculatedFlowLpm || r.calculated_flow_lpm,
            manufactureDate: r.manufactureDate || r.manufacture_date,
            lastPressureTestDate: r.lastPressureTestDate || r.last_pressure_test_date,
            sealSerialNumber: r.sealSerialNumber || r.seal_serial_number,
            testedToKpa: r.testedToKpa || r.tested_to_kpa,
            hydrantType: r.hydrantType || r.hydrant_type,
            pressureTestOption: r.pressureTestOption || r.pressure_test_option,
            photos: Array.isArray(r.photos) ? r.photos : (typeof r.photos === 'string' ? JSON.parse(r.photos) : []),
            findings: typeof r.findings === 'string' ? JSON.parse(r.findings) : r.findings || {}
          })),
          faults: (faults || []).map((f: any) => ({
            ...f,
            id: String(f.id).trim(),
            equipmentId: String(f.equipmentId || f.equipment_id || f.asset_id || '').trim(),
            equipment_id: String(f.equipmentId || f.equipment_id || f.asset_id || '').trim(),
            clientId: String(f.client_id || '').trim(),
            client_id: String(f.client_id || '').trim(),
            technicianId: String(f.assignedTechnicianId || f.assigned_technician_id || f.technician_id || '').trim(),
            technician_id: String(f.assignedTechnicianId || f.assigned_technician_id || f.technician_id || '').trim(),
            subUserId: String(f.subUserId || f.sub_user_id || '').trim(),
            sub_user_id: String(f.subUserId || f.sub_user_id || '').trim(),
            date: f.timestamp || f.date || f.created_at || '',
            notes: f.description || f.notes || '',
            description: f.description || f.notes || '',
            resolutionNotes: f.resolutionNotes || f.resolution_notes || '',
            photos: Array.isArray(f.photos) ? f.photos : (typeof f.photos === 'string' ? JSON.parse(f.photos) : []),
            resolutionPhotos: Array.isArray(f.resolutionPhotos) ? f.resolutionPhotos : (typeof f.resolutionPhotos === 'string' ? JSON.parse(f.resolutionPhotos) : [])
          }))
        };
      }

      return null;
    } catch (e) {
      console.error("Global search failed:", e);
      return null;
    }
  },

  async fetchAssetByCode(code: string) {
    try {
      console.log("Fetching asset by code:", code);
      const cleanCode = code.trim();
      if (!cleanCode) return null;

      // 1. Find the asset by QR, Serial, or ID
      const { data: asset, error: assetError } = await supabase
        .from('equipment')
        .select('*')
        .or(`qrCode.eq.${cleanCode},serialNumber.eq.${cleanCode},id.eq.${cleanCode}`)
        .single();

      if (assetError || !asset) {
        console.log("Asset not found in cloud registry:", cleanCode);
        return null;
      }

      // 2. Fetch the entire site (client) data
      const clientId = asset.client_id || asset.clientId;
      if (!clientId) return null;

      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (clientError || !client) return null;

      // 3. Fetch all equipment, records, and faults for this client
      const [
        { data: equipment },
        { data: records },
        { data: faults }
      ] = await Promise.all([
        supabase.from('equipment').select('*').eq('client_id', clientId),
        supabase.from('records').select('*').eq('client_id', clientId).order('date', { ascending: false }).limit(100),
        supabase.from('faults').select('*').eq('client_id', clientId).order('timestamp', { ascending: false }).limit(50)
      ]);

      // Reuse the mapping logic from searchGlobalRegistry (simplified here for brevity, but ideally shared)
      return {
        clients: [{
          ...client,
          id: String(client.id).trim(),
          technicianId: String(client.technicianId || '').trim(),
          contactPerson: client.contact_person || '',
          createdAt: client.createdAt || '',
          portalPin: client.portalPin || '',
          portalPaused: client.portalPaused ?? true,
          portalAccessGranted: client.portalAccessGranted ?? false,
          slaAmount: client.slaAmount || '0.00',
          isArchived: client.isArchived ?? false,
          archivedAt: client.archivedAt || '',
          phone: client.phone || ''
        }],
        equipment: (equipment || []).map(eq => ({
          ...eq,
          id: String(eq.id).trim(),
          clientId: String(eq.clientId || eq.client_id || '').trim(),
          client_id: String(eq.clientId || eq.client_id || '').trim(),
          type: String(eq.type || '').trim() as EquipmentType,
          serialNumber: eq.serialNumber || eq.serial_number,
          manufactureDate: eq.manufactureDate || eq.manufacture_date,
          lastInspectionDate: eq.lastInspectionDate || eq.last_inspection_date,
          lastServiceDate: eq.lastServiceDate || eq.last_service_date,
          nextServiceDate: eq.nextServiceDate || eq.next_service_date,
          lastPressureTestDate: eq.lastPressureTestDate || eq.last_pressure_test_date,
          nextPressureTestDate: eq.nextPressureTestDate || eq.next_pressure_test_date,
          pressureTestDateUnknown: eq.pressureTestDateUnknown || eq.pressure_test_date_unknown,
          isPressureTestNonCompliant: eq.isPressureTestNonCompliant || eq.is_pressure_test_non_compliant,
          unitNumber: eq.unitNumber || eq.unit_number,
          sealSerialNumber: eq.sealSerialNumber || eq.seal_serial_number,
          isArchived: eq.isArchived || eq.is_archived,
          archivedAt: eq.archivedAt || eq.archived_at,
          photos: Array.isArray(eq.photos) ? eq.photos : (typeof eq.photos === 'string' ? JSON.parse(eq.photos) : [])
        })),
        records: (records || []).map(r => ({
          ...r,
          id: String(r.id).trim(),
          equipmentId: String(r.equipmentId || r.equipment_id || r.asset_id || '').trim(),
          equipment_id: String(r.equipmentId || r.equipment_id || r.asset_id || '').trim(),
          clientId: String(r.clientId || r.client_id || '').trim(),
          client_id: String(r.clientId || r.client_id || '').trim(),
          technicianId: String(r.technicianId || r.technician_id || '').trim(),
          technician_id: String(r.technicianId || r.technician_id || '').trim(),
          subUserId: String(r.subUserId || r.sub_user_id || '').trim(),
          sub_user_id: String(r.subUserId || r.sub_user_id || '').trim(),
          date: r.date || r.created_at?.split('T')[0] || '',
          equipmentType: r.equipmentType || r.equipment_type,
          taskType: r.taskType || r.task_type,
          inspectorName: r.inspectorName || r.inspector_name,
          inspectorSignature: r.inspectorSignature || r.inspector_signature,
          recordedMass: r.recordedMass || r.recorded_mass,
          calculatedFlowLpm: r.calculatedFlowLpm || r.calculated_flow_lpm,
          manufactureDate: r.manufactureDate || r.manufacture_date,
          lastPressureTestDate: r.lastPressureTestDate || r.last_pressure_test_date,
          sealSerialNumber: r.sealSerialNumber || r.seal_serial_number,
          testedToKpa: r.testedToKpa || r.tested_to_kpa,
          hydrantType: r.hydrantType || r.hydrant_type,
          pressureTestOption: r.pressureTestOption || r.pressure_test_option,
          photos: Array.isArray(r.photos) ? r.photos : (typeof r.photos === 'string' ? JSON.parse(r.photos) : []),
          findings: typeof r.findings === 'string' ? JSON.parse(r.findings) : r.findings || {}
        })),
        faults: (faults || []).map((f: any) => ({
          ...f,
          id: String(f.id).trim(),
          equipmentId: String(f.equipmentId || f.equipment_id || f.asset_id || '').trim(),
          equipment_id: String(f.equipmentId || f.equipment_id || f.asset_id || '').trim(),
          clientId: String(f.client_id || '').trim(),
          client_id: String(f.client_id || '').trim(),
          technicianId: String(f.assignedTechnicianId || f.assigned_technician_id || f.technician_id || '').trim(),
          technician_id: String(f.assignedTechnicianId || f.assigned_technician_id || f.technician_id || '').trim(),
          subUserId: String(f.subUserId || f.sub_user_id || '').trim(),
          sub_user_id: String(f.subUserId || f.sub_user_id || '').trim(),
          date: f.timestamp || f.date || f.created_at || '',
          notes: f.description || f.notes || '',
          description: f.description || f.notes || '',
          resolutionNotes: f.resolutionNotes || f.resolution_notes || '',
          photos: Array.isArray(f.photos) ? f.photos : (typeof f.photos === 'string' ? JSON.parse(f.photos) : []),
          resolutionPhotos: Array.isArray(f.resolutionPhotos) ? f.resolutionPhotos : (typeof f.resolutionPhotos === 'string' ? JSON.parse(f.resolutionPhotos) : [])
        }))
      };
    } catch (e) {
      console.error("Fetch asset by code failed:", e);
      return null;
    }
  },

  async saveClient(client: Client) {
    const snakeClient = toSnakeCase(client);
    
    // The database uses camelCase for createdAt, so we must remove created_at if it exists
    if (snakeClient.created_at !== undefined) {
      if (!snakeClient.createdAt) snakeClient.createdAt = snakeClient.created_at;
      delete snakeClient.created_at;
    }
    
    const data = await upsertWithRetry('clients', snakeClient);
    return data && Array.isArray(data) ? data[0] : data;
  },

  async saveEquipment(e: Equipment | Equipment[]) {
    const items = Array.isArray(e) ? e : [e];
    const snakeItems = items.map(item => {
      const snakeItem = toSnakeCase(item);
      if (snakeItem.clientId !== undefined) {
        if (!snakeItem.client_id) snakeItem.client_id = snakeItem.clientId;
        delete snakeItem.clientId;
      }
      return snakeItem;
    });
    console.log("Attempting to save equipment items:", snakeItems.length);
    try {
      const data = await upsertWithRetry('equipment', snakeItems);
      console.log("Successfully saved equipment items to Supabase");
      return data;
    } catch (error) {
      console.error("Error saving equipment items to Supabase:", error);
      throw error;
    }
  },

  async saveInspection(record: InspectionRecord) {
    const snakeRecord = toSnakeCase(record);
    // Ensure findings are stringified if they are an object
    if (snakeRecord.findings && typeof snakeRecord.findings === 'object') {
      snakeRecord.findings = JSON.stringify(snakeRecord.findings);
    }
    
    // Strip columns that don't exist in the records table
    delete snakeRecord.clientId;
    delete snakeRecord.client_id;
    delete snakeRecord.technicianId;
    delete snakeRecord.technician_id;
    delete snakeRecord.subUserId;
    delete snakeRecord.sub_user_id;
    delete snakeRecord.manufactureDate;
    delete snakeRecord.manufacture_date;
    delete snakeRecord.lastPressureTestDate;
    delete snakeRecord.last_pressure_test_date;
    
    const data = await upsertWithRetry('records', snakeRecord);
    return data && Array.isArray(data) ? data[0] : data;
  },

  async updateRecord(record: InspectionRecord) {
    const snakeRecord = toSnakeCase(record);
    if (snakeRecord.findings && typeof snakeRecord.findings === 'object') {
      snakeRecord.findings = JSON.stringify(snakeRecord.findings);
    }
    
    // Strip columns that don't exist in the records table
    delete snakeRecord.clientId;
    delete snakeRecord.client_id;
    delete snakeRecord.technicianId;
    delete snakeRecord.technician_id;
    delete snakeRecord.subUserId;
    delete snakeRecord.sub_user_id;
    delete snakeRecord.manufactureDate;
    delete snakeRecord.manufacture_date;
    delete snakeRecord.lastPressureTestDate;
    delete snakeRecord.last_pressure_test_date;
    
    // Using upsertWithRetry for updates as well since it includes the ID
    const data = await upsertWithRetry('records', snakeRecord);
    return data && Array.isArray(data) ? data[0] : data;
  },

  async saveFaultReport(fault: FaultReport) {
    const snakeFault = toSnakeCase(fault);
    
    // Map fields to match the actual database schema
    if (snakeFault.date !== undefined) {
      snakeFault.timestamp = snakeFault.date;
      delete snakeFault.date;
    }
    if (snakeFault.notes !== undefined) {
      if (!snakeFault.description) snakeFault.description = snakeFault.notes;
      delete snakeFault.notes;
    }
    if (snakeFault.technicianId !== undefined) {
      snakeFault.assignedTechnicianId = snakeFault.technicianId;
      delete snakeFault.technicianId;
    }
    if (snakeFault.technician_id !== undefined) {
      snakeFault.assigned_technician_id = snakeFault.technician_id;
      delete snakeFault.technician_id;
    }
    
    // Strip columns that don't exist in the faults table
    delete snakeFault.clientId;
    delete snakeFault.client_id;
    delete snakeFault.subUserId;
    delete snakeFault.sub_user_id;
    delete snakeFault.resolutionPhotos;
    delete snakeFault.resolution_photos;
    
    const data = await upsertWithRetry('faults', snakeFault);
    return data && Array.isArray(data) ? data[0] : data;
  },

  async saveTechnician(tech: Technician) {
    const snakeTech = toSnakeCase(tech);
    
    // Explicitly handle saqccCards to saqcc_cards mapping if toSnakeCase missed it or if we want to be sure
    if (tech.saqccCards !== undefined) {
      snakeTech.saqcc_cards = tech.saqccCards;
    }
    
    // Explicitly handle subUsers mapping
    if (tech.subUsers !== undefined) {
       // Stringify it, the database will accept stringified JSON for both jsonb and text columns
      snakeTech.sub_users = JSON.stringify(tech.subUsers);
    }
    
    console.log("Attempting to save technician:", tech.id, "with sub-users:", tech.subUsers?.length);
    try {
      const data = await upsertWithRetry('techs', snakeTech);
      
      // Fallback: Save sub-users to branding table as well to ensure persistence if techs column is missing
      if (tech.subUsers) {
        try {
          const { data: currentFallback, error: fetchError } = await supabase.from('branding').select('content').eq('id', 'sub_users_registry').maybeSingle();
          const fallbackMap = currentFallback ? JSON.parse(currentFallback.content) : {};
          fallbackMap[tech.id] = tech.subUsers;
          await supabase.from('branding').upsert({ id: 'sub_users_registry', content: JSON.stringify(fallbackMap), distribution: 'audit' });
        } catch (e) {
          console.warn("Sub-user fallback save failed:", e);
        }
      }

      console.log("Successfully saved technician to Supabase");
      return data && Array.isArray(data) ? data[0] : data;
    } catch (error) {
      console.error("Error saving technician to Supabase:", error);
      throw error;
    }
  },

  async assignFaultTechnician(fid: string, tid: string) {
    const { error } = await supabase.from('faults').update({ assignedTechnicianId: tid }).eq('id', fid);
    if (error) throw error;
  },

  async updateFaultStatus(fid: string, s: string, n: string, photos?: string[]) {
    const { error } = await supabase.from('faults').update({ 
      status: s, 
      resolutionNotes: n
    }).eq('id', fid);
    if (error) throw error;
  },

  async updateQRSequence(v: string) {
    const { error } = await supabase.from('branding').upsert({ id: 'qr_sequence', content: v, distribution: 'audit' });
    if (error) throw error;
  },

  async saveBranding(id: string, content: string, distribution: string) {
    const { error } = await supabase.from('branding').upsert({ id, content, distribution });
    if (error) throw error;
  },

  async uploadImage(base64Str: string, path: string): Promise<string> {
    try {
      // Compress image before upload to save mobile data (max 800px, 0.4 quality)
      const compressedBase64 = await compressImage(base64Str, 800, 0.4);
      
      const response = await fetch(compressedBase64);
      const blob = await response.blob();
      
      // Try primary path
      const { data, error } = await supabase.storage.from('uploads').upload(path, blob, {
        contentType: blob.type,
        upsert: true
      });
      
      if (error) {
        // If RLS error, try a more public path as fallback
        if (error.message?.includes('row-level security') || (error as any).status === 400) {
          console.warn("RLS error for path:", path, "trying public fallback...");
          const publicPath = `public/${path.replace(/\//g, '_')}`;
          const { data: pubData, error: pubError } = await supabase.storage.from('uploads').upload(publicPath, blob, {
            contentType: blob.type,
            upsert: true
          });
          if (pubError) throw pubError;
          const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(pubData.path);
          return publicUrl;
        }
        throw error;
      }
      
      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(data.path);
      return publicUrl;
    } catch (err) {
      console.error("Upload failed:", err);
      // Fallback to base64 if upload completely fails
      return base64Str;
    }
  },

  async deleteBranding(id: string) {
    const { error } = await supabase.from('branding').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteEquipment(id: string) {
    // Delete all records for this equipment (try both possible column names)
    try {
      await supabase.from('records').delete().eq('equipmentId', id);
    } catch (e) {}
    try {
      await supabase.from('records').delete().eq('equipment_id', id);
    } catch (e) {}
    
    // Delete all faults for this equipment
    try {
      await supabase.from('faults').delete().eq('equipmentId', id);
    } catch (e) {}
    try {
      await supabase.from('faults').delete().eq('equipment_id', id);
    } catch (e) {}
    
    // Finally delete the equipment
    const { error } = await supabase.from('equipment').delete().eq('id', id);
    if (error) throw error;
  },

  async deleteClient(id: string) {
    const cleanId = String(id).trim();
    console.log("[DELETE] Starting absolute purge for client:", cleanId);
    
    // 1. Get all equipment IDs for this client to clean records/faults
    let equipmentIds: string[] = [];
    try {
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;

      while (hasMore) {
        // Checking all possible casing for client ID column
        const { data, error } = await supabase
          .from('equipment')
          .select('id')
          .or(`client_id.eq.${cleanId},clientId.eq.${cleanId},clientid.eq.${cleanId}`)
          .range(offset, offset + pageSize - 1);
        
        if (error) break;
        if (data && data.length > 0) {
          equipmentIds = [...equipmentIds, ...data.map(e => e.id)];
          offset += pageSize;
          if (data.length < pageSize) hasMore = false;
        } else {
          hasMore = false;
        }
      }
    } catch (e) {
      console.error("[DELETE] Error gathering equipment IDs:", e);
    }
    
    equipmentIds = Array.from(new Set(equipmentIds));
    console.log(`[DELETE] Found ${equipmentIds.length} assets to purge by ID`);

    const chunkArray = (arr: any[], size: number) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    if (equipmentIds.length > 0) {
      const idChunks = chunkArray(equipmentIds, 100);
      for (const chunk of idChunks) {
        console.log(`[DELETE] Purging data for chunk of ${chunk.length} assets`);
        // We purge every possible asset field name
        try { await supabase.from('records').delete().in('equipmentId', chunk); } catch(e) {}
        try { await supabase.from('records').delete().in('equipment_id', chunk); } catch(e) {}
        try { await supabase.from('records').delete().in('asset_id', chunk); } catch(e) {}
        try { await supabase.from('faults').delete().in('equipmentId', chunk); } catch(e) {}
        try { await supabase.from('faults').delete().in('equipment_id', chunk); } catch(e) {}
        try { await supabase.from('faults').delete().in('asset_id', chunk); } catch(e) {}
        
        // Most important: delete the actual equipment by ID
        try { 
          const { error: eqErr } = await supabase.from('equipment').delete().in('id', chunk);
          if (eqErr) console.error("[DELETE] Equipment ID chunk delete failed:", eqErr.message);
        } catch(e) {}
      }
    }

    // 2. Comprehensive cleanup of all potential relations by Client ID
    console.log("[DELETE] Running comprehensive table cleanup...");
    
    // REDUNDANT PURGE: Expansion to all known and possible tables
    const finalPurgeTables = [
      'records', 'faults', 'site_assessments', 'reports', 'equipment', 
      'live_sessions', 'notifications', 'quotes', 'certificates', 'invoices',
      'audit_logs', 'maintenance_logs'
    ];
    const idFields = ['client_id', 'clientId', 'clientid'];
    
    for (const table of finalPurgeTables) {
      for (const field of idFields) {
        try { 
          const { error: delErr } = await supabase.from(table).delete().eq(field, cleanId); 
          if (delErr && !delErr.message.includes("does not exist") && !delErr.message.includes("not found")) {
            console.warn(`[DELETE] Warning deleting from ${table} (${field}):`, delErr.message);
          }
        } catch(e) {}
      }
    }
    
    // Final check for equipment using select
    const { data: stillThere } = await supabase.from('equipment').select('id').eq('client_id', cleanId).limit(1);
    if (stillThere && stillThere.length > 0) {
      console.error("[DELETE] Critical: Equipment still exists after purge. Manual override triggered.");
      // Attempt manual ID sweep
      const { data: allLeftovers } = await supabase.from('equipment').select('id').eq('client_id', cleanId);
      if (allLeftovers) {
        for (const l of allLeftovers) {
           await supabase.from('records').delete().eq('equipment_id', l.id);
           await supabase.from('records').delete().eq('equipmentId', l.id);
           await supabase.from('faults').delete().eq('equipment_id', l.id);
           await supabase.from('faults').delete().eq('equipmentId', l.id);
           await supabase.from('equipment').delete().eq('id', l.id);
        }
      }
    }
    
    try { await supabase.from('branding').delete().eq('id', `client_meta_${cleanId}`); } catch(e) {}

    // 3. Final atomic delete of the client
    console.log("[DELETE] Executing final client record removal...");
    const { error } = await supabase.from('clients').delete().eq('id', cleanId);
    
    if (error) {
      console.error("[DELETE] Final site deletion FAILED:", error);
      if (error.message.includes("violates foreign key constraint")) {
         // Last ditch effort: try to filter equipment again with a wildcard or lower case (less likely but for safety)
         console.warn("[DELETE] Constraint violation persists. Trying manual ID query-delete...");
         try {
           const { data: leftovers } = await supabase.from('equipment').select('id').eq('client_id', cleanId);
           if (leftovers && leftovers.length > 0) {
             const leftIds = leftovers.map(l => l.id);
             await supabase.from('equipment').delete().in('id', leftIds);
           }
         } catch(e) {}
         
         const { error: retryError } = await supabase.from('clients').delete().eq('id', cleanId);
         if (retryError) {
           throw new Error(`CRITICAL: Still cannot delete client. This usually means there's a table we haven't purged yet. Underlying error: ${retryError.message}`);
         }
      } else {
         throw new Error(`Site deletion failed: ${error.message}`);
      }
    }
    console.log("[DELETE] Client and all dependencies purged successfully.");
    return true;
  },

  async saveSiteAssessment(clientId: string, items: any[]) {
    const { error } = await supabase.from('site_assessments').upsert({
      client_id: clientId,
      items: items,
      updated_at: new Date().toISOString()
    });
    if (error) throw error;
  },

  async saveQuoteCatalog(items: any[]) {
    await this.saveBranding('quote_catalog', JSON.stringify(items), 'audit');
  },

  async fetchQuoteCatalog() {
    try {
      const { data, error } = await supabase.from('branding').select('content').eq('id', 'quote_catalog').single();
      if (error) throw error;
      return JSON.parse(data.content);
    } catch (e) {
      return [];
    }
  },

  async fetchSiteAssessments() {
    try {
      const { data, error } = await supabase.from('site_assessments').select('*');
      if (error) throw error;
      return (data || []).reduce((acc: any, item: any) => {
        acc[item.client_id] = typeof item.items === 'string' ? JSON.parse(item.items) : item.items || [];
        return acc;
      }, {});
    } catch (e) {
      return {};
    }
  },



  async saveManager(manager: { id: string; email: string; company: string }) {
    const { error } = await supabase.from('managers').upsert(manager);
    if (error) throw error;
  },


  subscribeToChanges(onUpdate: () => void, onError?: (error: any) => void) {
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        onUpdate();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Supabase realtime channel error, attempting to reconnect...');
        }
      });
      
    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  },

  async deleteTechnician(id: string) {
    const { error } = await supabase.from('techs').delete().eq('id', id);
    if (error) throw error;
    await this.deleteBranding(`tech_meta_${id}`);
  },

  exportRegistry() {
    this.fetchAllData().then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SANS_Supabase_Backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    });
  },

  async testConnection(): Promise<ConnectionStatus> {
    return await checkRegistryConnection();
  },

  async restoreRegistry(data: any) {
    const tables = ['clients', 'equipment', 'records', 'faults', 'techs', 'branding', 'reports'];
    for (const table of tables) {
      if (data[table] && Array.isArray(data[table])) {
        const { error } = await supabase.from(table).upsert(data[table]);
        if (error) throw error;
      }
    }
  },

  async getQRSequence(): Promise<string> {
    const { data, error } = await supabase.from('branding').select('content').eq('id', 'qr_sequence').single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? data.content : '1611';
  }
};

export const getProxiedImageUrl = (url: string) => {
  if (!url) return '';
  
  // Handle timestamp suffix if present (e.g. "url|123456789")
  const cleanUrl = url.includes('|') ? url.split('|')[0] : url;
  
  if (cleanUrl.startsWith('data:')) return cleanUrl;
  
  // If it's already a full URL, return it
  if (cleanUrl.startsWith('http')) return cleanUrl;

  // Otherwise, handle relative paths
  const r2PublicUrl = import.meta.env.VITE_R2_PUBLIC_URL;
  
  // Check if it's a Supabase storage path
  // Our uploadImage puts things in the 'uploads' bucket
  if (cleanUrl.startsWith('inspections/') || cleanUrl.startsWith('techs/') || cleanUrl.startsWith('equipment/')) {
    // If it's an equipment path and R2 is configured, use R2 (legacy/migration support)
    if (r2PublicUrl && cleanUrl.startsWith('equipment/')) {
      return `${r2PublicUrl}/${cleanUrl}`;
    }
    
    // Otherwise, try to resolve via Supabase Storage 'uploads' bucket
    try {
      const { data } = supabase.storage.from('uploads').getPublicUrl(cleanUrl);
      if (data?.publicUrl) return data.publicUrl;
    } catch (e) {
      console.warn("Supabase storage resolution failed for:", cleanUrl);
    }
  }

  // Fallback to R2 for any other relative paths
  const fallbackBase = r2PublicUrl || 'https://pub-82f31209a4b34e92965996a7b60834e2.r2.dev';
  
  if (cleanUrl.startsWith('equipment/')) {
    return `${fallbackBase}/${cleanUrl}`;
  }

  return `${fallbackBase}/equipment/${cleanUrl}`;
};

