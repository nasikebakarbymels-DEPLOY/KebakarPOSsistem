import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Receipt,
  Percent,
  Wallet,
  ShoppingBag,
  Store,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Calendar,
  UtensilsCrossed,
  Layers,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Outlet, Transaksi } from '../types';
import { outletService } from '../services/outletService';
import {
  laporanCloudService,
  PeriodeLaporanCloud,
  AgregasiTransaksi,
  TrenHarianLokalItem,
} from '../services/cloud/laporanCloudService';
import { formatRupiah } from '../utils/formatters';

export const LaporanPage: React.FC = () => {
  const { user, currentOutlet } = useAuth();

  // Role check
  const isSuperAdmin = user?.role === 'super_admin';

  // State Super Admin: Daftar outlet dan outlet terpilih
  const [outletList, setOutletList] = useState<Outlet[]>([]);
  const [selectedOutletId, setSelectedOutletId] = useState<string>('');

  // Periode filter: default 'hari'
  const [periode, setPeriode] = useState<PeriodeLaporanCloud>('hari');

  // Data state
  const [transaksiList, setTransaksiList] = useState<Transaksi[]>([]);
  const [agregasi, setAgregasi] = useState<AgregasiTransaksi | null>(null);
  const [belanjaBahan, setBelanjaBahan] = useState<number>(0);
  const [isTruncated, setIsTruncated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inisialisasi daftar outlet untuk Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      outletService.getAll().then((list) => {
        setOutletList(list);
        if (list.length > 0 && !selectedOutletId) {
          setSelectedOutletId(list[0].id);
        }
      }).catch((err) => {
        console.error('[LaporanPage] Gagal memuat daftar outlet:', err);
      });
    }
  }, [isSuperAdmin, selectedOutletId]);

  // Tentukan ID & Nama outlet aktif
  const activeOutletId = useMemo(() => {
    if (isSuperAdmin) return selectedOutletId;
    return currentOutlet?.id || '';
  }, [isSuperAdmin, selectedOutletId, currentOutlet?.id]);

  const activeOutletName = useMemo(() => {
    if (isSuperAdmin) {
      const found = outletList.find((o) => o.id === selectedOutletId);
      return found?.nama || 'Outlet Terpilih';
    }
    return currentOutlet?.nama || 'Outlet';
  }, [isSuperAdmin, selectedOutletId, outletList, currentOutlet?.nama]);

  // Fetch Data Laporan
  const fetchLaporanData = useCallback(async () => {
    if (!activeOutletId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      // 1. Ambil transaksi & hitung agregasi
      const [txResult, belanja] = await Promise.all([
        laporanCloudService.getTransaksiPeriod(activeOutletId, periode, 500),
        laporanCloudService.getBelanjaBahanPeriod(activeOutletId, periode),
      ]);

      const agg = laporanCloudService.aggregateTransaksi(txResult.list);

      setTransaksiList(txResult.list);
      setAgregasi(agg);
      setBelanjaBahan(belanja);
      setIsTruncated(txResult.truncated);
    } catch (err: unknown) {
      console.error('[LaporanPage] Gagal memuat laporan finansial:', err);
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memuat laporan dari server.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [activeOutletId, periode]);

  useEffect(() => {
    fetchLaporanData();
  }, [fetchLaporanData]);

  // Handler Ekspor CSV
  const handleExportCsv = () => {
    if (!transaksiList || transaksiList.length === 0) {
      alert('Tidak ada data transaksi untuk diekspor pada periode ini.');
      return;
    }
    laporanCloudService.exportCsvTransaksi(transaksiList, activeOutletName, periode);
  };

  // Tren 7 Hari Terakhir untuk grafik batang CSS
  const trend7Hari: TrenHarianLokalItem[] = useMemo(() => {
    if (!agregasi) return [];
    return laporanCloudService.generateLast7DaysTrend(agregasi.perHari);
  }, [agregasi]);

  const maxOmzet7Hari = useMemo(() => {
    const values = trend7Hari.map((t) => t.omzet);
    return Math.max(...values, 100000);
  }, [trend7Hari]);

  // Guard role kasir (ditempatkan setelah seluruh pemanggilan hooks)
  if (!user || user.role === 'kasir') {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 m-4 shadow-xs">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-stone-900">Akses Ditolak</h3>
        <p className="text-xs text-stone-500 mt-1">
          Kasir tidak memiliki wewenang untuk melihat laporan finansial outlet.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Halaman & Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-stone-900">
              {isSuperAdmin ? 'Laporan Per Outlet' : 'Laporan Finansial Outlet'}
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            {activeOutletName} • Analisis omzet, laba kotor, HPP resep, dan belanja bahan baku
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Super Admin: Dropdown Pemilih Outlet */}
          {isSuperAdmin && outletList.length > 0 && (
            <div className="relative">
              <select
                value={selectedOutletId}
                onChange={(e) => setSelectedOutletId(e.target.value)}
                className="appearance-none pl-8 pr-8 py-2 rounded-xl text-xs font-bold bg-white border border-stone-200 text-stone-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500 shadow-2xs cursor-pointer"
              >
                {outletList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nama}
                  </option>
                ))}
              </select>
              <Store className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}

          {/* Segmented Filter Periode */}
          <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200/80 shrink-0">
            {(
              [
                { id: 'hari', label: 'Hari Ini' },
                { id: '7hari', label: '7 Hari' },
                { id: '30hari', label: '30 Hari' },
                { id: 'bulan', label: 'Bulan Ini' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriode(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  periode === tab.id
                    ? 'bg-white text-stone-900 shadow-2xs'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tombol Ekspor CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={isLoading || !transaksiList.length}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 active:bg-black text-white text-xs font-bold shadow-xs transition disabled:opacity-50 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Warning Truncated Limit 500 Transaksi */}
      {isTruncated && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Data dibatasi 500 transaksi per outlet pada periode ini. Persempit periode untuk akurasi penuh.</span>
        </div>
      )}

      {/* Panel Error State */}
      {errorMessage ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Gagal Memuat Laporan Finansial</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">{errorMessage}</p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={fetchLaporanData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-xs transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        </div>
      ) : isLoading ? (
        /* Skeleton Loading State */
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs animate-pulse space-y-3">
                <div className="h-4 bg-stone-200 rounded w-1/2" />
                <div className="h-7 bg-stone-200 rounded w-3/4" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs animate-pulse h-64" />
            <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs animate-pulse h-64" />
          </div>
        </div>
      ) : !agregasi ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-xs">
          <Store className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-stone-800">Data Laporan Tidak Tersedia</h3>
          <p className="text-xs text-stone-500 mt-1">Pilih outlet yang memiliki transaksi aktif.</p>
        </div>
      ) : (
        /* Data Display */
        <div className="space-y-6">
          {/* Card Finansial Utama (5 Kartu) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {/* Omzet */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Total Omzet
                </span>
                <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-stone-900 mt-2 truncate">
                {formatRupiah(agregasi.omzet)}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                {agregasi.totalTrx} transaksi berhasil
              </p>
            </div>

            {/* Total HPP */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Total HPP
                </span>
                <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-stone-800 mt-2 truncate">
                {formatRupiah(agregasi.totalHpp)}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Biaya pokok resep menu</p>
            </div>

            {/* Laba Kotor */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Laba Kotor
                </span>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-700 mt-2 truncate">
                {formatRupiah(agregasi.labaKotor)}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Omzet dikurangi total HPP</p>
            </div>

            {/* Margin Kotor */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Margin Kotor
                </span>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Percent className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-stone-900 mt-2">
                {agregasi.marginPersen}%
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Laba kotor / omzet</p>
            </div>

            {/* Belanja Bahan */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition col-span-2 md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Belanja Bahan
                </span>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-amber-700 mt-2 truncate">
                {formatRupiah(belanjaBahan)}
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Pengeluaran beli bahan</p>
            </div>
          </div>

          {/* Section Tengah: Grafik Batang CSS 7 Hari Terakhir & Ringkasan Performa */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Grafik Batang Omzet Harian (div/CSS murni) */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-stone-900">
                    Tren Omzet 7 Hari Terakhir
                  </h2>
                  <p className="text-[11px] text-stone-400">
                    Aktivitas penjualan per hari dalam waktu lokal perangkat
                  </p>
                </div>
                <span className="text-[10px] bg-stone-100 text-stone-600 font-bold px-2 py-0.5 rounded">
                  Max: {formatRupiah(maxOmzet7Hari)}
                </span>
              </div>

              {/* Area Batang CSS Vertikal */}
              <div className="pt-6 pb-2">
                <div className="h-44 sm:h-52 flex items-end justify-between gap-2 sm:gap-4 px-1">
                  {trend7Hari.map((day) => {
                    const heightPercent =
                      maxOmzet7Hari > 0 && day.omzet > 0
                        ? Math.max(8, Math.round((day.omzet / maxOmzet7Hari) * 100))
                        : 4;

                    const hasOmzet = day.omzet > 0;

                    return (
                      <div
                        key={day.tanggalLokal}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                      >
                        {/* Tooltip Hover/Touch */}
                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-150 pointer-events-none z-10 bg-stone-900 text-white text-[10px] rounded-lg py-1 px-2 whitespace-nowrap shadow-md text-center">
                          <div className="font-bold">{formatRupiah(day.omzet)}</div>
                          <div className="text-stone-400 text-[9px]">{day.totalTrx} transaksi</div>
                        </div>

                        {/* Batang CSS */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[42px] rounded-t-lg transition-all duration-300 ${
                            hasOmzet
                              ? 'bg-orange-500 group-hover:bg-orange-600 shadow-2xs'
                              : 'bg-stone-100 group-hover:bg-stone-200'
                          }`}
                        />

                        {/* Label Tanggal Bawah */}
                        <div className="mt-2 text-center">
                          <span className="block text-[10px] font-semibold text-stone-600 group-hover:text-stone-900 truncate">
                            {day.tanggalLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rekap Singkat Periode */}
            <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs flex flex-col justify-between">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-stone-900 pb-3 border-b border-stone-100">
                  Ringkasan Rasio Bisnis
                </h2>
                <div className="divide-y divide-stone-100 text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-stone-500">Rata-rata Nilai Transaksi</span>
                    <span className="font-bold text-stone-900">
                      {agregasi.totalTrx > 0
                        ? formatRupiah(Math.round(agregasi.omzet / agregasi.totalTrx))
                        : 'Rp0'}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-stone-500">Rasio HPP terhadap Omzet</span>
                    <span className="font-bold text-stone-900">
                      {agregasi.omzet > 0
                        ? `${Number(((agregasi.totalHpp / agregasi.omzet) * 100).toFixed(1))}%`
                        : '0%'}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-stone-500">Total Belanja Bahan</span>
                    <span className="font-bold text-amber-700">
                      {formatRupiah(belanjaBahan)}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-stone-500">Jumlah Menu Terjual</span>
                    <span className="font-bold text-stone-900">
                      {agregasi.perProduk.reduce((acc, p) => acc + p.qty, 0)} porsi/item
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-500 leading-relaxed">
                * HPP dihitung langsung dari snapshot racikan resep saat transaksi dibayar di kasir POS.
              </div>
            </div>
          </div>

          {/* Tabel Produk Terlaris (Maksimal 10 Baris) */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <UtensilsCrossed className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-stone-900">
                    Produk Terlaris
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    10 produk dengan kontribusi omzet dan laba tertinggi pada periode terpilih
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-stone-500">
                {Math.min(agregasi.perProduk.length, 10)} dari {agregasi.perProduk.length} menu
              </span>
            </div>

            {agregasi.perProduk.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">
                Belum ada produk yang terjual pada periode ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-stone-100/70 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
                      <th className="py-3 px-4 w-12 text-center">#</th>
                      <th className="py-3 px-4">Nama Produk</th>
                      <th className="py-3 px-4 text-center">Terjual (Qty)</th>
                      <th className="py-3 px-4 text-right">Total Omzet</th>
                      <th className="py-3 px-4 text-right">Laba Kotor</th>
                      <th className="py-3 px-4 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-stone-700">
                    {agregasi.perProduk.slice(0, 10).map((prod, idx) => (
                      <tr key={prod.nama} className="hover:bg-stone-50/80 transition">
                        <td className="py-3 px-4 text-center font-bold text-stone-400">
                          {idx + 1}
                        </td>
                        <td className="py-3 px-4 font-bold text-stone-900">
                          {prod.nama}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold text-stone-800">
                          {prod.qty}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-stone-900">
                          {formatRupiah(prod.omzet)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-emerald-700">
                          {formatRupiah(prod.laba)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                              prod.marginPersen >= 40
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : prod.marginPersen >= 20
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-stone-50 text-stone-600 border-stone-200'
                            }`}
                          >
                            {prod.marginPersen}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
