
import React from 'react';
import { SyncEvent } from '../types';

interface SyncMonitorProps {
  events: SyncEvent[];
  status: 'connected' | 'syncing' | 'disconnected';
}

const SyncMonitor: React.FC<SyncMonitorProps> = ({ events, status }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-slate-900 rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-10 opacity-10">
          <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/><circle cx="12" cy="12" r="3" className="animate-pulse"/></svg>
        </div>
        
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full animate-pulse ${status === 'connected' ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500">Fleet Heartbeat</span>
          </div>
          <h2 className="text-4xl font-black uppercase tracking-tight leading-none">Live Pulse</h2>
          <p className="text-slate-400 text-sm font-medium max-w-md">Real-time synchronization ledger monitoring all field activities across South African operations.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {events.length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
               <svg className="w-10 h-10 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Waiting for registry activity...</p>
          </div>
        ) : (
          events.map((event, idx) => (
            <div key={event.id} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between group hover:border-red-500/20 transition-all hover:shadow-md animate-in slide-in-from-right-4" style={{ animationDelay: `${idx * 50}ms` }}>
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                  event.type === 'INSERT' ? 'bg-emerald-50 text-emerald-600' : 
                  (event.type === 'UPDATE' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600')
                }`}>
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={
                      event.type === 'INSERT' ? 'M12 4v16m8-8H4' : 
                      (event.type === 'UPDATE' ? 'M4 4h16v16H4z' : 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7')
                    } />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                      event.type === 'INSERT' ? 'bg-emerald-600 text-white' : 
                      (event.type === 'UPDATE' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white')
                    }`}>
                      {event.type}
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{event.table}</span>
                  </div>
                  <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight leading-none group-hover:text-red-600 transition-colors">{event.details}</h4>
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                  <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cloud Sync Confirmed</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] flex items-center justify-between gap-8">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-400 shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
           </div>
           <div>
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Multi-Device Security</h4>
              <p className="text-[10px] text-slate-500 font-medium">Precision Fire uses end-to-end cloud persistence. Data is synced in real-time between tablets, phones, and the office dashboard.</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default SyncMonitor;
