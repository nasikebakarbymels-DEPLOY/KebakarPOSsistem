import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  Layers,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Edit2,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { Produk, Bahan } from '../../types';
import { hppCloudService, KalkulasiHPP, ItemHppDetail, HppCalculationCache } from '../../services/cloud/hppCloudService';
import { formatRupiah, formatBiayaSatuan } from '../../utils/formatters';

interface ProdukDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  produk: Produk | null;
  outletId: string;
  allBahan: Bahan[];
  allProduk: Produk[];
  onOpenEdit: (p: Produk) => void;
}

// Helper format biaya unit dengan desimal bila perlu (misal: Rp43,6/gram atau Rp43.600/porsi)
const formatBiayaUnit = (biaya: number, satuan: string): string => {
  if (!biaya || isNaN(biaya)) return `Rp0/${satuan}`;
  const isInteger = Number.isInteger(biaya);
  const formattedVal = isInteger
    ? Math.round(biaya).toLocaleString('id-ID')
    : Number(biaya.toFixed(1)).toLocaleString('id-ID', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
  return `Rp${formattedVal}/${satuan}`;
};

export const ProdukDetailModal: React.FC<ProdukDetailModalProps> = ({
  isOpen,
  onClose,
  produk,
  outletId,
  allBahan,
  allProduk,
  onOpenEdit,
}) => {
  const [kalkulasi, setKalkulasi] = useState<KalkulasiHPP | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const fetchDetailHpp = async () => {
      if (!isOpen || !produk) return;
      try {
        setLoading(true);
        const cache: HppCalculationCache = {
          bahanMap: new Map(allBahan.map((b) => [b.id, b])),
          produkMap: new Map(allProduk.map((p) => [p.id, p])),
        };

        const res = await hppCloudService.hitungHppProduk(outletId, produk.id, cache);
        if (!isCancelled) {
          setKalkulasi(res);
        }
      } catch (err) {
        console.error('[ProdukDetailModal] Gagal kalkulasi HPP:', err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchDetailHpp();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, produk, outletId, allBahan, allProduk]);

  if (!isOpen || !produk) return null;

  const margin = kalkulasi?.marginPersen ?? 0;
  const getMarginBadgeClass = (m: number) => {
    if (m >= 40) return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    if (m >= 20) return 'bg-amber-50 text-amber-700 border-amber-300';
    return 'bg-rose-50 text-rose-700 border-rose-300';
  };

  const renderItemDetailRow = (item: ItemHppDetail, isSub: boolean = false) => {
    return (
      <div
        key={item.id}
        className={`p-3 rounded-xl border transition ${
          isSub
            ? 'bg-stone-50/70 border-stone-200 ml-4 mt-2'
            : 'bg-white border-stone-200 shadow-2xs'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                item.tipe === 'bahan'
                  ? 'bg-orange-50 text-orange-600'
                  : 'bg-purple-50 text-purple-600'
              }`}
            >
              {item.tipe === 'bahan' ? (
                <Package className="w-3.5 h-3.5" />
              ) : (
                <Layers className="w-3.5 h-3.5" />
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-stone-900">{item.nama}</div>
              <div className="text-[11px] text-stone-500">
                Takaran: <span className="font-semibold text-stone-800">{item.jumlah} {item.satuan}</span>
                {' · '}
                <span>@ {formatBiayaUnit(item.biayaSatuan, item.satuan)}</span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-black text-stone-900">
              {formatRupiah(item.subtotalBiaya)}
            </div>
            {!item.hasBiaya && (
              <span className="text-[10px] text-amber-600 font-semibold block">
                Tanpa biaya
              </span>
            )}
          </div>
        </div>

        {/* Render sub-items jika ada (multi-level) */}
        {item.subItems && item.subItems.length > 0 && (
          <div className="mt-2 pt-2 border-t border-stone-100 space-y-1.5">
            <div className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">
              Komposisi Sub-Produk:
            </div>
            {item.subItems.map((sub) => renderItemDetailRow(sub, true))}
          </div>
        )}
      </div>
    );
  };

  const isKomponen = produk.jenis === 'komponen';
  const outputJumlah =
    produk.hasilProduksi && produk.hasilProduksi.jumlah > 0
      ? produk.hasilProduksi.jumlah
      : 1;
  const outputSatuan = produk.hasilProduksi?.satuan || 'porsi';
  const totalHpp = kalkulasi?.hpp || 0;
  const biayaPerSatuan = totalHpp / outputJumlah;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70 shrink-0">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-stone-900">{produk.nama}</h2>
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  isKomponen
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-stone-100 text-stone-700 border-stone-300'
                }`}
              >
                {isKomponen ? 'Komponen' : 'Menu Jual'}
              </span>
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                  produk.aktif
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-stone-100 text-stone-600 border-stone-200'
                }`}
              >
                {produk.aktif ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Kategori: <strong className="text-stone-700">{produk.kategori || 'Umum'}</strong>
              {produk.sku && <span> • SKU: {produk.sku}</span>}
              {produk.hasilProduksi && (
                <span> • Output Batch: <strong className="text-amber-700">{produk.hasilProduksi.jumlah} {produk.hasilProduksi.satuan}</strong></span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Kartu Ringkasan Finansial Produk */}
          <div className="bg-stone-900 text-white p-4 rounded-2xl shadow-sm space-y-3">
            <div className="text-xs font-bold text-stone-400 flex items-center justify-between">
              <span>{isKomponen ? 'Ringkasan Biaya Produksi Komponen' : 'Ringkasan HPP & Margin Produk'}</span>
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
            </div>

            {isKomponen ? (
              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-stone-800">
                <div>
                  <div className="text-[10px] text-stone-400">Total HPP Batch</div>
                  <div className="text-sm sm:text-base font-black text-orange-400 mt-0.5">
                    {loading ? '...' : formatRupiah(totalHpp)}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-stone-400">Output 1 Batch</div>
                  <div className="text-sm sm:text-base font-black text-amber-400 mt-0.5">
                    {outputJumlah} {outputSatuan}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-stone-400">Biaya per Satuan</div>
                  <div className="text-sm sm:text-base font-black text-emerald-400 mt-0.5">
                    {loading ? '...' : formatBiayaUnit(biayaPerSatuan, outputSatuan)}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-stone-800">
                  <div>
                    <div className="text-[10px] text-stone-400">Harga Jual</div>
                    <div className="text-sm sm:text-base font-black text-white mt-0.5">
                      {formatRupiah(produk.hargaJual)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-stone-400">Total HPP</div>
                    <div className="text-sm sm:text-base font-black text-orange-400 mt-0.5">
                      {loading ? '...' : formatRupiah(totalHpp)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] text-stone-400">Margin Laba</div>
                    <div className="mt-0.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-lg text-xs font-black border ${getMarginBadgeClass(
                          margin
                        )}`}
                      >
                        {loading ? '...' : `${margin}%`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-stone-800/80 flex items-center justify-between text-xs">
                  <span className="text-stone-400 font-medium">Estimasi Laba per Porsi:</span>
                  <span className="font-bold text-emerald-400">
                    {loading ? '...' : formatRupiah(kalkulasi?.estimasiProfit || 0)}
                  </span>
                </div>
              </>
            )}

            {kalkulasi?.adaBahanTanpaBiaya && (
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-[11px] text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  Ada bahan baku yang belum memiliki biaya acuan. Nilai HPP belum 100% lengkap.
                </div>
              </div>
            )}
          </div>

          {/* Baris Output Batch & Biaya per Satuan di atas pohon resep (khusus Komponen) */}
          {isKomponen && (
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-stone-700">
                <Package className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Output Batch:{' '}
                  <strong className="text-stone-900 font-bold">
                    {outputJumlah} {outputSatuan}
                  </strong>
                </span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-stone-500">Biaya per Satuan: </span>
                <strong className="text-emerald-700 font-black text-sm">
                  {formatBiayaUnit(biayaPerSatuan, outputSatuan)}
                </strong>
              </div>
            </div>
          )}

          {/* Rincian Resep */}
          <div>
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Rincian Takaran Resep ({kalkulasi?.itemsDetail?.length || 0} item)</span>
            </h3>

            {loading ? (
              <div className="p-6 text-center text-xs text-stone-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-600" />
                <p>Memuat rincian resep & HPP...</p>
              </div>
            ) : kalkulasi?.itemsDetail && kalkulasi.itemsDetail.length > 0 ? (
              <div className="space-y-2">
                {kalkulasi.itemsDetail.map((it) => renderItemDetailRow(it))}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 text-center text-xs text-stone-500">
                Menu ini belum memiliki susunan takaran resep.
              </div>
            )}
          </div>

          {/* Catatan jika ada */}
          {produk.catatan && (
            <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
              <div className="font-bold text-stone-700 mb-0.5">Catatan Menu:</div>
              <p className="italic">{produk.catatan}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition"
          >
            Tutup
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenEdit(produk);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Ubah Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
