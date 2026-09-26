import React, { useState } from 'react';
import {
  ShieldAlert,
  Trash2,
  Database,
  Smartphone,
  Store,
  User,
  CheckCircle2,
  AlertTriangle,
  X,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { syncQueueService, localDraftService } from '../../services/localDb';

export const TentangAplikasiSegment: React.FC = () => {
  const { user, currentOutlet } = useAuth();
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [confirmText, setConfirmText] = useState<string>('');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Akses reset hanya untuk role owner dan super_admin
  const canReset = user?.role === 'owner' || user?.role === 'super_admin';

  const handleOpenResetModal = async () => {
    if (!canReset) return;
    try {
      const count = await syncQueueService.getPendingCount();
      setPendingSyncCount(count);
    } catch (err) {
      console.error('Gagal mengambil pending count:', err);
      setPendingSyncCount(0);
    }
    setConfirmText('');
    setIsResetModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isClearing) return;
    setIsResetModalOpen(false);
    setConfirmText('');
  };

  const handleExecuteReset = async () => {
    if (!canReset || confirmText.trim() !== 'RESET' || isClearing) return;

    setIsClearing(true);
    try {
      // 1. Bersihkan IndexedDB antrean sync & draf lokal
      try {
        await syncQueueService.clearAll();
        await localDraftService.clearAll();
      } catch (e) {
        console.warn('Gagal membersihkan IndexedDB:', e);
      }

      // 2. Bersihkan LocalStorage aplikasi (kunci berawalan pos_fnb_)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('pos_fnb_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));

      // 3. Tampilkan toast sukses & tutup dialog
      setIsResetModalOpen(false);
      setToastMessage({
        text: 'Data lokal perangkat berhasil direset.',
        type: 'success',
      });

      // 4. Muat ulang state halaman / reload window
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: unknown) {
      console.error('Gagal mereset cache lokal:', err);
      setToastMessage({
        text: err instanceof Error ? err.message : 'Gagal mereset data lokal perangkat.',
        type: 'error',
      });
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : 'bg-rose-600 text-white border-rose-700'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Card Header Info Aplikasi */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs text-center space-y-3">
        <div className="w-16 h-16 rounded-3xl bg-orange-500 text-white flex items-center justify-center mx-auto shadow-md shadow-orange-500/20">
          <Smartphone className="w-8 h-8" />
        </div>
        <div>
          <h3 className="font-black text-stone-900 text-lg">
            POS F&B Multi-Outlet
          </h3>
          <p className="text-xs text-stone-500 font-medium mt-0.5">
            Progressive Web App (PWA) • Versi 1.0.0
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-orange-100 text-orange-800">
            Sistem Multi-Outlet
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Offline-Ready (PWA)</span>
          </span>
        </div>
      </div>

      {/* Profil Pengguna & Outlet Aktif */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-3">
        <h4 className="font-extrabold text-xs text-stone-800 flex items-center gap-2">
          <User className="w-4 h-4 text-orange-600" />
          <span>Sesi Pengguna Saat Ini</span>
        </h4>

        <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-100 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-stone-500">Nama Pengguna:</span>
            <span className="font-bold text-stone-900">{user?.nama || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Email:</span>
            <span className="font-medium text-stone-800">{user?.email || '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Peran Akses:</span>
            <span className="font-bold uppercase text-orange-700">
              {user?.role === 'super_admin'
                ? 'Super Admin (Read-Only Group)'
                : user?.role === 'owner'
                ? 'Owner Outlet'
                : 'Kasir POS'}
            </span>
          </div>
          <div className="flex justify-between border-t border-stone-200 pt-1.5">
            <span className="text-stone-500">Outlet Aktif:</span>
            <span className="font-bold text-stone-900">
              {currentOutlet?.nama || 'Seluruh Outlet (Super Admin)'}
            </span>
          </div>
        </div>
      </div>

      {/* Keterangan Penyimpanan Lokal Per Outlet */}
      <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-stone-900 font-extrabold text-xs">
          <Database className="w-4 h-4 text-orange-600" />
          <span>Keterangan Penyimpanan Data Lokal</span>
        </div>

        <p className="text-xs text-stone-600 leading-relaxed">
          Seluruh data operasional aplikasi ini (katalog menu produk, master bahan, konversi kemasan, resep bertingkat, transaksi penjualan, open bill meja, pengeluaran operasional, buku piutang pelanggan, dan antrean sinkronisasi) disimpan secara <strong>terisolasi per-outlet</strong> di penyimpanan lokal (LocalStorage & IndexedDB) browser perangkat ini.
        </p>

        <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-1.5 text-xs text-stone-600">
          <div className="flex items-center gap-1.5 font-bold text-stone-800">
            <Store className="w-3.5 h-3.5 text-stone-500" />
            <span>Isolasi Multi-Outlet:</span>
          </div>
          <p className="text-[11px] text-stone-500 pl-5">
            Data antara Outlet 1 dan Outlet 2 sepenuhnya terpisah. Mengubah resep atau transaksi di satu outlet tidak akan memengaruhi data outlet lainnya.
          </p>
        </div>
      </div>

      {/* Pemeliharaan & Reset Penyimpanan (Hanya untuk Owner & Super Admin) */}
      {canReset && (
        <div className="bg-red-50/60 rounded-3xl p-5 border border-red-200 space-y-3 animate-in fade-in">
          <div className="flex items-center gap-2 text-red-950 font-extrabold text-xs">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            <span>Pemeliharaan & Reset Penyimpanan</span>
          </div>

          <p className="text-xs text-red-800/80 leading-relaxed">
            Gunakan tombol di bawah jika Anda ingin mengosongkan seluruh antrean transaksi lokal, buku piutang, dan memulai ulang data ke kondisi bawaan awal.
          </p>

          <button
            type="button"
            id="btn-open-reset-modal"
            onClick={handleOpenResetModal}
            className="w-full py-2.5 px-4 rounded-2xl bg-white border border-red-200 hover:bg-red-100/60 text-red-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span>Reset Data Lokal Perangkat</span>
          </button>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Reset Berbahaya */}
      {canReset && isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-red-50 text-red-900">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                <h3 className="font-extrabold text-sm text-red-950">
                  Konfirmasi Reset Data Lokal
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isClearing}
                className="w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center hover:bg-red-200 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-stone-600">
              {/* Dampak Reset */}
              <div className="p-3 bg-stone-100 rounded-2xl border border-stone-200 text-stone-700 text-xs leading-relaxed font-medium">
                Seluruh antrean transaksi lokal, draf, dan data lokal perangkat akan dihapus permanen.
              </div>

              {/* Status Transaksi Menunggu Sync */}
              {pendingSyncCount > 0 ? (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs leading-relaxed flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold text-rose-950 mb-0.5">
                      Peringatan Transaksi Offline:
                    </strong>
                    Terdapat <strong>{pendingSyncCount} transaksi</strong> menunggu sync saat ini. Transaksi tersebut akan hilang permanen bila direset sebelum sempat terunggah ke server!
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Antrean sinkronisasi bersih (0 transaksi menunggu sync).</span>
                </div>
              )}

              {/* Input Verifikasi Teks RESET */}
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="input-confirm-reset"
                  className="block text-stone-700 font-semibold"
                >
                  Ketik kata <strong className="text-red-600 font-mono">RESET</strong> secara persis untuk mengaktifkan konfirmasi:
                </label>

                <input
                  type="text"
                  id="input-confirm-reset"
                  value={confirmText}
                  disabled={isClearing}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Ketik RESET"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-sm font-mono font-bold text-center uppercase tracking-widest text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 disabled:bg-stone-100"
                />
              </div>

              {/* Tombol Aksi */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isClearing}
                  className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold hover:bg-stone-50 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="btn-confirm-execute-reset"
                  disabled={confirmText !== 'RESET' || isClearing}
                  onClick={handleExecuteReset}
                  className={`flex-1 py-2.5 rounded-xl text-white font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                    confirmText === 'RESET' && !isClearing
                      ? 'bg-rose-600 hover:bg-rose-700 active:scale-[0.99] shadow-sm cursor-pointer'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  {isClearing ? (
                    <span>Mereset Data...</span>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Hapus & Reset</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
