
import React from 'react';

interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

const InstallBanner: React.FC<InstallBannerProps> = ({ onInstall, onDismiss }) => {
  return (
    <div className="no-print bg-slate-900 border-b-4 border-red-600 px-6 py-4 flex items-center justify-between animate-in slide-in-from-top-full duration-500 shadow-2xl">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg animate-pulse shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </div>
        <div>
          <h4 className="text-white font-black uppercase text-[11px] tracking-tight leading-tight">Install Precision Fire App</h4>
          <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Faster access & offline field registry</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={onInstall}
          className="bg-white text-slate-900 px-5 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest active:scale-95 shadow-lg"
        >
          Install
        </button>
        <button onClick={onDismiss} className="p-2 text-slate-500 hover:text-white transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default InstallBanner;
