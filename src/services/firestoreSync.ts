import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  CONFIG_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_ITEMS,
  DEFAULT_STOCK_BY_NAME,
  EMPTY_TIER_COUNTS,
  GachaConfig,
  GachaItem,
  GachaPity,
  GachaPlayer,
  GachaRates,
  HistoryEntry,
  PricingBundle,
  Tier,
  TierCounts,
  TIERS,
  UserWorkspace,
} from '../types/gacha';
import { makeSafeDocId } from '../utils/gachaEngine';

function clampInt(val: number, min: number, max: number): number {
  const n = Math.round(Number(val) || 0);
  return Math.min(max, Math.max(min, n));
}

function sanitizeRates(rates: GachaRates): GachaRates {
  return {
    LEGENDARY: Math.min(1, Math.max(0, Number(rates.LEGENDARY) || 0)),
    EPIC: Math.min(1, Math.max(0, Number(rates.EPIC) || 0)),
    SR: Math.min(1, Math.max(0, Number(rates.SR) || 0)),
    RARE: Math.min(1, Math.max(0, Number(rates.RARE) || 0)),
    UNCOMMON: Math.min(1, Math.max(0, Number(rates.UNCOMMON) || 0)),
    COMMON: Math.min(1, Math.max(0, Number(rates.COMMON) || 0)),
  };
}

function sanitizePity(pity: GachaPity): GachaPity {
  return {
    UNCOMMON: clampInt(pity.UNCOMMON, 0, 10000),
    RARE: clampInt(pity.RARE, 0, 10000),
    SR: clampInt(pity.SR, 0, 10000),
    EPIC: clampInt(pity.EPIC, 0, 10000),
    LEGENDARY: clampInt(pity.LEGENDARY, 0, 10000),
  };
}

function sanitizeTierCounts(tc?: Partial<TierCounts>): TierCounts {
  return {
    LEGENDARY: clampInt(tc?.LEGENDARY ?? 0, 0, 10000000),
    EPIC: clampInt(tc?.EPIC ?? 0, 0, 10000000),
    SR: clampInt(tc?.SR ?? 0, 0, 10000000),
    RARE: clampInt(tc?.RARE ?? 0, 0, 10000000),
    UNCOMMON: clampInt(tc?.UNCOMMON ?? 0, 0, 10000000),
    COMMON: clampInt(tc?.COMMON ?? 0, 0, 10000000),
  };
}

function sanitizeBundles(bundles: PricingBundle[]): PricingBundle[] {
  return (bundles || [])
    .filter((b) => Number(b.qty) >= 2 && Number(b.price) >= 0)
    .slice(0, 20)
    .map((b) => ({
      qty: clampInt(b.qty, 2, 10000),
      price: clampInt(b.price, 0, 1000000000),
    }))
    .sort((a, b) => a.qty - b.qty);
}

export async function ensureUserWorkspace(uid: string, displayName: string): Promise<boolean> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);
  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (snap.exists()) {
    return false;
  }

  const safeName = (displayName || 'Operator').trim().slice(0, 100) || 'Operator';
  const demoPlayerId = 'player_demo';
  const batch = writeBatch(db);

  batch.set(userRef, {
    ownerId: uid,
    displayName: safeName,
    activePlayerId: demoPlayerId,
    sfxEnabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const cfgRef = doc(db, 'users', uid, 'configs', 'main');
  batch.set(cfgRef, {
    ownerId: uid,
    configVersion: CONFIG_VERSION,
    rates: sanitizeRates(DEFAULT_CONFIG.rates),
    pity: sanitizePity(DEFAULT_CONFIG.pity),
    singlePrice: DEFAULT_CONFIG.singlePrice,
    bundles: sanitizeBundles(DEFAULT_CONFIG.bundles),
    bgBlur: DEFAULT_CONFIG.bgBlur,
    bgDim: DEFAULT_CONFIG.bgDim,
    bgUrl: '',
    qrUrl: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  DEFAULT_ITEMS.forEach((item) => {
    const itemRef = doc(db, 'users', uid, 'items', item.id);
    batch.set(itemRef, {
      ownerId: uid,
      name: item.name,
      tier: item.tier,
      stock: item.stock,
      sortOrder: item.sortOrder,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  const demoRef = doc(db, 'users', uid, 'players', demoPlayerId);
  batch.set(demoRef, {
    ownerId: uid,
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
  return true;
}

export interface WorkspaceSubscriptionHandlers {
  onWorkspace: (workspace: UserWorkspace | null) => void;
  onConfig: (config: GachaConfig | null) => void;
  onItems: (items: GachaItem[]) => void;
  onPlayers: (players: GachaPlayer[]) => void;
  onHistory: (history: HistoryEntry[]) => void;
  onError: (err: Error) => void;
}

export function subscribeWorkspace(uid: string, handlers: WorkspaceSubscriptionHandlers): Unsubscribe {
  const unsubs: Unsubscribe[] = [];

  const wrapErr = (op: OperationType, path: string) => (error: unknown) => {
    try {
      handleFirestoreError(error, op, path);
    } catch (wrapped) {
      handlers.onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
    }
  };

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) {
          handlers.onWorkspace(null);
          return;
        }
        const d = snap.data();
        handlers.onWorkspace({
          ownerId: String(d.ownerId || uid),
          displayName: String(d.displayName || 'Operator'),
          activePlayerId: String(d.activePlayerId || ''),
          sfxEnabled: typeof d.sfxEnabled === 'boolean' ? d.sfxEnabled : true,
        });
      },
      wrapErr(OperationType.GET, `users/${uid}`)
    )
  );

  unsubs.push(
    onSnapshot(
      doc(db, 'users', uid, 'configs', 'main'),
      (snap) => {
        if (!snap.exists()) {
          handlers.onConfig(null);
          return;
        }
        const d = snap.data();
        handlers.onConfig({
          configVersion: String(d.configVersion || CONFIG_VERSION),
          rates: sanitizeRates(d.rates || DEFAULT_CONFIG.rates),
          pity: sanitizePity(d.pity || DEFAULT_CONFIG.pity),
          singlePrice: clampInt(d.singlePrice ?? DEFAULT_CONFIG.singlePrice, 0, 100000000),
          bundles: sanitizeBundles(Array.isArray(d.bundles) ? d.bundles : DEFAULT_CONFIG.bundles),
          bgBlur: clampInt(d.bgBlur ?? DEFAULT_CONFIG.bgBlur, 0, 30),
          bgDim: clampInt(d.bgDim ?? DEFAULT_CONFIG.bgDim, 0, 90),
          bgUrl: typeof d.bgUrl === 'string' ? d.bgUrl.slice(0, 500) : '',
          qrUrl: typeof d.qrUrl === 'string' ? d.qrUrl.slice(0, 500) : '',
        });
      },
      wrapErr(OperationType.GET, `users/${uid}/configs/main`)
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'items'), where('ownerId', '==', uid)),
      (snap) => {
        const list: GachaItem[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: String(d.name || ''),
            tier: (TIERS.includes(d.tier) ? d.tier : 'COMMON') as Tier,
            stock: clampInt(d.stock ?? 0, 0, 1000000),
            sortOrder: clampInt(d.sortOrder ?? 0, 0, 100000),
          };
        });
        list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
        handlers.onItems(list);
      },
      wrapErr(OperationType.LIST, `users/${uid}/items`)
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'players'), where('ownerId', '==', uid)),
      (snap) => {
        const list: GachaPlayer[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            name: String(d.name || ''),
            uncPity: clampInt(d.uncPity ?? 0, 0, 1000000),
            rPity: clampInt(d.rPity ?? 0, 0, 1000000),
            srPity: clampInt(d.srPity ?? 0, 0, 1000000),
            epicPity: clampInt(d.epicPity ?? 0, 0, 1000000),
            legPity: clampInt(d.legPity ?? 0, 0, 1000000),
            totalPulls: clampInt(d.totalPulls ?? 0, 0, 10000000),
            totalSpending: clampInt(d.totalSpending ?? 0, 0, 1000000000000),
            tierCounts: sanitizeTierCounts(d.tierCounts),
            lastPullAt: clampInt(d.lastPullAt ?? 0, 0, 9999999999999),
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        handlers.onPlayers(list);
      },
      wrapErr(OperationType.LIST, `users/${uid}/players`)
    )
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'users', uid, 'history'), where('ownerId', '==', uid)),
      (snap) => {
        const list: HistoryEntry[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            playerId: String(d.playerId || ''),
            playerName: String(d.playerName || ''),
            itemName: String(d.itemName || ''),
            rarity: (TIERS.includes(d.rarity) ? d.rarity : 'COMMON') as Tier,
            isPity: Boolean(d.isPity),
            timeMs: clampInt(d.timeMs ?? 0, 0, 9999999999999),
          };
        });
        list.sort((a, b) => b.timeMs - a.timeMs);
        handlers.onHistory(list);
      },
      wrapErr(OperationType.LIST, `users/${uid}/history`)
    )
  );

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function updateWorkspaceActivePlayer(uid: string, activePlayerId: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      activePlayerId: activePlayerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateWorkspaceSfx(uid: string, sfxEnabled: boolean): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      sfxEnabled: Boolean(sfxEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCloudRates(uid: string, rates: GachaRates): Promise<void> {
  const path = `users/${uid}/configs/main`;
  try {
    await updateDoc(doc(db, 'users', uid, 'configs', 'main'), {
      rates: sanitizeRates(rates),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCloudPity(uid: string, pity: GachaPity): Promise<void> {
  const path = `users/${uid}/configs/main`;
  try {
    await updateDoc(doc(db, 'users', uid, 'configs', 'main'), {
      pity: sanitizePity(pity),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCloudPricing(uid: string, singlePrice: number, bundles: PricingBundle[]): Promise<void> {
  const path = `users/${uid}/configs/main`;
  try {
    await updateDoc(doc(db, 'users', uid, 'configs', 'main'), {
      singlePrice: clampInt(singlePrice, 0, 100000000),
      bundles: sanitizeBundles(bundles),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCloudBgSettings(uid: string, bgBlur: number, bgDim: number, bgUrl: string): Promise<void> {
  const path = `users/${uid}/configs/main`;
  try {
    await updateDoc(doc(db, 'users', uid, 'configs', 'main'), {
      bgBlur: clampInt(bgBlur, 0, 30),
      bgDim: clampInt(bgDim, 0, 90),
      bgUrl: (bgUrl || '').trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateCloudQrUrl(uid: string, qrUrl: string): Promise<void> {
  const path = `users/${uid}/configs/main`;
  try {
    await updateDoc(doc(db, 'users', uid, 'configs', 'main'), {
      qrUrl: (qrUrl || '').trim().slice(0, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createCloudPlayer(uid: string, name: string): Promise<string> {
  const safeName = name.trim().slice(0, 80);
  const playerId = makeSafeDocId('player', safeName);
  const path = `users/${uid}/players/${playerId}`;
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'players', playerId), {
    ownerId: uid,
    name: safeName,
    uncPity: 0,
    rPity: 0,
    srPity: 0,
    epicPity: 0,
    legPity: 0,
    totalPulls: 0,
    totalSpending: 0,
    tierCounts: EMPTY_TIER_COUNTS(),
    lastPullAt: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', uid), {
    activePlayerId: playerId,
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return playerId;
}

export async function setCloudItemStock(uid: string, itemId: string, newStock: number): Promise<void> {
  const path = `users/${uid}/items/${itemId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'items', itemId), {
      stock: clampInt(newStock, 0, 1000000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addCloudItem(
  uid: string,
  name: string,
  tier: Tier,
  stock: number,
  sortOrder: number
): Promise<string> {
  const safeName = name.trim().slice(0, 100);
  const itemId = makeSafeDocId('item', safeName);
  const path = `users/${uid}/items/${itemId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'items', itemId), {
      ownerId: uid,
      name: safeName,
      tier,
      stock: clampInt(stock, 0, 1000000),
      sortOrder: clampInt(sortOrder, 0, 100000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
  return itemId;
}

export async function removeCloudItem(uid: string, itemId: string): Promise<void> {
  const path = `users/${uid}/items/${itemId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'items', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function resetCloudStockToDefault(uid: string, items: GachaItem[]): Promise<void> {
  const path = `users/${uid}/items`;
  const chunks: GachaItem[][] = [];
  for (let i = 0; i < items.length; i += 400) {
    chunks.push(items.slice(i, i + 400));
  }
  try {
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        const defaultStock = DEFAULT_STOCK_BY_NAME[item.name] ?? 10;
        batch.update(doc(db, 'users', uid, 'items', item.id), {
          stock: defaultStock,
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function commitCloudPull(
  uid: string,
  updatedPlayer: GachaPlayer,
  items: GachaItem[],
  stockDeltas: Map<string, number>,
  newHistoryEntries: Array<{ itemName: string; rarity: Tier; isPity: boolean; timeMs: number }>
): Promise<void> {
  const path = `users/${uid}/players/${updatedPlayer.id}`;

  // First batch: update player + all decremented items + first slice of history entries
  const firstBatch = writeBatch(db);
  firstBatch.update(doc(db, 'users', uid, 'players', updatedPlayer.id), {
    uncPity: clampInt(updatedPlayer.uncPity, 0, 1000000),
    rPity: clampInt(updatedPlayer.rPity, 0, 1000000),
    srPity: clampInt(updatedPlayer.srPity, 0, 1000000),
    epicPity: clampInt(updatedPlayer.epicPity, 0, 1000000),
    legPity: clampInt(updatedPlayer.legPity, 0, 1000000),
    totalPulls: clampInt(updatedPlayer.totalPulls, 0, 10000000),
    totalSpending: clampInt(updatedPlayer.totalSpending, 0, 1000000000000),
    tierCounts: sanitizeTierCounts(updatedPlayer.tierCounts),
    lastPullAt: clampInt(updatedPlayer.lastPullAt, 0, 9999999999999),
    updatedAt: serverTimestamp(),
  });

  let opsInFirst = 1;
  stockDeltas.forEach((delta, itemId) => {
    const itemObj = items.find((it) => it.id === itemId);
    if (!itemObj) return;
    const nextStock = Math.max(0, itemObj.stock - delta);
    firstBatch.update(doc(db, 'users', uid, 'items', itemId), {
      stock: clampInt(nextStock, 0, 1000000),
      updatedAt: serverTimestamp(),
    });
    opsInFirst++;
  });

  const maxFirstHistory = Math.max(0, 450 - opsInFirst);
  const firstSlice = newHistoryEntries.slice(0, maxFirstHistory);
  const restSlice = newHistoryEntries.slice(maxFirstHistory);

  firstSlice.forEach((entry) => {
    const entryId = makeSafeDocId('hist');
    firstBatch.set(doc(db, 'users', uid, 'history', entryId), {
      ownerId: uid,
      playerId: updatedPlayer.id,
      playerName: updatedPlayer.name.slice(0, 80),
      itemName: entry.itemName.slice(0, 100),
      rarity: entry.rarity,
      isPity: Boolean(entry.isPity),
      timeMs: clampInt(entry.timeMs, 0, 9999999999999),
      createdAt: serverTimestamp(),
    });
  });

  try {
    await firstBatch.commit();
    for (let i = 0; i < restSlice.length; i += 450) {
      const batch = writeBatch(db);
      restSlice.slice(i, i + 450).forEach((entry) => {
        const entryId = makeSafeDocId('hist');
        batch.set(doc(db, 'users', uid, 'history', entryId), {
          ownerId: uid,
          playerId: updatedPlayer.id,
          playerName: updatedPlayer.name.slice(0, 80),
          itemName: entry.itemName.slice(0, 100),
          rarity: entry.rarity,
          isPity: Boolean(entry.isPity),
          timeMs: clampInt(entry.timeMs, 0, 9999999999999),
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function commitCloudCommonChoice(
  uid: string,
  player: GachaPlayer,
  chosenItem: GachaItem,
  count: number
): Promise<void> {
  const safeCount = Math.min(count, chosenItem.stock);
  if (safeCount <= 0) return;

  const path = `users/${uid}/items/${chosenItem.id}`;
  const nextTierCounts: TierCounts = {
    ...sanitizeTierCounts(player.tierCounts),
    COMMON: clampInt((player.tierCounts.COMMON || 0) + safeCount, 0, 10000000),
  };

  const now = Date.now();
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid, 'items', chosenItem.id), {
    stock: clampInt(chosenItem.stock - safeCount, 0, 1000000),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'users', uid, 'players', player.id), {
    tierCounts: nextTierCounts,
    updatedAt: serverTimestamp(),
  });

  const firstCount = Math.min(safeCount, 440);
  for (let i = 0; i < firstCount; i++) {
    const entryId = makeSafeDocId('hist');
    batch.set(doc(db, 'users', uid, 'history', entryId), {
      ownerId: uid,
      playerId: player.id,
      playerName: player.name.slice(0, 80),
      itemName: chosenItem.name.slice(0, 100),
      rarity: 'COMMON',
      isPity: false,
      timeMs: now + i,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
    for (let offset = firstCount; offset < safeCount; offset += 450) {
      const extraBatch = writeBatch(db);
      const end = Math.min(safeCount, offset + 450);
      for (let i = offset; i < end; i++) {
        const entryId = makeSafeDocId('hist');
        extraBatch.set(doc(db, 'users', uid, 'history', entryId), {
          ownerId: uid,
          playerId: player.id,
          playerName: player.name.slice(0, 80),
          itemName: chosenItem.name.slice(0, 100),
          rarity: 'COMMON',
          isPity: false,
          timeMs: now + i,
          createdAt: serverTimestamp(),
        });
      }
      await extraBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function resetCloudHistoryOnly(
  uid: string,
  historyEntries: HistoryEntry[],
  players: GachaPlayer[]
): Promise<void> {
  const path = `users/${uid}/history`;
  try {
    for (let i = 0; i < historyEntries.length; i += 450) {
      const batch = writeBatch(db);
      historyEntries.slice(i, i + 450).forEach((entry) => {
        batch.delete(doc(db, 'users', uid, 'history', entry.id));
      });
      await batch.commit();
    }

    for (let i = 0; i < players.length; i += 450) {
      const batch = writeBatch(db);
      players.slice(i, i + 450).forEach((p) => {
        batch.update(doc(db, 'users', uid, 'players', p.id), {
          tierCounts: EMPTY_TIER_COUNTS(),
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function resetCloudEntireWorkspace(
  uid: string,
  items: GachaItem[],
  players: GachaPlayer[],
  historyEntries: HistoryEntry[]
): Promise<void> {
  const path = `users/${uid}`;
  try {
    // Delete all history
    for (let i = 0; i < historyEntries.length; i += 450) {
      const batch = writeBatch(db);
      historyEntries.slice(i, i + 450).forEach((entry) => {
        batch.delete(doc(db, 'users', uid, 'history', entry.id));
      });
      await batch.commit();
    }

    // Delete all items & players
    const toDeleteRefs = [
      ...items.map((it) => doc(db, 'users', uid, 'items', it.id)),
      ...players.map((pl) => doc(db, 'users', uid, 'players', pl.id)),
    ];
    for (let i = 0; i < toDeleteRefs.length; i += 450) {
      const batch = writeBatch(db);
      toDeleteRefs.slice(i, i + 450).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }

    // Re-seed default config, default items, and Demo player
    const seedBatch = writeBatch(db);
    const demoPlayerId = 'player_demo';

    seedBatch.update(doc(db, 'users', uid), {
      activePlayerId: demoPlayerId,
      updatedAt: serverTimestamp(),
    });

    seedBatch.update(doc(db, 'users', uid, 'configs', 'main'), {
      configVersion: CONFIG_VERSION,
      rates: sanitizeRates(DEFAULT_CONFIG.rates),
      pity: sanitizePity(DEFAULT_CONFIG.pity),
      singlePrice: DEFAULT_CONFIG.singlePrice,
      bundles: sanitizeBundles(DEFAULT_CONFIG.bundles),
      bgBlur: DEFAULT_CONFIG.bgBlur,
      bgDim: DEFAULT_CONFIG.bgDim,
      bgUrl: '',
      qrUrl: '',
      updatedAt: serverTimestamp(),
    });

    DEFAULT_ITEMS.forEach((item) => {
      seedBatch.set(doc(db, 'users', uid, 'items', item.id), {
        ownerId: uid,
        name: item.name,
        tier: item.tier,
        stock: item.stock,
        sortOrder: item.sortOrder,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    seedBatch.set(doc(db, 'users', uid, 'players', demoPlayerId), {
      ownerId: uid,
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await seedBatch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface LocalImportPayload {
  config: GachaConfig;
  items: GachaItem[];
  players: GachaPlayer[];
  history: HistoryEntry[];
}

export async function importLocalSnapshotToCloud(
  uid: string,
  localData: LocalImportPayload,
  existingItems: GachaItem[],
  existingPlayers: GachaPlayer[],
  existingHistory: HistoryEntry[]
): Promise<void> {
  const path = `users/${uid}`;
  try {
    // Clear existing cloud docs first to avoid duplicates
    for (let i = 0; i < existingHistory.length; i += 450) {
      const batch = writeBatch(db);
      existingHistory.slice(i, i + 450).forEach((h) => batch.delete(doc(db, 'users', uid, 'history', h.id)));
      await batch.commit();
    }
    const oldRefs = [
      ...existingItems.map((it) => doc(db, 'users', uid, 'items', it.id)),
      ...existingPlayers.map((pl) => doc(db, 'users', uid, 'players', pl.id)),
    ];
    for (let i = 0; i < oldRefs.length; i += 450) {
      const batch = writeBatch(db);
      oldRefs.slice(i, i + 450).forEach((r) => batch.delete(r));
      await batch.commit();
    }

    // Write config + items + players
    const playerIdMap = new Map<string, string>();
    const mainBatch = writeBatch(db);
    mainBatch.update(doc(db, 'users', uid, 'configs', 'main'), {
      configVersion: CONFIG_VERSION,
      rates: sanitizeRates(localData.config.rates),
      pity: sanitizePity(localData.config.pity),
      singlePrice: clampInt(localData.config.singlePrice, 0, 100000000),
      bundles: sanitizeBundles(localData.config.bundles),
      bgBlur: clampInt(localData.config.bgBlur, 0, 30),
      bgDim: clampInt(localData.config.bgDim, 0, 90),
      bgUrl: (localData.config.bgUrl || '').slice(0, 500),
      qrUrl: (localData.config.qrUrl || '').slice(0, 500),
      updatedAt: serverTimestamp(),
    });

    localData.items.slice(0, 150).forEach((item, idx) => {
      const safeId = makeSafeDocId('item', item.name);
      mainBatch.set(doc(db, 'users', uid, 'items', safeId), {
        ownerId: uid,
        name: item.name.slice(0, 100) || 'Item',
        tier: TIERS.includes(item.tier) ? item.tier : 'COMMON',
        stock: clampInt(item.stock, 0, 1000000),
        sortOrder: idx,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    let firstPlayerId = '';
    localData.players.slice(0, 200).forEach((pl) => {
      const safeId = makeSafeDocId('player', pl.name);
      if (!firstPlayerId) firstPlayerId = safeId;
      playerIdMap.set(pl.id, safeId);
      playerIdMap.set(pl.name, safeId);
      mainBatch.set(doc(db, 'users', uid, 'players', safeId), {
        ownerId: uid,
        name: pl.name.slice(0, 80) || 'Player',
        uncPity: clampInt(pl.uncPity, 0, 1000000),
        rPity: clampInt(pl.rPity, 0, 1000000),
        srPity: clampInt(pl.srPity, 0, 1000000),
        epicPity: clampInt(pl.epicPity, 0, 1000000),
        legPity: clampInt(pl.legPity, 0, 1000000),
        totalPulls: clampInt(pl.totalPulls, 0, 10000000),
        totalSpending: clampInt(pl.totalSpending, 0, 1000000000000),
        tierCounts: sanitizeTierCounts(pl.tierCounts),
        lastPullAt: clampInt(pl.lastPullAt, 0, 9999999999999),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    mainBatch.update(doc(db, 'users', uid), {
      activePlayerId: firstPlayerId,
      updatedAt: serverTimestamp(),
    });
    await mainBatch.commit();

    // Write history entries that match an imported player
    const validHist = localData.history.filter(
      (h) => playerIdMap.has(h.playerId) || playerIdMap.has(h.playerName)
    );
    for (let i = 0; i < validHist.length; i += 450) {
      const batch = writeBatch(db);
      validHist.slice(i, i + 450).forEach((h) => {
        const mappedPlayerId = playerIdMap.get(h.playerId) || playerIdMap.get(h.playerName) || firstPlayerId;
        if (!mappedPlayerId) return;
        const entryId = makeSafeDocId('hist');
        batch.set(doc(db, 'users', uid, 'history', entryId), {
          ownerId: uid,
          playerId: mappedPlayerId,
          playerName: h.playerName.slice(0, 80) || 'Player',
          itemName: h.itemName.slice(0, 100) || 'Item',
          rarity: TIERS.includes(h.rarity) ? h.rarity : 'COMMON',
          isPity: Boolean(h.isPity),
          timeMs: clampInt(h.timeMs || Date.now(), 0, 9999999999999),
          createdAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
