import React, { useState, useMemo, useRef } from 'react';
import { Client, Equipment, EquipmentType, InspectionRecord } from '../types';
import { COMPANY_LOGO_URL, SACAS_PERMIT_NUMBER } from '../constants';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRScanner from './QRScanner';

interface BookInPortalProps {
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  onAddClient: (client: Client) => Promise<void>;
  onAddEquipment: (eq: Equipment) => Promise<void>;
  onClose: () => void;
}

const ReportLogo = ({ type, className }: { type: 'company' | 'saqcc' | 'sacas', className?: string }) => {
  const [src, setSrc] = React.useState<string | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    const keys = { company: 'pfs_custom_logo', saqcc: 'pfs_custom_saqcc', sacas: 'pfs_custom_sacas' };
    const dist = localStorage.getItem(`pfs_dist_${type}`) || 'both';
    const canShow = dist === 'audit' || dist === 'both';
    const stored = localStorage.getItem(keys[type]);
    if (canShow) {
      if (stored) { setSrc(stored); setIsVisible(true); }
      else if (type === 'company') { setSrc(COMPANY_LOGO_URL); setIsVisible(true); }
      else { setIsVisible(false); }
    } else { setIsVisible(false); }
  }, [type]);

  if (!isVisible) return null;
  const isDataUrl = src?.startsWith('data:');
  return <img src={src!} className={`${className} object-contain`} alt={`${type} logo`} crossOrigin={isDataUrl ? undefined : "anonymous"} referrerPolicy="no-referrer" />;
};

const CompanyFooter = () => (
  <div className="w-full pt-2 border-t flex justify-between items-end shrink-0">
    <div className="space-y-0.5 text-left">
      <p className="text-[9px] font-black text-slate-900 uppercase leading-none">Precision Fire Services (Pty) Ltd</p>
      <p className="text-[7px] font-bold text-slate-500 uppercase">739 Corlett Avenue, Groblerpark, Roodepoort, 1724</p>
      <p className="text-[7px] font-black text-red-600 uppercase tracking-widest">Office: 010 035 5246 • Emergency: 078 173 7245</p>
    </div>
    <div className="text-right">
      <p className="text-[7px] font-black text-slate-300 uppercase tracking-[0.4em]">Digital SANS Registry Node</p>
    </div>
  </div>
);

const BookInPortal: React.FC<BookInPortalProps> = ({ clients, equipment, records, onAddClient, onAddEquipment, onClose }) => {
  const [pin, setPin] = useState('');
  
  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [step, setStep] = useState<'scan' | 'site' | 'confirm'>('scan');
  const [qrCode, setQrCode] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [bookedInItems, setBookedInItems] = useState<{qr: string, client: string, date: string}[]>([]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1990') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid PIN');
      setPin('');
    }
  };

  const handleBookIn = async () => {
    if (!qrCode || !selectedClient) return;

    try {
      const newEq: Equipment = {
        id: Math.random().toString(36).substr(2, 9),
        client_id: selectedClient.id,
        qrCode: qrCode,
        serialNumber: qrCode, 
        type: EquipmentType.EXTINGUISHER, 
        manufacturer: 'Booked In',
        size: 'Pending',
        location: 'Workshop / Booked In',
        lastInspectionDate: new Date().toISOString(),
        nextServiceDate: new Date().toISOString(),
        isArchived: false
      };

      await onAddEquipment(newEq);
      setBookedInItems(prev => [...prev, { 
        qr: qrCode, 
        client: selectedClient.name, 
        date: new Date().toLocaleString()
      }]);
      
      setQrCode('');
      setStep('scan');
      setIsScannerOpen(true);
    } catch (error) {
      console.error("Book in failed:", error);
      alert("Failed to book in unit. Please check connection.");
    }
  };

  const generateReport = async () => {
    if (!reportRef.current) return;
    setIsGeneratingReport(true);
    
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: 1200
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4', false);
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`BookIn_Report_${new Date().getTime()}.pdf`);
    } catch (error) {
      console.error("Report generation failed:", error);
      alert("Failed to generate report. Please try again.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[2000] bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl text-center">
          <img src={COMPANY_LOGO_URL} alt="Logo" className="h-12 mx-auto mb-8" />
          <h2 className="text-xl font-black uppercase tracking-widest mb-2">Book In Portal</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8 text-center">Enter PIN to Access</p>
          
          <form onSubmit={handlePinSubmit} className="space-y-6">
            <input 
              type="password" 
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="••••"
              className="w-full text-center text-4xl tracking-[1em] font-black border-b-4 border-slate-100 focus:border-red-600 outline-none pb-4"
              autoFocus
            />
            <button className="w-full bg-red-600 text-white font-black py-5 rounded-2xl uppercase tracking-[0.2em] text-xs shadow-xl hover:bg-red-700 transition-all active:scale-95">
              Unlock Portal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <img src={COMPANY_LOGO_URL} alt="Logo" className="h-8" />
          <div className="h-8 w-px bg-slate-200" />
          <h1 className="font-black uppercase tracking-widest text-sm">Book In Portal</h1>
        </div>
        <div className="flex gap-3 items-center">
          <button 
            onClick={generateReport}
            disabled={isGeneratingReport || bookedInItems.length === 0}
            className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-black transition-all disabled:opacity-50"
          >
            {isGeneratingReport ? 'Generating...' : 'Finalize & Download'}
          </button>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-red-600 transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 md:p-12">
        <div className="max-w-2xl mx-auto">
          {step === 'scan' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="text-center">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Identify Asset</h2>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Scan QR Code or Enter Number manually</p>
                {selectedClient && (
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-full">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Active Site: {selectedClient.name}</span>
                    <button 
                      onClick={() => setSelectedClient(null)}
                      className="ml-2 text-emerald-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
              </div>

              {isScannerOpen ? (
                <div className="h-[400px] relative rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white">
                  <QRScanner 
                    onScan={(code) => {
                      setQrCode(code);
                      setIsScannerOpen(false);
                      if (selectedClient) {
                        setStep('confirm');
                      } else {
                        setStep('site');
                      }
                    }}
                    onClose={() => setIsScannerOpen(false)}
                    activeClientName={selectedClient?.name}
                  />
                </div>
              ) : (
                <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100 space-y-8 text-center">
                  <button 
                    onClick={() => setIsScannerOpen(true)}
                    className="w-full py-12 border-4 border-dashed border-slate-100 rounded-[2rem] text-slate-300 flex flex-col items-center gap-4 hover:border-red-500 hover:text-red-600 transition-all"
                  >
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                    <span className="font-black uppercase tracking-widest text-xs">Tap to Open Scanner</span>
                  </button>
                  
                  <div className="flex items-center gap-4">
                    <div className="h-px bg-slate-100 flex-1" />
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Or Manual Entry</span>
                    <div className="h-px bg-slate-100 flex-1" />
                  </div>

                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="ENTER QR CODE"
                      value={qrCode}
                      onChange={e => setQrCode(e.target.value.toUpperCase())}
                      className="w-full text-center text-4xl font-black border-b-4 border-slate-100 focus:border-red-600 outline-none pb-4 uppercase"
                      autoFocus
                    />
                  </div>

                  <button 
                    onClick={() => {
                      if (!qrCode) return;
                      if (selectedClient) {
                        setStep('confirm');
                      } else {
                        setStep('site');
                      }
                    }}
                    disabled={!qrCode}
                    className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] uppercase tracking-widest text-sm shadow-2xl hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                  >
                    {selectedClient ? 'Continue to Confirmation' : 'Continue to Site Selection'}
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'site' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <div className="text-center">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Assign to Site</h2>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Select existing or create new site</p>
              </div>

              <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200 space-y-6">
                {!isCreatingClient ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
                      {clients.map(client => (
                        <button 
                          key={client.id}
                          onClick={() => {
                            setSelectedClient(client);
                            setStep('confirm');
                          }}
                          className="w-full text-left p-5 rounded-2xl border-2 border-slate-50 hover:border-red-500 hover:bg-red-50 transition-all group"
                        >
                          <div className="font-black text-slate-900 uppercase text-sm group-hover:text-red-700">{client.name}</div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase">{client.address}</div>
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => setIsCreatingClient(true)}
                      className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-black uppercase text-[10px] tracking-widest hover:border-red-500 hover:text-red-600 transition-all"
                    >
                      + Create New Site
                    </button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <input 
                      placeholder="NEW SITE NAME"
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                      className="w-full border-2 border-slate-100 rounded-2xl px-6 py-4 outline-none focus:border-red-500 font-bold"
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={async () => {
                          if (!newClientName) return;
                          const id = Math.random().toString(36).substr(2, 9);
                          const client: Client = {
                            id,
                            name: newClientName,
                            address: 'New Site',
                            email: '',
                            cellphone: '',
                            createdAt: new Date().toISOString()
                          };
                          await onAddClient(client);
                          setSelectedClient(client);
                          setStep('confirm');
                          setIsCreatingClient(false);
                          setNewClientName('');
                        }}
                        className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest"
                      >
                        Create & Select
                      </button>
                      <button 
                        onClick={() => setIsCreatingClient(false)}
                        className="px-6 border-2 border-slate-100 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
                
                <button 
                  onClick={() => setStep('scan')}
                  className="w-full text-slate-400 font-black uppercase text-[10px] tracking-widest pt-4"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && selectedClient && (
            <div className="space-y-8 animate-in zoom-in-95 duration-300">
              <div className="text-center">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Confirm Book In</h2>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">Review details before final submission</p>
              </div>

              <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-4 border-slate-900 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">QR Code</p>
                    <p className="text-2xl font-black text-slate-900 uppercase">{qrCode}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Site</p>
                    <p className="text-2xl font-black text-slate-900 uppercase">{selectedClient.name}</p>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed">
                    By confirming, this unit will be registered to the site registry. No technical checklists will be required at this stage. The unit will be marked as "Booked In" for workshop service.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleBookIn}
                    className="w-full bg-red-600 text-white font-black py-6 rounded-[2rem] uppercase tracking-widest text-sm shadow-xl hover:bg-red-700 transition-all active:scale-95"
                  >
                    Confirm & Book In
                  </button>
                  <button 
                    onClick={() => setStep('site')}
                    className="w-full text-slate-400 font-black uppercase text-[10px] tracking-widest py-2"
                  >
                    Change Site
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      {bookedInItems.length > 0 && (
        <div className="bg-white border-t border-slate-200 p-6 no-print">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session Activity ({bookedInItems.length})</h3>
            <button 
              onClick={generateReport}
              disabled={isGeneratingReport}
              className="text-red-600 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
            >
              {isGeneratingReport ? 'Generating...' : 'Download Report'}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {bookedInItems.slice().reverse().map((item, idx) => (
              <div key={idx} className="flex-shrink-0 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-900 uppercase">{item.qr}</p>
                <p className="text-[8px] text-slate-500 font-bold uppercase truncate max-w-[120px]">{item.client}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden Report for PDF Generation */}
      <div className="fixed left-[-9999px] top-0">
        <div 
          ref={reportRef}
          className="w-[210mm] min-h-[297mm] bg-white p-12 flex flex-col font-sans text-slate-900"
        >
          {/* Header */}
          <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
            <div className="flex items-center gap-6">
              <ReportLogo type="company" className="w-16 h-16" />
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight leading-none">Precision Fire Services</h1>
                <p className="text-[9px] text-red-600 font-black uppercase tracking-[0.4em] mt-1">Workshop Book-In Log</p>
                <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-1">Permit: {SACAS_PERMIT_NUMBER}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-lg font-black text-slate-900 uppercase">Equipment Receipt</h2>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Date: {new Date(finalizedDate).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Units Received</p>
              <p className="text-2xl font-black text-slate-900">{bookedInItems.length}</p>
            </div>
            <div className="bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-[8px] font-black text-red-500 uppercase tracking-widest mb-1">Status</p>
                <p className="text-lg font-black uppercase">Workshop Inbound</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Registry ID</p>
                <p className="text-xs font-mono">#{Math.random().toString(36).substr(2, 6).toUpperCase()}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900">
                  <th className="text-left py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">QR Code</th>
                  <th className="text-left py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Client / Site</th>
                  <th className="text-right py-2 text-[9px] font-black uppercase tracking-widest text-slate-400">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {bookedInItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3 text-[10px] font-black text-slate-900 uppercase">{item.qr}</td>
                    <td className="py-3 text-[10px] font-bold text-slate-600 uppercase">{item.client}</td>
                    <td className="py-3 text-right text-[9px] font-medium text-slate-400">{item.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-auto pt-8">
            <div className="grid grid-cols-2 gap-12 mb-8">
              <div className="border-t border-slate-200 pt-4">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-8">Technician Signature</p>
                <div className="h-px bg-slate-200 w-full"></div>
              </div>
              <div className="border-t border-slate-200 pt-4">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-8">Client Acknowledgement</p>
                <div className="h-px bg-slate-200 w-full"></div>
              </div>
            </div>
            <CompanyFooter />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookInPortal;
