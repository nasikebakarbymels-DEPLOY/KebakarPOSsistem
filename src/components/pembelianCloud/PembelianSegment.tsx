import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  Calendar,
  Building2,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { PembelianBahan } from '../../types';
import {
  pembelianCloudService,
  PerubahanHargaAcuanItem,
} from '../../services/cloud/pembelianCloudService';
import { PembelianFormModal } from './PembelianFormModal';
import { PembelianDetailModal } from './PembelianDetailModal';
import { formatRupiah, formatTanggalIndo } from '../../utils/formatters';

interface PembelianSegmentProps {
  outletId: string;
  userId: string;
}

type FilterBulanType = 'semua' | 'bulan_ini' | 'bulan_lalu';

export const PembelianSegment: React.FC<PembelianSegmentProps> = ({ outletId, userId }) => {
  const [pembelianList, setPembelianList] = useState<PembelianBahan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBulan, setFilterBulan] = useState<FilterBulanType>('semua');

  // Modal & Dialog states
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingPembelian, setEditingPembelian] = useState<PembelianBahan | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<PembelianBahan | null>(null);
  const [deletingPembelian, setDeletingPembelian] = useState<PembelianBahan | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast Notification state
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
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Fetch Pembelian dari Firestore Cloud
  const fetchPembelian = useCallback(async () => {
    if (!outletId) return;
    try {
      setLoading(true);
      setLoadError(false);
      const data = await pembelianCloudService.getActivePembelian(outletId);
      setPembelianList(data);
    } catch (err) {
      console.error('[PembelianSegment] Gagal memuat daftar pembelian:', err);
      setLoadError(true);
      showToast('Gagal memuat catatan pembelian dari server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [outletId, showToast]);

  useEffect(() => {
    fetchPembelian();
  }, [fetchPembelian]);

  // Filter Segmented Bulan & Search
  const filteredPembelian = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Periode bulan lalu
    const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonth = lastMonthDate.getMonth();

    const q = searchQuery.trim().toLowerCase();

    return pembelianList.filter((item) => {
      // 1. Filter Bulan
      if (filterBulan !== 'semua' && item.tanggal) {
        const itemDate = new Date(item.tanggal);
        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth();

        if (filterBulan === 'bulan_ini') {
          if (itemYear !== currentYear || itemMonth !== currentMonth) {
            return false;
          }
        } else if (filterBulan === 'bulan_lalu') {
          if (itemYear !== lastMonthYear || itemMonth !== lastMonth) {
            return false;
          }
        }
      }

      // 2. Search Query (supplier, catatan, atau nama bahan/kemasan snapshot)
      if (q) {
        const matchSupplier = item.supplier?.toLowerCase().includes(q);
        const matchCatatan = item.catatan?.toLowerCase().includes(q);
        const matchItem = (item.items || []).some(
          (it) =>
            it.namaBahanSnapshot?.toLowerCase().includes(q) ||
            it.namaKemasanSnapshot?.toLowerCase().includes(q)
        );

        if (!matchSupplier && !matchCatatan && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [pembelianList, filterBulan, searchQuery]);

  // Handlers
  const handleOpenCreate = () => {
    setEditingPembelian(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: PembelianBahan) => {
    setEditingPembelian(p);
    setIsFormOpen(true);
  };

  const handleFormSuccess = (
    _id: string,
    hargaAcuanDiubah: PerubahanHargaAcuanItem[],
    gagalUpdate?: Array<{ bahanNama: string; alasan: string }>
  ) => {
    setIsFormOpen(false);

    if (editingPembelian) {
      showToast('Catatan pembelian berhasil diperbarui.');
    } else if (gagalUpdate && gagalUpdate.length > 0) {
      const daftarNama = gagalUpdate.map((g) => g.bahanNama).join(', ');
      showToast(
        `Pembelian tersimpan, tetapi harga acuan berikut gagal diperbarui: ${daftarNama}. Harga lama masih dipakai pada HPP.`,
        'error'
      );
    } else {
      if (hargaAcuanDiubah && hargaAcuanDiubah.length > 0) {
        const listStr = hargaAcuanDiubah.map((h) => h.bahanNama).join(', ');
        showToast(
          `Pembelian berhasil dicatat. Harga acuan bahan (${listStr}) otomatis diperbarui!`
        );
      } else {
        showToast('Pembelian berhasil dicatat.');
      }
    }

    fetchPembelian();
  };

  const handleConfirmDelete = async () => {
    if (!deletingPembelian) return;
    try {
      setIsDeleting(true);
      await pembelianCloudService.softDeletePembelian(
        outletId,
        deletingPembelian.id,
        userId
      );
      showToast('Catatan pembelian berhasil dihapus (harga acuan bahan tetap dipertahankan).');
      setDeletingPembelian(null);
      await fetchPembelian();
    } catch (err: unknown) {
      console.error('[PembelianSegment] Gagal menghapus pembelian:', err);
      const msg = err instanceof Error ? err.message : 'Gagal menghapus data pembelian.';
      showToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Hitung total pengeluaran dari hasil filter
  const totalPengeluaranFiltered = useMemo(() => {
    return filteredPembelian.reduce((sum, item) => sum + (Number(item.totalPembelian) || 0), 0);
  }, [filteredPembelian]);

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

      {/* Header Kontrol: Judul, Search, Filter Bulan & Tombol Tambah */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-orange-600" />
            <span>Pembelian Bahan Baku</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Pencatatan pengeluaran belanja bahan yang otomatis memperbarui harga acuan resep HPP
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Catat Pembelian</span>
        </button>
      </div>

      {/* Baris Filter: Search & Segmented Bulan */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari vendor supplier, item bahan, kemasan..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-stone-200 bg-white text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500 placeholder:text-stone-400 shadow-2xs"
          />
        </div>

        {/* Filter Bulan Segmented */}
        <div className="flex bg-stone-200/80 p-1 rounded-xl gap-1 shrink-0 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFilterBulan('semua')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterBulan === 'semua'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Semua
          </button>
          <button
            type="button"
            onClick={() => setFilterBulan('bulan_ini')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterBulan === 'bulan_ini'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Bulan Ini
          </button>
          <button
            type="button"
            onClick={() => setFilterBulan('bulan_lalu')}
            className={`px-3 py-1.5 rounded-lg transition ${
              filterBulan === 'bulan_lalu'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Bulan Lalu
          </button>
        </div>
      </div>

      {/* Info Ringkasan Belanja Terfilter */}
      {!loading && !loadError && filteredPembelian.length > 0 && (
        <div className="px-3.5 py-2.5 rounded-xl bg-orange-50/60 border border-orange-200/70 flex items-center justify-between text-xs text-orange-950">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-stone-600">Menampilkan:</span>
            <strong className="text-orange-900">
              {filteredPembelian.length} transaksi pembelian
            </strong>
          </div>
          <div className="font-bold">
            Total Belanja:{' '}
            <span className="font-black text-orange-700">
              {formatRupiah(totalPengeluaranFiltered)}
            </span>
          </div>
        </div>
      )}

      {/* Konten Utama */}
      {loading ? (
        /* Skeleton Loading State */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-pulse">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-stone-200 rounded-md w-1/3" />
                <div className="h-4 bg-stone-200 rounded-md w-1/4" />
              </div>
              <div className="h-6 bg-stone-100 rounded-lg w-1/2" />
              <div className="h-10 bg-stone-50 rounded-xl w-full" />
              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <div className="h-7 w-7 bg-stone-200 rounded-lg" />
                <div className="h-7 w-7 bg-stone-200 rounded-lg" />
                <div className="h-7 w-7 bg-stone-200 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        /* Error State Panel */
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-900">Gagal Mengambil Catatan Pembelian</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-4 leading-relaxed">
            Terjadi kendala saat memuat data pembelian bahan dari Firestore server. Silakan periksa
            koneksi internet Anda.
          </p>
          <button
            type="button"
            onClick={fetchPembelian}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : pembelianList.length === 0 ? (
        /* Empty State Utama */
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Belum ada catatan pembelian bahan</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5 leading-relaxed">
            Catat pengeluaran belanja bahan baku outlet Anda. Pembelian pada kemasan acuan akan
            otomatis memperbarui biaya satuan dasar untuk perhitungan HPP menu.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pembelian Pertama</span>
          </button>
        </div>
      ) : filteredPembelian.length === 0 ? (
        /* Empty Search/Filter State */
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mb-2">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800">Tidak ada pembelian yang sesuai</h3>
          <p className="text-xs text-stone-400 mt-0.5 mb-3">
            Tidak ditemukan catatan pembelian untuk filter atau kata kunci yang dipilih.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterBulan('semua');
            }}
            className="text-xs font-semibold text-orange-600 hover:underline"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        /* Grid Card Pembelian */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredPembelian.map((p) => {
            const hasAcuanItem = (p.items || []).some((it) => it.isAcuanKemasan);

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-3"
              >
                {/* Header Card: Tanggal & Supplier */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 text-stone-500 text-[11px] font-medium">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      <span>{formatTanggalIndo(p.tanggal)}</span>
                    </div>
                    <div className="font-bold text-stone-900 text-sm mt-0.5 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span className="truncate">{p.supplier}</span>
                    </div>
                  </div>

                  {hasAcuanItem && (
                    <span
                      title="Memperbarui harga acuan resep"
                      className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold flex items-center gap-1 shrink-0"
                    >
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Acuan HPP</span>
                    </span>
                  )}
                </div>

                {/* Box Ringkasan Item & Total Rupiah */}
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/70 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-500 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-stone-400" />
                      <span>Jumlah Item:</span>
                    </span>
                    <span className="font-bold text-stone-900">{p.items?.length || 0} item</span>
                  </div>

                  {/* List Ringkas Item */}
                  <div className="space-y-1 pt-1.5 border-t border-stone-200/60 max-h-24 overflow-y-auto pr-1">
                    {(p.items || []).map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] text-stone-600"
                      >
                        <span className="truncate pr-2">
                          {it.namaBahanSnapshot} ({it.namaKemasanSnapshot})
                        </span>
                        <span className="font-semibold text-stone-800 shrink-0">
                          {it.qty}x · {formatRupiah(it.hargaTotal)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total Pembelian */}
                  <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-700">Total Belanja:</span>
                    <span className="text-sm font-black text-orange-700">
                      {formatRupiah(p.totalPembelian)}
                    </span>
                  </div>
                </div>

                {/* Catatan jika ada */}
                {p.catatan && (
                  <p className="text-[11px] text-stone-500 italic truncate px-0.5">
                    "{p.catatan}"
                  </p>
                )}

                {/* Actions: Detail, Edit, Hapus */}
                <div className="flex items-center justify-end gap-1 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setSelectedDetail(p)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 font-bold text-[11px] transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Detail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(p)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
                    title="Edit Pembelian"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingPembelian(p)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Hapus Pembelian"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form Catat/Edit Pembelian */}
      {isFormOpen && (
        <PembelianFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSuccess={handleFormSuccess}
          outletId={outletId}
          userId={userId}
          editingPembelian={editingPembelian}
        />
      )}

      {/* Modal Detail Pembelian */}
      {selectedDetail && (
        <PembelianDetailModal
          isOpen={Boolean(selectedDetail)}
          onClose={() => setSelectedDetail(null)}
          pembelian={selectedDetail}
          outletId={outletId}
        />
      )}

      {/* Dialog Konfirmasi Hapus Pembelian */}
      {deletingPembelian && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 sm:p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-stone-900">Hapus Catatan Pembelian?</h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                Pembelian dari <strong>{deletingPembelian.supplier}</strong> tanggal{' '}
                <strong>{formatTanggalIndo(deletingPembelian.tanggal)}</strong> senilai{' '}
                <strong>{formatRupiah(deletingPembelian.totalPembelian)}</strong> akan dihapus dari
                laporan pengeluaran.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              <strong>Catatan:</strong> Penghapusan ini tidak memundurkan harga acuan bahan baku yang
              telah diperbarui sebelumnya.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPembelian(null)}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Hapus</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
