import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Store,
  Loader2,
  AlertCircle,
  ChevronRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Building2,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PWAInstallBanner } from '../components/PWAInstallBanner';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = 'Email wajib diisi.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = 'Format email tidak valid (contoh: user@outlet.com).';
    }

    if (!password) {
      errors.password = 'Kata sandi wajib diisi.';
    } else if (password.length < 6) {
      errors.password = 'Kata sandi minimal 6 karakter.';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(email, password);
      if (!res.success) {
        setErrorMessage(res.message || 'Kredensial tidak valid.');
      }
    } catch {
      setErrorMessage('Terjadi kendala pada server autentikasi. Silakan periksa koneksi Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between">
      <PWAInstallBanner />

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200">
          {/* Header Brand */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-600 text-white shadow-md shadow-orange-500/20 mb-3">
              <Store className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-stone-900 tracking-tight">POS F&B Multi-Outlet</h1>
            <p className="text-xs text-stone-500 mt-1">Sistem Kasir & Operasional Terintegrasi Cloud Sync</p>
          </div>

          {/* Error Alert Box */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Gagal Masuk</p>
                <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Form Login */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Input Email */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5" htmlFor="login-email">
                Alamat Email <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                    if (validationErrors.email) {
                      setValidationErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  disabled={isLoading}
                  placeholder="kasir@outlet.com"
                  autoComplete="email"
                  className={`w-full pl-10 pr-3 py-3 rounded-xl text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                    validationErrors.email
                      ? 'border-rose-300 focus:ring-rose-500/30 bg-rose-50/30'
                      : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
                  }`}
                />
              </div>
              {validationErrors.email && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{validationErrors.email}</p>
              )}
            </div>

            {/* Input Password */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5" htmlFor="login-password">
                Kata Sandi <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                    if (validationErrors.password) {
                      setValidationErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  disabled={isLoading}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  className={`w-full pl-10 pr-10 py-3 rounded-xl text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                    validationErrors.password
                      ? 'border-rose-300 focus:ring-rose-500/30 bg-rose-50/30'
                      : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {validationErrors.password && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{validationErrors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-orange-600 text-white font-bold text-sm shadow-md hover:bg-orange-700 transition active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Akun</span>
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Role Information Card */}
          <div className="mt-6 pt-5 border-t border-stone-100">
            <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block mb-2.5">
              Tingkatan Akses & Hak Peran
            </span>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-100 flex items-start gap-2.5">
                <Building2 className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-purple-900">Super Admin</span>
                  <p className="text-[11px] text-purple-700">
                    Melihat ringkasan seluruh outlet secara read-only dan mengelola pendaftaran outlet baru.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-blue-900">Owner Outlet</span>
                  <p className="text-[11px] text-blue-700">
                    Mengelola produk, HPP, resep, pembelian bahan, pengeluaran, dan laporan outlet miliknya.
                  </p>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-2.5">
                <Receipt className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-emerald-900">Kasir</span>
                  <p className="text-[11px] text-emerald-700">
                    Mengakses POS, open bill, riwayat transaksi, dan sinkronisasi transaksi offline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <footer className="py-3 text-center text-xs text-stone-400 border-t border-stone-200 bg-stone-50">
        POS F&B Multi-Outlet &bull; Fondasi Backend Firebase & Offline-First Sync
      </footer>
    </div>
  );
};
