import React from 'react';
import { Store, Check, X, MapPin, Phone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Outlet } from '../types';

interface OutletSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OutletSelectorModal: React.FC<OutletSelectorModalProps> = ({ isOpen, onClose }) => {
  const { user, availableOutlets, currentOutlet, selectOutlet } = useAuth();

  if (!isOpen || user?.role !== 'owner') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-stone-200">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">Pilih Outlet Aktif</h3>
              <p className="text-xs text-stone-500">Data operasional terisolasi per outlet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {availableOutlets.map((outlet: Outlet) => {
            const isSelected = currentOutlet?.id === outlet.id;
            return (
              <button
                key={outlet.id}
                onClick={() => {
                  selectOutlet(outlet);
                  onClose();
                }}
                className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50/50 shadow-xs'
                    : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                <div>
                  <div className="font-bold text-sm text-stone-900 flex items-center gap-1.5">
                    {outlet.nama}
                    {isSelected && (
                      <span className="text-[10px] font-semibold bg-orange-600 text-white px-2 py-0.5 rounded-full">
                        Aktif
                      </span>
                    )}
                  </div>
                  {outlet.alamat && (
                    <div className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span className="truncate">{outlet.alamat}</span>
                    </div>
                  )}
                  {outlet.telepon && (
                    <div className="text-xs text-stone-400 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3 text-stone-400 shrink-0" />
                      <span>{outlet.telepon}</span>
                    </div>
                  )}
                </div>
                {isSelected && <Check className="w-5 h-5 text-orange-600 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition"
        >
          Selesai
        </button>
      </div>
    </div>
  );
};
