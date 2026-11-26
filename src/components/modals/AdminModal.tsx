import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GachaConfig,
  GachaItem,
  GachaPity,
  GachaPlayer,
  GachaRates,
  HistoryEntry,
  PITY_TIERS,
  PityTier,
  PricingBundle,
  RATE_PRESETS,
  Tier,
  TIER_ACCENT_500,
  TIER_EMOJI,
  TIER_LABEL,
  TIER_TEXT_300,
  TIER_TEXT_400,
  TIERS,
} from '../../types/gacha';
import { compressImageDataUrl, formatRp, sanitizeImageUrl } from '../../utils/gachaEngine';
import { sfxPlay } from '../../utils/sfx';

type AdminTab = 'rates' | 'pricing' | 'items' | 'revenue' | 'pity' | 'stats' | 'bg' | 'qr' | 'reset';

interface AdminModalProps {
  isOpen: boolean;
  config: GachaConfig;
  items: GachaItem[];
  players: GachaPlayer[];
  history: HistoryEntry[];
  localBgDataUrl: string;
  localQrDataUrl: string;
  isCloudMode: boolean;
  onSaveRates: (rates: GachaRates) => Promise<void> | void;
  onSavePricing: (singlePrice: number, bundles: PricingBundle[]) => Promise<void> | void;
  onSavePity: (pity: GachaPity) => Promise<void> | void;
  onSaveBgSettings: (bgBlur: number, bgDim: number, bgUrl: string) => Promise<void> | void;
  onSetLocalBg: (dataUrl: string) => void;
  onSaveQrUrl: (qrUrl: string) => Promise<void> | void;
  onSetLocalQr: (dataUrl: string) => void;
  onSetItemStock: (itemId: string, stock: number) => void;
  onAddItem: (name: string, tier: Tier, stock: number) => Promise<void> | void;
  onRemoveItem: (itemId: string, itemName: string) => void;
  onResetHistoryOnly: () => Promise<void> | void;
  onResetAllData: () => Promise<void> | void;
  onShowAlert: (title: string, message: string) => void;
  onShowConfirm: (opts: {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
  }) => void;
  onClose: () => void;
}

const TAB_LIST: Array<{ id: AdminTab; label: string }> = [
  { id: 'rates', label: '📊 RATES' },
  { id: 'pricing', label: '🏷️ HARGA' },
  { id: 'items', label: '🎁 ITEMS' },
  { id: 'revenue', label: '💵 REVENUE' },
  { id: 'pity', label: '🎯 PITY' },
  { id: 'stats', label: '📈 STATISTIK' },
  { id: 'bg', label: '🖼️ BG' },
  { id: 'qr', label: '📱 KODE QR' },
  { id: 'reset', label: '⚠ RESET' },
];

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  config,
  items,
  players,
  history,
  localBgDataUrl,
  localQrDataUrl,
  isCloudMode,
  onSaveRates,
  onSavePricing,
  onSavePity,
  onSaveBgSettings,
  onSetLocalBg,
  onSaveQrUrl,
  onSetLocalQr,
  onSetItemStock,
  onAddItem,
  onRemoveItem,
  onResetHistoryOnly,
  onResetAllData,
  onShowAlert,
  onShowConfirm,
  onClose,
}) => {
  const [tab, setTab] = useState<AdminTab>('rates');

  // Rates draft (stored as percentage numbers 0..100 for UX)
  const [ratesPct, setRatesPct] = useState<Record<Tier, string>>({
    LEGENDARY: '0.2',
    EPIC: '0.8',
    SR: '3',
    RARE: '7',
    UNCOMMON: '17',
    COMMON: '72',
  });

  // Pricing draft
  const [singlePrice, setSinglePrice] = useState<number>(config.singlePrice);
  const [bundles, setBundles] = useState<PricingBundle[]>(config.bundles);
  const [newBundleQty, setNewBundleQty] = useState<string>('5');
  const [newBundlePrice, setNewBundlePrice] = useState<string>('8000');

  // New item draft
  const [newItemTier, setNewItemTier] = useState<Tier>('COMMON');
  const [newItemName, setNewItemName] = useState('');
  const [newItemStock, setNewItemStock] = useState<string>('10');

  // Pity draft
  const [pityDraft, setPityDraft] = useState<GachaPity>({ ...config.pity });

  // BG draft
  const [bgBlur, setBgBlur] = useState<number>(config.bgBlur);
  const [bgDim, setBgDim] = useState<number>(config.bgDim);
  const [bgUrlDraft, setBgUrlDraft] = useState<string>(config.bgUrl || '');
  const [bgBusy, setBgBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // QR draft
  const [qrUrlDraft, setQrUrlDraft] = useState<string>(config.qrUrl || '');
  const [qrBusy, setQrBusy] = useState(false);
  const qrFileInputRef = useRef<HTMLInputElement>(null);

  // Reset confirmation text
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Sync drafts whenever modal opens or config changes
  useEffect(() => {
    if (!isOpen) return;
    setRatesPct({
      LEGENDARY: String(Number((config.rates.LEGENDARY * 100).toFixed(4))),
      EPIC: String(Number((config.rates.EPIC * 100).toFixed(4))),
      SR: String(Number((config.rates.SR * 100).toFixed(4))),
      RARE: String(Number((config.rates.RARE * 100).toFixed(4))),
      UNCOMMON: String(Number((config.rates.UNCOMMON * 100).toFixed(4))),
      COMMON: String(Number((config.rates.COMMON * 100).toFixed(4))),
    });
    setSinglePrice(config.singlePrice);
    setBundles(config.bundles.map((b) => ({ ...b })));
    setPityDraft({ ...config.pity });
    setBgBlur(config.bgBlur);
    setBgDim(config.bgDim);
    setBgUrlDraft(config.bgUrl || '');
    setQrUrlDraft(config.qrUrl || '');
    setResetConfirmText('');
  }, [isOpen, config]);

  // Derived rates sum
  const totalRatePct = useMemo(() => {
    return TIERS.reduce((sum, t) => sum + (parseFloat(ratesPct[t]) || 0), 0);
  }, [ratesPct]);
  const isRatesValid = Math.abs(totalRatePct - 100) < 0.001;

  // Derived revenue & stats
  const totalRevenue = useMemo(
    () => players.reduce((sum, p) => sum + (p.totalSpending || 0), 0),
    [players]
  );
  const totalPullsAll = useMemo(
    () => players.reduce((sum, p) => sum + (p.totalPulls || 0), 0),
    [players]
  );

  const tierTotalsFromHistory = useMemo(() => {
    const counts: Record<Tier, number> = {
      LEGENDARY: 0,
      EPIC: 0,
      SR: 0,
      RARE: 0,
      UNCOMMON: 0,
      COMMON: 0,
    };
    history.forEach((h) => {
      counts[h.rarity] = (counts[h.rarity] || 0) + 1;
    });
    return counts;
  }, [history]);

  const itemDropCounts = useMemo(() => {
    const map = new Map<string, { name: string; tier: Tier; count: number }>();
    history.forEach((h) => {
      const key = `${h.rarity}__${h.itemName}`;
      const existing = map.get(key);
      if (existing) existing.count++;
      else map.set(key, { name: h.itemName, tier: h.rarity, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [history]);

  const maxItemDrop = itemDropCounts[0]?.count || 1;

  if (!isOpen) return null;

  const applyPreset = (key: 'hemat' | 'seimbang' | 'meriah') => {
    sfxPlay('click');
    const p = RATE_PRESETS[key];
    setRatesPct({
      LEGENDARY: String(Number((p.LEGENDARY * 100).toFixed(4))),
      EPIC: String(Number((p.EPIC * 100).toFixed(4))),
      SR: String(Number((p.SR * 100).toFixed(4))),
      RARE: String(Number((p.RARE * 100).toFixed(4))),
      UNCOMMON: String(Number((p.UNCOMMON * 100).toFixed(4))),
      COMMON: String(Number((p.COMMON * 100).toFixed(4))),
    });
  };

  const assignRemainderToTier = (targetTier: Tier) => {
    sfxPlay('click');
    const others = TIERS.filter((t) => t !== targetTier).reduce(
      (sum, t) => sum + (parseFloat(ratesPct[t]) || 0),
      0
    );
    const rem = Math.max(0, Number((100 - others).toFixed(4)));
    setRatesPct((prev) => ({ ...prev, [targetTier]: String(rem) }));
  };

  const handleSaveRatesClick = async () => {
    sfxPlay('click');
    if (!isRatesValid) {
      onShowAlert('Total Rate Harus 100%', `Total saat ini ${totalRatePct.toFixed(3)}%. Pastikan jumlah semua tier tepat 100%.`);
      return;
    }
    const next: GachaRates = {
      LEGENDARY: Math.max(0, (parseFloat(ratesPct.LEGENDARY) || 0) / 100),
      EPIC: Math.max(0, (parseFloat(ratesPct.EPIC) || 0) / 100),
      SR: Math.max(0, (parseFloat(ratesPct.SR) || 0) / 100),
      RARE: Math.max(0, (parseFloat(ratesPct.RARE) || 0) / 100),
      UNCOMMON: Math.max(0, (parseFloat(ratesPct.UNCOMMON) || 0) / 100),
      COMMON: Math.max(0, (parseFloat(ratesPct.COMMON) || 0) / 100),
    };
    await onSaveRates(next);
    onShowAlert('Rates Disimpan', 'Konfigurasi drop rate berhasil disimpan dan disinkronkan.');
  };

  const handleAddBundle = () => {
    sfxPlay('click');
    const qty = Math.floor(Number(newBundleQty) || 0);
    const price = Math.max(0, Math.round(Number(newBundlePrice) || 0));
    if (qty < 2) {
      onShowAlert('Jumlah Tidak Valid', 'Jumlah pull paket bundling minimal 2x.');
      return;
    }
    const existsIdx = bundles.findIndex((b) => b.qty === qty);
    if (existsIdx >= 0) {
      const next = bundles.map((b, i) => (i === existsIdx ? { qty, price } : b));
      setBundles(next.sort((a, b) => a.qty - b.qty));
    } else {
      setBundles([...bundles, { qty, price }].sort((a, b) => a.qty - b.qty));
    }
    setNewBundleQty('');
    setNewBundlePrice('');
  };

  const handleSavePricingClick = () => {
    sfxPlay('click');
    const cleanSingle = Math.max(0, Math.round(Number(singlePrice) || 0));
    const cleanBundles = bundles
      .filter((b) => b.qty >= 2 && b.price >= 0)
      .sort((a, b) => a.qty - b.qty);

    const overpriced = cleanBundles.find((b) => cleanSingle > 0 && b.price >= b.qty * cleanSingle);
    const doSave = async () => {
      await onSavePricing(cleanSingle, cleanBundles);
      onShowAlert('Harga Disimpan', 'Harga 1× pull dan paket bundling berhasil diperbarui.');
    };

    if (overpriced) {
      onShowConfirm({
        title: 'Paket Bundling Lebih Mahal',
        message: `Paket ${overpriced.qty}× (${formatRp(overpriced.price)}) tidak lebih hemat dari beli satuan (${formatRp(
          overpriced.qty * cleanSingle
        )}). Tetap simpan?`,
        confirmLabel: 'TETAP SIMPAN',
        onConfirm: () => {
          void doSave();
        },
      });
    } else {
      void doSave();
    }
  };

  const handleAddNewItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemName.trim();
    if (!trimmed) return;
    if (items.some((it) => it.name.toLowerCase() === trimmed.toLowerCase())) {
      onShowAlert('Nama Duplikat', `Item "${trimmed}" sudah ada di daftar.`);
      return;
    }
    sfxPlay('click');
    const stk = Math.max(0, Math.floor(Number(newItemStock) || 0));
    await onAddItem(trimmed, newItemTier, stk);
    setNewItemName('');
    setNewItemStock('10');
  };

  const handleSavePityClick = async () => {
    sfxPlay('click');
    await onSavePity(pityDraft);
    onShowAlert('Pity Disimpan', 'Pengaturan pity per tier berhasil diperbarui.');
  };

  const handleBgFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgBusy(true);
    try {
      const reader = new FileReader();
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImageDataUrl(rawDataUrl);
      onSetLocalBg(compressed);
      onShowAlert('Background Lokal Dipasang', 'Gambar latar lokal berhasil dikompres dan diterapkan pada perangkat ini.');
    } catch {
      onShowAlert('Gagal Upload', 'Tidak dapat memproses file gambar tersebut.');
    } finally {
      setBgBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveBgAll = async () => {
    sfxPlay('click');
    const cleanUrl = bgUrlDraft.trim() ? sanitizeImageUrl(bgUrlDraft.trim()) : '';
    if (bgUrlDraft.trim() && !cleanUrl) {
      onShowAlert('URL Tidak Valid', 'Gunakan URL gambar berawalan https:// atau http://.');
      return;
    }
    await onSaveBgSettings(bgBlur, bgDim, cleanUrl);
    onShowAlert(
      'Background Disimpan',
      isCloudMode
        ? 'Pengaturan blur, gelap, dan URL gambar background tersimpan ke Cloud.'
        : 'Pengaturan background berhasil disimpan.'
    );
  };

  const handleQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setQrBusy(true);
    try {
      const reader = new FileReader();
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gagal membaca file gambar QR.'));
        reader.readAsDataURL(file);
      });
      const compressed = await compressImageDataUrl(rawDataUrl, 1024, 0.92);
      onSetLocalQr(compressed);
      onShowAlert(
        'Kode QR Lokal Dipasang',
        'Gambar kode QR baru berhasil diterapkan pada perangkat ini.'
      );
    } catch {
      onShowAlert('Gagal Upload QR', 'Tidak dapat memproses file gambar tersebut.');
    } finally {
      setQrBusy(false);
      if (qrFileInputRef.current) qrFileInputRef.current.value = '';
    }
  };

  const handleSaveQrUrlClick = async () => {
    sfxPlay('click');
    const cleanUrl = qrUrlDraft.trim() ? sanitizeImageUrl(qrUrlDraft.trim()) : '';
    if (qrUrlDraft.trim() && !cleanUrl) {
      onShowAlert('URL Tidak Valid', 'Gunakan URL gambar berawalan https:// atau http://.');
      return;
    }
    if (cleanUrl && localQrDataUrl) {
      onSetLocalQr('');
    }
    await onSaveQrUrl(cleanUrl);
    onShowAlert(
      'Kode QR Disimpan',
      cleanUrl
        ? isCloudMode
          ? 'URL gambar kode QR tersimpan dan otomatis tersinkron ke semua perangkat.'
          : 'URL gambar kode QR berhasil disimpan.'
        : 'URL kode QR dikosongkan dan kembali ke gambar QR default.'
    );
  };

  const handleResetQrDefault = async () => {
    sfxPlay('click');
    onSetLocalQr('');
    setQrUrlDraft('');
    await onSaveQrUrl('');
    onShowAlert('QR Default Dipulihkan', 'Kode QR dikembalikan ke gambar bawaan AKID Malang.');
  };

  const activePreviewBg = sanitizeImageUrl(localBgDataUrl) || sanitizeImageUrl(bgUrlDraft);
  const defaultQrSrc = `${import.meta.env.BASE_URL}qris-code.png`;
  const activePreviewQr = sanitizeImageUrl(localQrDataUrl) || sanitizeImageUrl(qrUrlDraft) || defaultQrSrc;
  const qrSourceLabel = sanitizeImageUrl(localQrDataUrl)
    ? 'UPLOAD LOKAL (PERANGKAT INI)'
    : sanitizeImageUrl(qrUrlDraft)
      ? 'URL CLOUD (SYNC)'
      : 'QR BAWAAN DEFAULT';
  const isPreviewDefaultQr = !sanitizeImageUrl(localQrDataUrl) && !sanitizeImageUrl(qrUrlDraft);

  return (
    <div
      className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-enter ak-cut bg-[#12151a] border border-orange-500/50 w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden shadow-2xl">
        <div className="ak-hazard-strip shrink-0" />
        <div className="px-4 sm:px-5 py-3.5 border-b border-orange-500/25 flex items-center justify-between shrink-0">
          <div>
            <div className="font-mono-tech text-[10px] text-orange-400 tracking-widest">
              // ZEROTH COMMAND CONSOLE
            </div>
            <h3 className="text-lg font-bold text-white tracking-wider uppercase">⚙️ ADMIN PANEL</h3>
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

        {/* 8 Tabs */}
        <div className="px-3 py-2.5 border-b border-neutral-800 bg-[#0d1015] flex flex-wrap gap-1.5 shrink-0">
          {TAB_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                sfxPlay('click');
                setTab(t.id);
              }}
              className={`btn-press px-2.5 py-1.5 text-[11px] font-bold tracking-wider rounded-sm ${
                tab === t.id ? 'tab-active' : 'tab-inactive hover:text-neutral-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-4 sm:p-5 overflow-y-auto scroll-area flex-1 space-y-4">
          {/* 1. RATES */}
          {tab === 'rates' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-neutral-400 uppercase tracking-wider">Preset Cepat:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('hemat')}
                    className="btn-press px-3 py-1 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-xs text-neutral-200"
                  >
                    Hemat
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('seimbang')}
                    className="btn-press px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-xs text-orange-300"
                  >
                    Seimbang
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('meriah')}
                    className="btn-press px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs text-amber-300"
                  >
                    Meriah
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {TIERS.map((tier) => (
                  <div key={tier} className="admin-row flex items-center justify-between gap-2">
                    <div className={`text-xs font-bold flex items-center gap-1.5 ${TIER_TEXT_400[tier]}`}>
                      <span>{TIER_EMOJI[tier]}</span>
                      <span>{TIER_LABEL[tier].toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        max={100}
                        value={ratesPct[tier]}
                        onChange={(e) => setRatesPct((prev) => ({ ...prev, [tier]: e.target.value }))}
                        className="admin-input !w-24 text-right font-mono-tech !py-1.5"
                      />
                      <span className="font-mono-tech text-xs text-neutral-400">%</span>
                      <button
                        type="button"
                        onClick={() => assignRemainderToTier(tier)}
                        className="btn-press px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-[10px] text-neutral-300"
                        title={`Isi sisa % ke ${TIER_LABEL[tier]}`}
                      >
                        ↺ sisa
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className={`p-3 rounded-sm border flex items-center justify-between text-xs font-mono-tech ${
                  isRatesValid
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-500/15 border-red-500/50 text-red-300'
                }`}
              >
                <span>TOTAL RATE: {totalRatePct.toFixed(3)}%</span>
                <span>{isRatesValid ? '✓ VALID (100%)' : '⚠ HARUS 100%'}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => assignRemainderToTier('COMMON')}
                  className="btn-press flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-xs text-neutral-200 font-bold"
                >
                  ↺ SEBAR SISA KE COMMON
                </button>
                <button
                  type="button"
                  onClick={handleSaveRatesClick}
                  className="btn-press flex-1 py-2.5 bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-bold tracking-wider"
                >
                  💾 SIMPAN RATES
                </button>
              </div>
            </div>
          )}

          {/* 2. HARGA & BUNDLING */}
          {tab === 'pricing' && (
            <div className="space-y-4">
              <div className="admin-row space-y-2">
                <label className="block text-xs font-bold text-orange-400 uppercase tracking-wider">
                  Harga 1× Pull (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={singlePrice}
                  onChange={(e) => setSinglePrice(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                  className="admin-input font-mono-tech"
                />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Paket Bundling Aktif
                </div>
                {bundles.length === 0 ? (
                  <div className="text-xs text-neutral-500 p-3 bg-[#14171c] border border-neutral-800">
                    Belum ada paket bundling.
                  </div>
                ) : (
                  bundles.map((b, idx) => {
                    const normal = b.qty * singlePrice;
                    const save = normal - b.price;
                    return (
                      <div key={`${b.qty}-${idx}`} className="admin-row flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={2}
                            value={b.qty}
                            onChange={(e) => {
                              const v = Math.max(2, Math.floor(Number(e.target.value) || 2));
                              setBundles((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: v } : it)));
                            }}
                            className="admin-input !w-16 text-center font-mono-tech !py-1.5"
                          />
                          <span className="text-xs text-neutral-400">× Pull = Rp</span>
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={b.price}
                            onChange={(e) => {
                              const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                              setBundles((prev) => prev.map((it, i) => (i === idx ? { ...it, price: v } : it)));
                            }}
                            className="admin-input !w-28 font-mono-tech !py-1.5"
                          />
                        </div>
                        <div className="flex-1 text-right font-mono-tech text-[11px]">
                          {save > 0 ? (
                            <span className="text-emerald-400">Hemat {formatRp(save)}</span>
                          ) : save < 0 ? (
                            <span className="text-red-400">Lebih mahal</span>
                          ) : (
                            <span className="text-neutral-500">Sama</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            sfxPlay('click');
                            setBundles((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="btn-press px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 text-[10px] font-bold"
                        >
                          HAPUS
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="admin-row space-y-2 border border-dashed border-orange-500/35">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">+ Tambah Paket Bundling</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={2}
                    placeholder="Jumlah pull (cth: 5)"
                    value={newBundleQty}
                    onChange={(e) => setNewBundleQty(e.target.value)}
                    className="admin-input font-mono-tech"
                  />
                  <input
                    type="number"
                    min={0}
                    step={500}
                    placeholder="Harga Rp (cth: 8000)"
                    value={newBundlePrice}
                    onChange={(e) => setNewBundlePrice(e.target.value)}
                    className="admin-input font-mono-tech"
                  />
                  <button
                    type="button"
                    onClick={handleAddBundle}
                    className="btn-press col-span-2 sm:col-span-1 py-2 bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-300 text-xs font-bold"
                  >
                    + TAMBAH
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSavePricingClick}
                className="btn-press w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-bold tracking-wider"
              >
                💾 SIMPAN HARGA & BUNDLING
              </button>
            </div>
          )}

          {/* 3. ITEMS */}
          {tab === 'items' && (
            <div className="space-y-4">
              <form onSubmit={handleAddNewItem} className="admin-row space-y-2 border border-orange-500/35">
                <div className="text-xs font-bold text-orange-400 uppercase tracking-wider">+ Tambah Hadiah Baru</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    value={newItemTier}
                    onChange={(e) => setNewItemTier(e.target.value as Tier)}
                    className="admin-input"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>
                        {TIER_EMOJI[t]} {TIER_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Nama item..."
                    maxLength={80}
                    className="admin-input sm:col-span-2"
                  />
                  <input
                    type="number"
                    min={0}
                    value={newItemStock}
                    onChange={(e) => setNewItemStock(e.target.value)}
                    placeholder="Stok"
                    className="admin-input font-mono-tech"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newItemName.trim()}
                  className="btn-press w-full py-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-neutral-950 text-xs font-bold"
                >
                  + TAMBAH ITEM KE POOL
                </button>
              </form>

              {TIERS.map((tier) => {
                const tierItems = items.filter((it) => it.tier === tier);
                return (
                  <div key={tier} className="space-y-1.5">
                    <div className={`text-xs font-bold uppercase tracking-wider ${TIER_TEXT_400[tier]}`}>
                      {TIER_EMOJI[tier]} {TIER_LABEL[tier]} ({tierItems.length})
                    </div>
                    {tierItems.length === 0 ? (
                      <div className="text-[11px] text-neutral-500 pl-2">Belum ada item di tier ini.</div>
                    ) : (
                      tierItems.map((it) => (
                        <div key={it.id} className="admin-row flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white flex-1 min-w-[120px] truncate">
                            {it.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                sfxPlay('click');
                                onSetItemStock(it.id, Math.max(0, it.stock - 1));
                              }}
                              className="btn-press w-7 h-7 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={it.stock}
                              onChange={(e) =>
                                onSetItemStock(it.id, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                              }
                              className="admin-input !w-14 text-center !py-1 font-mono-tech text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                sfxPlay('click');
                                onSetItemStock(it.id, it.stock + 1);
                              }}
                              className="btn-press w-7 h-7 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold"
                            >
                              +
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                sfxPlay('click');
                                onRemoveItem(it.id, it.name);
                              }}
                              className="btn-press px-2 py-1 bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-300 text-[10px] font-bold"
                            >
                              HAPUS
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 4. REVENUE */}
          {tab === 'revenue' && (
            <div className="space-y-4">
              <div className="p-5 bg-gradient-to-br from-orange-500/25 via-amber-500/15 to-[#14171c] border border-orange-500/50 rounded-sm">
                <div className="font-mono-tech text-[10px] text-orange-300 tracking-widest uppercase">
                  TOTAL REVENUE TERKUMPUL
                </div>
                <div className="font-mono-tech text-3xl font-bold text-white mt-1">{formatRp(totalRevenue)}</div>
                <div className="font-mono-tech text-xs text-neutral-300 mt-2 flex gap-4">
                  <span>Total Pull: {totalPullsAll}×</span>
                  <span>Player: {players.length}</span>
                </div>
              </div>

              <div className="space-y-2">
                {[...players]
                  .sort((a, b) => b.totalSpending - a.totalSpending)
                  .map((p) => {
                    const share = totalRevenue > 0 ? Math.round((p.totalSpending / totalRevenue) * 100) : 0;
                    return (
                      <div key={p.id} className="admin-row space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{p.name}</span>
                          <span className="font-mono-tech text-amber-300 font-bold">
                            {formatRp(p.totalSpending)} ({share}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-neutral-800 overflow-hidden">
                          <div className="h-full bg-orange-500" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 5. PITY */}
          {tab === 'pity' && (
            <div className="space-y-3">
              <p className="text-xs text-neutral-400">
                Aktifkan atau nonaktifkan sistem pity untuk setiap tier. Pity otomatis terpicu tepat pada pull ke-N.
              </p>
              {PITY_TIERS.map((tier: PityTier) => {
                const enabled = pityDraft[tier] > 0;
                return (
                  <div key={tier} className="admin-row flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) => {
                          sfxPlay('click');
                          const defaults: Record<PityTier, number> = {
                            LEGENDARY: 200,
                            EPIC: 80,
                            SR: 45,
                            RARE: 15,
                            UNCOMMON: 8,
                          };
                          setPityDraft((prev) => ({
                            ...prev,
                            [tier]: e.target.checked ? defaults[tier] : 0,
                          }));
                        }}
                        className={`w-4 h-4 ${TIER_ACCENT_500[tier]}`}
                      />
                      <span className={`text-xs font-bold uppercase ${TIER_TEXT_400[tier]}`}>
                        {TIER_EMOJI[tier]} {TIER_LABEL[tier]}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        disabled={!enabled}
                        value={enabled ? pityDraft[tier] : ''}
                        placeholder="OFF"
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(10000, Math.floor(Number(e.target.value) || 1)));
                          setPityDraft((prev) => ({ ...prev, [tier]: v }));
                        }}
                        className="admin-input !w-24 text-center font-mono-tech !py-1.5 disabled:opacity-40"
                      />
                      <span className="font-mono-tech text-[11px] text-neutral-400">pull</span>
                    </div>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleSavePityClick}
                className="btn-press w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-bold tracking-wider"
              >
                💾 SIMPAN PITY
              </button>
            </div>
          )}

          {/* 6. STATISTIK */}
          {tab === 'stats' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2">
                <div className="admin-row text-center">
                  <div className="font-mono-tech text-[10px] text-neutral-400">TOTAL PULL</div>
                  <div className="font-mono-tech text-lg font-bold text-white">{totalPullsAll}</div>
                </div>
                <div className="admin-row text-center">
                  <div className="font-mono-tech text-[10px] text-neutral-400">REVENUE</div>
                  <div className="font-mono-tech text-sm sm:text-base font-bold text-amber-400 truncate">
                    {formatRp(totalRevenue)}
                  </div>
                </div>
                <div className="admin-row text-center">
                  <div className="font-mono-tech text-[10px] text-neutral-400">TOTAL HISTORY</div>
                  <div className="font-mono-tech text-lg font-bold text-cyan-400">{history.length}</div>
                </div>
              </div>

              {/* Real vs Setting rates */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                  Realita Drop vs Setting Rate
                </div>
                {TIERS.map((tier) => {
                  const cnt = tierTotalsFromHistory[tier] || 0;
                  const realPct = history.length > 0 ? ((cnt / history.length) * 100).toFixed(2) : '0.00';
                  const setPct = (config.rates[tier] * 100).toFixed(2);
                  return (
                    <div key={tier} className="admin-row flex items-center justify-between text-xs font-mono-tech">
                      <span className={`font-bold ${TIER_TEXT_400[tier]}`}>
                        {TIER_EMOJI[tier]} {TIER_LABEL[tier]}
                      </span>
                      <span className="text-neutral-300">
                        {cnt}× · Real <span className="text-white font-bold">{realPct}%</span> / Set {setPct}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Item keluar bar chart */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  Distribusi Item Keluar ({itemDropCounts.length} jenis)
                </div>
                {itemDropCounts.length === 0 ? (
                  <div className="text-xs text-neutral-500">Belum ada item yang keluar.</div>
                ) : (
                  itemDropCounts.map((row) => {
                    const pct = Math.round((row.count / maxItemDrop) * 100);
                    return (
                      <div key={`${row.tier}-${row.name}`} className="admin-row space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-bold ${TIER_TEXT_300[row.tier]}`}>
                            {TIER_EMOJI[row.tier]} {row.name}
                          </span>
                          <span className="font-mono-tech text-white font-bold">{row.count}×</span>
                        </div>
                        <div className="h-1.5 bg-neutral-800 overflow-hidden">
                          <div className="h-full bg-cyan-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Per-player details */}
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Detail Per Player</div>
                {[...players]
                  .sort((a, b) => b.totalPulls - a.totalPulls)
                  .map((p) => (
                    <div key={p.id} className="admin-row space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{p.name}</span>
                        <span className="font-mono-tech text-amber-400">
                          {p.totalPulls}× · {formatRp(p.totalSpending)}
                        </span>
                      </div>
                      <div className="font-mono-tech text-[11px] text-neutral-400 flex flex-wrap gap-x-3">
                        <span>L:{p.tierCounts.LEGENDARY}</span>
                        <span>E:{p.tierCounts.EPIC}</span>
                        <span>SR:{p.tierCounts.SR}</span>
                        <span>R:{p.tierCounts.RARE}</span>
                        <span>U:{p.tierCounts.UNCOMMON}</span>
                        <span>C:{p.tierCounts.COMMON}</span>
                      </div>
                      <div className="font-mono-tech text-[10px] text-neutral-500">
                        Pity U:{p.uncPity} R:{p.rPity} SR:{p.srPity} E:{p.epicPity} L:{p.legPity} · Terakhir:{' '}
                        {p.lastPullAt ? new Date(p.lastPullAt).toLocaleString('id-ID') : '-'}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 7. BACKGROUND */}
          {tab === 'bg' && (
            <div className="space-y-4">
              <div className="relative h-36 rounded-sm overflow-hidden border border-orange-500/35 bg-[#0a0c0f]">
                {activePreviewBg ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center scale-105"
                    style={{
                      backgroundImage: `url("${activePreviewBg}")`,
                      filter: `blur(${bgBlur}px)`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 ak-grid-bg flex items-center justify-center text-xs text-neutral-500 font-mono-tech">
                    DEFAULT TACTICAL GRID
                  </div>
                )}
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: `rgba(10,12,15,${bgDim / 100})` }}
                />
                <div className="relative z-10 h-full flex flex-col items-center justify-center pointer-events-none">
                  <span className="font-mono-tech text-[11px] text-orange-300 bg-black/50 px-2.5 py-1 border border-orange-500/40">
                    PREVIEW · BLUR {bgBlur}PX · GELAP {bgDim}%
                  </span>
                </div>
              </div>

              <div className="admin-row space-y-2">
                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  URL Gambar Cloud (Sync Antar Perangkat)
                </label>
                <input
                  type="url"
                  value={bgUrlDraft}
                  onChange={(e) => setBgUrlDraft(e.target.value)}
                  placeholder="https://contoh.com/background.jpg (opsional)"
                  className="admin-input"
                />
                <p className="text-[11px] text-neutral-400">
                  Isi URL gambar publik agar background ikut tersinkron otomatis ke semua perangkat via Firebase.
                </p>
              </div>

              <div className="admin-row space-y-2">
                <div className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                  Upload File Lokal (Perangkat Ini)
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBgFileChange}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={bgBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="btn-press flex-1 py-2 bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500/50 text-orange-300 text-xs font-bold"
                  >
                    {bgBusy ? 'MEMPROSES...' : '📁 PILIH GAMBAR LOKAL'}
                  </button>
                  {(localBgDataUrl || bgUrlDraft) && (
                    <button
                      type="button"
                      onClick={() => {
                        sfxPlay('click');
                        onSetLocalBg('');
                        setBgUrlDraft('');
                        void onSaveBgSettings(bgBlur, bgDim, '');
                      }}
                      className="btn-press px-4 py-2 bg-red-600/20 hover:bg-red-600/35 border border-red-500/50 text-red-300 text-xs font-bold"
                    >
                      HAPUS BG
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-row space-y-3">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-300 font-bold">BLUR BACKGROUND</span>
                    <span className="font-mono-tech text-orange-400">{bgBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={bgBlur}
                    onChange={(e) => setBgBlur(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    {[0, 4, 8, 14, 22].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setBgBlur(v)}
                        className={`btn-press flex-1 py-1 text-[10px] font-mono-tech border ${
                          bgBlur === v
                            ? 'bg-orange-500 text-neutral-950 border-orange-400 font-bold'
                            : 'bg-neutral-800 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        {v}px
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-neutral-300 font-bold">KEGELAPAN OVERLAY (DIM)</span>
                    <span className="font-mono-tech text-orange-400">{bgDim}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={90}
                    value={bgDim}
                    onChange={(e) => setBgDim(Number(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveBgAll}
                className="btn-press w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-bold tracking-wider"
              >
                💾 SIMPAN PENGATURAN BACKGROUND
              </button>
            </div>
          )}

          {/* 8. KODE QR */}
          {tab === 'qr' && (
            <div className="space-y-4">
              <div className="admin-row flex flex-col items-center gap-3 py-4 border border-orange-500/35">
                <div className="font-mono-tech text-[10px] text-orange-400 tracking-widest">
                  PREVIEW KODE QR AKTIF · {qrSourceLabel}
                </div>
                <div className="bg-white p-3 rounded-sm shadow-lg inline-flex items-center justify-center">
                  <img
                    src={activePreviewQr}
                    alt="Preview Kode QR"
                    className="w-44 max-h-56 object-contain"
                    style={isPreviewDefaultQr ? { imageRendering: 'pixelated' } : undefined}
                  />
                </div>
              </div>

              <div className="admin-row space-y-2">
                <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  URL Gambar QR Cloud (Sync Antar Perangkat)
                </label>
                <input
                  type="url"
                  value={qrUrlDraft}
                  onChange={(e) => setQrUrlDraft(e.target.value)}
                  placeholder="https://contoh.com/kode-qr.png"
                  className="admin-input"
                />
                <p className="text-[11px] text-neutral-400">
                  Tempel link gambar kode QR publik agar otomatis tersinkron ke semua perangkat yang login akun ini.
                </p>
                <button
                  type="button"
                  onClick={() => void handleSaveQrUrlClick()}
                  className="btn-press w-full py-2.5 bg-orange-500 hover:bg-orange-400 text-neutral-950 text-xs font-bold tracking-wider"
                >
                  💾 SIMPAN URL KODE QR
                </button>
              </div>

              <div className="admin-row space-y-2">
                <div className="text-xs font-bold text-orange-400 uppercase tracking-wider">
                  Upload Gambar QR dari Perangkat Ini
                </div>
                <p className="text-[11px] text-neutral-400">
                  Pilih file gambar QR langsung dari galeri/komputer (tersimpan lokal di browser perangkat ini).
                </p>
                <input
                  ref={qrFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQrFileChange}
                  className="hidden"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={qrBusy}
                    onClick={() => qrFileInputRef.current?.click()}
                    className="btn-press flex-1 py-2.5 bg-orange-500/20 hover:bg-orange-500/35 border border-orange-500/50 text-orange-300 text-xs font-bold"
                  >
                    {qrBusy ? 'MEMPROSES...' : '📁 UPLOAD GAMBAR QR'}
                  </button>
                  {!isPreviewDefaultQr && (
                    <button
                      type="button"
                      onClick={() => void handleResetQrDefault()}
                      className="btn-press px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 text-neutral-200 text-xs font-bold"
                    >
                      ↺ QR DEFAULT
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 9. RESET */}
          {tab === 'reset' && (
            <div className="space-y-4">
              <div className="admin-row border-l-amber-500 space-y-2">
                <div className="text-sm font-bold text-amber-400">🧹 Reset Riwayat Pull Saja</div>
                <p className="text-xs text-neutral-400">
                  Menghapus seluruh catatan riwayat pull global dan hitungan tier history, namun{' '}
                  <span className="text-neutral-200 font-bold">tidak menghapus</span> player, pity, stok, rates, atau
                  harga.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    sfxPlay('click');
                    onShowConfirm({
                      title: 'Reset History Saja?',
                      message: 'Seluruh riwayat pull akan dihapus permanen. Lanjutkan?',
                      confirmLabel: 'HAPUS HISTORY',
                      danger: true,
                      onConfirm: () => {
                        void onResetHistoryOnly();
                      },
                    });
                  }}
                  className="btn-press w-full py-2.5 bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-300 text-xs font-bold"
                >
                  🧹 RESET HISTORY SAJA
                </button>
              </div>

              <div className="admin-row border-l-red-500 space-y-3 bg-red-950/15 border border-red-500/30">
                <div className="text-sm font-bold text-red-400">☢️ Reset Seluruh Data ke Default</div>
                <p className="text-xs text-neutral-300">
                  Menghapus SEMUA player, pity, spending, history, item kustom, dan mengembalikan rates/stok/harga ke
                  pengaturan awal. Ketik <span className="font-mono-tech text-red-300 font-bold">RESET</span> untuk
                  membuka tombol.
                </p>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder='Ketik "RESET" di sini...'
                  className="admin-input font-mono-tech uppercase"
                />
                <button
                  type="button"
                  disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                  onClick={() => {
                    sfxPlay('click');
                    onShowConfirm({
                      title: 'KONFIRMASI RESET TOTAL',
                      message: 'Semua data gacha di workspace ini akan dihapus permanen dan kembali ke default!',
                      confirmLabel: 'YA, RESET TOTAL',
                      danger: true,
                      onConfirm: () => {
                        setResetConfirmText('');
                        void onResetAllData();
                      },
                    });
                  }}
                  className="btn-press w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-35 text-white text-xs font-bold tracking-wider"
                >
                  ☢️ RESET SEMUA DATA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
