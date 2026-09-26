import React, { useState } from 'react';
import { Store, Wifi, WifiOff, RefreshCw, LogOut, ChevronDown, ShieldCheck, UserCircle, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';

interface HeaderProps {
  onOpenOutletSelector?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenOutletSelector }) => {
  const { user, currentOutlet, isOnline, logout } = useAuth();
  const pendingSyncCount = usePendingSyncCount(currentOutlet?.id);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'super_admin':
        return {
          label: 'Super Admin',
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
        };
      case 'owner':
        return {
          label: 'Owner Outlet',
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
        };
      case 'kasir':
        return {
          label: 'Kasir',
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        };
      default:
        return {
          label: 'Pengguna',
          bg: 'bg-stone-100 text-stone-800 border-stone-200',
        };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  const canSwitchOutlet = user?.role === 'owner' && (user.outletIds?.length || 0) > 1;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200 shadow-xs">
      {/* Main Header Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between gap-2 max-w-5xl mx-auto">
        {/* Left: Outlet / App Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center text-white shadow-xs shrink-0">
            {user?.role === 'super_admin' ? (
              <Building2 className="w-5 h-5" />
            ) : (
              <Store className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0">
            {user?.role === 'super_admin' ? (
              <>
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wider leading-none">
                  Semua Outlet
                </div>
                <h1 className="text-sm sm:text-base font-bold text-stone-900 truncate leading-snug">
                  POS Multi-Outlet
                </h1>
              </>
            ) : canSwitchOutlet ? (
              <>
                <button
                  onClick={onOpenOutletSelector}
                  className="flex items-center gap-1 text-left group hover:opacity-80 transition"
                  title="Klik untuk ganti outlet"
                >
                  <span className="text-sm font-bold text-stone-900 truncate block">
                    {currentOutlet?.nama || 'Outlet Utama'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-700 shrink-0" />
                </button>
                <div className="text-[11px] text-stone-500 truncate leading-none">
                  {currentOutlet?.alamat || 'POS F&B'}
                </div>
              </>
            ) : (
              <>
                <span className="text-sm font-bold text-stone-900 truncate block">
                  {currentOutlet?.nama || 'Outlet Utama'}
                </span>
                <div className="text-[11px] text-stone-500 truncate leading-none">
                  {currentOutlet?.alamat || 'POS F&B'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Status Indicators & Profile Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Connection Status Badge */}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border ${
              isOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={isOnline ? 'Perangkat terhubung ke internet' : 'Perangkat sedang offline'}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-600" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-rose-600" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Pending Sync Badge */}
          <button
            type="button"
            onClick={async () => {
              if (pendingSyncCount > 0 && isOnline && currentOutlet?.id) {
                const { transaksiCloudService } = await import('../services/cloud/transaksiCloudService');
                await transaksiCloudService.flushQueue(currentOutlet.id);
              }
            }}
            disabled={pendingSyncCount === 0 || !isOnline}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              pendingSyncCount > 0
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300 font-bold cursor-pointer'
                : 'bg-stone-100 text-stone-600 border-stone-200 cursor-default'
            }`}
            title={
              pendingSyncCount > 0
                ? `${pendingSyncCount} transaksi menunggu sinkronisasi (Klik untuk sync)`
                : 'Tidak ada antrean sinkronisasi'
            }
          >
            <RefreshCw
              className={`w-3 h-3 ${pendingSyncCount > 0 ? 'text-amber-700' : 'text-stone-500'}`}
            />
            <span className="text-[10px] font-bold">{pendingSyncCount}</span>
          </button>

          {/* Role & Profile Button */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-stone-100 hover:bg-stone-200/80 border border-stone-200 transition text-stone-800"
              aria-label="Menu Profil"
            >
              <UserCircle className="w-6 h-6 text-stone-600" />
              <div className="text-left hidden md:block">
                <div className="text-xs font-semibold text-stone-800 truncate max-w-[90px]">
                  {user?.nama || 'User'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-stone-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-4 py-2 border-b border-stone-100">
                    <p className="text-xs font-medium text-stone-500">Masuk sebagai</p>
                    <p className="text-sm font-bold text-stone-900 truncate">{user?.nama}</p>
                    <p className="text-xs text-stone-500 truncate">{user?.email}</p>
                    <div className="mt-2">
                      <span
                        className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border ${roleInfo.bg}`}
                      >
                        {roleInfo.label}
                      </span>
                    </div>
                  </div>

                  {user?.role !== 'super_admin' && (
                    <div className="px-4 py-2 border-b border-stone-100 text-xs text-stone-600">
                      <span className="text-stone-400 block text-[10px] uppercase font-semibold">
                        Outlet Aktif
                      </span>
                      <span className="font-semibold text-stone-800">{currentOutlet?.nama}</span>
                    </div>
                  )}

                  {onOpenOutletSelector && canSwitchOutlet && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenOutletSelector();
                      }}
                      className="w-full text-left px-4 py-2 text-xs text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                    >
                      <Store className="w-3.5 h-3.5 text-stone-500" />
                      Ganti Outlet
                    </button>
                  )}

                  <div className="pt-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      Keluar / Logout
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
