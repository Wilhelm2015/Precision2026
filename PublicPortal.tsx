
import React from 'react';
import { Technician } from '../types';
import { BrandLogo } from './Brand';
import { getProxiedImageUrl } from '../services/registryService';

interface PublicTechProfileProps {
  technician: Technician;
  onClose: () => void;
}

const PublicTechProfile: React.FC<PublicTechProfileProps> = ({ technician, onClose }) => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
      
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden relative z-10 animate-in zoom-in-95 duration-500">
        {/* Verification Header */}
        <div className="bg-emerald-600 p-10 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-20 rotate-12">
            <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
          </div>
          <div className="relative z-10 space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/20 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/30">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_white]" />
              <span className="text-[10px] font-black uppercase tracking-widest">Live Registry Verified</span>
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight leading-none">Technician Credentials</h2>
          </div>
        </div>

        <div className="p-10 space-y-8">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-32 h-32 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-4xl font-black text-white shadow-2xl relative border-4 border-emerald-50">
              {technician.name.charAt(0)}
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{technician.name}</h3>
              <p className="text-emerald-600 font-black uppercase tracking-[0.2em] text-[11px]">SAQCC Registered Personnel</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Registration No.</p>
                <p className="text-lg font-black text-slate-900 uppercase tracking-tighter">{technician.saqcc}</p>
              </div>
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-50">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21a3.745 3.745 0 01-3.068-1.593 3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Official Signature Auth</p>
               <div className="h-20 bg-white rounded-2xl border border-slate-200 p-2 flex items-center justify-center relative overflow-hidden">
                  {technician.signature ? (
                    <img src={getProxiedImageUrl(technician.signature)} className="max-h-full opacity-90 scale-125 mix-blend-multiply grayscale" alt="Auth Signature" crossOrigin="anonymous" referrerPolicy="no-referrer" />
                  ) : (
                    <p className="text-[9px] font-black text-slate-300 uppercase italic">Digital Authentication Only</p>
                  )}
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.02)_10px,rgba(0,0,0,0.02)_20px)] pointer-events-none" />
               </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
             <div className="flex items-center gap-4 text-center">
                <div className="h-px bg-slate-100 flex-1" />
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Employer Verification</p>
                <div className="h-px bg-slate-100 flex-1" />
             </div>
             <div className="flex flex-col items-center">
                <BrandLogo className="w-10 h-10 mb-2 grayscale opacity-40" />
                <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Precision Fire Services (Pty) Ltd</p>
                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">South African National Standards Accredited</p>
             </div>
          </div>
          
          <button 
            onClick={onClose}
            className="w-full bg-slate-900 text-white font-black py-5 rounded-[2rem] shadow-xl uppercase tracking-widest text-[10px] hover:bg-black transition-all"
          >
            Close Profile
          </button>
        </div>
      </div>

      <div className="mt-10 flex flex-col items-center text-center space-y-2 opacity-50">
        <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.5em]">Global Safety Personnel Ledger v2.5</p>
      </div>
    </div>
  );
};

export default PublicTechProfile;
