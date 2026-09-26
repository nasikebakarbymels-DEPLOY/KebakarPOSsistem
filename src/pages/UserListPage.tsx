import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { User, Outlet, UserRole } from '../types';
import { userService, CreateUserInput, UpdateUserProfileInput } from '../services/userService';
import { outletService } from '../services/outletService';
import { UserCard } from '../components/user/UserCard';
import { UserFormModal } from '../components/user/UserFormModal';
import { ConfirmDisableUserDialog } from '../components/user/ConfirmDisableUserDialog';

export const UserListPage: React.FC = () => {
  const { user: currentUser, refreshUserData } = useAuth();

  // State Data
  const [users, setUsers] = useState<User[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'owner' | 'kasir'>('all');

  // State Modals & Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [disablingUser, setDisablingUser] = useState<User | null>(null);

  // Toast State & Timer Ref
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 3500);
  }, []);

  // Cleanup timer saat unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Fetch Users & Outlets sekaligus
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [fetchedUsers, fetchedOutlets] = await Promise.all([
        userService.getAllUsers(),
        outletService.getAll(),
      ]);
      setUsers(fetchedUsers);
      setOutlets(fetchedOutlets);
      setLoadError(false);
    } catch (err) {
      console.error('[UserListPage] Gagal mengambil data user/outlet:', err);
      setLoadError(true);
      showToast('Gagal memuat data pengguna dari server. Periksa koneksi Anda.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter users berdasarkan pencarian nama/email dan role filter
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      // Filter role
      if (roleFilter !== 'all') {
        if (u.role !== roleFilter) return false;
      }
      // Filter pencarian nama / email
      if (q) {
        const matchNama = (u.nama || '').toLowerCase().includes(q);
        const matchEmail = (u.email || '').toLowerCase().includes(q);
        return matchNama || matchEmail;
      }
      return true;
    });
  }, [users, searchQuery, roleFilter]);

  // Buka modal untuk tambah user baru
  const handleOpenCreate = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  };

  // Buka modal untuk edit user
  const handleOpenEdit = (userToEdit: User) => {
    if (userToEdit.role === 'super_admin') {
      showToast('Akun Super Admin dikelola melalui Firebase Console.', 'error');
      return;
    }
    setEditingUser(userToEdit);
    setIsFormOpen(true);
  };

  // Handle submit tambah user
  const handleSubmitCreate = async (data: CreateUserInput) => {
    await userService.createUserWithAuth(data);
    showToast(`Pengguna baru "${data.nama}" berhasil didaftarkan.`);
    await fetchData();
    await refreshUserData();
  };

  // Handle submit update user
  const handleSubmitUpdate = async (uid: string, data: UpdateUserProfileInput) => {
    await userService.updateUserProfile(uid, data);
    showToast(`Profil pengguna berhasil diperbarui.`);
    await fetchData();
    await refreshUserData();
  };

  // Handle kirim email reset kata sandi
  const handleSendPasswordReset = async (email: string) => {
    await userService.sendPasswordResetEmailToUser(email);
    showToast(`Tautan reset kata sandi telah dikirim ke ${email}.`);
  };

  // Handle toggle status (Nonaktifkan / Aktifkan)
  const handleToggleStatus = async (targetUser: User) => {
    if (targetUser.role === 'super_admin') {
      showToast('Akun Super Admin dikelola melalui Firebase Console.', 'error');
      return;
    }

    // Larang super admin menonaktifkan dirinya sendiri
    if (targetUser.id === currentUser?.id) {
      showToast('Anda tidak dapat mengubah status akun Anda sendiri.', 'error');
      return;
    }

    if (targetUser.status === 'active') {
      // Buka dialog konfirmasi untuk nonaktifkan
      setDisablingUser(targetUser);
    } else {
      // Jika status nonaktif, aktifkan kembali LANGSUNG tanpa dialog
      try {
        await userService.updateUserProfile(targetUser.id, { status: 'active' });
        showToast(`Akun "${targetUser.nama}" telah diaktifkan kembali.`);
        await fetchData();
        await refreshUserData();
      } catch (err) {
        console.error('[UserListPage] Gagal mengaktifkan pengguna:', err);
        showToast('Gagal mengaktifkan kembali akun pengguna.', 'error');
      }
    }
  };

  // Eksekusi konfirmasi nonaktifkan
  const handleConfirmDisable = async () => {
    if (!disablingUser) return;
    try {
      await userService.updateUserProfile(disablingUser.id, { status: 'disabled' });
      showToast(`Akun "${disablingUser.nama}" telah dinonaktifkan.`);
      await fetchData();
      await refreshUserData();
    } catch (err) {
      console.error('[UserListPage] Gagal menonaktifkan pengguna:', err);
      showToast('Gagal menonaktifkan akun pengguna.', 'error');
      throw err;
    } finally {
      setDisablingUser(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 pb-28">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 shadow-sm animate-in fade-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (toastTimerRef.current) {
                clearTimeout(toastTimerRef.current);
                toastTimerRef.current = null;
              }
              setToast(null);
            }}
            className="text-[11px] underline opacity-80 hover:opacity-100"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-orange-600" />
            <span>Manajemen Pengguna</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Kelola akun Owner Outlet dan Kasir serta penugasan cabangnya.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-bold text-xs shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Pengguna</span>
        </button>
      </div>

      {/* Filter & Pencarian Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau email pengguna..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs sm:text-sm border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-stone-400 hover:text-stone-600"
            >
              Hapus
            </button>
          )}
        </div>

        {/* Filter Role Segmented */}
        <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200 shrink-0 self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'owner', label: 'Owner' },
              { id: 'kasir', label: 'Kasir' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                roleFilter === tab.id
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Section: Loading Skeleton, Error Panel, Empty State, atau User Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-4 border border-stone-200 shadow animate-pulse space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-stone-200 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-stone-200 rounded w-3/4" />
                  <div className="h-3 bg-stone-100 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-stone-100">
                <div className="h-4 bg-stone-100 rounded w-1/3" />
                <div className="h-3 bg-stone-100 rounded w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <div className="h-7 w-16 bg-stone-100 rounded-md" />
                <div className="h-7 w-20 bg-stone-100 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError ? (
        /* Panel Error Saat Fetch Gagal */
        <div className="bg-white rounded-2xl border border-rose-200 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Gagal memuat data pengguna.</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5">
            Terjadi kendala saat mengambil data akun dari server. Silakan periksa koneksi internet Anda dan coba lagi.
          </p>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Coba Lagi</span>
          </button>
        </div>
      ) : users.length === 0 ? (
        /* Empty State Saat Belum Ada Pengguna */
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-stone-900">Belum ada pengguna terdaftar</h3>
          <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5">
            Tambahkan akun Owner Outlet atau Kasir untuk mulai mengoperasikan cabang bisnis POS Anda.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengguna Pertama</span>
          </button>
        </div>
      ) : filteredUsers.length === 0 ? (
        /* Empty State Hasil Filter / Pencarian */
        <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mb-2">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-stone-800">Tidak ada pengguna yang cocok</h3>
          <p className="text-xs text-stone-400 mt-0.5 mb-3">
            Tidak ditemukan pengguna dengan kriteria pencarian saat ini.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setRoleFilter('all');
            }}
            className="text-xs font-semibold text-orange-600 hover:underline"
          >
            Reset filter pencarian
          </button>
        </div>
      ) : (
        /* Grid Layout Pengguna */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map((targetUser) => (
            <UserCard
              key={targetUser.id}
              user={targetUser}
              outlets={outlets}
              isCurrentUser={targetUser.id === currentUser?.id}
              onEdit={handleOpenEdit}
              onToggleStatus={handleToggleStatus}
            />
          ))}
        </div>
      )}

      {/* Modal Tambah / Edit User */}
      <UserFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingUser(null);
        }}
        onSubmitCreate={handleSubmitCreate}
        onSubmitUpdate={handleSubmitUpdate}
        onSendPasswordReset={handleSendPasswordReset}
        user={editingUser}
        outlets={outlets}
      />

      {/* Dialog Konfirmasi Nonaktifkan Pengguna */}
      <ConfirmDisableUserDialog
        isOpen={Boolean(disablingUser)}
        onClose={() => setDisablingUser(null)}
        onConfirm={handleConfirmDisable}
        userName={disablingUser?.nama || disablingUser?.email || ''}
      />
    </div>
  );
};
