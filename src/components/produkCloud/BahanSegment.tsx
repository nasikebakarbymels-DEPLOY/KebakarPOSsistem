import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Trash2,
  Sparkles,
  Loader2,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Bahan } from '../../types';
import { bahanCloudService } from '../../services/cloud/bahanCloudService';
import { BahanFormModal } from './BahanFormModal';
import {
  formatBiayaSatuan,
  formatRupiah,
  formatDateTimeIndo,
  formatQuantityKemasan,
} from '../../utils/formatters';

interface BahanSegmentProps {
  outletId: string;
  userId: string;
}

export const BahanSegment: React.FC<BahanSegmentProps> = ({ outletId, userId }) => {
  const [bahanList, setBahanList] = useState<Bahan[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal & Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBahan, setEditingBahan] = useState<Bahan | null>(null);
  const [deletingBahan, setDeletingBahan] = useState<Bahan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);

  // Toast State & Timer Ref
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  // State Riwayat Harga Collapsible (Default: Collapsed)
  const [expandedRiwayatBahanIds, setExpandedRiwayatBahanIds] = useState<Set<string>>(new Set());

  // Kepadatan tampilan daftar: 'comfortable' (kartu ringkas) | 'compact' (baris daftar 1-baris)
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    try {
      const saved = localStorage.getItem('pos_bahan_density');
      return saved === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });

  const handleDensityChange = (next: 'comfortable' | 'compact') => {
    setDensity(next);
    try {
      localStorage.setItem('pos_bahan_density', next);
    } catch {
      // Abaikan jika storage penuh
    }
  };

  const toggleRiwayat = (bahanId: string) => {
    setExpandedRiwayatBahanIds((prev) => {
      const next = new Set(prev);
      if (next.has(bahanId)) {
        next.delete(bahanId);
      } else {
        next.add(bahanId);
      }
      return next;
    });
  };

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Fetch Bahan dari Firestore
  const fetchBahan = useCallback(async () => {
    if (!outletId) return;
    try {
      setLoading(true);
      const data = await bahanCloudService.getActiveBahan(outletId);
      setBahanList(data);
      setLoadError(false);
    } catch (err) {
      console.error('[BahanSegment] Gagal memuat daftar bahan baku:', err);
      setLoadError(true);
      showToast('Gagal memuat data bahan baku dari server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [outletId, showToast]);

  useEffect(() => {
    fetchBahan();
  }, [fetchBahan]);

  // Filter Search
  const filteredBahan = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return bahanList;
    return bahanList.filter(
      (b) =>
        b.nama.toLowerCase().includes(q) ||
        (b.sku && b.sku.toLowerCase().includes(q)) ||
        (b.catatan && b.catatan.toLowerCase().includes(q)) ||
        (b.kemasanList || []).some((k) => k.nama.toLowerCase().includes(q))
    );
  }, [bahanList, searchQuery]);

  // Handlers
  const handleOpenCreate = () => {
    setEditingBahan(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (b: Bahan) => {
    setEditingBahan(b);
    setIsFormOpen(true);
  };

  const handleFormSuccess = (saved: Bahan) => {
    setIsFormOpen(false);
    showToast(
      editingBahan
        ? `Bahan "${saved.nama}" berhasil diperbarui.${saved.sku ? ` (SKU: ${saved.sku})` : ''}`
        : `Bahan baru "${saved.nama}" berhasil ditambahkan.${saved.sku ? ` (SKU: ${saved.sku})` : ''}`
    );
    fetchBahan();
  };

  // Guard penghapusan bahan sebelum dialog konfirmasi dibuka
  const handleRequestDelete = async (bahan: Bahan) => {
    try {
      setCheckingDeleteId(bahan.id);
      const count = await bahanCloudService.checkBahanUsedInProduk(outletId, bahan.id);
      if (count > 0) {
        showToast(
          `Bahan '${bahan.nama}' masih dipakai di ${count} produk aktif. Ganti resep terlebih dahulu.`,
          'error'
        );
        return;
      }
      setDeletingBahan(bahan);
    } catch (err: unknown) {
      console.error('[BahanSegment] Gagal memeriksa ketergantungan resep bahan:', err);
      showToast('Gagal memeriksa pemakaian bahan pada resep.', 'error');
    } finally {
      setCheckingDeleteId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBahan) return;
    try {
      setIsDeleting(true);
      await bahanCloudService.softDeleteBahan(outletId, deletingBahan.id, userId);
      showToast(`Bahan "${deletingBahan.nama}" berhasil dihapus.`);
      setDeletingBahan(null);
      await fetchBahan();
    } catch (err: unknown) {
      console.error('[BahanSegment] Gagal menghapus bahan:', err);
      const msg = err instanceof Error ? err.message : 'Gagal menghapus bahan baku.';
      showToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
              }
              setToast(null);
            }}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Segmen & Action (Compact) */}
      <div className="flex items-center justify-between gap-2.5 bg-white px-3.5 py-2.5 rounded-2xl border border-stone-200 shadow-2xs">
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-black text-stone-900 flex items-center gap-1.5 truncate">
            <Package className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 shrink-0" />
            <span className="truncate">Katalog Bahan Baku</span>
          </h2>
          <p className="text-[11px] text-stone-500 truncate">
            Satuan dasar, kemasan & acuan HPP ({bahanList.length} bahan)
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-sm transition shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Search Bar + Toggle Kepadatan */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari bahan, kemasan..."
            className="w-full pl-9 pr-12 py-2 rounded-xl text-xs sm:text-sm border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[11px] font-semibold text-stone-400 hover:text-stone-600"
            >
              Hapus
            </button>
          )}
        </div>

        <div className="flex items-center p-0.5 bg-stone-200/80 rounded-xl border border-stone-200 shrink-0">
          <button
            type="button"
            onClick={() => handleDensityChange('comfortable')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
              density === 'comfortable'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Kartu
          </button>
          <button
            type="button"
            onClick={() => handleDensityChange('compact')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
              density === 'compact'
                ? 'bg-white text-stone-900 shadow-2xs'
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            Ringkas
          </button>
        </div>
      </div>

      {/* Content State: Skeleton, Error, Empty, atau Grid Card */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-3 border border-stone-200 shadow-2xs animate-pulse space-y-2"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-stone-200 shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 bg-stone-200 rounded w-3/4" />
                  <div className="h-2.5 bg-stone-100 rounded w-1/3" />
                </div>
              </div>
              <div className="h-8 bg-stone-100 rounded-lg w-full" />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 sm:p-10 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-900">Gagal memuat data bahan baku</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-4">
            Terjadi kendala saat mengambil data bahan dari server cloud. Silakan periksa koneksi internet Anda.
          </p>
          <button
            type="button"
            onClick={fetchBahan}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : bahanList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Belum ada bahan baku</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5">
            Daftarkan bahan baku seperti kopi, susu, gula, sirup, atau packaging untuk mulai menghitung HPP resep produk Anda.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bahan Pertama</span>
          </button>
        </div>
      ) : filteredBahan.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mb-2">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800">Tidak ada bahan yang cocok</h3>
          <p className="text-xs text-stone-400 mt-0.5 mb-3">
            Tidak ditemukan bahan baku dengan kata kunci "{searchQuery}".
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold text-orange-600 hover:underline"
          >
            Bersihkan pencarian
          </button>
        </div>
      ) : density === 'compact' ? (
        /* Mode Ringkas: Daftar 1-baris padat */
        <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 shadow-2xs overflow-hidden">
          {filteredBahan.map((bahan) => {
            const acuanKemasan = (bahan.kemasanList || []).find((k) => k.acuan) || bahan.kemasanList?.[0];
            const isRiwayatExpanded = expandedRiwayatBahanIds.has(bahan.id);
            const riwayatList = bahan.riwayatHarga || [];

            return (
              <div key={bahan.id} className="px-3 py-2 hover:bg-stone-50/70 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-stone-900 truncate">
                        {bahan.nama}
                      </span>
                      <span className="text-[10px] font-semibold text-stone-500 capitalize shrink-0">
                        · {bahan.satuanDasar}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-stone-400 truncate flex items-center gap-1.5">
                      {acuanKemasan && <span>Acuan: {acuanKemasan.nama}</span>}
                      {bahan.sku && <span className="font-mono">· {bahan.sku}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs sm:text-sm font-black text-orange-700 font-mono mr-1">
                      {formatBiayaSatuan(bahan.hargaPerSatuanDasar, bahan.satuanDasar)}
                    </span>

                    {riwayatList.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleRiwayat(bahan.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                        title={`Riwayat harga (${riwayatList.length})`}
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(bahan)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                      title="Edit Bahan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={checkingDeleteId === bahan.id}
                      onClick={() => handleRequestDelete(bahan)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 active:text-rose-700 hover:bg-rose-50 transition disabled:opacity-50"
                      title="Hapus Bahan"
                    >
                      {checkingDeleteId === bahan.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {isRiwayatExpanded && riwayatList.length > 0 && (
                  <div className="mt-2 pt-1.5 border-t border-stone-100 space-y-1">
                    {riwayatList.map((r, rIdx) => (
                      <div
                        key={rIdx}
                        className="flex items-center justify-between text-[10.5px] bg-stone-50 px-2 py-1 rounded-md"
                      >
                        <span className="text-stone-500">{formatDateTimeIndo(r.tanggal)}</span>
                        <span className="font-bold text-stone-800 font-mono">
                          {formatBiayaSatuan(r.hargaPerSatuanDasar, bahan.satuanDasar)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Grid Card Bahan (Ringkas & Hemat Ruang) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredBahan.map((bahan) => {
            const acuanKemasan = (bahan.kemasanList || []).find((k) => k.acuan) || bahan.kemasanList?.[0];
            const isRiwayatExpanded = expandedRiwayatBahanIds.has(bahan.id);
            const riwayatList = bahan.riwayatHarga || [];
            const kemasanList = bahan.kemasanList || [];

            return (
              <div
                key={bahan.id}
                className="bg-white rounded-xl p-3 border border-stone-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-2"
              >
                {/* Header Card: Nama, Satuan Dasar/SKU sebaris & Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-stone-900 leading-snug truncate">
                      {bahan.nama}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-stone-500 flex-wrap">
                      <span className="font-semibold text-stone-600 capitalize">
                        {bahan.satuanDasar}
                      </span>
                      {bahan.sku && (
                        <>
                          <span className="text-stone-300">•</span>
                          <span className="font-mono text-[10px] text-stone-400">
                            {bahan.sku}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(bahan)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                      title="Edit Bahan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={checkingDeleteId === bahan.id}
                      onClick={() => handleRequestDelete(bahan)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:text-rose-600 active:text-rose-700 hover:bg-rose-50 active:bg-rose-100 transition disabled:opacity-50"
                      title="Hapus Bahan"
                    >
                      {checkingDeleteId === bahan.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Box Biaya Acuan 1 Baris */}
                <div className="px-2.5 py-1.5 rounded-lg bg-orange-50/70 border border-orange-200/70 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-orange-950 truncate">
                    Acuan{acuanKemasan ? `: ${acuanKemasan.nama}` : ''}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-orange-700 font-mono shrink-0">
                    {formatBiayaSatuan(bahan.hargaPerSatuanDasar, bahan.satuanDasar)}
                  </span>
                </div>

                {/* Daftar Kemasan Pembelian Chips (Hemat ruang & tanpa redundansi kurung) */}
                {kemasanList.length > 0 && (
                  <div className="flex items-center flex-wrap gap-1">
                    {kemasanList.length > 1 && (
                      <span className="text-[10px] font-bold text-stone-400 mr-0.5">
                        Kemasan ({kemasanList.length}):
                      </span>
                    )}
                    {kemasanList.map((k) => {
                      const qtyLabel = formatQuantityKemasan(k.isi ?? k.netto, bahan.satuanDasar);
                      const normNama = k.nama.toLowerCase().replace(/\s+/g, '');
                      const normQty = qtyLabel.toLowerCase().replace(/\s+/g, '');
                      const showQtyParen = Boolean(qtyLabel) && !normNama.includes(normQty);

                      return (
                        <span
                          key={k.id}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] border ${
                            k.acuan
                              ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                              : 'bg-stone-50 text-stone-700 border-stone-200 font-medium'
                          }`}
                        >
                          {k.acuan && <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />}
                          <span>{k.nama}</span>
                          {showQtyParen && (
                            <span className="text-stone-400">({qtyLabel})</span>
                          )}
                          {typeof k.hargaPerKemasan === 'number' && k.hargaPerKemasan > 0 && (
                            <span className="text-stone-900 font-bold ml-0.5">
                              {formatRupiah(k.hargaPerKemasan)}
                            </span>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Riwayat Harga (Collapsible default) */}
                <div className="pt-1.5 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => toggleRiwayat(bahan.id)}
                    disabled={riwayatList.length === 0}
                    className="w-full flex items-center justify-between text-[11px] font-semibold text-stone-500 hover:text-stone-900 transition py-0.5 disabled:opacity-60 disabled:cursor-default"
                  >
                    <div className="flex items-center gap-1.5">
                      <History className="w-3 h-3 text-stone-400" />
                      <span>Riwayat harga ({riwayatList.length})</span>
                    </div>
                    {riwayatList.length > 0 && (
                      isRiwayatExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-stone-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
                      )
                    )}
                  </button>

                  {isRiwayatExpanded && riwayatList.length > 0 && (
                    <div className="mt-1.5 space-y-1 animate-in fade-in duration-150">
                      {riwayatList.map((r, rIdx) => (
                        <div
                          key={rIdx}
                          className="flex items-center justify-between text-[10.5px] bg-stone-50 px-2 py-1 rounded-md border border-stone-100"
                        >
                          <span className="text-stone-500 font-medium">
                            {formatDateTimeIndo(r.tanggal)}
                          </span>
                          <span className="font-bold text-stone-900 font-mono">
                            {formatBiayaSatuan(r.hargaPerSatuanDasar, bahan.satuanDasar)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Catatan jika ada */}
                {bahan.catatan && (
                  <p className="text-[10.5px] text-stone-500 italic line-clamp-1 pt-1 border-t border-stone-100">
                    "{bahan.catatan}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form Tambah / Edit Bahan */}
      <BahanFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleFormSuccess}
        bahanToEdit={editingBahan}
        outletId={outletId}
        userId={userId}
      />

      {/* Dialog Konfirmasi Hapus Bahan */}
      {deletingBahan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Hapus Bahan Baku?</h3>
                <p className="text-xs text-stone-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus bahan baku <strong>"{deletingBahan.nama}"</strong>?
              Sistem akan memblokir penghapusan apabila bahan masih aktif digunakan dalam resep produk.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingBahan(null)}
                className="px-3.5 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-50 transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Hapus Bahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
