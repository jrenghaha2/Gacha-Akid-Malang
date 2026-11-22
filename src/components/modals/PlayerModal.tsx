import React, { useMemo, useState } from 'react';
import { GachaPlayer } from '../../types/gacha';
import { formatRp } from '../../utils/gachaEngine';
import { sfxPlay } from '../../utils/sfx';

interface PlayerModalProps {
  isOpen: boolean;
  players: GachaPlayer[];
  activePlayerId: string;
  onSelectPlayer: (playerId: string) => void;
  onCreatePlayer: (name: string) => Promise<void> | void;
  onClose: () => void;
}

export const PlayerModal: React.FC<PlayerModalProps> = ({
  isOpen,
  players,
  activePlayerId,
  onSelectPlayer,
  onCreatePlayer,
  onClose,
}) => {
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.id === activePlayerId) return -1;
        if (b.id === activePlayerId) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [players, search, activePlayerId]);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || busy) return;
    sfxPlay('click');
    setBusy(true);
    try {
      await onCreatePlayer(trimmed);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

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
            <div className="font-mono-tech text-[10px] text-orange-400 tracking-widest">// OPERATOR ROSTER</div>
            <h3 className="text-lg font-bold text-white tracking-wider uppercase">👤 PLAYER MANAGER</h3>
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
          <form onSubmit={handleRegister} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Daftar nama player baru..."
              maxLength={60}
              className="admin-input flex-1"
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="btn-press px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-neutral-950 text-xs font-bold tracking-wider shrink-0"
            >
              {busy ? '...' : '+ DAFTAR'}
            </button>
          </form>

          <div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cari player..."
              className="admin-input"
            />
          </div>

          <div className="space-y-2">
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-6 text-xs text-neutral-500">Player tidak ditemukan.</div>
            ) : (
              filteredPlayers.map((p) => {
                const isActive = p.id === activePlayerId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      sfxPlay('click');
                      onSelectPlayer(p.id);
                      onClose();
                    }}
                    className={`w-full text-left p-3 rounded-sm transition border ${
                      isActive
                        ? 'bg-orange-500/15 border-orange-500/70'
                        : 'bg-[#161a21] hover:bg-[#1d222b] border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-white truncate">{p.name}</span>
                        {isActive && (
                          <span className="font-mono-tech text-[9px] px-1.5 py-0.5 bg-orange-500 text-neutral-950 font-bold">
                            AKTIF
                          </span>
                        )}
                      </div>
                      <span className="font-mono-tech text-xs font-bold text-amber-400 shrink-0">
                        {formatRp(p.totalSpending)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-y-1 text-[11px] font-mono-tech text-neutral-400">
                      <div>
                        Pity U:<span className="text-green-400">{p.uncPity}</span> · R:
                        <span className="text-sky-400">{p.rPity}</span> · S:
                        <span className="text-purple-400">{p.srPity}</span> · E:
                        <span className="text-yellow-400">{p.epicPity}</span> · L:
                        <span className="text-orange-400">{p.legPity}</span>
                      </div>
                      <div>
                        Pull:{' '}
                        <span className="text-white font-bold">{p.totalPulls}</span> | L:
                        <span className="text-orange-400">{p.tierCounts.LEGENDARY}</span> E:
                        <span className="text-yellow-400">{p.tierCounts.EPIC}</span> SR:
                        <span className="text-purple-400">{p.tierCounts.SR}</span> R:
                        <span className="text-sky-400">{p.tierCounts.RARE}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
