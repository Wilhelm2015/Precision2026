import React, { useState, useEffect } from 'react';
import { BrandLogo } from './Brand';
import { Technician } from '../types';
import { supabase } from '../supabase';

interface SecurityGateProps {
  technicians: Technician[];
  onUnlock: (role: 'manager' | 'technician' | 'client', tech?: Technician, subUser?: { id: string, name: string, signature?: string }) => void;
  onInstallRequest?: () => void;
  onBookingPortalRequest?: () => void;
  isStandalone?: boolean;
}

const SecurityGate: React.FC<SecurityGateProps> = ({ 
  technicians, 
  onUnlock, 
  onInstallRequest, 
  onBookingPortalRequest,
  isStandalone = false 
}) => {
  const [selectedRole, setSelectedRole] = useState<'manager' | 'technician' | 'client' | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const MANAGER_PIN = "200811";

  const handleCloudLogin = async () => {
    setIsLoggingIn(true);
    try {
      // Supabase Google OAuth flow
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error("Login failed:", err);
      alert("Cloud Login Failed: " + err.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleKeyPress = (num: string) => {
    const maxLength = selectedRole === 'manager' ? 6 : 5;
    if (pin.length < maxLength) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };

  useEffect(() => {
    const isManagerMode = selectedRole === 'manager';
    const isTechMode = selectedRole === 'technician';
    
    // Check if we have reached a valid PIN length for the selected role
    let shouldProcess = false;
    if (isManagerMode) {
      // Manager mode can be 6 digits (master PIN) or 5 digits (admin technician PIN)
      if (pin.length === 6) shouldProcess = true;
      if (pin.length === 5 && technicians.some(t => t.role === 'admin' && String(t.pin).trim() === pin)) shouldProcess = true;
    } else if (isTechMode && pin.length === 5) {
      shouldProcess = true;
    }

    if (shouldProcess) {
      setIsProcessing(true);
      
      setTimeout(() => {
        if (isManagerMode) {
          if (pin === MANAGER_PIN) {
            onUnlock('manager', { id: 'master_admin', userid: 'master_admin', name: 'Precision Management', saqcc: 'ADMIN-001', email: 'admin@precisionfire.co.za', pin: MANAGER_PIN, role: 'admin' });
          } else {
            // Check if it's an admin technician's PIN
            const adminTech = technicians.find(t => t.role === 'admin' && String(t.pin).trim() === pin.trim());
            if (adminTech) {
              onUnlock('manager', adminTech);
            } else {
              handleError();
            }
          }
        } else if (isTechMode) {
          // Robust technician PIN verification
          const normalizedPin = pin.trim();
          
          // Check main technicians
          const tech = technicians.find(t => String(t.pin).trim() === normalizedPin);
          if (tech) {
            onUnlock('technician', tech);
          } else {
            // Check sub-users
            let foundParent: Technician | null = null;
            let foundSub: { id: string, name: string, signature?: string } | null = null;
            
            for (const t of technicians) {
              if (t.subUsers) {
                const sub = t.subUsers.find(s => String(s.pin).trim() === normalizedPin);
                if (sub) {
                  foundParent = t;
                  foundSub = { id: sub.id, name: sub.name, signature: sub.signature };
                  break;
                }
              }
            }
            
            if (foundParent && foundSub) {
              onUnlock('technician', foundParent, foundSub);
            } else {
              handleError();
            }
          }
        }
      }, 400);
    }
  }, [pin, selectedRole, onUnlock, technicians]);

  const handleError = () => {
    setError(true);
    setPin('');
    setIsProcessing(false);
    if (navigator.vibrate) navigator.vibrate(200);
  };

  if (!selectedRole) {
    return (
      <div className="fixed inset-0 z-[3000] bg-slate-900 flex flex-col items-center justify-center p-6 font-sans overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(185,28,28,0.1),transparent)] pointer-events-none" />
        <div className="w-full max-w-lg flex flex-col items-center relative z-10">
          <div className="mb-12 text-center space-y-4">
            <BrandLogo className="w-20 h-20 mx-auto mb-8" glow />
            <h2 className="text-white font-black text-3xl uppercase tracking-[0.3em]">Precision Hub</h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.5em] opacity-60">SANS Compliance Ecosystem</p>
          </div>

          {!isStandalone && onInstallRequest && (
            <button 
              onClick={onInstallRequest}
              className="mb-10 group bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-[2rem] flex items-center gap-4 transition-all shadow-2xl shadow-red-900/40 animate-bounce"
            >
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              </div>
              <div className="text-left">
                 <p className="text-[11px] font-black uppercase tracking-widest leading-none mb-1">Install Mobile App</p>
                 <p className="text-[8px] font-bold text-red-100 uppercase tracking-widest">Recommended for field use</p>
              </div>
            </button>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
            <button onClick={() => setSelectedRole('manager')} className="group bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-red-500/50 p-6 rounded-[2.5rem] flex flex-col items-center text-center transition-all duration-500 hover:-translate-y-2 active:scale-95">
              <div className="w-12 h-12 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              </div>
              <h3 className="text-white font-black uppercase tracking-widest text-[10px] mb-1">Management</h3>
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">Oversight</p>
            </button>
            <button onClick={() => setSelectedRole('technician')} className="group bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-red-500/50 p-6 rounded-[2.5rem] flex flex-col items-center text-center transition-all duration-500 hover:-translate-y-2 active:scale-95">
              <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
              </div>
              <h3 className="text-white font-black uppercase tracking-widest text-[10px] mb-1">Technician</h3>
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">Field Ops</p>
            </button>
            <button onClick={() => onUnlock('client')} className="group bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-emerald-500/50 p-6 rounded-[2.5rem] flex flex-col items-center text-center transition-all duration-500 hover:-translate-y-2 active:scale-95">
              <div className="w-12 h-12 bg-emerald-600/10 text-emerald-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
              </div>
              <h3 className="text-white font-black uppercase tracking-widest text-[10px] mb-1">Site Portal</h3>
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">Client View</p>
            </button>
            <button onClick={() => onBookingPortalRequest?.()} className="group bg-slate-800/40 hover:bg-slate-800 border border-white/5 hover:border-amber-500/50 p-6 rounded-[2.5rem] flex flex-col items-center text-center transition-all duration-500 hover:-translate-y-2 active:scale-95">
              <div className="w-12 h-12 bg-amber-600/10 text-amber-500 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </div>
              <h3 className="text-white font-black uppercase tracking-widest text-[10px] mb-1">Booking Portal</h3>
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">Office Use</p>
            </button>
          </div>
          <div className="mt-16 flex flex-col items-center text-center gap-4">
            <button 
              onClick={handleCloudLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-3 px-6 py-3 bg-slate-800/50 hover:bg-slate-800 border border-white/10 rounded-2xl transition-all group"
            >
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-2.21 5.4-7.84 5.4-4.84 0-8.75-4.01-8.75-8.96s3.91-8.96 8.75-8.96c2.75 0 4.59 1.15 5.64 2.16l2.59-2.5c-1.66-1.55-3.82-2.5-8.23-2.5C5.38 1.16 0 6.54 0 13.16s5.38 12 12.48 12c7.41 0 12.33-5.21 12.33-12.56 0-.85-.09-1.5-.21-2.14l-12.12-.04z"/>
                </svg>
              </div>
              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                {isLoggingIn ? 'Authenticating...' : 'Admin Cloud Login'}
              </span>
            </button>
            <div className="flex flex-col items-center gap-1">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Contact: 078 173 7245</p>
              <p className="text-[8px] text-slate-600 font-black uppercase tracking-[0.5em]">Precision Fire Services • PTY LTD</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const maxLength = selectedRole === 'manager' ? 6 : 5;

  return (
    <div className="fixed inset-0 z-[3000] bg-slate-900 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-12 text-center space-y-2">
          <BrandLogo className="w-16 h-16 mx-auto mb-6" glow />
          <h2 className="text-white font-black text-2xl uppercase tracking-[0.2em]">
            {selectedRole === 'manager' ? 'Admin Gateway' : 'Field Terminal'}
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
            Enter {maxLength}-Digit Access Code
          </p>
        </div>
        <div className="flex gap-4 mb-12">
          {Array.from({ length: Math.max(pin.length, selectedRole === 'manager' ? 6 : 5) }).map((_, idx) => (
            <div key={idx} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${error ? 'bg-red-500 border-red-500 animate-bounce' : (pin.length > idx ? 'bg-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-transparent border-slate-700')}`} />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button key={num} onClick={() => handleKeyPress(num)} disabled={isProcessing} className="aspect-square bg-slate-800/50 hover:bg-slate-700 text-white text-2xl font-black rounded-2xl border border-white/5 active:scale-90 transition-all flex items-center justify-center">
              {num}
            </button>
          ))}
          <button onClick={() => { setSelectedRole(null); setPin(''); setError(false); }} disabled={isProcessing} className="aspect-square flex items-center justify-center text-slate-500 hover:text-white transition-colors text-[10px] font-black uppercase">Switch Role</button>
          <button onClick={() => handleKeyPress('0')} disabled={isProcessing} className="aspect-square bg-slate-800/50 hover:bg-slate-700 text-white text-2xl font-black rounded-2xl border border-white/5 active:scale-90 transition-all flex items-center justify-center">0</button>
          <button onClick={handleDelete} disabled={isProcessing} className="aspect-square flex items-center justify-center text-slate-500 hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" /></svg>
          </button>
        </div>
        {error && (
          <p className="text-red-500 text-[10px] font-black uppercase tracking-widest mt-8 animate-pulse">
            Access Denied. Incorrect PIN.
          </p>
        )}
        {isProcessing && !error && (
          <p className="text-emerald-500 text-[10px] font-black uppercase tracking-widest mt-8">
            Verifying Identity...
          </p>
        )}
      </div>
    </div>
  );
};

export default SecurityGate;