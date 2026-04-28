
/**
 * PRECISION FIRE SERVICES - SANS COMPLIANCE REGISTRY
 * VERSION: PROJECT_FINAL_V12.18
 * UPDATES: Robust data-fetch synchronization and safe Supabase integration.
 * BUILD_ID: 1713437146538
 * BUILD_FORCE_REFRESH: 160
 */

import React, { useState, useEffect, useCallback } from 'react';
import Layout from './components/Layout';
import { BrandSplash } from './components/Brand';
import Dashboard from './components/Dashboard';
import AssetRegister from './components/AssetRegister';
import ClientManager from './components/ClientManager';
import SecurityGate from './components/SecurityGate';
import PublicPortal from './components/PublicPortal';
import ClientPortal from './components/ClientPortal';
import SANSChecklistRef from './components/SANSChecklistRef';
import FaultHub from './components/FaultHub';
import FaultReportForm from './components/FaultReportForm';
import PerformanceHub from './components/PerformanceHub';
import COCTab from './components/COCTab';
import AdminHub from './components/AdminHub';
import ReportsTab from './components/ReportsTab';
import ReportGenerator from './components/ReportGenerator';
import InspectionReportGenerator from './components/InspectionReportGenerator';
import TechnicalReportGenerator from './components/TechnicalReportGenerator';
import SiteAssessmentReportGenerator from './components/SiteAssessmentReportGenerator';
import QRScanner from './components/QRScanner';
import SingleAssetLabel from './components/SingleAssetLabel';
import SingleRecordReport from './components/SingleRecordReport';
import TechnicalHub from './components/TechnicalHub';
import { MoveAssetModal } from './components/AssetMover';
import FlowHub from './components/FlowHub';
import DetectionHub from './components/DetectionHub';
import DiscardHub from './components/DiscardHub';
import DiscardReport from './components/DiscardReport';
import SiteDisposalLedger from './components/SiteDisposalLedger';
import BookInPortal from './components/BookInPortal';
import { DetectionCOCGenerator } from './components/DetectionCOCGenerator';
import ClientPicker from './components/ClientPicker';
import CondemnUnitsView from './components/CondemnUnitsView';
import TechnicianManager from './components/TechnicianManager';
import BulkQRManager from './components/BulkQRManager';
import TaskSelector from './components/TaskSelector';
import CertificateTemplateMapper from './components/CertificateTemplateMapper';
import TechnicianDashboard from './components/TechnicianDashboard';
import SiteHandover from './components/SiteHandover';
import { COCGenerator } from './components/COCGenerator';
import ChecklistForm from './components/ChecklistForm';
import GlobalSearch from './components/GlobalSearch';
import ComplianceTab from './components/ComplianceTab';
import EquipmentForm from './components/EquipmentForm';
import RectifyTab from './components/RectifyTab';
import QuoteTab from './components/QuoteTab';
import { Equipment, InspectionRecord, Client, FaultReport, Technician, TaskType, EquipmentType, SavedReport } from './types';
import { syncService, getLastSyncTime, setLastSyncTime } from './services/registryService';
import { supabase } from './supabase';
import { QR_PROTOCOL, EQUIPMENT_DEFINITIONS } from './constants';

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(() => localStorage.getItem('pfs_authorized') === 'true');
  const [viewMode, setViewMode] = useState<'manager' | 'technician' | 'client'>(() => (localStorage.getItem('pfs_view_mode') as any) || 'technician');
  const [activeTech, setActiveTech] = useState<Technician | null>(() => {
    const saved = localStorage.getItem('pfs_active_tech');
    if (!saved) return null;
    const tech = JSON.parse(saved);
    const lastLogin = localStorage.getItem('pfs_last_login_date');
    const today = new Date().toISOString().split('T')[0];
    if (lastLogin !== today) {
      localStorage.removeItem('pfs_active_tech');
      localStorage.removeItem('pfs_active_sub_user');
      return null;
    }
    return tech;
  });
  const [activeSubUser, setActiveSubUser] = useState<{ id: string, name: string, signature?: string } | null>(() => {
    const saved = localStorage.getItem('pfs_active_sub_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [activeClientForPortal, setActiveClientForPortal] = useState<Client | null>(() => {
    const saved = localStorage.getItem('pfs_active_client_for_portal');
    return saved ? JSON.parse(saved) : null;
  });
  const [siteAssessments, setSiteAssessments] = useState<Record<string, any[]>>(() => {
    const saved = localStorage.getItem('pfs_site_assessments');
    return saved ? JSON.parse(saved) : {};
  });
  const [isPublicMode, setIsPublicMode] = useState(false);
  const [isClientMode, setIsClientMode] = useState(false);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('pfs_active_tab') || 'dashboard');
  const [showOnlyDue, setShowOnlyDue] = useState(false);
  const [isAppStarting, setIsAppStarting] = useState(() => {
    localStorage.setItem('pfs_is_starting', 'true');
    return true;
  });

  // Effect to sync start status to localStorage
  useEffect(() => {
    localStorage.setItem('pfs_is_starting', isAppStarting ? 'true' : 'false');
  }, [isAppStarting]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; error?: string } | null>(null);
  
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<InspectionRecord[]>([]);
  const [faults, setFaults] = useState<FaultReport[]>([]);
  const [techs, setTechs] = useState<Technician[]>([]);
  const [branding, setBranding] = useState<any[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [sessionInspectedIds, setSessionInspectedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('pfs_session_inspected_ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [isFinishingInspection, setIsFinishingInspection] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeClientSessionId, setActiveClientSessionId] = useState<string | null>(() => localStorage.getItem('pfs_active_client_session_id'));
  const [showPostAuditOptions, setShowPostAuditOptions] = useState<boolean>(false);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(() => {
    return localStorage.getItem('pfs_camera_permission') === 'granted';
  });

  useEffect(() => {
    if (cameraPermissionGranted) {
      localStorage.setItem('pfs_camera_permission', 'granted');
    }
  }, [cameraPermissionGranted]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('portal') === 'bookin') {
      setShowBookInPortal(true);
    }
  }, []);

  const [showScanner, setShowScanner] = useState(false);
  const [showLabel, setShowLabel] = useState<Equipment | null>(null);
  const [showInspectionReport, setShowInspectionReport] = useState<{ clientId: string; date?: string } | null>(null);
  const [showTechnicalReport, setShowTechnicalReport] = useState<string | null>(null);
  const [showFullTechnicalReport, setShowFullTechnicalReport] = useState<string | null>(null);
  const [showDiscardReport, setShowDiscardReport] = useState<string | null>(null);
  const [showSiteDisposalLedger, setShowSiteDisposalLedger] = useState<string | null>(null);
  const [showBookInPortal, setShowBookInPortal] = useState(false);
  const [showDetectionCOC, setShowDetectionCOC] = useState<string | null>(null);
  const [showFullCOC, setShowFullCOC] = useState<{ clientId: string; onlyCertificate: boolean } | null>(null);
  const [showSiteAssessmentReport, setShowSiteAssessmentReport] = useState<string | null>(null);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showCondemnUnits, setShowCondemnUnits] = useState<Client | null>(null);
  const [isManualSearch, setIsManualSearch] = useState(false);
  const [unregisteredCode, setUnregisteredCode] = useState<string | null>(null);
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showMoveAsset, setShowMoveAsset] = useState<Equipment | null>(null);
  const [scanContext, setScanContext] = useState<'audit' | 'fault' | null>(null);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [isReplacementFlow, setIsReplacementFlow] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Equipment | null>(null);
  const [replacingAsset, setReplacingAsset] = useState<Equipment | null>(null);
  const [selectedClientIdForAsset, setSelectedClientIdForAsset] = useState<string | null>(null);
  const [autoOpenReportClientId, setAutoOpenReportClientId] = useState<string | null>(null);
  const [autoOpenReportType, setAutoOpenReportType] = useState<'technical' | 'coc' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [lastFinalized, setLastFinalized] = useState<string>('');

  // PERSISTENCE
  useEffect(() => {
    localStorage.setItem('pfs_authorized', isAuthorized.toString());
    localStorage.setItem('pfs_view_mode', viewMode);
    localStorage.setItem('pfs_active_tab', activeTab);
    if (activeTech) localStorage.setItem('pfs_active_tech', JSON.stringify(activeTech));
    else localStorage.removeItem('pfs_active_tech');
    if (activeSubUser) localStorage.setItem('pfs_active_sub_user', JSON.stringify(activeSubUser));
    else localStorage.removeItem('pfs_active_sub_user');
    if (activeClientSessionId) localStorage.setItem('pfs_active_client_session_id', activeClientSessionId);
    else localStorage.removeItem('pfs_active_client_session_id');
    if (activeClientForPortal) localStorage.setItem('pfs_active_client_for_portal', JSON.stringify(activeClientForPortal));
    else localStorage.removeItem('pfs_active_client_for_portal');
    localStorage.setItem('pfs_site_assessments', JSON.stringify(siteAssessments));
    localStorage.setItem('pfs_session_inspected_ids', JSON.stringify(sessionInspectedIds));
  }, [isAuthorized, viewMode, activeTab, activeTech, activeSubUser, activeClientSessionId, sessionInspectedIds, activeClientForPortal, siteAssessments]);

  const updateLiveSession = useCallback(async (status: 'In Progress' | 'Closed', clientId?: string | null, count?: number) => {
    if (!activeTech) return;
    
    const sessionId = activeSubUser ? `session_${activeTech.id}_sub_${activeSubUser.id}` : `session_${activeTech.id}`;
    const sessionData = {
      clientId: clientId || activeClientSessionId,
      scannedCount: count ?? sessionInspectedIds.length,
      status,
      timestamp: new Date().toISOString(),
      subUser: activeSubUser ? activeSubUser.name : undefined
    };

    try {
      await syncService.saveBranding(sessionId, JSON.stringify(sessionData), 'audit');
    } catch (e) {
      console.error("Failed to update live session:", e);
    }
  }, [activeTech, activeClientSessionId, sessionInspectedIds, activeSubUser]);

  // AUDIT FLOW STATE
  const [selectedAuditAsset, setSelectedAuditAsset] = useState<Equipment | null>(null);
  const [activeAuditTask, setActiveAuditTask] = useState<TaskType | null>(null);
  const [requestedTaskType, setRequestedTaskType] = useState<TaskType | null>(null);
  const [postAuditReport, setPostAuditReport] = useState<InspectionRecord | null>(null);
  const [showTemplateMapper, setShowTemplateMapper] = useState(false);

  const handleGlobalSearchResults = (data: { clients: Client[], equipment: Equipment[], records: InspectionRecord[], faults: FaultReport[] }) => {
    const mergeData = <T extends { id: string }>(prev: T[], newData: T[]): T[] => {
      const map = new Map(prev.map(item => [item.id, item]));
      newData.forEach(item => map.set(item.id, item));
      return Array.from(map.values());
    };

    setClients(prev => mergeData(prev, data.clients || []));
    setEquipmentList(prev => mergeData(prev, data.equipment || []));
    setRecords(prev => mergeData(prev, data.records || []));
    setFaults(prev => mergeData(prev, data.faults || []));
    
    if (data.clients.length > 0) {
      setActiveTab('sites');
    }
  };

  const loadData = useCallback(async (isInitial = false) => {
    setIsSyncing(true);
    try {
      setSyncError(null);
      
      // Test connection first
      const conn = await syncService.testConnection();
      setConnectionStatus(conn);
      if (!conn.ok) {
        setSyncError(`Connection Failed: ${conn.details}`);
      }

      // SPEEDUP FIX: Release the splash screen immediately so user sees the login portal
      if (isInitial && !isAuthorized) {
        setIsAppStarting(false);
      }

    // DATA SYNC FIX V12.2: Managers MUST always fetch from 1970 to ensure empty local state is populated.
    const isManager = viewMode === 'manager' || activeTech?.role === 'admin';
    
    // Force managers to get everything, every time.
    // Realtime Fix: If refreshing due to update, use 1970 to get current state immediately.
    const lastSyncTime = (isManager || !isInitial) ? '1970-01-01T00:00:00Z' : (getLastSyncTime() || '1970-01-01T00:00:00Z');
      
      // Data Saving Logic: Relax filters to ensure commissioning dropdowns are populated
      const fetchOptions = {
        technicianId: !isManager ? activeTech?.id : undefined,
        subUserId: !isManager ? activeSubUser?.id : undefined,
        todayOnly: false, 
        fetchAllClients: true
      };

      // Clean Slate Logic: If it's a new day, clear local state for technicians
      const lastSyncDate = new Date(lastSyncTime).toDateString();
      const todayDate = new Date().toDateString();
      const isNewDay = lastSyncDate !== todayDate;

      const data = await syncService.fetchAllData(lastSyncTime, fetchOptions);
      
      // LOGGING FOR VERIFICATION: The user can check console to see if the fetch actually worked
      console.log(`[SYNC SUCCESS] Fetched ${data.equipment?.length || 0} assets, ${data.records?.length || 0} records.`);
      
      if (isInitial) setIsAppStarting(false);
      setLastSyncTime(new Date().toISOString());

      const mergeData = <T extends { id: string }>(prev: T[], newData: T[], clearPrev = false): T[] => {
        if (clearPrev) return newData;
        const map = new Map(prev.map(item => [item.id, item]));
        newData.forEach(item => map.set(item.id, item));
        return Array.from(map.values());
      };

      const shouldClear = false; // V12.18: Never clear history, ensure managers and techs see everything.

      setClients(prev => mergeData(prev, data.clients || [], shouldClear));
      setEquipmentList(prev => mergeData(prev, data.equipment || [], shouldClear));
      setRecords(prev => mergeData(prev, data.records || [], shouldClear));
      setFaults(prev => mergeData(prev, data.faults || [], shouldClear));
      setTechs(prev => mergeData(prev, data.techs || [])); // Techs should always be kept
      setBranding(prev => mergeData(prev, data.branding || []));
      setReports(prev => mergeData(prev, data.reports || [], shouldClear));

      // Refresh activeTech from fetched data to ensure latest role/permissions
      if (activeTech) {
        const latestTech = (data.techs || []).find(t => t.id === activeTech.id);
        if (latestTech) {
          setActiveTech(latestTech);
          localStorage.setItem('pfs_active_tech', JSON.stringify(latestTech));
        }
      }

      // Load site assessments from dedicated table or fallback
      const assessments: Record<string, any[]> = { ...(data.siteAssessments || {}) };
      
      // Also check branding for any legacy assessments
      if (Array.isArray(data.branding)) {
        data.branding.forEach((item: any) => {
          if (item.id.startsWith('assessment_')) {
            try {
              const clientId = item.id.replace('assessment_', '');
              if (!assessments[clientId]) {
                assessments[clientId] = JSON.parse(item.content);
              }
            } catch (e) {
              console.error("Failed to parse assessment:", item.id);
            }
          }
        });
      }
      setSiteAssessments(assessments);

      // Archive clients overdue by 7 days - ONLY ON INITIAL LOAD to prevent sync loops
      if (isInitial) {
        // Auto-archive logic removed to prevent clients from disappearing from Site Registry
      // One-time migration: Unarchive any clients that were previously archived
      if (isInitial && data.clients) {
        data.clients.forEach(async (c: any) => {
          if (c.isArchived) {
            await syncService.saveClient({ ...c, isArchived: false, archivedAt: undefined });
          }
        });
      }
      }

      if (data.branding && Array.isArray(data.branding)) {
        const brandingKeys = ['pfs_custom_logo', 'pfs_custom_saqcc', 'pfs_custom_sacas', 'pfs_sacas_cert', 'pfs_manager_signature', 'pfs_manager_typed_name'];
        const distKeys = ['pfs_dist_company', 'pfs_dist_saqcc', 'pfs_dist_sacas', 'pfs_dist_sacas_cert', 'pfs_dist_manager', 'pfs_dist_manager_typed_name'];
        const foundKeys = new Set<string>();

        data.branding.forEach((item: any) => {
          localStorage.setItem(item.id, item.content);
          foundKeys.add(item.id);

          let distKey = '';
          if (item.id === 'pfs_custom_logo') distKey = 'pfs_dist_company';
          else if (item.id === 'pfs_custom_saqcc') distKey = 'pfs_dist_saqcc';
          else if (item.id === 'pfs_custom_sacas') distKey = 'pfs_dist_sacas';
          else if (item.id === 'pfs_sacas_cert' || item.id.startsWith('pfs_sacas_cert_')) distKey = item.id.replace('pfs_sacas_cert', 'pfs_dist_sacas_cert');
          else if (item.id === 'pfs_manager_signature') distKey = 'pfs_dist_manager';
          else if (item.id === 'pfs_manager_typed_name') distKey = 'pfs_dist_manager_typed_name';

          if (distKey && item.distribution) {
            localStorage.setItem(distKey, item.distribution);
            foundKeys.add(distKey);
          }
        });

        // Dynamic cleanup: remove any pfs_ keys that weren't found in the current sync
        // but only for the specific branding categories we manage
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('pfs_custom_') || 
            key.startsWith('pfs_sacas_cert') || 
            key.startsWith('pfs_dist_') ||
            key.startsWith('pfs_manager_')
          )) {
            if (!foundKeys.has(key)) {
              keysToRemove.push(key);
            }
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } else {
        ['pfs_custom_logo', 'pfs_custom_saqcc', 'pfs_custom_sacas', 'pfs_sacas_cert', 'pfs_manager_signature', 'pfs_manager_typed_name', 'pfs_dist_company', 'pfs_dist_saqcc', 'pfs_dist_sacas', 'pfs_dist_sacas_cert', 'pfs_dist_manager', 'pfs_dist_manager_typed_name'].forEach(k => localStorage.removeItem(k));
      }
      setLastUpdated(new Date().toLocaleTimeString());
      const allRecords = data.records || [];
      const latestGlobalRecord = allRecords.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      if (latestGlobalRecord) setLastFinalized(new Date(latestGlobalRecord.date).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }));
    } catch (err: any) {
      console.error("App Data Error:", err);
      setSyncError(err.message || String(err));
    } finally {
      setIsAppStarting(false);
      setIsSyncing(false);
    }
  }, []);

  const handlePurge = async () => {
    if (window.confirm("CRITICAL: Wipe local master cache? This does not delete server data.")) {
       localStorage.removeItem('pfs_master_cache');
       await loadData(true);
    }
  };

  const handleExportData = () => {
    const data = {
      clients,
      equipment: equipmentList,
      records,
      faults,
      techs,
      branding,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pfs_registry_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteAsset = async (assetId: string) => {
    try {
      await syncService.deleteEquipment(assetId);
      await loadData(false);
      alert("Asset purged from registry successfully.");
    } catch (err: any) {
      console.error("Deletion error:", err);
      alert("Purge failed: " + (err.message || "Unknown error"));
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    try {
      await syncService.deleteClient(clientId);
      await loadData(false);
      alert("Site deleted successfully from the registry.");
    } catch (err: any) {
      console.error("Deletion error:", err);
      alert("Client deletion failed: " + (err.message || "Unknown error. Check console for details."));
    }
  };

  const handleMergeSites = async (clientIds: string[]) => {
    if (clientIds.length < 2) return;
    if (!confirm("Are you sure you want to merge these sites? This action cannot be undone and will move all equipment to the first site selected.")) return;

    try {
      const primaryClientId = clientIds[0];
      const secondaryClientIds = clientIds.slice(1);

      // Move equipment
      const equipmentToMove = equipmentList.filter(e => secondaryClientIds.includes(e.client_id || e.clientId || ''));
      for (const eq of equipmentToMove) {
        await syncService.saveEquipment({ ...eq, client_id: primaryClientId, clientId: primaryClientId });
      }

      // Delete secondary clients
      for (const id of secondaryClientIds) {
        await syncService.deleteClient(id);
      }

      await loadData();
      alert("Sites merged successfully.");
    } catch (err: any) {
      console.error("Merge error:", err);
      alert("Merge failed: " + (err.message || "Unknown error."));
    }
  };

  const handleSaveReport = async (report: SavedReport) => {
    try {
      await syncService.saveReport(report);
      await loadData(false);
    } catch (err: any) {
      alert("Failed to save report: " + err.message);
    }
  };

  useEffect(() => {
    // Timeout to ensure app starts even if auth listener is slow or blocked
    const authTimeout = setTimeout(() => {
      if (!isAuthReady) {
        console.warn("Auth initialization timed out, proceeding anyway...");
        setIsAuthReady(true);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user;
      try {
        setAuthError(null);
        setUser(u);
        
        // AUTO-AUTHORIZE: If we have a real user (not anonymous), authorize them
        if (u && !u.is_anonymous) {
          setIsAuthorized(true);
          localStorage.setItem('pfs_authorized', 'true');
          // Default to manager mode for cloud logins unless specified
          if (localStorage.getItem('pfs_view_mode') !== 'technician') {
            setViewMode('manager');
          }
        }

        if (!u && event === 'SIGNED_OUT') {
          setIsAuthorized(false);
          localStorage.removeItem('pfs_authorized');
          syncService.signInAnonymously().then(result => {
            if (result.error) {
              console.warn("Anonymous sign-in failed:", result.error.message);
            }
          });
        }
      } catch (err: any) {
        setAuthError(err.message || "Auth initialization error");
      } finally {
        clearTimeout(authTimeout);
        setIsAuthReady(true);
      }
    });

    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
      }
      setIsAuthReady(true);
      clearTimeout(authTimeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(authTimeout);
    };
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('code') || params.get('sn')) setIsPublicMode(true);
    else if (params.get('portal')) setIsClientMode(true);
    
    loadData(true);
    const sub = syncService.subscribeToChanges(async () => {
      await loadData(false);
    }, (err) => {
      setSyncError(`Sync Error: ${err.message || String(err)}`);
    });
    
    // Refresh on window focus to ensure data is fresh
    // const handleFocus = async () => await loadData(false);
    // window.addEventListener('focus', handleFocus);
    
    return () => {
      if (sub && sub.unsubscribe) sub.unsubscribe();
      // window.removeEventListener('focus', handleFocus);
    };
  }, [loadData, isAuthReady, user?.uid]);

  // Sync Communication Fix: Ensure fresh data pull whenever a dashboard is unlocked
  useEffect(() => {
    // Only fetch if authorized AND (is a manager OR has a technician loaded)
    const isTechReady = viewMode === 'manager' || (viewMode === 'technician' && activeTech);

    if (isAuthorized && isTechReady) {
      const refresh = async () => await loadData(false);
      refresh();
    }
  }, [isAuthorized, viewMode, activeTech, loadData]);

  // Update live session when scanning progress changes
  useEffect(() => {
    if (activeTech && activeClientSessionId) {
      updateLiveSession('In Progress');
    }
  }, [sessionInspectedIds.length, activeClientSessionId, activeTech, updateLiveSession]);

  const handleLogout = () => {
    if (activeTech) {
      const sessionId = activeSubUser ? `session_${activeTech.id}_sub_${activeSubUser.id}` : `session_${activeTech.id}`;
      const sessionData = {
        status: 'Closed',
        timestamp: new Date().toISOString()
      };
      syncService.saveBranding(sessionId, JSON.stringify(sessionData), 'audit');
    }
    setIsAuthorized(false);
    setViewMode('manager');
    setActiveTech(null);
    setActiveSubUser(null);
    setActiveClientForPortal(null);
    setActiveClientSessionId(null);
    setSessionInspectedIds([]);
    localStorage.removeItem('pfs_active_client_session_id');
    localStorage.removeItem('pfs_session_inspected_ids');
  };

  const handleUnlock = (role: 'manager' | 'technician' | 'client', userObj?: any, subUser?: { id: string, name: string, signature?: string }) => {
    setViewMode(role);
    if ((role === 'technician' || role === 'manager') && userObj) {
      setActiveTech(userObj);
      localStorage.setItem('pfs_last_login_date', new Date().toISOString().split('T')[0]);
      if (subUser) setActiveSubUser(subUser);
      // Track login
      const sessionId = subUser ? `session_${userObj.id}_sub_${subUser.id}` : `session_${userObj.id}`;
      const sessionData = {
        status: 'Online',
        role: role,
        timestamp: new Date().toISOString(),
        subUser: subUser ? subUser.name : undefined
      };
      syncService.saveBranding(sessionId, JSON.stringify(sessionData), 'audit');
    }
    if (role === 'client' && userObj) setActiveClientForPortal(userObj);
    
    if (role === 'manager' || role === 'technician') setActiveTab('dashboard');
    else setActiveTab('inventory');
    
    setSessionInspectedIds([]); 
    setActiveClientSessionId(null);
    setIsAuthorized(true);
  };

  const handleScanResult = async (decodedText: string) => {
    if (selectedAuditAsset || showAssetForm) return;

    const cleanCode = decodedText
      .replace(QR_PROTOCOL, '')
      // Remove any domain/path prefix if it ends with ?code= or ?sn=
      .replace(/.*[?&](code|sn)=/, '')
      // Remove everything after the first parameter (if any)
      .split('&')[0]
      .trim();

    if (replacingAsset) {
      if (window.confirm(`RELINK ACTION: Are you sure you want to replace the tag for asset ${replacingAsset.serialNumber} with new code ${cleanCode}?`)) {
        const { isReplacement, replacementId, ...cleanAsset } = replacingAsset as any;
        const updated = { ...cleanAsset, qrCode: cleanCode, serialNumber: cleanCode };
        await syncService.saveEquipment(updated);
        setReplacingAsset(null);
        setShowScanner(false);
        await loadData();
        return;
      }
      setReplacingAsset(null);
      setShowScanner(false);
      return;
    }

    let asset = equipmentList.find(e => 
      e.qrCode === cleanCode || 
      e.serialNumber === cleanCode || 
      e.id === cleanCode
    );

    setIsManualSearch(false);

    // If not found locally, check the cloud registry (Data Saving Logic)
    if (!asset) {
      const cloudData = await syncService.fetchAssetByCode(cleanCode);
      if (cloudData) {
        handleGlobalSearchResults(cloudData);
        asset = cloudData.equipment.find(e => 
          e.qrCode === cleanCode || 
          e.serialNumber === cleanCode || 
          e.id === cleanCode
        );
      }
    }

    if (asset) {
      const isValidSession = activeClientSessionId && clients.some(c => c.id === activeClientSessionId);
      if (isValidSession && asset.client_id !== activeClientSessionId) {
        alert(`SESSION LOCKED: You are currently auditing ${clients.find(c => c.id === activeClientSessionId)?.name}. Please finalize this client before scanning assets from another site.`);
        return;
      }
      
      // Reactivate client if archived
      const client = clients.find(c => c.id === asset.client_id);
      if (client?.isArchived) {
        await syncService.saveClient({ ...client, isArchived: false, archivedAt: undefined });
        loadData();
      }

      // Lock session to this client on first scan
      if (!activeClientSessionId) setActiveClientSessionId(asset.client_id || null);

      // AUTO-COMMISSION: If unit was booked in via portal, go straight to commission (EquipmentForm)
      if (asset.manufacturer === 'Booked In' && viewMode !== 'client') {
        setEditingAsset(asset);
        setSelectedClientIdForAsset(asset.client_id || null);
        setShowAssetForm(true);
        setShowScanner(false);
        return;
      }

      if (viewMode === 'client') {
         if (!activeClientForPortal) {
            const client = clients.find(c => c.id === asset.client_id);
            if (client) {
               setActiveClientForPortal(client);
            }
         } else if (asset.client_id !== activeClientForPortal.id) {
            alert("ASSET ERROR: This equipment belongs to another property and cannot be inspected from this portal.");
            return;
         }
         
         if (requestedTaskType) {
            setActiveAuditTask(requestedTaskType);
            setRequestedTaskType(null);
         }
      }
      if (asset.qrCode !== cleanCode) {
        const { isReplacement, replacementId, ...cleanAsset } = asset as any;
        const updated = { ...cleanAsset, qrCode: cleanCode };
        await syncService.saveEquipment(updated);
        await loadData();
        setSelectedAuditAsset(updated);
      } else {
        setSelectedAuditAsset(asset);
      }

      if (scanContext === 'fault') {
        setActiveAuditTask(TaskType.FAULT);
        setScanContext(null);
      }

      setUnregisteredCode(null);
      setShowScanner(false);
    } else {
      const isValidSession = activeClientSessionId && clients.some(c => c.id === activeClientSessionId);
      if (isValidSession) {
        setSelectedClientIdForAsset(activeClientSessionId);
        setUnregisteredCode(cleanCode);
        setShowAssetForm(true);
        setShowScanner(false);
      } else {
        setUnregisteredCode(cleanCode);
        setSelectedAuditAsset(null);
        setShowScanner(false);
      }
      // Let TaskSelector handle the choice (Link to Site, Add to Current, etc)
    }
  };

  const handleManualEntry = (code: string) => {
    handleScanResult(code);
  };

  const handleSearchClient = () => {
    setIsManualSearch(true);
    setUnregisteredCode(null);
    setShowClientPicker(true);
  };

  const handleReplaceUnit = async (asset: Equipment) => {
    if (!window.confirm(`REPLACE UNIT: This will archive the current asset (${asset.serialNumber}) and allow you to commission a new replacement unit using the same QR tag. Proceed?`)) return;
    
    try {
      // Archive old unit
      const { isReplacement, replacementId, ...cleanAsset } = asset as any;
      const archivedAsset = { ...cleanAsset, isArchived: true, archivedAt: new Date().toISOString().split('T')[0] };
      await syncService.saveEquipment(archivedAsset);
      
      // Create replacement record for old unit
      const record: InspectionRecord = {
        id: Math.random().toString(36).substr(2, 9),
        equipmentId: asset.id,
        equipmentType: asset.type,
        taskType: TaskType.REPLACE_EQUIPMENT,
        inspectorName: (activeTech?.name && activeTech.name !== 'Precision Management') ? activeTech.name : 'Technician',
        inspectorSignature: activeTech?.signature,
        date: new Date().toISOString().split('T')[0],
        status: 'Condemned',
        findings: {},
        notes: "Asset replaced with new unit."
      };
      await syncService.saveInspection(record);
      
      // Open form for new unit with same QR
      setUnregisteredCode(asset.qrCode || null);
      setSelectedClientIdForAsset(asset.client_id || null);
      setIsReplacementFlow(true);
      setShowAssetForm(true);
      setSelectedAuditAsset(null);
      setShowCondemnUnits(null);
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReplaceQR = (asset: Equipment) => {
    setReplacingAsset(asset);
    setShowScanner(true);
    setSelectedAuditAsset(null);
  };

  const handleUpdateSeal = async (asset: Equipment) => {
    const newSeal = window.prompt(`Update Seal Serial Number for ${asset.serialNumber}:`, asset.sealSerialNumber || '');
    if (newSeal !== null && newSeal !== asset.sealSerialNumber) {
      try {
        const updated = { ...asset, sealSerialNumber: newSeal };
        await syncService.saveEquipment(updated);
        await loadData();
        setSelectedAuditAsset(updated);
        alert("Seal serial number updated successfully.");
      } catch (e) {
        alert("Failed to update seal serial number.");
      }
    }
  };

  const handleMoveAsset = async (assetId: string, targetSiteId: string) => {
    const isManager = viewMode === 'manager' || activeTech?.role === 'admin';
    if (!isManager) {
      alert("SECURITY: Only managers can re-allocate assets between sites.");
      return;
    }
    try {
      const asset = equipmentList.find(e => e.id === assetId);
      if (!asset) return;
      await syncService.saveEquipment({ ...asset, client_id: targetSiteId, clientId: targetSiteId });
      setShowMoveAsset(null);
      setSelectedAuditAsset(null);
      await loadData();
      alert("Asset moved successfully.");
    } catch (e) {
      alert("Failed to move asset.");
    }
  };

  const handleAuditComplete = async (record: InspectionRecord, scanNext?: boolean) => {
    if (!selectedAuditAsset || !activeTech) return;

    try {
      setIsSyncing(true);
      
      // V12.18: IMMUTABLE TECHNICIAN LOCK
      const lockedRecord = {
        ...record,
        techName: activeTech.name,
        techSaqcc: activeTech.saqcc,
        techSignature: activeTech.signature || '',
        technicianId: activeTech.id
      };

      console.log("Saving locked record:", lockedRecord);
      await syncService.saveInspection(lockedRecord);
      
      // Update local state to reflect the new record
      setRecords(prev => [...prev, lockedRecord]);
      
      setSessionInspectedIds((prev: string[]) => [...prev, selectedAuditAsset.id]);
      if (!activeClientSessionId) setActiveClientSessionId(selectedAuditAsset.client_id || null);

      const { isReplacement, replacementId, ...cleanAsset } = selectedAuditAsset as any;
      const updatedAsset = { ...cleanAsset };
      
      // Append new photos to equipment
      if (record.photos && record.photos.length > 0) {
        const existingPhotos = updatedAsset.photos || [];
        const newPhotos = record.photos.filter(p => !existingPhotos.includes(p));
        if (newPhotos.length > 0) {
          updatedAsset.photos = [...existingPhotos, ...newPhotos];
        }
      }
      
      if (record.taskType === TaskType.MAINTENANCE || record.taskType === TaskType.INSTALLATION) {
         updatedAsset.lastInspectionDate = record.date;
         const d = new Date(record.date);
         d.setFullYear(d.getFullYear() + 1);
         updatedAsset.nextServiceDate = d.toISOString().split('T')[0];

         if (record.taskType === TaskType.INSTALLATION) {
            updatedAsset.lastPressureTestDate = record.date;
            const ptDate = new Date(record.date);
            const isCO2 = updatedAsset.size?.toLowerCase().includes('co2') || updatedAsset.manufacturer?.toLowerCase().includes('co2');
            const interval = isCO2 ? 10 : 5;
            ptDate.setFullYear(ptDate.getFullYear() + interval);
            updatedAsset.nextPressureTestDate = ptDate.toISOString().split('T')[0];
            updatedAsset.pressureTestDateUnknown = false;
            updatedAsset.isPressureTestNonCompliant = false;
         }
      } else if (record.taskType === TaskType.PRESSURE_TEST) {
         updatedAsset.lastPressureTestDate = record.date;
         const d = new Date(record.date);
         d.setFullYear(d.getFullYear() + 5);
         updatedAsset.nextPressureTestDate = d.toISOString().split('T')[0];
         updatedAsset.pressureTestDateUnknown = false;
         updatedAsset.isPressureTestNonCompliant = false;
      } else if (record.taskType === TaskType.INSPECTION) {
         // Monthly inspection - DO NOT update lastInspectionDate (Maintenance) or nextServiceDate
         // We could have a separate field if needed, but per user request we leave maintenance dates alone
      } else {
         updatedAsset.lastInspectionDate = record.date;
      }

      if (record.status === 'Condemned') {
         updatedAsset.isArchived = true;
         updatedAsset.archivedAt = record.date;
      }

      if (record.sealSerialNumber) {
         updatedAsset.sealSerialNumber = record.sealSerialNumber;
      }

      await syncService.saveEquipment(updatedAsset);
      
      // Auto-create assessment item if there are remarks or failed checks
      if ((record.notes && record.notes.trim() !== '') || record.status === 'Fail' || record.status === 'Service Required' || record.status === 'Condemned') {
        const clientId = updatedAsset.client_id;
        if (clientId) {
          const currentItems = siteAssessments[clientId] || [];
          
          // Collect failed check labels
          const assetDef = EQUIPMENT_DEFINITIONS.find(d => d.type === updatedAsset.type);
          const checklist = assetDef?.checklists[record.taskType] || [];
          const failedLabels = Object.entries(record.findings)
            .filter(([_, value]) => value === false)
            .map(([key, _]) => {
              const item = checklist.find(i => i.id === key);
              return item ? item.label : key;
            });

          let description = '';
          if (record.notes && record.notes.trim() !== '') {
            description = `Technician Remark: ${updatedAsset.type} (${updatedAsset.size || updatedAsset.serialNumber}) - ${record.notes}`;
          } else if (failedLabels.length > 0) {
            description = `Failed Checks: ${updatedAsset.type} (${updatedAsset.size || updatedAsset.serialNumber}) - ${failedLabels.join(', ')}`;
          }

          if (description) {
            const existingItemIndex = currentItems.findIndex(item => item.description === description);
            
            let updatedItems;
            if (existingItemIndex > -1) {
              updatedItems = currentItems.map((item, idx) => 
                idx === existingItemIndex ? { ...item, quantity: (item.quantity || 0) + 1 } : item
              );
            } else {
              const newItem = {
                id: Math.random().toString(36).substr(2, 9),
                description,
                type: 'other',
                quantity: 1
              };
              updatedItems = [...currentItems, newItem];
            }
            
            setSiteAssessments(prev => ({ ...prev, [clientId]: updatedItems }));
            
            // Save to database
            try {
              await syncService.saveSiteAssessment(clientId, updatedItems);
            } catch (err) {
              console.error("Failed to sync site assessment:", err);
            }
          }
        }
      }
      
      // Update live session progress
      if (activeTech && activeClientSessionId) {
        updateLiveSession('In Progress', activeClientSessionId, sessionInspectedIds.length + 1);
      }

      if (viewMode === 'client') {
        setPostAuditReport(record);
      }

      if (record.taskType === TaskType.MAINTENANCE) {
         let nextTask: TaskType | null = null;
         
         if (updatedAsset.type === EquipmentType.HOSE_REEL || updatedAsset.type === EquipmentType.HYDRANT) {
            nextTask = TaskType.FLOW_TEST;
         } else if (updatedAsset.type === EquipmentType.EXTINGUISHER) {
            const now = new Date();
            const mfgDate = updatedAsset.manufactureDate ? new Date(updatedAsset.manufactureDate) : null;
            const lastPTDate = updatedAsset.lastPressureTestDate ? new Date(updatedAsset.lastPressureTestDate) : null;
            
            const mfgValid = mfgDate && !isNaN(mfgDate.getTime());
            const lastPTValid = lastPTDate && !isNaN(lastPTDate.getTime());
            
            const yearsSinceMfg = mfgValid ? (now.getFullYear() - mfgDate.getFullYear()) : 0;
            const yearsSincePT = lastPTValid ? (now.getFullYear() - lastPTDate.getFullYear()) : null;

            const isCO2 = updatedAsset.size?.toLowerCase().includes('co2') || updatedAsset.manufacturer?.toLowerCase().includes('co2');
            const interval = isCO2 ? 10 : 5;

            const isPTDue = updatedAsset.pressureTestDateUnknown === true || 
                            (!lastPTValid && yearsSinceMfg >= 5) ||
                            (lastPTValid && yearsSincePT !== null && yearsSincePT >= interval);
            
            if (isPTDue) nextTask = TaskType.PRESSURE_TEST;
         }

         if (nextTask) {
            setSelectedAuditAsset(updatedAsset);
            setActiveAuditTask(nextTask);
            await loadData(); 
            return;
         }
      }

      setSelectedAuditAsset(null);
      setActiveAuditTask(null);
      
      if (scanNext) {
        // Ensure scanner opens and client session is preserved
        setShowScanner(true);
        setShowPostAuditOptions(false);
      } else {
        setShowPostAuditOptions(true);
      }
      
      await loadData();
    } catch (err: any) {
      alert("Registry Sync Failed: " + err.message);
    }
  };

  const validateFaultSubmission = (equipmentId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const existingFault = faults.find(f => 
      f.equipmentId === equipmentId && 
      f.timestamp?.startsWith(today) &&
      f.status === 'Open'
    );
    if (existingFault) {
      return { 
        allowed: false, 
        reason: "A fault has already been logged for this asset today. Our team is already aware and processing the request." 
      };
    }
    return { allowed: true };
  };

  if (isAppStarting) return <BrandSplash branding={branding} />;

  if (isPublicMode) {
    return (
      <PublicPortal 
        equipmentList={equipmentList} 
        clients={clients} 
        onSubmitFault={async (f) => { await syncService.saveFaultReport(f); await loadData(); }} 
        onScanTech={(tech) => handleUnlock('technician', tech)} 
        allTechnicians={techs} 
        validateSubmission={validateFaultSubmission} 
      />
    );
  }

  if (isClientMode && !isAuthorized) {
    return (
      <ClientPortal 
        clients={clients} 
        equipment={equipmentList} 
        records={records} 
        faults={faults}
        technicians={techs}
        onLogin={(client) => handleUnlock('client', client)}
        onGenerateReport={(cid) => { setActiveTab('reports'); setIsClientMode(false); }} 
        onGenerateCOC={(cid) => { setActiveTab('coc'); setIsClientMode(false); }} 
        onExit={() => setIsClientMode(false)}
        onScanRequest={() => setShowScanner(true)}
        activeTech={activeTech}
      />
    );
  }

  if (showBookInPortal) {
    return (
      <BookInPortal 
        clients={clients}
        equipment={equipmentList}
        records={records}
        onAddClient={async (c) => {
          await syncService.saveClient(c);
          await loadData();
        }}
        onAddEquipment={async (eq) => {
          await syncService.saveEquipment(eq);
          await loadData();
        }}
        onClose={() => {
          setShowBookInPortal(false);
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  if (!isAuthorized) {
    return (
      <>
        <SecurityGate technicians={techs} onUnlock={handleUnlock} onBookingPortalRequest={() => setShowBookInPortal(true)} />
        {(syncError || authError) && (
          <div className="fixed bottom-4 left-4 right-4 z-[4000] bg-red-900/90 text-white p-4 rounded-xl shadow-2xl border border-red-500/50 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-black uppercase tracking-widest mb-1">Synchronization Error</p>
                <p className="text-[10px] opacity-80 leading-relaxed">
                  {authError ? `Auth: ${authError}` : `Data: ${syncError}`}
                </p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-3 text-[9px] font-black uppercase tracking-widest bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-all"
                >
                  Reload App
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="fixed bottom-4 right-4 z-[4000] opacity-20 hover:opacity-100 transition-opacity flex flex-col items-end gap-2">
          <div className="bg-slate-800 text-[8px] text-slate-400 p-2 rounded-lg font-mono shadow-xl border border-white/5">
            UID: {user?.id || 'None'}<br/>
            Auth: {isAuthReady ? 'Ready' : 'Waiting'}<br/>
            Conn: {connectionStatus ? (connectionStatus.ok ? 'OK' : 'FAIL') : '...'}<br/>
            Data: {equipmentList.length} assets
          </div>
          <button 
            onClick={async () => {
              setSyncError(null);
              await loadData(true);
            }}
            className="bg-slate-800 hover:bg-emerald-900 text-[8px] text-slate-400 hover:text-white px-2 py-1 rounded-lg font-mono transition-colors"
          >
            Force Sync
          </button>
          <button 
            onClick={async () => {
              if (window.confirm("Clear all local data and reload?")) {
                localStorage.clear();
                if ('serviceWorker' in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  for (let registration of registrations) {
                    await registration.unregister();
                  }
                  const cacheNames = await caches.keys();
                  for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                  }
                }
                window.location.reload();
              }
            }}
            className="bg-slate-800 hover:bg-red-900 text-[8px] text-slate-400 hover:text-white px-2 py-1 rounded-lg font-mono transition-colors"
          >
            Clear Cache & Reload
          </button>
        </div>
      </>
    );
  }

  if (showDiscardReport) {
    const asset = equipmentList.find(e => e.id === showDiscardReport);
    if (asset) return <DiscardReport equipment={asset} records={records} client={clients.find(c => c.id === asset.client_id)} technicians={techs} onBack={() => setShowDiscardReport(null)} />;
  }

  if (showSiteDisposalLedger) {
    const client = clients.find(c => c.id === showSiteDisposalLedger);
    if (client) return <SiteDisposalLedger client={client} discardedAssets={equipmentList.filter(e => e.client_id === client.id && e.isArchived)} records={records} technicians={techs} onBack={() => setShowSiteDisposalLedger(null)} />;
  }

  if (showDetectionCOC) {
    const client = clients.find(c => c.id === showDetectionCOC);
    if (client) return <DetectionCOCGenerator client={client} equipment={equipmentList.filter(e => e.client_id === client.id)} records={records} activeTech={activeTech} onBack={() => setShowDetectionCOC(null)} />;
  }

  if (isAuthorized && viewMode === 'client') {
    return (
      <>
        <ClientPortal 
          clients={clients} 
          equipment={equipmentList} 
          records={records} 
          faults={faults}
          technicians={techs}
          authenticatedClient={activeClientForPortal}
          onScanRequest={(type) => { 
             console.log("Portal Scan Request:", type);
             if (type === 'inspection') setRequestedTaskType(TaskType.INSPECTION);
             if (type === 'fault') setRequestedTaskType(TaskType.FAULT);
             setShowScanner(true); 
          }}
          onGenerateReport={(cid) => { 
             setActiveTab('reports'); 
             setAutoOpenReportClientId(cid);
             setAutoOpenReportType('technical');
             setIsAuthorized(false);
             setIsClientMode(false);
          }} 
          onGenerateCOC={(cid) => { 
             setActiveTab('coc'); 
             setAutoOpenReportClientId(cid);
             setIsAuthorized(false);
             setIsClientMode(false);
          }} 
          onExit={async () => { 
             setIsAuthorized(false); 
             setIsClientMode(false);
             await loadData(); 
          }} 
          activeTech={activeTech}
        />
        {showScanner && (
          <QRScanner 
            onScan={handleScanResult} 
            onClose={() => setShowScanner(false)} 
            activeClientName={activeClientForPortal?.name}
            permissionGranted={cameraPermissionGranted}
            onPermissionGranted={() => setCameraPermissionGranted(true)}
          />
        )}
        {selectedAuditAsset && activeAuditTask && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
             {activeAuditTask === TaskType.FAULT ? (
               <FaultReportForm
                 equipment={equipmentList}
                 clients={clients}
                 onClose={() => { setSelectedAuditAsset(null); setActiveAuditTask(null); }}
                 onSave={async (f) => { await syncService.saveFaultReport(f); await loadData(); setSelectedAuditAsset(null); setActiveAuditTask(null); }}
                 validateSubmission={validateFaultSubmission}
                 preSelectedAssetId={selectedAuditAsset.id}
                 preSelectedClientId={selectedAuditAsset.client_id || ''}
               />
             ) : (
               <ChecklistForm 
                 equipment={selectedAuditAsset} 
                 taskType={activeAuditTask} 
                 activeTech={{ name: 'Client Auditor', saqcc: 'INTERNAL', email: '' }}
                 activeSubUser={activeSubUser}
                 existingRecords={records.filter(r => {
                   const eq = equipmentList.find(e => e.id === (r.equipmentId || r.equipment_id));
                   return eq?.client_id === selectedAuditAsset.client_id;
                 })}
                 branding={branding}
                 onComplete={handleAuditComplete} 
                 onCancel={() => {
                    setSelectedAuditAsset(null);
                    setActiveAuditTask(null);
                 }} 
               />
             )}
          </div>
        )}
        {selectedAuditAsset && !activeAuditTask && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <TaskSelector 
              equipment={selectedAuditAsset} 
              onSelect={(task) => setActiveAuditTask(task)} 
              onCancel={() => setSelectedAuditAsset(null)} 
              isClient={true}
              records={records}
              onMove={() => setShowMoveAsset(selectedAuditAsset)}
            />
          </div>
        )}
        {showAssetForm && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <EquipmentForm 
              clientId={activeClientForPortal?.id || null} 
              clientName={activeClientForPortal?.name}
              initialCode={unregisteredCode || undefined}
              allEquipment={equipmentList}
              onSave={async (eq) => {
                const assets = Array.isArray(eq) ? eq : [eq];
                for (const asset of assets) {
                  await syncService.saveEquipment(asset);
                }
                setShowAssetForm(false);
                setUnregisteredCode(null);
                await loadData();
              }}
              onCancel={() => {
                setShowAssetForm(false);
                setUnregisteredCode(null);
              }}
            />
          </div>
        )}
        {postAuditReport && (
          <SingleRecordReport 
            record={postAuditReport} 
            equipment={equipmentList.find(e => e.id === postAuditReport.equipmentId)} 
            client={activeClientForPortal || undefined} 
            onClose={() => setPostAuditReport(null)} 
          />
        )}
      </>
    );
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      viewMode={viewMode} 
      activeTech={activeTech}
      onSwitchRole={() => setIsAuthorized(false)} 
      onLogout={handleLogout} 
      onScanRequest={() => { setScanContext('audit'); setShowScanner(true); }}
      onSearchClientRequest={handleSearchClient}
      onGlobalSearchRequest={() => setShowGlobalSearch(true)}
      activeClientName={activeClientSessionId ? clients.find(c => c.id === activeClientSessionId)?.name : undefined}
      scannedCount={sessionInspectedIds.length}
      branding={branding}
    >
      {showGlobalSearch && (
        <GlobalSearch 
          onResults={handleGlobalSearchResults} 
          onClose={() => setShowGlobalSearch(false)} 
        />
      )}

      {showScanner && (
        <QRScanner 
          onScan={handleScanResult} 
          onClose={() => { setShowScanner(false); setScanContext(null); }} 
          onSearchClient={() => {
            setShowScanner(false);
            setScanContext(null);
            handleSearchClient();
          }}
          activeClientName={activeClientSessionId ? clients.find(c => c.id === activeClientSessionId)?.name : undefined}
          onFinalize={sessionInspectedIds.length > 0 ? () => {
            setShowScanner(false);
            if (activeTech) updateLiveSession('Closed');
            if (activeClientSessionId) {
              setAutoOpenReportClientId(activeClientSessionId);
              setActiveTab('reports');
              setShowClientPicker(false); 
            }
            setActiveClientSessionId(null);
            setSessionInspectedIds([]);
          } : undefined}
          permissionGranted={cameraPermissionGranted}
          onPermissionGranted={() => setCameraPermissionGranted(true)}
          scannedCount={sessionInspectedIds.length}
        />
      )}

      {showPostAuditOptions && activeClientSessionId && (
        <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
          <SiteHandover 
            client={clients.find(c => c.id === activeClientSessionId)!}
            equipment={equipmentList.filter(e => e.client_id === activeClientSessionId)}
            records={records.filter(r => sessionInspectedIds.includes(r.id))}
            isManager={viewMode === 'manager' || activeTech?.role === 'admin'}
            onViewReport={() => {
              if (activeTech) updateLiveSession('Closed');
              setShowPostAuditOptions(false);
              setAutoOpenReportClientId(activeClientSessionId);
              setActiveTab('reports');
              setActiveClientSessionId(null);
              setSessionInspectedIds([]);
            }}
            onViewCOC={() => {
              if (activeTech) updateLiveSession('Closed');
              setShowPostAuditOptions(false);
              setShowFullCOC({ clientId: activeClientSessionId, onlyCertificate: true });
              setActiveClientSessionId(null);
              setSessionInspectedIds([]);
            }}
            onClose={() => {
              if (activeTech) updateLiveSession('Closed');
              setShowPostAuditOptions(false);
              setActiveClientSessionId(null);
              setSessionInspectedIds([]);
            }}
          />
        </div>
      )}

      {(selectedAuditAsset || unregisteredCode) && !activeAuditTask && !showClientPicker && !showAssetForm && (
        <TaskSelector 
          equipment={selectedAuditAsset || undefined} 
          scannedCode={unregisteredCode || undefined}
          isClient={viewMode === 'client'}
          records={records}
          activeClientName={activeClientSessionId ? clients.find(c => c.id === activeClientSessionId)?.name : undefined}
          onSelect={(type) => {
            if (type === TaskType.LINK_CLIENT) {
              setShowClientPicker(true);
            } else if (type === TaskType.INSTALLATION && unregisteredCode) {
              const isValidSession = activeClientSessionId && clients.some(c => c.id === activeClientSessionId);
              if (isValidSession) {
                setSelectedClientIdForAsset(activeClientSessionId || null);
                setShowAssetForm(true);
              } else {
                setShowClientPicker(true);
              }
            } else {
              setActiveAuditTask(type);
            }
          }} 
          onLinkExisting={() => setShowClientPicker(true)}
          onReplaceUnit={selectedAuditAsset ? () => handleReplaceUnit(selectedAuditAsset) : (unregisteredCode ? () => setIsReplacementFlow(true) : undefined)}
          onReplaceQR={selectedAuditAsset ? () => handleReplaceQR(selectedAuditAsset) : (unregisteredCode ? () => setIsReplacementFlow(true) : undefined)}
          onUpdateSeal={selectedAuditAsset ? () => handleUpdateSeal(selectedAuditAsset) : undefined}
          onMove={selectedAuditAsset ? () => setShowMoveAsset(selectedAuditAsset) : undefined}
          onCancel={() => { setSelectedAuditAsset(null); setUnregisteredCode(null); }} 
        />
      )}

      {showAssetForm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           <EquipmentForm 
             clientId={selectedClientIdForAsset}
             clientName={clients.find(c => c.id === selectedClientIdForAsset)?.name}
             initialCode={unregisteredCode || undefined}
             existingEquipment={editingAsset}
             allEquipment={equipmentList}
             isReplacementFlow={isReplacementFlow}
             onSave={async (e) => {
               const asset = Array.isArray(e) ? e[0] : e;
               const { isReplacement, replacementId, ...cleanAsset } = asset as any;
               await syncService.saveEquipment(cleanAsset);
               if (!activeClientSessionId) setActiveClientSessionId(asset.client_id || null);
               setShowAssetForm(false);
               setIsReplacementFlow(false);
               setSelectedClientIdForAsset(null);
               setUnregisteredCode(null);
               const wasBookedIn = editingAsset?.manufacturer === 'Booked In';
               const wasNew = !editingAsset;
               setEditingAsset(null);
               await loadData();
               
               if (wasNew || wasBookedIn) {
                 setSelectedAuditAsset(asset);
                 setActiveAuditTask(TaskType.MAINTENANCE);
               }
             }}
             onCancel={() => { 
               setShowAssetForm(false); 
               setIsReplacementFlow(false);
               setSelectedClientIdForAsset(null); 
               setEditingAsset(null);
             }}
           />
        </div>
      )}

      {selectedAuditAsset && activeAuditTask && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
           {activeAuditTask === TaskType.FAULT ? (
             <FaultReportForm
               equipment={equipmentList}
               clients={clients}
               onClose={() => { setSelectedAuditAsset(null); setActiveAuditTask(null); }}
               onSave={async (f) => { await syncService.saveFaultReport(f); await loadData(); setSelectedAuditAsset(null); setActiveAuditTask(null); }}
               validateSubmission={validateFaultSubmission}
               preSelectedAssetId={selectedAuditAsset.id}
               preSelectedClientId={selectedAuditAsset.client_id || ''}
             />
           ) : (
             <ChecklistForm 
               equipment={selectedAuditAsset} 
               taskType={activeAuditTask} 
               activeTech={activeSubUser ? { ...activeTech!, name: `${activeTech!.name} (${activeSubUser.name})`, signature: activeSubUser.signature || activeTech!.signature } : (activeTech || (viewMode === 'client' ? { name: 'Client Auditor', saqcc: 'INTERNAL', email: '' } : null))}
               activeSubUser={activeSubUser}
               existingRecords={records.filter(r => {
                 const asset = equipmentList.find(e => e.id === (r.equipmentId || r.equipment_id));
                 return asset?.client_id === selectedAuditAsset.client_id;
               })}
               branding={branding}
               onComplete={handleAuditComplete} 
               onCancel={() => {
                  setSelectedAuditAsset(null);
                  setActiveAuditTask(null);
               }} 
             />
           )}
        </div>
      )}

      {postAuditReport && (
        <SingleRecordReport 
          record={postAuditReport} 
          equipment={equipmentList.find(e => e.id === postAuditReport.equipmentId)} 
          client={activeClientForPortal || clients.find(c => c.id === equipmentList.find(e => e.id === postAuditReport.equipmentId)?.client_id)} 
          onClose={() => setPostAuditReport(null)} 
        />
      )}

      {/* Client Portal is now handled above Layout for clean full-screen experience */}

      {viewMode !== 'client' && (
        <>
          {activeTab === 'dashboard' && viewMode === 'manager' && (
            <Dashboard 
              clients={clients} 
              equipment={equipmentList} 
              records={records} 
              faults={faults}
              technicians={techs} 
              branding={branding}
              onResolveFault={async () => await loadData()} 
              onAddFirstClient={() => setActiveTab('sites')}
              onNavigateToSite={(clientId) => setShowFullTechnicalReport(clientId)}
              onNavigateToTab={(tab) => {
                if (tab === 'inventory-due') {
                  setShowOnlyDue(true);
                  setActiveTab('inventory');
                } else {
                  setShowOnlyDue(false);
                  setActiveTab(tab);
                }
              }}
              onRefresh={async () => await loadData()}
              lastUpdated={lastUpdated}
              lastFinalized={lastFinalized}
            />
          )}

          {activeTab === 'dashboard' && viewMode === 'technician' && (
            <TechnicianDashboard 
              activeTech={activeTech}
              activeSubUser={activeSubUser}
              equipment={equipmentList}
              records={records}
              faults={faults}
              onScanRequest={() => setShowScanner(true)}
              onSearchClient={handleSearchClient}
              onNavigateToTab={(tab) => {
                if (tab === 'inventory-due') {
                  setShowOnlyDue(true);
                  setActiveTab('inventory');
                } else {
                  setShowOnlyDue(false);
                  setActiveTab(tab);
                }
              }}
              onRefresh={async () => await loadData()}
              lastUpdated={lastUpdated}
            />
          )}
          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <ComplianceTab clients={clients} equipment={equipmentList} records={records} faults={faults} />
            </div>
          )}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <AssetRegister 
                equipment={equipmentList} 
                clients={clients} 
                records={records} 
                isManager={viewMode === 'manager' || activeTech?.role === 'admin'} 
                activeClientId={activeClientSessionId}
                onLabelRequest={setShowLabel} 
                onScanRequest={() => setShowScanner(true)}
                onBulkQRRequest={() => setActiveTab('qr-station')}
                onAuditRequest={(asset, type) => { setSelectedAuditAsset(asset); if(type) setActiveAuditTask(type); }}
                onDeleteRequest={handleDeleteAsset}
                onEditRequest={(asset) => {
                  setEditingAsset(asset);
                  setSelectedClientIdForAsset(asset.client_id || null);
                  setShowAssetForm(true);
                }}
                onReplaceRequest={(asset) => {
                  setReplacingAsset(asset);
                  setShowScanner(true);
                }}
                sessionInspectedIds={sessionInspectedIds}
                showOnlyDue={showOnlyDue}
              />
            </div>
          )}
          {activeTab === 'sites' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <ClientManager 
                clients={clients} 
                equipment={equipmentList} 
                records={records} 
                onAddClient={async (c) => { 
                  await syncService.saveClient(c); 
                  await loadData(); 
                  setActiveClientSessionId(c.id);
                  updateLiveSession('In Progress', c.id, 0);
                  setShowScanner(true);
                }} 
                onUpdateClient={async (c) => { await syncService.saveClient(c); await loadData(); }}
                onDeleteClient={handleDeleteClient}
                onMergeSites={handleMergeSites}
                onViewAssets={(cid) => { 
                  setActiveClientSessionId(cid);
                  setActiveTab('inventory'); 
                }} 
                onGenerateReport={() => {}} 
                activeClientId={activeClientSessionId} 
                isManager={viewMode === 'manager' || activeTech?.role === 'admin' || activeTech?.role === 'manager'} 
                activeTech={activeTech}
              />
            </div>
          )}
          
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <PerformanceHub equipment={equipmentList} clients={clients} records={records} faults={faults} />
            </div>
          )}

          {activeTab === 'qr-station' && <BulkQRManager equipment={equipmentList} onClose={() => setActiveTab('inventory')} />}

          {activeTab === 'technical-hub' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <TechnicalHub mode="PRESSURE_TEST" clients={clients} equipment={equipmentList} records={records} onRefresh={async () => await loadData()} onScanRequest={() => setShowScanner(true)} activeTech={activeTech} />
            </div>
          )}
          {activeTab === 'pressure-tests' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <TechnicalHub mode="PRESSURE_TEST" clients={clients} equipment={equipmentList} records={records} onRefresh={async () => await loadData()} onScanRequest={() => setShowScanner(true)} activeTech={activeTech} />
            </div>
          )}
          {activeTab === 'recharges' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <TechnicalHub mode="RECHARGE" clients={clients} equipment={equipmentList} records={records} onRefresh={async () => await loadData()} onScanRequest={() => setShowScanner(true)} activeTech={activeTech} />
            </div>
          )}
          {activeTab === 'flow' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <FlowHub clients={clients} equipment={equipmentList} records={records} activeTech={activeTech} onRefresh={async () => await loadData()} />
            </div>
          )}
          {activeTab === 'detection' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <DetectionHub equipment={equipmentList} clients={clients} records={records} activeClientId={null} activeTech={activeTech} onRefresh={async () => await loadData()} onRequestClientPicker={() => setShowClientPicker(true)} onGenerateDetectionCOC={setShowDetectionCOC} />
            </div>
          )}
          
          {activeTab === 'faults' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <FaultHub faults={faults} equipment={equipmentList} clients={clients} technicians={techs} onRefresh={async () => await loadData()} onScanRequest={() => setShowScanner(true)} activeTech={activeTech} isManager={viewMode === 'manager' || activeTech?.role === 'admin'} validateSubmission={validateFaultSubmission} />
            </div>
          )}
          
          {activeTab === 'techs' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <TechnicianManager 
                technicians={techs} 
                onAdd={async (t) => { await syncService.saveTechnician(t); await loadData(); }} 
                onUpdate={async (t) => { await syncService.saveTechnician(t); await loadData(); }} 
                onDelete={async (id) => { 
                  try {
                    await syncService.deleteTechnician(id);
                    loadData();
                  } catch (err: any) {
                    alert("Failed to delete technician: " + err.message);
                  }
                }} 
              />
            </div>
          )}

          {activeTab === 'coc' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <COCTab 
                clients={clients} 
                equipment={equipmentList} 
                records={records} 
                onGenerateCOC={(cid) => { 
                  setAutoOpenReportClientId(cid); 
                  setAutoOpenReportType('coc');
                  setActiveTab('reports'); 
                }} 
              />
            </div>
          )}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <ReportsTab 
                clients={clients} 
                equipment={equipmentList} 
                records={records} 
                faults={faults}
                technicians={techs}
                activeTech={activeTech ? (activeSubUser ? { ...activeTech!, name: `${activeTech!.name} (${activeSubUser.name})`, signature: activeSubUser.signature || activeTech!.signature } : activeTech) : null}
                branding={branding}
                reports={reports}
                onSaveReport={async (report) => {
                  await syncService.saveReport(report);
                  await loadData();
                }}
                onGenerateReport={(cid) => setShowTechnicalReport(cid)} 
                onGenerateTechnicalReport={(cid) => setShowTechnicalReport(cid)} 
                onGenerateInspectionReport={(cid, date) => setShowInspectionReport({ clientId: cid, date })} 
                isManager={viewMode === 'manager'}
                autoOpenClientId={autoOpenReportClientId}
                autoOpenType={autoOpenReportType}
                onClearAutoOpen={() => {
                  setAutoOpenReportClientId(null);
                  setAutoOpenReportType(null);
                }}
              />
            </div>
          )}
          {activeTab === 'quotes' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <QuoteTab 
                clients={clients} 
                equipment={equipmentList} 
                records={records} 
                faults={faults}
                siteAssessments={siteAssessments}
                onUpdateAssessment={async (clientId, items) => {
                  setSiteAssessments(prev => ({ ...prev, [clientId]: items }));
                  await syncService.saveSiteAssessment(clientId, items);
                }}
                onDownloadReport={(clientId) => setShowSiteAssessmentReport(clientId)}
                onAddClient={async (c) => { await syncService.saveClient(c); await loadData(); }}
              />
            </div>
          )}
          {activeTab === 'rectify' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <RectifyTab
                equipment={equipmentList}
                records={records}
                clients={clients}
                faults={faults}
                onUpdateRecord={async (record) => {
                  await syncService.updateRecord(record);
                  await loadData();
                }}
                onUpdateFault={async (fault) => {
                  await syncService.saveFaultReport(fault);
                  await loadData();
                }}
              />
            </div>
          )}
          
          {activeTab === 'discard' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <DiscardHub equipment={equipmentList} records={records} clients={clients} activeTech={activeTech} onRefresh={async () => await loadData()} onViewReport={setShowDiscardReport} onViewSiteLedger={setShowSiteDisposalLedger} />
            </div>
          )}
          
          {activeTab === 'sans-ref' && (
            <div className="space-y-6">
              <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
              <SANSChecklistRef />
            </div>
          )}
          {activeTab === 'admin' && (
            <div className="space-y-12">
               <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2 text-slate-500 font-black uppercase text-[10px] tracking-widest hover:text-red-600 transition-colors mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                Back to Dashboard
              </button>
               <AdminHub 
                 branding={branding} 
                 equipment={equipmentList} 
                 clients={clients} 
                 records={records} 
                 faults={faults}
                 onRetry={async () => await loadData()} 
                 onPurge={handlePurge} 
                 onExport={handleExportData} 
                 onOpenTemplateMapper={() => setShowTemplateMapper(true)}
                 onRefreshData={async () => await loadData()}
               />
            </div>
          )}
        </>
      )}

      {showTemplateMapper && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <CertificateTemplateMapper 
            onCancel={() => setShowTemplateMapper(false)}
            onTemplateMapped={async (template) => {
              await syncService.saveBranding('pfs_cert_template', JSON.stringify(template), 'both');
              setShowTemplateMapper(false);
              loadData();
            }}
          />
        </div>
      )}

      {showFullCOC && (() => {
        const clientId = typeof showFullCOC === 'string' ? showFullCOC : showFullCOC.clientId;
        const client = clients.find(c => c.id === clientId);
        if (!client) return null;
        return (
          <div className="fixed inset-0 z-[2000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
            <COCGenerator 
              client={client}
              equipment={equipmentList.filter(e => e.client_id === clientId && !e.isArchived)}
              records={records}
              onBack={() => setShowFullCOC(null)}
              branding={branding}
              technicians={techs}
              onlyCertificate={typeof showFullCOC === 'object' && showFullCOC !== null ? showFullCOC.onlyCertificate : false}
            />
          </div>
        );
      })()}

      {showLabel && <SingleAssetLabel equipment={showLabel} onClose={() => setShowLabel(null)} />}
      
      {showInspectionReport && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-auto">
          <InspectionReportGenerator 
            client={clients.find(c => c.id === showInspectionReport.clientId)!}
            equipment={equipmentList.filter(e => e.client_id === showInspectionReport.clientId)}
            records={records}
            faults={faults}
            targetDate={showInspectionReport.date}
            onBack={() => setShowInspectionReport(null)}
            branding={branding}
          />
        </div>
      )}

      {showFullTechnicalReport && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-auto">
          <ReportGenerator 
            client={clients.find(c => c.id === showFullTechnicalReport)!}
            equipment={equipmentList.filter(e => e.client_id === showFullTechnicalReport)}
            records={records}
            faults={faults}
            technicians={techs}
            activeTech={activeTech}
            onBack={() => setShowFullTechnicalReport(null)}
            branding={branding}
            selectedYear={new Date().getFullYear()}
          />
        </div>
      )}

      {showTechnicalReport && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-auto">
          <TechnicalReportGenerator 
            client={clients.find(c => c.id === showTechnicalReport)!}
            equipment={equipmentList.filter(e => e.client_id === showTechnicalReport)}
            records={records}
            technicians={techs}
            onBack={() => setShowTechnicalReport(null)}
            activeTech={activeTech}
            branding={branding}
          />
        </div>
      )}

      {showSiteAssessmentReport && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-auto">
          <SiteAssessmentReportGenerator 
            client={clients.find(c => c.id === showSiteAssessmentReport)!}
            items={siteAssessments[showSiteAssessmentReport] || []}
            equipment={equipmentList}
            records={records}
            faults={faults}
            technicians={techs}
            onBack={() => setShowSiteAssessmentReport(null)}
            activeTech={activeTech}
            branding={branding}
          />
        </div>
      )}

      {showClientPicker && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
          <ClientPicker 
            clients={clients} 
            initialSearch={unregisteredCode || ''}
            onSelect={(c) => { 
              if (isManualSearch) {
                setActiveClientSessionId(c.id);
                updateLiveSession('In Progress', c.id, 0);
                setShowScanner(true);
                setIsManualSearch(false);
              } else if (unregisteredCode) {
                const sanitizedId = (c.id && c.id !== 'null' && c.id !== 'undefined') ? c.id : null;
                setSelectedClientIdForAsset(sanitizedId);
                setShowAssetForm(true);
                if (!activeClientSessionId) {
                  setActiveClientSessionId(c.id);
                  updateLiveSession('In Progress', c.id, 0);
                }
              }
              setShowClientPicker(false); 
              loadData(); 
            }} 
            onAddClient={async (c) => { return await syncService.saveClient(c); }} 
            onCancel={() => setShowClientPicker(false)} 
            activeTech={activeTech}
          />
        </div>
      )}

      {showCondemnUnits && (
        <CondemnUnitsView 
          client={showCondemnUnits}
          equipment={equipmentList}
          records={records}
          activeTech={activeTech}
          onReplace={handleReplaceUnit}
          onClose={() => setShowCondemnUnits(null)}
          onRefresh={async () => await loadData()}
        />
      )}
      {showMoveAsset && (
        <MoveAssetModal 
          onClose={() => setShowMoveAsset(null)}
          onMove={(siteId) => handleMoveAsset(showMoveAsset.id, siteId)}
          onCreateAndMove={async (name) => {
             const newSiteId = Math.random().toString(36).substr(2, 9);
             await syncService.saveClient({
               id: newSiteId,
               name: name,
               contactPerson: 'Admin',
               email: '',
               phone: '',
               address: '',
               createdAt: new Date().toISOString()
             } as any);
             handleMoveAsset(showMoveAsset.id, newSiteId);
          }}
          clients={clients}
        />
      )}
    </Layout>
  );
};

export default App;
