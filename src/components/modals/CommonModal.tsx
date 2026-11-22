import React from 'react';
import { GachaItem } from '../../types/gacha';
import { sfxPlay } from '../../utils/sfx';

interface CommonModalProps {
  pendingCount: number;
  availableCommons: GachaItem[];
  onPick: (item: GachaItem, qty: number) => void;
  onCancel?: () => void;
}

export const CommonModal: React.FC<CommonModalProps> = ({
  pendingCount,
  availableCommons,
  onPick,
  onCancel,
}) => {
  if (pendingCount <= 0) return null;

  return (
    <div className="fixed inset-0 z-[130] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="modal-enter ak-cut bg-[#12151a] border border-cyan-400/50 w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-orange-400 to-cyan-400" />
        <div className="p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="font-mono-tech text-[10px] text-cyan-400 tracking-widest">
                // SUPPLY CRATE // COMMON PICK
              </div>
              <h3 className="text-lg font-bold text-white tracking-wider uppercase">PILIH ITEM COMMON</h3>
            </div>
            <span className="counter-badge font-mono-tech font-bold">SISA: {pendingCount}</span>
          </div>

          <p className="text-xs text-neutral-400 mb-4">
            Kamu mendapatkan tier <span className="text-neutral-200 font-bold">Common</span>. Pilih hadiah yang
            diinginkan dari stok tersedia:
          </p>

          {availableCommons.length === 0 ? (
            <div className="text-center py-6 space-y-3">
              <div className="text-sm text-red-400 font-bold">Stok semua item Common sudah habis!</div>
              {onCancel && (
                <button
                  type="button"
                  onClick={() => {
                    sfxPlay('click');
                    onCancel();
                  }}
                  className="btn-press px-5 py-2 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-bold"
                >
                  TUTUP
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[55dvh] overflow-y-auto scroll-area pr-1">
              {availableCommons.map((item) => {
                const bulkQty = Math.min(pendingCount, item.stock);
                return (
                  <div
                    key={item.id}
                    className="admin-row flex flex-col gap-2 border border-neutral-700/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-white">🎁 {item.name}</div>
                        <div className="font-mono-tech text-[11px] text-neutral-400">
                          Stok tersedia: <span className="text-cyan-400 font-bold">{item.stock}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          sfxPlay('click');
                          onPick(item, 1);
                        }}
                        className="btn-press px-4 py-2 bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-bold tracking-wider"
                      >
                        PILIH 1×
                      </button>
                    </div>
                    {pendingCount > 1 && bulkQty > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          sfxPlay('click');
                          onPick(item, bulkQty);
                        }}
                        className="btn-press w-full py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-300 text-[11px] font-bold tracking-wider"
                      >
                        ⚡ AMBIL SEMUA ({bulkQty}× {item.name.toUpperCase()})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
