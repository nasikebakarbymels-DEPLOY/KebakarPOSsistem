import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Transaksi } from '../types';
import { transaksiService } from '../services/transaksiService';
import { formatRupiah } from '../utils/formatters';
import {
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  Banknote,
  QrCode,
  CreditCard,
  CloudCheck,
} from 'lucide-react';

export const SyncPage: React.FC = () => {
  const { currentOutlet, isOnline } = useAuth();

  const [pendingList, setPendingList] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const loadPendingData = useCallback(async () => {
    if (!currentOutlet?.id) return;
    try {
      setLoading(true);
      const pending = await transaksiService.getPendingByOutlet(currentOutlet.id);
      setPendingList(pending);
      const last = transaksiService.getLastSyncAt(currentOutlet.id);
      setLastSyncTime(last);
    } catch (err) {
      console.error('Gagal memuat antrean pending:', err);
    } finally {
      setLoading(false);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    loadPendingData();

    // Listener custom event pembaruan transaksi
    const handleUpdate = () => {
      loadPendingData();
    };

    window.addEventListener('pos_fnb_transaksi_updated', handleUpdate);
    return () => {
      window.removeEventListener('pos_fnb_transaksi_updated', handleUpdate);
    };
  }, [loadPendingData]);

  // Fungsi Sync Manual & Idempoten
  const handleSyncNow = async () => {
    if (!currentOutlet?.id) return;

    if (!isOnline) {
      showToast(
        'Perangkat sedang offline. Sambungkan koneksi internet untuk melakukan sinkronisasi.',
        'error'
      );
      return;
    }

    try {
      setSyncing(true);
      const result = await transaksiService.syncNow(currentOutlet.id, isOnline);
      await loadPendingData();
      if (result.syncedCount > 0) {
        showToast(
          `Berhasil menyinkronkan ${result.syncedCount} transaksi ke sistem.`,
          'success'
        );
      } else {
        showToast('Semua transaksi sudah dalam status tersinkronisasi.', 'info');
      }
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat sinkronisasi.',
        'error'
      );
    } finally {
      setSyncing(false);
    }
  };

  // Auto-sync saat event 'online' kembali aktif
  useEffect(() => {
    const handleAutoSync = async () => {
      if (currentOutlet?.id && navigator.onLine) {
        try {
          const pending = await transaksiService.getPendingByOutlet(currentOutlet.id);
          if (pending.length > 0) {
            const result = await transaksiService.syncNow(currentOutlet.id, true);
            await loadPendingData();
            showToast(
              `Koneksi pulih: ${result.syncedCount} transaksi offline otomatis disinkronkan.`,
              'success'
            );
          }
        } catch (err) {
          console.error('Auto-sync gagal:', err);
        }
      }
    };

    window.addEventListener('online', handleAutoSync);
    return () => {
      window.removeEventListener('online', handleAutoSync);
    };
  }, [currentOutlet?.id, loadPendingData]);

  return (
    <div className="min-h-full px-4 py-4 md:py-6 max-w-2xl mx-auto pb-24">
      {/* Toast Notification Bar */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`px-4 py-2.5 rounded-2xl shadow-xl border text-xs font-semibold flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500'
                : toastMessage.type === 'error'
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-stone-900 text-white border-stone-800'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'info' && <RefreshCw className="w-4 h-4 shrink-0 text-orange-400" />}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Halaman Sync */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-stone-900">
              Sinkronisasi Transaksi
            </h2>
            <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200">
              Offline-First Engine
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Pantau antrean transaksi yang dibuat saat offline dan sinkronkan ke server.
          </p>
        </div>

        {/* Status Koneksi */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border self-start sm:self-auto text-xs font-bold ${
            isOnline
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {isOnline ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-rose-600" />}
          <span>{isOnline ? 'Terhubung (Online)' : 'Terputus (Offline)'}</span>
        </div>
      </div>

      {/* Card Info Sinkronisasi & Tombol Aksi */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-stone-200 shadow-2xs mb-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-stone-500">Antrean Pending:</span>
              <span
                className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                  pendingList.length > 0
                    ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-200'
                    : 'bg-stone-100 text-stone-700'
                }`}
              >
                {pendingList.length} transaksi
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-400">
              <Clock className="w-3.5 h-3.5" />
              <span>
                Terakhir sync:{' '}
                {lastSyncTime
                  ? new Date(lastSyncTime).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'Belum pernah'}
              </span>
            </div>
          </div>

          <button
            type="button"
            id="pos-sync-now-button"
            onClick={handleSyncNow}
            disabled={syncing || pendingList.length === 0}
            className="px-5 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 disabled:bg-stone-200 disabled:text-stone-400 text-white text-xs font-extrabold shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Menyinkronkan...' : 'Sync Sekarang'}</span>
          </button>
        </div>
      </div>

      {/* Konten Daftar Transaksi Pending */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-stone-900 text-sm">Daftar Antrean Pending</h3>
          <span className="text-xs text-stone-400">Outlet: {currentOutlet?.nama}</span>
        </div>

        {loading ? (
          <div className="py-12 bg-white rounded-3xl border border-stone-200 text-center text-stone-400">
            <RefreshCw className="w-7 h-7 animate-spin text-orange-600 mx-auto mb-2" />
            <p className="text-xs font-semibold">Memeriksa antrean sinkronisasi...</p>
          </div>
        ) : pendingList.length === 0 ? (
          /* Empty State: Tidak ada antrean */
          <div className="py-12 px-4 bg-white rounded-3xl border border-stone-200 text-center">
            <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3 ring-6 ring-emerald-50/50">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h4 className="font-bold text-stone-900 text-base mb-1">
              Semua Transaksi Sudah Tersinkronisasi
            </h4>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Tidak ada transaksi offline yang tertunda dalam antrean. Setiap transaksi baru saat online langsung tersinkronkan otomatis.
            </p>
          </div>
        ) : (
          /* List Transaksi Pending */
          <div className="space-y-2.5">
            {pendingList.map((trx) => (
              <div
                key={trx.id}
                className="p-3.5 sm:p-4 bg-white rounded-2xl border border-amber-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 text-sm">
                      {trx.nomorTransaksi}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    <span>
                      {new Date(String(trx.tanggal || trx.createdAt)).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      {trx.pembayaran?.metode === 'tunai' && <Banknote className="w-3.5 h-3.5 text-stone-400" />}
                      {(trx.pembayaran?.metode === 'qris_transfer' || trx.metodeBayar === 'qris' || trx.metodeBayar === 'transfer') && (
                        <QrCode className="w-3.5 h-3.5 text-stone-400" />
                      )}
                      {trx.pembayaran?.metode === 'piutang' && <CreditCard className="w-3.5 h-3.5 text-stone-400" />}
                      <span className="uppercase font-semibold">
                        {trx.pembayaran?.metode === 'qris_transfer' ? 'QRIS/TF' : trx.pembayaran?.metode || trx.metodeBayar}
                      </span>
                    </span>
                    <span>•</span>
                    <span>{trx.items.length} item</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                  <div className="text-right">
                    <span className="text-[11px] text-stone-400 block sm:hidden">Total:</span>
                    <span className="text-sm sm:text-base font-extrabold text-stone-900">
                      {formatRupiah(trx.totalAkhir || trx.total)}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-stone-100 text-stone-600">
                    {(trx.statusPembayaran || trx.status).toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Petunjuk Edukasi PWA Offline */}
      <div className="mt-8 p-4 bg-stone-100/70 rounded-2xl border border-stone-200/80 flex items-start gap-3 text-xs text-stone-600">
        <HelpCircle className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-stone-800">Bagaimana Cara Kerja Antrean Offline?</p>
          <p className="text-stone-500 leading-relaxed">
            Saat koneksi terputus, kasir tetap dapat melayani pelanggan dan mencatat transaksi secara lokal.
            Transaksi tersebut masuk ke antrean pending dan akan otomatis tersinkronisasi saat koneksi pulih,
            atau dapat disinkronkan secara manual lewat tombol <strong>Sync Sekarang</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
