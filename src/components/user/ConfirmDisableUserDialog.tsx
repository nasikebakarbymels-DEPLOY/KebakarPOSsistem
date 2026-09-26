import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDisableUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  userName: string;
}

export const ConfirmDisableUserDialog: React.FC<ConfirmDisableUserDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('[ConfirmDisableUserDialog] Gagal menonaktifkan pengguna:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-disable-user-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 space-y-4">
        {/* Warning Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 id="confirm-disable-user-title" className="text-base font-bold text-stone-900">
              Nonaktifkan Pengguna?
            </h2>
            <p className="text-xs text-stone-500">Konfirmasi status akun</p>
          </div>
        </div>

        {/* Message */}
        <p className="text-xs text-stone-600 leading-relaxed">
          Akun <span className="font-semibold text-stone-900">"{userName}"</span> akan dinonaktifkan. Pengguna tidak akan bisa login selama status nonaktif. Tindakan ini dapat diaktifkan kembali sewaktu-waktu.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <span>Nonaktifkan</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
