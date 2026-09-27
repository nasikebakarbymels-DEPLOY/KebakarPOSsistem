import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { PengaturanPrinterSegment } from '../components/lainnya/PengaturanPrinterSegment';
import { TentangAplikasiSegment } from '../components/lainnya/TentangAplikasiSegment';
import { PromoBiayaPage } from './PromoBiayaPage';
import { Printer, Info, TicketPercent } from 'lucide-react';

export type LainnyaSegment = 'printer' | 'promo_biaya' | 'tentang';

export const LainnyaPage: React.FC = () => {
  const { user, currentOutlet } = useAuth();

  // Tentukan default segment
  const getDefaultSegment = (): LainnyaSegment => {
    return 'printer';
  };

  const [activeSegment, setActiveSegment] = useState<LainnyaSegment>(() =>
    getDefaultSegment()
  );

  if (!user) return null;

  // Segment yang tersedia: Promo & Biaya HANYA bila role pengguna adalah owner
  // Untuk super_admin dan kasir, tab Promo & Biaya tidak dirender sama sekali
  const availableSegments: {
    id: LainnyaSegment;
    labelShort: string;
    labelFull: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'printer', labelShort: 'Printer', labelFull: 'Printer Bluetooth', icon: Printer },
    ...(user.role === 'owner'
      ? [{ id: 'promo_biaya' as LainnyaSegment, labelShort: 'Promo', labelFull: 'Promo & Biaya', icon: TicketPercent }]
      : []),
    { id: 'tentang', labelShort: 'Tentang', labelFull: 'Tentang Aplikasi', icon: Info },
  ];

  const isSegmentAllowed = availableSegments.some((s) => s.id === activeSegment);
  const currentSegment = isSegmentAllowed ? activeSegment : availableSegments[0]?.id || 'printer';

  return (
    <div className="p-4 sm:p-6 pb-28 space-y-4">
      {/* Header Halaman */}
      <div>
        <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
          Pengaturan & Lainnya
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          {user.role === 'owner'
            ? 'Pengaturan printer thermal, konfigurasi promo & biaya, serta informasi sistem.'
            : 'Pengaturan printer thermal Bluetooth dan informasi sistem aplikasi.'}
        </p>
      </div>

      {/* Segmented Control Selector: Grid 3 kolom tidak boleh meluber */}
      {availableSegments.length > 1 && (
        <div
          className={`w-full p-1 bg-stone-200/80 rounded-xl border border-stone-300/70 grid ${
            availableSegments.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
          } gap-1`}
        >
          {availableSegments.map((segment) => {
            const Icon = segment.icon;
            const isActive = currentSegment === segment.id;

            return (
              <button
                key={segment.id}
                type="button"
                id={`tab-lainnya-${segment.id}`}
                onClick={() => setActiveSegment(segment.id)}
                className={`px-1 py-2 rounded-lg text-[11px] sm:text-xs font-bold leading-tight flex flex-col items-center justify-center gap-1 text-center transition-all ${
                  isActive
                    ? 'bg-white text-stone-950 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 ${isActive ? 'text-orange-600' : 'text-stone-400'}`} />
                <span className="leading-tight text-center">
                  <span className="sm:hidden">{segment.labelShort}</span>
                  <span className="hidden sm:inline">{segment.labelFull}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Konten Segmen Terpilih */}
      {currentSegment === 'printer' && (
        <PengaturanPrinterSegment currentOutlet={currentOutlet} />
      )}
      {currentSegment === 'promo_biaya' && user.role === 'owner' && (
        <div className="-mx-4 sm:-mx-6 -mt-4">
          <PromoBiayaPage />
        </div>
      )}
      {currentSegment === 'tentang' && <TentangAplikasiSegment />}
    </div>
  );
};

