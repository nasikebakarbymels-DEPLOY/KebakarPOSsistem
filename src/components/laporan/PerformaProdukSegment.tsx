import React from 'react';
import { Download, Package, Sparkles } from 'lucide-react';
import { PerformaProdukItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { laporanService } from '../../services/laporanService';

interface PerformaProdukSegmentProps {
  produkList: PerformaProdukItem[];
  outletNama: string;
  periodeLabel: string;
}

export const PerformaProdukSegment: React.FC<PerformaProdukSegmentProps> = ({
  produkList,
  outletNama,
  periodeLabel,
}) => {
  const totalQty = produkList.reduce((sum, item) => sum + item.qtyTerjual, 0);
  const totalOmzet = produkList.reduce((sum, item) => sum + item.omzetBersih, 0);
  const totalProfit = produkList.reduce((sum, item) => sum + item.profit, 0);

  const handleExportCsv = () => {
    const csvRows = [
      ['LAPORAN PERFORMA PENJUALAN PRODUK F&B'],
      ['Outlet', `"${outletNama}"`],
      ['Periode', `"${periodeLabel}"`],
      ['Tanggal Unduh', `"${new Date().toLocaleString('id-ID')}"`],
      [],
      ['No', 'Nama Produk', 'Tipe Item', 'Qty Terjual', 'Omzet Bersih (Rp)', 'Total HPP (Rp)', 'Profit Bersih (Rp)', 'Margin (%)'],
    ];

    produkList.forEach((item, idx) => {
      csvRows.push([
        String(idx + 1),
        `"${item.nama}"`,
        item.isDadakan ? '"Item Dadakan"' : '"Menu Katalog"',
        String(item.qtyTerjual),
        String(item.omzetBersih),
        String(item.totalHpp),
        String(item.profit),
        `"${item.margin}%"`,
      ]);
    });

    csvRows.push([]);
    csvRows.push([
      'TOTAL',
      '',
      '',
      String(totalQty),
      String(totalOmzet),
      String(totalOmzet - totalProfit),
      String(totalProfit),
      `"${totalOmzet > 0 ? ((totalProfit / totalOmzet) * 100).toFixed(1) : 0}%"`,
    ]);

    const csvContent = csvRows.map((r) => r.join(',')).join('\n');
    const cleanOutletName = outletNama.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const cleanPeriode = periodeLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `laporan_performa_produk_${cleanOutletName}_${cleanPeriode}.csv`;

    laporanService.downloadCsv(filename, csvContent);
  };

  return (
    <div className="space-y-4">
      {/* Header Ringkasan & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-stone-900">
            Performa Penjualan Menu & Produk
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Diurutkan dari menu penyumbang laba (profit) tertinggi ke terendah
          </p>
        </div>
        {produkList.length > 0 && (
          <button
            id="btn-export-performa-produk-csv"
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition-colors self-start sm:self-auto shrink-0"
          >
            <Download className="w-4 h-4 text-stone-600" />
            Export CSV
          </button>
        )}
      </div>

      {produkList.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-stone-800">
            Belum Ada Penjualan Produk
          </h4>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
            Tidak ada transaksi menu yang diselesaikan pada periode {periodeLabel}.
          </p>
        </div>
      ) : (
        <>
          {/* Tampilan Desktop: Tabel Lengkap */}
          <div className="hidden md:block bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-stone-50 text-stone-600 border-b border-stone-200 font-bold">
                    <th className="py-3 px-4">Nama Produk</th>
                    <th className="py-3 px-4 text-center">Terjual</th>
                    <th className="py-3 px-4 text-right">Omzet Bersih</th>
                    <th className="py-3 px-4 text-right">Total HPP</th>
                    <th className="py-3 px-4 text-right">Profit</th>
                    <th className="py-3 px-4 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {produkList.map((item, idx) => (
                    <tr
                      key={item.produkId || item.nama + idx}
                      className="hover:bg-stone-50/70 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-stone-900">
                            {item.nama}
                          </span>
                          {item.isDadakan && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                              <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                              Dadakan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-stone-800">
                        {item.qtyTerjual}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-stone-800">
                        {formatRupiah(item.omzetBersih)}
                      </td>
                      <td className="py-3 px-4 text-right text-stone-600">
                        {formatRupiah(item.totalHpp)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatRupiah(item.profit)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.margin >= 50
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.margin >= 30
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-stone-100 text-stone-700'
                          }`}
                        >
                          {item.margin}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-stone-50 font-bold text-stone-900 border-t border-stone-200">
                    <td className="py-3 px-4">Total ({produkList.length} menu)</td>
                    <td className="py-3 px-4 text-center">{totalQty}</td>
                    <td className="py-3 px-4 text-right">{formatRupiah(totalOmzet)}</td>
                    <td className="py-3 px-4 text-right">
                      {formatRupiah(totalOmzet - totalProfit)}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-800">
                      {formatRupiah(totalProfit)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {totalOmzet > 0
                        ? `${((totalProfit / totalOmzet) * 100).toFixed(1)}%`
                        : '0%'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Tampilan Mobile: Kartu Menu */}
          <div className="md:hidden space-y-2.5">
            {produkList.map((item, idx) => (
              <div
                key={item.produkId || item.nama + idx}
                className="bg-white rounded-xl p-3.5 border border-stone-200 shadow-xs space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-stone-900 text-sm block">
                      {item.nama}
                    </span>
                    <span className="text-xs text-stone-500">
                      Terjual {item.qtyTerjual} porsi / item
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.isDadakan && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                        Dadakan
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        item.margin >= 50
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.margin >= 30
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      {item.margin}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-100 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                      Omzet
                    </span>
                    <span className="font-semibold text-stone-800">
                      {formatRupiah(item.omzetBersih)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                      Total HPP
                    </span>
                    <span className="text-stone-600">
                      {formatRupiah(item.totalHpp)}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                      Profit
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatRupiah(item.profit)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
