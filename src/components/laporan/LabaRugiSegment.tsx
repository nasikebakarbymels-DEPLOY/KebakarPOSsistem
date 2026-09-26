import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Tag,
  Package,
  Layers,
  ArrowDownRight,
  Info,
  Download,
  ShoppingBag,
} from 'lucide-react';
import { RingkasanLabaRugi } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { laporanService } from '../../services/laporanService';

interface LabaRugiSegmentProps {
  ringkasan: RingkasanLabaRugi;
  totalPembelianBahan: number;
  jumlahPembelianBahan: number;
  outletNama: string;
  periodeLabel: string;
}

export const LabaRugiSegment: React.FC<LabaRugiSegmentProps> = ({
  ringkasan,
  totalPembelianBahan,
  jumlahPembelianBahan,
  outletNama,
  periodeLabel,
}) => {
  const isLabaBersihPositif = ringkasan.labaBersih >= 0;
  const isLabaKotorPositif = ringkasan.labaKotor >= 0;

  const handleExportCsv = () => {
    const csvRows = [
      ['LAPORAN LABA RUGI OPERASIONAL F&B'],
      ['Outlet', `"${outletNama}"`],
      ['Periode', `"${periodeLabel}"`],
      ['Tanggal Unduh', `"${new Date().toLocaleString('id-ID')}"`],
      [],
      ['Komponen Finansial', 'Nominal (Rp)', 'Keterangan'],
      ['Pendapatan Kotor (Subtotal Menu)', ringkasan.pendapatanKotor, 'Total harga jual kotor sebelum diskon'],
      ['Total Potongan & Diskon', -ringkasan.totalDiskon, 'Diskon per item + diskon total transaksi'],
      ['Pendapatan Bersih (Omzet Penjualan)', ringkasan.pendapatanBersih, 'Total penerimaan penjualan aktual'],
      ['Total HPP (Snapshot Resep Bahan)', -ringkasan.totalHpp, 'Beban pokok penjualan dari resep bahan terpakai'],
      ['LABA KOTOR', ringkasan.labaKotor, `Margin Kotor: ${ringkasan.marginKotor}%`],
      ['Total Pengeluaran Operasional', -ringkasan.totalPengeluaran, 'Sewa, listrik, air, gaji, marketing, dll (non-bahan)'],
      ['LABA BERSIH', ringkasan.labaBersih, `Margin Bersih: ${ringkasan.marginBersih}%`],
      [],
      ['INFORMASI ARUS KAS (DILUAR LABA RUGI)'],
      ['Pembelian Bahan Baku (Arus Kas Keluar)', totalPembelianBahan, `${jumlahPembelianBahan} transaksi pembelian (tidak mengurangi laba, biaya telah dihitung lewat HPP)`],
      [],
      ['RINGKASAN OPERASIONAL'],
      ['Jumlah Transaksi', ringkasan.jumlahTransaksi, 'Struk transaksi selesai'],
      ['Rata-rata Nilai Transaksi (Basket Size)', ringkasan.rataRataTransaksi, 'Rata-rata omzet per transaksi'],
    ];

    const csvContent = csvRows
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const cleanOutletName = outletNama.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cleanPeriode = periodeLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `laporan_laba_rugi_${cleanOutletName}_${cleanPeriode}.csv`;

    laporanService.downloadCsv(filename, csvContent);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner Action */}
      <div className="flex items-center justify-between bg-white rounded-2xl p-4 border border-stone-200 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-stone-900">
            Ikhtisar Laba Rugi — {periodeLabel}
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            {ringkasan.jumlahTransaksi} transaksi penjualan diselesaikan
          </p>
        </div>
        <button
          id="btn-export-laba-rugi-csv"
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors"
        >
          <Download className="w-4 h-4 text-stone-600" />
          Export CSV
        </button>
      </div>

      {/* Hero Cards: Laba Kotor & Laba Bersih */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Laba Kotor */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Laba Kotor
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isLabaKotorPositif
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              Margin: {ringkasan.marginKotor}%
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                isLabaKotorPositif ? 'text-stone-900' : 'text-red-600'
              }`}
            >
              {formatRupiah(ringkasan.labaKotor)}
            </div>
            <p className="text-xs text-stone-400 mt-1">
              Pendapatan Bersih dikurangi Total HPP Resep
            </p>
          </div>
        </div>

        {/* Laba Bersih */}
        <div
          className={`rounded-2xl p-5 border shadow-xs flex flex-col justify-between ${
            isLabaBersihPositif
              ? 'bg-stone-900 text-white border-stone-800'
              : 'bg-red-50 text-red-950 border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isLabaBersihPositif ? 'text-stone-300' : 'text-red-700'
              }`}
            >
              Laba Bersih
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isLabaBersihPositif
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-red-200 text-red-900'
              }`}
            >
              Margin: {ringkasan.marginBersih}%
            </span>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl sm:text-3xl font-bold tracking-tight ${
                isLabaBersihPositif ? 'text-white' : 'text-red-600'
              }`}
            >
              {formatRupiah(ringkasan.labaBersih)}
            </div>
            <p
              className={`text-xs mt-1 ${
                isLabaBersihPositif ? 'text-stone-400' : 'text-red-700'
              }`}
            >
              Laba Kotor dikurangi Total Pengeluaran Operasional
            </p>
          </div>
        </div>
      </div>

      {/* Rincian Komponen Keuangan Berurutan */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-xs">
        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-4">
          Struktur Perhitungan Laba Rugi
        </h4>

        <div className="space-y-3">
          {/* 1. Pendapatan Kotor */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-800 block">
                  1. Pendapatan Kotor (Subtotal)
                </span>
                <span className="text-[11px] text-stone-500">
                  Total harga jual seluruh pesanan sebelum potongan
                </span>
              </div>
            </div>
            <span className="text-sm font-bold text-stone-900">
              {formatRupiah(ringkasan.pendapatanKotor)}
            </span>
          </div>

          {/* 2. Diskon */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-800 block">
                  2. Total Diskon & Potongan
                </span>
                <span className="text-[11px] text-stone-500">
                  Diskon per item menu dan diskon nominal transaksi
                </span>
              </div>
            </div>
            <span className="text-sm font-bold text-orange-600">
              -{formatRupiah(ringkasan.totalDiskon)}
            </span>
          </div>

          {/* 3. Pendapatan Bersih (Omzet) */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-900 block">
                  3. Pendapatan Bersih (Omzet Penjualan)
                </span>
                <span className="text-[11px] text-emerald-700">
                  Akumulasi total tagihan akhir transaksi
                </span>
              </div>
            </div>
            <span className="text-sm font-bold text-emerald-800">
              {formatRupiah(ringkasan.pendapatanBersih)}
            </span>
          </div>

          {/* 4. Total HPP */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-800 block">
                  4. Total HPP Resep Terpakai
                </span>
                <span className="text-[11px] text-stone-500">
                  Biaya bahan pemakaian aktual dari snapshot resep
                </span>
              </div>
            </div>
            <span className="text-sm font-bold text-stone-900">
              -{formatRupiah(ringkasan.totalHpp)}
            </span>
          </div>

          {/* Subtotal: Laba Kotor */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-100 border border-stone-200 font-bold">
            <span className="text-xs text-stone-800">
              = Laba Kotor (Omzet - HPP)
            </span>
            <div className="text-right">
              <span className="text-sm text-stone-900">
                {formatRupiah(ringkasan.labaKotor)}
              </span>
              <span className="text-[11px] text-stone-500 ml-2 font-normal">
                ({ringkasan.marginKotor}%)
              </span>
            </div>
          </div>

          {/* 5. Total Pengeluaran Operasional */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-stone-800 block">
                  5. Total Pengeluaran Operasional
                </span>
                <span className="text-[11px] text-stone-500">
                  Biaya sewa, listrik, air, gaji, kemasan, marketing, dll
                </span>
              </div>
            </div>
            <span className="text-sm font-bold text-red-600">
              -{formatRupiah(ringkasan.totalPengeluaran)}
            </span>
          </div>

          {/* Final: Laba Bersih */}
          <div
            className={`flex items-center justify-between p-3.5 rounded-xl border ${
              isLabaBersihPositif
                ? 'bg-stone-900 text-white border-stone-800'
                : 'bg-red-100 text-red-950 border-red-200'
            }`}
          >
            <div>
              <span className="text-xs font-bold block">
                = Laba Bersih (Laba Kotor - Pengeluaran)
              </span>
              <span
                className={`text-[11px] ${
                  isLabaBersihPositif ? 'text-stone-300' : 'text-red-700'
                }`}
              >
                Profit bersih yang dihasilkan outlet
              </span>
            </div>
            <div className="text-right">
              <span className="text-base font-bold">
                {formatRupiah(ringkasan.labaBersih)}
              </span>
              <span
                className={`text-xs ml-2 ${
                  isLabaBersihPositif ? 'text-emerald-400' : 'text-red-800'
                }`}
              >
                ({ringkasan.marginBersih}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Kartu Informasi Arus Kas Pembelian Bahan Baku (Terpisah dari Laba Rugi) */}
      <div className="bg-amber-50/60 rounded-2xl p-4 sm:p-5 border border-amber-200/80 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Pembelian Bahan (arus kas, tidak masuk laba)
              </h4>
              <span className="text-xs font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full">
                {jumlahPembelianBahan} transaksi pembelian
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-amber-950 mt-1">
              {formatRupiah(totalPembelianBahan)}
            </div>
            <div className="flex items-start gap-1.5 mt-2 text-xs text-amber-900/90 leading-relaxed bg-amber-100/50 p-2.5 rounded-xl border border-amber-200/50">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Aturan Akuntansi:</strong> Biaya bahan baku diperhitungkan di laba rugi
                melalui <em>Total HPP Resep Terpakai</em> (biaya pemakaian saat pesanan dibuat).
                Pengeluaran kas pembelian bahan baku di atas adalah catatan arus kas keluar dan{' '}
                <strong>tidak dihitung dua kali</strong> pada laba bersih.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrik Pendukung */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs text-stone-500 font-medium">Jumlah Transaksi</div>
          <div className="text-lg font-bold text-stone-900 mt-1">
            {ringkasan.jumlahTransaksi} struk
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
          <div className="text-xs text-stone-500 font-medium">Rata-rata Transaksi</div>
          <div className="text-lg font-bold text-stone-900 mt-1">
            {formatRupiah(ringkasan.rataRataTransaksi)}
          </div>
        </div>
      </div>
    </div>
  );
};
