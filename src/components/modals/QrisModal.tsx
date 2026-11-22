import React from 'react';
import { sfxPlay } from '../../utils/sfx';

interface QrisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrisModal: React.FC<QrisModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-enter ak-cut bg-[#12151a] border border-orange-500/50 w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="ak-hazard-strip" />
        <div className="p-5 text-center">
          <div className="font-mono-tech text-[10px] text-orange-400 tracking-widest mb-1.5">
            // ZEROTH QR TERMINAL
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white tracking-wide mb-4">
            Scan kode QR ini buat ngepull, Doc
          </h3>

          <div className="bg-white p-3 rounded-sm inline-block shadow-lg mb-4">
            <img
              src={`${import.meta.env.BASE_URL}qris-code.png`}
              alt="Kode QR AKID Malang"
              className="w-56 h-56 object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => {
                sfxPlay('click');
                onClose();
              }}
              className="btn-press w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-bold tracking-widest"
            >
              TUTUP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
