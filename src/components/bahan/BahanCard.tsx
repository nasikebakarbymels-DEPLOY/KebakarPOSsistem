import React from 'react';
import { Package, Edit2, Trash2, Plus, Sparkles, Scale, AlertCircle } from 'lucide-react';
import { Bahan } from '../../types';
import { formatBiayaSatuan } from '../../utils/formatters';

interface BahanCardProps {
  bahan: Bahan;
  onEdit: (bahan: Bahan) => void;
  onDelete: (bahan: Bahan) => void;
  onManageKemasan: (bahan: Bahan) => void;
}

export const BahanCard: React.FC<BahanCardProps> = ({
  bahan,
  onEdit,
  onDelete,
  onManageKemasan,
}) => {
  const hasBiaya = bahan.biayaTerbaru !== undefined && bahan.biayaTerbaru !== null;
  const kemasanCount = bahan.kemasanList?.length || 0;

  return (
    <div className="bg-white rounded-3xl p-4 sm:p-5 border border-stone-200/80 shadow-xs hover:shadow-md hover:border-orange-200 transition-all duration-200 flex flex-col justify-between group">
      <div>
        {/* Top row: Name, Satuan dasar, Actions */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-stone-900 tracking-tight truncate">
                {bahan.nama}
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200/60 uppercase">
                <Scale className="w-3 h-3" />
                {bahan.satuanDasar}
              </span>
            </div>
            {bahan.catatan && (
              <p className="text-xs text-stone-500 mt-1 line-clamp-1 italic">
                {bahan.catatan}
              </p>
            )}
          </div>

          {/* Quick Edit/Delete */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onEdit(bahan)}
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
              title="Edit Data Bahan"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(bahan)}
              className="p-1.5 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Hapus Bahan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Biaya Terbaru Row */}
        <div className="mt-3 pt-2.5 border-t border-stone-100">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-stone-500 font-medium">Biaya Acuan Satuan:</span>
            {hasBiaya ? (
              <span className="text-sm font-bold text-stone-900 font-mono bg-stone-50 px-2.5 py-1 rounded-xl border border-stone-200/60">
                {formatBiayaSatuan(bahan.biayaTerbaru, bahan.satuanDasar)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200/60">
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                Belum ada biaya
              </span>
            )}
          </div>
          {bahan.sumberBiayaInfo && (
            <div className="text-[10.5px] text-stone-400 mt-1 text-right flex items-center justify-end gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400"></span>
              <span>{bahan.sumberBiayaInfo}</span>
            </div>
          )}
        </div>

        {/* Kemasan Section */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-semibold text-stone-600 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-orange-600" />
              Kemasan Terdaftar ({kemasanCount})
            </span>
            <button
              onClick={() => onManageKemasan(bahan)}
              className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline transition"
            >
              {kemasanCount === 0 ? '+ Tambah Kemasan' : 'Kelola'}
            </button>
          </div>

          {kemasanCount > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {bahan.kemasanList.slice(0, 3).map((k) => (
                <span
                  key={k.id}
                  className="inline-flex items-center gap-1 text-[11px] bg-stone-100/90 text-stone-700 px-2.5 py-1 rounded-lg border border-stone-200/50 font-medium"
                >
                  <span className="font-semibold">{k.nama}</span>
                  <span className="text-stone-400">({k.netto} {bahan.satuanDasar})</span>
                </span>
              ))}
              {kemasanCount > 3 && (
                <button
                  onClick={() => onManageKemasan(bahan)}
                  className="text-[11px] font-bold text-stone-500 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-lg transition"
                >
                  +{kemasanCount - 3} lainnya
                </button>
              )}
            </div>
          ) : (
            <div
              onClick={() => onManageKemasan(bahan)}
              className="p-2.5 rounded-xl border border-dashed border-stone-200 bg-stone-50/50 text-stone-500 text-xs flex items-center justify-between cursor-pointer hover:border-orange-300 hover:bg-orange-50/20 transition"
            >
              <span className="text-[11px] text-stone-400 italic">
                Belum ada kemasan pembelian
              </span>
              <span className="text-[11px] font-bold text-orange-600 flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Tambah
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer Button */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex items-center gap-2">
        <button
          onClick={() => onManageKemasan(bahan)}
          className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200/80 text-stone-700 font-bold text-xs flex items-center justify-center gap-1.5 transition"
        >
          <Package className="w-3.5 h-3.5 text-stone-500" />
          <span>Kelola Kemasan ({kemasanCount})</span>
        </button>
      </div>
    </div>
  );
};
