import React, { useState } from 'react';
import { Client } from '../types';

interface MoveAssetModalProps {
  onClose: () => void;
  onMove: (newClientId: string) => void;
  onCreateAndMove: (newSiteName: string) => void;
  clients: Client[];
}

export const MoveAssetModal: React.FC<MoveAssetModalProps> = ({ onClose, onMove, onCreateAndMove, clients }) => {
  const [targetId, setTargetId] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [mode, setMode] = useState<'move' | 'create'>('move');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h3 className="text-xl font-black uppercase tracking-tighter mb-4 text-slate-900">Move Asset to Site</h3>
        
        <div className="flex gap-2 mb-4">
          <button className={`flex-1 p-2 rounded-lg font-black uppercase text-[10px] ${mode === 'move' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => setMode('move')}>Move Existing</button>
          <button className={`flex-1 p-2 rounded-lg font-black uppercase text-[10px] ${mode === 'create' ? 'bg-slate-900 text-white' : 'bg-slate-100'}`} onClick={() => setMode('create')}>+ Create New</button>
        </div>

        {mode === 'move' ? (
          <select className="w-full p-3 rounded-xl bg-slate-100 mb-4" onChange={(e) => setTargetId(e.target.value)}>
            <option value="">Select Target Site...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : (
          <input className="w-full p-3 rounded-xl bg-slate-100 mb-4" placeholder="New Site Name..." value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)} />
        )}

        <div className="flex gap-2">
          <button className="flex-1 bg-slate-200 p-3 rounded-xl font-black uppercase text-[10px]" onClick={onClose}>Cancel</button>
          <button 
            className="flex-1 bg-emerald-600 text-white p-3 rounded-xl font-black uppercase text-[10px]" 
            onClick={() => mode === 'move' ? onMove(targetId) : onCreateAndMove(newSiteName)}
            disabled={mode === 'move' ? !targetId : !newSiteName}
          >Confirm Move</button>
        </div>
      </div>
    </div>
  );
};
