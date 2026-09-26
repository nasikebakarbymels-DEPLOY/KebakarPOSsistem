import React, { useState, useEffect } from 'react';
import { X, Layers, AlertCircle, RefreshCw } from 'lucide-react';
import { DrafKeranjang } from '../../types';
import { keranjangService } from '../../services/keranjangService';
import { formatRupiah } from '../../utils/formatters';

interface OpenBillCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  draf: DrafKeranjang;
  onSave: (label: string) => Promise<void>;
}

export const OpenBillCreateModal: React.FC<OpenBillCreateModalProps> = ({
  isOpen,
  onClose,
  draf,
  onSave,
}) => {
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (draf.nomorMeja?.trim()) {
        setLabel(`Meja ${draf.nomorMeja.trim()}`);
      } else if (draf.catatanPesanan?.trim()) {
        setLabel(draf.catatanPesanan.trim().slice(0, 30));
      } else {
        setLabel('');
      }
      setErrorMessage(null);
    }
  }, [isOpen, draf]);

  if (!isOpen) return null;

  const ringkasan = keranjangService.kalkulasiRingkasan(draf);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) {
      setErrorMessage('Label pesanan (nomor meja atau nama pelanggan) wajib diisi.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await onSave(trimmed);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal menyimpan open bill.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 text-base sm:text-lg">
                Simpan Open Bill
              </h3>
              <p className="text-[11px] text-stone-500">
                Gantung pesanan untuk diselesaikan nanti
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-200/70 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Info Ringkasan Pesanan */}
          <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-stone-500 font-medium">Isi Pesanan:</span>
              <p className="font-bold text-stone-800">
                {ringkasan.totalItemCount} item ({draf.tipePesanan === 'dine_in' ? 'Dine-in' : 'Takeaway'})
              </p>
            </div>
            <div className="text-right">
              <span className="text-stone-500 font-medium">Total Sementara:</span>
              <p className="font-black text-stone-900 text-sm">
                {formatRupiah(ringkasan.totalAkhir)}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Label Pesanan (No. Meja / Nama Pelanggan) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Contoh: Meja 05, Pak Budi, atau Ojol Grab #12"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Setelah disimpan, keranjang aktif akan dikosongkan dan dapat diakses kembali di tab <strong>Open Bill</strong>.
            </p>
          </div>

          {/* Tombol Aksi */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              id="confirm-save-open-bill-button"
              disabled={loading || !label.trim()}
              className="flex-2 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan ke Open Bill</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
