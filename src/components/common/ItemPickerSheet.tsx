import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Ban } from 'lucide-react';

export interface ItemPickerOption {
  id: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
  disabledLabel?: string;
  badge?: string;
  badgeColor?: 'orange' | 'purple' | 'emerald' | 'amber' | 'stone';
}

export interface ItemPickerTab {
  id: string;
  label: string;
  count?: number;
}

export interface ItemPickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  items: ItemPickerOption[];
  onSelect: (id: string) => void;
  tabs?: ItemPickerTab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  searchPlaceholder?: string;
}

export const ItemPickerSheet: React.FC<ItemPickerSheetProps> = ({
  isOpen,
  onClose,
  title = 'Pilih Item',
  items,
  onSelect,
  tabs,
  activeTab,
  onTabChange,
  searchPlaceholder = 'Cari nama item...',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewportStyle, setViewportStyle] = useState<{ top: number; height: number } | null>(null);

  // Reset pencarian saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Sinkronkan tinggi & posisi sheet dengan visualViewport agar tidak tertutup keyboard HP
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      setViewportStyle(null);
      return;
    }

    const vv = window.visualViewport;
    if (!vv) return;

    const updateViewport = () => {
      setViewportStyle({
        top: vv.offsetTop,
        height: vv.height,
      });
    };

    updateViewport();
    vv.addEventListener('resize', updateViewport);
    vv.addEventListener('scroll', updateViewport);
    return () => {
      vv.removeEventListener('resize', updateViewport);
      vv.removeEventListener('scroll', updateViewport);
    };
  }, [isOpen]);

  // Filter items berdasarkan kata kunci pencarian (case-insensitive)
  const filteredItems = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(term) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(term))
    );
  }, [items, searchQuery]);

  if (!isOpen) return null;

  const handleSelect = (item: ItemPickerOption) => {
    if (item.disabled) return;
    onSelect(item.id);
    onClose();
  };

  const getBadgeClass = (color?: ItemPickerOption['badgeColor']) => {
    switch (color) {
      case 'orange':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'purple':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'amber':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'stone':
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  return (
    <div
      className="fixed inset-x-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 animate-in fade-in duration-150"
      style={
        viewportStyle
          ? { top: `${viewportStyle.top}px`, height: `${viewportStyle.height}px` }
          : { top: 0, bottom: 0 }
      }
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container: Bottom sheet on mobile (menyesuaikan tinggi visualViewport di atas keyboard), centered dialog on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-sheet-title"
        className="relative z-10 w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[calc(100%-12px)] sm:max-h-[80dvh] overflow-hidden border border-stone-200 animate-in slide-in-from-bottom sm:slide-in-from-bottom-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="sm:hidden flex justify-center pt-2 pb-0.5 shrink-0">
          <div className="w-10 h-1 bg-stone-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-stone-100">
          <h3
            id="picker-sheet-title"
            className="text-sm sm:text-base font-bold text-stone-900 truncate"
          >
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition active:scale-95"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Opsional */}
        {tabs && tabs.length > 0 && onTabChange && (
          <div className="shrink-0 flex items-center px-4 sm:px-5 pt-1.5 border-b border-stone-100 gap-2 bg-stone-50/70 overflow-x-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`py-2 px-3 text-xs font-bold border-b-2 transition whitespace-nowrap flex items-center gap-1.5 ${
                    isActive
                      ? 'border-orange-600 text-orange-600'
                      : 'border-transparent text-stone-500 hover:text-stone-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Input Pencarian Lengket di Atas */}
        <div className="shrink-0 z-20 px-4 sm:px-5 py-2 bg-white border-b border-stone-100 shadow-2xs">
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-stone-400 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-9 pr-9 py-2 text-xs sm:text-sm font-semibold rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-stone-50/50 transition placeholder:text-stone-400 placeholder:font-normal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/60"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Daftar Item scroll internal */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2 sm:p-3 divide-y divide-stone-100">
          {filteredItems.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto mb-2">
                <Search className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-stone-800">Tidak ditemukan</p>
              <p className="text-xs text-stone-400 mt-1">
                {searchQuery
                  ? `Tidak ada item yang cocok dengan "${searchQuery}".`
                  : 'Daftar item kosong.'}
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isDisabled = Boolean(item.disabled);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelect(item)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-center justify-between gap-3 min-h-[46px] ${
                    isDisabled
                      ? 'bg-stone-50/70 text-stone-400 cursor-not-allowed opacity-60'
                      : 'hover:bg-orange-50/70 active:bg-orange-100/70 focus:bg-orange-50/70 cursor-pointer text-stone-800'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-xs sm:text-sm font-bold truncate ${
                          isDisabled ? 'text-stone-400' : 'text-stone-900'
                        }`}
                      >
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${getBadgeClass(
                            item.badgeColor
                          )}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    {item.sublabel && (
                      <p
                        className={`text-[11px] mt-0.5 truncate ${
                          isDisabled ? 'text-stone-400' : 'text-stone-500'
                        }`}
                      >
                        {item.sublabel}
                      </p>
                    )}
                  </div>

                  {/* Status Kanan: Disabled Label atau Action */}
                  <div className="shrink-0 text-right">
                    {isDisabled ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-400 bg-stone-100 px-2 py-1 rounded-lg">
                        <Ban className="w-3 h-3" />
                        <span>{item.disabledLabel || 'Tidak tersedia'}</span>
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-orange-600 hover:text-orange-700">
                        Pilih
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
