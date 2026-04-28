import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { BrandLogo } from './Brand';
import { Equipment, Client, InspectionRecord } from '../types';

interface LiveAssistantProps {
  equipment: Equipment[];
  clients: Client[];
  records: InspectionRecord[];
  onClose: () => void;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const LiveAssistant: React.FC<LiveAssistantProps> = ({ equipment, clients, records, onClose }) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const currentInputTranscription = useRef('');
  const currentOutputTranscription = useRef('');

  const findAssetFunction: FunctionDeclaration = {
    name: 'findAssetBySerialNumber',
    description: 'Look up a fire safety asset in the fleet registry by its physical serial number.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        serialNumber: {
          type: Type.STRING,
          description: 'The physical serial number or QR code text from the asset tag.'
        }
      },
      required: ['serialNumber']
    }
  };

  const getSiteStatsFunction: FunctionDeclaration = {
    name: 'getSiteComplianceSummary',
    description: 'Get a summary of compliance for a specific property or client site.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        clientName: {
          type: Type.STRING,
          description: 'The name of the site or client to check.'
        }
      },
      required: ['clientName']
    }
  };

  const handleStop = useCallback(() => {
    setIsActive(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) audioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    sessionPromiseRef.current = null;
  }, []);

  const handleStart = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      
      const outputNode = outputCtx.createGain();
      outputNode.connect(outputCtx.destination);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsActive(true);
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encodeBase64(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000'
              };
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription) {
              currentOutputTranscription.current += message.serverContent.outputTranscription.text;
            } else if (message.serverContent?.inputTranscription) {
              currentInputTranscription.current += message.serverContent.inputTranscription.text;
            }

            if (message.serverContent?.turnComplete) {
              const uText = currentInputTranscription.current;
              const mText = currentOutputTranscription.current;
              if (uText || mText) {
                setTranscript(prev => [...prev, 
                  ...(uText ? [{ role: 'user' as const, text: uText }] : []),
                  ...(mText ? [{ role: 'model' as const, text: mText }] : [])
                ]);
              }
              currentInputTranscription.current = '';
              currentOutputTranscription.current = '';
            }

            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const audioBuffer = await decodeAudioData(decodeBase64(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            if (message.toolCall?.functionCalls) {
              for (const fc of message.toolCall.functionCalls) {
                let result = {};
                const args = (fc.args || {}) as any;
                if (fc.name === 'findAssetBySerialNumber') {
                  const asset = equipment.find(e => e.serialNumber === args.serialNumber);
                  result = asset ? { status: 'found', asset } : { status: 'not_found' };
                } else if (fc.name === 'getSiteComplianceSummary') {
                  const clientName = (args.clientName || '') as string;
                  const client = clients.find(c => (c.name || '').toLowerCase().includes(clientName.toLowerCase()));
                  if (client) {
                    const siteAssets = equipment.filter(e => e.client_id === client.id && !e.isArchived);
                    const passed = siteAssets.filter(e => records.find(r => r.equipmentId === e.id)?.status === 'Pass').length;
                    result = { site: client.name, total: siteAssets.length, passed, status: passed === siteAssets.length ? 'Compliant' : 'Issues Detected' };
                  } else {
                    result = { error: 'Client not found' };
                  }
                }

                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: result }
                  });
                });
              }
            }
          },
          onerror: (e) => console.error("Live API Error:", e),
          onclose: () => setIsActive(false)
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "You are the Precision Fire Services Digital Assistant. Help technicians look up assets and site compliance data using tool calls. Keep responses technical, concise, and professional. Mention SANS 1475 where relevant.",
          tools: [{ functionDeclarations: [findAssetFunction, getSiteStatsFunction] }],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error("Start Failed:", err);
      setIsConnecting(false);
      setError("Microphone access or connection failed.");
    }
  };

  useEffect(() => {
    return () => handleStop();
  }, [handleStop]);

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-900 flex flex-col items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(239,68,68,0.2),transparent)] pointer-events-none" />
      
      <div className="w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[80vh] relative z-10">
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <BrandLogo className="w-12 h-12" glow />
             <div>
               <h3 className="text-xl font-black uppercase tracking-tight">AI Voice Assistant</h3>
               <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.4em]">SANS Regulatory Node</p>
             </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-2xl transition-all">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide bg-slate-50">
          {transcript.length === 0 && !isConnecting && !isActive && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-60">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-inner border border-slate-100">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <div>
                 <p className="text-lg font-black text-slate-900 uppercase">Ready for Voice Command</p>
                 <p className="text-xs text-slate-500 mt-2">Speak to check site health or lookup asset history.</p>
              </div>
            </div>
          )}

          {isConnecting && (
             <div className="h-full flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-red-600 rounded-full animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Waking Digital Assistant...</p>
             </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-[10px] font-black uppercase text-center border border-red-100">
              {error}
            </div>
          )}

          {transcript.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
              <div className={`max-w-[80%] p-4 rounded-3xl ${msg.role === 'user' ? 'bg-red-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-200 shadow-sm'}`}>
                <p className="text-xs font-bold leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-8 bg-white border-t border-slate-100 shrink-0 flex flex-col items-center gap-4">
           {isActive ? (
             <div className="flex flex-col items-center gap-4 w-full">
                <div className="flex items-center gap-2 h-10">
                   {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-1 bg-red-600 rounded-full animate-pulse" style={{ animationDelay: `${i * 100}ms`, height: `${Math.random() * 20 + 10}px` }} />
                   ))}
                </div>
                <button 
                  onClick={handleStop}
                  className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl"
                >
                  End Session
                </button>
             </div>
           ) : (
             <button 
               disabled={isConnecting}
               onClick={handleStart}
               className="w-full bg-red-600 text-white font-black py-6 rounded-[2rem] uppercase tracking-widest text-xs shadow-2xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3"
             >
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
               {isConnecting ? 'Establishing Link...' : 'Start Voice Consultation'}
             </button>
           )}
           <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.4em]">Encrypted SANS Technical Gateway</p>
        </div>
      </div>
    </div>
  );
};

export default LiveAssistant;