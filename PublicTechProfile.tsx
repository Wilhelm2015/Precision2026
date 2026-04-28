
import React, { useState } from 'react';
import { WhatsAppMessage } from '../services/whatsappService';

interface NotificationDispatcherProps {
  dispatches: WhatsAppMessage[];
  onClear: (id: string) => void;
}

const NotificationDispatcher: React.FC<NotificationDispatcherProps> = ({ dispatches, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = dispatches.length;

  const handleManualPush = (link: string) => {
    window.open(link, '_blank');
  };

  return (
    <div className="fixed bottom-24 right-6 z-[2000] no-print">
      {/* WhatsApp FAB */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-16 h-16 bg-[#25D366] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group border-4 border-white"
        aria-label="WhatsApp Dispatch Log"
      >
        <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.634 1.437h.005c6.558 0 11.894-5.335 11.897-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        {activeCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[11px] font-black w-7 h-7 rounded-full flex items-center justify-center animate-bounce border-2 border-white shadow-lg">
            {activeCount}
          </span>
        )}
      </button>

      {/* Messaging Panel */}
      {isOpen && (
        <div className="absolute bottom-20 right-0 w-85 max-w-[90vw] bg-[#E5DDD5] rounded-[2rem] shadow-2xl border border-slate-300 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 h-[550px]">
          {/* WhatsApp Header */}
          <div className="bg-[#075E54] p-5 text-white flex items-center justify-between shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight">Precision Fire Gateway</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100">+27 68 610 1310</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {dispatches.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 space-y-3 px-10">
                <div className="w-16 h-16 bg-slate-300/30 rounded-full flex items-center justify-center">
                   <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                </div>
                <p className="text-[11px] font-black uppercase tracking-widest leading-relaxed">Awaiting Fleet Dispatch Events</p>
              </div>
            ) : (
              dispatches.map(msg => (
                <div key={msg.id} className="flex flex-col items-start animate-in slide-in-from-left-4 duration-300 max-w-[90%]">
                  <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm relative space-y-2 group">
                    <div className="flex justify-between items-center gap-4">
                       <span className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.2em]">{msg.type}</span>
                       <span className="text-[8px] text-slate-400 font-bold">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p className="text-[11px] text-slate-800 font-medium leading-relaxed">{msg.body}</p>
                    <div className="flex justify-between items-end pt-2 border-t border-slate-50 gap-4">
                       <div className="flex flex-col">
                         <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Sender: {msg.from}</span>
                         <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">To: {msg.to}</span>
                       </div>
                       <button 
                        onClick={() => handleManualPush(msg.directLink)}
                        className="bg-[#25D366] text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-[#128C7E] transition-colors shadow-sm active:scale-95"
                       >
                         <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></svg>
                         Manual Push
                       </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-4 bg-white/60 backdrop-blur-md border-t border-slate-300 shrink-0">
             <button 
              onClick={() => onClear('all')}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95"
             >
               Clear Transmission History
             </button>
             <p className="text-[8px] text-center text-slate-400 uppercase font-bold mt-3 tracking-widest">SANS 1475 Secure Protocol Node</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDispatcher;
