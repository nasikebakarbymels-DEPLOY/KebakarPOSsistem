import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  Loader2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { Produk, Bahan } from '../../types';
import { produkCloudService } from '../../services/cloud/produkCloudService';
import { bahanCloudService } from '../../services/cloud/bahanCloudService';
import { hppCloudService, KalkulasiHPP, HppCalculationCache } from '../../services/cloud/hppCloudService';
import { ProdukFormModal } from './ProdukFormModal';
import { ProdukDetailModal } from './ProdukDetailModal';
import { formatRupiah } from '../../utils/formatters';

interface MenuSegmentProps {
  outletId: string;
  userId: string;
}

type FilterStatus = 'semua' | 'aktif' | 'nonaktif';
type FilterJenis = 'semua' | 'menu_jual' | 'komponen';

export const MenuSegment: React.FC<MenuSegmentProps> = ({ outletId, userId }) => {
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [bahanList, setBahanList] = useState<Bahan[]>([]);
  const [hppMap, setHppMap] = useState<Map<string, KalkulasiHPP>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('semua');
  const [jenisFilter, setJenisFilter] = useState<FilterJenis>('semua');
  const [selectedKategori, setSelectedKategori] = useState<string>('semua');

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduk, setEditingProduk] = useState<Produk | null>(null);
  const [detailProduk, setDetailProduk] = useState<Produk | null>(null);
  const [deletingProduk, setDeletingProduk] = useState<Produk | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [checkingDeleteId, setCheckingDeleteId] = useState<string | null>(null);

  // Toast State
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

  // Fetch Master Data Produk & Bahan
  const fetchData = useCallback(async () => {
    if (!outletId) return;
    try {
      setLoading(true);
      const [prods, bahans] = await Promise.all([
        produkCloudService.getActiveProduk(outletId, true),
        bahanCloudService.getActiveBahan(outletId),
      ]);

      setProdukList(prods);
      setBahanList(bahans);
      setLoadError(false);

      // Hitung HPP untuk seluruh produk menggunakan in-memory cache
      const cache: HppCalculationCache = {
        bahanMap: new Map(bahans.map((b) => [b.id, b])),
        produkMap: new Map(prods.map((p) => [p.id, p])),
      };

      const calculatedMap = new Map<string, KalkulasiHPP>();
      for (const p of prods) {
        try {
          const calc = await hppCloudService.hitungHppProduk(outletId, p.id, cache);
          calculatedMap.set(p.id, calc);
        } catch (err) {
          console.error(`[MenuSegment] Gagal kalkulasi HPP ${p.id}:`, err);
        }
      }
      setHppMap(calculatedMap);
    } catch (err) {
      console.error('[MenuSegment] Gagal memuat produk:', err);
      setLoadError(true);
      showToast('Gagal memuat data menu produk dari server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [outletId, showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Daftar kategori unik untuk filter
  const kategoriOptions = useMemo(() => {
    const set = new Set<string>();
    produkList.forEach((p) => {
      if (p.kategori) set.add(p.kategori);
    });
    return Array.from(set).sort();
  }, [produkList]);

  // Filtered Produk
  const filteredProduk = useMemo(() => {
    return produkList.filter((p) => {
      // Filter Status
      if (statusFilter === 'aktif' && !p.aktif) return false;
      if (statusFilter === 'nonaktif' && p.aktif) return false;

      // Filter Jenis
      const effectiveJenis = p.jenis === 'komponen' ? 'komponen' : 'menu_jual';
      if (jenisFilter === 'menu_jual' && effectiveJenis !== 'menu_jual') return false;
      if (jenisFilter === 'komponen' && effectiveJenis !== 'komponen') return false;

      // Filter Kategori
      if (selectedKategori !== 'semua' && (p.kategori || 'Umum') !== selectedKategori) {
        return false;
      }

      // Filter Search
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const matchNama = p.nama.toLowerCase().includes(q);
      const matchKategori = (p.kategori || '').toLowerCase().includes(q);
      const matchSku = (p.sku || '').toLowerCase().includes(q);

      return matchNama || matchKategori || matchSku;
    });
  }, [produkList, statusFilter, jenisFilter, selectedKategori, searchQuery]);

  // Handlers
  const handleOpenCreate = () => {
    setEditingProduk(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (p: Produk) => {
    setEditingProduk(p);
    setIsFormOpen(true);
  };

  const handleFormSuccess = (saved: Produk) => {
    setIsFormOpen(false);
    showToast(
      editingProduk
        ? `Menu "${saved.nama}" berhasil diperbarui.${saved.sku ? ` (SKU: ${saved.sku})` : ''}`
        : `Menu baru "${saved.nama}" berhasil ditambahkan.${saved.sku ? ` (SKU: ${saved.sku})` : ''}`
    );
    fetchData();
  };

  // Guard penghapusan produk sebelum dialog konfirmasi dibuka
  const handleRequestDelete = async (produk: Produk) => {
    try {
      setCheckingDeleteId(produk.id);
      const count = await produkCloudService.checkProdukUsedAsSubResep(outletId, produk.id);
      if (count > 0) {
        showToast(
          `Produk '${produk.nama}' masih dipakai sebagai sub-resep di ${count} produk aktif. Ganti resep terlebih dahulu.`,
          'error'
        );
        return;
      }
      setDeletingProduk(produk);
    } catch (err: unknown) {
      console.error('[MenuSegment] Gagal memeriksa ketergantungan sub-resep produk:', err);
      showToast('Gagal memeriksa pemakaian sub-resep produk.', 'error');
    } finally {
      setCheckingDeleteId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduk) return;
    try {
      setIsDeleting(true);
      await produkCloudService.softDeleteProduk(outletId, deletingProduk.id, userId);
      showToast(`Menu "${deletingProduk.nama}" berhasil dihapus.`);
      setDeletingProduk(null);
      await fetchData();
    } catch (err: unknown) {
      console.error('[MenuSegment] Gagal menghapus produk:', err);
      const msg = err instanceof Error ? err.message : 'Gagal menghapus produk menu.';
      showToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const getMarginBadgeClass = (m: number) => {
    if (m >= 40) return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    if (m >= 20) return 'bg-amber-50 text-amber-700 border-amber-300';
    return 'bg-rose-50 text-rose-700 border-rose-300';
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
            <UtensilsCrossed className="w-5 h-5 text-orange-600" />
            <span>Katalog Menu & Produk</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Kelola harga jual, resep bertingkat, HPP, margin, dan status menu aktif outlet
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Menu</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari menu, kategori, atau SKU..."
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

        {/* Filter Segmented Status */}
        <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200/80 shrink-0">
          {(['semua', 'aktif', 'nonaktif'] as FilterStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition capitalize ${
                statusFilter === st
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Filter Segmented Jenis */}
        <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200/80 shrink-0">
          {(
            [
              { id: 'semua', label: 'Semua' },
              { id: 'menu_jual', label: 'Menu Jual' },
              { id: 'komponen', label: 'Komponen' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setJenisFilter(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                jenisFilter === item.id
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Filter Kategori Chips / Select jika banyak */}
        {kategoriOptions.length > 0 && (
          <select
            value={selectedKategori}
            onChange={(e) => setSelectedKategori(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs font-semibold border border-stone-200 bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-orange-500/30 shrink-0"
          >
            <option value="semua">Semua Kategori</option>
            {kategoriOptions.map((kat) => (
              <option key={kat} value={kat}>
                {kat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Content State: Skeleton, Error, Empty, atau Grid Card */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs animate-pulse space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-stone-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-stone-100">
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
          <h3 className="text-sm font-bold text-stone-900">Gagal memuat data menu</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-4">
            Terjadi kendala saat mengambil data menu produk dari server cloud. Silakan periksa koneksi internet Anda.
          </p>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : produkList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
            <UtensilsCrossed className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Belum ada menu produk</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5">
            Daftarkan menu makanan, minuman, snack, atau paket outlet Anda untuk mulai bertransaksi di POS kasir dan menghitung HPP otomatis.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Menu Pertama</span>
          </button>
        </div>
      ) : filteredProduk.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mb-2">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800">Tidak ada menu yang cocok</h3>
          <p className="text-xs text-stone-400 mt-0.5 mb-3">
            Tidak ditemukan menu produk sesuai kriteria pencarian dan filter aktif.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('semua');
              setJenisFilter('semua');
              setSelectedKategori('semua');
            }}
            className="text-xs font-semibold text-orange-600 hover:underline"
          >
            Reset semua filter
          </button>
        </div>
      ) : (
        /* Grid Card Menu */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredProduk.map((p) => {
            const calc = hppMap.get(p.id);
            const totalHpp = calc ? calc.hpp : 0;
            const margin = calc ? calc.marginPersen : 0;
            const isResepKosong = (p.resepItems || []).length === 0;
            const hasWarning = isResepKosong || Boolean(calc?.adaBahanTanpaBiaya);

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-between space-y-3"
              >
                {/* Header Card: Nama, Status, Kategori */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-stone-900 leading-snug">{p.nama}</h3>
                      {p.jenis === 'komponen' && (
                        <span className="inline-flex px-2 py-0.2 rounded-md text-[10px] font-bold border bg-amber-50 text-amber-800 border-amber-300">
                          Komponen
                        </span>
                      )}
                      <span
                        className={`inline-flex px-2 py-0.2 rounded-md text-[10px] font-bold border ${
                          p.aktif
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-stone-100 text-stone-600 border-stone-200'
                        }`}
                      >
                        {p.aktif ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                      <span className="bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded font-medium">
                        {p.kategori || 'Umum'}
                      </span>
                      {p.sku && <span> • SKU: {p.sku}</span>}
                    </div>
                  </div>

                  {/* Actions Dropdown / Icon Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDetailProduk(p)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                      title="Lihat Rincian Resep & HPP"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                      title="Edit Menu"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={checkingDeleteId === p.id}
                      onClick={() => handleRequestDelete(p)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                      title="Hapus Menu"
                    >
                      {checkingDeleteId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-500" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Info Finansial: Komponen vs Menu Jual */}
                {p.jenis === 'komponen' ? (
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1.5">
                    {/* Baris info: Output: X satuan • Biaya: RpY per satuan */}
                    {(() => {
                      const outJml =
                        p.hasilProduksi && p.hasilProduksi.jumlah > 0
                          ? p.hasilProduksi.jumlah
                          : 1;
                      const outSat = p.hasilProduksi?.satuan || 'porsi';
                      const biayaUnit = totalHpp / outJml;
                      const formattedBiaya = Number.isInteger(biayaUnit)
                        ? formatRupiah(biayaUnit)
                        : `Rp${biayaUnit.toLocaleString('id-ID', {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 2,
                          })}`;

                      return (
                        <div className="text-xs text-stone-700">
                          <span className="font-semibold text-stone-800">
                            Output: {outJml} {outSat}
                          </span>
                          <span className="text-stone-400 mx-1.5">•</span>
                          <span className="font-bold text-emerald-700">
                            Biaya: {formattedBiaya} per {outSat}
                          </span>
                        </div>
                      );
                    })()}

                    {/* HPP per batch: RpZ */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-amber-200/60">
                      <span className="text-[11px] text-stone-500 font-medium">HPP per batch:</span>
                      <span className="text-xs font-black text-stone-900">
                        {formatRupiah(totalHpp)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-stone-500 font-medium">Harga Jual:</span>
                      <span className="text-sm font-black text-stone-900">
                        {formatRupiah(p.hargaJual)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-stone-200/60">
                      <div>
                        <span className="text-[10px] text-stone-500 block">Total HPP</span>
                        <span className="text-xs font-black text-stone-800">
                          {formatRupiah(totalHpp)}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-stone-500 block">Margin</span>
                        <span
                          className={`inline-flex px-1.5 py-0.2 rounded-md text-[11px] font-black border ${getMarginBadgeClass(
                            margin
                          )}`}
                        >
                          {margin}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning Resep Kosong / Bahan Tanpa Biaya */}
                {hasWarning && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>
                      {isResepKosong
                        ? 'Resep belum dibuat'
                        : 'Ada bahan belum memiliki biaya acuan'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form Tambah / Edit Produk */}
      <ProdukFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleFormSuccess}
        produkToEdit={editingProduk}
        outletId={outletId}
        userId={userId}
        allBahan={bahanList}
        allProduk={produkList}
      />

      {/* Modal Detail Resep & HPP */}
      <ProdukDetailModal
        isOpen={Boolean(detailProduk)}
        onClose={() => setDetailProduk(null)}
        produk={detailProduk}
        outletId={outletId}
        allBahan={bahanList}
        allProduk={produkList}
        onOpenEdit={handleOpenEdit}
      />

      {/* Dialog Konfirmasi Hapus Produk */}
      {deletingProduk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-stone-900">Hapus Menu Produk?</h3>
                <p className="text-xs text-stone-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus menu produk <strong>"{deletingProduk.nama}"</strong>?
              Sistem akan menolak penghapusan apabila produk ini masih aktif digunakan sebagai sub-resep di produk lain.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingProduk(null)}
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
                <span>Hapus Menu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
