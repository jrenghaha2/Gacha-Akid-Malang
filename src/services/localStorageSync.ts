import {
  CONFIG_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_ITEMS,
  DEFAULT_STOCK_BY_NAME,
  EMPTY_TIER_COUNTS,
  GachaConfig,
  GachaItem,
  GachaPlayer,
  HistoryEntry,
  STORAGE_KEYS,
  Tier,
  TIERS,
} from '../types/gacha';
import { makeSafeDocId } from '../utils/gachaEngine';
import type { LocalImportPayload } from './firestoreSync';

const LOCAL_STATE_KEY = 'akidGacha_reactState_v1';

export interface LocalWorkspaceState {
  config: GachaConfig;
  items: GachaItem[];
  players: GachaPlayer[];
  history: HistoryEntry[];
  activePlayerId: string;
  sfxEnabled: boolean;
}

export function createDefaultLocalState(): LocalWorkspaceState {
  const demoPlayer: GachaPlayer = {
    id: 'player_demo',
    name: 'Demo',
    uncPity: 0,
    rPity: 0,
    srPity: 0,
    epicPity: 0,
    legPity: 0,
    totalPulls: 0,
    totalSpending: 0,
    tierCounts: EMPTY_TIER_COUNTS(),
    lastPullAt: 0,
  };
  return {
    config: {
      ...DEFAULT_CONFIG,
      rates: { ...DEFAULT_CONFIG.rates },
      pity: { ...DEFAULT_CONFIG.pity },
      bundles: DEFAULT_CONFIG.bundles.map((b) => ({ ...b })),
    },
    items: DEFAULT_ITEMS.map((it) => ({ ...it })),
    players: [demoPlayer],
    history: [],
    activePlayerId: demoPlayer.id,
    sfxEnabled: true,
  };
}

export function loadLocalState(): LocalWorkspaceState {
  try {
    const raw = localStorage.getItem(LOCAL_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalWorkspaceState>;
      const def = createDefaultLocalState();
      return {
        config: {
          ...def.config,
          ...(parsed.config || {}),
          rates: { ...def.config.rates, ...(parsed.config?.rates || {}) },
          pity: { ...def.config.pity, ...(parsed.config?.pity || {}) },
          bundles: Array.isArray(parsed.config?.bundles) ? parsed.config.bundles : def.config.bundles,
        },
        items: Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : def.items,
        players: Array.isArray(parsed.players) && parsed.players.length > 0 ? parsed.players : def.players,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        activePlayerId: typeof parsed.activePlayerId === 'string' ? parsed.activePlayerId : def.activePlayerId,
        sfxEnabled: typeof parsed.sfxEnabled === 'boolean' ? parsed.sfxEnabled : true,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return createDefaultLocalState();
}

export function saveLocalState(state: LocalWorkspaceState): void {
  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota error
  }
}

export function loadLocalBgDataUrl(): string {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.BG_IMAGE) || '';
    return val.startsWith('data:image/') ? val : '';
  } catch {
    return '';
  }
}

export function saveLocalBgDataUrl(dataUrl: string): boolean {
  try {
    if (!dataUrl) {
      localStorage.removeItem(STORAGE_KEYS.BG_IMAGE);
    } else {
      localStorage.setItem(STORAGE_KEYS.BG_IMAGE, dataUrl);
    }
    return true;
  } catch {
    return false;
  }
}

export function loadLocalQrDataUrl(): string {
  try {
    const val = localStorage.getItem(STORAGE_KEYS.QR_IMAGE) || '';
    return val.startsWith('data:image/') ? val : '';
  } catch {
    return '';
  }
}

export function saveLocalQrDataUrl(dataUrl: string): boolean {
  try {
    if (!dataUrl) {
      localStorage.removeItem(STORAGE_KEYS.QR_IMAGE);
    } else {
      localStorage.setItem(STORAGE_KEYS.QR_IMAGE, dataUrl);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if there is either React local offline data OR legacy standalone HTML akidGacha_* data
 * that the user might want to import into their Firebase Cloud workspace.
 */
export function readImportableLocalData(): LocalImportPayload | null {
  try {
    // First check legacy HTML keys (akidGacha_players, akidGacha_config, etc.)
    const legacyPlayersRaw = localStorage.getItem(STORAGE_KEYS.PLAYERS);
    if (legacyPlayersRaw) {
      const legacyPlayersObj = JSON.parse(legacyPlayersRaw) as Record<
        string,
        {
          uncPity?: number;
          rPity?: number;
          midPity?: number;
          srPity?: number;
          epicPity?: number;
          legPity?: number;
          totalPulls?: number;
          history?: Array<{ name: string; rarity: string }>;
          pullLog?: Array<{ cost?: number; date?: number }>;
        }
      >;
      const legacyConfigRaw = localStorage.getItem(STORAGE_KEYS.CONFIG);
      const legacyStockRaw = localStorage.getItem(STORAGE_KEYS.STOCK);
      const legacyHistRaw = localStorage.getItem(STORAGE_KEYS.GLOBAL_HISTORY);
      const legacyBgRaw = localStorage.getItem(STORAGE_KEYS.BG_SETTINGS);

      const legacyCfg = legacyConfigRaw ? JSON.parse(legacyConfigRaw) : {};
      const legacyStock: Record<string, number> = legacyStockRaw ? JSON.parse(legacyStockRaw) : DEFAULT_STOCK_BY_NAME;
      const legacyBg = legacyBgRaw ? JSON.parse(legacyBgRaw) : {};

      const items: GachaItem[] = [];
      let order = 0;
      const cfgItems = legacyCfg.items || {};
      TIERS.forEach((tier) => {
        const names: string[] = Array.isArray(cfgItems[tier]) ? cfgItems[tier] : [];
        names.forEach((n) => {
          items.push({
            id: makeSafeDocId('item', n),
            name: n,
            tier,
            stock: typeof legacyStock[n] === 'number' ? legacyStock[n] : 10,
            sortOrder: order++,
          });
        });
      });

      const playerNameToId = new Map<string, string>();
      const players: GachaPlayer[] = Object.keys(legacyPlayersObj).map((name) => {
        const p = legacyPlayersObj[name];
        const id = makeSafeDocId('player', name);
        playerNameToId.set(name, id);
        const tc = EMPTY_TIER_COUNTS();
        (p.history || []).forEach((h) => {
          const r = (h.rarity === 'MID' || h.rarity === 'R' ? 'RARE' : h.rarity) as Tier;
          if (TIERS.includes(r)) tc[r]++;
        });
        const spending = (p.pullLog || []).reduce((sum, e) => sum + (Number(e.cost) || 0), 0);
        const lastPullAt =
          p.pullLog && p.pullLog.length > 0 ? Number(p.pullLog[p.pullLog.length - 1].date) || 0 : 0;
        return {
          id,
          name,
          uncPity: Number(p.uncPity) || 0,
          rPity: Number(p.rPity ?? p.midPity) || 0,
          srPity: Number(p.srPity) || 0,
          epicPity: Number(p.epicPity) || 0,
          legPity: Number(p.legPity) || 0,
          totalPulls: Number(p.totalPulls) || 0,
          totalSpending: spending,
          tierCounts: tc,
          lastPullAt,
        };
      });

      const legacyHistArr: Array<{ player: string; name: string; rarity: string; time?: number }> = legacyHistRaw
        ? JSON.parse(legacyHistRaw)
        : [];
      const history: HistoryEntry[] = legacyHistArr.map((h, idx) => {
        const r = (h.rarity === 'MID' || h.rarity === 'R' ? 'RARE' : h.rarity) as Tier;
        return {
          id: makeSafeDocId('hist', String(idx)),
          playerId: playerNameToId.get(h.player) || players[0]?.id || 'player_demo',
          playerName: h.player || 'Player',
          itemName: h.name || 'Item',
          rarity: TIERS.includes(r) ? r : 'COMMON',
          isPity: false,
          timeMs: Number(h.time) || Date.now(),
        };
      });

      const config: GachaConfig = {
        configVersion: CONFIG_VERSION,
        rates: { ...DEFAULT_CONFIG.rates, ...(legacyCfg.rates || {}) },
        pity: { ...DEFAULT_CONFIG.pity, ...(legacyCfg.pity || {}) },
        singlePrice: Number(legacyCfg.pricing?.singlePrice ?? DEFAULT_CONFIG.singlePrice),
        bundles: Array.isArray(legacyCfg.pricing?.bundles) ? legacyCfg.pricing.bundles : DEFAULT_CONFIG.bundles,
        bgBlur: Number(legacyBg.blur ?? DEFAULT_CONFIG.bgBlur),
        bgDim: Number(legacyBg.dim ?? DEFAULT_CONFIG.bgDim),
        bgUrl: '',
      };

      if (players.length > 0) {
        return {
          config,
          items: items.length > 0 ? items : DEFAULT_ITEMS.map((it) => ({ ...it })),
          players,
          history,
        };
      }
    }

    // Otherwise check React local offline state if user played offline first
    const localRaw = localStorage.getItem(LOCAL_STATE_KEY);
    if (localRaw) {
      const state = loadLocalState();
      const hasProgress =
        state.history.length > 0 ||
        state.players.length > 1 ||
        state.players.some((p) => p.totalPulls > 0 || p.name !== 'Demo');
      if (hasProgress) {
        return {
          config: state.config,
          items: state.items,
          players: state.players,
          history: state.history,
        };
      }
    }
  } catch {
    // ignore parse errors
  }
  return null;
}
