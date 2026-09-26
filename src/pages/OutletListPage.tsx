import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Store, Plus, Search, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Outlet } from '../types';
import { outletService } from '../services/outletService';
import { OutletCard } from '../components/outlet/OutletCard';
import { OutletFormModal, OutletFormData } from '../components/outlet/OutletFormModal';
import { ConfirmDeleteOutletDialog } from '../components/outlet/ConfirmDeleteOutletDialog';

export const OutletListPage: React.FC = () => {
  const { refreshUserData } = useAuth();

  // State Utama
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // State Modal & Dialog
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Outlet | null>(null);
  const [deletingOutlet, setDeletingOutlet] = useState<Outlet | null>(null);

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

  // Cleanup timer saat unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Fetch semua outlet dari Firestore
  const fetchOutlets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await outletService.getAll();
      setOutlets(data);
      setLoadError(false);
    } catch (err) {
      console.error('[OutletListPage] Gagal memuat daftar outlet:', err);
      setLoadError(true);
      showToast('Gagal memuat data outlet dari server. Periksa koneksi Anda.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  // Filter outlet berdasarkan query pencarian nama (case-insensitive)
  const filteredOutlets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return outlets;
    return outlets.filter((o) => o.nama.toLowerCase().includes(query));
  }, [outlets, searchQuery]);

  // Buka modal untuk tambah outlet baru
  const handleOpenCreate = () => {
    setEditingOutlet(null);
    setIsFormOpen(true);
  };

  // Buka modal untuk edit outlet
  const handleOpenEdit = (outlet: Outlet) => {
    setEditingOutlet(outlet);
    setIsFormOpen(true);
  };

  // Buka konfirmasi hapus
  const handleOpenDelete = (outlet: Outlet) => {
    setDeletingOutlet(outlet);
  };

  // Handle submit form (Create atau Update)
  const handleFormSubmit = async (formData: OutletFormData) => {
    try {
      if (editingOutlet) {
        // Update outlet
        await outletService.update(editingOutlet.id, {
          nama: formData.nama,
          alamat: formData.alamat,
          telepon: formData.telepon,
        });
        showToast(`Outlet "${formData.nama}" berhasil diperbarui.`);
      } else {
        // Tambah outlet baru
        await outletService.create({
          nama: formData.nama,
          alamat: formData.alamat,
          telepon: formData.telepon,
          ownerIds: [],
        });
        showToast(`Outlet baru "${formData.nama}" berhasil didaftarkan.`);
      }

      await fetchOutlets();
      await refreshUserData();
    } catch (err) {
      console.error('[OutletListPage] Error simpan outlet:', err);
      showToast('Terjadi kesalahan saat menyimpan data outlet.', 'error');
      throw err;
    }
  };

  // Handle konfirmasi hapus outlet
  const handleConfirmDelete = async () => {
    if (!deletingOutlet) return;
    try {
      // Guard: Cek apakah masih ada user yang tertaut ke outlet ini
      const assignedCount = await outletService.countAssignedUsers(deletingOutlet.id);
      if (assignedCount > 0) {
        showToast(
          `Outlet tidak bisa dihapus: masih ada ${assignedCount} user tertaut. Hapus atau pindahkan penugasan user terlebih dahulu.`,
          'error'
        );
        return;
      }

      await outletService.delete(deletingOutlet.id);
      showToast(`Outlet "${deletingOutlet.nama}" berhasil dihapus.`);
      await fetchOutlets();
      await refreshUserData();
    } catch (err) {
      console.error('[OutletListPage] Error hapus outlet:', err);
      showToast('Gagal menghapus outlet. Pastikan Anda memiliki izin akses.', 'error');
      throw err;
    } finally {
      setDeletingOutlet(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 pb-28">
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

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6 text-orange-600" />
            <span>Daftar Outlet</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Kelola data cabang outlet jaringan bisnis (Khusus Super Admin).
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Outlet</span>
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
          placeholder="Cari outlet..."
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

      {/* Content: Loading Skeleton, Error State, Empty State, atau Grid Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg p-4 border border-stone-200 shadow animate-pulse space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-stone-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="h-3 bg-stone-100 rounded w-full" />
                <div className="h-3 bg-stone-100 rounded w-2/3" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <div className="h-7 w-14 bg-stone-100 rounded-md" />
                <div className="h-7 w-14 bg-stone-100 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        /* Panel Error Saat Fetch Gagal */
        <div className="bg-white rounded-2xl border border-rose-200 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Gagal memuat data outlet.</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5">
            Terjadi kendala saat mengambil data outlet dari server. Silakan periksa koneksi internet Anda dan coba lagi.
          </p>
          <button
            type="button"
            onClick={fetchOutlets}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : outlets.length === 0 ? (
        /* Empty State Saat Belum Ada Outlet */
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Belum ada outlet terdaftar</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5">
            Daftarkan outlet cabang pertama Anda untuk mulai mengelola katalog menu, kasir, dan operasional bisnis.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Outlet Pertama</span>
          </button>
        </div>
      ) : filteredOutlets.length === 0 ? (
        /* Empty State Hasil Pencarian Tidak Ditemukan */
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mb-2">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800">Tidak ada outlet yang cocok</h3>
          <p className="text-xs text-stone-400 mt-0.5 mb-3">
            Tidak ditemukan outlet dengan kata kunci "{searchQuery}".
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
        /* Grid Layout: 1 kolom di mobile, 2 kolom di tablet, 3 kolom di desktop */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOutlets.map((outlet) => (
            <OutletCard
              key={outlet.id}
              outlet={outlet}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          ))}
        </div>
      )}

      {/* Modal Form Tambah / Edit Outlet */}
      <OutletFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingOutlet(null);
        }}
        onSubmit={handleFormSubmit}
        outlet={editingOutlet}
      />

      {/* Dialog Konfirmasi Hapus Outlet */}
      <ConfirmDeleteOutletDialog
        isOpen={Boolean(deletingOutlet)}
        onClose={() => setDeletingOutlet(null)}
        onConfirm={handleConfirmDelete}
        outletName={deletingOutlet?.nama || ''}
      />
    </div>
  );
};
