import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Utensils,
  Plus,
  Search,
  Sparkles,
  Layers,
  Loader2,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  Eye,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Produk, Resep, Bahan, KategoriProduk, JenisProduk, KalkulasiHPP, ItemResep } from '../types';
import { produkService, CreateProdukDTO, UpdateProdukDTO } from '../services/produkService';
import { resepService } from '../services/resepService';
import { bahanService } from '../services/bahanService';
import { ProdukCard } from '../components/produk/ProdukCard';
import { ProdukFormModal } from '../components/produk/ProdukFormModal';
import { ProdukDetailModal } from '../components/produk/ProdukDetailModal';
import { ConfirmDialog } from '../components/bahan/ConfirmDialog';

interface MenuProdukPageProps {
  onNavigateToBahanTab?: () => void;
}

export const MenuProdukPage: React.FC<MenuProdukPageProps> = ({ onNavigateToBahanTab }) => {
  const { user } = useAuth();
  const currentOutletId = user?.outletId || 'outlet-1';

  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [resepList, setResepList] = useState<Resep[]>([]);
  const [bahanList, setBahanList] = useState<Bahan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterKategori, setFilterKategori] = useState<string>('Semua');
  const [filterJenis, setFilterJenis] = useState<string>('semua');
  const [showInactive, setShowInactive] = useState<boolean>(false);

  // Modals & Actions
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingProduk, setEditingProduk] = useState<Produk | null>(null);
  const [editingResep, setEditingResep] = useState<Resep | null>(null);

  const [detailProduk, setDetailProduk] = useState<Produk | null>(null);
  const [produkToDelete, setProdukToDelete] = useState<Produk | null>(null);
  const [deleteUsageWarning, setDeleteUsageWarning] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Fetch all data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allProds, allRes, allBhn] = await Promise.all([
        produkService.getProdukByOutlet(currentOutletId),
        resepService.getResepByOutlet(currentOutletId),
        bahanService.getBahanByOutlet(currentOutletId),
      ]);
      setProdukList(allProds);
      setResepList(allRes);
      setBahanList(allBhn);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data produk & resep.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentOutletId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time HPP calculation map for all products
  const kalkulasiMap = useMemo(() => {
    const map = new Map<string, KalkulasiHPP>();
    for (const p of produkList) {
      const calc = resepService.hitungHPP(p.id, produkList, resepList, bahanList);
      map.set(p.id, calc);
    }
    return map;
  }, [produkList, resepList, bahanList]);

  // Filtered products
  const filteredProduk = useMemo(() => {
    return produkList.filter((p) => {
      // Inactive filter
      if (!showInactive && !p.aktif) return false;

      // Kategori filter
      if (filterKategori !== 'Semua' && p.kategori !== filterKategori) return false;

      // Jenis filter
      if (filterJenis !== 'semua' && p.jenis !== filterJenis) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchNama = p.nama.toLowerCase().includes(query);
        const matchSku = p.sku?.toLowerCase().includes(query) || false;
        if (!matchNama && !matchSku) return false;
      }

      return true;
    });
  }, [produkList, showInactive, filterKategori, filterJenis, searchQuery]);

  // Overall statistics
  const stats = useMemo(() => {
    const menuJual = produkList.filter((p) => p.jenis === 'menu_jual');
    const komponen = produkList.filter((p) => p.jenis === 'komponen');

    let totalMargin = 0;
    let countedMarginCount = 0;

    for (const m of menuJual) {
      const calc = kalkulasiMap.get(m.id);
      if (calc && !calc.isResepKosong && m.hargaJual > 0) {
        totalMargin += calc.marginPersen;
        countedMarginCount++;
      }
    }

    const avgMargin = countedMarginCount > 0 ? (totalMargin / countedMarginCount).toFixed(1) : '0';

    return {
      totalMenuJual: menuJual.length,
      totalKomponen: komponen.length,
      avgMargin,
    };
  }, [produkList, kalkulasiMap]);

  // Handle create or update product
  const handleSaveProduk = async (
    produkData: CreateProdukDTO | UpdateProdukDTO,
    itemsResep: ItemResep[]
  ) => {
    if (editingProduk) {
      await produkService.updateProduk(currentOutletId, editingProduk.id, produkData, itemsResep);
      showToast(`Produk "${produkData.nama}" berhasil diperbarui!`);
    } else {
      await produkService.createProduk(currentOutletId, produkData as CreateProdukDTO, itemsResep);
      showToast(`Produk "${produkData.nama}" berhasil ditambahkan!`);
    }
    await loadData();
    setIsFormOpen(false);
    setEditingProduk(null);
    setEditingResep(null);
  };

  // Toggle product status
  const handleToggleStatus = async (produkId: string) => {
    try {
      const updated = await produkService.toggleStatusProduk(currentOutletId, produkId);
      setProdukList((prev) => prev.map((p) => (p.id === produkId ? updated : p)));
      showToast(`Status "${updated.nama}" diubah menjadi ${updated.aktif ? 'Aktif' : 'Nonaktif'}.`);
    } catch (err: any) {
      showToast(err.message || 'Gagal mengubah status produk.', 'error');
    }
  };

  // Open edit modal
  const handleEditClick = (produk: Produk) => {
    const resep = resepList.find((r) => r.produkId === produk.id) || null;
    setEditingProduk(produk);
    setEditingResep(resep);
    setIsFormOpen(true);
  };

  // Delete product with usage check
  const handleDeleteClick = async (produk: Produk) => {
    // Check if used in other recipes
    const usage = await resepService.checkProductUsedInRecipes(currentOutletId, produk.id, produkList);
    if (usage.isUsed) {
      setDeleteUsageWarning(
        `Produk "${produk.nama}" tidak dapat dihapus karena sedang digunakan sebagai komponen dalam resep "${usage.usedByProdukNama}". Hapus atau ganti komponen tersebut terlebih dahulu.`
      );
      setProdukToDelete(produk);
    } else {
      setDeleteUsageWarning(null);
      setProdukToDelete(produk);
    }
  };

  const handleConfirmDelete = async () => {
    if (!produkToDelete || deleteUsageWarning) return;
    try {
      setIsDeleting(true);
      await produkService.deleteProduk(currentOutletId, produkToDelete.id);
      await loadData();
      showToast(`Produk "${produkToDelete.nama}" berhasil dihapus.`);
      setProdukToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus produk.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Seed example data
  const handleSeedExample = async () => {
    try {
      setIsSeeding(true);
      await produkService.seedExampleData(currentOutletId);
      await loadData();
      showToast('Data contoh (Espresso & Kopi Susu Gula Aren) berhasil dibuat!');
    } catch (err: any) {
      showToast(err.message || 'Gagal membuat data contoh.', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-5 space-y-5 pb-24">
      {/* Toast Feedback */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold transition-all animate-in fade-in slide-in-from-top-4 ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-stone-900 text-white border border-stone-700'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-200" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-600">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-stone-900">Katalog Produk & Resep</h1>
              <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/60">
                Fase 4 • HPP Multi-Level
              </span>
            </div>
          </div>
          <p className="text-xs text-stone-500 max-w-xl leading-relaxed mt-1">
            Kelola menu jual dan komponen setengah jadi. HPP dihitung secara live dari biaya acuan
            bahan terbaru secara rekursif (maksimal 3 level).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setEditingProduk(null);
              setEditingResep(null);
              setIsFormOpen(true);
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Produk</span>
          </button>
        </div>
      </div>

      {/* Top Metrics Cards */}
      {produkList.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200/80 shadow-xs">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-400 uppercase tracking-wider block">
              Menu Jual (POS)
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-stone-900 font-mono block mt-0.5">
              {stats.totalMenuJual}
            </span>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200/80 shadow-xs">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-400 uppercase tracking-wider block">
              Komponen (1/2 Jadi)
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-purple-700 font-mono block mt-0.5">
              {stats.totalKomponen}
            </span>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-stone-200/80 shadow-xs">
            <span className="text-[10px] sm:text-xs font-semibold text-stone-400 uppercase tracking-wider block">
              Rata-rata Margin
            </span>
            <span className="text-lg sm:text-xl font-extrabold text-emerald-600 font-mono block mt-0.5">
              {stats.avgMargin}%
            </span>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
        {/* Row 1: Search & Toggle Nonaktif */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama produk atau SKU barcode..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-stone-400 hover:text-stone-600 font-bold"
              >
                Reset
              </button>
            )}
          </div>

          {/* Toggle Nonaktif */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-stone-600 select-none shrink-0">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-stone-300"
            />
            <span>Tampilkan Menu Nonaktif</span>
          </label>
        </div>

        {/* Row 2: Filter Kategori & Filter Jenis */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100">
          {/* Kategori Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold">
            <span className="text-stone-400 text-[11px] mr-1">Kategori:</span>
            {['Semua', 'Makanan', 'Minuman', 'Snack', 'Paket', 'Lainnya'].map((kat) => (
              <button
                key={kat}
                type="button"
                onClick={() => setFilterKategori(kat)}
                className={`px-3 py-1.5 rounded-xl transition text-xs whitespace-nowrap ${
                  filterKategori === kat
                    ? 'bg-orange-600 text-white font-bold shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {kat}
              </button>
            ))}
          </div>

          {/* Jenis Segment */}
          <div className="flex bg-stone-100 p-0.5 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterJenis('semua')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterJenis === 'semua' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterJenis('menu_jual')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterJenis === 'menu_jual' ? 'bg-white text-blue-700 shadow-xs' : 'text-stone-500'
              }`}
            >
              Menu Jual
            </button>
            <button
              type="button"
              onClick={() => setFilterJenis('komponen')}
              className={`px-2.5 py-1 rounded-lg transition ${
                filterJenis === 'komponen' ? 'bg-white text-purple-700 shadow-xs' : 'text-stone-500'
              }`}
            >
              Komponen
            </button>
          </div>
        </div>
      </div>

      {/* Content State */}
      {isLoading ? (
        <div className="p-12 flex flex-col items-center justify-center text-stone-400 bg-white rounded-3xl border border-stone-200/80">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
          <span className="text-xs font-semibold">Memuat katalog produk & resep...</span>
        </div>
      ) : produkList.length === 0 ? (
        /* Empty State */
        <div className="p-8 sm:p-12 text-center bg-white rounded-3xl border border-dashed border-stone-300 space-y-4 shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-orange-50 flex items-center justify-center text-orange-500">
            <Utensils className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-stone-900">Belum Ada Menu Produk</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Daftarkan produk menu jual dan komponen setengah jadi beserta resepnya untuk
              memantau HPP dan margin secara otomatis.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSeedExample}
              disabled={isSeeding}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-orange-200 bg-orange-50/80 text-orange-700 font-bold text-xs hover:bg-orange-100 transition flex items-center justify-center gap-1.5"
            >
              {isSeeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-orange-500" />
              )}
              <span>Isi Data Contoh (Espresso & Kopi Susu)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingProduk(null);
                setEditingResep(null);
                setIsFormOpen(true);
              }}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Produk Baru</span>
            </button>
          </div>
        </div>
      ) : filteredProduk.length === 0 ? (
        /* Filter Empty */
        <div className="p-8 text-center bg-white rounded-3xl border border-stone-200 space-y-3">
          <p className="text-xs font-semibold text-stone-600">
            Tidak ada produk yang cocok dengan pencarian atau filter yang dipilih.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterKategori('Semua');
              setFilterJenis('semua');
              setShowInactive(false);
            }}
            className="px-3.5 py-1.5 bg-stone-100 text-stone-700 text-xs font-bold rounded-xl hover:bg-stone-200 transition"
          >
            Reset Filter
          </button>
        </div>
      ) : (
        /* Product Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredProduk.map((produk) => {
            const kalkulasi = kalkulasiMap.get(produk.id) || {
              hpp: 0,
              marginPersen: 0,
              estimasiProfit: 0,
              isResepKosong: true,
              adaBahanTanpaBiaya: false,
              bahanTanpaBiayaList: [],
              itemsDetail: [],
            };

            return (
              <ProdukCard
                key={produk.id}
                produk={produk}
                kalkulasi={kalkulasi}
                onToggleStatus={handleToggleStatus}
                onViewDetail={(p) => setDetailProduk(p)}
                onEdit={handleEditClick}
                onDelete={handleDeleteClick}
              />
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <ProdukFormModal
        isOpen={isFormOpen}
        produkToEdit={editingProduk}
        resepToEdit={editingResep}
        availableBahan={bahanList}
        allProduk={produkList}
        allResep={resepList}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProduk(null);
          setEditingResep(null);
        }}
        onSubmit={handleSaveProduk}
        onNavigateToBahanTab={onNavigateToBahanTab}
      />

      {/* Detail Modal */}
      <ProdukDetailModal
        isOpen={detailProduk !== null}
        produk={detailProduk}
        kalkulasi={detailProduk ? kalkulasiMap.get(detailProduk.id) || null : null}
        onClose={() => setDetailProduk(null)}
        onEdit={(p) => {
          setDetailProduk(null);
          handleEditClick(p);
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={produkToDelete !== null}
        title={deleteUsageWarning ? 'Penghapusan Ditolak' : 'Hapus Produk?'}
        message={
          deleteUsageWarning
            ? deleteUsageWarning
            : `Produk "${produkToDelete?.nama}" beserta resepnya akan dihapus permanen. Aksi ini tidak dapat dibatalkan.`
        }
        confirmLabel={deleteUsageWarning ? 'Mengerti' : 'Ya, Hapus'}
        cancelLabel={deleteUsageWarning ? 'Tutup' : 'Batal'}
        isDangerous={!deleteUsageWarning}
        isLoading={isDeleting}
        onConfirm={() => {
          if (deleteUsageWarning) {
            setProdukToDelete(null);
            setDeleteUsageWarning(null);
          } else {
            handleConfirmDelete();
          }
        }}
        onCancel={() => {
          setProdukToDelete(null);
          setDeleteUsageWarning(null);
        }}
      />
    </div>
  );
};
