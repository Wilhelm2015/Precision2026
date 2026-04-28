import React, { useState } from 'react';
import { COMPANY_LOGO_URL } from '../constants';
import { getProxiedImageUrl } from '../services/registryService';

export const BrandLogo = ({ className = "w-8 h-8", glow = false, branding = [] }: { className?: string, glow?: boolean, branding?: any[] }) => {
  const [error, setError] = useState(false);
  
  // Use cloud branding if available, fallback to localStorage
  const cloudLogo = branding.find(b => b.id === 'pfs_custom_logo')?.content;
  const customLogo = cloudLogo || localStorage.getItem('pfs_custom_logo');
  const finalLogo = customLogo ? getProxiedImageUrl(customLogo) : COMPANY_LOGO_URL;

  return (
    <div className={`relative flex items-center justify-center ${glow ? 'after:absolute after:inset-0 after:bg-red-500/20 after:blur-xl after:rounded-full' : ''}`}>
      {!error ? (
        <img 
          src={finalLogo} 
          alt="Precision Fire"
          className={`${className} relative z-10 transition-transform hover:scale-110 duration-500 object-contain`}
          onError={() => setError(true)}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={`${className} bg-slate-800 rounded-xl relative z-10 flex items-center justify-center border-2 border-red-500/30`}>
          <svg className="w-2/3 h-2/3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.99 7.99 0 0120 13a7.98 7.98 0 01-2.343 5.657z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14l2.985 3.121z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export const BrandSplash = ({ branding = [] }: { branding?: any[] }) => (
  <div className="fixed inset-0 z-[2000] bg-slate-900 flex flex-col items-center justify-center animate-in fade-in duration-700">
    <BrandLogo className="w-32 h-32 animate-in zoom-in-50 duration-1000" glow branding={branding} />
    <h2 className="mt-8 text-white font-black text-4xl uppercase tracking-[0.2em]">Precision Fire Services</h2>
    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] mt-2">SANS Compliance Registry</p>
    <p className="text-[12px] text-red-500 font-black uppercase tracking-[0.2em] mt-6">Cloud Master Node • PROJECT_FINAL_V12.18</p>
  </div>
);
