
import React, { useEffect } from 'react';
import { CloseIcon } from './icons';

interface ImageModalProps {
  imageUrl: string;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl flex items-center justify-center z-[100] animate-fade-in p-4 sm:p-12"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-6xl h-full flex flex-col items-center justify-center animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-slate-800/50 rounded-[2rem] shadow-3xl border border-slate-700/50">
            <img 
                src={imageUrl} 
                alt="Full size conversion asset" 
                className="max-w-full max-h-full object-contain p-2" 
            />
        </div>
        
        <button
          onClick={onClose}
          className="absolute -top-6 -right-6 sm:top-4 sm:right-4 bg-white rounded-full p-4 text-slate-900 hover:bg-brand-primary hover:text-white shadow-2xl transition-all duration-300 group z-10"
          aria-label="Close viewer"
        >
          <CloseIcon className="w-8 h-8 group-hover:rotate-90 transition-transform" />
        </button>
      </div>
      <style>{`
        @keyframes scale-in {
            0% { transform: scale(0.95); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
};
