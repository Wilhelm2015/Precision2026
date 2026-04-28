
import React, { useState, useMemo } from 'react';
import { calculateSiteStats } from '../src/lib/scoring';
import { Equipment, InspectionRecord, Client, Technician, FaultReport } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import IntroductionLetter from './IntroductionLetter';
import ComplianceReminderLetter from './ComplianceReminderLetter';

interface DashboardProps {
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  technicians: Technician[];
  onResolveFault: (faultId: string) => void;
  onNavigateToSite?: (clientId: string) => void;
  onAddFirstClient?: () => void;
  onNavigateToTab?: (tab: string) => void;
  onRefresh?: () => Promise<void>;
  lastUpdated?: string;
  lastFinalized?: string;
  branding?: { id: string; content: string; distribution: string }[];
}

const Dashboard: React.FC<DashboardProps> = ({ 
  clients = [], equipment = [], records = [], faults = [], technicians = [], onNavigateToSite, onAddFirstClient, onNavigateToTab, onRefresh, lastUpdated, lastFinalized, branding = []
}) => {
  const [showIntroLetter, setShowIntroLetter] = useState<Client | null>(null);
  const [showReminderLetter, setShowReminderLetter] = useState<Client | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAllDaily, setShowAllDaily] = useState(false);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => setIsRefreshing(false), 1000);
      }
    }
  };

  const siteCompliance = React.useMemo(() => {
    if (!Array.isArray(clients)) return [];
    
    const now = new Date();
    const currentDay = now.getDate();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    
    return clients.map(client => {
      const siteAssets = (Array.isArray(equipment) ? equipment : []).filter(e => e.client_id === client.id && !e.isArchived);
      if (siteAssets.length === 0) return { client, status: 'empty', daysOver: 0 };

      const siteRecords = (Array.isArray(records) ? records : []).filter(r => {
        const rid = String(r.equipmentId || r.equipment_id || r.asset_id || '').trim();
        return siteAssets.some(a => String(a.id).trim() === rid);
      });

      const hasAuditThisMonth = siteRecords.some(r => r.date >= firstOfMonth);
      
      const stats = calculateSiteStats(siteAssets, siteRecords, faults);
      const isActuallyCompliant = stats.isCompliant && hasAuditThisMonth;

      const isOverdue = client.portalAccessGranted && currentDay > 7 && !hasAuditThisMonth;
      
      let status: 'compliant' | 'overdue' | 'pending' | 'breach' = 'pending';
      if (hasAuditThisMonth) {
        status = stats.isCompliant ? 'compliant' : 'breach';
      } else if (isOverdue) {
        status = 'overdue';
      }

      return {
        client,
        status,
        daysOver: isOverdue ? currentDay - 7 : 0
      };
    });
  }, [clients, equipment, records, faults]); // CRITICAL: Added faults here

  const due30Count = React.useMemo(() => {
    const now = new Date();
    const next30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return (Array.isArray(equipment) ? equipment : []).filter(e => {
      if (e.isArchived) return false;
      const serviceDate = new Date(e.nextServiceDate);
      const ptDate = e.nextPressureTestDate ? new Date(e.nextPressureTestDate) : null;
      return serviceDate <= next30 || (ptDate && ptDate <= next30);
    }).length;
  }, [equipment]);

  const overdueCount = siteCompliance.filter(s => s.status === 'overdue' || s.status === 'breach').length;
  const compliantCount = siteCompliance.filter(s => s.status === 'compliant').length;
  const pendingCount = siteCompliance.filter(s => s.status === 'pending' || s.status === 'empty').length;
  const openFaultsCount = faults.filter(f => f.status === 'Open').length;

  const chartData = [
    { name: 'Compliant', value: compliantCount, color: '#10b981' },
    { name: 'In Breach', value: overdueCount, color: '#ef4444' },
    { name: 'Pending', value: pendingCount, color: '#f59e0b' }
  ];

  const storageUsage = useMemo(() => {
    // SANS Cloud Storage Calculation
    // Records: ~2KB per text record
    // Cloud Photos: We track the number of cloud URLs. 
    // Even though they are in Supabase Storage, we estimate their impact on your 5GB limit.
    const recordSizeKB = records.length * 2; 
    const photoCount = records.reduce((acc, r) => acc + (r.photos?.length || 0), 0);
    const photoSizeKB = photoCount * 100; // Average compressed photo is 100KB
    
    const totalKB = recordSizeKB + photoSizeKB;
    const totalMB = totalKB / 1024;
    const limitMB = 5120; // 5GB in MB
    const percent = Math.min(100, (totalMB / limitMB) * 100);

    return {
      label: totalMB > 1024 ? `${(totalMB / 1024).toFixed(2)} GB` : `${totalMB.toFixed(1)} MB`,
      percent
    };
  }, [records]);

  const liveSessions = useMemo(() => {
    const sessions = branding
      .filter(b => b.id.startsWith('session_'))
      .map(b => {
        try {
          const data = JSON.parse(b.content);
          if (data.status === 'Closed' || data.status === 'Offline') return null;

          const isSub = b.id.includes('_sub_');
          let techId = '';
          if (isSub) {
            techId = b.id.substring(8, b.id.indexOf('_sub_'));
          } else {
            techId = b.id.substring(8);
          }
          
          const tech = technicians.find(t => t.id === techId);
          const client = clients.find(c => c.id === data.clientId);
          
          let displayName = 'Unknown';
          let role = 'Technician';

          if (isSub) {
            const subId = b.id.split('_sub_')[1];
            const subUser = tech?.subUsers?.find(s => s.id === subId);
            displayName = subUser?.name || data.subUser || 'Assistant';
            role = 'Assistant';
          } else {
            displayName = tech?.name || 'Unknown Tech';
          }

          return {
            id: b.id,
            techId,
            techName: displayName,
            siteName: client?.name || data.siteName || '---',
            scannedCount: data.scannedCount || 0,
            status: data.status || 'In Progress',
            lastUpdate: data.timestamp || new Date().toISOString(),
            role,
            isSub
          };
        } catch (e) {
          return null;
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    // Group by techId and only keep the most recent session
    const latestByTech: Record<string, typeof sessions[0]> = {};
    sessions.forEach(s => {
      const existing = latestByTech[s.techId];
      if (!existing || new Date(s.lastUpdate) > new Date(existing.lastUpdate)) {
        latestByTech[s.techId] = s;
      }
    });

    return Object.values(latestByTech).sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime());
  }, [branding, technicians, clients]);

  const dailyOperations = useMemo(() => {
    const dayRecords = records.filter(r => r.date.startsWith(selectedDate));
    
    // Get unique client IDs from selected day's records, sorted by most recent
    const clientIds = Array.from(new Set(dayRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(r => {
      const asset = equipment.find(e => e.id === (r.equipmentId || r.equipment_id));
      return asset?.client_id;
    }))).filter(Boolean) as string[];

    const allOps = clientIds.map(clientId => {
      const client = clients.find(c => c.id === clientId);
      const siteAssets = equipment.filter(e => e.client_id === clientId && !e.isArchived);
      const siteRecords = records.filter(r => siteAssets.some(a => a.id === (r.equipmentId || r.equipment_id)));
      const siteFaults = faults.filter(f => siteAssets.some(a => a.id === (f.equipmentId || f.equipment_id)));

      const daySiteRecords = dayRecords.filter(r => {
        const asset = equipment.find(e => e.id === (r.equipmentId || r.equipment_id));
        return asset?.client_id === clientId;
      });

      // Stats for the day
      const uniqueAssetsScanned = new Set(daySiteRecords.map(r => r.equipmentId || r.equipment_id)).size;
      const passed = daySiteRecords.filter(r => r.status?.toLowerCase() === 'pass').length;
      const failed = daySiteRecords.filter(r => {
        const s = r.status?.toLowerCase();
        return s === 'fail' || s === 'service required' || s === 'condemned';
      }).length;
      const condemned = daySiteRecords.filter(r => r.status?.toLowerCase() === 'condemned').length;
      
      const flashFireCount = daySiteRecords.filter(r => {
        const asset = equipment.find(e => e.id === (r.equipmentId || r.equipment_id));
        const m = (asset?.manufacturer || '').toLowerCase();
        const mk = (asset?.make || '').toLowerCase();
        const mdl = (asset?.model || '').toLowerCase();
        return m.includes('flash fire') || m.includes('flashfire') || m.includes('flash-fire') || 
               mk.includes('flash fire') || mk.includes('flashfire') || mk.includes('flash-fire') || 
               mdl.includes('flash fire') || mdl.includes('flashfire') || mdl.includes('flash-fire');
      }).length;

      // Calculate score based on current status of assets using unified logic
      const stats = calculateSiteStats(siteAssets, siteRecords, faults);

      const latestRecord = dayRecords.filter(r => siteAssets.some(a => a.id === (r.equipmentId || r.equipment_id))).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      return {
        client,
        technician: latestRecord?.inspectorName || 'Unknown',
        score: stats.finalPercentage,
        scannedCount: uniqueAssetsScanned,
        passed,
        failed,
        condemned,
        flashFireCount
      };
    });

    return allOps;
  }, [records, equipment, clients, selectedDate]);

  const displayedDailyOps = showAllDaily ? dailyOperations : dailyOperations.slice(0, 5);

  const recentFaults = useMemo(() => {
    return faults
      .filter(f => f.status === 'Open')
      .slice(0, 10)
      .map(f => {
        const asset = equipment.find(e => e.id === f.equipmentId);
        const client = clients.find(c => c.id === asset?.client_id);
        return {
          ...f,
          assetSerial: asset?.serialNumber || 'Unknown',
          siteName: client?.name || 'Unknown Site'
        };
      });
  }, [faults, equipment, clients]);

  if (showIntroLetter) {
    return <IntroductionLetter client={showIntroLetter} records={records} onBack={() => setShowIntroLetter(null)} branding={branding} />;
  }

  if (showReminderLetter) {
    return <ComplianceReminderLetter client={showReminderLetter} records={records} onBack={() => setShowReminderLetter(null)} />;
  }

  return (
    <div className="space-y-3 animate-in fade-in duration-500">
      {/* V12.0 CORE STATUS BANNER */}
      <div className="bg-red-600 p-3 rounded-[2rem] text-center shadow-lg shadow-red-900/40 no-print border-4 border-red-400">
        <p className="text-[12px] font-black text-white uppercase tracking-[0.4em]">SYSTEM CORE ACTIVE</p>      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Technical Registry Dashboard</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Precision Fire Sans • Version ALPHA V12.18</p>
        </div>
        {lastUpdated && (
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Last Database Sync</p>
            <p className="text-[10px] font-bold text-emerald-600 mt-1">{new Date(lastUpdated).toLocaleTimeString()}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div 
          onClick={() => onNavigateToTab?.('compliance')} 
          className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all hover:scale-[1.02] ${overdueCount > 0 ? 'bg-red-50 border-red-100' : 'bg-emerald-50 border-emerald-100'}`}
        >
          <p className={`${overdueCount > 0 ? 'text-red-600' : 'text-emerald-600'} text-[9px] font-black uppercase tracking-widest mb-0.5`}>SANS Compliance</p>
          <h3 className={`text-xl font-black ${overdueCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {overdueCount} Site Breaches
          </h3>
        </div>
        
        <div 
          onClick={() => onNavigateToTab?.('inventory-due')} 
          className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all hover:scale-[1.02] ${due30Count > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white border-slate-100'}`}
        >
          <p className={`${due30Count > 0 ? 'text-amber-600' : 'text-slate-400'} text-[9px] font-black uppercase tracking-widest mb-0.5`}>Service Due (30d)</p>
          <h3 className="text-2xl font-black text-slate-900">{due30Count}</h3>
        </div>

        <div 
          onClick={() => onNavigateToTab?.('faults')} 
          className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all hover:scale-[1.02] ${openFaultsCount > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}
        >
          <p className={`${openFaultsCount > 0 ? 'text-red-600' : 'text-slate-400'} text-[9px] font-black uppercase tracking-widest mb-0.5`}>Active Faults</p>
          <h3 className="text-2xl font-black text-slate-900">{openFaultsCount}</h3>
        </div>

        <div 
          onClick={() => onNavigateToTab?.('inventory')} 
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50 transition-all hover:scale-[1.02]"
        >
          <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-0.5">Global Registry</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-900">{(Array.isArray(equipment) ? equipment : []).filter(e => !e.isArchived).length}</h3>
          </div>
        </div>

        <div 
          onClick={() => onNavigateToTab?.('admin')}
          className="bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-800 transition-all hover:scale-[1.02] cursor-pointer hover:bg-slate-800"
        >
          <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-0.5">Cloud Storage & Settings</p>
          <h3 className="text-xl font-black text-white">{storageUsage.label}</h3>
          <div className="mt-1 w-full bg-slate-800 h-1 rounded-full overflow-hidden">
             <div className="bg-red-500 h-full transition-all duration-1000" style={{ width: `${storageUsage.percent}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Daily Operations</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  {showAllDaily ? `All activity for ${selectedDate}` : `Last 5 sites scanned on ${selectedDate}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setShowAllDaily(false);
                  }}
                  className="text-[9px] font-black text-slate-600 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 outline-none focus:border-red-500"
                />
                {dailyOperations.length > 5 && (
                  <button 
                    onClick={() => setShowAllDaily(!showAllDaily)}
                    className="text-[9px] font-black text-red-600 uppercase tracking-widest hover:underline"
                  >
                    {showAllDaily ? 'Show Less' : 'View All'}
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Site</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tech</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Breakdown</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {displayedDailyOps.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-300 font-black uppercase tracking-widest text-[9px]">
                        No activity on this date
                      </td>
                    </tr>
                  ) : (
                    displayedDailyOps.map((site, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => site.client && onNavigateToSite?.(site.client.id)}>
                        <td className="px-4 py-1.5">
                          <span className="font-black text-slate-900 uppercase text-[10px] line-clamp-1">{site.client?.name || 'Unknown'}</span>
                        </td>
                        <td className="px-4 py-1.5">
                          <span className="font-bold text-slate-600 uppercase text-[9px]">{site.technician}</span>
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex flex-col items-center">
                              <span className="text-emerald-600 font-black text-[10px] leading-none">{site.passed}</span>
                              <span className="text-[6px] font-bold text-slate-400 uppercase">Pass</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-amber-600 font-black text-[10px] leading-none">{site.failed}</span>
                              <span className="text-[6px] font-bold text-slate-400 uppercase">Fail</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-red-600 font-black text-[10px] leading-none">{site.condemned}</span>
                              <span className="text-[6px] font-bold text-slate-400 uppercase">Cond</span>
                            </div>
                            {site.flashFireCount > 0 && (
                              <div className="flex flex-col items-center bg-red-50 px-1 rounded border border-red-100">
                                <span className="text-red-700 font-black text-[10px] leading-none">{site.flashFireCount}</span>
                                <span className="text-[5px] font-black text-red-600 uppercase">Flash Fire</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <span className={`font-black text-[10px] ${site.score >= 90 ? 'text-emerald-600' : site.score >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                            {site.score}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Live Activity</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Real-time field tracking</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Live</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Tech</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Site</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Qty</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {liveSessions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-300 font-black uppercase tracking-widest text-[9px]">
                        No active sessions
                      </td>
                    </tr>
                  ) : (
                    liveSessions.slice(0, 5).map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[9px] ${session.role === 'Assistant' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}>
                              {session.techName.charAt(0)}
                            </div>
                            <span className="font-black text-slate-900 uppercase text-[10px] line-clamp-1">{session.techName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-1.5">
                          <span className="font-bold text-slate-600 uppercase text-[9px] line-clamp-1">{session.siteName}</span>
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <span className="bg-slate-100 px-2 py-0.5 rounded-full font-black text-slate-900 text-[10px]">{session.scannedCount}</span>
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            {session.lastUpdate ? new Date(session.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '---'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Recent Faults</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Latest reported issues</p>
              </div>
              <button 
                onClick={() => onNavigateToTab?.('faults')}
                className="text-[9px] font-black text-red-600 uppercase tracking-widest hover:underline"
              >
                View All
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Asset</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Site</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-4 py-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recentFaults.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-slate-300 font-black uppercase tracking-widest text-[9px]">
                        No recent faults
                      </td>
                    </tr>
                  ) : (
                    recentFaults.slice(0, 5).map((fault) => (
                      <tr key={fault.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-1.5">
                          <span className="font-black text-slate-900 uppercase text-[10px]">{fault.assetSerial}</span>
                        </td>
                        <td className="px-4 py-1.5">
                          <span className="font-bold text-slate-600 uppercase text-[9px] line-clamp-1">{fault.siteName}</span>
                        </td>
                        <td className="px-4 py-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                            fault.status === 'Open' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {fault.status}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">
                            {fault.timestamp ? new Date(fault.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '---'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4">
            <div className="flex justify-between items-center mb-2 border-b border-slate-100 pb-1">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Fleet Analytics</h3>                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Compliance Overview
                </p>
              </div>
              <button 
                onClick={handleRefresh}
                disabled={isRefreshing}
                className={`p-2 rounded-lg transition-all flex items-center gap-2 group ${isRefreshing ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                <svg className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <span className="text-[9px] font-black uppercase tracking-widest">{isRefreshing ? '...' : 'Sync'}</span>
              </button>
            </div>

            <div className="space-y-3">
              <div className="h-[140px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={chartData}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 8, fontWeight: 'bold'}} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 8}} />
                     <Tooltip 
                      cursor={{fill: '#f8fafc'}}
                      contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 5px 15px rgba(0,0,0,0.05)', padding: '0.5rem'}}
                     />
                     <Bar dataKey="value" radius={[5, 5, 0, 0]} barSize={40}>
                       {chartData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t pt-3">
                 <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Health</p>
                    <p className="text-lg font-black text-emerald-600">{(Array.isArray(clients) && clients.length > 0) ? Math.round((compliantCount / clients.length) * 100) : 0}%</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sync</p>
                    <p className="text-lg font-black text-blue-600">Live</p>
                 </div>
                 <div className="text-center">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SANS</p>
                    <p className="text-[10px] font-black text-slate-900 uppercase">Master</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
