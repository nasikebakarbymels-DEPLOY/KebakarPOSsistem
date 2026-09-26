import React from 'react';
import { Produk, PosViewMode } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { Plus, Tag } from 'lucide-react';

interface PosProductCardProps {
  produk: Produk;
  viewMode: PosViewMode;
  inCartQty?: number;
  onAddToCart: (produk: Produk) => void;
}

export const PosProductCard: React.FC<PosProductCardProps> = ({
  produk,
  viewMode,
  inCartQty = 0,
  onAddToCart,
}) => {
  const inisial = produk.nama
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  if (viewMode === 'list') {
    return (
      <button
        type="button"
        id={`pos-item-list-${produk.id}`}
        onClick={() => onAddToCart(produk)}
        className="w-full text-left bg-white p-3.5 rounded-2xl border border-stone-200/80 hover:border-orange-300 hover:shadow-md transition-all flex items-center justify-between gap-3 group active:scale-[0.99] touch-manipulation"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm shrink-0 border border-orange-200 group-hover:scale-105 transition-transform">
            {inisial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-stone-900 text-sm truncate">
                {produk.nama}
              </span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                {produk.kategori}
              </span>
            </div>
            {produk.sku && (
              <p className="text-xs text-stone-400 mt-0.5 font-mono flex items-center gap-1">
                <Tag className="w-3 h-3" />
                SKU: {produk.sku}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="font-extrabold text-base text-stone-900">
              {formatRupiah(produk.hargaJual)}
            </p>
            {inCartQty > 0 && (
              <span className="text-[11px] font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full inline-block mt-0.5 border border-orange-200">
                {inCartQty} di keranjang
              </span>
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-stone-100 text-stone-700 group-hover:bg-orange-600 group-hover:text-white flex items-center justify-center transition-colors shadow-xs">
            <Plus className="w-4 h-4" />
          </div>
        </div>
      </button>
    );
  }

  // Grid Mode
  return (
    <button
      type="button"
      id={`pos-item-grid-${produk.id}`}
      onClick={() => onAddToCart(produk)}
      className="relative text-left bg-white p-3.5 rounded-2xl border border-stone-200/80 hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between group active:scale-[0.98] touch-manipulation min-h-[140px]"
    >
      {/* Badge in-cart */}
      {inCartQty > 0 && (
        <div className="absolute top-2.5 right-2.5 bg-orange-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white z-10 animate-in fade-in zoom-in-75">
          {inCartQty}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs shrink-0 border border-orange-200 group-hover:scale-105 transition-transform">
            {inisial}
          </div>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 truncate max-w-[100px]">
            {produk.kategori}
          </span>
        </div>

        <h4 className="font-semibold text-stone-900 text-sm line-clamp-2 leading-snug group-hover:text-orange-950">
          {produk.nama}
        </h4>
        {produk.sku && (
          <p className="text-[11px] text-stone-400 font-mono mt-0.5 truncate">
            {produk.sku}
          </p>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
        <span className="font-extrabold text-base text-stone-900">
          {formatRupiah(produk.hargaJual)}
        </span>
        <div className="w-7 h-7 rounded-lg bg-stone-100 text-stone-600 group-hover:bg-orange-600 group-hover:text-white flex items-center justify-center transition-colors">
          <Plus className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
};
