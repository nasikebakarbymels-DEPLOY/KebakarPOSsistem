import React, { useState, useEffect } from 'react';
import { X, Store, Loader2 } from 'lucide-react';
import { Outlet } from '../../types';

export interface OutletFormData {
  nama: string;
  alamat: string;
  telepon?: string;
}

interface OutletFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: OutletFormData) => Promise<void> | void;
  outlet?: Outlet | null;
}

export const OutletFormModal: React.FC<OutletFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  outlet,
}) => {
  const isEditMode = Boolean(outlet);

  const [nama, setNama] = useState('');
  const [alamat, setAlamat] = useState('');
  const [telepon, setTelepon] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ nama?: string; alamat?: string; telepon?: string }>({});

  // Reset form saat modal dibuka atau outlet berubah
  useEffect(() => {
    if (isOpen) {
      if (outlet) {
        setNama(outlet.nama || '');
        setAlamat(outlet.alamat || '');
        setTelepon(outlet.telepon || '');
      } else {
        setNama('');
        setAlamat('');
        setTelepon('');
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, outlet]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const errs: { nama?: string; alamat?: string; telepon?: string } = {};

    const trimmedNama = nama.trim();
    if (!trimmedNama) {
      errs.nama = 'Nama outlet tidak boleh kosong.';
    } else if (trimmedNama.length < 3) {
      errs.nama = 'Nama outlet minimal 3 karakter.';
    }

    const trimmedAlamat = alamat.trim();
    if (!trimmedAlamat) {
      errs.alamat = 'Alamat outlet tidak boleh kosong.';
    } else if (trimmedAlamat.length < 10) {
      errs.alamat = 'Alamat outlet minimal 10 karakter.';
    }

    const trimmedTelepon = telepon.trim();
    if (trimmedTelepon) {
      const phoneRegex = /^[\d\s+-]+$/;
      if (!phoneRegex.test(trimmedTelepon)) {
        errs.telepon = 'Nomor telepon hanya boleh memuat angka, spasi, tanda hubung (-), dan tanda plus (+).';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await onSubmit({
        nama: nama.trim(),
        alamat: alamat.trim(),
        telepon: telepon.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error('[OutletFormModal] Error submit form:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    nama.trim().length >= 3 &&
    alamat.trim().length >= 10 &&
    (!telepon.trim() || /^[\d\s+-]+$/.test(telepon.trim()));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-outlet-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
            <h2 id="modal-outlet-title" className="text-base font-bold text-stone-900">
              {isEditMode ? 'Edit Outlet' : 'Tambah Outlet Baru'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-4">
          {/* Input Nama Outlet */}
          <div>
            <label htmlFor="outlet-nama" className="block text-xs font-bold text-stone-700 mb-1">
              Nama Outlet <span className="text-rose-500">*</span>
            </label>
            <input
              id="outlet-nama"
              type="text"
              value={nama}
              onChange={(e) => {
                setNama(e.target.value);
                if (errors.nama) setErrors((prev) => ({ ...prev, nama: undefined }));
              }}
              placeholder="Contoh: Outlet Sudirman Central"
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2.5 rounded-lg text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                errors.nama
                  ? 'border-rose-300 focus:ring-rose-500/30'
                  : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
              }`}
            />
            {errors.nama && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.nama}</p>
            )}
          </div>

          {/* Input Alamat */}
          <div>
            <label htmlFor="outlet-alamat" className="block text-xs font-bold text-stone-700 mb-1">
              Alamat Lengkap <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="outlet-alamat"
              rows={3}
              value={alamat}
              onChange={(e) => {
                setAlamat(e.target.value);
                if (errors.alamat) setErrors((prev) => ({ ...prev, alamat: undefined }));
              }}
              placeholder="Contoh: Jl. Jenderal Sudirman No. 45, RT 02/RW 03, Jakarta Pusat"
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2.5 rounded-lg text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition resize-none ${
                errors.alamat
                  ? 'border-rose-300 focus:ring-rose-500/30'
                  : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
              }`}
            />
            {errors.alamat ? (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.alamat}</p>
            ) : (
              <p className="text-[11px] text-stone-400 mt-1">Minimal 10 karakter.</p>
            )}
          </div>

          {/* Input Telepon */}
          <div>
            <label htmlFor="outlet-telepon" className="block text-xs font-bold text-stone-700 mb-1">
              Nomor Telepon / WhatsApp <span className="text-stone-400 font-normal">(Opsional)</span>
            </label>
            <input
              id="outlet-telepon"
              type="text"
              value={telepon}
              onChange={(e) => {
                setTelepon(e.target.value);
                if (errors.telepon) setErrors((prev) => ({ ...prev, telepon: undefined }));
              }}
              placeholder="Contoh: +62 812-3456-7890"
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2.5 rounded-lg text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                errors.telepon
                  ? 'border-rose-300 focus:ring-rose-500/30'
                  : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
              }`}
            />
            {errors.telepon && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.telepon}</p>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
