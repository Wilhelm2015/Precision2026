import React, { useState, useMemo, useEffect } from 'react';
import { Client, Equipment, InspectionRecord, FaultReport, EquipmentType, TaskType } from '../types';
import { GoogleGenAI } from "@google/genai";
import { syncService } from '../services/registryService';
import BulkQuoteImport from './BulkQuoteImport';

interface QuoteItem {
  id: string;
  description: string;
  size?: string;
  type: 'maintenance' | 'replacement' | 'recharge' | 'signage' | 'other';
  quantity: number;
  isNewSupply?: boolean;
}

interface QuoteTabProps {
  clients: Client[];
  equipment: Equipment[];
  records: InspectionRecord[];
  faults: FaultReport[];
  siteAssessments: Record<string, QuoteItem[]>;
  onUpdateAssessment: (clientId: string, items: QuoteItem[]) => Promise<void>;
  onDownloadReport: (clientId: string) => void;
  onAddClient: (client: Client) => Promise<void>;
}

const QuoteTab: React.FC<QuoteTabProps> = ({ 
  clients, 
  equipment, 
  records, 
  faults, 
  siteAssessments,
  onUpdateAssessment,
  onDownloadReport,
  onAddClient 
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', address: '' });
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [signageInfo, setSignageInfo] = useState<any[]>([]);
  const [quoteCatalog, setQuoteCatalog] = useState<any[]>([]);
  const [isLoadingSignage, setIsLoadingSignage] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  
  const finalizedDate = useMemo(() => {
    if (records.length === 0) return new Date().toISOString();
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return sorted[0].date;
  }, [records]);

  const [activeTab, setActiveTab] = useState<'assessment' | 'new-supply'>('assessment');

  const activeClient = useMemo(() => clients.find(c => c.id === selectedClientId), [clients, selectedClientId]);

  // Load items when client changes
  useEffect(() => {
    if (selectedClientId && siteAssessments[selectedClientId]) {
      setQuoteItems(siteAssessments[selectedClientId]);
    } else {
      setQuoteItems([]);
    }
  }, [selectedClientId, siteAssessments]);

  // Fetch signage info from Google Search via Gemini
  useEffect(() => {
    const fetchSignage = async () => {
      setIsLoadingSignage(true);
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: "List common fire safety signage types used in South Africa for fire extinguishers, hose reels, hydrants, and escape routes. Include standard sizes (e.g., 150x150, 190x190, 290x290). Format as a JSON array of objects with 'name' and 'size' properties.",
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json"
          }
        });
        
        if (response.text) {
          const data = JSON.parse(response.text);
          setSignageInfo(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Signage fetch error:", err);
        // Fallback signage
        setSignageInfo([
          { name: 'Fire Extinguisher (FB1)', size: '190x190' },
          { name: 'Fire Hose Reel (FB2)', size: '190x190' },
          { name: 'Fire Hydrant (FB3)', size: '190x190' },
          { name: 'Arrow Left (E1)', size: '190x190' },
          { name: 'Arrow Right (E2)', size: '190x190' },
          { name: 'Running Man Left (E3)', size: '190x190' },
          { name: 'Running Man Right (E4)', size: '190x190' },
        ]);
      } finally {
        setIsLoadingSignage(false);
      }
    };
    fetchSignage();

    // Fetch Quote Catalog
    syncService.fetchQuoteCatalog().then(setQuoteCatalog);
  }, []);

  // Filtered equipment list for search
  const searchResults = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    
    // Combine standard equipment types and signage for search
    const allOptions = [
      ...Object.values(EquipmentType).map(t => ({ name: t, type: 'maintenance' as const, size: '' })),
      ...signageInfo.map(s => ({ name: s.name, type: 'signage' as const, size: s.size })),
      ...quoteCatalog.map(item => ({ name: item.name, type: item.type as any, size: item.size })),
      { name: 'Fire Extinguisher Cabinet', type: 'other' as const, size: '4.5kg' },
      { name: 'Fire Extinguisher Cabinet', type: 'other' as const, size: '9kg' },
      { name: 'Hose Reel Cabinet', type: 'other' as const, size: 'Standard' },
      { name: 'Lay Flat Hose', type: 'other' as const, size: '30m' },
      { name: 'Lay Flat Hose', type: 'other' as const, size: '45m' },
    ];

    return allOptions.filter(opt => 
      opt.name.toLowerCase().includes(term) || 
      (opt.size && opt.size.toLowerCase().includes(term))
    ).slice(0, 8);
  }, [searchTerm, signageInfo]);
  // Auto-populate from faults and failed records
  const handleAutoPopulate = () => {
    if (!activeClient) return;

    const clientEquipment = equipment.filter(e => e.client_id === activeClient.id);
    const clientFaults = faults.filter(f => clientEquipment.some(e => e.id === f.equipmentId) && f.status === 'Open');
    const clientRecords = records.filter(r => clientEquipment.some(e => e.id === r.equipmentId));

    const newItems: QuoteItem[] = [];

    // Process Faults
    clientFaults.forEach(fault => {
      const asset = clientEquipment.find(e => e.id === fault.equipmentId);
      newItems.push({
        id: Math.random().toString(36).substr(2, 9),
        description: `Fault Repair: ${asset ? `${asset.type} (${asset.size})` : 'Unknown Asset'} - ${fault.description}`,
        type: 'other',
        quantity: 1
      });
    });

    // Process Failed Records
    const failedRecords = clientRecords.filter(r => r.status === 'Fail');
    failedRecords.forEach(record => {
      const asset = clientEquipment.find(e => e.id === record.equipmentId);
      if (asset) {
        newItems.push({
          id: Math.random().toString(36).substr(2, 9),
          description: `Replacement/Repair: ${asset.type} (${asset.size}) - Failed Inspection: ${record.notes || 'No remarks'}`,
          type: 'replacement',
          quantity: 1
        });
      }
    });

    setQuoteItems(prev => {
      const updated = [...prev, ...newItems];
      if (selectedClientId) {
        onUpdateAssessment(selectedClientId, updated);
      }
      return updated;
    });
  };

  const addItem = (type: QuoteItem['type'], description: string = '', size: string = '') => {
    const newItem: QuoteItem = {
      id: Math.random().toString(36).substr(2, 9),
      description,
      size,
      type,
      quantity: 1,
      isNewSupply: activeTab === 'new-supply'
    };
    const updated = [...quoteItems, newItem];
    setQuoteItems(updated);
    if (selectedClientId) {
      onUpdateAssessment(selectedClientId, updated);
    }
  };

  const updateItem = (id: string, field: keyof QuoteItem, value: any) => {
    const updated = quoteItems.map(item => item.id === id ? { ...item, [field]: value } : item);
    setQuoteItems(updated);
    if (selectedClientId) {
      onUpdateAssessment(selectedClientId, updated);
    }
  };

  const removeItem = (id: string) => {
    const updated = quoteItems.filter(item => item.id !== id);
    setQuoteItems(updated);
    if (selectedClientId) {
      onUpdateAssessment(selectedClientId, updated);
    }
  };

  const handleDownloadReport = () => {
    if (selectedClientId) {
      onDownloadReport(selectedClientId);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Site Assessment Hub</h2>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-1">Requirements & Fault Analysis</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleDownloadReport}
            disabled={quoteItems.length === 0}
            className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-black transition-all disabled:opacity-50"
          >
            Download Report
          </button>
          <button 
            onClick={() => setIsAddingClient(true)}
            className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-red-500 hover:text-red-600 transition-all"
          >
            New Client
          </button>
          <button 
            onClick={() => setShowBulkImport(true)}
            disabled={!selectedClientId}
            className="bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            Upload Excel
          </button>
          <button 
            onClick={handleAutoPopulate}
            disabled={!selectedClientId}
            className="bg-red-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-200 hover:bg-red-700 transition-all disabled:opacity-50"
          >
            Auto-Populate Faults
          </button>
        </div>
      </div>

      <div className="print-only hidden print:block mb-8">
        <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter">Site Assessment Report</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Generated on {new Date(finalizedDate).toLocaleDateString()}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-black uppercase tracking-tight">Precision Fire</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Safety Compliance Division</p>
          </div>
        </div>
        
        {activeClient && (
          <div className="mt-8 grid grid-cols-2 gap-8">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Client Information</p>
              <p className="text-xl font-black text-slate-900 uppercase">{activeClient.name}</p>
              <p className="text-xs font-bold text-slate-500 mt-1">{activeClient.address}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Contact Details</p>
              <p className="text-sm font-bold text-slate-900">{activeClient.email}</p>
              <p className="text-sm font-bold text-slate-900">{activeClient.cellphone}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Client Selection */}
        <div className="lg:col-span-1 space-y-6 no-print">
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Select Client</label>
            <select 
              value={selectedClientId} 
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-bold text-sm appearance-none"
            >
              <option value="">Choose a client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {activeClient && (
              <div className="mt-6 p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{activeClient.name}</p>
                <p className="text-[10px] text-slate-500 font-bold">{activeClient.address}</p>
                <p className="text-[10px] text-slate-500 font-bold">{activeClient.email}</p>
              </div>
            )}
          </div>

          {isAddingClient && (
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl animate-in slide-in-from-top-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">Create Client</h3>
              <div className="space-y-4">
                <input 
                  placeholder="Client / Site Name" 
                  value={newClient.name} 
                  onChange={e => setNewClient({...newClient, name: e.target.value})}
                  className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-semibold"
                />
                <textarea 
                  placeholder="Site Address" 
                  value={newClient.address} 
                  onChange={e => setNewClient({...newClient, address: e.target.value})}
                  className="w-full border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-semibold h-24"
                />
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={async () => {
                      const id = Math.random().toString(36).substr(2, 9);
                      await onAddClient({ 
                        ...newClient, 
                        email: '',
                        cellphone: '',
                        id, 
                        createdAt: new Date().toISOString() 
                      });
                      setSelectedClientId(id);
                      setIsAddingClient(false);
                      setNewClient({ name: '', address: '' });
                    }}
                    className="flex-1 bg-slate-900 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest"
                  >
                    Save Client
                  </button>
                  <button 
                    onClick={() => setIsAddingClient(false)}
                    className="px-6 border-2 border-slate-100 text-slate-400 font-black rounded-2xl text-[10px] uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quote Spreadsheet */}
        <div className="lg:col-span-2 space-y-8 print:col-span-3">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden print:border-none print:shadow-none">
            <div className="flex border-b border-slate-100 no-print">
              <button 
                onClick={() => setActiveTab('assessment')}
                className={`flex-1 py-6 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'assessment' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                Site Assessment
              </button>
              <button 
                onClick={() => setActiveTab('new-supply')}
                className={`flex-1 py-6 text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === 'new-supply' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                }`}
              >
                New Supply
              </button>
            </div>

            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 no-print">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                {activeTab === 'assessment' ? 'Required Actions & Equipment' : 'New Supply Items'}
              </h3>
              <div className="flex gap-2">
                <button onClick={() => addItem('maintenance')} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:border-red-500 transition-all">+ Maintenance</button>
                <button onClick={() => addItem('replacement')} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:border-red-500 transition-all">+ Replacement</button>
                <button onClick={() => addItem('recharge')} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:border-red-500 transition-all">+ Recharge</button>
                <button onClick={() => addItem('signage')} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:border-red-500 transition-all">+ Signage</button>
                <button onClick={() => addItem('other', 'General Remark: ')} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:border-red-500 transition-all">+ General Remark</button>
                <button onClick={() => addItem('other')} className="bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest hover:border-red-500 transition-all">+ Other</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 print:bg-slate-900 print:text-white">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 print:text-white uppercase tracking-widest border-b border-slate-100 print:border-slate-800">Type</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 print:text-white uppercase tracking-widest border-b border-slate-100 print:border-slate-800">Description</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 print:text-white uppercase tracking-widest border-b border-slate-100 print:border-slate-800">Size</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 print:text-white uppercase tracking-widest border-b border-slate-100 print:border-slate-800 w-24 text-center">Qty</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-16 no-print"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 print:divide-slate-200">
                  {quoteItems
                    .filter(item => activeTab === 'new-supply' ? item.isNewSupply : !item.isNewSupply)
                    .map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded ${
                          item.type === 'maintenance' ? 'bg-blue-50 text-blue-600' :
                          item.type === 'replacement' ? 'bg-emerald-50 text-emerald-600' :
                          item.type === 'recharge' ? 'bg-amber-50 text-amber-600' :
                          item.type === 'signage' ? 'bg-purple-50 text-purple-600' :
                          'bg-slate-50 text-slate-600'
                        }`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          value={item.description} 
                          onChange={e => updateItem(item.id, 'description', e.target.value)}
                          className="w-full bg-transparent border-none outline-none font-bold text-slate-900 text-xs print:text-sm"
                          placeholder="Item description..."
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          value={item.size} 
                          onChange={e => updateItem(item.id, 'size', e.target.value)}
                          className="w-full bg-transparent border-none outline-none font-bold text-slate-500 text-xs print:text-sm"
                          placeholder="Size..."
                        />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => updateItem(item.id, 'quantity', Math.max(0, item.quantity - 1))}
                            className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-8 font-black text-slate-900 text-xs">{item.quantity}</span>
                          <button 
                            onClick={() => updateItem(item.id, 'quantity', item.quantity + 1)}
                            className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center no-print">
                        <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-600 transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3h7" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {quoteItems.filter(item => activeTab === 'new-supply' ? item.isNewSupply : !item.isNewSupply).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {activeTab === 'assessment' ? 'No assessment items added yet' : 'No new supply items added yet'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Equipment Search & Quick Add */}
          <div className="grid grid-cols-1 gap-8 no-print">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search & Add Equipment</h4>
                <button 
                  onClick={() => addItem('other', 'Manual Entry: ')}
                  className="text-[8px] font-black text-red-600 uppercase tracking-widest hover:underline"
                >
                  + Add Manual Line
                </button>
              </div>
              
              <div className="relative mb-4">
                <input 
                  type="text"
                  placeholder="Search equipment, signage, or accessories..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 outline-none focus:border-red-500 font-bold text-sm"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    &times;
                  </button>
                )}
              </div>

              {searchTerm && (
                <div className="grid grid-cols-1 gap-2 animate-in slide-in-from-top-2">
                  {searchResults.length > 0 ? (
                    searchResults.map((res, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => {
                          addItem(res.type, res.name, res.size);
                          setSearchTerm('');
                        }}
                        className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-red-500 transition-all text-left group"
                      >
                        <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight group-hover:text-red-600 transition-colors">{res.name}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase">{res.size || res.type}</p>
                        </div>
                        <svg className="w-4 h-4 text-slate-300 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-[10px] font-black text-slate-400 uppercase">No matches found. Use "Add Manual Line" for custom items.</div>
                  )}
                </div>
              )}
              
              {!searchTerm && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button onClick={() => addItem('maintenance')} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:border-red-500 transition-all">Maintenance</button>
                  <button onClick={() => addItem('replacement')} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:border-red-500 transition-all">Replacement</button>
                  <button onClick={() => addItem('recharge')} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:border-red-500 transition-all">Recharge</button>
                  <button onClick={() => addItem('signage')} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:border-red-500 transition-all">Signage</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
          .bg-slate-900 { background-color: #0f172a !important; -webkit-print-color-adjust: exact; }
          .text-white { color: white !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {showBulkImport && (
        <BulkQuoteImport 
          isNewSupply={activeTab === 'new-supply'}
          onImport={(items) => {
            const updated = [...quoteItems, ...items];
            setQuoteItems(updated);
            if (selectedClientId) {
              onUpdateAssessment(selectedClientId, updated);
            }
            setShowBulkImport(false);
          }}
          onCancel={() => setShowBulkImport(false)}
        />
      )}
    </div>
  );
};

export default QuoteTab;
