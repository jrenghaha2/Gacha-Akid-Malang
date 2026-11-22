import React, { useMemo } from 'react';
import { GachaPlayer } from '../../types/gacha';
import { formatRp } from '../../utils/gachaEngine';
import { sfxPlay } from '../../utils/sfx';

interface SpendingModalProps {
  isOpen: boolean;
  players: GachaPlayer[];
  onClose: () => void;
}

export const SpendingModal: React.FC<SpendingModalProps> = ({ isOpen, players, onClose }) => {
  const ranked = useMemo(() => {
    return [...players].sort((a, b) => b.totalSpending - a.totalSpending || b.totalPulls - a.totalPulls);
  }, [players]);

  const totalRevenue = useMemo(
    () => players.reduce((sum, p) => sum + (p.totalSpending || 0), 0),
    [players]
  );

  if (!isOpen) return null;

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
            <div className="font-mono-tech text-[10px] text-amber-400 tracking-widest">
              // FUNDING LEADERBOARD
            </div>
            <h3 className="text-lg font-bold text-white tracking-wider uppercase">💰 TOP SPENDING</h3>
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

        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto scroll-area flex-1">
          <div className="p-3.5 bg-gradient-to-r from-amber-500/20 to-orange-500/10 border border-amber-500/40 rounded-sm flex items-center justify-between">
            <span className="text-xs text-amber-200 uppercase tracking-wider font-bold">Total Pendapatan</span>
            <span className="font-mono-tech text-lg font-bold text-amber-300">{formatRp(totalRevenue)}</span>
          </div>

          {ranked.length === 0 ? (
            <div className="text-center py-8 text-xs text-neutral-500">Belum ada data spending.</div>
          ) : (
            <div className="space-y-2">
              {ranked.map((p, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                const pct = totalRevenue > 0 ? Math.round((p.totalSpending / totalRevenue) * 100) : 0;
                return (
                  <div key={p.id} className="admin-row space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono-tech text-sm font-bold text-orange-400 w-7 shrink-0">
                          {medal}
                        </span>
                        <span className="text-sm font-bold text-white truncate">{p.name}</span>
                      </div>
                      <span className="font-mono-tech text-sm font-bold text-amber-400 shrink-0">
                        {formatRp(p.totalSpending)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono-tech text-neutral-400">
                      <span>{p.totalPulls}× pull</span>
                      <span>
                        L:{p.tierCounts.LEGENDARY} · E:{p.tierCounts.EPIC} · SR:{p.tierCounts.SR} · {pct}%
                      </span>
                    </div>
                    <div className="h-1 bg-neutral-800 overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${pct}%` }} />
                    </div>
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
