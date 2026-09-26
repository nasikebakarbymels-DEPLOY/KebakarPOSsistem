import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Layers,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Database,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Bahan, SatuanDasar } from '../types';
import { bahanService } from '../services/bahanService';
import { BahanCard } from '../components/bahan/BahanCard';
import { BahanModal } from '../components/bahan/BahanModal';
import { KemasanManagerModal } from '../components/bahan/KemasanManagerModal';
import { ConfirmDialog } from '../components/bahan/ConfirmDialog';

export const BahanKemasanPage: React.FC = () => {
  const { user } = useAuth();
  const currentOutletId = user?.outletId || 'outlet-1';

  const [bahanList, setBahanList] = useState<Bahan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSatuanFilter, setSelectedSatuanFilter] = useState<'all' | SatuanDasar>('all');

  // Modals state
  const [isBahanModalOpen, setIsBahanModalOpen] = useState(false);
  const [editingBahan, setEditingBahan] = useState<Bahan | null>(null);

  const [managingKemasanBahan, setManagingKemasanBahan] = useState<Bahan | null>(null);

  const [deletingBahan, setDeletingBahan] = useState<Bahan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Load bahan data from service
  const loadBahanData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await bahanService.getBahanByOutlet(currentOutletId);
      setBahanList(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data bahan.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBahanData();
  }, [currentOutletId]);

  // Temporary feedback timeout
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Filtered bahan
  const filteredBahan = useMemo(() => {
    return bahanList.filter((b) => {
      const matchQuery = b.nama.toLowerCase().includes(searchQuery.trim().toLowerCase());
      const matchSatuan =
        selectedSatuanFilter === 'all' ? true : b.satuanDasar === selectedSatuanFilter;
      return matchQuery && matchSatuan;
    });
  }, [bahanList, searchQuery, selectedSatuanFilter]);

  // Handle Seed Example Data
  const handleSeedExample = async () => {
    setIsSeeding(true);
    try {
      const updated = await bahanService.seedExampleData(currentOutletId);
      setBahanList(updated);
      setFeedback({
        type: 'success',
        message: 'Berhasil memuat 3 bahan contoh (Kecap Manis, Ayam, Cup Minuman).',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Gagal memuat data contoh.',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  // Handle Create or Edit Bahan
  const handleSaveBahan = async (data: {
    nama: string;
    satuanDasar: SatuanDasar;
    biayaTerbaru?: number;
    catatan?: string;
  }) => {
    try {
      if (editingBahan) {
        const updated = await bahanService.updateBahan(currentOutletId, editingBahan.id, data);
        setBahanList((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
        setFeedback({
          type: 'success',
          message: `Bahan "${updated.nama}" berhasil diperbarui.`,
        });
      } else {
        const created = await bahanService.createBahan(currentOutletId, data);
        setBahanList((prev) => [created, ...prev]);
        setFeedback({
          type: 'success',
          message: `Bahan baru "${created.nama}" berhasil ditambahkan.`,
        });
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal menyimpan data bahan.' };
    }
  };

  // Handle Delete Bahan
  const handleConfirmDeleteBahan = async () => {
    if (!deletingBahan) return;
    setIsDeleting(true);
    try {
      await bahanService.deleteBahan(currentOutletId, deletingBahan.id);
      setBahanList((prev) => prev.filter((b) => b.id !== deletingBahan.id));
      setFeedback({
        type: 'success',
        message: `Bahan "${deletingBahan.nama}" berhasil dihapus.`,
      });
      setDeletingBahan(null);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Gagal menghapus bahan.',
      });
      setDeletingBahan(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Kemasan Operations
  const handleAddKemasan = async (
    bahanId: string,
    data: { nama: string; netto: number }
  ) => {
    try {
      const newKemasan = await bahanService.addKemasan(currentOutletId, bahanId, data);
      setBahanList((prev) =>
        prev.map((b) => {
          if (b.id === bahanId) {
            const updated = {
              ...b,
              kemasanList: [...(b.kemasanList || []), newKemasan],
            };
            if (managingKemasanBahan?.id === bahanId) {
              setManagingKemasanBahan(updated);
            }
            return updated;
          }
          return b;
        })
      );
      setFeedback({
        type: 'success',
        message: `Kemasan "${data.nama}" berhasil ditambahkan.`,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal menambahkan kemasan.' };
    }
  };

  const handleUpdateKemasan = async (
    bahanId: string,
    kemasanId: string,
    data: { nama: string; netto: number }
  ) => {
    try {
      const updatedKemasan = await bahanService.updateKemasan(
        currentOutletId,
        bahanId,
        kemasanId,
        data
      );
      setBahanList((prev) =>
        prev.map((b) => {
          if (b.id === bahanId) {
            const updatedList = (b.kemasanList || []).map((k) =>
              k.id === kemasanId ? updatedKemasan : k
            );
            const updatedBahan = { ...b, kemasanList: updatedList };
            if (managingKemasanBahan?.id === bahanId) {
              setManagingKemasanBahan(updatedBahan);
            }
            return updatedBahan;
          }
          return b;
        })
      );
      setFeedback({
        type: 'success',
        message: `Kemasan "${data.nama}" berhasil diperbarui.`,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal memperbarui kemasan.' };
    }
  };

  const handleDeleteKemasan = async (bahanId: string, kemasanId: string) => {
    try {
      await bahanService.deleteKemasan(currentOutletId, bahanId, kemasanId);
      setBahanList((prev) =>
        prev.map((b) => {
          if (b.id === bahanId) {
            const updatedList = (b.kemasanList || []).filter((k) => k.id !== kemasanId);
            const updatedBahan = { ...b, kemasanList: updatedList };
            if (managingKemasanBahan?.id === bahanId) {
              setManagingKemasanBahan(updatedBahan);
            }
            return updatedBahan;
          }
          return b;
        })
      );
      setFeedback({
        type: 'success',
        message: 'Kemasan berhasil dihapus.',
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal menghapus kemasan.' };
    }
  };

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-semibold shadow-md animate-in slide-in-from-top duration-200 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="flex-1">{feedback.message}</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div>
          <h2 className="text-lg font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange-600" />
            Master Bahan & Kemasan
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Kelola satuan dasar (gram, ml, pcs) & kemasan beli untuk dasar HPP resep
          </p>
        </div>

        <div className="flex items-center gap-2">
          {bahanList.length === 0 && (
            <button
              onClick={handleSeedExample}
              disabled={isSeeding || isLoading}
              className="py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSeeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>Isi Data Contoh</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingBahan(null);
              setIsBahanModalOpen(true);
            }}
            className="flex-1 sm:flex-none py-2 px-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Bahan</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar (shown if items exist or searching) */}
      {(bahanList.length > 0 || searchQuery) && (
        <div className="space-y-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama bahan (contoh: Ayam, Kecap, Cup)..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-2xl border border-stone-200 bg-white text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 shadow-2xs transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-stone-400 hover:text-stone-700"
              >
                Hapus
              </button>
            )}
          </div>

          {/* Filter Satuan dasar pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-semibold text-stone-400 mr-1 flex items-center gap-1 shrink-0">
              <SlidersHorizontal className="w-3 h-3" /> Satuan:
            </span>
            {(['all', 'gram', 'ml', 'pcs'] as const).map((satuan) => {
              const isSelected = selectedSatuanFilter === satuan;
              return (
                <button
                  key={satuan}
                  onClick={() => setSelectedSatuanFilter(satuan)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all shrink-0 ${
                    isSelected
                      ? 'bg-orange-600 text-white shadow-2xs'
                      : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {satuan === 'all' ? 'Semua' : satuan}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content Area: Loading, Error, Empty, or List */}
      {isLoading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-stone-200 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-orange-600 animate-spin mb-3" />
          <p className="text-sm font-bold text-stone-800">Memuat Master Bahan...</p>
          <p className="text-xs text-stone-400 mt-1">Mengambil data outlet {currentOutletId}</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-rose-50 rounded-3xl border border-rose-200">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-rose-900">Gagal Memuat Data</h3>
          <p className="text-xs text-rose-700 mt-1 mb-4">{error}</p>
          <button
            onClick={loadBahanData}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </button>
        </div>
      ) : bahanList.length === 0 ? (
        /* Empty State */
        <div className="p-8 sm:p-12 text-center bg-white rounded-3xl border-2 border-dashed border-stone-200 flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-4 shadow-inner">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Belum Ada Bahan</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1.5 leading-relaxed">
            Daftarkan bahan baku dapur dengan satuan dasarnya (gram, ml, pcs) dan kemasan pembeliannya. Modul ini bukan inventory, melainkan acuan HPP menu produk.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2 mt-6 w-full max-w-xs">
            <button
              onClick={() => {
                setEditingBahan(null);
                setIsBahanModalOpen(true);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-orange-600 text-white text-xs font-bold shadow-sm hover:bg-orange-700 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Bahan Baru</span>
            </button>
            <button
              onClick={handleSeedExample}
              disabled={isSeeding}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              {isSeeding ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              )}
              <span>Isi Data Contoh</span>
            </button>
          </div>
        </div>
      ) : filteredBahan.length === 0 ? (
        /* No Search Match */
        <div className="p-8 text-center bg-white rounded-3xl border border-stone-200">
          <Search className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-stone-700">Tidak ada bahan yang cocok</p>
          <p className="text-xs text-stone-400 mt-1">
            Pencarian "{searchQuery}" tidak menemukan hasil.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSatuanFilter('all');
            }}
            className="mt-3 text-xs font-bold text-orange-600 hover:underline"
          >
            Reset Pencarian & Filter
          </button>
        </div>
      ) : (
        /* List of Bahan */
        <div className="grid grid-cols-1 gap-3">
          {filteredBahan.map((bahan) => (
            <BahanCard
              key={bahan.id}
              bahan={bahan}
              onEdit={(b) => {
                setEditingBahan(b);
                setIsBahanModalOpen(true);
              }}
              onDelete={(b) => setDeletingBahan(b)}
              onManageKemasan={(b) => setManagingKemasanBahan(b)}
            />
          ))}
        </div>
      )}

      {/* Modal Tambah / Edit Bahan */}
      <BahanModal
        isOpen={isBahanModalOpen}
        initialBahan={editingBahan}
        onClose={() => {
          setIsBahanModalOpen(false);
          setEditingBahan(null);
        }}
        onSubmit={handleSaveBahan}
      />

      {/* Modal Kelola Kemasan Per Bahan */}
      <KemasanManagerModal
        isOpen={!!managingKemasanBahan}
        bahan={managingKemasanBahan}
        onClose={() => setManagingKemasanBahan(null)}
        onAddKemasan={handleAddKemasan}
        onUpdateKemasan={handleUpdateKemasan}
        onDeleteKemasan={handleDeleteKemasan}
      />

      {/* Dialog Konfirmasi Hapus Bahan */}
      <ConfirmDialog
        isOpen={!!deletingBahan}
        title="Hapus Bahan"
        message={`Apakah Anda yakin ingin menghapus bahan "${deletingBahan?.nama}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Ya, Hapus Bahan"
        isLoading={isDeleting}
        onConfirm={handleConfirmDeleteBahan}
        onCancel={() => setDeletingBahan(null)}
      />
    </div>
  );
};
