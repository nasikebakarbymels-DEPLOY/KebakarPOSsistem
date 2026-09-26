import React, { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Tag, CreditCard, FileText } from 'lucide-react';
import { Pengeluaran, MetodePengeluaran } from '../../types';
import {
  KATEGORI_PENGELUARAN_PRESET,
  CreatePengeluaranDTO,
} from '../../services/pengeluaranService';
import { getLocalTodayString } from '../../services/laporanService';

interface PengeluaranFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: CreatePengeluaranDTO) => Promise<void>;
  pengeluaranToEdit?: Pengeluaran | null;
}

export const PengeluaranFormModal: React.FC<PengeluaranFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  pengeluaranToEdit,
}) => {
  const [tanggal, setTanggal] = useState(getLocalTodayString());
  const [kategori, setKategori] = useState<string>(KATEGORI_PENGELUARAN_PRESET[0]);
  const [customKategori, setCustomKategori] = useState('');
  const [isCustomKategori, setIsCustomKategori] = useState(false);
  const [nominal, setNominal] = useState('');
  const [metode, setMetode] = useState<MetodePengeluaran>('tunai');
  const [catatan, setCatatan] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (pengeluaranToEdit) {
      setTanggal(pengeluaranToEdit.tanggal);
      const isPreset = KATEGORI_PENGELUARAN_PRESET.includes(
        pengeluaranToEdit.kategori as (typeof KATEGORI_PENGELUARAN_PRESET)[number]
      );
      if (isPreset) {
        setKategori(pengeluaranToEdit.kategori);
        setIsCustomKategori(false);
        setCustomKategori('');
      } else {
        setKategori('Lain-lain');
        setIsCustomKategori(true);
        setCustomKategori(pengeluaranToEdit.kategori);
      }
      setNominal(String(pengeluaranToEdit.nominal));
      setMetode(pengeluaranToEdit.metode);
      setCatatan(pengeluaranToEdit.catatan || '');
    } else {
      setTanggal(getLocalTodayString());
      setKategori(KATEGORI_PENGELUARAN_PRESET[0]);
      setIsCustomKategori(false);
      setCustomKategori('');
      setNominal('');
      setMetode('tunai');
      setCatatan('');
    }
    setErrorMsg(null);
  }, [pengeluaranToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const finalKategori = isCustomKategori ? customKategori.trim() : kategori.trim();
    if (!finalKategori) {
      setErrorMsg('Kategori pengeluaran wajib dipilih atau diisi.');
      return;
    }

    const parsedNominal = Number(nominal);
    if (isNaN(parsedNominal) || parsedNominal <= 0) {
      setErrorMsg('Nominal pengeluaran harus lebih besar dari 0.');
      return;
    }

    if (!tanggal) {
      setErrorMsg('Tanggal pengeluaran wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        tanggal,
        kategori: finalKategori,
        nominal: parsedNominal,
        metode,
        catatan: catatan.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan pengeluaran.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="pengeluaran-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        id="pengeluaran-modal-card"
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 bg-stone-50">
          <div>
            <h3 className="text-lg font-bold text-stone-900">
              {pengeluaranToEdit ? 'Edit Pengeluaran Operasional' : 'Catat Pengeluaran Baru'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Pencatatan biaya operasional non-bahan baku
            </p>
          </div>
          <button
            id="btn-close-pengeluaran-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Tanggal */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-orange-600" />
              Tanggal Pengeluaran <span className="text-red-500">*</span>
            </label>
            <input
              id="input-pengeluaran-tanggal"
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Kategori */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-orange-600" />
              Kategori Pengeluaran <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-2">
              {KATEGORI_PENGELUARAN_PRESET.map((kat) => (
                <button
                  key={kat}
                  type="button"
                  onClick={() => {
                    setKategori(kat);
                    setIsCustomKategori(false);
                  }}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-center border ${
                    !isCustomKategori && kategori === kat
                      ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                      : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {kat}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsCustomKategori(true)}
                className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-center border ${
                  isCustomKategori
                    ? 'bg-orange-600 border-orange-600 text-white shadow-xs'
                    : 'bg-stone-50 border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                + Kustom
              </button>
            </div>

            {isCustomKategori && (
              <input
                id="input-pengeluaran-custom-kategori"
                type="text"
                placeholder="Ketik kategori pengeluaran..."
                value={customKategori}
                onChange={(e) => setCustomKategori(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 mt-1"
              />
            )}
          </div>

          {/* Nominal */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-orange-600" />
              Nominal Pengeluaran (Rp) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 font-semibold text-sm">
                Rp
              </span>
              <input
                id="input-pengeluaran-nominal"
                type="number"
                min="1"
                step="any"
                placeholder="Contoh: 150000"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                required
                className="w-full pl-10 pr-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Metode Pembayaran */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-orange-600" />
              Metode Pembayaran <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'tunai', label: 'Tunai' },
                  { id: 'transfer', label: 'Transfer / QRIS' },
                  { id: 'hutang', label: 'Hutang / Tempo' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetode(m.id)}
                  className={`py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                    metode === m.id
                      ? 'bg-stone-900 border-stone-900 text-white shadow-xs'
                      : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              Catatan / Keterangan (Opsional)
            </label>
            <textarea
              id="input-pengeluaran-catatan"
              rows={2}
              placeholder="Contoh: Pembayaran listrik bulan September, kwitansi #481"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              id="btn-cancel-pengeluaran"
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl text-sm transition-colors"
            >
              Batal
            </button>
            <button
              id="btn-save-pengeluaran"
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors shadow-xs"
            >
              {isSubmitting ? 'Menyimpan...' : pengeluaranToEdit ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
