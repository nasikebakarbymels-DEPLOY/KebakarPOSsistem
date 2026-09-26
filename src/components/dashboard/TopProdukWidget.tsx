import React, { useState } from 'react';
import { PerformaProdukItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { Flame, Award, Percent, ShoppingBag, Sparkles } from 'lucide-react';

interface TopProdukWidgetProps {
  produkList?: PerformaProdukItem[];
  topTerlaris?: PerformaProdukItem[];
  topMargin?: PerformaProdukItem[];
}

export const TopProdukWidget: React.FC<TopProdukWidgetProps> = ({
  produkList,
  topTerlaris: propTopTerlaris,
  topMargin: propTopMargin,
}) => {
  const [activeTab, setActiveTab] = useState<'terlaris' | 'margin'>('terlaris');

  // Jika diberikan produkList, hitung otomatis topTerlaris dan topMargin
  const effectiveTopTerlaris: PerformaProdukItem[] =
    propTopTerlaris ??
    (produkList
      ? [...produkList]
          .filter((p) => p.qtyTerjual > 0)
          .sort((a, b) => b.qtyTerjual - a.qtyTerjual)
          .slice(0, 5)
      : []);

  const effectiveTopMargin: PerformaProdukItem[] =
    propTopMargin ??
    (produkList
      ? [...produkList]
          .filter((p) => p.margin > 0 && p.qtyTerjual > 0)
          .sort((a, b) => b.margin - a.margin)
          .slice(0, 5)
      : []);

  const topTerlaris = effectiveTopTerlaris;
  const topMargin = effectiveTopMargin;

  const renderRankingBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs flex items-center justify-center ring-2 ring-amber-300">
            1
          </span>
        );
      case 2:
        return (
          <span className="w-6 h-6 rounded-full bg-stone-200 text-stone-800 font-extrabold text-xs flex items-center justify-center ring-2 ring-stone-300">
            2
          </span>
        );
      case 3:
        return (
          <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-900 font-extrabold text-xs flex items-center justify-center ring-2 ring-orange-300">
            3
          </span>
        );
      default:
        return (
          <span className="w-6 h-6 rounded-full bg-stone-100 text-stone-500 font-bold text-xs flex items-center justify-center">
            {rank}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
      {/* Header Widget */}
      <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-stone-50/50">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base">
                Top Produk (7 Hari Terakhir)
              </h3>
              <p className="text-[11px] text-stone-500">
                Peringkat menu favorit dan profitabilitas tertinggi
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-stone-200/70 p-1 rounded-xl gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('terlaris')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'terlaris'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span>Terlaris</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('margin')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'margin'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Percent className="w-3.5 h-3.5 text-emerald-600" />
            <span>Margin Terbaik</span>
          </button>
        </div>
      </div>

      {/* Konten Daftar Item */}
      <div className="p-3 sm:p-4 divide-y divide-stone-100">
        {activeTab === 'terlaris' ? (
          topTerlaris.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-xs">
              <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Belum ada penjualan produk dalam 7 hari terakhir.
            </div>
          ) : (
            topTerlaris.map((item, idx) => (
              <div
                key={item.produkId || `terlaris_${idx}`}
                className="py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50/70 px-2 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {renderRankingBadge(idx + 1)}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                        {item.nama}
                      </span>
                      {item.isDadakan && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded-md">
                          <Sparkles className="w-2.5 h-2.5" /> Dadakan
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                      <span className="font-semibold text-stone-700">
                        {item.qtyTerjual} porsi
                      </span>
                      <span>•</span>
                      <span>Omzet {formatRupiah(item.omzetBersih)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-extrabold text-stone-900">
                    {formatRupiah(item.profit)}
                  </div>
                  <div className="mt-0.5">
                    <span
                      className={`inline-block px-1.5 py-0.2 text-[10px] font-bold rounded-md ${
                        item.margin >= 50
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.margin > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      Margin {item.margin}%
                    </span>
                  </div>
                </div>
              </div>
            ))
          )
        ) : topMargin.length === 0 ? (
          <div className="py-8 text-center text-stone-400 text-xs">
            <Percent className="w-8 h-8 mx-auto mb-2 opacity-40" />
            Belum ada produk dengan margin profit dalam 7 hari terakhir.
          </div>
        ) : (
          topMargin.map((item, idx) => (
            <div
              key={item.produkId || `margin_${idx}`}
              className="py-2.5 flex items-center justify-between gap-3 hover:bg-stone-50/70 px-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                {renderRankingBadge(idx + 1)}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-stone-900 text-xs sm:text-sm truncate">
                      {item.nama}
                    </span>
                    {item.isDadakan && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded-md">
                        <Sparkles className="w-2.5 h-2.5" /> Dadakan
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                    <span>Terjual {item.qtyTerjual}x</span>
                    <span>•</span>
                    <span>Profit {formatRupiah(item.profit)}</span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-0.5 px-2 py-1 text-xs font-black rounded-lg bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">
                  <Percent className="w-3 h-3 stroke-[2.5]" />
                  {item.margin}%
                </span>
                <div className="text-[10px] text-stone-400 mt-0.5">
                  HPP {formatRupiah(item.totalHpp)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
