import React, { useState } from 'react';
import { X, Check, Wallet, Calendar, AlertCircle } from 'lucide-react';
import { Transaksi } from '../../types';
import { formatRupiah, getTodayDateString } from '../../utils/formatters';

interface CatatCicilanModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaksi: Transaksi;
  outletId: string;
  onSuccess: (updatedCicilan: any) => void;
  onCatat: (payload: {
    transaksiId: string;
    jumlah: number;
    metode: 'tunai' | 'transfer';
    tanggal: string;
    catatan?: string;
  }) => Promise<void>;
}

export const CatatCicilanModal: React.FC<CatatCicilanModalProps> = ({
  isOpen,
  onClose,
  transaksi,
  outletId,
  onSuccess,
  onCatat,
}) => {
  const sisaHutang = transaksi.pembayaran?.sisaHutang || 0;

  const [jumlah, setJumlah] = useState<string>('');
  const [metode, setMetode] = useState<'tunai' | 'transfer'>('tunai');
  const [tanggal, setTanggal] = useState<string>(() => getTodayDateString());
  const [catatan, setCatatan] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSetBayarLunas = () => {
    setJumlah(sisaHutang.toString());
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const nominalAngka = Number(jumlah);
    if (!jumlah || isNaN(nominalAngka) || nominalAngka <= 0) {
      setErrorMessage('Nominal pembayaran cicilan harus lebih dari Rp 0.');
      return;
    }

    if (nominalAngka > sisaHutang) {
      setErrorMessage(
        `Nominal pembayaran (${formatRupiah(
          nominalAngka
        )}) tidak boleh melebihi sisa hutang saat ini (${formatRupiah(sisaHutang)}).`
      );
      return;
    }

    if (!tanggal) {
      setErrorMessage('Tanggal pembayaran wajib dipilih.');
      return;
    }

    setSubmitting(true);
    try {
      await onCatat({
        transaksiId: transaksi.id,
        jumlah: nominalAngka,
        metode,
        tanggal,
        catatan: catatan.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Gagal menyimpan pembayaran cicilan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
          <div>
            <h3 className="font-extrabold text-stone-900 text-sm">
              Catat Pembayaran Cicilan
            </h3>
            <p className="text-[11px] text-stone-500">
              Pelanggan: {transaksi.pembayaran?.pelangganNama || 'Pelanggan'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-stone-200/70 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Info Transaksi & Sisa Hutang */}
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs space-y-1.5">
            <div className="flex justify-between text-stone-500">
              <span>No. Transaksi:</span>
              <span className="font-mono font-bold text-stone-800">
                {transaksi.nomorTransaksi}
              </span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Total Tagihan Awal:</span>
              <span className="font-medium text-stone-800">
                {formatRupiah(transaksi.totalAkhir)}
              </span>
            </div>
            <div className="flex justify-between text-stone-900 font-bold pt-1 border-t border-dashed border-stone-200 text-sm">
              <span>Sisa Hutang Saat Ini:</span>
              <span className="text-red-600">{formatRupiah(sisaHutang)}</span>
            </div>
          </div>

          {/* Input Nominal Pembayaran */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700">
                Jumlah Pembayaran <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleSetBayarLunas}
                className="text-[11px] text-orange-600 font-bold hover:underline"
              >
                Bayar Lunas ({formatRupiah(sisaHutang)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                Rp
              </span>
              <input
                type="number"
                id="input-jumlah-cicilan"
                min="1"
                max={sisaHutang}
                value={jumlah}
                onChange={(e) => {
                  setJumlah(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="Masukkan nominal bayar"
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-stone-200 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                required
              />
            </div>
          </div>

          {/* Metode Pembayaran Cicilan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700">
              Metode Pembayaran
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMetode('tunai')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  metode === 'tunai'
                    ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Tunai (Cash)</span>
              </button>
              <button
                type="button"
                onClick={() => setMetode('transfer')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  metode === 'transfer'
                    ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span>Transfer Bank / QRIS</span>
              </button>
            </div>
          </div>

          {/* Input Tanggal */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700">
              Tanggal Pembayaran <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              required
            />
          </div>

          {/* Catatan Opsional */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-stone-700">
              Catatan Pembayaran (Opsional)
            </label>
            <input
              type="text"
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Titip lewat kasir sore"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-stone-200 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50"
            >
              Batal
            </button>
            <button
              type="submit"
              id="btn-simpan-cicilan"
              disabled={submitting}
              className="flex-2 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1.5"
            >
              {submitting ? (
                <span>Menyimpan...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Pembayaran</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
