import {
  GachaConfig,
  GachaItem,
  GachaPlayer,
  PricingBundle,
  PullResultItem,
  Tier,
  TIER_RANK,
  TIERS,
} from '../types/gacha';

export function formatRp(n: number): string {
  return 'Rp' + (Math.round(Number(n)) || 0).toLocaleString('id-ID');
}

export function makeSafeDocId(prefix: string, seed?: string): string {
  const slug = (seed || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  const randBytes = new Uint8Array(6);
  crypto.getRandomValues(randBytes);
  const randHex = Array.from(randBytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const raw = slug ? `${prefix}_${slug}_${randHex}` : `${prefix}_${Date.now().toString(36)}_${randHex}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export function secureRandomFloat(): number {
  const buf = new Uint32Array(2);
  crypto.getRandomValues(buf);
  const hi = buf[0] >>> 5;
  const lo = buf[1] >>> 6;
  return (hi * 67108864 + lo) / 9007199254740992;
}

export function secureRandomInt(max: number): number {
  if (!max || max <= 0) return 0;
  const buf = new Uint32Array(1);
  const range = Math.floor(0x100000000 / max) * max;
  let x = 0;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= range);
  return x % max;
}

export function secureChoice<T>(arr: T[]): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  return arr[secureRandomInt(arr.length)];
}

export function calcPullCost(times: number, singlePrice: number, bundles: PricingBundle[]): number {
  const n = Math.floor(Number(times) || 0);
  if (n <= 0) return 0;
  const single = Math.max(0, Math.round(Number(singlePrice) || 0));
  const validBundles = (bundles || [])
    .filter((b) => Number(b.qty) > 1 && Number(b.price) >= 0)
    .map((b) => ({ qty: Math.floor(Number(b.qty)), price: Math.round(Number(b.price)) }));

  if (validBundles.length === 0) return n * single;

  if (n <= 5000) {
    const dp = new Array<number>(n + 1);
    dp[0] = 0;
    for (let i = 1; i <= n; i++) {
      let best = dp[i - 1] + single;
      for (const b of validBundles) {
        if (i >= b.qty) {
          const cand = dp[i - b.qty] + b.price;
          if (cand < best) best = cand;
        }
      }
      dp[i] = best;
    }
    return dp[n];
  }

  const bestRatio = validBundles.slice().sort((a, b) => a.price / a.qty - b.price / b.qty)[0];
  if (bestRatio && bestRatio.price / bestRatio.qty < single) {
    const keep = 1000;
    const bulkCount = Math.floor((n - keep) / bestRatio.qty);
    const rem = n - bulkCount * bestRatio.qty;
    return bulkCount * bestRatio.price + calcPullCost(rem, single, validBundles);
  }
  return n * single;
}

export function getAvailableItemsByTier(items: GachaItem[], stockMap: Map<string, number>, tier: Tier): GachaItem[] {
  return items.filter((item) => item.tier === tier && (stockMap.get(item.id) ?? item.stock) > 0);
}

export function buildActiveRates(items: GachaItem[], stockMap: Map<string, number>, config: GachaConfig): Partial<Record<Tier, number>> | null {
  const active: Partial<Record<Tier, number>> = {};
  let totalActive = 0;
  for (const t of TIERS) {
    if (getAvailableItemsByTier(items, stockMap, t).length > 0) {
      active[t] = config.rates[t];
      totalActive += config.rates[t];
    }
  }
  if (totalActive <= 0) return null;
  const norm: Partial<Record<Tier, number>> = {};
  for (const t of TIERS) {
    if (active[t] !== undefined) {
      norm[t] = (active[t] as number) / totalActive;
    }
  }
  return norm;
}

export function rollSingleItem(
  items: GachaItem[],
  stockMap: Map<string, number>,
  config: GachaConfig
): PullResultItem | null {
  const rates = buildActiveRates(items, stockMap, config);
  if (!rates) return null;

  const rand = secureRandomFloat();
  let cum = 0;
  for (const tier of TIERS) {
    const tierRate = rates[tier];
    if (!tierRate) continue;
    cum += tierRate;
    if (rand < cum) {
      const avail = getAvailableItemsByTier(items, stockMap, tier);
      if (avail.length === 0) continue;
      if (tier === 'COMMON') return { name: 'Common', rarity: 'COMMON' };
      const chosen = secureChoice(avail);
      if (chosen) return { name: chosen.name, rarity: tier, itemId: chosen.id };
    }
  }

  if (getAvailableItemsByTier(items, stockMap, 'COMMON').length > 0) {
    return { name: 'Common', rarity: 'COMMON' };
  }
  for (const tier of TIERS) {
    const avail = getAvailableItemsByTier(items, stockMap, tier);
    if (avail.length > 0) {
      const chosen = secureChoice(avail);
      if (chosen) return { name: chosen.name, rarity: tier, itemId: chosen.id };
    }
  }
  return null;
}

export interface PullExecutionResult {
  results: PullResultItem[];
  pendingCommonsCount: number;
  updatedPlayer: GachaPlayer;
  stockDeltas: Map<string, number>;
  newHistoryEntries: Array<{
    itemName: string;
    rarity: Tier;
    isPity: boolean;
    timeMs: number;
  }>;
}

export function executePullSimulation(
  times: number,
  player: GachaPlayer,
  items: GachaItem[],
  config: GachaConfig
): PullExecutionResult {
  const stockMap = new Map<string, number>();
  items.forEach((it) => stockMap.set(it.id, it.stock));
  const stockDeltas = new Map<string, number>();

  const nextPlayer: GachaPlayer = {
    ...player,
    tierCounts: { ...player.tierCounts },
  };

  const results: PullResultItem[] = [];
  const newHistoryEntries: Array<{ itemName: string; rarity: Tier; isPity: boolean; timeMs: number }> = [];
  let pendingCommonsCount = 0;

  const pityOn = (t: keyof GachaConfig['pity']) => config.pity[t] > 0;
  const decrementLocalStock = (itemId: string) => {
    const cur = stockMap.get(itemId) ?? 0;
    if (cur > 0) {
      stockMap.set(itemId, cur - 1);
      stockDeltas.set(itemId, (stockDeltas.get(itemId) ?? 0) + 1);
    }
  };

  const baseTime = Date.now();

  for (let i = 0; i < times; i++) {
    let item: PullResultItem | null = null;

    if (pityOn('LEGENDARY') && nextPlayer.legPity >= config.pity.LEGENDARY - 1) {
      const avail = getAvailableItemsByTier(items, stockMap, 'LEGENDARY');
      const chosen = secureChoice(avail);
      if (chosen) item = { name: chosen.name, rarity: 'LEGENDARY', pity: true, itemId: chosen.id };
    }
    if (!item && pityOn('EPIC') && nextPlayer.epicPity >= config.pity.EPIC - 1) {
      const avail = getAvailableItemsByTier(items, stockMap, 'EPIC');
      const chosen = secureChoice(avail);
      if (chosen) item = { name: chosen.name, rarity: 'EPIC', pity: true, itemId: chosen.id };
    }
    if (!item && pityOn('SR') && nextPlayer.srPity >= config.pity.SR - 1) {
      const avail = getAvailableItemsByTier(items, stockMap, 'SR');
      const chosen = secureChoice(avail);
      if (chosen) item = { name: chosen.name, rarity: 'SR', pity: true, itemId: chosen.id };
    }

    if (!item) {
      item = rollSingleItem(items, stockMap, config);
      if (!item) break;
      if (TIER_RANK[item.rarity] < TIER_RANK.RARE && pityOn('RARE') && nextPlayer.rPity >= config.pity.RARE - 1) {
        const avail = getAvailableItemsByTier(items, stockMap, 'RARE');
        const chosen = secureChoice(avail);
        if (chosen) item = { name: chosen.name, rarity: 'RARE', pity: true, itemId: chosen.id };
      } else if (
        TIER_RANK[item.rarity] < TIER_RANK.UNCOMMON &&
        pityOn('UNCOMMON') &&
        nextPlayer.uncPity >= config.pity.UNCOMMON - 1
      ) {
        const avail = getAvailableItemsByTier(items, stockMap, 'UNCOMMON');
        const chosen = secureChoice(avail);
        if (chosen) item = { name: chosen.name, rarity: 'UNCOMMON', pity: true, itemId: chosen.id };
      }
    }

    results.push(item);

    // Exact pity increment & reset
    nextPlayer.uncPity++;
    nextPlayer.rPity++;
    nextPlayer.srPity++;
    nextPlayer.epicPity++;
    nextPlayer.legPity++;

    if (item.rarity === 'LEGENDARY') nextPlayer.legPity = 0;
    else if (item.rarity === 'EPIC') nextPlayer.epicPity = 0;
    else if (item.rarity === 'SR') nextPlayer.srPity = 0;
    else if (item.rarity === 'RARE') nextPlayer.rPity = 0;
    else if (item.rarity === 'UNCOMMON') nextPlayer.uncPity = 0;

    if (item.rarity === 'COMMON') {
      const availCommon = getAvailableItemsByTier(items, stockMap, 'COMMON');
      if (availCommon.length === 1) {
        const only = availCommon[0];
        decrementLocalStock(only.id);
        item.name = only.name;
        item.itemId = only.id;
        nextPlayer.tierCounts.COMMON = (nextPlayer.tierCounts.COMMON || 0) + 1;
        newHistoryEntries.push({
          itemName: only.name,
          rarity: 'COMMON',
          isPity: Boolean(item.pity),
          timeMs: baseTime + i,
        });
      } else if (availCommon.length > 1) {
        pendingCommonsCount++;
      }
    } else if (item.itemId) {
      decrementLocalStock(item.itemId);
      nextPlayer.tierCounts[item.rarity] = (nextPlayer.tierCounts[item.rarity] || 0) + 1;
      newHistoryEntries.push({
        itemName: item.name,
        rarity: item.rarity,
        isPity: Boolean(item.pity),
        timeMs: baseTime + i,
      });
    }
  }

  if (results.length > 0) {
    const cost = calcPullCost(results.length, config.singlePrice, config.bundles);
    nextPlayer.totalPulls = (nextPlayer.totalPulls || 0) + results.length;
    nextPlayer.totalSpending = (nextPlayer.totalSpending || 0) + cost;
    nextPlayer.lastPullAt = baseTime;
  }

  return {
    results,
    pendingCommonsCount,
    updatedPlayer: nextPlayer,
    stockDeltas,
    newHistoryEntries,
  };
}

export function sanitizeImageUrl(url: string): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('data:image/')) {
    return trimmed.replace(/[\r\n"]/g, (m) => (m === '"' ? '%22' : ''));
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.slice(0, 500).replace(/[\r\n"]/g, '');
  }
  return '';
}

export function compressImageDataUrl(rawDataUrl: string, maxDim = 1920, initialQuality = 0.82): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width || 0;
        const srcH = img.naturalHeight || img.height || 0;
        if (!srcW || !srcH) {
          resolve(rawDataUrl);
          return;
        }
        const encodeAt = (limitDim: number, quality: number) => {
          const scale = Math.min(1, limitDim / Math.max(srcW, srcH));
          const w = Math.max(1, Math.round(srcW * scale));
          const h = Math.max(1, Math.round(srcH * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.drawImage(img, 0, 0, w, h);
          let out = canvas.toDataURL('image/webp', quality);
          if (!out || !out.startsWith('data:image/webp')) {
            out = canvas.toDataURL('image/jpeg', quality);
          }
          return out;
        };
        let result = encodeAt(maxDim, initialQuality);
        if (result && result.length > 1400000) result = encodeAt(Math.min(maxDim, 1366), 0.75) || result;
        if (result && result.length > 1400000) result = encodeAt(Math.min(maxDim, 1024), 0.65) || result;
        resolve(result || rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}
