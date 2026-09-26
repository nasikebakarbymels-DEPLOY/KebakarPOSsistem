import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Calendar,
  Sparkles,
  Loader2,
  Trash2,
  Eye,
  ArrowUpDown,
  Tag,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PembelianBahan, Bahan } from '../types';
import { pembelianService, CreatePembelianDTO } from '../services/pembelianService';
import { bahanService } from '../services/bahanService';
import { formatRupiah, formatBiayaSatuan, formatTanggalIndo } from '../utils/formatters';
import { PembelianModal } from '../components/pembelian/PembelianModal';
import { PembelianDetailModal } from '../components/pembelian/PembelianDetailModal';
import { ConfirmDialog } from '../components/bahan/ConfirmDialog';

interface PembelianBahanPageProps {
  onNavigateToBahanTab?: () => void;
}

type PeriodeFilter = 'semua' | 'hari-ini' | '7-hari' | '30-hari';

export const PembelianBahanPage: React.FC<PembelianBahanPageProps> = ({
  onNavigateToBahanTab,
}) => {
  const { user } = useAuth();
  const currentOutletId = user?.outletId || 'outlet-1';

  const [pembelianList, setPembelianList] = useState<PembelianBahan[]>([]);
  const [availableBahan, setAvailableBahan] = useState<Bahan[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filters
  const [filterPeriode, setFilterPeriode] = useState<PeriodeFilter>('semua');
  const [filterBahanId, setFilterBahanId] = useState<string>('semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedDetail, setSelectedDetail] = useState<PembelianBahan | null>(null);
  const [pembelianToDelete, setPembelianToDelete] = useState<PembelianBahan | null>(null);
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

  // Fetch data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allPembelian, allBahan] = await Promise.all([
        pembelianService.getPembelianByOutlet(currentOutletId),
        bahanService.getBahanByOutlet(currentOutletId),
      ]);
      setPembelianList(allPembelian);
      setAvailableBahan(allBahan);
    } catch (err: any) {
      showToast(err.message || 'Gagal memuat data pembelian.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [currentOutletId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle create
  const handleCreatePembelian = async (dto: CreatePembelianDTO) => {
    await pembelianService.createPembelian(currentOutletId, dto);
    await loadData();
    showToast('Transaksi pembelian bahan berhasil dicatat & biaya HPP diperbarui!');
  };

  // Handle delete
  const handleDeleteConfirm = async () => {
    if (!pembelianToDelete) return;
    try {
      setIsDeleting(true);
      await pembelianService.deletePembelian(currentOutletId, pembelianToDelete.id);
      await loadData();
      showToast('Data pembelian dihapus. Biaya HPP bahan telah dihitung ulang.');
      setPembelianToDelete(null);
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus pembelian.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle seed example
  const handleSeedExample = async () => {
    try {
      setIsSeeding(true);
      await pembelianService.seedExamplePembelian(currentOutletId);
      await loadData();
      showToast('Data contoh pembelian bahan (Kecap Manis) berhasil ditambahkan!');
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan data contoh.', 'error');
    } finally {
      setIsSeeding(false);
    }
  };

  // Filtered List
  const filteredList = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const d7 = new Date();
    d7.setDate(now.getDate() - 7);
    const d7Str = d7.toISOString().split('T')[0];

    const d30 = new Date();
    d30.setDate(now.getDate() - 30);
    const d30Str = d30.toISOString().split('T')[0];

    return pembelianList.filter((item) => {
      // Periode filter
      if (filterPeriode === 'hari-ini' && item.tanggal !== todayStr) return false;
      if (filterPeriode === '7-hari' && item.tanggal < d7Str) return false;
      if (filterPeriode === '30-hari' && item.tanggal < d30Str) return false;

      // Bahan filter
      if (filterBahanId !== 'semua' && item.bahanId !== filterBahanId) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchBahan = (item.bahanNama || '').toLowerCase().includes(query);
        const matchKemasan = (item.kemasanNama || '').toLowerCase().includes(query);
        const matchSupplier = item.supplierCatatan?.toLowerCase().includes(query) || (item.supplier || '').toLowerCase().includes(query);
        if (!matchBahan && !matchKemasan && !matchSupplier) return false;
      }

      return true;
    });
  }, [pembelianList, filterPeriode, filterBahanId, searchQuery]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-5 space-y-5 pb-24">
      {/* Toast Notification */}
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
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-stone-900">Pembelian Bahan & HPP</h1>
              <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/60">
                Fase 3 • Sumber Biaya HPP
              </span>
            </div>
          </div>
          <p className="text-xs text-stone-500 max-w-xl leading-relaxed mt-1">
            Catat setiap pembelian bahan untuk memperbarui harga satuan dasar bahan secara otomatis.
            Tanpa sistem stok & inventory.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Catat Pembelian</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-3">
        {/* Top filter row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Periode Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold">
            <span className="text-stone-400 text-[11px] mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Periode:
            </span>
            {(
              [
                { key: 'semua', label: 'Semua' },
                { key: 'hari-ini', label: 'Hari Ini' },
                { key: '7-hari', label: '7 Hari' },
                { key: '30-hari', label: '30 Hari' },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setFilterPeriode(p.key)}
                className={`px-3 py-1.5 rounded-xl transition text-xs whitespace-nowrap ${
                  filterPeriode === p.key
                    ? 'bg-orange-600 text-white font-bold shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Bahan Selector Dropdown */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-stone-400 text-[11px] shrink-0">Bahan:</span>
            <select
              value={filterBahanId}
              onChange={(e) => setFilterBahanId(e.target.value)}
              className="w-full sm:w-48 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs"
            >
              <option value="semua">Semua Bahan ({availableBahan.length})</option>
              {availableBahan.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari transaksi berdasarkan bahan, kemasan, atau catatan/supplier..."
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
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="p-12 flex flex-col items-center justify-center text-stone-400 bg-white rounded-3xl border border-stone-200/80">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mb-2" />
          <span className="text-xs font-semibold">Memuat riwayat pembelian...</span>
        </div>
      ) : pembelianList.length === 0 ? (
        /* Empty State: Belum ada transaksi sama sekali */
        <div className="p-8 sm:p-12 text-center bg-white rounded-3xl border border-dashed border-stone-300 space-y-4 shadow-xs">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-orange-50 flex items-center justify-center text-orange-500">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-stone-900">Belum Ada Catatan Pembelian</h3>
            <p className="text-xs text-stone-500 leading-relaxed">
              Catat pembelian bahan untuk memperbarui harga satuan dasar (HPP) secara otomatis.
              Sistem tidak mengelola jumlah stok fisik.
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
              <span>Isi Data Contoh (Kecap Manis)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Pembelian Baru</span>
            </button>
          </div>
        </div>
      ) : filteredList.length === 0 ? (
        /* Empty Filter State */
        <div className="p-8 text-center bg-white rounded-3xl border border-stone-200 space-y-3">
          <p className="text-xs font-semibold text-stone-600">
            Tidak ada transaksi pembelian yang cocok dengan filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterPeriode('semua');
              setFilterBahanId('semua');
              setSearchQuery('');
            }}
            className="px-3.5 py-1.5 bg-stone-100 text-stone-700 text-xs font-bold rounded-xl hover:bg-stone-200 transition"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        /* List Riwayat Pembelian */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-stone-500 px-1">
            <span className="font-semibold">
              Menampilkan {filteredList.length} transaksi pembelian
            </span>
            <span className="text-[11px] text-stone-400">Terurut tanggal terbaru</span>
          </div>

          <div className="space-y-2.5">
            {filteredList.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs hover:border-orange-200 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Left info */}
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-stone-900 truncate">
                      {item.bahanNama}
                    </span>
                    <span className="text-[10px] bg-stone-100 text-stone-600 font-semibold px-2 py-0.5 rounded-md">
                      {item.satuanDasar}
                    </span>
                    <span className="text-[11px] text-stone-400">
                      • {formatTanggalIndo(item.tanggal)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-stone-600 flex-wrap">
                    <span className="font-medium bg-orange-50 text-orange-800 px-2 py-0.5 rounded-md border border-orange-200/60">
                      {item.kemasanNama} x {item.qty}
                    </span>
                    <span className="text-stone-400">→</span>
                    <span className="text-stone-500 text-[11px]">
                      Netto: {(item.totalNetto ?? 0).toLocaleString('id-ID')} {item.satuanDasar}
                    </span>
                    {item.supplierCatatan && (
                      <span className="text-stone-400 text-[11px] truncate max-w-xs">
                        ({item.supplierCatatan})
                      </span>
                    )}
                  </div>
                </div>

                {/* Right totals & action */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-extrabold text-stone-900">
                      {formatRupiah(item.totalHarga)}
                    </div>
                    <div className="text-[11px] font-bold text-orange-600 font-mono">
                      {formatBiayaSatuan(item.biayaPerSatuanDasar, item.satuanDasar)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(item)}
                      className="p-2 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
                      title="Lihat Rincian Pembelian"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPembelianToDelete(item)}
                      className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Hapus Pembelian"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      <PembelianModal
        isOpen={isAddModalOpen}
        availableBahan={availableBahan}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreatePembelian}
        onNavigateToBahanTab={onNavigateToBahanTab}
      />

      {/* Detail Modal */}
      <PembelianDetailModal
        isOpen={selectedDetail !== null}
        pembelian={selectedDetail}
        onClose={() => setSelectedDetail(null)}
        onDeleteRequest={(pembelian) => setPembelianToDelete(pembelian)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pembelianToDelete !== null}
        title="Hapus Catatan Pembelian?"
        message={`Transaksi pembelian untuk "${pembelianToDelete?.bahanNama}" senilai ${formatRupiah(
          pembelianToDelete?.totalHarga
        )} akan dihapus. Biaya bahan akan dihitung ulang dari pembelian sebelumnya, atau kembali ke biaya awal jika tidak ada pembelian tersisa.`}
        confirmLabel="Ya, Hapus & Hitung Ulang"
        cancelLabel="Batal"
        isDangerous={true}
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setPembelianToDelete(null)}
      />
    </div>
  );
};
