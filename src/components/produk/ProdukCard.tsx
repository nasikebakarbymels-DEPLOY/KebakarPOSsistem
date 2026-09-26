import React from 'react';
import { Produk, Resep, Bahan, KalkulasiHPP } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { hitungHargaNeto } from '../../services/cloud/produkCloudService';
import {
  Tag,
  Layers,
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  TrendingUp,
  Percent,
} from 'lucide-react';

interface ProdukCardProps {
  produk: Produk;
  kalkulasi: KalkulasiHPP;
  onToggleStatus: (id: string) => void;
  onViewDetail: (produk: Produk) => void;
  onEdit: (produk: Produk) => void;
  onDelete: (produk: Produk) => void;
}

// Generate consistent initials from product name
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Color palette based on initials/category
function getAvatarBg(category: string): string {
  switch (category) {
    case 'Makanan':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Minuman':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'Snack':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'Paket':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-stone-100 text-stone-700 border-stone-200';
  }
}

export const ProdukCard: React.FC<ProdukCardProps> = ({
  produk,
  kalkulasi,
  onToggleStatus,
  onViewDetail,
  onEdit,
  onDelete,
}) => {
  const { hpp, marginPersen, estimasiProfit, isResepKosong, adaBahanTanpaBiaya } = kalkulasi;

  // Hitung diskon promo produk jika ada
  const { hargaNeto, diskonNominal } = hitungHargaNeto(produk.hargaJual, produk.diskonProduk);
  const hasPromoDiskon = Boolean(produk.diskonProduk && diskonNominal > 0);

  // Margin badge color
  const getMarginBadgeClass = (margin: number) => {
    if (margin >= 50) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    } else if (margin >= 30) {
      return 'bg-amber-50 text-amber-700 border-amber-200/80';
    } else {
      return 'bg-rose-50 text-rose-700 border-rose-200/80';
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all p-4 flex flex-col justify-between shadow-xs hover:border-orange-200 ${
        produk.aktif ? 'border-stone-200/80' : 'border-stone-200/50 opacity-75 bg-stone-50/50'
      }`}
    >
      {/* Top row: Avatar, Info, Badges */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Avatar Initials */}
            <div
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center font-extrabold text-sm shrink-0 shadow-2xs ${getAvatarBg(
                produk.kategori || ''
              )}`}
            >
              {getInitials(produk.nama)}
            </div>

            {/* Title & SKU */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-stone-900 text-sm leading-snug">{produk.nama}</h3>
                {!produk.aktif && (
                  <span className="text-[10px] bg-stone-200 text-stone-600 font-semibold px-1.5 py-0.2 rounded-md">
                    Nonaktif
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-stone-500 font-medium">{produk.kategori}</span>
                {produk.sku && (
                  <>
                    <span className="text-stone-300">•</span>
                    <span className="font-mono text-stone-400 text-[10px]">{produk.sku}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Jenis Badge & Status Toggle */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                produk.jenis === 'komponen'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              {produk.jenis === 'komponen' ? 'Komponen' : 'Menu Jual'}
            </span>

            {/* Status Toggle Button */}
            <button
              type="button"
              onClick={() => onToggleStatus(produk.id)}
              className={`p-1 rounded-lg transition ${
                produk.aktif
                  ? 'text-emerald-600 hover:bg-emerald-50'
                  : 'text-stone-400 hover:bg-stone-100'
              }`}
              title={produk.aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
            >
              {produk.aktif ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Pricing & HPP Grid */}
        <div className="mt-3.5 pt-3 border-t border-stone-100 grid grid-cols-2 gap-2 text-xs">
          {/* Harga Jual */}
          <div className="bg-stone-50/80 p-2 rounded-xl border border-stone-200/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
                Harga Jual
              </span>
              {hasPromoDiskon && (
                <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1 rounded">
                  {produk.diskonProduk?.tipe === 'persen' ? `-${produk.diskonProduk.nilai}%` : 'Diskon'}
                </span>
              )}
            </div>
            {hasPromoDiskon ? (
              <div className="flex items-baseline gap-1.5 flex-wrap mt-0.5">
                <span className="font-extrabold text-stone-900 text-sm font-mono">
                  {formatRupiah(hargaNeto)}
                </span>
                <span className="text-xs text-stone-400 line-through font-mono">
                  {formatRupiah(produk.hargaJual)}
                </span>
              </div>
            ) : (
              <span className="font-extrabold text-stone-900 text-sm font-mono">
                {formatRupiah(produk.hargaJual)}
              </span>
            )}
          </div>

          {/* HPP Live */}
          <div className="bg-stone-50/80 p-2 rounded-xl border border-stone-200/50">
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider block">
              HPP Resep
            </span>
            {isResepKosong ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60">
                <AlertTriangle className="w-3 h-3 text-amber-500" />
                Resep Kosong
              </span>
            ) : (
              <div>
                <span className="font-extrabold text-orange-600 text-sm font-mono">
                  {formatRupiah(hpp)}
                </span>
                {adaBahanTanpaBiaya && (
                  <span className="text-[9px] block text-amber-600 font-semibold">
                    *Ada bahan tanpa biaya
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Margin & Profit Row */}
        {!isResepKosong && (
          <div className="mt-2.5 flex items-center justify-between gap-2 text-xs bg-stone-50/40 p-2 rounded-xl border border-stone-100">
            <div className="flex items-center gap-1 text-[11px] text-stone-500">
              <TrendingUp className="w-3.5 h-3.5 text-stone-400" />
              <span>Profit:</span>
              <span className="font-bold text-stone-800">{formatRupiah(estimasiProfit)}</span>
            </div>

            <div
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border ${getMarginBadgeClass(
                marginPersen
              )}`}
            >
              <Percent className="w-3 h-3" />
              <span>{marginPersen}% Margin</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="mt-3.5 pt-2.5 border-t border-stone-100 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onViewDetail(produk)}
          className="text-xs font-bold text-stone-600 hover:text-orange-600 transition flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-stone-50"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Lihat Resep & HPP</span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(produk)}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition"
            title="Edit Produk & Resep"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(produk)}
            className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
            title="Hapus Produk"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
