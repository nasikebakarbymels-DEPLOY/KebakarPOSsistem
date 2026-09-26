import React from 'react';
import {
  Building2,
  TrendingUp,
  Download,
  ShieldCheck,
  Receipt,
  Store,
} from 'lucide-react';
import { Outlet, RingkasanLabaRugi } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { laporanService } from '../../services/laporanService';

export interface OutletKonsolidasiItem {
  outlet: Outlet;
  ringkasan: RingkasanLabaRugi;
  totalPembelianBahan: number;
}

interface KonsolidasiSuperAdminSegmentProps {
  dataPerOutlet: OutletKonsolidasiItem[];
  periodeLabel: string;
}

export const KonsolidasiSuperAdminSegment: React.FC<KonsolidasiSuperAdminSegmentProps> = ({
  dataPerOutlet,
  periodeLabel,
}) => {
  const totalOmzetJaringan = dataPerOutlet.reduce(
    (sum, item) => sum + item.ringkasan.pendapatanBersih,
    0
  );
  const totalHppJaringan = dataPerOutlet.reduce(
    (sum, item) => sum + item.ringkasan.totalHpp,
    0
  );
  const totalPengeluaranJaringan = dataPerOutlet.reduce(
    (sum, item) => sum + item.ringkasan.totalPengeluaran,
    0
  );
  const totalLabaBersihJaringan = dataPerOutlet.reduce(
    (sum, item) => sum + item.ringkasan.labaBersih,
    0
  );
  const totalTransaksiJaringan = dataPerOutlet.reduce(
    (sum, item) => sum + item.ringkasan.jumlahTransaksi,
    0
  );
  const totalMarginJaringan =
    totalOmzetJaringan > 0
      ? Number(((totalLabaBersihJaringan / totalOmzetJaringan) * 100).toFixed(1))
      : 0;

  const handleExportCsv = () => {
    const csvRows = [
      ['LAPORAN KONSOLIDASI SELURUH OUTLET F&B (SUPER ADMIN)'],
      ['Periode', `"${periodeLabel}"`],
      ['Sifat Laporan', '"Konsolidasi Grup - Read Only"'],
      ['Tanggal Unduh', `"${new Date().toLocaleString('id-ID')}"`],
      [],
      ['No', 'Nama Outlet', 'Kota / Alamat', 'Omzet Bersih (Rp)', 'Total HPP (Rp)', 'Pengeluaran (Rp)', 'Laba Bersih (Rp)', 'Margin Bersih (%)', 'Jumlah Transaksi'],
    ];

    dataPerOutlet.forEach((item, idx) => {
      csvRows.push([
        String(idx + 1),
        `"${item.outlet.nama}"`,
        `"${item.outlet.alamat}"`,
        String(item.ringkasan.pendapatanBersih),
        String(item.ringkasan.totalHpp),
        String(item.ringkasan.totalPengeluaran),
        String(item.ringkasan.labaBersih),
        `"${item.ringkasan.marginBersih}%"`,
        String(item.ringkasan.jumlahTransaksi),
      ]);
    });

    csvRows.push([]);
    csvRows.push([
      'TOTAL KONSOLIDASI',
      '',
      '',
      String(totalOmzetJaringan),
      String(totalHppJaringan),
      String(totalPengeluaranJaringan),
      String(totalLabaBersihJaringan),
      `"${totalMarginJaringan}%"`,
      String(totalTransaksiJaringan),
    ]);

    const csvContent = csvRows.map((r) => r.join(',')).join('\n');
    const cleanPeriode = periodeLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `laporan_konsolidasi_grup_${cleanPeriode}.csv`;

    laporanService.downloadCsv(filename, csvContent);
  };

  return (
    <div className="space-y-4">
      {/* Read-Only Status Banner */}
      <div className="flex items-center justify-between p-4 bg-stone-900 text-white rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm">Konsolidasi Seluruh Outlet</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-stone-900 uppercase tracking-wide">
                Read-Only
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-0.5">
              Super Admin memiliki hak lihat agregasi finansial tanpa izin modifikasi data harian
            </p>
          </div>
        </div>

        <button
          id="btn-export-konsolidasi-csv"
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Hero Metrik Konsolidasi Grup */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Omzet */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Total Omzet</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-stone-900">
            {formatRupiah(totalOmzetJaringan)}
          </div>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            Semua cabang outlet
          </span>
        </div>

        {/* Total Laba Bersih */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Laba Bersih</span>
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${
                totalLabaBersihJaringan >= 0
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {totalMarginJaringan}%
            </span>
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold ${
              totalLabaBersihJaringan >= 0 ? 'text-stone-900' : 'text-red-600'
            }`}
          >
            {formatRupiah(totalLabaBersihJaringan)}
          </div>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            Setelah HPP & pengeluaran
          </span>
        </div>

        {/* Total Transaksi */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Transaksi</span>
            <Receipt className="w-4 h-4 text-orange-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-stone-900">
            {totalTransaksiJaringan}
          </div>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            Struk selesai di kasir
          </span>
        </div>

        {/* Total Outlet Terdaftar */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-stone-500 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider">Cabang</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-stone-900">
            {dataPerOutlet.length}
          </div>
          <span className="text-[11px] text-stone-400 mt-0.5 block">
            Outlet beroperasi
          </span>
        </div>
      </div>

      {/* Tabel Konsolidasi Per Outlet */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex items-center justify-between">
          <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
            Rincian Kinerja Per Outlet ({periodeLabel})
          </h4>
          <span className="text-xs text-stone-400">
            {dataPerOutlet.length} outlet terdaftar
          </span>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-stone-50 text-stone-600 border-b border-stone-200 font-bold">
                <th className="py-3 px-4">Nama Outlet</th>
                <th className="py-3 px-4 text-center">Transaksi</th>
                <th className="py-3 px-4 text-right">Omzet Bersih</th>
                <th className="py-3 px-4 text-right">Total HPP</th>
                <th className="py-3 px-4 text-right">Pengeluaran</th>
                <th className="py-3 px-4 text-right">Laba Bersih</th>
                <th className="py-3 px-4 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {dataPerOutlet.map(({ outlet, ringkasan }) => (
                <tr key={outlet.id} className="hover:bg-stone-50/70 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                        <Store className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-bold text-stone-900 block">
                          {outlet.nama}
                        </span>
                        <span className="text-[11px] text-stone-400 truncate max-w-[200px] block">
                          {outlet.alamat}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-stone-800">
                    {ringkasan.jumlahTransaksi}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-stone-900">
                    {formatRupiah(ringkasan.pendapatanBersih)}
                  </td>
                  <td className="py-3 px-4 text-right text-stone-600">
                    {formatRupiah(ringkasan.totalHpp)}
                  </td>
                  <td className="py-3 px-4 text-right text-red-600">
                    {formatRupiah(ringkasan.totalPengeluaran)}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-bold ${
                      ringkasan.labaBersih >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {formatRupiah(ringkasan.labaBersih)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        ringkasan.marginBersih >= 30
                          ? 'bg-emerald-100 text-emerald-800'
                          : ringkasan.marginBersih >= 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {ringkasan.marginBersih}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-stone-50 font-bold text-stone-900 border-t border-stone-200">
                <td className="py-3 px-4">Konsolidasi Total</td>
                <td className="py-3 px-4 text-center">{totalTransaksiJaringan}</td>
                <td className="py-3 px-4 text-right">{formatRupiah(totalOmzetJaringan)}</td>
                <td className="py-3 px-4 text-right">{formatRupiah(totalHppJaringan)}</td>
                <td className="py-3 px-4 text-right text-red-600">
                  {formatRupiah(totalPengeluaranJaringan)}
                </td>
                <td className="py-3 px-4 text-right text-emerald-800">
                  {formatRupiah(totalLabaBersihJaringan)}
                </td>
                <td className="py-3 px-4 text-right">{totalMarginJaringan}%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="sm:hidden divide-y divide-stone-100 p-3 space-y-3">
          {dataPerOutlet.map(({ outlet, ringkasan }) => (
            <div key={outlet.id} className="p-3 bg-stone-50/70 rounded-xl space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-stone-900 text-sm block">
                    {outlet.nama}
                  </span>
                  <span className="text-xs text-stone-400">
                    {ringkasan.jumlahTransaksi} transaksi diselesaikan
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    ringkasan.marginBersih >= 0
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {ringkasan.marginBersih}%
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-200 text-xs">
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                    Omzet
                  </span>
                  <span className="font-semibold text-stone-800">
                    {formatRupiah(ringkasan.pendapatanBersih)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                    Pengeluaran
                  </span>
                  <span className="text-stone-600">
                    {formatRupiah(ringkasan.totalPengeluaran)}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                    Laba Bersih
                  </span>
                  <span
                    className={`font-bold ${
                      ringkasan.labaBersih >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {formatRupiah(ringkasan.labaBersih)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
