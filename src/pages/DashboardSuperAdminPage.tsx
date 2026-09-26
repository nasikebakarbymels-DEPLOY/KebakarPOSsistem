import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  TrendingUp,
  Receipt,
  Percent,
  Wallet,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Store,
  Inbox,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  laporanCloudService,
  PeriodeLaporanCloud,
  KonsolidasiGrupResult,
} from '../services/cloud/laporanCloudService';
import { formatRupiah } from '../utils/formatters';

interface DashboardSuperAdminPageProps {
  onNavigateToLaporan?: () => void;
}

export const DashboardSuperAdminPage: React.FC<DashboardSuperAdminPageProps> = () => {
  const { user } = useAuth();
  const [periode, setPeriode] = useState<PeriodeLaporanCloud>('hari');
  const [data, setData] = useState<KonsolidasiGrupResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchKonsolidasi = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await laporanCloudService.getKonsolidasiGrup(periode);
      setData(res);
    } catch (err: unknown) {
      console.error('[DashboardSuperAdmin] Gagal memuat data konsolidasi:', err);
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat memuat data dari server.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }, [periode]);

  useEffect(() => {
    fetchKonsolidasi();
  }, [fetchKonsolidasi]);

  // Guard Role Super Admin
  if (!user || user.role !== 'super_admin') {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 m-4 shadow-xs">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-stone-900">Akses Terbatas</h3>
        <p className="text-xs text-stone-500 mt-1">
          Halaman Dashboard Konsolidasi hanya dapat diakses oleh Super Admin.
        </p>
      </div>
    );
  }

  const hasTruncated = data?.perOutlet.some((o) => o.truncated) || false;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header & Segmented Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-stone-900">
              Dashboard Konsolidasi Grup
            </h1>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Ringkasan performa finansial dan transaksi dari seluruh cabang outlet secara agregat (read-only)
          </p>
        </div>

        {/* Segmented Filter Periode */}
        <div className="flex items-center p-1 bg-stone-100 rounded-xl border border-stone-200/80 self-start sm:self-auto shrink-0">
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
      </div>

      {/* Warning Truncated Limit */}
      {hasTruncated && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Data dibatasi 500 transaksi per outlet pada periode ini. Persempit periode untuk akurasi penuh.</span>
        </div>
      )}

      {/* Error State */}
      {errorMessage ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900">Gagal Memuat Data Konsolidasi</h3>
            <p className="text-xs text-stone-500 mt-1 max-w-md mx-auto">{errorMessage}</p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={fetchKonsolidasi}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-xs transition"
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
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs animate-pulse space-y-3">
            <div className="h-5 bg-stone-200 rounded w-1/4" />
            <div className="h-28 bg-stone-100 rounded" />
          </div>
        </div>
      ) : !data || data.perOutlet.length === 0 ? (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-3">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Belum Ada Outlet Terdaftar</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Tambahkan outlet pertama melalui menu Manajemen Outlet untuk mulai mengamati konsolidasi jaringan.
          </p>
        </div>
      ) : (
        /* Data Display */
        <div className="space-y-6">
          {/* Card Ringkasan Jaringan */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Omzet */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Total Omzet
                </span>
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-stone-900 mt-2">
                {formatRupiah(data.ringkasan.omzet)}
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Gabungan seluruh cabang</p>
            </div>

            {/* Total Transaksi */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Total Transaksi
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-stone-900 mt-2">
                {data.ringkasan.totalTrx.toLocaleString('id-ID')}
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
              <div className="text-lg sm:text-2xl font-black text-emerald-700 mt-2">
                {formatRupiah(data.ringkasan.labaKotor)}
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                HPP: {formatRupiah(data.ringkasan.totalHpp)}
              </p>
            </div>

            {/* Margin */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  Margin Rata-rata
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-stone-900 mt-2">
                {data.ringkasan.marginPersen}%
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Laba kotor terhadap omzet</p>
            </div>
          </div>

          {/* Tabel Performa Per Outlet */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-stone-900">
                  Performa Per Outlet
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Distribusi omzet, HPP, dan profitabilitas tiap cabang pada periode terpilih
                </p>
              </div>
              <span className="text-xs font-bold text-stone-500 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
                {data.perOutlet.length} Outlet
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-100/70 text-stone-600 font-bold uppercase tracking-wider border-b border-stone-200 text-[10px]">
                    <th className="py-3 px-4">Outlet</th>
                    <th className="py-3 px-4 text-center">Trx</th>
                    <th className="py-3 px-4 text-right">Omzet</th>
                    <th className="py-3 px-4 text-right">HPP</th>
                    <th className="py-3 px-4 text-right">Laba</th>
                    <th className="py-3 px-4 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-stone-700">
                  {data.perOutlet.map((row) => {
                    const isZero = row.totalTrx === 0;

                    return (
                      <tr key={row.outletId} className="hover:bg-stone-50/80 transition">
                        {/* Nama Outlet */}
                        <td className="py-3.5 px-4 font-bold text-stone-900">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>{row.nama}</span>
                            {row.truncated && (
                              <span
                                title="Mencapai batas 500 transaksi"
                                className="px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-800 font-bold"
                              >
                                Max 500
                              </span>
                            )}
                          </div>
                          {isZero && (
                            <span className="text-[10px] text-stone-400 font-normal block pl-5.5 italic">
                              belum ada transaksi periode ini
                            </span>
                          )}
                        </td>

                        {/* Jumlah Transaksi */}
                        <td className="py-3.5 px-4 text-center font-semibold text-stone-800">
                          {row.totalTrx}
                        </td>

                        {/* Omzet */}
                        <td className="py-3.5 px-4 text-right font-bold text-stone-900">
                          {formatRupiah(row.omzet)}
                        </td>

                        {/* HPP */}
                        <td className="py-3.5 px-4 text-right text-stone-600">
                          {formatRupiah(row.hpp)}
                        </td>

                        {/* Laba */}
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-700">
                          {formatRupiah(row.laba)}
                        </td>

                        {/* Margin */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                              row.marginPersen >= 40
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : row.marginPersen >= 20
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-stone-50 text-stone-600 border-stone-200'
                            }`}
                          >
                            {row.marginPersen}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
