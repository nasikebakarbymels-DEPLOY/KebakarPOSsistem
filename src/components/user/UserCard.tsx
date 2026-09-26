import React from 'react';
import { Pencil, UserX, UserCheck, Store, Mail } from 'lucide-react';
import { User, Outlet } from '../../types';

interface UserCardProps {
  user: User;
  outlets: Outlet[];
  isCurrentUser: boolean;
  onEdit: (user: User) => void;
  onToggleStatus: (user: User) => void;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  outlets,
  isCurrentUser,
  onEdit,
  onToggleStatus,
}) => {
  // Hitung inisial 2 huruf dari nama
  const getInitials = (name: string, email: string): string => {
    const cleanName = (name || email || '').trim();
    if (!cleanName) return '??';
    const parts = cleanName.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  };

  const initials = getInitials(user.nama, user.email);

  // Cari nama-nama outlet yang ditugaskan
  const assignedOutletNames = (user.outletIds || [])
    .map((oId) => {
      const match = outlets.find((o) => o.id === oId);
      return match ? match.nama : null;
    })
    .filter(Boolean) as string[];

  const isActive = user.status === 'active';

  return (
    <div className="bg-white shadow rounded-xl p-4 flex flex-col justify-between border border-stone-200 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header: Avatar, Nama, Email, & Badge Status/Role */}
        <div className="flex items-start gap-3">
          {/* Avatar Inisial */}
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 select-none shadow-xs ${
              user.role === 'owner'
                ? 'bg-blue-100 text-blue-700'
                : user.role === 'super_admin'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-bold text-stone-900 truncate" title={user.nama}>
                {user.nama || 'Tanpa Nama'}
              </h3>
              {isCurrentUser && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-700 shrink-0">
                  Anda
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-stone-500 truncate mt-0.5" title={user.email}>
              <Mail className="w-3.5 h-3.5 shrink-0 text-stone-400" />
              <span className="truncate">{user.email}</span>
            </div>
          </div>
        </div>

        {/* Badges: Role & Status */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-stone-100">
          {/* Role Badge */}
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
              user.role === 'owner'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : user.role === 'super_admin'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {user.role === 'owner' ? 'Owner Outlet' : user.role === 'super_admin' ? 'Super Admin' : 'Kasir'}
          </span>

          {/* Status Badge */}
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}
            />
            <span>{isActive ? 'Aktif' : 'Nonaktif'}</span>
          </span>
        </div>

        {/* Chip Penugasan Outlet */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-500">
            <Store className="w-3.5 h-3.5 text-stone-400" />
            <span>Outlet Ditugaskan ({assignedOutletNames.length}):</span>
          </div>
          {assignedOutletNames.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {assignedOutletNames.map((oName, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200"
                >
                  {oName}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-stone-400 italic">Belum ada outlet ditugaskan</p>
          )}
        </div>
      </div>

      {/* Action Buttons: Edit & Nonaktifkan/Aktifkan (Atau Via Console jika super_admin) */}
      <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-stone-100">
        {user.role === 'super_admin' ? (
          <span className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-stone-100 text-stone-500 border border-stone-200">
            Via Console
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onEdit(user)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
              aria-label={`Edit ${user.nama}`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            {!isCurrentUser && (
              <button
                type="button"
                onClick={() => onToggleStatus(user)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 ${
                  isActive
                    ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 focus:ring-rose-400'
                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 focus:ring-emerald-400'
                }`}
                aria-label={isActive ? `Nonaktifkan ${user.nama}` : `Aktifkan ${user.nama}`}
              >
                {isActive ? (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>Nonaktifkan</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Aktifkan</span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
