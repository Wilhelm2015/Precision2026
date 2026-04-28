import React, { useState, useEffect } from 'react';
import { COMPANY_LOGO_URL } from '../constants';
import { getProxiedImageUrl } from '../services/registryService';
import { checkRegistryConnection } from '../services/connectionService';
import NodeHealthModal from './NodeHealthModal';
import { BrandLogo } from './Brand';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewMode: 'manager' | 'technician' | 'client';
  onSwitchRole: () => void;
  onLogout: () => void;
  onScanRequest?: () => void;
  onSearchClientRequest?: () => void;
  onGlobalSearchRequest?: () => void;
  activeTech?: { name: string, saqcc: string, email: string, role?: 'admin' | 'technician' | 'manager' } | null;
  activeClientName?: string;
  scannedCount?: number;
  branding?: any[];
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, viewMode, onSwitchRole, onLogout, onScanRequest, onSearchClientRequest, onGlobalSearchRequest, activeTech, activeClientName, scannedCount, branding = [] }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [nodeStatus, setNodeStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [showHealth, setShowHealth] = useState(false);

  useEffect(() => {
    const check = async () => {
      const res = await checkRegistryConnection();
      setNodeStatus(res.ok ? 'online' : 'offline');
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', roles: ['manager', 'technician'], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" /></svg> },
    { id: 'compliance', label: 'Compliance Hub', roles: ['manager'], icon: <svg className="w-5 h-5 text-red-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'inventory', label: 'Fleet Register', roles: ['manager'], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /></svg> },
    { id: 'sites', label: 'Site Registry', roles: ['manager'], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    { id: 'performance', label: 'Performance', roles: ['manager'], icon: <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
    { id: 'qr-station', label: 'QR Station', roles: ['manager'], icon: <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg> },
    { id: 'pressure-tests', label: 'Pressure Tests', roles: ['manager'], icon: <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { id: 'recharges', label: 'Recharges', roles: ['manager'], icon: <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
    { id: 'flow', label: 'Flow Matrix', roles: ['manager'], icon: <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> },
    { id: 'technical-hub', label: 'Technical Hub', roles: ['technician'], icon: <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> },
    { id: 'detection', label: 'Detection Hub', roles: ['manager', 'technician'], icon: <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg> },
    { id: 'faults', label: 'Fault Hub', roles: ['manager', 'technician'], icon: <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.268 16c-.77 1.333.192 3 1.732 3z" /></svg> },
    { id: 'techs', label: 'Technician Fleet', roles: ['manager'], icon: <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
    { id: 'coc', label: 'Maintenance Certs', roles: ['manager', 'technician'], icon: <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg> },
    { id: 'rectify', label: 'Rectify Hub', roles: ['manager', 'technician'], icon: <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
    { id: 'reports', label: 'Reports', roles: ['manager', 'technician'], icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2" /></svg> },
    { id: 'quotes', label: 'Quote Hub', roles: ['manager', 'technician'], icon: <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { id: 'discard', label: 'Disposal Hub', roles: ['manager'], icon: <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h7" /></svg> },
    { id: 'sans-ref', label: 'SANS Matrix', roles: ['manager'], icon: <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.168.477 4.332 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
    { id: 'admin', label: 'Cloud Settings', roles: ['manager', 'technician'], icon: <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg> },
  ].filter(item => {
    if (viewMode === 'manager') return item.roles.includes('manager');
    if (viewMode === 'technician') {
      // If technician is an admin, they can see manager tabs too
      if (activeTech?.role === 'admin' || activeTech?.role === 'manager') return true;
      return item.roles.includes('technician');
    }
    return false;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {showHealth && <NodeHealthModal onClose={() => setShowHealth(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out no-print ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${(viewMode === 'manager' || viewMode === 'technician') ? 'lg:relative lg:translate-x-0' : ''}`}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-4 mb-10">
            <BrandLogo branding={branding} />
            <div>
              <h1 className="font-black uppercase tracking-widest text-sm text-white">Cloud Registry</h1>
              <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-0.5">PROJECT_FINAL_V12.18</p>
            </div>
          </div>
          
          <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-hide">
            {navItems.map((item) => (activeTab === item.id ? (
              <button key={item.id} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl bg-red-600 text-white shadow-lg shadow-red-900/20 font-bold text-[10px] uppercase tracking-widest transition-all">
                <div className="shrink-0">{item.icon}</div>
                <span className="truncate">{item.label}</span>
              </button>
            ) : (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-bold text-[10px] uppercase tracking-widest transition-all">
                <div className="shrink-0">{item.icon}</div>
                <span className="truncate">{item.label}</span>
              </button>
            )))}
          </nav>

          <div className="pt-6 border-t border-white/5 space-y-2">
            <button onClick={onSwitchRole} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 font-bold text-[10px] uppercase tracking-widest transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
              Lock Node
            </button>
            <button onClick={onLogout} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-500/10 font-bold text-[10px] uppercase tracking-widest transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3 3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Exit Node
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between z-40 shrink-0 no-print">
          <div className="flex items-center gap-2 md:gap-4">
            {(viewMode === 'manager' || viewMode === 'technician') && (
              <button onClick={() => setIsSidebarOpen(true)} className={`${viewMode === 'manager' ? 'lg:hidden' : ''} p-2 text-slate-500`}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            {activeTab !== 'dashboard' && (
              <button onClick={() => setActiveTab('dashboard')} className="p-2 text-slate-500 flex items-center gap-2 hover:text-red-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Back</span>
              </button>
            )}
            <button 
              onClick={() => setShowHealth(true)}
              className="flex items-center gap-2.5 px-3 md:px-4 py-2 rounded-full border border-slate-100 hover:bg-slate-50 transition-all group"
            >
               <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${nodeStatus === 'online' ? 'bg-emerald-500' : nodeStatus === 'offline' ? 'bg-red-500' : 'bg-slate-300 animate-pulse'}`} />
               <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-slate-900 group-hover:text-red-600 transition-colors truncate max-w-[80px] md:max-w-none">Cloud Master: {nodeStatus.toUpperCase()}</span>
               {activeTech?.role === 'admin' && (
                 <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-purple-200">Admin</span>
               )}
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {activeTech && viewMode === 'technician' && (
               <button onClick={onLogout} className="p-2 text-slate-500 hover:text-red-600 transition-colors" title="Logout">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3 3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
               </button>
            )}
            {activeClientName && (
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-slate-50 border border-slate-100 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest truncate max-w-[80px] md:max-w-[120px]">{activeClientName}</span>
              </div>
            )}
            {onGlobalSearchRequest && (
              <button onClick={onGlobalSearchRequest} className="bg-slate-900 text-white px-3 md:px-5 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <span className="hidden xs:inline">Search</span>
              </button>
            )}
            {onScanRequest && (
              <button onClick={onScanRequest} className="bg-red-600 text-white px-3 md:px-5 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-2 active:scale-95">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                <span className="hidden xs:inline">Scan</span>
              </button>
            )}
          </div>
        </header>

        <main className={`flex-1 overflow-y-auto p-4 md:p-10 bg-slate-50/50 scrollbar-hide ${viewMode === 'technician' ? 'pb-10' : 'pb-24'} lg:pb-10 print:p-0`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Mobile Navigation Bar */}
        <nav className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex items-center justify-start overflow-x-auto gap-1 z-40 no-print scrollbar-hide ${viewMode === 'client' ? 'hidden' : ''}`}>
          {navItems.map((item) => (
            <button 
              key={item.id} 
              onClick={() => {
                setActiveTab(item.id);
                setIsSidebarOpen(false);
              }}
              className={`flex flex-col items-center justify-center min-w-[72px] py-1 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'text-red-600 bg-red-50' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`${activeTab === item.id ? 'scale-110' : 'scale-100'} transition-transform`}>
                {item.icon}
              </div>
              <span className="text-[8px] font-black uppercase tracking-tighter mt-1 whitespace-nowrap">{item.label}</span>
            </button>
          ))}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center justify-center min-w-[72px] py-1 text-slate-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            <span className="text-[8px] font-black uppercase tracking-tighter mt-1">Menu</span>
          </button>
        </nav>
      </div>

      {isSidebarOpen && (
        <div onClick={() => setIsSidebarOpen(false)} className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 ${viewMode === 'manager' ? 'lg:hidden' : ''}`} />
      )}
    </div>
  );
};

export default Layout;