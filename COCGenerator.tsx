import React, { useState, useMemo, useEffect } from 'react';
import { Client, Equipment, InspectionRecord, Technician } from '../types';
import { syncService } from '../services/registryService';
import WelcomePackGenerator from './WelcomePackGenerator';
import IntroductionLetter from './IntroductionLetter';
import SLAGenerator from './SLAGenerator';
import ComplianceReminderLetter from './ComplianceReminderLetter';

interface ClientManagerProps {
  clients: Client[];
  equipment?: Equipment[];
  records?: InspectionRecord[];
  onAddClient: (client: Client) => void;
  onUpdateClient?: (client: Client) => void;
  onDeleteClient?: (clientId: string) => void;
  onMergeSites?: (clientIds: string[]) => void;
  onViewAssets: (clientId: string) => void;
  onGenerateReport: (clientId: string) => void;
  activeClientId: string | null;
  isManager?: boolean;
  activeTech?: Technician | null;
}

const ClientManager: React.FC<ClientManagerProps> = ({ 
  clients, 
  equipment = [],
  records = [],
  onAddClient,
  onUpdateClient,
  onDeleteClient,
  onMergeSites,
  onViewAssets, 
  onGenerateReport, 
  activeClientId, 
  isManager = false,
  activeTech = null
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [showWelcomePack, setShowWelcomePack] = useState<Client | null>(null);
  const [showIntroLetter, setShowIntroLetter] = useState<Client | null>(null);
  const [showSLA, setShowSLA] = useState<Client | null>(null);
  const [showReminder, setShowReminder] = useState<Client | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    building: '',
    address: '',
    slaAmount: '0.00',
    technicianId: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, name: string } | null>(null);
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([]);

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    let result = clients;
    if (term) {
      result = clients.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.address.toLowerCase().includes(term) ||
        (c.building || '').toLowerCase().includes(term)
      );
    }
    return result.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [clients, searchTerm]);

  useEffect(() => {
    if (editingClient) {
      setFormData({
        name: editingClient.name,
        building: editingClient.building || '',
        address: editingClient.address,
        slaAmount: editingClient.slaAmount || '0.00',
        technicianId: editingClient.technicianId || ''
      });
      setShowForm(true);
    }
  }, [editingClient]);

  const getComplianceWindowStatus = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    const now = new Date();
    const currentDay = now.getDate();
    const siteAssets = equipment.filter(e => e.client_id === clientId && !e.isArchived);
    if (siteAssets.length === 0) return { isOverdue: false, daysOver: 0 };

    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const hasAuditThisMonth = records.some(r => 
      siteAssets.some(a => a.id === r.equipmentId) && 
      r.date >= firstOfMonth
    );

    const isOverdue = client?.portalAccessGranted && currentDay > 7 && !hasAuditThisMonth;
    return { 
      isOverdue, 
      daysOver: isOverdue ? currentDay - 7 : 0 
    };
  };

  const handleToggleSubscription = async (client: Client) => {
    if (isSyncing) return;
    setIsSyncing(true);
    console.log("[SUBSCRIPTION] Toggling status for:", client.name);
    
    // Ensure we have a boolean value even if null from DB
    const currentSub = !!client.portalAccessGranted;
    const isNowSubscribed = !currentSub;
    const generatedPin = client.portalPin || Math.floor(100000 + Math.random() * 900000).toString();

    const updatedClient = {
      ...client,
      portalAccessGranted: isNowSubscribed,
      portalPaused: !isNowSubscribed, // Pause when unsubscribing, unpause when subscribing
      portalPin: generatedPin
    };

    try {
      if (onUpdateClient) {
        await onUpdateClient(updatedClient);
        console.log("[SUBSCRIPTION] Status update SUCCESS");
      }
    } catch (err) {
      console.error("[SUBSCRIPTION] Update FAILED:", err);
      alert("Subscription update failed: " + (err as any).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTogglePause = async (client: Client) => {
    if (isSyncing || !client.portalAccessGranted) return;
    setIsSyncing(true);
    console.log("[PAUSE] Toggling pause for:", client.name);
    
    const updatedClient = {
      ...client,
      portalPaused: !client.portalPaused
    };

    try {
      if (onUpdateClient) {
        await onUpdateClient(updatedClient);
        console.log("[PAUSE] Status update SUCCESS");
      }
    } catch (err) {
      console.error("[PAUSE] Update FAILED:", err);
      alert("Status update failed: " + (err as any).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSyncing) return;
    
    setIsSyncing(true);
    try {
      if (editingClient) {
        const { accountNumber, ...rest } = editingClient as any;
        const updated: Client = {
          ...rest,
          name: formData.name.trim(),
          building: formData.building.trim(),
          address: formData.address.trim(),
          slaAmount: formData.slaAmount,
          technicianId: activeTech?.role === 'admin' ? (formData.technicianId || editingClient.technicianId || activeTech?.id) : (editingClient.technicianId || activeTech?.id)
        };
        await onUpdateClient?.(updated);
      } else {
        const clientToSave: Client = {
          id: Math.random().toString(36).substr(2, 9).toUpperCase(),
          name: formData.name.trim(),
          building: formData.building.trim(),
          address: formData.address.trim(),
          createdAt: new Date().toISOString(),
          portalAccessGranted: false,
          portalPaused: true,
          portalPin: '',
          slaAmount: formData.slaAmount,
          technicianId: formData.technicianId.trim() || activeTech?.id
        };
        await onAddClient(clientToSave);
      }
      setShowForm(false);
      setEditingClient(null);
      setFormData({ name: '', building: '', address: '', slaAmount: '0.00', technicianId: '' });
    } catch (err) {
      alert("Could not update registry: " + (err as any).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleEditClick = (client: Client) => {
    setEditingClient(client);
  };

  const handleDeleteClick = (clientId: string, clientName: string) => {
    setConfirmDelete({ id: clientId, name: clientName });
  };

  const executeDelete = () => {
    if (confirmDelete) {
      onDeleteClient?.(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  if (showWelcomePack) return <WelcomePackGenerator client={showWelcomePack} records={records} onBack={() => setShowWelcomePack(null)} />;
  if (showIntroLetter) return <IntroductionLetter client={showIntroLetter} records={records} onBack={() => setShowIntroLetter(null)} />;
  if (showSLA) return <SLAGenerator client={showSLA} records={records} onBack={() => setShowSLA(null)} />;
  if (showReminder) return <ComplianceReminderLetter client={showReminder} records={records} onBack={() => setShowReminder(null)} />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Site Registry</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Managing property compliance cycles.</p>
        </div>
        <button onClick={() => { setEditingClient(null); setFormData({ name: '', building: '', address: '', slaAmount: '0.00', technicianId: '' }); setShowForm(true); }} className="bg-slate-900 text-white font-black px-6 py-3 rounded-2xl hover:bg-black shadow-lg flex items-center gap-2 uppercase tracking-widest text-[10px]">
          Register Property
        </button>
        {isManager && (
          <div className="flex gap-2">
            <button onClick={() => { setIsMergeMode(!isMergeMode); setSelectedForMerge([]); }} className={`font-black px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 uppercase tracking-widest text-[10px] ${isMergeMode ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {isMergeMode ? 'Cancel Merge' : 'Merge Sites'}
            </button>
            {isMergeMode && selectedForMerge.length >= 2 && (
              <button onClick={() => { onMergeSites?.(selectedForMerge); setIsMergeMode(false); setSelectedForMerge([]); }} className="bg-emerald-600 text-white font-black px-6 py-3 rounded-2xl shadow-lg flex items-center gap-2 uppercase tracking-widest text-[10px] hover:bg-emerald-700">
                Merge {selectedForMerge.length} Sites
              </button>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder="Search Site Name or Address..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          className="w-full bg-white border-2 border-slate-100 rounded-2xl px-12 py-4 outline-none focus:border-red-500 transition-all font-bold text-sm shadow-sm"
        />
        <svg className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>

      {showForm && (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in slide-in-from-top-4">
          <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center">
            <h3 className="font-bold uppercase tracking-widest text-xs">{editingClient ? 'Edit Property' : 'Property Enrollment'}</h3>
            <button onClick={() => { setShowForm(false); setEditingClient(null); }} className="text-white/40 hover:text-white text-xl">&times;</button>
          </div>
          <form onSubmit={handleSubmit} className="p-8 space-y-4">
            <input required placeholder="Client / Site Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl px-5 py-4 font-bold text-sm" />
            <textarea required placeholder="Physical Site Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl px-5 py-4 h-24 font-bold text-sm resize-none" />

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Building/Unit Ref</label>
                <input placeholder="Optional" value={formData.building} onChange={e => setFormData({...formData, building: e.target.value})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl px-5 py-3 font-bold text-sm" />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Subscription SLA (R)</label>
                <input type="number" step="0.01" value={formData.slaAmount} onChange={e => setFormData({...formData, slaAmount: e.target.value})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl px-5 py-3 font-bold text-sm" />
              </div>
            </div>
            {isManager && (
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase mb-1 ml-1">Technician ID</label>
                <input placeholder="Technician ID" value={formData.technicianId} onChange={e => setFormData({...formData, technicianId: e.target.value})} className="w-full border-2 border-slate-100 bg-slate-50 rounded-2xl px-5 py-3 font-bold text-sm" />
              </div>
            )}
            <button type="submit" disabled={isSyncing} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl uppercase tracking-widest text-xs disabled:opacity-50">
              {isSyncing ? 'Syncing...' : 'Save to Registry'}
            </button>
          </form>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 px-8 py-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Critical Action</h3>
              <p className="text-red-100 text-[10px] font-bold uppercase tracking-widest mt-1">Permanent Data Removal</p>
            </div>
            <div className="p-8 text-center">
              <p className="text-slate-600 font-bold text-sm leading-relaxed">
                Are you sure you want to permanently delete <span className="text-slate-900 font-black">"{confirmDelete.name}"</span>? 
                This will orphan all associated equipment, records, and reports.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-8">
                <button 
                  onClick={() => setConfirmDelete(null)}
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

      <div className="grid grid-cols-1 gap-4">
        {filteredClients.map(client => {
          const windowStatus = getComplianceWindowStatus(client.id);
          const isSubscribed = client.portalAccessGranted;
          const isPaused = client.portalPaused;
          const isSelected = selectedForMerge.includes(client.id);

          return (
            <div key={client.id} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-md ${isSubscribed ? 'border-emerald-100' : 'border-slate-100'} ${isMergeMode && isSelected ? 'border-amber-500 ring-2 ring-amber-200' : ''}`}>
              {isMergeMode && (
                <input 
                  type="checkbox" 
                  checked={isSelected} 
                  onChange={() => {
                    if (isSelected) {
                      setSelectedForMerge(selectedForMerge.filter(id => id !== client.id));
                    } else {
                      setSelectedForMerge([...selectedForMerge, client.id]);
                    }
                  }}
                  className="w-6 h-6 rounded-lg border-2 border-slate-300 text-amber-600 focus:ring-amber-500"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight truncate">{client.name}</h3>
                   <div className="flex gap-1.5">
                     {windowStatus.isOverdue && (
                       <div className="bg-red-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded uppercase animate-pulse">Window Breached</div>
                     )}
                     <div className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${isSubscribed ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                        {isSubscribed ? 'Subscribed' : 'No Active Sub'}
                     </div>
                     {isSubscribed && isPaused && (
                        <div className="bg-amber-100 text-amber-700 text-[7px] font-black px-1.5 py-0.5 rounded uppercase">Access Paused</div>
                     )}
                   </div>
                </div>
                <div className="flex items-center gap-3 mt-1">
                   <p className="text-[10px] font-bold text-slate-400 uppercase truncate tracking-widest">{client.address}</p>
                   {isSubscribed && client.portalPin && (
                     <div className="bg-slate-900 text-white px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest">
                       PIN: {client.portalPin}
                     </div>
                   )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isMergeMode && isManager && (
                  <>
                    <button 
                      onClick={() => handleToggleSubscription(client)} 
                      disabled={isSyncing}
                      className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all ${isSubscribed ? 'bg-white text-red-600 border-red-100 hover:bg-red-50' : 'bg-emerald-600 text-white border-emerald-700 shadow-lg shadow-emerald-200'}`}
                    >
                      {isSubscribed ? 'End Sub' : 'Activate Sub'}
                    </button>
                    
                    {isSubscribed && (
                      <button 
                        onClick={() => handleTogglePause(client)} 
                        disabled={isSyncing || !client.portalAccessGranted}
                        className={`p-3 rounded-2xl border transition-all ${isPaused ? 'bg-amber-600 text-white border-amber-700 shadow-lg shadow-amber-200' : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50'}`}
                        title={isPaused ? "Resume Site Access" : "Pause Site Access"}
                      >
                        {isPaused ? (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        )}
                      </button>
                    )}
                    <div className="h-8 w-px bg-slate-100 mx-1" />
                    <button 
                      onClick={() => handleEditClick(client)}
                      className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl border border-slate-100 transition-all"
                      title="Edit Particulars"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(client.id, client.name)}
                      className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 rounded-2xl border border-slate-100 transition-all"
                      title="Delete Client"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h7" /></svg>
                    </button>
                  </>
                )}
                {!isMergeMode && (
                  <>
                    <div className="h-8 w-px bg-slate-100 mx-1" />
                    <button onClick={() => setShowIntroLetter(client)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl border border-slate-100 transition-all" title="Introduction Letter">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </button>
                    <button onClick={() => setShowSLA(client)} className="p-3 bg-slate-50 text-slate-400 hover:text-emerald-600 rounded-2xl border border-slate-100 transition-all" title="SLA Agreement">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </button>
                    <button onClick={() => setShowWelcomePack(client)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 rounded-2xl border border-slate-100 transition-all" title="Welcome Pack">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    </button>
                    <button onClick={() => onViewAssets(client.id)} className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Registry Hub</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ClientManager;
