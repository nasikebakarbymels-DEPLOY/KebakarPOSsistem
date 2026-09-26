import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Building2,
  FileText,
  Package,
  Layers,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { PembelianBahan, Bahan } from '../../types';
import { bahanCloudService } from '../../services/cloud/bahanCloudService';
import {
  formatRupiah,
  formatBiayaSatuan,
  formatTanggalIndo,
  formatTanggalSlash,
} from '../../utils/formatters';

interface PembelianDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pembelian: PembelianBahan | null;
  outletId: string;
}

export const PembelianDetailModal: React.FC<PembelianDetailModalProps> = ({
  isOpen,
  onClose,
  pembelian,
  outletId,
}) => {
  const [bahanMap, setBahanMap] = useState<Record<string, Bahan>>({});

  useEffect(() => {
    if (!isOpen || !pembelian || !outletId) return;

    let isMounted = true;
    const fetchBahanTerkait = async () => {
      try {
        const bahanList = await bahanCloudService.getActiveBahan(outletId);
        if (!isMounted) return;
        const map: Record<string, Bahan> = {};
        for (const b of bahanList) {
          map[b.id] = b;
        }
        setBahanMap(map);
      } catch (err) {
        console.error('[PembelianDetailModal] Gagal memuat data bahan saat ini:', err);
      }
    };

    fetchBahanTerkait();
    return () => {
      isMounted = false;
    };
  }, [isOpen, pembelian, outletId]);

  if (!isOpen || !pembelian) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex items-center justify-between bg-stone-50/60">
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-600" />
              <span>Detail Pembelian Bahan</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Rincian item pembelian dan pengaruh ke harga acuan resep
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs text-stone-700">
          {/* Info Utama: Tanggal, Supplier, Catatan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-stone-50 border border-stone-200/80">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>Tanggal Pembelian</span>
              </div>
              <div className="font-bold text-stone-900 text-sm">
                {formatTanggalIndo(pembelian.tanggal)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                <Building2 className="w-3.5 h-3.5 text-stone-500" />
                <span>Supplier</span>
              </div>
              <div className="font-bold text-stone-900 text-sm">
                {pembelian.supplier || 'Supplier Umum'}
              </div>
            </div>

            {pembelian.catatan && (
              <div className="sm:col-span-2 pt-2 border-t border-stone-200/60 space-y-1">
                <div className="flex items-center gap-1.5 text-stone-400 font-bold uppercase tracking-wider text-[10px]">
                  <FileText className="w-3.5 h-3.5 text-stone-500" />
                  <span>Catatan</span>
                </div>
                <div className="text-stone-700 italic">{pembelian.catatan}</div>
              </div>
            )}
          </div>

          {/* Rincian Item Pembelian */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-black text-stone-900 text-xs sm:text-sm flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-orange-600" />
                <span>Daftar Item ({pembelian.items?.length || 0})</span>
              </h3>
              <span className="text-[11px] text-stone-500 font-medium">
                Total: <strong>{formatRupiah(pembelian.totalPembelian)}</strong>
              </span>
            </div>

            <div className="space-y-2.5">
              {(pembelian.items || []).map((item, idx) => {
                const hargaPerSatuan =
                  item.isiPerKemasanSnapshot > 0
                    ? item.hargaPerUnit / item.isiPerKemasanSnapshot
                    : 0;

                const liveBahan = bahanMap[item.bahanId];
                const riwayatTerbaru = liveBahan?.riwayatHarga?.[0];

                return (
                  <div
                    key={`${item.bahanId}-${item.kemasanId}-${idx}`}
                    className="p-3.5 rounded-xl border border-stone-200/90 bg-white shadow-2xs space-y-2.5"
                  >
                    {/* Header item: Nama Bahan, Nama Kemasan & Badge Acuan */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-stone-900 text-sm">
                          {item.namaBahanSnapshot}
                        </div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          Kemasan: <strong>{item.namaKemasanSnapshot}</strong> (Netto:{' '}
                          {item.isiPerKemasanSnapshot}{' '}
                          {liveBahan?.satuanDasar || 'satuan'})
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-stone-900">
                          {formatRupiah(item.hargaTotal)}
                        </div>
                        <div className="text-[10px] text-stone-500 mt-0.5">
                          {item.qty} × {formatRupiah(item.hargaPerUnit)}
                        </div>
                      </div>
                    </div>

                    {/* Baris perhitungan biaya per satuan dasar */}
                    <div className="p-2 rounded-lg bg-stone-50 flex items-center justify-between text-[11px]">
                      <span className="text-stone-600">Biaya per satuan dasar pembelian:</span>
                      <span className="font-bold text-stone-800">
                        {formatBiayaSatuan(hargaPerSatuan, liveBahan?.satuanDasar)}
                      </span>
                    </div>

                    {/* Jika item ini kemasan acuan: Info status harga acuan saat ini */}
                    {item.isAcuanKemasan && (
                      <div className="p-2.5 rounded-lg bg-orange-50/80 border border-orange-200/80 space-y-1.5 text-[11px] text-orange-950">
                        <div className="flex items-center gap-1.5 font-bold text-orange-800">
                          <Sparkles className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>Kemasan Acuan Resep HPP</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-orange-900/80">Harga acuan bahan saat ini:</span>
                          <span className="font-black text-orange-800">
                            {liveBahan
                              ? formatBiayaSatuan(
                                  liveBahan.hargaPerSatuanDasar,
                                  liveBahan.satuanDasar
                                )
                              : formatBiayaSatuan(hargaPerSatuan)}
                          </span>
                        </div>
                        {riwayatTerbaru && (
                          <div className="text-[10px] text-orange-700/80 pt-1 border-t border-orange-200/60 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-orange-600" />
                            <span>
                              Update riwayat: {formatTanggalSlash(riwayatTerbaru.tanggal)} (
                              {formatBiayaSatuan(
                                riwayatTerbaru.hargaPerSatuanDasar,
                                liveBahan?.satuanDasar
                              )}
                              )
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ringkasan Total Pembelian */}
          <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200 flex items-center justify-between">
            <span className="font-bold text-stone-800 text-xs sm:text-sm">
              Total Pembelian Keseluruhan:
            </span>
            <span className="font-black text-orange-700 text-base sm:text-lg">
              {formatRupiah(pembelian.totalPembelian)}
            </span>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="p-4 border-t border-stone-200/80 bg-stone-50/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
