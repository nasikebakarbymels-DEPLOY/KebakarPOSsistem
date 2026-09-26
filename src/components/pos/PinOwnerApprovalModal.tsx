import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Receipt,
  DollarSign,
  Percent,
} from 'lucide-react';
import { BiayaLain, ApprovalBiayaManual } from '../../types';
import { pinOwnerCloudService } from '../../services/cloud/pinOwnerCloudService';
import { hitungSubtotalBiaya } from '../../services/cloud/biayaLainCloudService';
import { formatRupiah } from '../../utils/formatters';

interface PinOwnerApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletId: string;
  biaya: BiayaLain | null;
  netoSetelahVoucher: number;
  initialValue?: number;
  currentKasir: { id: string; nama: string };
  onApproved: (manualValue: number, approval: ApprovalBiayaManual) => void;
}

export const PinOwnerApprovalModal: React.FC<PinOwnerApprovalModalProps> = ({
  isOpen,
  onClose,
  outletId,
  biaya,
  netoSetelahVoucher,
  initialValue,
  currentKasir,
  onApproved,
}) => {
  const [manualValueInput, setManualValueInput] = useState<string>('');
  const [pinInput, setPinInput] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State lokal pembatas percobaan gagal & lockout
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState<number>(0);
  const closeTimestampRef = React.useRef<number | null>(null);

  // Cek apakah form sedang terkunci karena terlalu banyak percobaan
  const isLockedOut = Boolean(lockoutUntil && Date.now() < lockoutUntil);

  // Interval hitung mundur saat lockout aktif
  useEffect(() => {
    if (!lockoutUntil) return;

    const checkLockout = () => {
      const remainingMs = lockoutUntil - Date.now();
      if (remainingMs <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        setErrorMessage(null);
      } else {
        setRemainingMinutes(Math.ceil(remainingMs / 60000));
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  // Efek saat modal dibuka atau ditutup
  useEffect(() => {
    if (isOpen) {
      // Jika modal sebelumnya ditutup lama (>= 10 menit), reset penghitung gagal
      if (closeTimestampRef.current) {
        const closedDuration = Date.now() - closeTimestampRef.current;
        if (closedDuration >= 10 * 60 * 1000) {
          setFailedAttempts(0);
          setLockoutUntil(null);
          setErrorMessage(null);
        }
      }

      if (biaya) {
        const defaultVal =
          typeof initialValue === 'number'
            ? initialValue
            : typeof biaya.nilaiDefault === 'number'
            ? biaya.nilaiDefault
            : typeof biaya.nilai === 'number'
            ? biaya.nilai
            : 0;

        setManualValueInput(defaultVal > 0 ? String(defaultVal) : '');
        setPinInput('');
        if (!isLockedOut) {
          setErrorMessage(null);
        }
        setIsVerifying(false);
      }
    } else {
      // Catat timestamp saat modal ditutup
      closeTimestampRef.current = Date.now();
    }
  }, [isOpen, biaya, initialValue, isLockedOut]);

  if (!isOpen || !biaya) return null;

  const defaultVal =
    typeof biaya.nilaiDefault === 'number'
      ? biaya.nilaiDefault
      : typeof biaya.nilai === 'number'
      ? biaya.nilai
      : 0;

  const parsedManualVal = parseFloat(manualValueInput.replace(/[^0-9.]/g, '')) || 0;

  const subtotalDefault = hitungSubtotalBiaya(biaya, netoSetelahVoucher, defaultVal);
  const subtotalManual = hitungSubtotalBiaya(biaya, netoSetelahVoucher, parsedManualVal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut) {
      setErrorMessage(`Terlalu banyak percobaan. Coba lagi dalam ${remainingMinutes || 1} menit.`);
      return;
    }

    setErrorMessage(null);

    if (parsedManualVal <= 0) {
      setErrorMessage('Nilai biaya manual harus lebih besar dari 0.');
      return;
    }

    if (biaya.tipe === 'persen' && parsedManualVal > 100) {
      setErrorMessage('Nilai persentase maksimal 100%.');
      return;
    }

    const cleanPin = pinInput.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      setErrorMessage('PIN Owner harus berupa 4 hingga 6 digit angka.');
      return;
    }

    setIsVerifying(true);

    try {
      const res = await pinOwnerCloudService.verifyPinOwner(outletId, cleanPin);

      if (!res.hasPinConfigured) {
        setErrorMessage(
          'PIN Owner belum diatur pada outlet ini. Hubungi Owner untuk mengatur PIN melalui menu Promo & Biaya > PIN Owner.'
        );
        setIsVerifying(false);
        return;
      }

      if (!res.valid) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          const lockTime = Date.now() + 10 * 60 * 1000; // 10 menit
          setLockoutUntil(lockTime);
          setRemainingMinutes(10);
          setErrorMessage('Terlalu banyak percobaan. Coba lagi dalam 10 menit.');
        } else {
          setErrorMessage(
            `${res.message || 'PIN Owner yang Anda masukkan salah.'} (Gagal ${nextAttempts}/5)`
          );
        }
        setIsVerifying(false);
        return;
      }

      // Validasi sukses -> reset penghitung dan buat record persetujuan
      setFailedAttempts(0);
      setLockoutUntil(null);
      setErrorMessage(null);

      const approvalRecord: ApprovalBiayaManual = {
        biayaId: biaya.id,
        biayaNama: biaya.nama,
        nilaiDefault: defaultVal,
        nilaiManual: parsedManualVal,
        tipe: biaya.tipe,
        kasirId: currentKasir.id || 'kasir',
        kasirNama: currentKasir.nama || 'Kasir',
        approvedAt: new Date().toISOString(),
      };

      onApproved(parsedManualVal, approvalRecord);
      onClose();
    } catch (err: unknown) {
      console.error('[PinOwnerApprovalModal] Gagal verifikasi PIN:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Terjadi kendala saat memeriksa PIN Owner.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border border-stone-200 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-stone-900">
                Persetujuan Biaya Manual
              </h3>
              <p className="text-[11px] text-stone-500">
                Memerlukan otorisasi PIN Owner untuk mengubah nilai biaya
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isVerifying}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Info Biaya Terpilih */}
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">Nama Biaya:</span>
              <span className="font-bold text-stone-900">{biaya.nama}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">Tipe Biaya:</span>
              <span className="font-semibold text-stone-700 uppercase">
                {biaya.tipe === 'persen' ? 'Persentase (%)' : 'Nominal Tetap (Rp)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-stone-200/60 pt-1.5">
              <span className="text-stone-500 font-medium">Nilai Default Sistem:</span>
              <span className="font-mono font-bold text-stone-800">
                {biaya.tipe === 'persen' ? `${defaultVal}%` : formatRupiah(defaultVal)}
                <span className="text-[10px] text-stone-500 ml-1 font-normal">
                  ({formatRupiah(subtotalDefault)})
                </span>
              </span>
            </div>
          </div>

          {/* Input Nilai Manual Baru */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-stone-800">
              Nilai Baru / Manual ({biaya.tipe === 'persen' ? '%' : 'Rp'}){' '}
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step={biaya.tipe === 'persen' ? '0.5' : '500'}
                min="0"
                max={biaya.tipe === 'persen' ? '100' : undefined}
                disabled={isVerifying || isLockedOut}
                value={manualValueInput}
                onChange={(e) => {
                  setManualValueInput(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder={biaya.tipe === 'persen' ? '10' : '15000'}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-stone-300 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 disabled:bg-stone-100 disabled:text-stone-400"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                {biaya.tipe === 'persen' ? '%' : 'Rp'}
              </span>
            </div>
            {parsedManualVal > 0 && (
              <p className="text-[11px] text-emerald-700 font-medium flex items-center justify-between pt-0.5">
                <span>Subtotal biaya baru:</span>
                <span className="font-mono font-bold">+{formatRupiah(subtotalManual)}</span>
              </p>
            )}
          </div>

          {/* Input PIN Owner */}
          <div className="space-y-1 pt-1">
            <label className="block text-xs font-bold text-stone-800 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-orange-600" />
              <span>PIN Otorisasi Owner</span> <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              disabled={isVerifying || isLockedOut}
              value={pinInput}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setPinInput(val);
                setErrorMessage(null);
              }}
              placeholder="Masukkan 4-6 digit PIN Owner"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-center tracking-[0.3em] text-lg font-mono font-black text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 disabled:bg-stone-100 disabled:text-stone-400"
            />
            <p className="text-[10px] text-stone-400 text-center">
              Minta Owner untuk memasukkan PIN otorisasi
            </p>
          </div>

          {/* Error Message Box / Lockout Warning */}
          {(isLockedOut || errorMessage) && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">
                {isLockedOut
                  ? `Terlalu banyak percobaan. Coba lagi dalam ${remainingMinutes || 1} menit.`
                  : errorMessage}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              disabled={isVerifying}
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isVerifying || isLockedOut || !pinInput || parsedManualVal <= 0}
              className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Setujui & Terapkan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
