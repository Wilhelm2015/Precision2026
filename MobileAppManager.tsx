import React, { useState } from 'react';
import { syncService } from '../services/registryService';
import { BrandLogo } from './Brand';

interface ManagerAuthProps {
  onAuthenticated: () => void;
  onNeedSetup?: () => void;
  onSwitch: () => void;
}

const ManagerAuth: React.FC<ManagerAuthProps> = ({ onAuthenticated, onNeedSetup, onSwitch }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showVerificationSent, setShowVerificationSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '', 
    company: '',
    password: ''
  });

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const { error: gError } = await syncService.signInWithGoogle();
      if (gError) throw gError;
    } catch (err: any) {
      setError(err.message || "Google link failed.");
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      if (authMode === 'login') {
        const { error: signInError } = await syncService.signIn(formData.email, formData.password);
        if (signInError) throw signInError;
        onAuthenticated();
      } else {
        const { data, error: authErr } = await syncService.signUp(formData.email, formData.password, {
          company: formData.company,
          role: 'manager'
        });

        if (authErr) throw authErr;
        
        if (data?.user) {
          await syncService.saveManager({
            id: data.user.id,
            email: formData.email,
            company: formData.company
          });
          onAuthenticated();
        } else {
          setShowVerificationSent(true);
        }
      }
    } catch (err: any) {
      if (err.message?.includes("Email not confirmed")) {
        setError("Management node pending activation. Check your Gmail inbox.");
      } else {
        setError(err.message || "Registry attempt failed.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showVerificationSent) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 animate-in zoom-in-95 duration-500">
        <div className="max-w-md w-full bg-white rounded-[3rem] p-12 text-center space-y-8 shadow-2xl">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Check Your Gmail</h2>
          <p className="text-slate-500 font-medium">We've sent a secure activation link to <span className="text-slate-900 font-bold">{formData.email}</span>. Please click the link to verify your admin node.</p>
          <button onClick={() => setShowVerificationSent(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px]">Return to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100">
        <div className="bg-red-700 p-12 text-center text-white relative flex flex-col items-center">
          <BrandLogo className="w-16 h-16 mb-4" glow />
          <h1 className="text-3xl font-black uppercase tracking-[0.2em] leading-none">Admin Hub</h1>
          <p className="text-red-100 text-[10px] font-black uppercase tracking-[0.4em] mt-3 opacity-80">
            {authMode === 'login' ? 'Management Terminal' : 'Create Admin Account'}
          </p>
        </div>

        <div className="p-10 space-y-8">
          {error && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-black uppercase text-center">{error}</div>}
          
          <div className="space-y-4">
            <button 
              onClick={handleGoogleAuth} 
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm group"
            >
              {isGoogleLoading ? (
                <div className="w-5 h-5 border-2 border-slate-300 border-t-red-600 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.14-4.53z" fill="#EA4335"/></svg>
              )}
              <span className="text-xs font-black uppercase tracking-widest text-slate-700">Continue with Google</span>
            </button>

            <div className="flex items-center gap-4 py-2">
              <div className="h-px bg-slate-100 flex-1" />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Or Use Email</span>
              <div className="h-px bg-slate-100 flex-1" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Work Email</label>
                  <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 transition-all text-sm font-bold" />
                </div>
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Company Name</label>
                    <input required type="text" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 transition-all text-sm font-bold" />
                  </div>
                )}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Password</label>
                  <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 transition-all text-sm font-bold" />
                </div>
              </div>
              <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl hover:bg-black active:scale-95 transition-all uppercase tracking-widest text-xs">
                {isSubmitting ? 'Connecting...' : (authMode === 'login' ? 'Login to Admin' : 'Complete Sign Up')}
              </button>
            </form>
          </div>
          
          <div className="text-center space-y-4">
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="block w-full text-[10px] font-black uppercase tracking-widest text-red-600">
              {authMode === 'login' ? 'New Manager Node?' : 'Existing Manager Login'}
            </button>
            <button onClick={onSwitch} className="block w-full text-[10px] font-black uppercase tracking-widest text-slate-400">
              Switch to Technician Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerAuth;