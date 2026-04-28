import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { syncService } from '../services/registryService';

interface CatalogItem {
  name: string;
  size: string;
  type: 'maintenance' | 'replacement' | 'recharge' | 'signage' | 'other';
}

interface QuoteCatalogImportProps {
  onComplete: () => void;
  onCancel: () => void;
}

const QuoteCatalogImport: React.FC<QuoteCatalogImportProps> = ({ onComplete, onCancel }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'Type',
      'Name',
      'Size'
    ];
    const sampleData = [
      ['maintenance', 'Annual Service: Fire Extinguisher', '9kg'],
      ['replacement', 'New Fire Extinguisher', '4.5kg'],
      ['signage', 'Fire Extinguisher (FB1)', '190x190'],
      ['other', 'Fire Extinguisher Cabinet', '9kg']
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Quote Catalog Template');
    XLSX.writeFile(wb, 'Quote_Catalog_Template.xlsx');
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

  const mapToCatalogItem = (row: any): CatalogItem => {
    const typeStr = String(row['Type'] || row['type'] || 'other').toLowerCase();
    const name = String(row['Name'] || row['name'] || row['Description'] || 'No name');
    const size = String(row['Size'] || row['size'] || '');

    let type: CatalogItem['type'] = 'other';
    if (typeStr.includes('maintenance')) type = 'maintenance';
    else if (typeStr.includes('replacement')) type = 'replacement';
    else if (typeStr.includes('recharge')) type = 'recharge';
    else if (typeStr.includes('signage')) type = 'signage';

    return {
      name,
      size,
      type
    };
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      setError('No data found in the uploaded file.');
      return;
    }

    setIsProcessing(true);
    try {
      const items = previewData.map(mapToCatalogItem);
      await syncService.saveQuoteCatalog(items);
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
            <h2 className="text-2xl font-black uppercase tracking-tight">Quote Catalog Management</h2>
            <p className="text-slate-400 text-xs mt-1">Upload a global list of equipment for technicians to select from.</p>
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
                <span className="uppercase tracking-widest text-xs">Download Catalog Template</span>
              </button>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Step 2: Upload Spreadsheet</label>
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
          </div>

          {previewData.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Preview ({previewData.length} Items Found)</label>
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full">Ready to Update Catalog</span>
              </div>
              <div className="border-2 border-slate-100 rounded-3xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b-2 border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {previewData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-black text-slate-900 text-xs uppercase">{row['Type'] || row['type'] || 'N/A'}</td>
                        <td className="px-6 py-4 font-black text-slate-600 text-xs uppercase">{row['Name'] || row['name'] || row['Description'] || 'N/A'}</td>
                        <td className="px-6 py-4 font-black text-slate-600 text-xs uppercase">{row['Size'] || row['size'] || 'N/A'}</td>
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
            disabled={isProcessing || previewData.length === 0}
            onClick={handleImport}
            className={`flex-[2] font-black py-5 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-3 ${
              isProcessing || previewData.length === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700 active:scale-95'
            }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <span>Updating Catalog...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                <span>Update Global Catalog</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuoteCatalogImport;
