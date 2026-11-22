import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  PullResultItem,
  Tier,
  TIER_GLOW_RGBA,
  TIER_LABEL,
  TIER_PARTICLE,
  TIER_RANK,
} from '../types/gacha';
import { sfxPlay, stopActiveSfx } from '../utils/sfx';

interface PullOverlayProps {
  active: boolean;
  results: PullResultItem[];
  allItemNames: string[];
  onComplete: (wasSkipped: boolean) => void;
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number): void {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const hw = size * 0.68;
  ctx.beginPath();
  ctx.moveTo(x + size * sin, y - size * cos);
  ctx.lineTo(x + hw * cos, y + hw * sin);
  ctx.lineTo(x - size * sin, y + size * cos);
  ctx.lineTo(x - hw * cos, y - hw * sin);
  ctx.closePath();
  ctx.fill();
}

function drawLightningArc(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  angle: number,
  length: number,
  segments: number,
  color: string,
  alpha: number
): void {
  const pts: Array<{ x: number; y: number }> = [{ x: x1, y: y1 }];
  const step = length / segments;
  const perpX = Math.cos(angle + Math.PI / 2);
  const perpY = Math.sin(angle + Math.PI / 2);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  for (let s = 1; s <= segments; s++) {
    const jitter = (Math.random() - 0.5) * 26;
    pts.push({
      x: x1 + cosA * step * s + perpX * jitter,
      y: y1 + sinA * step * s + perpY * jitter,
    });
  }
  ctx.globalAlpha = alpha * 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
}

export function fireTierConfetti(tier: Tier): void {
  const cols = TIER_PARTICLE[tier] || TIER_PARTICLE.SR;
  if (tier === 'SR') {
    confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: cols });
  } else if (tier === 'EPIC') {
    confetti({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0.12, y: 0.65 }, colors: cols });
    confetti({ particleCount: 70, angle: 120, spread: 60, origin: { x: 0.88, y: 0.65 }, colors: cols });
  } else if (tier === 'LEGENDARY') {
    confetti({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0.12, y: 0.65 }, colors: cols });
    confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 0.88, y: 0.65 }, colors: cols });
    confetti({ particleCount: 80, spread: 100, origin: { x: 0.5, y: 0.55 }, colors: cols });
  }
}

export const PullOverlay: React.FC<PullOverlayProps> = ({ active, results, allItemNames, onComplete }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const climaxRef = useRef<HTMLDivElement>(null);
  const corePodRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLDivElement>(null);
  const tierAlertRef = useRef<HTMLDivElement>(null);
  const shuffleTextRef = useRef<HTMLDivElement>(null);
  const shuffleCounterRef = useRef<HTMLDivElement>(null);
  const chargeFillRef = useRef<HTMLDivElement>(null);
  const hudStatusRef = useRef<HTMLSpanElement>(null);
  const hudFreqRef = useRef<HTMLSpanElement>(null);

  const settleRef = useRef<((skipped: boolean) => void) | null>(null);

  useEffect(() => {
    if (!active || results.length === 0) return;

    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const climaxFx = climaxRef.current;
    const corePod = corePodRef.current;
    const orbEl = orbRef.current;
    const tierAlert = tierAlertRef.current;
    const shuffleText = shuffleTextRef.current;
    const shuffleCounter = shuffleCounterRef.current;
    const chargeFill = chargeFillRef.current;
    const hudStatus = hudStatusRef.current;
    const hudFreq = hudFreqRef.current;

    if (
      !overlay ||
      !canvas ||
      !ctx ||
      !climaxFx ||
      !corePod ||
      !orbEl ||
      !tierAlert ||
      !shuffleText ||
      !shuffleCounter ||
      !chargeFill
    ) {
      onComplete(false);
      return;
    }

    const timeouts: number[] = [];
    const intervals: number[] = [];
    let rafId: number | null = null;
    let settled = false;

    const cleanup = () => {
      timeouts.forEach((t) => window.clearTimeout(t));
      intervals.forEach((i) => window.clearInterval(i));
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      stopActiveSfx();
      document.body.classList.remove('pulling-active');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      overlay.classList.remove('ak-screen-shake');
      corePod.classList.remove('ak-core-charging', 'ak-core-breach');
      climaxFx.innerHTML = '';
    };

    const settle = (wasSkipped: boolean) => {
      if (settled) return;
      settled = true;
      settleRef.current = null;
      cleanup();
      onComplete(wasSkipped);
    };
    settleRef.current = settle;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.classList.add('pulling-active');

    orbEl.style.transition = 'none';
    orbEl.style.transform = 'scale(1)';
    orbEl.style.opacity = '1';
    climaxFx.innerHTML = '';
    chargeFill.style.width = '0%';
    tierAlert.classList.remove('ak-tier-stepup', 'ak-breach-flash');

    const highestRarity: Tier = results.reduce<Tier>(
      (best, r) => (TIER_RANK[r.rarity] > TIER_RANK[best] ? r.rarity : best),
      'COMMON'
    );
    const finalColors = TIER_PARTICLE[highestRarity] || TIER_PARTICLE.COMMON;

    const escalationMap: Record<Tier, Tier[]> = {
      COMMON: ['COMMON'],
      UNCOMMON: ['COMMON', 'UNCOMMON'],
      RARE: ['COMMON', 'UNCOMMON', 'RARE'],
      SR: ['COMMON', 'RARE', 'SR'],
      EPIC: ['COMMON', 'RARE', 'SR', 'EPIC'],
      LEGENDARY: ['COMMON', 'RARE', 'SR', 'EPIC', 'LEGENDARY'],
    };
    const escalationPath = escalationMap[highestRarity] || ['COMMON'];
    let activeColors = TIER_PARTICLE[escalationPath[0]] || TIER_PARTICLE.COMMON;

    const applyTierTheme = (tier: Tier, isStepUp: boolean) => {
      activeColors = TIER_PARTICLE[tier] || TIER_PARTICLE.COMMON;
      const col = activeColors[0];
      const glow = TIER_GLOW_RGBA[tier] || 'rgba(255,127,17,.5)';
      overlay.style.setProperty('--ak-fx-color', col);
      overlay.style.setProperty('--ak-fx-glow', glow);
      orbEl.style.filter = `drop-shadow(0 0 24px ${glow})`;
      tierAlert.style.display = 'block';
      tierAlert.textContent = `SIGNAL: ${(TIER_LABEL[tier] || tier).toUpperCase()}`;
      if (isStepUp) {
        tierAlert.classList.remove('ak-tier-stepup');
        void tierAlert.offsetWidth;
        tierAlert.classList.add('ak-tier-stepup');
      }
    };

    applyTierTheme(escalationPath[0], false);
    corePod.classList.add('ak-core-charging');
    shuffleText.style.display = 'block';
    shuffleText.textContent = 'MENGANALISIS SINYAL...';
    shuffleCounter.style.display = 'block';
    if (hudStatus) hudStatus.textContent = 'SCANNING FREQUENCY...';
    if (hudFreq) hudFreq.textContent = 'FREQ 00%';
    sfxPlay('charge', highestRarity);

    let sf = 0;
    if (allItemNames.length > 0) {
      shuffleCounter.textContent = allItemNames[0];
      intervals.push(
        window.setInterval(() => {
          shuffleCounter.textContent = allItemNames[sf % allItemNames.length];
          sf++;
        }, 65)
      );
    } else {
      shuffleCounter.textContent = 'RECRUITMENT';
    }

    if (escalationPath.length > 1) {
      const stepSpan = 1050 / escalationPath.length;
      for (let idx = 1; idx < escalationPath.length; idx++) {
        const targetTier = escalationPath[idx];
        timeouts.push(
          window.setTimeout(() => {
            if (settled) return;
            applyTierTheme(targetTier, true);
            sfxPlay('stepup', targetTier);
            shuffleText.textContent =
              idx === escalationPath.length - 1
                ? `⚡ UPGRADE SINYAL: ${(TIER_LABEL[targetTier] || targetTier).toUpperCase()}!`
                : `SINYAL MENINGKAT → ${(TIER_LABEL[targetTier] || targetTier).toUpperCase()}`;
          }, Math.round(stepSpan * idx))
        );
      }
    }

    let phase = 1;
    let warpShards: Array<{ x: number; y: number; ang: number; speed: number; size: number; color: string }> = [];
    let burstDiamonds: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      rot: number;
      vRot: number;
      color: string;
      life: number;
    }> = [];
    let embers: Array<{ x: number; y: number; vx: number; vy: number; size: number; color: string; life: number }> = [];
    const startTs = performance.now();
    let lastTs = startTs;
    let lastDrawTs = startTs;

    // Phase 2: Zipper Laser Slash
    timeouts.push(
      window.setTimeout(() => {
        if (settled) return;
        phase = 2;
        stopActiveSfx();
        sfxPlay('zipper', highestRarity);
        applyTierTheme(highestRarity, false);
        chargeFill.style.width = '100%';
        if (hudFreq) hudFreq.textContent = 'FREQ 100%';
        if (hudStatus) hudStatus.textContent = 'BREACH DETECTED!';
        shuffleText.textContent = `⚡ SIGNAL BREACH: ${(TIER_LABEL[highestRarity] || highestRarity).toUpperCase()} ⚡`;
        tierAlert.textContent = `BREACH // ${(TIER_LABEL[highestRarity] || highestRarity).toUpperCase()}`;
        tierAlert.classList.add('ak-breach-flash');

        orbEl.style.transition = 'transform .35s cubic-bezier(.4,0,.2,1)';
        orbEl.style.transform = 'scale(.72)';

        const slash = document.createElement('div');
        slash.className = 'ak-laser-slash';
        climaxFx.appendChild(slash);

        if (TIER_RANK[highestRarity] >= TIER_RANK.SR) {
          overlay.classList.add('ak-screen-shake');
        }
      }, 1250)
    );

    // Phase 3: Pillar Eruption & Confetti
    timeouts.push(
      window.setTimeout(() => {
        if (settled) return;
        phase = 3;
        sfxPlay('burst', highestRarity);
        corePod.classList.remove('ak-core-charging');
        corePod.classList.add('ak-core-breach');
        shuffleText.style.display = 'none';
        shuffleCounter.style.display = 'none';
        tierAlert.style.display = 'none';
        if (hudStatus) hudStatus.textContent = `${(TIER_LABEL[highestRarity] || highestRarity).toUpperCase()} CONFIRMED`;

        orbEl.style.transition = 'transform .18s ease-out, opacity .18s ease-out';
        orbEl.style.transform = 'scale(1.65)';
        orbEl.style.opacity = '0';

        const flash = document.createElement('div');
        flash.className = 'ak-breach-bg-flash';
        climaxFx.appendChild(flash);

        const pillar = document.createElement('div');
        pillar.className = 'ak-light-pillar';
        climaxFx.appendChild(pillar);

        const sw1 = document.createElement('div');
        sw1.className = 'ak-shockwave';
        climaxFx.appendChild(sw1);
        timeouts.push(
          window.setTimeout(() => {
            if (settled) return;
            const sw2 = document.createElement('div');
            sw2.className = 'ak-shockwave';
            climaxFx.appendChild(sw2);
          }, 120)
        );

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const shardCount = TIER_RANK[highestRarity] >= TIER_RANK.EPIC ? 110 : 80;
        for (let i = 0; i < shardCount; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 4 + Math.random() * 14;
          burstDiamonds.push({
            x: cx,
            y: cy,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            size: 3 + Math.random() * 6,
            rot: Math.random() * Math.PI,
            vRot: (Math.random() - 0.5) * 0.25,
            color: finalColors[i % finalColors.length],
            life: 1,
          });
        }
        for (let i = 0; i < 32; i++) {
          embers.push({
            x: cx + (Math.random() - 0.5) * 110,
            y: canvas.height * 0.55 + (Math.random() - 0.5) * 220,
            vx: (Math.random() - 0.5) * 1.4,
            vy: -(2.5 + Math.random() * 5.5),
            size: 2 + Math.random() * 3.5,
            color: finalColors[i % finalColors.length],
            life: 1,
          });
        }

        if (highestRarity === 'SR') {
          confetti({ particleCount: 75, angle: 60, spread: 58, origin: { x: 0.1, y: 0.7 }, colors: finalColors });
          confetti({ particleCount: 75, angle: 120, spread: 58, origin: { x: 0.9, y: 0.7 }, colors: finalColors });
        } else if (highestRarity === 'EPIC') {
          confetti({ particleCount: 85, angle: 60, spread: 65, origin: { x: 0.1, y: 0.7 }, colors: finalColors });
          confetti({ particleCount: 85, angle: 120, spread: 65, origin: { x: 0.9, y: 0.7 }, colors: finalColors });
          confetti({ particleCount: 90, spread: 95, origin: { x: 0.5, y: 0.5 }, colors: finalColors });
        } else if (highestRarity === 'LEGENDARY') {
          confetti({ particleCount: 100, angle: 58, spread: 70, origin: { x: 0.08, y: 0.72 }, colors: finalColors });
          confetti({ particleCount: 100, angle: 122, spread: 70, origin: { x: 0.92, y: 0.72 }, colors: finalColors });
          confetti({ particleCount: 120, spread: 110, origin: { x: 0.5, y: 0.48 }, colors: finalColors });
          timeouts.push(
            window.setTimeout(() => {
              if (!settled) {
                confetti({ particleCount: 90, spread: 120, origin: { x: 0.5, y: 0.3 }, colors: finalColors });
              }
            }, 300)
          );
        }
      }, 1650)
    );

    timeouts.push(window.setTimeout(() => settle(false), 2750));

    const renderLoop = (now: number) => {
      if (settled) return;
      if (now - lastDrawTs < 15.5) {
        rafId = window.requestAnimationFrame(renderLoop);
        return;
      }
      lastDrawTs = now;
      const dt = Math.min(3, Math.max(0.2, (now - lastTs) / 16.67));
      lastTs = now;
      const elapsed = now - startTs;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (phase === 1 || phase === 2) {
        const pct = Math.min(100, Math.round((elapsed / 1250) * 100));
        if (phase === 1) {
          chargeFill.style.width = `${pct}%`;
          if (hudFreq) hudFreq.textContent = `FREQ ${String(pct).padStart(2, '0')}%`;
        }
        const spawnRate = phase === 2 ? 5 : 3;
        const maxR = Math.max(canvas.width, canvas.height) * 0.62;
        for (let i = 0; i < spawnRate; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = maxR * (0.75 + Math.random() * 0.25);
          warpShards.push({
            x: cx + Math.cos(ang) * dist,
            y: cy + Math.sin(ang) * dist,
            ang,
            speed: (phase === 2 ? 15 : 8) + Math.random() * 7,
            size: 2.5 + Math.random() * 3.5,
            color: activeColors[Math.floor(Math.random() * activeColors.length)],
          });
        }
        const nextWarp: typeof warpShards = [];
        ctx.lineWidth = 1.6;
        warpShards.forEach((s) => {
          const move = s.speed * dt;
          const px = s.x;
          const py = s.y;
          s.x -= Math.cos(s.ang) * move;
          s.y -= Math.sin(s.ang) * move;
          const distToCenter = Math.hypot(cx - s.x, cy - s.y);
          if (distToCenter > 22) {
            ctx.globalAlpha = Math.min(0.95, distToCenter / 180);
            ctx.strokeStyle = s.color;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(s.x, s.y);
            ctx.stroke();
            ctx.fillStyle = s.color;
            drawDiamond(ctx, s.x, s.y, s.size, s.ang);
            nextWarp.push(s);
          }
        });
        ctx.globalAlpha = 1;
        warpShards = nextWarp;
      } else if (phase === 3) {
        if (elapsed < 2280) {
          const boltCount = TIER_RANK[highestRarity] >= TIER_RANK.SR ? 4 : 2;
          for (let b = 0; b < boltCount; b++) {
            if (Math.random() < 0.72) {
              drawLightningArc(
                ctx,
                cx,
                cy,
                Math.random() * Math.PI * 2,
                90 + Math.random() * 170,
                5,
                finalColors[b % finalColors.length],
                0.75
              );
            }
          }
        }

        burstDiamonds.forEach((p) => {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.pow(0.97, dt);
          p.vy = p.vy * Math.pow(0.97, dt) + 0.14 * dt;
          p.rot += p.vRot * dt;
          p.life -= 0.014 * dt;
          if (p.life > 0) {
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.fillStyle = p.color;
            drawDiamond(ctx, p.x, p.y, p.size, p.rot);
          }
        });
        burstDiamonds = burstDiamonds.filter((p) => p.life > 0);

        embers.forEach((e) => {
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          e.life -= 0.015 * dt;
          if (e.life > 0) {
            ctx.globalAlpha = Math.max(0, e.life * 0.85);
            ctx.fillStyle = e.color;
            drawDiamond(ctx, e.x, e.y, e.size, 0);
          }
        });
        embers = embers.filter((e) => e.life > 0);
        ctx.globalAlpha = 1;
      }

      rafId = window.requestAnimationFrame(renderLoop);
    };

    rafId = window.requestAnimationFrame(renderLoop);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        settle(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      cleanup();
    };
  }, [active, results, allItemNames, onComplete]);

  if (!active) return null;

  return (
    <>
      <div ref={overlayRef} className="pull-overlay active">
        <canvas ref={canvasRef} className="fixed inset-0 z-[101] pointer-events-none" />
        <div ref={climaxRef} className="absolute inset-0 pointer-events-none z-[104] overflow-hidden" />
        <div className="ak-hud-bar ak-hud-top">
          <span className="text-orange-400">// ZEROTH.RECRUITMENT</span>
          <span ref={hudStatusRef}>LOCKING SIGNAL...</span>
        </div>
        <div className="relative z-[102] flex flex-col items-center gap-[14px]">
          <div ref={tierAlertRef} className="ak-tier-alert" style={{ display: 'none' }}>
            SIGNAL: STANDBY
          </div>
          <div ref={corePodRef} className="ak-core-pod">
            <div className="ak-radar-ring" />
            <div className="ak-radar-ring-rev" />
            <div
              ref={orbRef}
              className="ak-pull-orb w-32 h-32 flex items-center justify-center relative"
              style={{
                background: 'var(--logo) center/contain no-repeat',
                filter: 'drop-shadow(0 0 20px rgba(255,127,17,.45))',
              }}
            />
          </div>
          <div
            ref={shuffleTextRef}
            className="shuffle-text text-base text-orange-300 tracking-widest text-center px-3"
            style={{ display: 'none' }}
          >
            MENGANALISIS SINYAL...
          </div>
          <div className="ak-charge-bar">
            <div ref={chargeFillRef} className="ak-charge-fill" />
          </div>
          <div
            ref={shuffleCounterRef}
            className="text-sm text-neutral-300 tabular-nums px-3 py-1 rounded bg-neutral-900/70 border border-orange-500/30"
            style={{ display: 'none' }}
          />
        </div>
        <div className="ak-hud-bar ak-hud-bottom">
          <span>AKID-MALANG // DROP POD</span>
          <span ref={hudFreqRef}>FREQ 00%</span>
        </div>
      </div>
      <button type="button" className="skip-btn" onClick={() => settleRef.current?.(true)}>
        SKIP ⏭
      </button>
    </>
  );
};
