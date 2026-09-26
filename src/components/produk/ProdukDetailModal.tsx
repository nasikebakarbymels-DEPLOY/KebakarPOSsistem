import React from 'react';
import {
  X,
  Layers,
  Utensils,
  Tag,
  AlertTriangle,
  Percent,
  TrendingUp,
  CornerDownRight,
  Edit2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Produk, Resep, KalkulasiHPP, ItemResepDetail } from '../../types';
import { formatRupiah, formatBiayaSatuan } from '../../utils/formatters';

interface ProdukDetailModalProps {
  isOpen: boolean;
  produk: Produk | null;
  kalkulasi: KalkulasiHPP | null;
  onClose: () => void;
  onEdit: (produk: Produk) => void;
}

export const ProdukDetailModal: React.FC<ProdukDetailModalProps> = ({
  isOpen,
  produk,
  kalkulasi,
  onClose,
  onEdit,
}) => {
  if (!isOpen || !produk || !kalkulasi) return null;

  const {
    hpp,
    marginPersen,
    estimasiProfit,
    isResepKosong,
    adaBahanTanpaBiaya,
    bahanTanpaBiayaList,
    itemsDetail,
  } = kalkulasi;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-600">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-900">{produk.nama}</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    produk.jenis === 'komponen'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {produk.jenis === 'komponen' ? 'Komponen' : 'Menu Jual'}
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Kategori: {produk.kategori} {produk.sku && `• SKU: ${produk.sku}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* Main Financial Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60 text-center">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Harga Jual
              </span>
              <span className="font-extrabold text-stone-900 text-sm font-mono block mt-0.5">
                {formatRupiah(produk.hargaJual)}
              </span>
            </div>

            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60 text-center">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Total HPP
              </span>
              <span className="font-extrabold text-orange-600 text-sm font-mono block mt-0.5">
                {formatRupiah(hpp)}
              </span>
            </div>

            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60 text-center">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Margin
              </span>
              <span
                className={`font-extrabold text-sm block mt-0.5 ${
                  marginPersen >= 50
                    ? 'text-emerald-600'
                    : marginPersen >= 30
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {isResepKosong ? '-' : `${marginPersen}%`}
              </span>
            </div>

            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/60 text-center">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                Profit
              </span>
              <span className="font-extrabold text-stone-800 text-sm font-mono block mt-0.5">
                {isResepKosong ? '-' : formatRupiah(estimasiProfit)}
              </span>
            </div>
          </div>

          {/* Warnings */}
          {isResepKosong && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Produk ini belum memiliki resep. Klik <b>Edit</b> untuk menambahkan bahan baku.
              </span>
            </div>
          )}

          {adaBahanTanpaBiaya && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Peringatan: Terdapat Bahan Belum Memiliki Biaya Acuan</span>
              </div>
              <p className="text-[11px] text-amber-700">
                Bahan berikut belum memiliki data harga beli:{' '}
                <b>{bahanTanpaBiayaList.join(', ')}</b>. HPP dihitung dari bahan lain yang sudah
                memiliki biaya.
              </p>
            </div>
          )}

          {/* Rincian Resep Multi-Level Tree */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-600" />
                Rincian Resep & Komposisi ({itemsDetail.length} Item Utama)
              </span>
              <span className="text-[11px] text-stone-400">Kedalaman: Maksimal 3 Level</span>
            </div>

            {itemsDetail.length === 0 ? (
              <div className="p-6 bg-stone-50 rounded-2xl text-center text-stone-400 font-medium">
                Resep masih kosong
              </div>
            ) : (
              <div className="space-y-2">
                {itemsDetail.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3 bg-stone-50/80 rounded-2xl border border-stone-200/80 space-y-2"
                  >
                    {/* Level 1 Item Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            item.tipe === 'komponen'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          Level {item.level} • {item.tipe === 'komponen' ? 'Komponen' : 'Bahan'}
                        </span>
                        <span className="font-bold text-stone-900 text-xs">{item.nama}</span>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-stone-900 text-xs">
                          {item.subtotalBiaya !== undefined
                            ? formatRupiah(item.subtotalBiaya)
                            : 'Belum ada biaya'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-stone-500 pl-1">
                      <span>
                        Takaran: <b>{item.qty.toLocaleString('id-ID')} {item.satuan}</b>
                      </span>
                      {item.biayaSatuan !== undefined && (
                        <span>
                          Biaya satuan: {formatBiayaSatuan(item.biayaSatuan, item.satuan)}
                        </span>
                      )}
                    </div>

                    {/* Sub-items (Level 2 / Level 3 if component) */}
                    {item.subItems && item.subItems.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-stone-200/60 pl-3 space-y-1.5 bg-white/60 p-2.5 rounded-xl border">
                        <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                          Komposisi Turunan Komponen "{item.nama}":
                        </span>
                        {item.subItems.map((sub, sIdx) => (
                          <div
                            key={sub.id || sIdx}
                            className="flex items-center justify-between text-[11px] py-1 border-b border-stone-100 last:border-b-0"
                          >
                            <span className="flex items-center gap-1.5 text-stone-700">
                              <CornerDownRight className="w-3 h-3 text-purple-500 shrink-0" />
                              <span className="font-semibold">{sub.nama}</span>
                              <span className="text-stone-400">
                                ({sub.qty} {sub.satuan})
                              </span>
                            </span>
                            <span className="font-mono text-stone-800 font-bold">
                              {sub.subtotalBiaya !== undefined
                                ? formatRupiah(sub.subtotalBiaya)
                                : 'Belum ada biaya'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Catatan Produk if any */}
          {produk.catatan && (
            <div className="pt-2 border-t border-stone-100">
              <span className="text-[11px] font-bold text-stone-500 block mb-1">
                Catatan Produk:
              </span>
              <p className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 text-stone-700 text-xs">
                {produk.catatan}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 p-4 border-t border-stone-100 bg-stone-50/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(produk);
            }}
            className="px-4 py-2.5 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs transition flex items-center justify-center gap-1.5"
          >
            <Edit2 className="w-4 h-4 text-orange-600" />
            <span>Edit Produk & Resep</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold transition text-xs"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
