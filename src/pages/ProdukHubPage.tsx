import React, { useState } from 'react';
import {
  Layers,
  ShoppingBag,
  UtensilsCrossed,
  ShieldAlert,
  Store,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { MenuSegment } from '../components/produkCloud/MenuSegment';
import { BahanSegment } from '../components/produkCloud/BahanSegment';
import { PembelianSegment } from '../components/pembelianCloud/PembelianSegment';

interface ProdukHubPageProps {
  onBackToHome?: () => void;
  onAttemptUnauthorizedAction?: (targetFeature: string) => void;
}

export const ProdukHubPage: React.FC<ProdukHubPageProps> = () => {
  const { user, currentOutlet } = useAuth();
  const [activeTab, setActiveTab] = useState<'menu' | 'bahan' | 'pembelian'>('menu');

  // Role Guard: Khusus Owner
  if (!user || user.role !== 'owner') {
    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto mt-6">
        <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900">
              Akses Dibatasi (Khusus Owner Outlet)
            </h2>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Pengelolaan katalog menu produk, resep HPP bertingkat, dan bahan baku hanya dapat
              diakses oleh pengguna dengan hak akses <strong>Owner Outlet</strong>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Guard: Harus Memilih Outlet Aktif
  if (!currentOutlet) {
    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto mt-6">
        <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900">
              Pilih Cabang Outlet
            </h2>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1 leading-relaxed">
              Silakan pilih cabang outlet aktif Anda terlebih dahulu melalui header aplikasi untuk mulai
              mengelola katalog menu dan bahan baku.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-24">
      {/* Sticky Tab Navigator */}
      <div className="px-4 pt-3 pb-2.5 bg-stone-100/90 backdrop-blur-xs sticky top-0 z-10 border-b border-stone-200/60 shadow-2xs">
        <div className="flex bg-stone-200/80 p-1 rounded-2xl gap-1 max-w-2xl mx-auto">
          {/* Tab 1: Menu & Resep (Cloud) */}
          <button
            type="button"
            onClick={() => setActiveTab('menu')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'menu'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Menu & Resep</span>
            <span className="sm:hidden">Menu</span>
          </button>

          {/* Tab 2: Bahan Baku & Kemasan (Cloud) */}
          <button
            type="button"
            onClick={() => setActiveTab('bahan')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'bahan'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bahan Baku</span>
            <span className="sm:hidden">Bahan</span>
          </button>

          {/* Tab 3: Pembelian Bahan (Cloud) */}
          <button
            type="button"
            onClick={() => setActiveTab('pembelian')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'pembelian'
                ? 'bg-white text-orange-600 shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pembelian Bahan</span>
            <span className="sm:hidden">Pembelian</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        {/* Banner Status Cloud Aktif */}
        <div className="p-3 rounded-xl bg-orange-50/70 border border-orange-200/70 flex items-center justify-between gap-3 text-xs text-orange-900">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-orange-600 shrink-0" />
            <span>
              Outlet Aktif: <strong>{currentOutlet.nama}</strong> · Data tersinkronisasi di Firestore Cloud
            </span>
          </div>
        </div>

        {/* Tab 1: Menu & Resep Cloud */}
        {activeTab === 'menu' && (
          <MenuSegment outletId={currentOutlet.id} userId={user.id} />
        )}

        {/* Tab 2: Bahan Baku Cloud */}
        {activeTab === 'bahan' && (
          <BahanSegment outletId={currentOutlet.id} userId={user.id} />
        )}

        {/* Tab 3: Pembelian Bahan Cloud */}
        {activeTab === 'pembelian' && (
          <PembelianSegment outletId={currentOutlet.id} userId={user.id} />
        )}
      </div>
    </div>
  );
};

