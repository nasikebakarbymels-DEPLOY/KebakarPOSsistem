import React, { useState, useEffect } from 'react';
import { X, Layers, Loader2, DollarSign, FileText, CheckCircle2 } from 'lucide-react';
import { Bahan, SatuanDasar } from '../../types';

interface BahanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    nama: string;
    satuanDasar: SatuanDasar;
    biayaTerbaru?: number;
    catatan?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  initialBahan?: Bahan | null;
}

export const BahanModal: React.FC<BahanModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialBahan,
}) => {
  const isEditing = !!initialBahan;

  const [nama, setNama] = useState('');
  const [satuanDasar, setSatuanDasar] = useState<SatuanDasar>('gram');
  const [biayaTerbaru, setBiayaTerbaru] = useState<string>('');
  const [catatan, setCatatan] = useState('');

  const [validationErrors, setValidationErrors] = useState<{
    nama?: string;
    biayaTerbaru?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialBahan) {
        setNama(initialBahan.nama);
        setSatuanDasar(initialBahan.satuanDasar);
        setBiayaTerbaru(
          initialBahan.biayaTerbaru !== undefined ? String(initialBahan.biayaTerbaru) : ''
        );
        setCatatan(initialBahan.catatan || '');
      } else {
        setNama('');
        setSatuanDasar('gram');
        setBiayaTerbaru('');
        setCatatan('');
      }
      setValidationErrors({});
      setServerError(null);
      setIsLoading(false);
    }
  }, [isOpen, initialBahan]);

  if (!isOpen) return null;

  const validate = () => {
    const errors: { nama?: string; biayaTerbaru?: string } = {};
    const trimmedNama = nama.trim();

    if (!trimmedNama) {
      errors.nama = 'Nama bahan wajib diisi.';
    } else if (trimmedNama.length < 2) {
      errors.nama = 'Nama bahan minimal 2 karakter.';
    }

    if (biayaTerbaru !== '') {
      const parsed = Number(biayaTerbaru);
      if (isNaN(parsed) || parsed < 0) {
        errors.biayaTerbaru = 'Biaya per satuan harus berupa angka tidak negatif (>= 0).';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    setIsLoading(true);
    try {
      const parsedBiaya = biayaTerbaru.trim() !== '' ? Number(biayaTerbaru) : undefined;
      const res = await onSubmit({
        nama: nama.trim(),
        satuanDasar,
        biayaTerbaru: parsedBiaya,
        catatan: catatan.trim() || undefined,
      });

      if (!res.success) {
        setServerError(res.error || 'Gagal menyimpan data bahan.');
      } else {
        onClose();
      }
    } catch (err: any) {
      setServerError(err.message || 'Terjadi kesalahan pada sistem.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-stone-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-stone-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                {isEditing ? 'Edit Data Bahan' : 'Tambah Bahan Baru'}
              </h3>
              <p className="text-xs text-stone-500">
                {isEditing
                  ? 'Perbarui satuan atau biaya dasar bahan'
                  : 'Daftarkan bahan baku untuk perhitungan HPP'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server / Validation Error Notice */}
        {serverError && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
            {serverError}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Nama Bahan */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5" htmlFor="bahan-nama">
              Nama Bahan <span className="text-rose-500">*</span>
            </label>
            <input
              id="bahan-nama"
              type="text"
              value={nama}
              onChange={(e) => {
                setNama(e.target.value);
                if (validationErrors.nama) {
                  setValidationErrors((prev) => ({ ...prev, nama: undefined }));
                }
              }}
              placeholder="Contoh: Kecap Manis, Ayam, Cup Minuman"
              className={`w-full px-3.5 py-2.5 rounded-xl text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                validationErrors.nama
                  ? 'border-rose-300 focus:ring-rose-500/30 bg-rose-50/30'
                  : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
              }`}
            />
            {validationErrors.nama && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{validationErrors.nama}</p>
            )}
          </div>

          {/* Satuan Dasar (Gram | Ml | Pcs) */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Satuan Dasar <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['gram', 'ml', 'pcs'] as SatuanDasar[]).map((stn) => {
                const isSelected = satuanDasar === stn;
                return (
                  <button
                    key={stn}
                    type="button"
                    onClick={() => setSatuanDasar(stn)}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold capitalize transition-all flex flex-col items-center gap-0.5 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-xs'
                        : 'border-stone-200 bg-stone-50/40 text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    <span>{stn}</span>
                    <span className="text-[10px] font-normal text-stone-400">
                      {stn === 'gram' ? 'Berat padat' : stn === 'ml' ? 'Volume cair' : 'Satuan buah'}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10.5px] text-stone-400 mt-1.5">
              Satuan dasar dipakai untuk resep dan konversi netto semua kemasan.
            </p>
          </div>

          {/* Biaya Awal per Satuan Dasar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="block text-xs font-bold text-stone-700"
                htmlFor="bahan-biaya"
              >
                Biaya Awal per Satuan ({satuanDasar})
              </label>
              <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                Opsional
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400 text-xs font-bold">
                Rp
              </div>
              <input
                id="bahan-biaya"
                type="number"
                min="0"
                step="any"
                value={biayaTerbaru}
                onChange={(e) => {
                  setBiayaTerbaru(e.target.value);
                  if (validationErrors.biayaTerbaru) {
                    setValidationErrors((prev) => ({ ...prev, biayaTerbaru: undefined }));
                  }
                }}
                placeholder={satuanDasar === 'ml' ? '104' : satuanDasar === 'gram' ? '40' : '700'}
                className={`w-full pl-10 pr-16 py-2.5 rounded-xl text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                  validationErrors.biayaTerbaru
                    ? 'border-rose-300 focus:ring-rose-500/30 bg-rose-50/30'
                    : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
                }`}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-stone-400 text-xs">
                /{satuanDasar}
              </div>
            </div>
            {validationErrors.biayaTerbaru && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                {validationErrors.biayaTerbaru}
              </p>
            )}
            <p className="text-[10.5px] text-stone-400 mt-1">
              Dipakai sebagai acuan HPP sebelum ada pencatatan pembelian bahan pertama.
            </p>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5" htmlFor="bahan-catatan">
              Catatan Bahan
            </label>
            <input
              id="bahan-catatan"
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Misal: Merk tertentu, simpan di chiller"
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-stone-200 bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-semibold text-xs hover:bg-stone-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white font-bold text-xs shadow-md hover:bg-orange-700 transition active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isEditing ? 'Simpan Perubahan' : 'Tambah Bahan'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
