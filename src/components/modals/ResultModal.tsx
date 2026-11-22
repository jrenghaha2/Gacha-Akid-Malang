import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  PullResultItem,
  Tier,
  TIER_EMOJI,
  TIER_GLOW_RGBA,
  TIER_LABEL,
  TIER_PARTICLE,
  TIER_RANK,
} from '../../types/gacha';
import { sfxPlay } from '../../utils/sfx';
import { fireTierConfetti } from '../PullOverlay';

interface ResultModalProps {
  isOpen: boolean;
  results: PullResultItem[];
  instantReveal: boolean;
  onClose: () => void;
}

const STARS_BY_TIER: Record<Tier, string> = {
  LEGENDARY: '★★★★★★',
  EPIC: '★★★★★',
  SR: '★★★★',
  RARE: '★★★',
  UNCOMMON: '★★',
  COMMON: '★',
};

export const ResultModal: React.FC<ResultModalProps> = ({ isOpen, results, instantReveal, onClose }) => {
  const [revealedCount, setRevealedCount] = useState(0);
  const [canClose, setCanClose] = useState(false);
  const timersRef = useRef<number[]>([]);

  const highestRarity = useMemo<Tier>(() => {
    return results.reduce<Tier>((best, r) => (TIER_RANK[r.rarity] > TIER_RANK[best] ? r.rarity : best), 'COMMON');
  }, [results]);

  const termGlow = TIER_GLOW_RGBA[highestRarity] || 'rgba(255,127,17,.22)';

  const clearTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  useEffect(() => {
    clearTimers();
    if (!isOpen || results.length === 0) {
      setRevealedCount(0);
      setCanClose(false);
      return;
    }

    if (instantReveal) {
      setRevealedCount(results.length);
      setCanClose(true);
      if (TIER_RANK[highestRarity] >= TIER_RANK.SR) {
        fireTierConfetti(highestRarity);
      }
      sfxPlay('reveal', highestRarity);
      return;
    }

    setRevealedCount(0);
    setCanClose(false);

    const stepMs = results.length > 10 ? 320 : 900;
    results.forEach((item, idx) => {
      const tid = window.setTimeout(() => {
        setRevealedCount((prev) => Math.max(prev, idx + 1));
        sfxPlay('reveal', item.rarity);
        if (TIER_RANK[item.rarity] >= TIER_RANK.SR) {
          fireTierConfetti(item.rarity);
        }
        if (idx === results.length - 1) {
          setCanClose(true);
        }
      }, idx * stepMs + 140);
      timersRef.current.push(tid);
    });

    return () => clearTimers();
  }, [isOpen, results, instantReveal, highestRarity]);

  const handleSkipCards = () => {
    clearTimers();
    sfxPlay('click');
    setRevealedCount(results.length);
    setCanClose(true);
    if (TIER_RANK[highestRarity] >= TIER_RANK.SR) {
      fireTierConfetti(highestRarity);
    }
  };

  if (!isOpen) return null;

  const isSingle = results.length === 1;
  const isRevealing = revealedCount < results.length;

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
      <div
        className="modal-enter ak-result-terminal w-full max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden"
        style={{ '--ak-term-glow': termGlow } as React.CSSProperties}
      >
        <div className="ak-hazard-strip shrink-0" />
        <div className="px-4 sm:px-6 pt-4 pb-3 border-b border-orange-500/25 flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="font-mono-tech text-[10px] tracking-[0.18em] text-orange-400">
              // ZEROTH HEADHUNTING // ACQUISITION REPORT
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-wider text-white uppercase">
              HASIL REKRUTMEN ({results.length}×)
            </h2>
          </div>
          <div className="font-mono-tech text-[11px] text-neutral-400 text-right">
            <div>HIGHEST SIGNAL</div>
            <div style={{ color: TIER_PARTICLE[highestRarity][0] }} className="font-bold">
              {(TIER_LABEL[highestRarity] || highestRarity).toUpperCase()}
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto scroll-area flex-1 results-perspective">
          <div
            className={
              isSingle
                ? 'max-w-[230px] mx-auto my-2'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
            }
          >
            {results.map((item, idx) => {
              const shown = idx < revealedCount;
              const accent = TIER_PARTICLE[item.rarity]?.[0] || '#9ca3af';
              const glow = TIER_GLOW_RGBA[item.rarity] || 'rgba(156,163,175,.35)';
              const isHigh = TIER_RANK[item.rarity] >= TIER_RANK.SR;
              const isEpicPlus = TIER_RANK[item.rarity] >= TIER_RANK.EPIC;

              return (
                <div
                  key={`${idx}-${item.name}-${item.rarity}`}
                  className={`ak-dossier-card ${isSingle ? 'ak-spotlight' : ''} ${
                    shown ? 'card-show' : 'card-hidden'
                  } ${isHigh ? 'ak-card-holo' : ''} ${isEpicPlus ? 'ak-card-impact' : ''}`}
                  style={
                    {
                      '--card-accent': accent,
                      '--card-glow': glow,
                    } as React.CSSProperties
                  }
                >
                  <div className="ak-dossier-strip" />
                  <div className="ak-dossier-watermark" />
                  <div className="ak-beam-drop" />

                  <div className="ak-dossier-top">
                    <span className="ak-dossier-stars">{STARS_BY_TIER[item.rarity]}</span>
                    <span className="ak-dossier-slot">#{String(idx + 1).padStart(2, '0')}</span>
                  </div>

                  <div className="ak-class-emblem">
                    <span className={isSingle ? 'text-4xl' : 'text-3xl'}>{TIER_EMOJI[item.rarity]}</span>
                  </div>

                  <div className="ak-dossier-plate">
                    <div className="ak-dossier-meta">
                      <span className="ak-dossier-tier">{TIER_LABEL[item.rarity].toUpperCase()}</span>
                      {item.pity && <span className="ak-dossier-pity">⚡ PITY LOCK</span>}
                    </div>
                    <div className="ak-dossier-name">{item.name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3.5 border-t border-orange-500/25 bg-[#0b0e14]/90 flex items-center justify-between gap-3 shrink-0">
          <div className="font-mono-tech text-[11px] text-neutral-400">
            TERBUKA: <span className="text-orange-400 font-bold">{revealedCount}</span> / {results.length}
          </div>
          <div className="flex items-center gap-2">
            {isRevealing ? (
              <button
                type="button"
                onClick={handleSkipCards}
                className="btn-press px-5 py-2 bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500/60 text-orange-300 text-xs font-bold tracking-widest"
              >
                SKIP ⏭
              </button>
            ) : (
              <button
                type="button"
                disabled={!canClose}
                onClick={() => {
                  sfxPlay('click');
                  onClose();
                }}
                className="btn-press px-7 py-2.5 bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs sm:text-sm font-bold tracking-widest ak-cut"
              >
                KONFIRMASI ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
