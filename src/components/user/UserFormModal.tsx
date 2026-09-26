import React, { useState, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Store,
  KeyRound,
  AlertCircle,
  Loader2,
  Info,
} from 'lucide-react';
import { User, Outlet, UserRole, UserStatus } from '../../types';
import { CreateUserInput, UpdateUserProfileInput } from '../../services/userService';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCreate: (data: CreateUserInput) => Promise<void>;
  onSubmitUpdate: (uid: string, data: UpdateUserProfileInput) => Promise<void>;
  onSendPasswordReset: (email: string) => Promise<void>;
  user?: User | null;
  outlets: Outlet[];
}

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  onSubmitCreate,
  onSubmitUpdate,
  onSendPasswordReset,
  user,
  outlets,
}) => {
  const isEditMode = Boolean(user);

  // Form states
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'owner' | 'kasir'>('kasir');
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [status, setStatus] = useState<UserStatus>('active');

  // Async states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [modalErrorMessage, setModalErrorMessage] = useState<string | null>(null);

  // Field errors
  const [errors, setErrors] = useState<{
    nama?: string;
    email?: string;
    password?: string;
    outlets?: string;
  }>({});

  // Reset / initialize saat modal dibuka atau target user berubah
  useEffect(() => {
    if (isOpen) {
      if (user) {
        setNama(user.nama || '');
        setEmail(user.email || '');
        setPassword('');
        setRole(user.role === 'owner' ? 'owner' : 'kasir');
        setSelectedOutletIds(Array.isArray(user.outletIds) ? user.outletIds : []);
        setStatus(user.status || 'active');
      } else {
        setNama('');
        setEmail('');
        setPassword('');
        setRole('kasir');
        setSelectedOutletIds(outlets.length === 1 ? [outlets[0].id] : []);
        setStatus('active');
      }
      setShowPassword(false);
      setErrors({});
      setModalErrorMessage(null);
      setResetSuccessMessage(null);
      setIsSubmitting(false);
      setIsSendingReset(false);
    }
  }, [isOpen, user, outlets]);

  if (!isOpen) return null;

  const isLegacyMultiOutletKasir = isEditMode && role === 'kasir' && selectedOutletIds.length > 1;

  const handleSelectOutlet = (outletId: string) => {
    if (role === 'kasir') {
      setSelectedOutletIds([outletId]);
      if (errors.outlets) {
        setErrors((e) => ({ ...e, outlets: undefined }));
      }
    } else {
      setSelectedOutletIds((prev) => {
        const next = prev.includes(outletId)
          ? prev.filter((id) => id !== outletId)
          : [...prev, outletId];
        if (errors.outlets && next.length > 0) {
          setErrors((e) => ({ ...e, outlets: undefined }));
        }
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: {
      nama?: string;
      email?: string;
      password?: string;
      outlets?: string;
    } = {};

    const trimmedNama = nama.trim();
    if (!trimmedNama) {
      errs.nama = 'Nama pengguna tidak boleh kosong.';
    } else if (trimmedNama.length < 3) {
      errs.nama = 'Nama pengguna minimal 3 karakter.';
    }

    if (!isEditMode) {
      const trimmedEmail = email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!trimmedEmail) {
        errs.email = 'Alamat email wajib diisi.';
      } else if (!emailRegex.test(trimmedEmail)) {
        errs.email = 'Format alamat email tidak valid.';
      }

      if (!password) {
        errs.password = 'Kata sandi awal wajib diisi.';
      } else if (password.length < 8) {
        errs.password = 'Kata sandi awal minimal 8 karakter.';
      }
    }

    if (role === 'kasir') {
      if (selectedOutletIds.length !== 1) {
        errs.outlets = 'Kasir hanya dapat ditugaskan ke satu cabang outlet.';
      }
    } else {
      if (selectedOutletIds.length === 0) {
        errs.outlets = 'Wajib memilih minimal satu outlet penugasan.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalErrorMessage(null);
    setResetSuccessMessage(null);

    if (!validate()) return;

    try {
      setIsSubmitting(true);
      if (isEditMode && user) {
        await onSubmitUpdate(user.id, {
          nama: nama.trim(),
          role,
          outletIds: selectedOutletIds,
          status,
        });
      } else {
        await onSubmitCreate({
          nama: nama.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          outletIds: selectedOutletIds,
        });
      }
      onClose();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses data pengguna.';
      setModalErrorMessage(errorMsg);
      // Form TETAP terbuka agar user bisa memperbaiki input
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!user || !user.email) return;
    setModalErrorMessage(null);
    setResetSuccessMessage(null);
    try {
      setIsSendingReset(true);
      await onSendPasswordReset(user.email);
      setResetSuccessMessage(`Tautan reset kata sandi telah dikirim ke ${user.email}.`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Gagal mengirim email reset kata sandi.';
      setModalErrorMessage(errorMsg);
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-user-title"
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
            <h2 id="modal-user-title" className="text-base font-bold text-stone-900">
              {isEditMode ? 'Edit Profil Pengguna' : 'Tambah Pengguna Baru'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isSendingReset}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-4">
          {/* Banner Error di dalam modal (form tetap terbuka) */}
          {modalErrorMessage && (
            <div
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{modalErrorMessage}</div>
            </div>
          )}

          {/* Banner Sukses Reset Password */}
          {resetSuccessMessage && (
            <div
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in"
              role="alert"
            >
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{resetSuccessMessage}</div>
            </div>
          )}

          {/* Input Nama */}
          <div>
            <label htmlFor="user-nama" className="block text-xs font-bold text-stone-700 mb-1">
              Nama Lengkap <span className="text-rose-500">*</span>
            </label>
            <input
              id="user-nama"
              type="text"
              value={nama}
              onChange={(e) => {
                setNama(e.target.value);
                if (errors.nama) setErrors((prev) => ({ ...prev, nama: undefined }));
              }}
              placeholder="Contoh: Budi Santoso"
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 rounded-lg text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                errors.nama
                  ? 'border-rose-300 focus:ring-rose-500/30'
                  : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
              }`}
            />
            {errors.nama && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.nama}</p>
            )}
          </div>

          {/* Input Email */}
          <div>
            <label htmlFor="user-email" className="block text-xs font-bold text-stone-700 mb-1">
              Alamat Email <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="user-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                placeholder="nama@outlet.com"
                disabled={isEditMode || isSubmitting}
                className={`w-full pl-9 pr-3.5 py-2 rounded-lg text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                  isEditMode ? 'bg-stone-100 text-stone-500 cursor-not-allowed border-stone-200' : ''
                } ${
                  errors.email
                    ? 'border-rose-300 focus:ring-rose-500/30'
                    : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
                }`}
              />
            </div>
            {errors.email ? (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.email}</p>
            ) : isEditMode ? (
              <p className="text-[11px] text-stone-400 mt-1">Email login tidak dapat diubah.</p>
            ) : null}
          </div>

          {/* Input Kata Sandi Awal (HANYA mode create) */}
          {!isEditMode && (
            <div>
              <label
                htmlFor="user-password"
                className="block text-xs font-bold text-stone-700 mb-1"
              >
                Kata Sandi Awal <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="user-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="Minimal 8 karakter"
                  disabled={isSubmitting}
                  className={`w-full pl-9 pr-10 py-2 rounded-lg text-sm border bg-stone-50/50 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 transition ${
                    errors.password
                      ? 'border-rose-300 focus:ring-rose-500/30'
                      : 'border-stone-200 focus:ring-orange-500/30 focus:border-orange-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.password}</p>
              )}
              {/* Catatan Info Kata Sandi */}
              <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Kata sandi awal tidak disimpan di database aplikasi. Sampaikan manual kepada
                  pengguna.
                </span>
              </div>
            </div>
          )}

          {/* Pilihan Role: owner | kasir */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Peran Akun <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRole('kasir');
                  if (!isEditMode && selectedOutletIds.length > 1) {
                    setSelectedOutletIds(selectedOutletIds.slice(0, 1));
                  }
                  if (errors.outlets) setErrors((prev) => ({ ...prev, outlets: undefined }));
                }}
                disabled={isSubmitting}
                className={`p-2.5 rounded-xl border text-left transition ${
                  role === 'kasir'
                    ? 'border-emerald-500 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <div className="text-xs font-bold">Kasir POS</div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  Akses POS transaksi & open bill
                </div>
              </button>

              <button
                type="button"
                onClick={() => setRole('owner')}
                disabled={isSubmitting}
                className={`p-2.5 rounded-xl border text-left transition ${
                  role === 'owner'
                    ? 'border-blue-500 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
                }`}
              >
                <div className="text-xs font-bold">Owner Outlet</div>
                <div className="text-[10px] text-stone-500 mt-0.5">
                  Kelola menu, resep, & laporan cabang
                </div>
              </button>
            </div>
          </div>

          {/* Checkbox / Radio Penugasan Outlet */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-stone-700">
                Penugasan Cabang Outlet <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-stone-400">
                {role === 'kasir' ? 'Pilih tepat 1 cabang' : 'Pilih minimal 1 cabang'}
              </span>
            </div>

            {/* Banner peringatan jika kasir memiliki > 1 outlet (data lama) */}
            {isLegacyMultiOutletKasir && (
              <div className="flex items-start gap-2 p-3 mb-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs animate-in fade-in">
                <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <p className="font-bold text-amber-900">Perhatian Penugasan Kasir</p>
                  <p className="text-[11px] mt-0.5 text-amber-800">
                    Kasir ini tertaut ke beberapa outlet (data lama). Simpan dengan memilih tepat satu outlet.
                  </p>
                </div>
              </div>
            )}

            {outlets.length === 0 ? (
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200 text-stone-500 text-xs text-center">
                Belum ada outlet terdaftar dalam sistem.
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-xl border border-stone-200 bg-stone-50/40">
                {outlets.map((outlet) => {
                  const isChecked = selectedOutletIds.includes(outlet.id);
                  return (
                    <label
                      key={outlet.id}
                      className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition select-none ${
                        isChecked
                          ? 'bg-orange-50/70 text-orange-900 border border-orange-200'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-100'
                      }`}
                    >
                      <input
                        type={role === 'kasir' ? 'radio' : 'checkbox'}
                        name="user-outlet-assignment"
                        checked={isChecked}
                        onChange={() => handleSelectOutlet(outlet.id)}
                        disabled={isSubmitting}
                        className={`${
                          role === 'kasir' ? 'rounded-full' : 'rounded'
                        } border-stone-300 text-orange-600 focus:ring-orange-500 w-4 h-4`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{outlet.nama}</div>
                        {outlet.alamat && (
                          <div className="text-[10px] text-stone-400 truncate">
                            {outlet.alamat}
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
            {errors.outlets && (
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{errors.outlets}</p>
            )}
          </div>

          {/* Toggle Status Pengguna (HANYA mode edit) */}
          {isEditMode && (
            <div className="pt-2 border-t border-stone-100">
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                Status Akun
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="user-status"
                    checked={status === 'active'}
                    onChange={() => setStatus('active')}
                    disabled={isSubmitting}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-emerald-700">Aktif</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="radio"
                    name="user-status"
                    checked={status === 'disabled'}
                    onChange={() => setStatus('disabled')}
                    disabled={isSubmitting}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span className="font-semibold text-rose-700">Nonaktif</span>
                </label>
              </div>
            </div>
          )}

          {/* Tombol Kirim Email Reset Kata Sandi (HANYA mode edit) */}
          {isEditMode && (
            <div className="pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={handleSendResetEmail}
                disabled={isSendingReset || isSubmitting}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
              >
                {isSendingReset ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim tautan reset...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-stone-500" />
                    <span>Kirim Email Reset Kata Sandi</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isSendingReset}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isSendingReset}
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
