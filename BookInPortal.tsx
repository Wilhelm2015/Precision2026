import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Equipment, EquipmentType, Client } from '../types';
import { syncService } from '../services/registryService';

interface BulkImportProps {
  clients: Client[];
  onComplete: () => void;
  onCancel: () => void;
}

const BulkImport: React.FC<BulkImportProps> = ({ clients, onComplete, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'Serial Number',
      'Type',
      'Size',
      'Manufacturer',
      'Manufacture Date (YYYY-MM-DD)',
      'Location',
      'Unit Number',
      'QR Code'
    ];
    const sampleData = [
      ['SN12345', 'Fire Extinguisher', '9kg', 'Chubb', '2023-01-01', 'Server Room', 'Unit 1', 'QR001'],
      ['SN67890', 'CO2 Fire Extinguisher', '5kg', 'Safequip', '2022-06-15', 'Kitchen', 'Unit 2', 'QR002']
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Equipment Template');
    XLSX.writeFile(wb, 'Equipment_Import_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setPreviewData(data);
        setError(null);
      } catch (err) {
        setError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const mapToEquipment = (row: any): Partial<Equipment> => {
    // Map common variations of headers
    const serial = row['Serial Number'] || row['serial'] || row['Serial'];
    const typeStr = row['Type'] || row['type'] || row['Equipment Type'];
    const size = row['Size'] || row['size'];
    const manufacturer = row['Manufacturer'] || row['manufacturer'] || row['Make'];
    const mfgDate = row['Manufacture Date (YYYY-MM-DD)'] || row['Manufacture Date'] || row['date'];
    const location = row['Location'] || row['location'] || row['Area'];
    const unit = row['Unit Number'] || row['unit'] || row['Unit'];
    const qr = row['QR Code'] || row['qr'] || row['QR'];

    // Find matching equipment type
    let type = EquipmentType.EXTINGUISHER;
    if (typeStr) {
      const normalized = typeStr.toLowerCase();
      if (normalized.includes('co2')) type = EquipmentType.CO2_EXTINGUISHER;
      else if (normalized.includes('hose')) type = EquipmentType.HOSE_REEL;
      else if (normalized.includes('hydrant')) type = EquipmentType.HYDRANT;
      else if (normalized.includes('blanket')) type = EquipmentType.FIRE_BLANKET;
      else if (normalized.includes('smoke')) type = EquipmentType.SMOKE_DETECTOR;
      else if (normalized.includes('door')) type = EquipmentType.FIRE_DOOR;
    }

    return {
      id: crypto.randomUUID(),
      serialNumber: String(serial || ''),
      type,
      size: String(size || ''),
      manufacturer: String(manufacturer || 'Unknown'),
      manufactureDate: mfgDate ? String(mfgDate) : undefined,
      location: String(location || 'General'),
      unitNumber: String(unit || ''),
      qrCode: String(qr || ''),
      client_id: selectedClientId,
      lastInspectionDate: null,
      nextServiceDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      isArchived: false
    };
  };

  const handleImport = async () => {
    if (!selectedClientId) {
      setError('Please select a client to link the equipment to.');
      return;
    }

    if (previewData.length === 0) {
      setError('No data found in the uploaded file.');
      return;
    }

    setIsProcessing(true);
    try {
      const equipmentList = previewData.map(mapToEquipment) as Equipment[];
      await syncService.saveEquipment(equipmentList);
      onComplete();
    } catch (err: any) {
      setError('Import failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Bulk Equipment Import</h2>
            <p className="text-slate-400 text-xs mt-1">Upload an Excel spreadsheet to populate your registry instantly.</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-8 flex-1 overflow-y-auto space-y-8">
          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-600 p-6 rounded-2xl flex items-center gap-4 animate-in slide-in-from-top-4">
              <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="font-black uppercase tracking-tight text-sm">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Step 1: Download Template</label>
              <button 
                onClick={downloadTemplate}
                className="w-full flex items-center justify-center gap-3 bg-slate-100 hover:bg-slate-200 text-slate-900 font-black py-6 rounded-3xl transition-all border-2 border-slate-200 border-dashed"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span className="uppercase tracking-widest text-xs">Download Excel Template</span>
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Step 2: Select Target Site</label>
              <select 
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-3xl px-6 py-5 font-black text-slate-900 uppercase tracking-tight focus:border-red-600 focus:outline-none transition-all appearance-none"
              >
                <option value="">Select a Client/Site...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Step 3: Upload Spreadsheet</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-4 border-dashed border-slate-200 rounded-[3rem] p-12 flex flex-col items-center justify-center gap-4 hover:border-red-600 hover:bg-red-50 transition-all cursor-pointer group"
            >
              <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center text-slate-400 group-hover:bg-red-600 group-hover:text-white transition-all shadow-sm">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
              </div>
              <div className="text-center">
                <p className="font-black text-slate-900 uppercase tracking-tight">Click to select Excel file</p>
                <p className="text-slate-400 text-xs mt-1">Accepts .xlsx and .xls formats</p>
              </div>
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                onChange={handleFileUpload}
              />
            </div>
          </div>

          {previewData.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Preview ({previewData.length} Items Found)</label>
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full">Ready to Import</span>
              </div>
              <div className="border-2 border-slate-100 rounded-3xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b-2 border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serial</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manufacturer</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-900 text-xs uppercase">{row['Serial Number'] || row['serial'] || 'N/A'}</td>
                        <td className="px-6 py-4 font-black text-slate-600 text-xs uppercase">{row['Type'] || row['type'] || 'N/A'}</td>
                        <td className="px-6 py-4 font-black text-slate-600 text-xs uppercase">{row['Manufacturer'] || row['manufacturer'] || 'N/A'}</td>
                        <td className="px-6 py-4 font-black text-slate-600 text-xs uppercase">{row['Location'] || row['location'] || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.length > 5 && (
                  <div className="p-4 bg-slate-50 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100">
                    And {previewData.length - 5} more items...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-200 flex gap-4">
          <button 
            onClick={onCancel}
            className="flex-1 bg-white border-2 border-slate-200 text-slate-600 font-black py-5 rounded-2xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs"
          >
            Cancel
          </button>
          <button 
            disabled={isProcessing || previewData.length === 0 || !selectedClientId}
            onClick={handleImport}
            className={`flex-[2] font-black py-5 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 ${
              isProcessing || previewData.length === 0 || !selectedClientId
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
            }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>Processing Import...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <span>Confirm & Import {previewData.length} Items</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkImport;
