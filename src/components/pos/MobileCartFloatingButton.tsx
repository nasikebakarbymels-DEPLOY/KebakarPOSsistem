import React from 'react';
import { ShoppingBag, ChevronUp } from 'lucide-react';
import { formatRupiah } from '../../utils/formatters';

interface MobileCartFloatingButtonProps {
  totalItems: number;
  totalAkhir: number;
  onClick: () => void;
}

export const MobileCartFloatingButton: React.FC<MobileCartFloatingButtonProps> = ({
  totalItems,
  totalAkhir,
  onClick,
}) => {
  if (totalItems <= 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-30 md:hidden animate-in slide-in-from-bottom-5 duration-200">
      <button
        type="button"
        id="pos-mobile-cart-button"
        onClick={onClick}
        className="w-full bg-stone-900 text-white p-3.5 rounded-2xl shadow-xl hover:bg-stone-800 transition-all flex items-center justify-between active:scale-[0.98] border border-stone-800 touch-manipulation ring-2 ring-orange-500/20"
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <span className="absolute -top-1.5 -right-1.5 bg-white text-orange-600 font-extrabold text-[11px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-stone-900 shadow-sm">
              {totalItems}
            </span>
          </div>
          <div className="text-left">
            <p className="text-xs text-stone-400 font-medium">Keranjang Pesanan</p>
            <p className="font-extrabold text-base text-white">
              {formatRupiah(totalAkhir)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-orange-400 text-xs font-bold pl-3 border-l border-stone-800">
          <span>Lihat Pesanan</span>
          <ChevronUp className="w-4 h-4 animate-bounce" />
        </div>
      </button>
    </div>
  );
};
