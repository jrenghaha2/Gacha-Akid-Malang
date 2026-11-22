import { Tier, TIER_RANK } from '../types/gacha';

let audioCtx: AudioContext | null = null;
let activeSfxNodes: AudioScheduledSourceNode[] = [];
let noiseBufferCache: AudioBuffer | null = null;
let isSfxEnabledGlobal = true;

export function setSfxEnabledGlobal(enabled: boolean): void {
  isSfxEnabledGlobal = enabled;
  if (!enabled) stopActiveSfx();
}

function ensureAudioCtx(): AudioContext | null {
  if (!isSfxEnabledGlobal) return null;
  try {
    const AudioContextCtor =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioCtx) audioCtx = new AudioContextCtor();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function getNoiseBuffer(ctx: AudioContext): AudioBuffer | null {
  if (noiseBufferCache && noiseBufferCache.sampleRate === ctx.sampleRate) return noiseBufferCache;
  try {
    const len = Math.floor(ctx.sampleRate * 1.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    noiseBufferCache = buf;
    return buf;
  } catch {
    return null;
  }
}

function trackSfxNode(node: AudioScheduledSourceNode): void {
  activeSfxNodes.push(node);
  if (activeSfxNodes.length > 160) activeSfxNodes.shift();
}

export function stopActiveSfx(): void {
  activeSfxNodes.forEach((node) => {
    try {
      node.stop();
    } catch {
      // ignore already stopped
    }
    try {
      node.disconnect();
    } catch {
      // ignore
    }
  });
  activeSfxNodes = [];
}

interface FilterOpts {
  type?: BiquadFilterType;
  freq?: number;
  endFreq?: number;
  q?: number;
}

function playTone(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.08,
  endFreq: number | null = null,
  filterOpts: FilterOpts | null = null,
  track = true
): void {
  try {
    const t0 = ctx.currentTime + Math.max(0, startOffset || 0);
    const dur = Math.max(0.015, duration || 0.1);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(25, freq), t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(25, endFreq), t0 + dur);

    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, volume), t0 + Math.min(0.015, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    if (filterOpts) {
      const flt = ctx.createBiquadFilter();
      flt.type = filterOpts.type || 'lowpass';
      flt.frequency.setValueAtTime(Math.max(40, filterOpts.freq || 1200), t0);
      if (filterOpts.endFreq) flt.frequency.exponentialRampToValueAtTime(Math.max(40, filterOpts.endFreq), t0 + dur);
      if (filterOpts.q) flt.Q.setValueAtTime(filterOpts.q, t0);
      osc.connect(flt);
      flt.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
    if (track) trackSfxNode(osc);
  } catch {
    // ignore audio errors
  }
}

function playFilteredNoise(
  ctx: AudioContext,
  startOffset: number,
  duration: number,
  filterType: BiquadFilterType,
  startFreq: number,
  endFreq: number | null,
  q = 2,
  volume = 0.08,
  track = true
): void {
  try {
    const buf = getNoiseBuffer(ctx);
    if (!buf) return;
    const t0 = ctx.currentTime + Math.max(0, startOffset || 0);
    const dur = Math.max(0.012, duration || 0.08);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const flt = ctx.createBiquadFilter();
    flt.type = filterType || 'bandpass';
    flt.frequency.setValueAtTime(Math.max(40, startFreq || 1200), t0);
    if (endFreq) flt.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
    flt.Q.setValueAtTime(q, t0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, volume), t0 + Math.min(0.01, dur * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(flt);
    flt.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0, Math.random() * 0.5, dur + 0.03);
    src.stop(t0 + dur + 0.03);
    if (track) trackSfxNode(src);
  } catch {
    // ignore
  }
}

export type SfxKind = 'click' | 'charge' | 'stepup' | 'zipper' | 'burst' | 'reveal';

export function sfxPlay(kind: SfxKind, rarity: Tier = 'COMMON'): void {
  if (!isSfxEnabledGlobal) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const rank = TIER_RANK[rarity] || 1;

  if (kind === 'click') {
    playTone(ctx, 1350, 0, 0.032, 'triangle', 0.05, 920, null, false);
    playFilteredNoise(ctx, 0, 0.022, 'highpass', 3200, 4800, 1.5, 0.025, false);
    return;
  }

  if (kind === 'charge') {
    stopActiveSfx();
    playTone(ctx, 75, 0, 1.24, 'sawtooth', 0.07, 130, { type: 'lowpass', freq: 240, endFreq: 520, q: 2.5 });
    playTone(ctx, 150, 0, 1.22, 'triangle', 0.04, 260, { type: 'lowpass', freq: 380, endFreq: 760 });
    playFilteredNoise(ctx, 0, 1.22, 'highpass', 1600, 3400, 1.8, 0.02);
    [0, 0.24, 0.48, 0.72, 0.96].forEach((off, i) => {
      playTone(ctx, 740 + i * 60, off, 0.08, 'sine', 0.048);
    });
    return;
  }

  if (kind === 'stepup') {
    const base = 620 + rank * 115;
    playTone(ctx, base, 0, 0.14, 'triangle', 0.065);
    playTone(ctx, base * 1.498, 0.025, 0.15, 'sine', 0.055);
    playFilteredNoise(ctx, 0, 0.04, 'bandpass', 2800, 4200, 3, 0.03);
    return;
  }

  if (kind === 'zipper') {
    for (let i = 0; i < 20; i++) {
      const off = i * 0.017;
      const zFreq = 1800 + (i / 19) * 3400;
      playFilteredNoise(ctx, off, 0.014, 'bandpass', zFreq, zFreq * 1.15, 4.5, 0.055 + i * 0.0018);
      playTone(ctx, 1400 + i * 90, off, 0.013, 'triangle', 0.022);
    }
    playTone(ctx, 1100, 0.26, 0.17, 'sawtooth', 0.075, 240, { type: 'bandpass', freq: 2400, endFreq: 680, q: 2.2 });
    if (rank >= 4) {
      playTone(ctx, 1174.66, 0.27, 0.12, 'sine', 0.065);
      playTone(ctx, 1567.98, 0.33, 0.14, 'sine', 0.065);
    }
    return;
  }

  if (kind === 'burst') {
    playTone(ctx, 120, 0, 0.42, 'sine', 0.14, 32, null, false);
    playTone(ctx, 160, 0, 0.32, 'triangle', 0.09, 44, null, false);
    playFilteredNoise(ctx, 0, 0.45, 'lowpass', 2600, 180, 1.2, 0.1, false);

    if (rarity === 'LEGENDARY') {
      playFilteredNoise(ctx, 0.02, 0.68, 'bandpass', 350, 1200, 2.2, 0.095, false);
      [587.33, 739.99, 880, 1174.66, 1479.98].forEach((f, idx) => {
        playTone(ctx, f, 0.04 + idx * 0.055, idx === 4 ? 0.72 : 0.32, 'triangle', 0.085, null, null, false);
      });
      playTone(ctx, 1760, 0.26, 0.65, 'sine', 0.065, null, null, false);
    } else if (rarity === 'EPIC') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        playTone(ctx, f, 0.03 + idx * 0.06, idx === 3 ? 0.55 : 0.26, 'triangle', 0.08, null, null, false);
      });
      playTone(ctx, 1318.51, 0.22, 0.48, 'sine', 0.055, null, null, false);
    } else if (rarity === 'SR') {
      [440, 554.37, 659.25, 880].forEach((f, idx) => {
        playTone(ctx, f, 0.03 + idx * 0.055, idx === 3 ? 0.42 : 0.2, 'triangle', 0.075, null, null, false);
      });
    } else if (rarity === 'RARE') {
      [523.25, 659.25, 783.99].forEach((f, idx) => {
        playTone(ctx, f, 0.02 + idx * 0.055, 0.22, 'sine', 0.07, null, null, false);
      });
    } else {
      playTone(ctx, 523.25, 0.02, 0.16, 'sine', 0.06, null, null, false);
      playTone(ctx, 659.25, 0.08, 0.18, 'sine', 0.06, null, null, false);
    }
    return;
  }

  if (kind === 'reveal') {
    playFilteredNoise(ctx, 0, 0.032, 'highpass', 2400, 4200, 1.5, 0.035, false);
    playTone(ctx, 980, 0, 0.045, 'triangle', 0.045, 420, null, false);
    const stingers: Record<Tier, number[]> = {
      COMMON: [523.25],
      UNCOMMON: [523.25, 659.25],
      RARE: [523.25, 659.25, 783.99],
      SR: [587.33, 739.99, 880, 1174.66],
      EPIC: [523.25, 659.25, 783.99, 1046.5, 1318.51],
      LEGENDARY: [587.33, 739.99, 880, 1174.66, 1479.98, 1760],
    };
    const notes = stingers[rarity] || stingers.COMMON;
    if (rarity === 'LEGENDARY') playTone(ctx, 110, 0.02, 0.35, 'sine', 0.11, 55, null, false);
    notes.forEach((f, idx) => {
      const isLast = idx === notes.length - 1;
      playTone(
        ctx,
        f,
        0.03 + idx * 0.055,
        isLast ? (rank >= 5 ? 0.52 : 0.28) : 0.13,
        rank >= 4 ? 'triangle' : 'sine',
        rank >= 5 ? 0.08 : 0.065,
        null,
        null,
        false
      );
    });
  }
}
