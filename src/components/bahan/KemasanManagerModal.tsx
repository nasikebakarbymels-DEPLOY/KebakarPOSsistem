import React, { useState } from 'react';
import {
  X,
  Package,
  Plus,
  Edit2,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
} from 'lucide-react';
import { Bahan, KemasanBahan, SatuanDasar } from '../../types';
import { ConfirmDialog } from './ConfirmDialog';

interface KemasanManagerModalProps {
  isOpen: boolean;
  bahan: Bahan | null;
  onClose: () => void;
  onAddKemasan: (
    bahanId: string,
    data: { nama: string; netto: number }
  ) => Promise<{ success: boolean; error?: string }>;
  onUpdateKemasan: (
    bahanId: string,
    kemasanId: string,
    data: { nama: string; netto: number }
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteKemasan: (
    bahanId: string,
    kemasanId: string
  ) => Promise<{ success: boolean; error?: string }>;
}

export function getAutoFillNetto(namaKemasan: string, satuanDasar: SatuanDasar): number | '' {
  const norm = namaKemasan.trim().toLowerCase();
  if (satuanDasar === 'gram') {
    if (norm === 'kg' || norm === '1 kg' || norm === 'kilogram') return 1000;
    if (norm === 'gram' || norm === '1 gram' || norm === 'g') return 1;
    if (norm === '500 gram' || norm === '500g' || norm === '1/2 kg') return 500;
  }
  if (satuanDasar === 'ml') {
    if (norm === 'liter' || norm === '1 liter' || norm === 'l') return 1000;
    if (norm === 'ml' || norm === '1 ml') return 1;
  }
  if (satuanDasar === 'pcs') {
    if (norm === 'pcs' || norm === '1 pcs' || norm === 'piece' || norm === 'buah' || norm === 'biji')
      return 1;
  }
  return '';
}

export const KemasanManagerModal: React.FC<KemasanManagerModalProps> = ({
  isOpen,
  bahan,
  onClose,
  onAddKemasan,
  onUpdateKemasan,
  onDeleteKemasan,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingKemasanId, setEditingKemasanId] = useState<string | null>(null);

  const [namaKemasan, setNamaKemasan] = useState('');
  const [netto, setNetto] = useState<string>('');
  const [formErrors, setFormErrors] = useState<{ nama?: string; netto?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm delete state
  const [deletingKemasan, setDeletingKemasan] = useState<KemasanBahan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Common suggestion chips based on satuan
  const getSuggestions = () => {
    if (!bahan) return [];
    if (bahan.satuanDasar === 'ml') {
      return ['Botol kecil', 'Pouch', 'Botol besar', '1 Liter', 'Jerigen'];
    }
    if (bahan.satuanDasar === 'gram') {
      return ['1 kg', 'Potong', 'Pack', '500 gram', 'Sachet'];
    }
    return ['Pack', 'Renceng', 'Box', '1 Pcs', 'Karton'];
  };

  const handleNameChange = (val: string) => {
    setNamaKemasan(val);
    if (formErrors.nama) setFormErrors((prev) => ({ ...prev, nama: undefined }));

    // Check smart auto-fill rule
    if (bahan) {
      const auto = getAutoFillNetto(val, bahan.satuanDasar);
      if (auto !== '') {
        setNetto(String(auto));
        if (formErrors.netto) setFormErrors((prev) => ({ ...prev, netto: undefined }));
      }
    }
  };

  const handleSelectChip = (chip: string) => {
    setNamaKemasan(chip);
    if (formErrors.nama) setFormErrors((prev) => ({ ...prev, nama: undefined }));

    if (bahan) {
      const auto = getAutoFillNetto(chip, bahan.satuanDasar);
      if (auto !== '') {
        setNetto(String(auto));
        if (formErrors.netto) setFormErrors((prev) => ({ ...prev, netto: undefined }));
      } else {
        // If no auto-match, leave it or let user fill manual
        if (chip.toLowerCase().includes('botol kecil') && bahan.satuanDasar === 'ml') {
          setNetto('135');
        } else if (chip.toLowerCase().includes('pouch') && bahan.satuanDasar === 'ml') {
          setNetto('520');
        } else if (chip.toLowerCase().includes('potong') && bahan.satuanDasar === 'gram') {
          setNetto('100');
        } else if (chip.toLowerCase().includes('pack') && bahan.satuanDasar === 'pcs') {
          setNetto('50');
        } else if (chip.toLowerCase().includes('renceng') && bahan.satuanDasar === 'pcs') {
          setNetto('100');
        }
      }
    }
  };

  const startEdit = (k: KemasanBahan) => {
    setEditingKemasanId(k.id);
    setNamaKemasan(k.nama);
    setNetto(String(k.netto));
    setIsFormOpen(true);
    setFormErrors({});
    setServerError(null);
  };

  const cancelForm = () => {
    setIsFormOpen(false);
    setEditingKemasanId(null);
    setNamaKemasan('');
    setNetto('');
    setFormErrors({});
    setServerError(null);
  };

  const validateForm = () => {
    const errors: { nama?: string; netto?: string } = {};
    const trimmedNama = namaKemasan.trim();

    if (!trimmedNama) {
      errors.nama = 'Nama kemasan wajib diisi.';
    }

    if (netto.trim() === '') {
      errors.netto = 'Netto kemasan wajib diisi.';
    } else {
      const parsed = Number(netto);
      if (isNaN(parsed) || parsed <= 0) {
        errors.netto = `Netto harus berupa angka > 0 (${bahan?.satuanDasar || ''}).`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bahan) return;
    setServerError(null);

    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        nama: namaKemasan.trim(),
        netto: Number(netto),
      };

      if (editingKemasanId) {
        const res = await onUpdateKemasan(bahan.id, editingKemasanId, payload);
        if (!res.success) {
          setServerError(res.error || 'Gagal mengubah kemasan.');
          return;
        }
      } else {
        const res = await onAddKemasan(bahan.id, payload);
        if (!res.success) {
          setServerError(res.error || 'Gagal menambah kemasan.');
          return;
        }
      }
      cancelForm();
    } catch (err: any) {
      setServerError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingKemasan || !bahan) return;
    setIsDeleting(true);
    try {
      await onDeleteKemasan(bahan.id, deletingKemasan.id);
      setDeletingKemasan(null);
    } catch (err: any) {
      setServerError(err.message || 'Gagal menghapus kemasan.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen || !bahan) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-stone-200 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between pb-3.5 border-b border-stone-100 mb-4 shrink-0">
            <div className="flex items-start gap-2.5">
              <div className="p-2.5 rounded-2xl bg-orange-100 text-orange-600 shrink-0 mt-0.5">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 leading-snug">
                  Kelola Kemasan Bahan
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-semibold text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md">
                    {bahan.nama}
                  </span>
                  <span className="text-xs text-orange-700 bg-orange-50 font-bold px-1.5 py-0.5 rounded border border-orange-200">
                    Satuan: {bahan.satuanDasar}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Scrollable */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
            {/* Context Info */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/70 text-xs text-stone-600 flex items-start gap-2">
              <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Setiap bahan dapat memiliki banyak variasi kemasan saat dibeli (misal: botol, pouch, pack, atau kg). Netto kemasan disimpan dalam satuan dasar (<strong>{bahan.satuanDasar}</strong>) untuk otomatisasi perhitungan harga per satuan pada modul pembelian.
              </p>
            </div>

            {/* Error Message */}
            {serverError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {serverError}
              </div>
            )}

            {/* Daftar Kemasan Terdaftar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                  Daftar Kemasan Terdaftar ({bahan.kemasanList?.length || 0})
                </h4>
                {!isFormOpen && (
                  <button
                    onClick={() => {
                      setIsFormOpen(true);
                      setEditingKemasanId(null);
                      setNamaKemasan('');
                      setNetto('');
                      setFormErrors({});
                    }}
                    className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Kemasan
                  </button>
                )}
              </div>

              {(!bahan.kemasanList || bahan.kemasanList.length === 0) && !isFormOpen ? (
                <div className="p-6 text-center border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                  <Package className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-stone-700">Belum ada kemasan terdaftar</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Tambahkan kemasan pembelian seperti botol, pouch, pack, dll.
                  </p>
                  <button
                    onClick={() => setIsFormOpen(true)}
                    className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-orange-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Kemasan Sekarang
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {bahan.kemasanList?.map((k) => (
                    <div
                      key={k.id}
                      className="p-3 rounded-2xl border border-stone-200 bg-white hover:border-stone-300 transition flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-stone-900 truncate">
                          {k.nama}
                        </div>
                        <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1">
                          <span>Netto:</span>
                          <span className="font-bold text-stone-800 bg-stone-100 px-1.5 py-0.5 rounded font-mono">
                            {k.netto.toLocaleString('id-ID')} {bahan.satuanDasar}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(k)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition"
                          title="Edit Kemasan"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingKemasan(k)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Hapus Kemasan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form Tambah / Edit Kemasan */}
            {isFormOpen && (
              <div className="p-4 rounded-2xl border-2 border-orange-200 bg-orange-50/30 animate-in fade-in duration-150">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                    {editingKemasanId ? 'Edit Kemasan' : 'Form Tambah Kemasan'}
                  </h4>
                  <button
                    onClick={cancelForm}
                    className="text-stone-400 hover:text-stone-600 text-xs font-semibold"
                  >
                    Batal
                  </button>
                </div>

                {/* Suggestions Chips */}
                <div className="mb-3">
                  <span className="text-[10px] text-stone-400 block mb-1 font-semibold uppercase">
                    Pilihan Cepat Standar:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {getSuggestions().map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleSelectChip(chip)}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium transition ${
                          namaKemasan.toLowerCase() === chip.toLowerCase()
                            ? 'bg-orange-600 text-white border-orange-600 font-bold'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>

                <form onSubmit={handleFormSubmit} noValidate className="space-y-3">
                  {/* Nama Kemasan */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1" htmlFor="kemasan-nama">
                      Nama Kemasan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="kemasan-nama"
                      type="text"
                      value={namaKemasan}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Contoh: Botol kecil, Pouch, 1 kg, Pack"
                      className={`w-full px-3 py-2 rounded-xl text-xs border bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                        formErrors.nama
                          ? 'border-rose-300 focus:ring-rose-500/30'
                          : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
                      }`}
                    />
                    {formErrors.nama && (
                      <p className="text-[10.5px] text-rose-600 mt-1 font-medium">{formErrors.nama}</p>
                    )}
                  </div>

                  {/* Netto Manual */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-stone-700" htmlFor="kemasan-netto">
                        Netto Kemasan <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[10px] text-orange-700 font-semibold">
                        Dalam satuan: {bahan.satuanDasar}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        id="kemasan-netto"
                        type="number"
                        min="0.001"
                        step="any"
                        value={netto}
                        onChange={(e) => {
                          setNetto(e.target.value);
                          if (formErrors.netto) {
                            setFormErrors((prev) => ({ ...prev, netto: undefined }));
                          }
                        }}
                        placeholder="Contoh: 135 (untuk ml) atau 1000 (untuk kg)"
                        className={`w-full pl-3 pr-16 py-2 rounded-xl text-xs border bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                          formErrors.netto
                            ? 'border-rose-300 focus:ring-rose-500/30'
                            : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
                        }`}
                      />
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-stone-400 text-xs font-semibold">
                        {bahan.satuanDasar}
                      </div>
                    </div>
                    {formErrors.netto && (
                      <p className="text-[10.5px] text-rose-600 mt-1 font-medium">{formErrors.netto}</p>
                    )}
                    <p className="text-[10px] text-stone-400 mt-1">
                      Ketik "kg" otomatis terisi 1000 gram, "liter" terisi 1000 ml. Tetap bisa Anda sesuaikan manual.
                    </p>
                  </div>

                  {/* Submit / Cancel Buttons */}
                  <div className="pt-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelForm}
                      disabled={isSubmitting}
                      className="flex-1 py-2 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-semibold hover:bg-stone-50 transition"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold shadow-xs hover:bg-orange-700 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{editingKemasanId ? 'Simpan' : 'Tambahkan'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Footer Action */}
          <div className="pt-3 border-t border-stone-100 shrink-0 mt-3">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition"
            >
              Selesai
            </button>
          </div>
        </div>
      </div>

      {/* Dialog Konfirmasi Hapus Kemasan */}
      <ConfirmDialog
        isOpen={!!deletingKemasan}
        title="Hapus Kemasan"
        message={`Apakah Anda yakin ingin menghapus kemasan "${deletingKemasan?.nama}" (${deletingKemasan?.netto} ${bahan.satuanDasar}) dari bahan ini?`}
        confirmLabel="Ya, Hapus Kemasan"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingKemasan(null)}
      />
    </>
  );
};
