
import React, { useState } from 'react';

interface MobileAppManagerProps {
  onClose: () => void;
  installPrompt?: any;
  onInstallRequest?: () => void;
}

const MobileAppManager: React.FC<MobileAppManagerProps> = ({ onClose, installPrompt, onInstallRequest }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-500 pb-24">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
           </div>
           <div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">App Hub</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">Field Deployment</p>
           </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* INSTALLATION CONTROL */}
        <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 space-y-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-5">
             <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          </div>

          <div className="relative z-10 text-center space-y-4">
             <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto shadow-inner border border-slate-100 mb-2">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.99 7.99 0 0120 13a7.98 7.98 0 01-2.343 5.657z" /></svg>
             </div>
             <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Install Field App</h3>
             <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-[240px] mx-auto">Convert this registry into a standalone mobile application for offline field use.</p>
          </div>

          <div className="space-y-4 relative z-10">
            {installPrompt ? (
               <div className="animate-in zoom-in-95">
                  <button 
                    onClick={onInstallRequest}
                    className="w-full bg-red-600 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 border-b-4 border-red-800"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download App Now
                  </button>
                  <p className="text-[9px] text-center text-red-600 font-black uppercase mt-4 tracking-widest animate-pulse">Official SANS Node v2.5 Ready</p>
               </div>
            ) : isIOS ? (
              <div className="bg-blue-50 p-8 rounded-[2.5rem] border-2 border-blue-100 space-y-6 animate-in slide-in-from-top-4">
                <div className="flex items-center gap-4 border-b border-blue-200 pb-4">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-4h-2V7h2v5.5z"/></svg>
                   </div>
                   <h4 className="font-black text-blue-900 uppercase text-xs">iOS Instructions</h4>
                </div>
                <div className="space-y-4">
                  {[
                    { step: '1', text: 'Tap the "Share" icon in Safari' },
                    { step: '2', text: 'Select "Add to Home Screen"' },
                    { step: '3', text: 'Click "Add" to finalize' }
                  ].map(s => (
                    <div key={s.step} className="flex gap-4 items-center">
                       <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-[10px]">{s.step}</div>
                       <p className="text-xs font-bold text-blue-800">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 text-center space-y-3">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                  Use Chrome / Edge Menu (⋮)<br/>& select <strong className="text-slate-900 underline">"Install App"</strong>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* TECHNICAL DETAILS */}
        <div className="flex flex-col gap-6">
           <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl space-y-6 flex-1">
              <h3 className="text-lg font-black uppercase tracking-tight border-b border-white/10 pb-4">Feature Set</h3>
              <div className="space-y-4">
                 {[
                   { icon: '🛡️', title: 'Offline Vault', desc: 'Registry works without 4G' },
                   { icon: '📷', title: 'Native Camera', desc: 'Hardware-level QR scanning' },
                   { icon: '🚀', title: 'Instant Launch', desc: 'No browser tabs or URL bars' }
                 ].map((f, i) => (
                   <div key={i} className="flex gap-4 items-center">
                      <div className="text-2xl">{f.icon}</div>
                      <div>
                         <p className="text-xs font-black uppercase tracking-widest">{f.title}</p>
                         <p className="text-[10px] text-slate-400 font-medium">{f.desc}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-lg">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Fleet Deployment Link</p>
              <div className="flex gap-2">
                 <input readOnly value={window.location.origin} className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-500 overflow-hidden text-ellipsis" />
                 <button 
                  onClick={handleCopyLink}
                  className={`px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${copied ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'}`}
                 >
                   {copied ? 'Copied' : 'Copy'}
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default MobileAppManager;
