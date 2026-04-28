import React, { useState } from 'react';

interface ImageModalProps {
  src: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.5, 1);
      if (newScale === 1) setPosition({ x: 0, y: 0 });
      return newScale;
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale === 1) return;
    setIsDragging(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div 
      className="fixed inset-0 z-[5000] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-12 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div className="absolute top-6 right-6 flex gap-4 z-10">
        <div className="flex bg-slate-900/10 backdrop-blur-md rounded-2xl border border-slate-900/20 p-1">
          <button 
            onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
            className="p-3 hover:bg-slate-900/10 rounded-xl text-slate-900 transition-all active:scale-90"
            title="Zoom Out"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" /></svg>
          </button>
          <div className="w-px bg-slate-900/10 mx-1 my-2" />
          <button 
            onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
            className="p-3 hover:bg-slate-900/10 rounded-xl text-slate-900 transition-all active:scale-90"
            title="Zoom In"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        <button 
          onClick={onClose}
          className="p-4 bg-red-600 text-white rounded-2xl shadow-xl hover:bg-red-700 transition-all active:scale-90"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div 
        className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          src={src}
          alt="Zoomed Evidence"
          referrerPolicy="no-referrer"
          className="max-w-full max-h-full object-contain shadow-2xl rounded-lg transition-transform duration-300 ease-out"
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            cursor: scale > 1 ? 'grab' : 'default'
          }}
        />
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/10 backdrop-blur-md px-6 py-3 rounded-full border border-slate-900/10">
        <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">
          {scale > 1 ? `Zoom: ${Math.round(scale * 100)}% • Drag to Pan` : 'Pinch or use buttons to zoom'}
        </p>
      </div>
    </div>
  );
};

export default ImageModal;
