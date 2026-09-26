import React from 'react';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Receipt,
  BarChart3,
  MoreHorizontal,
  Layers,
  History,
  RefreshCw,
  Store,
  Home,
  Users,
  TicketPercent,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';
import { ActiveTab, UserRole } from '../types';

interface BottomNavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange }) => {
  const { user, currentOutlet } = useAuth();
  const pendingSyncCount = usePendingSyncCount(currentOutlet?.id);

  if (!user) return null;

  const getNavItems = (role: UserRole): NavItem[] => {
    switch (role) {
      case 'owner':
        return [
          { id: 'beranda', label: 'Beranda', icon: Home },
          { id: 'produk', label: 'Produk', icon: UtensilsCrossed },
          { id: 'promo_biaya', label: 'Promo', icon: TicketPercent },
          { id: 'kasir', label: 'Kasir', icon: Receipt },
          { id: 'laporan', label: 'Laporan', icon: BarChart3 },
          { id: 'lainnya', label: 'Lainnya', icon: MoreHorizontal },
        ];
      case 'kasir':
        return [
          { id: 'kasir', label: 'Kasir', icon: Receipt },
          { id: 'open_bill', label: 'Open Bill', icon: Layers },
          { id: 'riwayat', label: 'Riwayat', icon: History },
          { id: 'sync', label: 'Sync', icon: RefreshCw },
          { id: 'lainnya', label: 'Lainnya', icon: MoreHorizontal },
        ];
      case 'super_admin':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'outlet', label: 'Outlet', icon: Store },
          { id: 'users', label: 'User', icon: Users },
          { id: 'laporan', label: 'Laporan', icon: BarChart3 },
          { id: 'lainnya', label: 'Lainnya', icon: MoreHorizontal },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems(user.role);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-stone-200 shadow-lg">
      <div className="max-w-xl mx-auto px-1.5 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex-1 py-2 px-1 flex flex-col items-center justify-center min-h-[56px] transition-all relative select-none ${
                isActive ? 'text-orange-600 font-bold' : 'text-stone-500 hover:text-stone-800 font-medium'
              }`}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute top-1 w-1 h-1 rounded-full bg-orange-600 animate-in fade-in" />
              )}
              <div
                className={`p-1 rounded-xl transition-all relative ${
                  isActive ? 'bg-orange-50 scale-105' : 'hover:bg-stone-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                {item.id === 'sync' && pendingSyncCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black rounded-full px-1 min-w-[14px] h-[14px] flex items-center justify-center ring-2 ring-white">
                    {pendingSyncCount > 99 ? '99+' : pendingSyncCount}
                  </span>
                )}
              </div>
              <span className="text-[10.5px] tracking-tight leading-tight mt-0.5 truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
