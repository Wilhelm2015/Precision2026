
import React, { useMemo, useState } from 'react';
import { BrandLogo } from './Brand';

interface MobileDeploymentTerminalProps {
  installPrompt?: any;
  onInstallRequest: () => void;
  onForceBypass: () => void;
}

const MobileDeploymentTerminal: React.FC<MobileDeploymentTerminalProps> = ({ installPrompt, onInstallRequest, onForceBypass }) => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isChrome = /chrome|crios/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !isChrome;
  const isInApp = /fbav|fban|instagram|whatsapp|linkedinapp|threads|micromessenger/.test(userAgent);

  const getSystemStatus = () => {
    if (isInApp) return { color: 'text-red-500', label: 'Restricted App Browser', advice: 'Open in System Browser' };
    if (isIOS && !isSafari) return { color: 'text-amber-500', label: 'Unsupported iOS Browser', advice: 'Switch to Safari to Install' };
    if (!isIOS && !isChrome) return { color: 'text-amber-500', label: 'Third-Party Browser', advice: 'Use Chrome for best results' };
    return { color: 'text-emerald-500', label: 'System Ready', advice: 'Check Browser Menu' };
  };

  const status = getSystemStatus();

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(239,68,68,0.2),transparent)] pointer-events-none" />
      
      <div className="max-w-md w-full space-y-6 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="space-y-3 text-center">
          <BrandLogo className="w-16 h-16 mx-auto" glow />
          <div>
            <h1 className="text-white font-black text-xl uppercase tracking-[0.2em] leading-tight">Registry Node</h1>
            <p className="text-red-500 text-[8px] font-black uppercase tracking-[0.4em] mt-1">Deployment Terminal</p>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-xl">
          <div className="p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
               <div>
                 <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Diagnostic Check</p>
                 <h2 className={`text-xs font-black uppercase tracking-tight ${status.color}`}>{status.label}</h2>
               </div>
               <div className={`w-2 h-2 rounded-full animate-pulse ${status.color.replace('text', 'bg')}`} />
            </div>

            <div className="space-y-4">
              <h3 className="text-white font-bold text-base leading-tight">Installation Required</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                The SANS Registry must be run as a standalone app to access the technical database and scanner.
              </p>
            </div>

            <div className="space-y-3">
              {isInApp ? (
                <div className="p-5 bg-red-500/10 border-2 border-red-500/30 rounded-3xl text-left space-y-3">
                  <p className="text-red-400 text-[10px] font-black uppercase tracking-widest leading-none">Correction:</p>
                  <p className="text-white text-xs font-bold leading-tight">Tap the triple dots (⋮) or share icon and select <span className="underline text-red-500 font-black">"Open in Chrome/Safari"</span>.</p>
                </div>
              ) : isIOS && !isSafari ? (
                <div className="p-5 bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl text-left space-y-3">
                  <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest leading-none">Requirement:</p>
                  <p className="text-white text-xs font-bold leading-tight">Please open this link in <span className="text-blue-400 font-black">Safari</span> to enable the installation menu.</p>
                </div>
              ) : (
                <div className="p-6 bg-white/5 rounded-3xl border border-white/10 text-left space-y-4">
                  {isIOS ? (
                    <div className="space-y-4">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12" /></svg>
                          </div>
                          <p className="text-white text-xs font-bold uppercase tracking-tight">Tap "Share" <br/><span className="text-[8px] text-slate-500">Bottom of Safari</span></p>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center shrink-0">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                          </div>
                          <p className="text-white text-xs font-bold uppercase tracking-tight">Add to Home Screen <br/><span className="text-[8px] text-slate-500">Enables functional app</span></p>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-800 text-white rounded-xl flex flex-col items-center justify-center gap-0.5 shrink-0">
                             <div className="w-1.5 h-1.5 bg-white rounded-full" />
                             <div className="w-1.5 h-1.5 bg-white rounded-full" />
                             <div className="w-1.5 h-1.5 bg-white rounded-full" />
                          </div>
                          <p className="text-white text-xs font-bold uppercase tracking-tight">Open Browser Menu <br/><span className="text-[8px] text-slate-500">Triple dot icon</span></p>
                       </div>
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-red-600/20 text-red-500 rounded-xl flex items-center justify-center shrink-0">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </div>
                          <p className="text-white text-xs font-bold uppercase tracking-tight">Select "Install App" <br/><span className="text-[8px] text-slate-500">Converts to local registry</span></p>
                       </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {installPrompt && (
              <button 
                onClick={onInstallRequest}
                className="w-full bg-red-600 text-white font-black py-5 rounded-[2rem] shadow-2xl hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 border-b-4 border-red-800"
              >
                Install Application
              </button>
            )}
          </div>
          
          <div className="bg-slate-900 px-8 py-5 flex flex-col gap-3 border-t border-white/5">
             <div className="flex items-center justify-between">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Detection Fail-safe</p>
                <button onClick={() => window.location.reload()} className="text-[8px] font-black text-red-500 uppercase tracking-widest underline decoration-2">Re-check Status</button>
             </div>
             <button 
               onClick={onForceBypass}
               className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border border-white/5"
             >
               Already Installed? Force Launch Registry
             </button>
          </div>
        </div>

        <div className="pt-2 text-center">
           <p className="text-[7px] text-slate-700 font-black uppercase tracking-[0.5em]">Precision Fire Services • Functional Node</p>
        </div>
      </div>
    </div>
  );
};

export default MobileDeploymentTerminal;
