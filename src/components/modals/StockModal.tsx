import React from 'react';
import {
  GachaItem,
  TIER_EMOJI,
  TIER_LABEL,
  TIER_TEXT_400,
  TIERS,
} from '../../types/gacha';
import { sfxPlay } from '../../utils/sfx';

interface StockModalProps {
  isOpen: boolean;
  items: GachaItem[];
  onSetStock: (itemId: string, newStock: number) => void;
  onResetDefaultStock: () => void;
  onClose: () => void;
}

export const StockModal: React.FC<StockModalProps> = ({
  isOpen,
  items,
  onSetStock,
  onResetDefaultStock,
  onClose,
}) => {
  if (!isOpen) return null;

  const totalAllStock = items.reduce((sum, it) => sum + Math.max(0, it.stock), 0);

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-enter ak-cut bg-[#12151a] border border-orange-500/45 w-full max-w-lg max-h-[88dvh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-orange-500/25 flex items-center justify-between shrink-0">
          <div>
            <div className="font-mono-tech text-[10px] text-orange-400 tracking-widest">
              // LOGISTICS INVENTORY // TOTAL: {totalAllStock}
            </div>
            <h3 className="text-lg font-bold text-white tracking-wider uppercase">📦 STOK HADIAH</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              sfxPlay('click');
              onClose();
            }}
            className="btn-press px-3 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto scroll-area flex-1">
          {TIERS.map((tier) => {
            const tierItems = items.filter((it) => it.tier === tier);
            if (tierItems.length === 0) return null;
            return (
              <div key={tier} className="space-y-2">
                <div className={`text-xs font-bold tracking-wider uppercase flex items-center gap-1.5 ${TIER_TEXT_400[tier]}`}>
                  <span>{TIER_EMOJI[tier]}</span>
                  <span>{TIER_LABEL[tier]}</span>
                </div>
                <div className="space-y-1.5">
                  {tierItems.map((it) => {
                    const out = it.stock <= 0;
                    return (
                      <div
                        key={it.id}
                        className="admin-row flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-white truncate">{it.name}</div>
                          <span
                            className={`stock-badge font-mono-tech mt-0.5 ${
                              out
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : it.stock <= 3
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {out ? 'HABIS' : `STOK: ${it.stock}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              sfxPlay('click');
                              onSetStock(it.id, Math.max(0, it.stock - 1));
                            }}
                            className="btn-press w-8 h-8 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-bold text-sm"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            max={1000000}
                            value={it.stock}
                            onChange={(e) => {
                              const v = Math.max(0, Math.floor(Number(e.target.value) || 0));
                              onSetStock(it.id, v);
                            }}
                            className="admin-input !w-16 text-center !py-1.5 font-mono-tech"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              sfxPlay('click');
                              onSetStock(it.id, it.stock + 1);
                            }}
                            className="btn-press w-8 h-8 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-white font-bold text-sm"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3.5 border-t border-orange-500/25 bg-[#0d1016] shrink-0">
          <button
            type="button"
            onClick={() => {
              sfxPlay('click');
              onResetDefaultStock();
            }}
            className="btn-press w-full py-2.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-300 text-xs font-bold tracking-wider"
          >
            🔄 RESET STOK KE DEFAULT
          </button>
        </div>
      </div>
    </div>
  );
};
