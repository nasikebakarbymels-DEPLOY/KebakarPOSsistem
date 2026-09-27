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
} from 'lucide-react';
import { Bahan } from '../../types';
import { bahanCloudService } from '../../services/cloud/bahanCloudService';
import { BahanFormModal } from './BahanFormModal';
import { formatBiayaSatuan, formatRupiah, formatTanggalSlash } from '../../utils/formatters';

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
    <div className="space-y-4">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-in fade-in ${
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

      {/* Header Segmen & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-base font-black text-stone-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-orange-600" />
            <span>Katalog Bahan Baku</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Kelola satuan dasar, kemasan beli, dan harga acuan HPP resep produk
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Bahan</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama bahan, kemasan, atau catatan..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-stone-400 hover:text-stone-600"
          >
            Hapus
          </button>
        )}
      </div>

      {/* Content State: Skeleton, Error, Empty, atau Grid Card */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs animate-pulse space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-1/3" />
                </div>
              </div>
              <div className="space-y-1.5 pt-2 border-t border-stone-100">
                <div className="h-3 bg-stone-100 rounded w-full" />
                <div className="h-3 bg-stone-100 rounded w-2/3" />
              </div>
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
      ) : (
        /* Grid Card Bahan */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredBahan.map((bahan) => {
            const acuanKemasan = (bahan.kemasanList || []).find((k) => k.acuan) || bahan.kemasanList?.[0];

            return (
              <div
                key={bahan.id}
                className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-3"
              >
                {/* Header Card: Nama, Satuan Dasar & Actions */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 leading-snug">{bahan.nama}</h3>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-700 capitalize">
                        Satuan Dasar: {bahan.satuanDasar}
                      </span>
                      {bahan.sku && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-600 font-mono">
                          SKU: {bahan.sku}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(bahan)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                      title="Edit Bahan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={checkingDeleteId === bahan.id}
                      onClick={() => handleRequestDelete(bahan)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 active:text-rose-700 hover:bg-rose-50 active:bg-rose-100 transition disabled:opacity-50"
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

                {/* Box Biaya Acuan Satuan Dasar */}
                <div className="p-2.5 rounded-xl bg-orange-50/60 border border-orange-200/70 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-orange-950 block">
                      Harga Acuan Resep
                    </span>
                    <span className="text-[10px] text-orange-800/80">
                      {acuanKemasan ? `Dari ${acuanKemasan.nama}` : 'Belum diset'}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm font-black text-orange-700">
                    {formatBiayaSatuan(bahan.hargaPerSatuanDasar, bahan.satuanDasar)}
                  </div>
                </div>

                {/* Daftar Kemasan Pembelian Chips */}
                <div>
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">
                    Kemasan Pembelian ({bahan.kemasanList?.length || 0})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(bahan.kemasanList || []).map((k) => (
                      <span
                        key={k.id}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border ${
                          k.acuan
                            ? 'bg-amber-50 text-amber-900 border-amber-300 font-bold'
                            : 'bg-stone-50 text-stone-700 border-stone-200'
                        }`}
                      >
                        {k.acuan && <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />}
                        <span>{k.nama}</span>
                        <span className="text-stone-400">({k.isi ?? k.netto} {bahan.satuanDasar})</span>
                        {typeof k.hargaPerKemasan === 'number' && k.hargaPerKemasan > 0 && (
                          <span className="text-stone-900 font-bold ml-0.5">
                            {formatRupiah(k.hargaPerKemasan)}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Riwayat Harga */}
                <div className="pt-1.5 border-t border-stone-100">
                  <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <History className="w-3 h-3 text-stone-400" />
                    <span>Riwayat harga:</span>
                  </div>
                  {bahan.riwayatHarga && bahan.riwayatHarga.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {bahan.riwayatHarga.slice(0, 3).map((r, rIdx) => (
                        <span
                          key={rIdx}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-stone-100 text-stone-700 font-medium"
                        >
                          <span className="text-stone-400">{formatTanggalSlash(r.tanggal)}:</span>
                          <span className="font-bold text-stone-800">
                            {formatBiayaSatuan(r.hargaPerSatuanDasar, bahan.satuanDasar)}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[10px] text-stone-400 italic">belum ada riwayat</span>
                  )}
                </div>

                {/* Catatan jika ada */}
                {bahan.catatan && (
                  <p className="text-[11px] text-stone-500 italic line-clamp-2 pt-1 border-t border-stone-100">
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
