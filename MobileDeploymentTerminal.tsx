import React, { useState, useEffect } from 'react';
import { checkRegistryConnection, ConnectionStatus } from '../services/connectionService';
import { BrandLogo } from './Brand'; // Force re-read

interface NodeHealthModalProps {
  onClose: () => void;
}

const NodeHealthModal: React.FC<NodeHealthModalProps> = ({ onClose }) => {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const runDiagnostic = async () => {
    setIsRefreshing(true);
    const result = await checkRegistryConnection();
    setStatus(result);
    setIsRefreshing(false);
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20 flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-10 text-white relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <BrandLogo className="w-24 h-24" glow />
          </div>
          <div className="relative z-10">
             <h2 className="text-2xl font-black uppercase tracking-tight leading-none">Cloud Pulse</h2>
             <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em] mt-3">Supabase Diagnostic Terminal</p>
          </div>
        </div>

        <div className="p-10 space-y-8 bg-slate-50 overflow-y-auto scrollbar-hide flex-1">
           {status ? (
             <div className="space-y-6">
                <div className={`p-6 rounded-[2.5rem] border-2 transition-all shadow-inner ${status.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                   <div className="flex items-center gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${status.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                         <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={status.ok ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
                         </svg>
                      </div>
                      <div>
                         <h4 className="font-black text-slate-900 uppercase tracking-tight">{status.message}</h4>
                         <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{(status.latencyMs || 0) > 0 ? `Cloud Latency: ${status.latencyMs}ms` : 'Verifying Link...'}</p>
                      </div>
                   </div>
                   <p className="text-[11px] font-medium text-slate-600 leading-relaxed bg-white/40 p-4 rounded-2xl border border-black/5">
                      {status.details}
                   </p>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                      <span>Table Schemas</span>
                      <span className="text-emerald-500">Live Check</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      {Object.entries(status.tables).map(([name, exists]) => (
                        <div key={name} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                           <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight truncate">{name}</span>
                           <div className={`w-2 h-2 rounded-full ${exists ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
                        </div>
                      ))}
                   </div>
                </div>

                <div className="space-y-4">
                   <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
                      <span>Telemetry Data</span>
                   </div>
                   <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Instance Host</p>
                         <p className="text-[10px] font-black text-slate-900 truncate">{status.attemptedUrl?.replace('https://', '')}</p>
                      </div>
                      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                         <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Handshake Status</p>
                         <p className="text-[10px] font-black text-slate-900">{status.ok ? 'Authenticated' : 'Failed'}</p>
                      </div>
                   </div>
                </div>
             </div>
           ) : (
             <div className="py-20 flex flex-col items-center justify-center space-y-6">
                <div className="relative">
                   <div className="w-16 h-16 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin" />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                   </div>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Polling Supabase Cluster...</p>
             </div>
           )}
        </div>

        <div className="p-10 bg-white border-t border-slate-100 shrink-0 flex flex-col gap-3">
            <button 
              onClick={runDiagnostic}
              disabled={isRefreshing}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl hover:bg-black active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isRefreshing ? 'Running Check...' : 'Re-verify Node Pulse'}
            </button>
            <button 
              onClick={onClose}
              className="w-full py-4 text-slate-400 font-black text-[10px] uppercase tracking-[0.4em] hover:text-slate-900 transition-colors"
            >
              Dismiss Terminal
            </button>
        </div>
      </div>
    </div>
  );
};

export default NodeHealthModal;