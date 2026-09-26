import React, { useState } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Loader2,
  Construction,
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Package,
} from 'lucide-react';
import { ActiveTab, UserRole } from '../types';

interface PlaceholderPageProps {
  title: string;
  tabKey: ActiveTab;
  userRole: UserRole;
  description: string;
  roadmapDetails: string[];
  onBackToHome?: () => void;
  onAttemptUnauthorizedAction?: (targetFeature: string) => void;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({
  title,
  tabKey,
  userRole,
  description,
  roadmapDetails,
  onBackToHome,
  onAttemptUnauthorizedAction,
}) => {
  // State simulation for testing: 'ready' (default display), 'loading', 'empty', 'error'
  const [viewState, setViewState] = useState<'ready' | 'loading' | 'empty' | 'error'>('ready');
  const [errorMessage, setErrorMessage] = useState<string>('Gagal menyinkronkan data dari server lokal. Silakan periksa koneksi.');

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto pb-24">
      {/* Top Page Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-200/60 transition"
              title="Kembali ke Beranda"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">{title}</h2>
            <p className="text-xs text-stone-500">Menu ID: <span className="font-mono text-stone-600">{tabKey}</span></p>
          </div>
        </div>

        {/* State Simulator Switcher for Quality Verification */}
        <div className="flex items-center gap-1 bg-stone-200/80 p-1 rounded-xl text-[10px] font-semibold text-stone-700">
          <button
            onClick={() => setViewState('ready')}
            className={`px-2 py-1 rounded-lg transition ${
              viewState === 'ready' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            Normal
          </button>
          <button
            onClick={() => setViewState('loading')}
            className={`px-2 py-1 rounded-lg transition ${
              viewState === 'loading' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            Loading
          </button>
          <button
            onClick={() => setViewState('empty')}
            className={`px-2 py-1 rounded-lg transition ${
              viewState === 'empty' ? 'bg-white text-stone-900 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            Empty
          </button>
          <button
            onClick={() => setViewState('error')}
            className={`px-2 py-1 rounded-lg transition ${
              viewState === 'error' ? 'bg-white text-rose-700 shadow-xs' : 'hover:text-stone-900'
            }`}
          >
            Error
          </button>
        </div>
      </div>

      {/* 1. LOADING STATE */}
      {viewState === 'loading' && (
        <div className="bg-white rounded-2xl p-8 border border-stone-200 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mx-auto text-orange-600">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-800">Memuat Data Halaman {title}...</h3>
            <p className="text-xs text-stone-500 mt-1">Mengambil data konfigurasi dan konteks outlet terkini</p>
          </div>
          <div className="space-y-2 pt-2">
            <div className="h-4 bg-stone-100 rounded-md animate-pulse w-3/4 mx-auto"></div>
            <div className="h-4 bg-stone-100 rounded-md animate-pulse w-1/2 mx-auto"></div>
          </div>
          <button
            onClick={() => setViewState('ready')}
            className="text-xs text-orange-600 font-semibold underline pt-2 inline-block"
          >
            Kembali ke Tampilan Normal
          </button>
        </div>
      )}

      {/* 2. ERROR STATE */}
      {viewState === 'error' && (
        <div className="bg-white rounded-2xl p-6 border border-rose-200 shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto text-rose-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-900">Terjadi Kesalahan</h3>
          <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
            {errorMessage}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              onClick={() => {
                setViewState('loading');
                setTimeout(() => setViewState('ready'), 600);
              }}
              className="inline-flex items-center gap-1.5 bg-rose-600 text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-rose-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Coba Lagi
            </button>
            <button
              onClick={() => setViewState('ready')}
              className="px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* 3. EMPTY STATE */}
      {viewState === 'empty' && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800">Data Masih Kosong</h3>
          <p className="text-xs text-stone-500 max-w-xs mx-auto">
            Belum ada catatan atau aktivitas pada menu ini untuk outlet saat ini.
          </p>
          <button
            onClick={() => setViewState('ready')}
            className="text-xs text-orange-600 font-semibold underline pt-2"
          >
            Tampilkan Informasi Fitur
          </button>
        </div>
      )}

      {/* 4. READY / DEFAULT STATE (Placeholder Menu Sesuai Spesifikasi Fase 1) */}
      {viewState === 'ready' && (
        <div className="space-y-4">
          {/* Main Empty State Banner as required: "Fitur ini akan dibangun pada fase berikutnya" */}
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-xs text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-100">
              <Construction className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-stone-900">
              Fitur ini akan dibangun pada fase berikutnya
            </h3>
            <p className="text-xs text-stone-600 mt-2 leading-relaxed">
              {description}
            </p>

            <div className="mt-4 pt-4 border-t border-stone-100 text-left">
              <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Cakupan Fitur pada Fase Mendatang:
              </h4>
              <ul className="text-xs text-stone-600 space-y-1.5 pl-2">
                {roadmapDetails.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Test Action / Security Boundary Tester */}
          {onAttemptUnauthorizedAction && (
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200/80">
              <div className="flex items-center gap-2 mb-2">
                <ShieldAlert className="w-4 h-4 text-stone-500" />
                <span className="text-xs font-bold text-stone-700">Uji Proteksi Hak Akses (Role Guard)</span>
              </div>
              <p className="text-[11px] text-stone-500 mb-2.5">
                Klik tombol di bawah untuk menguji penolakan akses jika role Anda tidak diizinkan mengakses fitur lain.
              </p>
              <div className="flex flex-wrap gap-2">
                {userRole === 'kasir' && (
                  <>
                    <button
                      onClick={() => onAttemptUnauthorizedAction('Kelola Produk & Resep HPP')}
                      className="text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition"
                    >
                      Coba Buka Produk (Role Kasir dilarang)
                    </button>
                    <button
                      onClick={() => onAttemptUnauthorizedAction('Laporan Laba/Rugi Owner')}
                      className="text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1.5 rounded-lg hover:bg-rose-100 transition"
                    >
                      Coba Buka Laporan (Role Kasir dilarang)
                    </button>
                  </>
                )}
                {userRole === 'owner' && (
                  <button
                    onClick={() => onAttemptUnauthorizedAction('Dashboard Agregat Super Admin')}
                    className="text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1.5 rounded-lg hover:bg-purple-100 transition"
                  >
                    Coba Buka Super Admin (Role Owner dilarang)
                  </button>
                )}
                {userRole === 'super_admin' && (
                  <button
                    onClick={() => onAttemptUnauthorizedAction('Edit Menu & Harga Outlet')}
                    className="text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1.5 rounded-lg hover:bg-amber-100 transition"
                  >
                    Coba Edit Data Outlet (Super Admin dilarang)
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
