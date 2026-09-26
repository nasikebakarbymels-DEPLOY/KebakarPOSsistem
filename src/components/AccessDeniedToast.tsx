import React from 'react';
import { ShieldX, X } from 'lucide-react';

interface AccessDeniedToastProps {
  message: string | null;
  onDismiss: () => void;
}

export const AccessDeniedToast: React.FC<AccessDeniedToastProps> = ({ message, onDismiss }) => {
  if (!message) return null;

  return (
    <div className="fixed top-16 left-4 right-4 z-50 max-w-md mx-auto animate-in slide-in-from-top duration-200">
      <div className="bg-rose-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-rose-700/60 flex items-start gap-3 backdrop-blur-md">
        <div className="p-1.5 rounded-xl bg-rose-800 text-rose-200 shrink-0 mt-0.5">
          <ShieldX className="w-5 h-5 text-rose-300" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wider">Akses Ditolak</h4>
          <p className="text-xs font-medium text-rose-50 mt-0.5 leading-snug">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg text-rose-300 hover:text-white hover:bg-rose-800 transition shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
