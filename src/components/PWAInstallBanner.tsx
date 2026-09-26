import React, { useState } from 'react';
import { Download, X, Smartphone, Info } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) {
    return null;
  }

  if (isInstallable) {
    return (
      <div className="bg-amber-500 text-stone-900 px-3 py-2 text-xs flex items-center justify-between border-b border-amber-600/30">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-stone-900" />
          <span className="font-medium">Pasang aplikasi ini di layar utama HP untuk akses cepat offline</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={install}
            className="flex items-center gap-1.5 bg-stone-900 text-white font-semibold px-2.5 py-1 rounded text-xs hover:bg-stone-800 transition active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            Install PWA
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Tutup saran instalasi"
            className="p-1 hover:bg-amber-600/20 rounded text-stone-900"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (isIOS) {
    return (
      <>
        <div className="bg-stone-800 text-stone-200 px-3 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400" />
            <span>Pasang di iPhone / iPad untuk mode layar penuh</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowIOSGuide(true)}
              className="bg-amber-500 text-stone-900 font-semibold px-2.5 py-1 rounded text-xs hover:bg-amber-400 transition"
            >
              Panduan iOS
            </button>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Tutup"
              className="p-1 hover:bg-stone-700 rounded text-stone-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-stone-800 border border-stone-200">
              <h3 className="text-base font-bold text-stone-900 mb-2 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-500" />
                Pasang di Layar Utama iPhone
              </h3>
              <ol className="text-xs text-stone-600 space-y-2 mb-4 list-decimal pl-4">
                <li>Buka di browser Safari.</li>
                <li>
                  Ketuk tombol <strong>Share</strong> (ikon kotak dengan panah ke atas) di bilah bawah.
                </li>
                <li>
                  Gulir ke bawah lalu ketuk <strong>Add to Home Screen</strong> (Tambah ke Layar Utama).
                </li>
                <li>Aplikasi POS F&B akan siap digunakan seperti aplikasi asli.</li>
              </ol>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-stone-900 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 transition"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
