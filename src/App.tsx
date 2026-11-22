import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { Cloud, CloudOff, LogIn, Volume2, VolumeX } from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
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
  PityTier,
  PricingBundle,
  PullResultItem,
  Tier,
  TIER_EMOJI,
  TIER_HISTORY_CLS,
  TIER_TEXT_400,
  UserWorkspace,
} from './types/gacha';
import {
  calcPullCost,
  executePullSimulation,
  formatRp,
  makeSafeDocId,
  sanitizeImageUrl,
} from './utils/gachaEngine';
import { setSfxEnabledGlobal, sfxPlay } from './utils/sfx';
import {
  addCloudItem,
  commitCloudCommonChoice,
  commitCloudPull,
  createCloudPlayer,
  ensureUserWorkspace,
  importLocalSnapshotToCloud,
  removeCloudItem,
  resetCloudEntireWorkspace,
  resetCloudHistoryOnly,
  resetCloudStockToDefault,
  setCloudItemStock,
  subscribeWorkspace,
  updateCloudBgSettings,
  updateCloudPity,
  updateCloudPricing,
  updateCloudRates,
  updateWorkspaceActivePlayer,
  updateWorkspaceSfx,
} from './services/firestoreSync';
import {
  createDefaultLocalState,
  loadLocalBgDataUrl,
  loadLocalState,
  LocalWorkspaceState,
  readImportableLocalData,
  saveLocalBgDataUrl,
  saveLocalState,
} from './services/localStorageSync';
import { PullOverlay } from './components/PullOverlay';
import { AkDialogModal, AkDialogState } from './components/modals/AkDialogModal';
import { ResultModal } from './components/modals/ResultModal';
import { CommonModal } from './components/modals/CommonModal';
import { PlayerModal } from './components/modals/PlayerModal';
import { StockModal } from './components/modals/StockModal';
import { SpendingModal } from './components/modals/SpendingModal';
import { FullHistoryModal } from './components/modals/FullHistoryModal';
import { QrisModal } from './components/modals/QrisModal';
import { AdminModal } from './components/modals/AdminModal';
import { AuthSyncModal } from './components/modals/AuthSyncModal';
import { EmailAuthForm } from './components/EmailAuthForm';

const INITIAL_DIALOG: AkDialogState = {
  isOpen: false,
  type: 'alert',
  title: '',
  message: '',
};

const PITY_DISPLAY_ORDER: Array<{ key: PityTier; label: string; field: keyof GachaPlayer }> = [
  { key: 'UNCOMMON', label: 'UNCOM', field: 'uncPity' },
  { key: 'RARE', label: 'RARE', field: 'rPity' },
  { key: 'SR', label: 'SR', field: 'srPity' },
  { key: 'EPIC', label: 'EPIC', field: 'epicPity' },
  { key: 'LEGENDARY', label: 'LEGEND', field: 'legPity' },
];

export default function App() {
  // Auth & Sync Mode
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dismissedImportBanner, setDismissedImportBanner] = useState(false);

  // Cloud State
  const [cloudWorkspace, setCloudWorkspace] = useState<UserWorkspace | null>(null);
  const [cloudConfig, setCloudConfig] = useState<GachaConfig | null>(null);
  const [cloudItems, setCloudItems] = useState<GachaItem[]>([]);
  const [cloudPlayers, setCloudPlayers] = useState<GachaPlayer[]>([]);
  const [cloudHistory, setCloudHistory] = useState<HistoryEntry[]>([]);

  // Local Offline State
  const [localState, setLocalState] = useState<LocalWorkspaceState>(() => loadLocalState());
  const [localBgDataUrl, setLocalBgDataUrl] = useState<string>(() => loadLocalBgDataUrl());

  // Custom Pull Input
  const [customPullQty, setCustomPullQty] = useState<string>('10');

  // Pull Animation & Result Modals
  const [pullOverlayActive, setPullOverlayActive] = useState(false);
  const [currentPullResults, setCurrentPullResults] = useState<PullResultItem[]>([]);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultInstantReveal, setResultInstantReveal] = useState(false);
  const [pendingCommonsCount, setPendingCommonsCount] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  // Other Modals
  const [playerModalOpen, setPlayerModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [spendingModalOpen, setSpendingModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [qrisModalOpen, setQrisModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [authSyncModalOpen, setAuthSyncModalOpen] = useState(false);
  const [dialog, setDialog] = useState<AkDialogState>(INITIAL_DIALOG);

  const isCloudMode = Boolean(user);

  const showAlert = useCallback((title: string, message: string) => {
    setDialog({
      isOpen: true,
      type: 'alert',
      title,
      message,
      confirmLabel: 'OK',
    });
  }, []);

  const showConfirm = useCallback(
    (opts: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
      onConfirm: () => void;
    }) => {
      setDialog({
        isOpen: true,
        type: 'confirm',
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel || 'YA',
        cancelLabel: opts.cancelLabel || 'BATAL',
        danger: opts.danger,
        onConfirm: opts.onConfirm,
      });
    },
    []
  );

  const reportError = useCallback(
    (err: unknown, contextLabel = 'Sinkronisasi Cloud') => {
      const msg = err instanceof Error ? err.message : String(err);
      const isQuota = msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource-exhausted');
      showAlert(
        isQuota ? 'Kuota Firestore Tercapai' : `Gagal: ${contextLabel}`,
        isQuota
          ? 'Kuota harian Firestore sedang penuh. Coba lagi nanti atau gunakan Mode Offline sementara.'
          : msg.slice(0, 260)
      );
    },
    [showAlert]
  );

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (firebaseUser) {
        setOfflineMode(false);
      }
    });
    return () => unsub();
  }, []);

  // Cloud workspace bootstrap + real-time subscriptions
  useEffect(() => {
    if (!user) {
      setCloudWorkspace(null);
      setCloudConfig(null);
      setCloudItems([]);
      setCloudPlayers([]);
      setCloudHistory([]);
      setCloudLoading(false);
      return;
    }

    let cancelled = false;
    let unsubWorkspace: (() => void) | null = null;
    setCloudLoading(true);

    ensureUserWorkspace(user.uid, user.displayName || user.email || 'Operator')
      .then(() => {
        if (cancelled) return;
        unsubWorkspace = subscribeWorkspace(user.uid, {
          onWorkspace: (ws) => {
            setCloudWorkspace(ws);
            setCloudLoading(false);
          },
          onConfig: (cfg) => setCloudConfig(cfg),
          onItems: (its) => setCloudItems(its),
          onPlayers: (pls) => setCloudPlayers(pls),
          onHistory: (hist) => setCloudHistory(hist),
          onError: (err) => {
            setCloudLoading(false);
            reportError(err, 'Firestore Realtime');
          },
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setCloudLoading(false);
          reportError(err, 'Inisialisasi Workspace');
        }
      });

    return () => {
      cancelled = true;
      unsubWorkspace?.();
    };
  }, [user, reportError]);

  // Unified active data
  const config: GachaConfig = isCloudMode ? cloudConfig || DEFAULT_CONFIG : localState.config;
  const items: GachaItem[] = isCloudMode ? cloudItems : localState.items;
  const players: GachaPlayer[] = isCloudMode ? cloudPlayers : localState.players;
  const history: HistoryEntry[] = isCloudMode ? cloudHistory : localState.history;
  const activePlayerId: string = isCloudMode
    ? cloudWorkspace?.activePlayerId || players[0]?.id || ''
    : localState.activePlayerId || players[0]?.id || '';
  const sfxEnabled: boolean = isCloudMode ? (cloudWorkspace?.sfxEnabled ?? true) : localState.sfxEnabled;

  // Keep global WebAudio SFX flag in sync
  useEffect(() => {
    setSfxEnabledGlobal(sfxEnabled);
  }, [sfxEnabled]);

  // Persist offline state when in local mode
  useEffect(() => {
    if (!isCloudMode) {
      saveLocalState(localState);
    }
  }, [localState, isCloudMode]);

  const activePlayer = useMemo<GachaPlayer | null>(() => {
    return players.find((p) => p.id === activePlayerId) || players[0] || null;
  }, [players, activePlayerId]);

  const importableLocal = useMemo(() => {
    if (!isCloudMode) return null;
    return readImportableLocalData();
  }, [isCloudMode, authSyncModalOpen]);

  const availableCommons = useMemo(
    () => items.filter((it) => it.tier === 'COMMON' && it.stock > 0),
    [items]
  );

  const allItemNames = useMemo(() => items.map((it) => it.name), [items]);

  const totalStock = useMemo(() => items.reduce((sum, it) => sum + Math.max(0, it.stock), 0), [items]);

  const parsedCustomQty = Math.max(1, Math.min(500, Math.floor(Number(customPullQty) || 1)));
  const customPullCost = useMemo(
    () => calcPullCost(parsedCustomQty, config.singlePrice, config.bundles),
    [parsedCustomQty, config.singlePrice, config.bundles]
  );

  // Global Escape key to close topmost standard modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dialog.isOpen || pullOverlayActive || pendingCommonsCount > 0) return;
      if (authSyncModalOpen) setAuthSyncModalOpen(false);
      else if (adminModalOpen) setAdminModalOpen(false);
      else if (historyModalOpen) setHistoryModalOpen(false);
      else if (spendingModalOpen) setSpendingModalOpen(false);
      else if (stockModalOpen) setStockModalOpen(false);
      else if (playerModalOpen) setPlayerModalOpen(false);
      else if (qrisModalOpen) setQrisModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    dialog.isOpen,
    pullOverlayActive,
    pendingCommonsCount,
    authSyncModalOpen,
    adminModalOpen,
    historyModalOpen,
    spendingModalOpen,
    stockModalOpen,
    playerModalOpen,
    qrisModalOpen,
  ]);

  const formatAuthError = (err: unknown): string => {
    const code =
      typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
    const msg = err instanceof Error ? err.message : String(err);
    if (code === 'auth/operation-not-allowed') {
      return 'Login Email/Password belum diaktifkan di Firebase Console.\nBuka Firebase Console (project hardy-smithy-xpd8p) → Authentication → Sign-in method → aktifkan "Email/Password".';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Email atau password salah, atau akun belum terdaftar.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'Email ini sudah terdaftar. Silakan masuk lewat tab "MASUK EMAIL".';
    }
    if (code === 'auth/weak-password') {
      return 'Password terlalu lemah. Gunakan minimal 6 karakter.';
    }
    if (code === 'auth/invalid-email') {
      return 'Format alamat email tidak valid.';
    }
    if (code === 'auth/too-many-requests') {
      return 'Terlalu banyak percobaan login. Tunggu beberapa menit lalu coba lagi.';
    }
    if (code === 'auth/unauthorized-domain') {
      return 'Domain situs ini belum didaftarkan di Firebase Console → Authentication → Settings → Authorized domains.';
    }
    return msg.slice(0, 260);
  };

  // Auth actions
  const handleGoogleLogin = async () => {
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setAuthSyncModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('popup-closed-by-user')) {
        showAlert('Gagal Login Google', formatAuthError(err));
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailLogin = async (email: string, password: string) => {
    setAuthBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setAuthSyncModalOpen(false);
    } catch (err) {
      showAlert('Gagal Masuk Email', formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleEmailRegister = async (email: string, password: string, displayName: string) => {
    setAuthBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const safeName = (displayName || email.split('@')[0] || 'Operator').trim().slice(0, 80);
      if (safeName) {
        await updateProfile(cred.user, { displayName: safeName }).catch(() => {});
      }
      setAuthSyncModalOpen(false);
    } catch (err) {
      showAlert('Gagal Daftar Akun', formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!email) {
      showAlert('Masukkan Email', 'Isi alamat email Anda terlebih dahulu sebelum klik "Lupa password?".');
      return;
    }
    setAuthBusy(true);
    try {
      await sendPasswordResetEmail(auth, email);
      showAlert(
        'Email Reset Terkirim',
        `Link reset password telah dikirim ke ${email}. Periksa kotak masuk atau folder spam Anda.`
      );
    } catch (err) {
      showAlert('Gagal Reset Password', formatAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
      setAuthSyncModalOpen(false);
      setOfflineMode(false);
    } catch (err) {
      reportError(err, 'Sign Out');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleImportLocalToCloud = async () => {
    if (!user) return;
    const payload = readImportableLocalData();
    if (!payload) {
      showAlert('Tidak Ada Data Lokal', 'Tidak ditemukan data gacha lokal di browser ini.');
      return;
    }
    showConfirm({
      title: 'Import Data Lokal ke Cloud?',
      message: `Data lokal (${payload.players.length} player, ${payload.items.length} item, ${payload.history.length} riwayat) akan menggantikan data Cloud saat ini. Lanjutkan?`,
      confirmLabel: 'IMPORT SEKARANG',
      onConfirm: async () => {
        setImporting(true);
        try {
          await importLocalSnapshotToCloud(user.uid, payload, cloudItems, cloudPlayers, cloudHistory);
          setDismissedImportBanner(true);
          setAuthSyncModalOpen(false);
          showAlert('Import Berhasil', 'Seluruh data lokal berhasil disinkronkan ke Firebase Cloud!');
        } catch (err) {
          reportError(err, 'Import Data Lokal');
        } finally {
          setImporting(false);
        }
      },
    });
  };

  // Mutation handlers (Cloud vs Offline)
  const handleToggleSfx = async () => {
    const next = !sfxEnabled;
    setSfxEnabledGlobal(next);
    if (next) sfxPlay('click');
    if (user) {
      try {
        await updateWorkspaceSfx(user.uid, next);
      } catch (err) {
        reportError(err, 'Simpan Pengaturan Suara');
      }
    } else {
      setLocalState((prev) => ({ ...prev, sfxEnabled: next }));
    }
  };

  const handleSelectPlayer = async (playerId: string) => {
    if (user) {
      try {
        await updateWorkspaceActivePlayer(user.uid, playerId);
      } catch (err) {
        reportError(err, 'Ganti Player');
      }
    } else {
      setLocalState((prev) => ({ ...prev, activePlayerId: playerId }));
    }
  };

  const handleCreatePlayer = async (name: string) => {
    const existing = players.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      await handleSelectPlayer(existing.id);
      return;
    }
    if (user) {
      try {
        await createCloudPlayer(user.uid, name);
      } catch (err) {
        reportError(err, 'Tambah Player');
      }
    } else {
      const id = makeSafeDocId('player', name);
      const newP: GachaPlayer = {
        id,
        name,
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
      setLocalState((prev) => ({
        ...prev,
        players: [...prev.players, newP],
        activePlayerId: id,
      }));
    }
  };

  const handleSetItemStock = async (itemId: string, newStock: number) => {
    const clamped = Math.max(0, Math.min(1000000, Math.floor(newStock)));
    if (user) {
      try {
        await setCloudItemStock(user.uid, itemId, clamped);
      } catch (err) {
        reportError(err, 'Update Stok');
      }
    } else {
      setLocalState((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.id === itemId ? { ...it, stock: clamped } : it)),
      }));
    }
  };

  const handleResetDefaultStock = () => {
    showConfirm({
      title: 'Reset Stok ke Default?',
      message: 'Semua stok item akan dikembalikan ke jumlah default awal.',
      confirmLabel: 'RESET STOK',
      onConfirm: async () => {
        if (user) {
          try {
            await resetCloudStockToDefault(user.uid, items);
            showAlert('Stok Direset', 'Stok semua hadiah berhasil dikembalikan ke default.');
          } catch (err) {
            reportError(err, 'Reset Stok');
          }
        } else {
          setLocalState((prev) => ({
            ...prev,
            items: prev.items.map((it) => ({
              ...it,
              stock: DEFAULT_STOCK_BY_NAME[it.name] ?? 10,
            })),
          }));
          showAlert('Stok Direset', 'Stok semua hadiah berhasil dikembalikan ke default.');
        }
      },
    });
  };

  const handleAddItem = async (name: string, tier: Tier, stock: number) => {
    if (user) {
      try {
        await addCloudItem(user.uid, name, tier, stock, items.length);
      } catch (err) {
        reportError(err, 'Tambah Item');
      }
    } else {
      const id = makeSafeDocId('item', name);
      setLocalState((prev) => ({
        ...prev,
        items: [...prev.items, { id, name, tier, stock, sortOrder: prev.items.length }],
      }));
    }
  };

  const handleRemoveItem = (itemId: string, itemName: string) => {
    showConfirm({
      title: 'Hapus Item?',
      message: `Hapus "${itemName}" dari daftar hadiah gacha?`,
      confirmLabel: 'HAPUS',
      danger: true,
      onConfirm: async () => {
        if (user) {
          try {
            await removeCloudItem(user.uid, itemId);
          } catch (err) {
            reportError(err, 'Hapus Item');
          }
        } else {
          setLocalState((prev) => ({
            ...prev,
            items: prev.items.filter((it) => it.id !== itemId),
          }));
        }
      },
    });
  };

  const handleSaveRates = async (rates: GachaRates) => {
    if (user) {
      try {
        await updateCloudRates(user.uid, rates);
      } catch (err) {
        reportError(err, 'Simpan Rates');
      }
    } else {
      setLocalState((prev) => ({ ...prev, config: { ...prev.config, rates } }));
    }
  };

  const handleSavePricing = async (singlePrice: number, bundles: PricingBundle[]) => {
    if (user) {
      try {
        await updateCloudPricing(user.uid, singlePrice, bundles);
      } catch (err) {
        reportError(err, 'Simpan Harga');
      }
    } else {
      setLocalState((prev) => ({ ...prev, config: { ...prev.config, singlePrice, bundles } }));
    }
  };

  const handleSavePity = async (pity: GachaPity) => {
    if (user) {
      try {
        await updateCloudPity(user.uid, pity);
      } catch (err) {
        reportError(err, 'Simpan Pity');
      }
    } else {
      setLocalState((prev) => ({ ...prev, config: { ...prev.config, pity } }));
    }
  };

  const handleSaveBgSettings = async (bgBlur: number, bgDim: number, bgUrl: string) => {
    if (user) {
      try {
        await updateCloudBgSettings(user.uid, bgBlur, bgDim, bgUrl);
      } catch (err) {
        reportError(err, 'Simpan Background');
      }
    } else {
      setLocalState((prev) => ({ ...prev, config: { ...prev.config, bgBlur, bgDim, bgUrl } }));
    }
  };

  const handleSetLocalBg = (dataUrl: string) => {
    setLocalBgDataUrl(dataUrl);
    saveLocalBgDataUrl(dataUrl);
  };

  const handleResetHistoryOnly = async () => {
    if (user) {
      try {
        await resetCloudHistoryOnly(user.uid, history, players);
        showAlert('History Direset', 'Semua riwayat pull telah dihapus.');
      } catch (err) {
        reportError(err, 'Reset History');
      }
    } else {
      setLocalState((prev) => ({
        ...prev,
        history: [],
        players: prev.players.map((p) => ({ ...p, tierCounts: EMPTY_TIER_COUNTS() })),
      }));
      showAlert('History Direset', 'Semua riwayat pull telah dihapus.');
    }
  };

  const handleResetAllData = async () => {
    if (user) {
      try {
        await resetCloudEntireWorkspace(user.uid, items, players, history);
        handleSetLocalBg('');
        showAlert('Reset Total Selesai', 'Seluruh data Cloud berhasil dikembalikan ke pengaturan default.');
      } catch (err) {
        reportError(err, 'Reset Total');
      }
    } else {
      setLocalState(createDefaultLocalState());
      handleSetLocalBg('');
      showAlert('Reset Total Selesai', 'Seluruh data lokal berhasil dikembalikan ke pengaturan default.');
    }
  };

  // Core Pull Execution
  const handlePull = async (times: number) => {
    if (isPulling || pullOverlayActive || resultModalOpen || pendingCommonsCount > 0) return;
    if (!activePlayer) {
      showAlert('Pilih Player', 'Silakan buat atau pilih player terlebih dahulu.');
      setPlayerModalOpen(true);
      return;
    }
    if (totalStock <= 0) {
      showAlert('Stok Habis!', 'Semua hadiah sedang kosong. Silakan isi stok terlebih dahulu di menu STOK.');
      return;
    }

    const safeTimes = Math.max(1, Math.min(500, Math.floor(times)));
    sfxPlay('click');
    setIsPulling(true);

    const sim = executePullSimulation(safeTimes, activePlayer, items, config);
    if (sim.results.length === 0) {
      setIsPulling(false);
      showAlert('Stok Habis!', 'Tidak ada hadiah tersisa untuk ditarik.');
      return;
    }

    try {
      if (user) {
        await commitCloudPull(user.uid, sim.updatedPlayer, items, sim.stockDeltas, sim.newHistoryEntries);
      } else {
        setLocalState((prev) => {
          const nextItems = prev.items.map((it) => {
            const delta = sim.stockDeltas.get(it.id) || 0;
            return delta > 0 ? { ...it, stock: Math.max(0, it.stock - delta) } : it;
          });
          const nextPlayers = prev.players.map((p) =>
            p.id === sim.updatedPlayer.id ? sim.updatedPlayer : p
          );
          const addedHist: HistoryEntry[] = sim.newHistoryEntries.map((e, i) => ({
            id: makeSafeDocId('hist', String(i)),
            playerId: sim.updatedPlayer.id,
            playerName: sim.updatedPlayer.name,
            itemName: e.itemName,
            rarity: e.rarity,
            isPity: e.isPity,
            timeMs: e.timeMs,
          }));
          return {
            ...prev,
            items: nextItems,
            players: nextPlayers,
            history: [...addedHist.reverse(), ...prev.history],
          };
        });
      }

      setCurrentPullResults(sim.results);
      setPendingCommonsCount(sim.pendingCommonsCount);
      setResultInstantReveal(false);
      setPullOverlayActive(true);
    } catch (err) {
      setIsPulling(false);
      reportError(err, 'Menyimpan Hasil Pull');
    }
  };

  const handleOverlayComplete = useCallback((wasSkipped: boolean) => {
    setPullOverlayActive(false);
    setResultInstantReveal(wasSkipped);
    setResultModalOpen(true);
  }, []);

  const handleResultClose = () => {
    setResultModalOpen(false);
    if (pendingCommonsCount <= 0) {
      setIsPulling(false);
    }
  };

  const handlePickCommon = async (chosenItem: GachaItem, qty: number) => {
    if (!activePlayer) return;
    const take = Math.min(qty, pendingCommonsCount, chosenItem.stock);
    if (take <= 0) return;

    try {
      if (user) {
        await commitCloudCommonChoice(user.uid, activePlayer, chosenItem, take);
      } else {
        const now = Date.now();
        setLocalState((prev) => {
          const nextItems = prev.items.map((it) =>
            it.id === chosenItem.id ? { ...it, stock: Math.max(0, it.stock - take) } : it
          );
          const nextPlayers = prev.players.map((p) =>
            p.id === activePlayer.id
              ? {
                  ...p,
                  tierCounts: {
                    ...p.tierCounts,
                    COMMON: (p.tierCounts.COMMON || 0) + take,
                  },
                }
              : p
          );
          const added: HistoryEntry[] = Array.from({ length: take }, (_, i) => ({
            id: makeSafeDocId('hist', String(i)),
            playerId: activePlayer.id,
            playerName: activePlayer.name,
            itemName: chosenItem.name,
            rarity: 'COMMON',
            isPity: false,
            timeMs: now + i,
          }));
          return {
            ...prev,
            items: nextItems,
            players: nextPlayers,
            history: [...added.reverse(), ...prev.history],
          };
        });
      }

      const nextPending = Math.max(0, pendingCommonsCount - take);
      setPendingCommonsCount(nextPending);
      if (nextPending === 0) {
        setIsPulling(false);
      }
    } catch (err) {
      reportError(err, 'Simpan Pilihan Common');
    }
  };

  // Active background URL (local uploaded file takes precedence on this device, else synced cloud bgUrl)
  const effectiveBgUrl = sanitizeImageUrl(localBgDataUrl) || sanitizeImageUrl(config.bgUrl || '');

  // 1. Auth Loading Screen
  if (!authReady || (isCloudMode && cloudLoading && !cloudWorkspace)) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0c0f] ak-grid-bg flex flex-col items-center justify-center p-6 text-center">
        <div className="ak-scanline" />
        <div className="orb w-28 h-28 mb-4" />
        <div className="font-mono-tech text-xs tracking-[0.22em] text-orange-400 uppercase animate-pulse">
          // INITIALIZING ZEROTH CLOUD TERMINAL...
        </div>
      </div>
    );
  }

  // 2. Firebase Login Gateway (when signed out & not in offline mode)
  if (!user && !offlineMode) {
    return (
      <div className="min-h-[100dvh] bg-[#0a0c0f] ak-grid-bg relative flex items-center justify-center p-4 overflow-y-auto">
        <div className="ak-scanline" />
        <div className="relative z-10 w-full max-w-md ak-cut bg-[#12151a]/95 border border-orange-500/50 shadow-2xl overflow-hidden my-4">
          <div className="ak-hazard-strip" />
          <div className="p-6 sm:p-7 text-center space-y-4">
            <div className="font-mono-tech text-[10px] tracking-[0.22em] text-orange-400 uppercase">
              // ZEROTH RECRUITMENT NETWORK // CLOUD SYNC
            </div>

            <div className="flex justify-center">
              <div className="orb-wrap">
                <div className="orb !w-28 !h-28" />
              </div>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-widest text-white uppercase">
                GACHA AKID MALANG
              </h1>
              <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                Masuk dengan <span className="text-neutral-200">Email</span> atau{' '}
                <span className="text-neutral-200">Google</span> untuk menyinkronkan semua data{' '}
                <span className="text-neutral-200">Player, Pity, Stok, Rates, Harga, & Riwayat Pull</span> secara
                real-time.
              </p>
            </div>

            <EmailAuthForm
              busy={authBusy}
              onEmailLogin={handleEmailLogin}
              onEmailRegister={handleEmailRegister}
              onResetPassword={handleResetPassword}
            />

            <div className="flex items-center gap-2 text-[10px] font-mono-tech text-neutral-500">
              <div className="h-px bg-neutral-800 flex-1" />
              <span>ATAU</span>
              <div className="h-px bg-neutral-800 flex-1" />
            </div>

            <div className="space-y-2">
              <button
                type="button"
                disabled={authBusy}
                onClick={() => {
                  sfxPlay('click');
                  void handleGoogleLogin();
                }}
                className="btn-press w-full py-2.5 px-4 bg-[#1b2029] hover:bg-[#252c38] border border-cyan-400/50 disabled:opacity-50 text-cyan-300 font-bold text-xs tracking-widest flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{authBusy ? 'MENGHUBUNGKAN...' : 'LOGIN DENGAN GOOGLE'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sfxPlay('click');
                  setOfflineMode(true);
                }}
                className="btn-press w-full py-2 px-4 bg-[#181c22] hover:bg-[#222831] border border-neutral-700 text-neutral-300 font-bold text-xs tracking-wider flex items-center justify-center gap-2"
              >
                <CloudOff className="w-3.5 h-3.5 text-neutral-400" />
                <span>LANJUT MODE OFFLINE (LOKAL)</span>
              </button>
            </div>

            <div className="font-mono-tech text-[10px] text-neutral-500 pt-2 border-t border-neutral-800/80">
              FIREBASE AUTH + CLOUD FIRESTORE REAL-TIME SYNC
            </div>
          </div>
        </div>

        <AkDialogModal dialog={dialog} onClose={() => setDialog(INITIAL_DIALOG)} />
      </div>
    );
  }

  // 3. Main Gacha Terminal UI
  const sortedBundles = [...config.bundles].sort((a, b) => a.qty - b.qty);
  const recentHistory = history.slice(0, 40);

  return (
    <div className="min-h-[100dvh] flex flex-col relative text-[#eef1f5] overflow-x-hidden">
      {/* Background Layer */}
      {effectiveBgUrl ? (
        <>
          <div
            className="fixed inset-0 z-0 bg-cover bg-center scale-105 pointer-events-none"
            style={{
              backgroundImage: `url("${effectiveBgUrl}")`,
              filter: `blur(${config.bgBlur}px)`,
            }}
          />
          <div
            className="fixed inset-0 z-[1] pointer-events-none"
            style={{ backgroundColor: `rgba(10,12,15,${config.bgDim / 100})` }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-0 bg-[#0a0c0f] ak-grid-bg pointer-events-none" />
      )}
      <div className="ak-scanline" />

      {/* Sticky Header + Pity Bar */}
      <header className="sticky top-0 z-30 bg-[#0d1015]/90 backdrop-blur-md border-b border-orange-500/35">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-mono-tech text-[10px] tracking-[0.18em] text-orange-400 uppercase leading-none">
                // TERMINAL REKRUTMEN
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    sfxPlay('click');
                    setPlayerModalOpen(true);
                  }}
                  className="text-sm sm:text-base font-bold text-white hover:text-orange-300 transition truncate text-left"
                >
                  👤 {activePlayer?.name || 'Pilih Player'}
                </button>
                {activePlayer && (
                  <span className="font-mono-tech text-[10px] px-1.5 py-0.5 bg-neutral-800/90 border border-neutral-700 text-amber-300 shrink-0">
                    {formatRp(activePlayer.totalSpending)}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                sfxPlay('click');
                setAuthSyncModalOpen(true);
              }}
              className={`btn-press px-2.5 py-1.5 rounded-sm border text-[11px] font-bold flex items-center gap-1.5 shrink-0 ${
                isCloudMode
                  ? 'bg-cyan-500/10 hover:bg-cyan-500/20 border-cyan-400/45 text-cyan-300'
                  : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-300'
              }`}
              title="Status Akun & Cloud Sync"
            >
              {isCloudMode ? (
                <>
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      className="w-4 h-4 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Cloud className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline max-w-[110px] truncate">
                    {user?.displayName || 'CLOUD SYNC'}
                  </span>
                  <span className="sm:hidden">SYNC</span>
                </>
              ) : (
                <>
                  <CloudOff className="w-3.5 h-3.5" />
                  <span>OFFLINE</span>
                </>
              )}
            </button>
          </div>

          {/* 5 Pity Counters */}
          <div className="grid grid-cols-5 gap-1.5">
            {PITY_DISPLAY_ORDER.map(({ key, label, field }) => {
              const limit = config.pity[key] || 0;
              const current = activePlayer ? Number(activePlayer[field] || 0) : 0;
              const isOff = limit <= 0;
              const isOffside = !isOff && current >= limit;
              const isReady = !isOff && current === limit - 1;

              return (
                <div
                  key={key}
                  className={`px-1.5 py-1 rounded-sm bg-[#141820]/90 border text-center ${
                    isOffside
                      ? 'border-red-500/70'
                      : isReady
                        ? 'border-amber-400/70'
                        : 'border-neutral-800'
                  }`}
                >
                  <div className={`font-mono-tech text-[9px] tracking-wider ${TIER_TEXT_400[key]}`}>
                    {label}
                  </div>
                  <div
                    className={`font-mono-tech text-[11px] sm:text-xs font-bold tabular-nums ${
                      isOff
                        ? 'text-neutral-600'
                        : isOffside
                          ? `${TIER_TEXT_400[key]} pity-offside`
                          : isReady
                            ? `${TIER_TEXT_400[key]} pity-ready`
                            : 'text-neutral-200'
                    }`}
                  >
                    {isOff ? 'OFF' : `${current}/${limit}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Optional subtle import banner when Cloud workspace is fresh and local data exists */}
      {isCloudMode && importableLocal && !dismissedImportBanner && history.length === 0 && (
        <div className="relative z-20 bg-orange-500/15 border-b border-orange-500/40 px-3 py-2">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-orange-200">
              📦 Data gacha lokal ditemukan di browser ini ({importableLocal.players.length} player,{' '}
              {importableLocal.history.length} history). Ingin import ke Cloud?
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportLocalToCloud}
                disabled={importing}
                className="btn-press px-3 py-1 bg-orange-500 hover:bg-orange-400 text-neutral-950 font-bold text-[11px]"
              >
                {importing ? 'MENGIMPORT...' : 'IMPORT KE CLOUD'}
              </button>
              <button
                type="button"
                onClick={() => setDismissedImportBanner(true)}
                className="btn-press px-2 py-1 text-neutral-400 hover:text-white text-[11px]"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-3 sm:px-4 py-5 sm:py-7">
        <div className="w-full max-w-2xl flex flex-col items-center gap-5">
          {/* Centerpiece Orb + Title + QR */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="orb-wrap relative">
              <div className="orb" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[0.14em] text-white uppercase drop-shadow">
              GACHA AKID MALANG
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono-tech text-[11px] text-neutral-400 bg-[#12151a]/85 px-2.5 py-1 border border-neutral-800">
                STOK TERSEDIA: <span className="text-cyan-400 font-bold">{totalStock}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  sfxPlay('click');
                  setQrisModalOpen(true);
                }}
                className="btn-press !normal-case px-3 py-1 bg-[#181c22]/90 hover:bg-[#232933] border border-orange-500/45 text-orange-300 text-xs font-bold tracking-wide"
              >
                📱 Tampilkan QR untuk Main
              </button>
            </div>
          </div>

          {/* Pull 1x + Dynamic Bundle Buttons */}
          <div className="w-full grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2.5">
            <button
              type="button"
              disabled={isPulling}
              onClick={() => void handlePull(1)}
              className="btn-press shimmer ak-cut flex-1 min-w-[140px] py-3.5 px-4 bg-gradient-to-br from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 disabled:opacity-50 text-neutral-950 font-bold shadow-lg shadow-orange-500/25 flex flex-col items-center justify-center"
            >
              <span className="text-base tracking-wider">PULL 1×</span>
              <span className="font-mono-tech text-xs opacity-90">{formatRp(config.singlePrice)}</span>
            </button>

            {sortedBundles.map((b, idx) => {
              const normalPrice = b.qty * config.singlePrice;
              const savings = normalPrice - b.price;
              return (
                <button
                  key={`${b.qty}-${idx}`}
                  type="button"
                  disabled={isPulling}
                  onClick={() => void handlePull(b.qty)}
                  className="btn-press shimmer ak-cut flex-1 min-w-[140px] py-3.5 px-4 bg-gradient-to-br from-[#1d2532] to-[#121720] hover:from-[#263142] hover:to-[#181f2b] border border-cyan-400/60 disabled:opacity-50 text-white font-bold shadow-lg shadow-cyan-500/15 flex flex-col items-center justify-center relative"
                >
                  <span className="text-base tracking-wider text-cyan-300">PULL {b.qty}×</span>
                  <span className="font-mono-tech text-xs text-white">{formatRp(b.price)}</span>
                  {savings > 0 && (
                    <span className="font-mono-tech text-[9px] text-emerald-300 mt-0.5">
                      HEMAT {formatRp(savings)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Pull Box */}
          <div className="w-full max-w-md ak-cut bg-[#12151a]/90 border border-orange-500/35 p-3 flex items-center gap-2">
            <div className="flex flex-col flex-1 min-w-0">
              <label className="font-mono-tech text-[10px] text-neutral-400 tracking-wider">
                CUSTOM PULL (1–500) · BIAYA:{' '}
                <span className="text-amber-300 font-bold">{formatRp(customPullCost)}</span>
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={customPullQty}
                onChange={(e) => setCustomPullQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handlePull(parsedCustomQty);
                }}
                className="admin-input mt-1 !py-1.5 font-mono-tech text-sm"
              />
            </div>
            <button
              type="button"
              disabled={isPulling}
              onClick={() => void handlePull(parsedCustomQty)}
              className="btn-press self-end px-5 py-2.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-neutral-950 font-bold text-xs sm:text-sm tracking-wider shrink-0"
            >
              PULL ✦
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="w-full max-w-md grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                sfxPlay('click');
                setStockModalOpen(true);
              }}
              className="btn-press py-2.5 px-2 bg-[#141820]/90 hover:bg-[#1e2430] border border-neutral-700 hover:border-orange-500/50 text-xs font-bold tracking-wider"
            >
              📦 STOK
            </button>
            <button
              type="button"
              onClick={() => {
                sfxPlay('click');
                setSpendingModalOpen(true);
              }}
              className="btn-press py-2.5 px-2 bg-[#141820]/90 hover:bg-[#1e2430] border border-neutral-700 hover:border-amber-500/50 text-xs font-bold tracking-wider"
            >
              💰 SPENDING
            </button>
            <button
              type="button"
              onClick={() => {
                sfxPlay('click');
                setAdminModalOpen(true);
              }}
              className="btn-press py-2.5 px-2 bg-[#141820]/90 hover:bg-[#1e2430] border border-neutral-700 hover:border-cyan-400/50 text-xs font-bold tracking-wider"
            >
              ⚙️ ADMIN
            </button>
          </div>

          {/* Player Manager & Sound Toggle */}
          <div className="w-full max-w-md flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sfxPlay('click');
                setPlayerModalOpen(true);
              }}
              className="btn-press flex-1 py-2 px-3 bg-[#141820]/90 hover:bg-[#1e2430] border border-orange-500/35 text-xs font-bold text-orange-200 truncate"
            >
              👤 PLAYER MANAGER — {activePlayer?.name || 'PILIH'}
            </button>
            <button
              type="button"
              onClick={() => void handleToggleSfx()}
              className={`btn-press py-2 px-3 border text-xs font-bold flex items-center gap-1.5 shrink-0 ${
                sfxEnabled
                  ? 'bg-[#141820]/90 border-cyan-400/40 text-cyan-300'
                  : 'bg-[#141820]/90 border-neutral-700 text-neutral-500'
              }`}
            >
              {sfxEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span>{sfxEnabled ? 'SUARA' : 'MUTE'}</span>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Global History Strip */}
      <footer className="relative z-20 bg-[#0d1015]/92 backdrop-blur-md border-t border-orange-500/30">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono-tech text-[10px] tracking-[0.16em] text-neutral-400 uppercase">
              // RIWAYAT TERBARU ({history.length})
            </span>
            <button
              type="button"
              onClick={() => {
                sfxPlay('click');
                setHistoryModalOpen(true);
              }}
              className="btn-press font-mono-tech text-[11px] text-orange-400 hover:text-orange-300 font-bold tracking-wider"
            >
              LIHAT SEMUA →
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scroll-area pb-1">
            {recentHistory.length === 0 ? (
              <div className="text-xs text-neutral-500 py-1">Belum ada riwayat pull. Tekan tombol PULL untuk mulai!</div>
            ) : (
              recentHistory.map((h) => (
                <div
                  key={h.id}
                  className={`shrink-0 px-2.5 py-1 rounded-sm text-[11px] flex items-center gap-1.5 ${TIER_HISTORY_CLS[h.rarity]}`}
                >
                  <span>{TIER_EMOJI[h.rarity]}</span>
                  <span className="font-bold">{h.itemName}</span>
                  <span className="opacity-70 text-[10px]">({h.playerName})</span>
                </div>
              ))
            )}
          </div>
        </div>
      </footer>

      {/* Pull Overlay Animation */}
      <PullOverlay
        active={pullOverlayActive}
        results={currentPullResults}
        allItemNames={allItemNames}
        onComplete={handleOverlayComplete}
      />

      {/* Modals */}
      <ResultModal
        isOpen={resultModalOpen}
        results={currentPullResults}
        instantReveal={resultInstantReveal}
        onClose={handleResultClose}
      />

      <CommonModal
        pendingCount={!pullOverlayActive && !resultModalOpen ? pendingCommonsCount : 0}
        availableCommons={availableCommons}
        onPick={(item, qty) => void handlePickCommon(item, qty)}
        onCancel={() => {
          setPendingCommonsCount(0);
          setIsPulling(false);
        }}
      />

      <PlayerModal
        isOpen={playerModalOpen}
        players={players}
        activePlayerId={activePlayer?.id || ''}
        onSelectPlayer={(id) => void handleSelectPlayer(id)}
        onCreatePlayer={handleCreatePlayer}
        onClose={() => setPlayerModalOpen(false)}
      />

      <StockModal
        isOpen={stockModalOpen}
        items={items}
        onSetStock={(id, stk) => void handleSetItemStock(id, stk)}
        onResetDefaultStock={handleResetDefaultStock}
        onClose={() => setStockModalOpen(false)}
      />

      <SpendingModal
        isOpen={spendingModalOpen}
        players={players}
        onClose={() => setSpendingModalOpen(false)}
      />

      <FullHistoryModal
        isOpen={historyModalOpen}
        history={history}
        onClose={() => setHistoryModalOpen(false)}
      />

      <QrisModal isOpen={qrisModalOpen} onClose={() => setQrisModalOpen(false)} />

      <AdminModal
        isOpen={adminModalOpen}
        config={config}
        items={items}
        players={players}
        history={history}
        localBgDataUrl={localBgDataUrl}
        isCloudMode={isCloudMode}
        onSaveRates={handleSaveRates}
        onSavePricing={handleSavePricing}
        onSavePity={handleSavePity}
        onSaveBgSettings={handleSaveBgSettings}
        onSetLocalBg={handleSetLocalBg}
        onSetItemStock={(id, stk) => void handleSetItemStock(id, stk)}
        onAddItem={handleAddItem}
        onRemoveItem={handleRemoveItem}
        onResetHistoryOnly={handleResetHistoryOnly}
        onResetAllData={handleResetAllData}
        onShowAlert={showAlert}
        onShowConfirm={showConfirm}
        onClose={() => setAdminModalOpen(false)}
      />

      <AuthSyncModal
        isOpen={authSyncModalOpen}
        user={user}
        hasImportableLocal={Boolean(importableLocal)}
        importing={importing}
        authBusy={authBusy}
        onGoogleLogin={() => void handleGoogleLogin()}
        onEmailLogin={handleEmailLogin}
        onEmailRegister={handleEmailRegister}
        onResetPassword={handleResetPassword}
        onSignOut={() => void handleSignOut()}
        onImportLocalToCloud={() => void handleImportLocalToCloud()}
        onClose={() => setAuthSyncModalOpen(false)}
      />

      <AkDialogModal dialog={dialog} onClose={() => setDialog(INITIAL_DIALOG)} />
    </div>
  );
}
