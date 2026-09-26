import React from 'react';
import { X, Receipt, Trash2, Calendar, Package, Tag, Building2 } from 'lucide-react';
import { PembelianBahan } from '../../types';
import { formatRupiah, formatBiayaSatuan, formatTanggalIndo } from '../../utils/formatters';

interface PembelianDetailModalProps {
  isOpen: boolean;
  pembelian: PembelianBahan | null;
  onClose: () => void;
  onDeleteRequest: (pembelian: PembelianBahan) => void;
}

export const PembelianDetailModal: React.FC<PembelianDetailModalProps> = ({
  isOpen,
  pembelian,
  onClose,
  onDeleteRequest,
}) => {
  if (!isOpen || !pembelian) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-600">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Rincian Pembelian</h2>
              <p className="text-xs text-stone-500">ID: {pembelian.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
          {/* Main Card: Bahan & Total */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-orange-600 uppercase tracking-wider block">
                  Bahan Baku
                </span>
                <h3 className="text-lg font-bold text-stone-900">{pembelian.bahanNama}</h3>
                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-stone-200 text-stone-700 text-[10px] font-bold">
                  Satuan: {pembelian.satuanDasar}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  Total Biaya
                </span>
                <div className="text-lg font-extrabold text-stone-900">
                  {formatRupiah(pembelian.totalHarga)}
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between">
              <span className="text-stone-600 font-medium">Biaya per Satuan HPP:</span>
              <span className="text-sm font-black text-orange-600 font-mono bg-white px-2.5 py-1 rounded-xl border border-orange-200">
                {formatBiayaSatuan(pembelian.biayaPerSatuanDasar, pembelian.satuanDasar)}
              </span>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Tanggal Pembelian
              </span>
              <span className="font-bold text-stone-900">
                {formatTanggalIndo(pembelian.tanggal)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-stone-400" />
                Kemasan
              </span>
              <span className="font-bold text-stone-900">
                {pembelian.kemasanNama} ({(pembelian.nettoPerKemasan ?? 0).toLocaleString('id-ID')}{' '}
                {pembelian.satuanDasar})
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500">Jumlah Kemasan (Qty)</span>
              <span className="font-bold text-stone-900">
                {(pembelian.qty ?? 0).toLocaleString('id-ID')} unit
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500">Harga per Kemasan</span>
              <span className="font-bold text-stone-900">
                {formatRupiah(pembelian.hargaPerKemasan)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500">Total Netto Didapat</span>
              <span className="font-bold text-stone-900 font-mono">
                {(pembelian.totalNetto ?? 0).toLocaleString('id-ID')} {pembelian.satuanDasar}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-stone-100">
              <span className="text-stone-500 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-stone-400" />
                Kategori Akun
              </span>
              <span className="font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                {pembelian.kategori}
              </span>
            </div>

            {pembelian.supplierCatatan && (
              <div className="pt-2">
                <span className="text-stone-500 flex items-center gap-1.5 mb-1">
                  <Building2 className="w-3.5 h-3.5 text-stone-400" />
                  Supplier / Catatan
                </span>
                <p className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 text-stone-800 text-xs leading-relaxed">
                  {pembelian.supplierCatatan}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 p-4 border-t border-stone-100 bg-stone-50/50">
          <button
            type="button"
            onClick={() => {
              onClose();
              onDeleteRequest(pembelian);
            }}
            className="px-4 py-2.5 rounded-2xl border border-rose-200 bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 transition flex items-center justify-center gap-1.5 text-xs"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus</span>
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
