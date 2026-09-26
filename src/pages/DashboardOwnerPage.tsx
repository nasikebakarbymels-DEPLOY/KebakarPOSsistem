import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  Wallet,
  Percent,
  Receipt,
  ArrowDownCircle,
  RefreshCw,
  ShoppingBag,
  ArrowRight,
  Sparkles,
  Store,
  Calendar,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Transaksi, Pengeluaran, PerformaProdukItem } from '../types';
import { transaksiService } from '../services/transaksiService';
import { pengeluaranService } from '../services/pengeluaranService';
import {
  laporanService,
  TrenHarianItem,
  getLocalTodayString,
} from '../services/laporanService';
import { formatRupiah, formatTanggalIndo } from '../utils/formatters';
import { ChartTren7Hari } from '../components/dashboard/ChartTren7Hari';
import { TopProdukWidget } from '../components/dashboard/TopProdukWidget';

interface DashboardOwnerPageProps {
  onNavigateToKasir: () => void;
  onNavigateToLaporan: () => void;
}

export const DashboardOwnerPage: React.FC<DashboardOwnerPageProps> = ({
  onNavigateToKasir,
  onNavigateToLaporan,
}) => {
  const { user, currentOutlet } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [allTransaksi, setAllTransaksi] = useState<Transaksi[]>([]);
  const [allPengeluaran, setAllPengeluaran] = useState<Pengeluaran[]>([]);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Muat data untuk outlet aktif
  const loadDashboardData = useCallback(async () => {
    if (!currentOutlet?.id) return;
    setIsLoading(true);
    try {
      const [txList, expList] = await Promise.all([
        transaksiService.getTransaksiByOutlet(currentOutlet.id),
        pengeluaranService.getPengeluaranByOutlet(currentOutlet.id),
      ]);
      setAllTransaksi(txList);
      setAllPengeluaran(expList);
      setPendingSyncCount(transaksiService.getPendingCountSync(currentOutlet.id));
    } catch (err) {
      console.error('Gagal memuat data dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Reaktivitas terhadap perubahan transaksi dan pengeluaran
  useEffect(() => {
    const handleDataUpdate = () => {
      loadDashboardData();
    };

    window.addEventListener('pos_fnb_transaksi_updated', handleDataUpdate);
    window.addEventListener('pos_fnb_pengeluaran_updated', handleDataUpdate);
    window.addEventListener('pos_fnb_outlet_switched', handleDataUpdate);

    return () => {
      window.removeEventListener('pos_fnb_transaksi_updated', handleDataUpdate);
      window.removeEventListener('pos_fnb_pengeluaran_updated', handleDataUpdate);
      window.removeEventListener('pos_fnb_outlet_switched', handleDataUpdate);
    };
  }, [loadDashboardData]);

  // Kalkulasi KPI Hari Ini
  const txHariIni = laporanService.filterPeriode(allTransaksi, 'hari_ini');
  const expHariIni = laporanService.filterPeriode(allPengeluaran, 'hari_ini');
  const kpiHariIni = laporanService.hitungLabaRugi(txHariIni, expHariIni);

  // Kalkulasi Tren 7 Hari Terakhir
  const tren7Hari: TrenHarianItem[] = laporanService.hitungTren7Hari(
    allTransaksi,
    allPengeluaran
  );

  // Kalkulasi Top Produk 7 Hari Terakhir
  const tx7Hari = laporanService.filterPeriode(allTransaksi, '7_hari');
  const produkSummary7Hari = laporanService.ringkasanPerProduk(tx7Hari);

  // 1. Top 5 Terlaris (berdasarkan qtyTerjual)
  const top5Terlaris: PerformaProdukItem[] = [...produkSummary7Hari]
    .filter((p) => p.qtyTerjual > 0)
    .sort((a, b) => b.qtyTerjual - a.qtyTerjual)
    .slice(0, 5);

  // 2. Top 5 Margin Terbaik (filter margin > 0 dan qty > 0, urut margin)
  const top5Margin: PerformaProdukItem[] = [...produkSummary7Hari]
    .filter((p) => p.margin > 0 && p.qtyTerjual > 0)
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 5);

  const todayStr = getLocalTodayString();
  const totalSemuaTransaksi = allTransaksi.length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4 max-w-5xl mx-auto">
        <div className="h-14 bg-stone-200/70 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-stone-200/70 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-stone-200/70 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-4 sm:space-y-6 pb-24">
      {/* Header Beranda */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] bg-orange-600/80 text-orange-100 font-bold px-2 py-0.5 rounded-full">
              <Store className="w-3 h-3" />
              {currentOutlet?.nama || 'Outlet F&B'}
            </span>
            <span className="text-stone-400 text-xs">•</span>
            <span className="text-stone-300 text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3 text-stone-400" />
              {formatTanggalIndo(todayStr)}
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            Selamat Datang, {user?.nama || 'Owner'}
          </h1>
          <p className="text-xs text-stone-300">
            Berikut ringkasan performa penjualan dan profitabilitas outlet hari ini.
          </p>
        </div>

        {/* Quick Action Button */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onNavigateToKasir}
            className="flex-1 sm:flex-none px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Buka Kasir</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Hari Ini) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Performa Hari Ini
          </h2>
          <span className="text-[11px] text-stone-400">Pembaruan Realtime</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5">
          {/* 1. Omzet Bersih */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">Omzet Bersih</span>
              <div className="w-7 h-7 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-base sm:text-xl font-black text-stone-900 truncate">
                {formatRupiah(kpiHariIni.pendapatanBersih)}
              </div>
              <p className="text-[10.5px] text-stone-500 mt-0.5">
                Kotor {formatRupiah(kpiHariIni.pendapatanKotor)}
              </p>
            </div>
          </div>

          {/* 2. Laba Bersih */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">Laba Bersih</span>
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                  kpiHariIni.labaBersih >= 0
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                }`}
              >
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div
                className={`text-base sm:text-xl font-black truncate ${
                  kpiHariIni.labaBersih >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }`}
              >
                {formatRupiah(kpiHariIni.labaBersih)}
              </div>
              <p className="text-[10.5px] text-stone-500 mt-0.5">
                Laba Kotor {formatRupiah(kpiHariIni.labaKotor)}
              </p>
            </div>
          </div>

          {/* 3. Margin Bersih */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">Margin Bersih</span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-base sm:text-xl font-black text-stone-900 truncate">
                {kpiHariIni.marginBersih}%
              </div>
              <p className="text-[10.5px] text-stone-500 mt-0.5">
                Margin Kotor {kpiHariIni.marginKotor}%
              </p>
            </div>
          </div>

          {/* 4. Jumlah Transaksi */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">Total Transaksi</span>
              <div className="w-7 h-7 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-base sm:text-xl font-black text-stone-900 truncate">
                {kpiHariIni.jumlahTransaksi}{' '}
                <span className="text-xs font-semibold text-stone-500">pesanan</span>
              </div>
              <p className="text-[10.5px] text-stone-500 mt-0.5">
                Rata-rata {formatRupiah(kpiHariIni.rataRataTransaksi)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Cards: Pengeluaran Hari Ini & Antrean Sync */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5">
        {/* Total Pengeluaran Hari Ini */}
        <div
          onClick={onNavigateToLaporan}
          className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between cursor-pointer hover:border-orange-300 transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowDownCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-stone-500 font-bold">
                Pengeluaran Operasional Hari Ini
              </div>
              <div className="text-base font-black text-stone-900">
                {formatRupiah(kpiHariIni.totalPengeluaran)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-orange-600 group-hover:translate-x-0.5 transition-transform">
            <span>Rincian</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Antrean Sync */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                pendingSyncCount > 0
                  ? 'bg-amber-100 text-amber-700 animate-pulse'
                  : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-stone-500 font-bold">Status Sinkronisasi</div>
              <div className="text-base font-black text-stone-900">
                {pendingSyncCount > 0
                  ? `${pendingSyncCount} Transaksi Pending`
                  : 'Semua Transaksi Tersinkron'}
              </div>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              pendingSyncCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {pendingSyncCount > 0 ? 'Perlu Sync' : 'Aman'}
          </span>
        </div>
      </div>

      {/* Empty State jika belum ada transaksi sama sekali */}
      {totalSemuaTransaksi === 0 ? (
        <div className="bg-white rounded-3xl p-8 text-center border border-dashed border-stone-300 space-y-3 shadow-xs">
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mx-auto ring-8 ring-orange-50/50">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-extrabold text-stone-900">
              Belum Ada Transaksi Tercatat
            </h3>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">
              Mulai catat pesanan pelanggan di tab POS Kasir untuk melihat
              performa omzet, grafik tren harian, dan profitabilitas menu secara otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToKasir}
            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 active:scale-95"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Mulai Transaksi Pertama</span>
          </button>
        </div>
      ) : (
        <>
          {/* Chart Tren 7 Hari Terakhir */}
          <ChartTren7Hari data={tren7Hari} />

          {/* Widget Top Produk (7 Hari Terakhir) */}
          <TopProdukWidget topTerlaris={top5Terlaris} topMargin={top5Margin} />
        </>
      )}
    </div>
  );
};
