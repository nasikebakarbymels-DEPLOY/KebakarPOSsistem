import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Clock,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Printer,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Banknote,
  QrCode,
  Inbox,
  Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Transaksi } from '../types';
import {
  transaksiCloudService,
  PeriodeFilter,
  getStartOfPeriodISO,
} from '../services/cloud/transaksiCloudService';
import { StrukModal } from '../components/pos/StrukModal';
import { formatRupiah, formatDateTimeIndo } from '../utils/formatters';

export const RiwayatTransaksiPage: React.FC = () => {
  const { currentOutlet, isOnline } = useAuth();

  const [periode, setPeriode] = useState<PeriodeFilter>('hari');
  const [syncedTransaksi, setSyncedTransaksi] = useState<Transaksi[]>([]);
  const [pendingQueue, setPendingQueue] = useState<Transaksi[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTransaksi, setSelectedTransaksi] = useState<Transaksi | null>(null);

  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    setToastMessage({ text, type });
  };

  const getPeriodeLabel = (p: PeriodeFilter) => {
    switch (p) {
      case 'hari':
        return 'Hari Ini';
      case '7hari':
        return '7 Hari';
      case '30hari':
        return '30 Hari';
    }
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Load pending queue dari IndexedDB
  const refreshPendingQueue = useCallback(async () => {
    if (!currentOutlet?.id) return;
    try {
      const items = await transaksiCloudService.getPendingQueueItems(currentOutlet.id);
      setPendingQueue(items);
    } catch (err) {
      console.error('[Riwayat] Gagal membaca pending queue:', err);
    }
  }, [currentOutlet?.id]);

  // Subscribe ke Firestore onSnapshot untuk transaksi sesuai periode
  useEffect(() => {
    if (!currentOutlet?.id) {
      setLoading(false);
      setSyncedTransaksi([]);
      setPendingQueue([]);
      return;
    }

    setLoading(true);
    setLoadError(null);
    refreshPendingQueue();

    const unsubscribe = transaksiCloudService.subscribeTransaksi(
      currentOutlet.id,
      periode,
      (list) => {
        setSyncedTransaksi(list);
        setLoadError(null);
        setLoading(false);
      },
      (err) => {
        console.error('[Riwayat] Error subscription transaksi:', err);
        setLoadError('Gagal memuat riwayat transaksi dari server. Periksa koneksi internet Anda.');
        setLoading(false);
      }
    );

    // Event listener antrean lokal
    const handleQueueChange = () => {
      refreshPendingQueue();
    };

    window.addEventListener('pos_fnb_transaksi_updated', handleQueueChange);
    window.addEventListener('pos_fnb_sync_queue_updated', handleQueueChange);

    return () => {
      unsubscribe();
      window.removeEventListener('pos_fnb_transaksi_updated', handleQueueChange);
      window.removeEventListener('pos_fnb_sync_queue_updated', handleQueueChange);
    };
  }, [currentOutlet?.id, periode, retryCount, refreshPendingQueue]);

  // Flush Queue manual / refresh
  const handleFlushQueue = async () => {
    if (!currentOutlet?.id) return;
    if (!isOnline) {
      showToast('Perangkat offline. Sambungkan internet untuk sinkronisasi.', 'error');
      return;
    }

    setSyncing(true);
    try {
      const res = await transaksiCloudService.flushQueue(currentOutlet.id);
      await refreshPendingQueue();
      if (res.syncedCount > 0) {
        showToast(`Berhasil menyinkronkan ${res.syncedCount} transaksi ke cloud.`, 'success');
      } else if (pendingQueue.length === 0) {
        showToast('Semua transaksi hari ini sudah tersinkronisasi.', 'info');
      } else {
        showToast('Proses sinkronisasi selesai.', 'info');
      }
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : 'Gagal menyinkronkan transaksi.',
        'error'
      );
    } finally {
      setSyncing(false);
    }
  };

  // Gabungan transaksi: Antrean (Pending) selalu di atas, diikuti yang tersinkronisasi
  const combinedList = useMemo(() => {
    // Hindari duplikasi jika item yang sama sudah tersinkron ke firestore
    const syncedIds = new Set(syncedTransaksi.map((t) => t.id));
    const uniquePending = pendingQueue.filter((t) => !syncedIds.has(t.id));
    return [...uniquePending, ...syncedTransaksi];
  }, [pendingQueue, syncedTransaksi]);

  // Perhitungan Ringkasan Omzet Hari Ini (Tersinkron + Antre khusus hari ini)
  const ringkasanHariIni = useMemo(() => {
    const startOfTodayIso = getStartOfPeriodISO('hari');
    const todayTransactions = combinedList.filter((t) => t.createdAt >= startOfTodayIso);
    const totalOmzet = todayTransactions.reduce((acc, t) => acc + (t.total || 0), 0);
    const totalTrx = todayTransactions.length;
    const pendingCount = pendingQueue.length;
    return { totalOmzet, totalTrx, pendingCount };
  }, [combinedList, pendingQueue]);

  // Filter pencarian
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return combinedList;
    const q = searchQuery.toLowerCase();
    return combinedList.filter((t) => {
      const matchNo = t.nomorTransaksi.toLowerCase().includes(q);
      const matchKasir = (t.kasirNama || '').toLowerCase().includes(q);
      const matchMetode = (t.metodeBayar || '').toLowerCase().includes(q);
      const matchItem = t.items.some((it) => it.nama.toLowerCase().includes(q));
      return matchNo || matchKasir || matchMetode || matchItem;
    });
  }, [combinedList, searchQuery]);

  const getMetodeIcon = (metode: string) => {
    switch (metode) {
      case 'tunai':
        return <Banknote className="w-3.5 h-3.5 text-emerald-600" />;
      case 'qris':
        return <QrCode className="w-3.5 h-3.5 text-blue-600" />;
      case 'transfer':
        return <CreditCard className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Receipt className="w-3.5 h-3.5 text-stone-600" />;
    }
  };

  return (
    <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-bold animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-700'
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white border-rose-700'
              : 'bg-stone-800 text-white border-stone-900'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-stone-900 leading-tight">
            Riwayat Transaksi
          </h1>
          <p className="text-xs text-stone-500">
            {getPeriodeLabel(periode)} • {combinedList.length} transaksi
          </p>
        </div>

        <button
          type="button"
          onClick={handleFlushQueue}
          disabled={syncing}
          className="px-3.5 py-2 rounded-xl bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs border border-stone-200 shadow-2xs flex items-center gap-1.5 transition disabled:opacity-50"
          title="Sinkronkan antrean transaksi ke server"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-orange-600' : ''}`} />
          <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan / Muat Ulang'}</span>
        </button>
      </div>

      {/* KPI Cards Omzet Hari Ini */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Total Omzet Hari Ini
          </span>
          <div className="text-xl sm:text-2xl font-black text-stone-900">
            {formatRupiah(ringkasanHariIni.totalOmzet)}
          </div>
          <p className="text-[10px] text-stone-500">Akumulasi transaksi offline & online</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Jumlah Transaksi
          </span>
          <div className="text-xl sm:text-2xl font-black text-stone-900">
            {ringkasanHariIni.totalTrx} Trx
          </div>
          <p className="text-[10px] text-stone-500">Total struk tercatat hari ini</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
            Status Sinkronisasi
          </span>
          <div className="flex items-center gap-2">
            {ringkasanHariIni.pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{ringkasanHariIni.pendingCount} Menunggu Sync</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Semua Tersinkron</span>
              </span>
            )}
          </div>
          <p className="text-[10px] text-stone-500">
            {isOnline ? 'Koneksi online aktif' : 'Mode offline aktif'}
          </p>
        </div>
      </div>

      {/* Filter Periode & Search Input */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        {/* Segmented Filter Periode */}
        <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200/80 shrink-0">
          {(
            [
              { id: 'hari', label: 'Hari Ini' },
              { id: '7hari', label: '7 Hari' },
              { id: '30hari', label: '30 Hari' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriode(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                periode === tab.id
                  ? 'bg-white text-stone-900 shadow-2xs'
                  : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nomor transaksi, kasir, atau menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 text-xs sm:text-sm font-semibold text-stone-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Tabel / Daftar Riwayat Transaksi */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        {loadError ? (
          /* Error Panel */
          <div className="py-14 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-900">Gagal Memuat Transaksi</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {loadError}
              </p>
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setRetryCount((c) => c + 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-xs transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Coba Lagi</span>
              </button>
            </div>
          </div>
        ) : loading ? (
          /* Skeleton Loading */
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !currentOutlet?.id ? (
          /* Empty State: Outlet Belum Terpilih */
          <div className="py-16 text-center space-y-3 px-4">
            <Inbox className="w-12 h-12 text-stone-300 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-stone-800">
                Outlet aktif belum terpilih.
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                Silakan pilih outlet aktif terlebih dahulu untuk melihat riwayat transaksi.
              </p>
            </div>
          </div>
        ) : filteredList.length === 0 ? (
          /* Empty State */
          <div className="py-16 text-center space-y-3 px-4">
            <Inbox className="w-12 h-12 text-stone-300 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-stone-800">
                {searchQuery ? 'Transaksi tidak ditemukan' : 'Tidak ada transaksi pada periode ini'}
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'Periksa kembali kata kunci pencarian Anda.'
                  : 'Tidak ada transaksi pada periode ini. Coba pilih periode lebih panjang.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredList.map((trx) => {
              const isPending = trx.syncSource === 'queue' || trx.syncStatus === 'pending';

              return (
                <div
                  key={trx.id}
                  onClick={() => setSelectedTransaksi(trx)}
                  className="p-3.5 sm:p-4 hover:bg-stone-50/80 transition cursor-pointer flex items-center justify-between gap-3 group"
                >
                  {/* Kiri: Nomor Trx, Jam, Kasir & Item Preview */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-xs sm:text-sm text-stone-900">
                        {trx.nomorTransaksi}
                      </span>

                      {/* Badge Sync Status */}
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                          <span>⏳</span>
                          <span>Menunggu sync</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold">
                          <span>☁️</span>
                          <span>Tersinkron</span>
                        </span>
                      )}

                      {/* Badge Metode Pembayaran */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[10px] font-semibold">
                        {getMetodeIcon(trx.metodeBayar)}
                        <span className="uppercase">{trx.metodeBayar}</span>
                      </span>

                      {/* Badge Diskon Promo Menu */}
                      {trx.diskonProdukTotal && trx.diskonProdukTotal > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                          <span>🏷️</span>
                          <span>Diskon -{formatRupiah(trx.diskonProdukTotal)}</span>
                        </span>
                      ) : null}

                      {/* Badge Voucher */}
                      {trx.voucherKode && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold font-mono">
                          <span>🎟️</span>
                          <span>{trx.voucherKode}</span>
                        </span>
                      )}

                      {/* Badge Biaya Lain */}
                      {trx.biayaLainList && trx.biayaLainList.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                          <span>+{trx.biayaLainList.length} Biaya</span>
                        </span>
                      )}

                      {/* Badge Persetujuan Biaya Manual PIN */}
                      {trx.approvalBiayaManual && trx.approvalBiayaManual.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">
                          <span>🛡️</span>
                          <span>Biaya Manual ({trx.approvalBiayaManual.length})</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-stone-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>{formatDateTimeIndo(trx.createdAt)}</span>
                      <span>•</span>
                      <span>Kasir: {trx.kasirNama || 'Kasir'}</span>
                      <span>•</span>
                      <span className="truncate max-w-[200px] sm:max-w-xs">
                        {trx.items.map((it) => `${it.qty}x ${it.nama}`).join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Kanan: Nominal Total & Tombol Cetak/Detail */}
                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <div className="text-xs sm:text-sm font-black text-stone-900">
                        {formatRupiah(trx.total)}
                      </div>
                      <span className="text-[10px] text-stone-400">
                        {trx.items.reduce((acc, it) => acc + it.qty, 0)} item
                      </span>
                    </div>

                    <div className="w-8 h-8 rounded-xl bg-stone-100 group-hover:bg-orange-600 group-hover:text-white text-stone-500 flex items-center justify-center transition">
                      <Printer className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Cetak Ulang Struk Transaksi */}
      <StrukModal
        isOpen={!!selectedTransaksi}
        onClose={() => setSelectedTransaksi(null)}
        transaksi={selectedTransaksi}
      />
    </div>
  );
};
