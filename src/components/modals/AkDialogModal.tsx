import React, { useEffect } from 'react';
import { sfxPlay } from '../../utils/sfx';

export interface AkDialogState {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AkDialogModalProps {
  dialog: AkDialogState;
  onClose: () => void;
}

export const AkDialogModal: React.FC<AkDialogModalProps> = ({ dialog, onClose }) => {
  useEffect(() => {
    if (!dialog.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dialog.onCancel?.();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog, onClose]);

  if (!dialog.isOpen) return null;

  const handleConfirm = () => {
    sfxPlay('click');
    const cb = dialog.onConfirm;
    onClose();
    cb?.();
  };

  const handleCancel = () => {
    sfxPlay('click');
    const cb = dialog.onCancel;
    onClose();
    cb?.();
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
    >
      <div className="modal-enter ak-cut bg-[#12151a] border border-orange-500/50 w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="ak-hazard-strip" />
        <div className="p-5">
          <div className="font-mono-tech text-[10px] tracking-widest text-orange-400 uppercase mb-1">
            // ZEROTH SYSTEM NOTICE
          </div>
          <h3 className="text-base font-bold text-white tracking-wider uppercase mb-2">{dialog.title}</h3>
          <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line mb-5">{dialog.message}</p>
          <div className="flex gap-2 justify-end">
            {dialog.type === 'confirm' && (
              <button
                type="button"
                onClick={handleCancel}
                className="btn-press px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-300 text-xs font-bold tracking-wider"
              >
                {dialog.cancelLabel || 'BATAL'}
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              className={`btn-press px-5 py-2 text-xs font-bold tracking-wider ${
                dialog.danger
                  ? 'bg-red-600 hover:bg-red-500 text-white'
                  : 'bg-orange-500 hover:bg-orange-400 text-neutral-950'
              }`}
            >
              {dialog.confirmLabel || 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
