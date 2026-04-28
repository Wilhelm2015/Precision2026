import React, { useState, useRef } from 'react';
import { syncService, compressImage } from '../services/registryService';
import { BrandLogo } from './Brand';
import * as pdfjs from 'pdfjs-dist';

// Set worker source for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TechnicianAuthProps {
  onAuthenticated: () => void;
  onCancel: () => void;
  onNeedSetup?: () => void;
}

const TechnicianAuth: React.FC<TechnicianAuthProps> = ({ onAuthenticated, onCancel, onNeedSetup }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'creds' | 'profile' | 'signature'>('creds');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showVerificationSent, setShowVerificationSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    saqccNumber: '',
    cellphone: '',
    pin: ''
  });

  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState('');
  const [cardPhoto, setCardPhoto] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localStorage.getItem('pfs_is_starting') === 'true') {
        alert("Initializing data, please wait...");
        return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      if (authMode === 'login') {
        const { error: signInError } = await syncService.signIn(formData.email, formData.password);
        if (signInError) throw signInError;
        onAuthenticated();
      } else {
        setStep('profile');
      }
    } catch (err: any) {
      if (err.message?.includes("Email not confirmed")) {
        setError("Account activation required. Check your Gmail for a verification link.");
      } else {
        setError(err.message || "Auth failure.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeSignup = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      let signature: string | undefined = undefined;
      
      if (signatureMode === 'type' && typedSignature) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 160;
        const tctx = tempCanvas.getContext('2d');
        if (tctx) {
          tctx.fillStyle = 'white';
          tctx.fillRect(0, 0, 400, 160);
          tctx.font = 'italic 30px "Brush Script MT", cursive';
          tctx.fillStyle = '#0f172a';
          tctx.textAlign = 'center';
          tctx.fillText(typedSignature, 200, 90);
          signature = tempCanvas.toDataURL('image/jpeg', 0.3);
        }
      } else {
        const canvas = canvasRef.current;
        if (canvas) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const tctx = tempCanvas.getContext('2d');
          if (tctx) {
            tctx.fillStyle = 'white';
            tctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tctx.drawImage(canvas, 0, 0);
            signature = tempCanvas.toDataURL('image/jpeg', 0.3);
          }
        }
      }
      
      const { data, error: authErr } = await syncService.signUp(formData.email, formData.password, {
        name: formData.fullName,
        role: 'technician'
      });

      if (authErr) throw authErr;
      
      const techId = data?.user?.id || Math.random().toString(36).substr(2, 9);
      const safeEmail = formData.email.replace(/[^a-zA-Z0-9]/g, '_');
      
      let uploadedSignature = signature;
      if (signature && signature.startsWith('data:image')) {
        uploadedSignature = await syncService.uploadImage(signature, `techs/${safeEmail}/${techId}_sig_${Date.now()}.png`);
      }

      let uploadedCardPhoto = cardPhoto;
      if (cardPhoto && cardPhoto.startsWith('data:image')) {
        uploadedCardPhoto = await syncService.uploadImage(cardPhoto, `techs/${safeEmail}/${techId}_card_${Date.now()}.jpg`);
      }

      if (data?.user) {
        await syncService.saveTechnician({
          id: data.user.id,
          userid: formData.email,
          email: formData.email,
          name: formData.fullName,
          saqcc: formData.saqccNumber,
          cellphone: formData.cellphone,
          signature: uploadedSignature,
          saqccCardPhoto: uploadedCardPhoto || undefined,
          pin: formData.pin
        });
        onAuthenticated();
      } else {
        setShowVerificationSent(true);
      }
    } catch (err: any) {
      setError(err.message);
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
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Identity Verification</h2>
          <p className="text-slate-500 font-medium">A secure link was sent to <span className="text-slate-900 font-bold">{formData.email}</span>. Once verified, you can access the Field Node.</p>
          <button onClick={() => setShowVerificationSent(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold uppercase tracking-widest text-[10px]">Return to Entry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 animate-in fade-in duration-500 relative overflow-hidden">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10">
        <div className="bg-slate-900 p-10 text-white text-center border-b border-white/10 flex flex-col items-center relative">
          <button onClick={onCancel} className="absolute left-6 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-xl transition-all">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <BrandLogo className="w-12 h-12 mb-4" glow />
          <h2 className="text-3xl font-black uppercase tracking-[0.1em] leading-tight text-red-500">Field Node</h2>
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
            {authMode === 'login' ? 'Authorized Tech Entry' : 'SANS Compliance Registry'}
          </p>
        </div>

        <div className="p-10 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-black uppercase text-center">
              {error}
            </div>
          )}

          {step === 'creds' && (
            <>
              <button 
                onClick={handleGoogleAuth} 
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 py-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-sm group"
              >
                {isGoogleLoading ? (
                  <div className="w-5 h-5 border-2 border-slate-300 border-t-red-600 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.14-4.53z" fill="#EA4335"/></svg>
                )}
                <span className="text-xs font-black uppercase tracking-widest text-slate-700">Verify via Gmail</span>
              </button>

              <div className="flex items-center gap-4 py-2">
                <div className="h-px bg-slate-100 flex-1" />
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Secure Credentials</span>
                <div className="h-px bg-slate-100 flex-1" />
              </div>

              <form onSubmit={handleAuth} className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Work Email</label>
                    <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-bold text-sm" placeholder="tech@precisionfire.co.za" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Secure Password</label>
                    <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-bold text-sm" placeholder="••••••••" />
                  </div>
                </div>
                <button disabled={isSubmitting} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                  {isSubmitting ? 'Verifying...' : (authMode === 'login' ? 'Access Terminal' : 'Create Credentials')}
                </button>
                <div className="text-center">
                  <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-[10px] font-black uppercase tracking-widest text-red-600">
                    {authMode === 'login' ? 'New Registration?' : 'Back to Login'}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 'profile' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <input placeholder="Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" />
                <input placeholder="SAQCC Reg No." value={formData.saqccNumber} onChange={e => setFormData({...formData, saqccNumber: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" />
                <input placeholder="Work Cellphone" type="tel" value={formData.cellphone} onChange={e => setFormData({...formData, cellphone: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" />
                <input placeholder="Access PIN (5 Digits)" type="text" maxLength={5} value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value.replace(/\D/g, '')})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm" />
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">SAQCC Card Photo</label>
                  <div className="relative group">
                    <input 
                      type="file" 
                      accept="image/*,application/pdf" 
                      capture="environment"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.type === 'application/pdf') {
                            try {
                              const arrayBuffer = await file.arrayBuffer();
                              const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
                              const page = await pdf.getPage(1);
                              const viewport = page.getViewport({ scale: 2.0 });
                              const canvas = document.createElement('canvas');
                              const context = canvas.getContext('2d');
                              canvas.height = viewport.height;
                              canvas.width = viewport.width;
                              if (context) {
                                await page.render({ canvasContext: context, viewport, canvas }).promise;
                                
                                // Create an image from the PDF render to process it with the same cropping logic
                                const pdfImg = new Image();
                                pdfImg.onload = () => {
                                  const finalCanvas = document.createElement('canvas');
                                  const targetRatio = 1.58; // ISO/IEC 7810 ID-1 ratio
                                  finalCanvas.width = 600; 
                                  finalCanvas.height = 380;
                                  const finalCtx = finalCanvas.getContext('2d');
                                  
                                  if (finalCtx) {
                                    const imgRatio = pdfImg.width / pdfImg.height;
                                    let sx = 0, sy = 0, sw = pdfImg.width, sh = pdfImg.height;

                                    if (imgRatio > targetRatio) {
                                      sw = pdfImg.height * targetRatio;
                                      sx = (pdfImg.width - sw) / 2;
                                    } else {
                                      sh = pdfImg.width / targetRatio;
                                      sy = (pdfImg.height - sh) / 2;
                                    }

                                    finalCtx.drawImage(pdfImg, sx, sy, sw, sh, 0, 0, finalCanvas.width, finalCanvas.height);
                                    setCardPhoto(finalCanvas.toDataURL('image/jpeg', 0.4));
                                  }
                                };
                                pdfImg.src = canvas.toDataURL('image/jpeg', 0.8);
                              }
                            } catch (err) {
                              console.error("PDF error:", err);
                              setError("Failed to process PDF card.");
                            }
                          } else {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const compressed = await compressImage(reader.result as string, 600, 0.4);
                              setCardPhoto(compressed);
                            };
                            reader.readAsDataURL(file);
                          }
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className={`w-full py-4 rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-2 ${cardPhoto ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200 group-hover:border-red-300'}`}>
                      {cardPhoto ? (
                        <>
                          <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                          <span className="text-[10px] font-black text-emerald-600 uppercase">Card Captured</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-6 h-6 text-slate-400 group-hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span className="text-[10px] font-black text-slate-400 uppercase">Tap to Scan Card</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => {
                if (formData.pin.length !== 5) {
                  setError("PIN must be exactly 5 digits.");
                  return;
                }
                setStep('signature');
              }} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs">Proceed to Signature</button>
            </div>
          )}

          {step === 'signature' && (
            <div className="space-y-6">
               <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Official Signature</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSignatureMode('draw')} className={`text-[8px] font-black uppercase px-2 py-1 rounded ${signatureMode === 'draw' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>Draw</button>
                  <button type="button" onClick={() => setSignatureMode('type')} className={`text-[8px] font-black uppercase px-2 py-1 rounded ${signatureMode === 'type' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>Type</button>
                </div>
              </div>

              {signatureMode === 'type' ? (
                <div className="h-40 bg-slate-50 rounded-3xl border-2 border-slate-100 flex flex-col items-center justify-center p-4 space-y-2">
                  <input 
                    type="text" 
                    value={typedSignature} 
                    onChange={e => setTypedSignature(e.target.value)} 
                    className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 outline-none focus:border-red-500 font-bold text-center italic" 
                    placeholder="Type Name" 
                  />
                  <div className="text-2xl italic text-slate-800 font-serif" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                    {typedSignature || 'Signature Preview'}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-3xl border-2 border-slate-100 overflow-hidden h-40">
                  <canvas ref={canvasRef} width={400} height={160} className="w-full h-full cursor-crosshair" />
                </div>
              )}

              <button onClick={handleFinalizeSignup} disabled={isSubmitting} className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs shadow-xl">
                {isSubmitting ? 'Saving Profile...' : 'Complete Registration'}
              </button>
              <button onClick={() => setStep('profile')} className="w-full text-[10px] font-black uppercase text-slate-400">Back to Details</button>
            </div>
          )}
        </div>
      </div>
      <button onClick={onCancel} className="mt-8 text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] hover:text-white transition-colors">Admin Gateway</button>
    </div>
  );
};

export default TechnicianAuth;