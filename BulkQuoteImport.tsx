import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

interface CertificateTemplateMapperProps {
  onTemplateMapped: (template: any) => void;
  onCancel: () => void;
}

const CertificateTemplateMapper: React.FC<CertificateTemplateMapperProps> = ({ onTemplateMapped, onCancel }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const analyzeTemplate = async () => {
    if (!previewUrl) return;
    setIsAnalyzing(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const base64Data = previewUrl.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: base64Data
                }
              },
              {
                text: "Analyze this certificate template and identify the precise coordinates (x, y as percentage of width/height) for the following placeholders: 'Client Name', 'Site Address', 'Date of Inspection', 'Technician Name', 'SAQCC Number', 'Equipment Serial Number', 'Equipment Type', 'Status/Result'. Return the result as a JSON object where keys are the placeholder names and values are objects with {x, y} percentage coordinates."
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              placeholders: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    x: { type: Type.NUMBER, description: "X coordinate as percentage (0-100)" },
                    y: { type: Type.NUMBER, description: "Y coordinate as percentage (0-100)" }
                  },
                  required: ["name", "x", "y"]
                }
              }
            },
            required: ["placeholders"]
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      setAnalysisResult(result);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("AI Analysis failed. Please try a clearer image or PDF.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col">
      <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">Certificate Template Mapper</h2>
          <p className="text-slate-400 text-xs mt-1">Upload your official certificate to map data placeholders.</p>
        </div>
        <button onClick={onCancel} className="text-white/40 hover:text-white text-3xl font-light">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {!previewUrl ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="aspect-video bg-slate-50 border-4 border-dashed border-slate-200 rounded-[3rem] flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50 transition-all group"
          >
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
              <svg className="w-10 h-10 text-slate-300 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            </div>
            <p className="mt-6 text-sm font-black text-slate-400 uppercase tracking-widest">Upload PDF or Image Certificate</p>
            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="relative aspect-[1/1.414] bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner">
                <img src={previewUrl} className="w-full h-full object-contain" alt="Template Preview" />
                {analysisResult?.placeholders?.map((p: any, i: number) => (
                  <div 
                    key={i}
                    className="absolute w-4 h-4 bg-red-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] font-black uppercase px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {p.name}
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setPreviewUrl(null)}
                className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-600 transition-colors"
              >
                Remove & Upload Different Template
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-2">AI Analysis Engine</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Our Gemini-powered engine will scan your document to find where specific details should be printed. 
                  This allows you to use your existing official stationery.
                </p>
                {!analysisResult && (
                  <button 
                    onClick={analyzeTemplate}
                    disabled={isAnalyzing}
                    className="w-full mt-6 bg-slate-900 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-xs shadow-xl hover:bg-black disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Analyzing Layout...
                      </>
                    ) : (
                      'Identify Placeholders'
                    )}
                  </button>
                )}
              </div>

              {analysisResult && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identified Placeholders</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {analysisResult.placeholders.map((p: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                        <span className="text-[10px] font-black text-slate-900 uppercase">{p.name}</span>
                        <span className="text-[9px] font-mono text-slate-400">X: {p.x.toFixed(1)}% | Y: {p.y.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => onTemplateMapped({ image: previewUrl, placeholders: analysisResult.placeholders })}
                    className="w-full bg-emerald-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-sm shadow-xl hover:bg-emerald-700 transition-all active:scale-95 mt-4"
                  >
                    Save & Activate Template
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificateTemplateMapper;
