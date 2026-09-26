import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  Percent,
  Wallet,
  Store,
  RefreshCw,
  UtensilsCrossed,
  ArrowRight,
  Clock,
  AlertCircle,
  AlertTriangle,
  Lock,
  Loader2,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Transaksi, OpenBill } from '../types';
import {
  laporanCloudService,
  AgregasiTransaksi,
} from '../services/cloud/laporanCloudService';
import { openBillCloudService } from '../services/cloud/openBillCloudService';
import { pinOwnerCloudService } from '../services/cloud/pinOwnerCloudService';
import { formatRupiah, formatDateTimeIndo } from '../utils/formatters';

interface BerandaOwnerPageProps {
  onNavigateToKasir?: () => void;
  onNavigateToLaporan?: () => void;
}

export const BerandaOwnerPage: React.FC<BerandaOwnerPageProps> = ({
  onNavigateToKasir,
  onNavigateToLaporan,
}) => {
  const { currentOutlet, user } = useAuth();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transaksiHariIni, setTransaksiHariIni] = useState<Transaksi[]>([]);
  const [agregasiHariIni, setAgregasiHariIni] = useState<AgregasiTransaksi | null>(null);

  // State Open Bills > 24 Jam
  const [staleBills, setStaleBills] = useState<OpenBill[]>([]);
  const [billToForceClose, setBillToForceClose] = useState<OpenBill | null>(null);
  const [pinOwnerInput, setPinOwnerInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmittingForceClose, setIsSubmittingForceClose] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchBerandaData = useCallback(async () => {
    if (!currentOutlet?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      // 1. Ambil transaksi hari ini dari Firestore
      const res = await laporanCloudService.getTransaksiPeriod(currentOutlet.id, 'hari', 500);
      const agg = laporanCloudService.aggregateTransaksi(res.list);

      setTransaksiHariIni(res.list);
      setAgregasiHariIni(agg);

      // 2. Ambil open bills aktif dan filter yang > 24 jam
      try {
        const activeBills = await openBillCloudService.getActiveOpenBills(currentOutlet.id);
        const now = Date.now();
        const over24h = activeBills.filter((b) => {
          const openedTime = new Date(b.openedAt).getTime();
          return now - openedTime > 24 * 3600 * 1000;
        });
        setStaleBills(over24h);
      } catch (errBills) {
        console.warn('[BerandaOwnerPage] Gagal memuat open bills > 24 jam:', errBills);
      }
    } catch (err: unknown) {
      console.error('[BerandaOwnerPage] Gagal memuat data beranda:', err);
      const msg = err instanceof Error ? err.message : 'Gagal memuat ringkasan hari ini.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    fetchBerandaData();

    // Event listener reaktivitas
    const handleUpdate = () => {
      fetchBerandaData();
    };

    window.addEventListener('pos_fnb_transaksi_created', handleUpdate);
    window.addEventListener('pos_fnb_transaksi_updated', handleUpdate);
    window.addEventListener('pos_fnb_openbill_updated', handleUpdate);
    window.addEventListener('pos_fnb_outlet_switched', handleUpdate);

    return () => {
      window.removeEventListener('pos_fnb_transaksi_created', handleUpdate);
      window.removeEventListener('pos_fnb_transaksi_updated', handleUpdate);
      window.removeEventListener('pos_fnb_openbill_updated', handleUpdate);
      window.removeEventListener('pos_fnb_outlet_switched', handleUpdate);
    };
  }, [fetchBerandaData]);

  // 5 transaksi terakhir hari ini (sudah terurut desc berdasarkan createdAt)
  const limaTransaksiTerakhir = useMemo(() => {
    return transaksiHariIni.slice(0, 5);
  }, [transaksiHariIni]);

  // 3 produk terlaris hari ini
  const tigaProdukTerlaris = useMemo(() => {
    if (!agregasiHariIni) return [];
    return agregasiHariIni.perProduk.slice(0, 3);
  }, [agregasiHariIni]);

  const tanggalHariIniLabel = useMemo(() => {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  const handleForceCloseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || !billToForceClose) return;

    setPinError(null);
    const cleanPin = pinOwnerInput.trim();
    if (!cleanPin) {
      setPinError('PIN Owner wajib diisi.');
      return;
    }

    try {
      setIsSubmittingForceClose(true);
      const pinRes = await pinOwnerCloudService.verifyPinOwner(currentOutlet.id, cleanPin);
      if (!pinRes.hasPinConfigured) {
        setPinError('PIN Owner belum diatur pada outlet ini. Hubungi Owner.');
        setIsSubmittingForceClose(false);
        return;
      }
      if (!pinRes.valid) {
        setPinError(pinRes.message || 'PIN Owner salah.');
        setIsSubmittingForceClose(false);
        return;
      }

      // cancelBill memverifikasi PIN Owner secara terpusat di tingkat service
      await openBillCloudService.cancelBill(
        currentOutlet.id,
        billToForceClose.id,
        'Tutup paksa owner',
        user?.id || 'owner',
        cleanPin
      );

      setStaleBills((prev) => prev.filter((b) => b.id !== billToForceClose.id));
      setToastMessage(`Open bill "${billToForceClose.label}" berhasil ditutup paksa.`);
      setBillToForceClose(null);
      setPinOwnerInput('');
    } catch (err: unknown) {
      console.error('Gagal menutup paksa bill:', err);
      setPinError(err instanceof Error ? err.message : 'Gagal menutup paksa bill.');
    } finally {
      setIsSubmittingForceClose(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 pb-24">
      {/* Toast Notifikasi */}
      {toastMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Salam & Outlet Aktif */}
      <div className="bg-stone-900 text-white p-5 sm:p-6 rounded-3xl shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-stone-400 font-semibold mb-1">
              <Store className="w-4 h-4 text-orange-400" />
              <span>{currentOutlet?.nama || 'Outlet Aktif'}</span>
              <span className="text-stone-600">•</span>
              <span className="text-stone-300">{tanggalHariIniLabel}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Ringkasan Operasional
            </h1>
            <p className="text-xs sm:text-sm text-stone-400 mt-0.5">
              Pantau penjualan kasir, HPP resep, dan keuntungan bersih hari ini
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={fetchBerandaData}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition-all flex items-center gap-1.5 border border-stone-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kartu Peringatan Amber: Open Bill Menggantung > 24 Jam */}
      {staleBills.length > 0 && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-200 shadow-xs space-y-3 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-stone-900 text-sm">
                  Peringatan: {staleBills.length} Open Bill Menggantung &gt; 24 Jam
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">
                  Perlu Ditindak
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                Terdapat tagihan terbuka yang belum diselesaikan lebih dari satu hari. Anda dapat
                menutup paksa tagihan ini dengan verifikasi PIN Owner.
              </p>
            </div>
          </div>

          {/* Daftar Label Bill Singkat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {staleBills.map((b) => {
              const diffHours = Math.floor(
                (Date.now() - new Date(b.openedAt).getTime()) / (3600 * 1000)
              );
              return (
                <div
                  key={b.id}
                  className="p-3 bg-white rounded-2xl border border-amber-200 flex items-center justify-between gap-2 shadow-2xs"
                >
                  <div className="min-w-0">
                    <div className="font-black text-xs text-stone-900 truncate">{b.label}</div>
                    <div className="text-[10px] text-stone-500">
                      Tipe: <span className="uppercase font-semibold">{b.tipe}</span> •{' '}
                      <span className="text-amber-700 font-bold">{diffHours} jam lalu</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBillToForceClose(b);
                      setPinError(null);
                      setPinOwnerInput('');
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] shrink-0 transition"
                  >
                    Tutup Paksa
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error State */}
      {errorMessage ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Gagal Memuat Ringkasan</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">{errorMessage}</p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={fetchBerandaData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      ) : isLoading ? (
        /* Skeleton Loading */
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs animate-pulse space-y-3">
                <div className="w-8 h-8 rounded-lg bg-stone-200" />
                <div className="h-4 bg-stone-200 rounded w-1/2" />
                <div className="h-6 bg-stone-200 rounded w-3/4" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-56 bg-stone-100 rounded-2xl animate-pulse" />
            <div className="h-56 bg-stone-100 rounded-2xl animate-pulse" />
          </div>
        </div>
      ) : (
        /* Content Display */
        <div className="space-y-6">
          {/* Card Hari Ini: Omzet, Transaksi, Laba Kotor, Margin */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Omzet Hari Ini */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Omzet Hari Ini
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-stone-900 mt-2 truncate">
                {formatRupiah(agregasiHariIni?.omzet || 0)}
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Penjualan kotor tercatat</p>
            </div>

            {/* Total Transaksi */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Transaksi
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-stone-900 mt-2">
                {agregasiHariIni?.totalTrx || 0}
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Nota pesanan berhasil</p>
            </div>

            {/* Laba Kotor */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Laba Kotor
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-700 mt-2 truncate">
                {formatRupiah(agregasiHariIni?.labaKotor || 0)}
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                HPP: {formatRupiah(agregasiHariIni?.totalHpp || 0)}
              </p>
            </div>

            {/* Margin Hari Ini */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Margin
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-stone-900 mt-2">
                {agregasiHariIni?.marginPersen || 0}%
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Persentase laba kotor</p>
            </div>
          </div>

          {/* Empty State Hari Ini (jika belum ada transaksi) */}
          {(!transaksiHariIni || transaksiHariIni.length === 0) && (
            <div className="bg-orange-50/60 border border-orange-200 rounded-3xl p-6 sm:p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Belum ada transaksi hari ini. Semangat berjualan!
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Catat pesanan pelanggan di POS Kasir. Data transaksi dan laba kotor akan otomatis terupdate secara langsung di sini.
                </p>
              </div>
              {onNavigateToKasir && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onNavigateToKasir}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Buka POS Kasir</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Grid Dua Kolom: 5 Transaksi Terakhir & 3 Produk Terlaris Hari Ini */}
          {transaksiHariIni.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Kolom Kiri: 5 Transaksi Terakhir */}
              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <h2 className="text-xs sm:text-sm font-bold text-stone-900">
                      5 Transaksi Terakhir Hari Ini
                    </h2>
                  </div>
                  {onNavigateToLaporan && (
                    <button
                      type="button"
                      onClick={onNavigateToLaporan}
                      className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                      <span>Lihat Semua</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="divide-y divide-stone-100">
                  {limaTransaksiTerakhir.map((trx) => {
                    const jamLokal = trx.createdAt
                      ? new Date(trx.createdAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-';

                    return (
                      <div
                        key={trx.id}
                        className="py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-stone-900">
                            {trx.nomorTransaksi || trx.id}
                          </div>
                          <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-1.5">
                            <span>{jamLokal}</span>
                            <span>•</span>
                            <span className="capitalize font-semibold text-stone-600">
                              {trx.metodeBayar || 'tunai'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-black text-stone-900">
                          {formatRupiah(trx.total || 0)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kolom Kanan: 3 Produk Terlaris Hari Ini */}
              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-orange-600" />
                    <h2 className="text-xs sm:text-sm font-bold text-stone-900">
                      Top 3 Menu Terlaris Hari Ini
                    </h2>
                  </div>
                  {onNavigateToLaporan && (
                    <button
                      type="button"
                      onClick={onNavigateToLaporan}
                      className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                      <span>Laporan Menu</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {tigaProdukTerlaris.length === 0 ? (
                  <div className="py-8 text-center text-xs text-stone-400">
                    Belum ada menu yang terjual hari ini.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {tigaProdukTerlaris.map((prod, idx) => (
                      <div
                        key={prod.nama}
                        className="py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 font-black text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-stone-900">{prod.nama}</div>
                            <div className="text-[11px] text-stone-400">
                              {prod.qty} porsi terjual
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-black text-stone-900">
                            {formatRupiah(prod.omzet)}
                          </div>
                          <div className="text-[10px] text-emerald-700 font-semibold">
                            Laba: {formatRupiah(prod.laba)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Otorisasi PIN Owner untuk Tutup Paksa */}
      {billToForceClose && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
          <form
            onSubmit={handleForceCloseSubmit}
            className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center gap-2 text-amber-600">
              <Lock className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-sm text-stone-900">
                Otorisasi Tutup Paksa Bill
              </h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Tindakan ini akan membatalkan dan menutup open bill{' '}
              <strong>"{billToForceClose.label}"</strong> dengan alasan "Tutup paksa owner".
            </p>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-800 text-xs font-semibold flex items-center gap-1.5 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Masukkan PIN Owner <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                maxLength={6}
                value={pinOwnerInput}
                onChange={(e) => setPinOwnerInput(e.target.value)}
                autoFocus
                placeholder="6 digit PIN"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-center font-mono tracking-widest text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setBillToForceClose(null);
                  setPinOwnerInput('');
                  setPinError(null);
                }}
                className="flex-1 py-2 rounded-xl border border-stone-200 font-bold text-xs text-stone-600 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingForceClose || !pinOwnerInput.trim()}
                className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isSubmittingForceClose ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Konfirmasi Tutup</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
