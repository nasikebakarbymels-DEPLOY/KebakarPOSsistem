import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Calendar, FileText, AlertCircle, TrendingDown } from 'lucide-react';
import { Pengeluaran } from '../../types';
import { formatRupiah, formatTanggalIndo } from '../../utils/formatters';

interface PengeluaranSegmentProps {
  pengeluaranList: Pengeluaran[];
  onOpenCreateModal: () => void;
  onEdit: (item: Pengeluaran) => void;
  onDelete: (item: Pengeluaran) => void;
  periodeLabel: string;
}

export const PengeluaranSegment: React.FC<PengeluaranSegmentProps> = ({
  pengeluaranList,
  onOpenCreateModal,
  onEdit,
  onDelete,
  periodeLabel,
}) => {
  const [itemToDelete, setItemToDelete] = useState<Pengeluaran | null>(null);

  const totalNominal = pengeluaranList.reduce(
    (sum, item) => sum + (Number(item.nominal) || 0),
    0
  );

  const getMetodeBadge = (metode: Pengeluaran['metode']) => {
    switch (metode) {
      case 'tunai':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            Tunai
          </span>
        );
      case 'transfer':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            Transfer / QRIS
          </span>
        );
      case 'hutang':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            Hutang / Tempo
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Ringkasan & Tombol Tambah */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
            <TrendingDown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-medium text-stone-500">
              Total Pengeluaran ({periodeLabel})
            </div>
            <div className="text-2xl font-bold text-stone-900 mt-0.5">
              {formatRupiah(totalNominal)}
            </div>
            <div className="text-xs text-stone-400 mt-0.5">
              {pengeluaranList.length} transaksi pengeluaran tercatat
            </div>
          </div>
        </div>

        <button
          id="btn-tambah-pengeluaran-segment"
          type="button"
          onClick={onOpenCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          Tambah Pengeluaran
        </button>
      </div>

      {/* Daftar Pengeluaran */}
      {pengeluaranList.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 text-stone-400 mx-auto flex items-center justify-center mb-3">
            <FileText className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-stone-800">
            Belum Ada Pengeluaran
          </h4>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 mb-4">
            Belum ada pengeluaran operasional non-bahan baku yang tercatat pada periode{' '}
            {periodeLabel}.
          </p>
          <button
            id="btn-empty-tambah-pengeluaran"
            type="button"
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Catat Pengeluaran Sekarang
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {pengeluaranList.map((item) => (
            <div
              key={item.id}
              id={`pengeluaran-card-${item.id}`}
              className="bg-white rounded-xl p-4 border border-stone-200 shadow-xs hover:border-stone-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-stone-900 text-sm">
                    {item.kategori}
                  </span>
                  {getMetodeBadge(item.metode)}
                  <span className="text-xs text-stone-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatTanggalIndo(item.tanggal)}
                  </span>
                </div>
                {item.catatan && (
                  <p className="text-xs text-stone-600 mt-1 italic line-clamp-2">
                    &ldquo;{item.catatan}&rdquo;
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                <div className="text-right">
                  <span className="block text-base font-bold text-red-600">
                    -{formatRupiah(item.nominal)}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    id={`btn-edit-pengeluaran-${item.id}`}
                    type="button"
                    title="Edit Pengeluaran"
                    onClick={() => onEdit(item)}
                    className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    id={`btn-delete-pengeluaran-${item.id}`}
                    type="button"
                    title="Hapus Pengeluaran"
                    onClick={() => setItemToDelete(item)}
                    className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Konfirmasi Hapus */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-stone-200">
            <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h4 className="text-center font-bold text-stone-900 text-base">
              Hapus Pengeluaran?
            </h4>
            <p className="text-center text-xs text-stone-600 mt-1.5 leading-relaxed">
              Yakin ingin menghapus pengeluaran <strong>{itemToDelete.kategori}</strong> sebesar{' '}
              <strong>{formatRupiah(itemToDelete.nominal)}</strong> pada tanggal{' '}
              {formatTanggalIndo(itemToDelete.tanggal)}? Tindakan ini akan langsung memperbarui laporan
              laba rugi.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onDelete(itemToDelete);
                  setItemToDelete(null);
                }}
                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-xs"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
