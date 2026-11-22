import React, { useMemo, useState } from 'react';
import {
  HistoryEntry,
  Tier,
  TIER_EMOJI,
  TIER_HISTORY_CLS,
  TIER_LABEL,
  TIER_RANK,
  TIERS,
} from '../../types/gacha';
import { sfxPlay } from '../../utils/sfx';

interface FullHistoryModalProps {
  isOpen: boolean;
  history: HistoryEntry[];
  onClose: () => void;
}

type SortKey = 'newest' | 'oldest' | 'tier' | 'itemAZ' | 'playerAZ';

export const FullHistoryModal: React.FC<FullHistoryModalProps> = ({ isOpen, history, onClose }) => {
  const [search, setSearch] = useState('');
  const [playerFilter, setPlayerFilter] = useState('ALL');
  const [tierFilter, setTierFilter] = useState<'ALL' | Tier>('ALL');
  const [itemFilter, setItemFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('newest');

  const uniquePlayers = useMemo(() => {
    return Array.from(new Set(history.map((h) => h.playerName).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [history]);

  const uniqueItems = useMemo(() => {
    return Array.from(new Set(history.map((h) => h.itemName).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [history]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    const list = history.filter((h) => {
      if (playerFilter !== 'ALL' && h.playerName !== playerFilter) return false;
      if (tierFilter !== 'ALL' && h.rarity !== tierFilter) return false;
      if (itemFilter !== 'ALL' && h.itemName !== itemFilter) return false;
      if (fromMs !== null && h.timeMs < fromMs) return false;
      if (toMs !== null && h.timeMs > toMs) return false;
      if (q) {
        const hay = `${h.playerName} ${h.itemName} ${h.rarity} ${TIER_LABEL[h.rarity]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === 'newest') sorted.sort((a, b) => b.timeMs - a.timeMs);
    else if (sortBy === 'oldest') sorted.sort((a, b) => a.timeMs - b.timeMs);
    else if (sortBy === 'tier') sorted.sort((a, b) => TIER_RANK[b.rarity] - TIER_RANK[a.rarity] || b.timeMs - a.timeMs);
    else if (sortBy === 'itemAZ') sorted.sort((a, b) => a.itemName.localeCompare(b.itemName) || b.timeMs - a.timeMs);
    else if (sortBy === 'playerAZ')
      sorted.sort((a, b) => a.playerName.localeCompare(b.playerName) || b.timeMs - a.timeMs);
    return sorted;
  }, [history, search, playerFilter, tierFilter, itemFilter, dateFrom, dateTo, sortBy]);

  const handleReset = () => {
    sfxPlay('click');
    setSearch('');
    setPlayerFilter('ALL');
    setTierFilter('ALL');
    setItemFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setSortBy('newest');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-enter ak-cut bg-[#12151a] border border-orange-500/45 w-full max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-orange-500/25 flex items-center justify-between shrink-0">
          <div>
            <div className="font-mono-tech text-[10px] text-orange-400 tracking-widest">
              // RECRUITMENT ARCHIVE // {filtered.length} / {history.length} ENTRIES
            </div>
            <h3 className="text-lg font-bold text-white tracking-wider uppercase">📜 RIWAYAT LENGKAP</h3>
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

        <div className="p-4 border-b border-neutral-800 bg-[#0e1116] space-y-2.5 shrink-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Cari player, item, atau tier..."
              className="admin-input"
            />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="admin-input"
            >
              <option value="newest">Urutkan: Terbaru</option>
              <option value="oldest">Urutkan: Terlama</option>
              <option value="tier">Urutkan: Tier Tertinggi</option>
              <option value="itemAZ">Urutkan: Nama Item (A-Z)</option>
              <option value="playerAZ">Urutkan: Nama Player (A-Z)</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select
              value={playerFilter}
              onChange={(e) => setPlayerFilter(e.target.value)}
              className="admin-input text-xs"
            >
              <option value="ALL">Semua Player</option>
              {uniquePlayers.map((pl) => (
                <option key={pl} value={pl}>
                  {pl}
                </option>
              ))}
            </select>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as 'ALL' | Tier)}
              className="admin-input text-xs"
            >
              <option value="ALL">Semua Tier</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABEL[t]}
                </option>
              ))}
            </select>
            <select
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="admin-input text-xs"
            >
              <option value="ALL">Semua Item</option>
              {uniqueItems.map((it) => (
                <option key={it} value={it}>
                  {it}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
            <div>
              <label className="block text-[10px] font-mono-tech text-neutral-400 mb-0.5">DARI TANGGAL</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="admin-input !py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono-tech text-neutral-400 mb-0.5">SAMPAI TANGGAL</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="admin-input !py-1.5 text-xs"
              />
            </div>
            <div className="col-span-2 sm:col-span-1 sm:self-end">
              <button
                type="button"
                onClick={handleReset}
                className="btn-press w-full py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-300 text-xs font-bold"
              >
                ↺ RESET FILTER
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 overflow-y-auto scroll-area flex-1 space-y-1.5">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-xs text-neutral-500">
              Tidak ada riwayat pull yang cocok dengan filter.
            </div>
          ) : (
            filtered.slice(0, 500).map((entry) => {
              const dt = entry.timeMs
                ? new Date(entry.timeMs).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '-';
              return (
                <div
                  key={entry.id}
                  className={`px-3 py-2 rounded-sm flex items-center justify-between gap-2 text-xs ${TIER_HISTORY_CLS[entry.rarity]}`}
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span>{TIER_EMOJI[entry.rarity]}</span>
                    <div className="min-w-0">
                      <div className="font-bold truncate">
                        {entry.itemName}{' '}
                        {entry.isPity && (
                          <span className="font-mono-tech text-[9px] px-1 py-0.5 bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 ml-1">
                            PITY
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-80 truncate">
                        {entry.playerName} · {TIER_LABEL[entry.rarity]}
                      </div>
                    </div>
                  </div>
                  <div className="font-mono-tech text-[10px] opacity-75 shrink-0">{dt}</div>
                </div>
              );
            })
          )}
          {filtered.length > 500 && (
            <div className="text-center py-2 font-mono-tech text-[10px] text-neutral-500">
              Menampilkan 500 entri teratas dari {filtered.length} hasil. Gunakan filter untuk mempersempit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
