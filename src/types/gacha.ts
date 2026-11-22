export type Tier = 'LEGENDARY' | 'EPIC' | 'SR' | 'RARE' | 'UNCOMMON' | 'COMMON';

export type PityTier = 'UNCOMMON' | 'RARE' | 'SR' | 'EPIC' | 'LEGENDARY';

export const TIERS: Tier[] = ['LEGENDARY', 'EPIC', 'SR', 'RARE', 'UNCOMMON', 'COMMON'];

export const PITY_TIERS: PityTier[] = ['LEGENDARY', 'EPIC', 'SR', 'RARE', 'UNCOMMON'];

export const CONFIG_VERSION = 'akid-malang-v2';

export const TIER_LABEL: Record<Tier, string> = {
  LEGENDARY: 'Legendary',
  EPIC: 'Epic',
  SR: 'Super Rare',
  RARE: 'Rare',
  UNCOMMON: 'Uncommon',
  COMMON: 'Common',
};

export const TIER_EMOJI: Record<Tier, string> = {
  LEGENDARY: '👑',
  EPIC: '🔮',
  SR: '💎',
  RARE: '✨',
  UNCOMMON: '🍀',
  COMMON: '🎁',
};

export const TIER_RANK: Record<Tier, number> = {
  LEGENDARY: 6,
  EPIC: 5,
  SR: 4,
  RARE: 3,
  UNCOMMON: 2,
  COMMON: 1,
};

export const TIER_TEXT_400: Record<Tier, string> = {
  LEGENDARY: 'text-orange-400',
  EPIC: 'text-yellow-400',
  SR: 'text-purple-400',
  RARE: 'text-sky-400',
  UNCOMMON: 'text-green-400',
  COMMON: 'text-gray-400',
};

export const TIER_TEXT_300: Record<Tier, string> = {
  LEGENDARY: 'text-orange-300',
  EPIC: 'text-yellow-300',
  SR: 'text-purple-300',
  RARE: 'text-sky-300',
  UNCOMMON: 'text-green-300',
  COMMON: 'text-gray-300',
};

export const TIER_ACCENT_500: Record<Tier, string> = {
  LEGENDARY: 'accent-orange-500',
  EPIC: 'accent-yellow-500',
  SR: 'accent-purple-500',
  RARE: 'accent-sky-500',
  UNCOMMON: 'accent-green-500',
  COMMON: 'accent-gray-500',
};

export const TIER_HISTORY_CLS: Record<Tier, string> = {
  LEGENDARY: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  EPIC: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  SR: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  RARE: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
  UNCOMMON: 'bg-green-500/20 text-green-300 border border-green-500/30',
  COMMON: 'bg-gray-500/20 text-gray-300 border border-gray-500/30',
};

export const TIER_PARTICLE: Record<Tier, [string, string, string]> = {
  LEGENDARY: ['#ff4d1c', '#ff8a4c', '#fff'],
  EPIC: ['#facc15', '#fde68a', '#fff'],
  SR: ['#a855f7', '#d8b4fe', '#fff'],
  RARE: ['#38bdf8', '#7dd3fc', '#fff'],
  UNCOMMON: ['#22c55e', '#86efac', '#fff'],
  COMMON: ['#9ca3af', '#d1d5db', '#fff'],
};

export const TIER_GLOW_RGBA: Record<Tier, string> = {
  LEGENDARY: 'rgba(255,77,28,.65)',
  EPIC: 'rgba(250,204,21,.6)',
  SR: 'rgba(168,85,247,.58)',
  RARE: 'rgba(56,189,248,.55)',
  UNCOMMON: 'rgba(34,197,94,.52)',
  COMMON: 'rgba(156,163,175,.45)',
};

export type GachaRates = Record<Tier, number>;
export type GachaPity = Record<PityTier, number>;
export type TierCounts = Record<Tier, number>;

export interface PricingBundle {
  qty: number;
  price: number;
}

export interface GachaConfig {
  configVersion: string;
  rates: GachaRates;
  pity: GachaPity;
  singlePrice: number;
  bundles: PricingBundle[];
  bgBlur: number;
  bgDim: number;
  bgUrl: string;
}

export interface GachaItem {
  id: string;
  name: string;
  tier: Tier;
  stock: number;
  sortOrder: number;
}

export interface GachaPlayer {
  id: string;
  name: string;
  uncPity: number;
  rPity: number;
  srPity: number;
  epicPity: number;
  legPity: number;
  totalPulls: number;
  totalSpending: number;
  tierCounts: TierCounts;
  lastPullAt: number;
}

export interface HistoryEntry {
  id: string;
  playerId: string;
  playerName: string;
  itemName: string;
  rarity: Tier;
  isPity: boolean;
  timeMs: number;
}

export interface PullResultItem {
  name: string;
  rarity: Tier;
  pity?: boolean;
  itemId?: string;
}

export interface UserWorkspace {
  ownerId: string;
  displayName: string;
  activePlayerId: string;
  sfxEnabled: boolean;
}

export const RATE_PRESETS: Record<'hemat' | 'seimbang' | 'meriah', GachaRates> = {
  hemat: { LEGENDARY: 0.001, EPIC: 0.004, SR: 0.015, RARE: 0.04, UNCOMMON: 0.09, COMMON: 0.85 },
  seimbang: { LEGENDARY: 0.002, EPIC: 0.008, SR: 0.03, RARE: 0.07, UNCOMMON: 0.17, COMMON: 0.72 },
  meriah: { LEGENDARY: 0.005, EPIC: 0.015, SR: 0.05, RARE: 0.11, UNCOMMON: 0.22, COMMON: 0.6 },
};

export const DEFAULT_RATES: GachaRates = { ...RATE_PRESETS.seimbang };

export const DEFAULT_PITY: GachaPity = {
  UNCOMMON: 8,
  RARE: 15,
  SR: 45,
  EPIC: 80,
  LEGENDARY: 200,
};

export const DEFAULT_CONFIG: GachaConfig = {
  configVersion: CONFIG_VERSION,
  rates: { ...DEFAULT_RATES },
  pity: { ...DEFAULT_PITY },
  singlePrice: 2000,
  bundles: [{ qty: 3, price: 5000 }],
  bgBlur: 6,
  bgDim: 45,
  bgUrl: '',
};

export const DEFAULT_ITEMS: Array<{ id: string; name: string; tier: Tier; stock: number; sortOrder: number }> = [
  { id: 'item_merch_eksklusif', name: 'Merch Eksklusif', tier: 'LEGENDARY', stock: 3, sortOrder: 0 },
  { id: 'item_poster_a3', name: 'Poster A3', tier: 'EPIC', stock: 6, sortOrder: 1 },
  { id: 'item_poster_a4', name: 'Poster A4', tier: 'SR', stock: 12, sortOrder: 2 },
  { id: 'item_postcard_a6', name: 'Postcard A6', tier: 'RARE', stock: 20, sortOrder: 3 },
  { id: 'item_gantungan_kunci', name: 'Gantungan Kunci', tier: 'UNCOMMON', stock: 40, sortOrder: 4 },
  { id: 'item_stiker', name: 'Stiker', tier: 'COMMON', stock: 99, sortOrder: 5 },
];

export const DEFAULT_STOCK_BY_NAME: Record<string, number> = {
  'Stiker': 99,
  'Gantungan Kunci': 40,
  'Postcard A6': 20,
  'Poster A4': 12,
  'Poster A3': 6,
  'Merch Eksklusif': 3,
};

export const EMPTY_TIER_COUNTS = (): TierCounts => ({
  LEGENDARY: 0,
  EPIC: 0,
  SR: 0,
  RARE: 0,
  UNCOMMON: 0,
  COMMON: 0,
});

export const STORAGE_KEYS = {
  CONFIG: 'akidGacha_config',
  CONFIG_VERSION: 'akidGacha_configVersion',
  PLAYERS: 'akidGacha_players',
  GLOBAL_HISTORY: 'akidGacha_globalHistory',
  STOCK: 'akidGacha_stock',
  STOCK_VERSION: 'akidGacha_stockVersion',
  SFX_ENABLED: 'akidGacha_sfxEnabled',
  BG_IMAGE: 'akidGacha_bgImage',
  BG_SETTINGS: 'akidGacha_bgSettings',
};
