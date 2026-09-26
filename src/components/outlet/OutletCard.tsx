import React from 'react';
import { Store, MapPin, Phone, Users, Pencil, Trash2 } from 'lucide-react';
import { Outlet } from '../../types';

interface OutletCardProps {
  outlet: Outlet;
  onEdit: (outlet: Outlet) => void;
  onDelete: (outlet: Outlet) => void;
}

export const OutletCard: React.FC<OutletCardProps> = ({ outlet, onEdit, onDelete }) => {
  const ownerCount = Array.isArray(outlet.ownerIds) ? outlet.ownerIds.length : 0;

  return (
    <div className="bg-white shadow rounded-lg p-4 flex flex-col justify-between border border-stone-200 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header Card: Icon Store & Nama Outlet */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-stone-900 truncate" title={outlet.nama}>
              {outlet.nama}
            </h3>
            <p className="text-[11px] font-mono text-stone-400 truncate">ID: {outlet.id}</p>
          </div>
        </div>

        {/* Informasi Alamat, Telepon & Owner */}
        <div className="space-y-2 text-xs text-stone-600 pt-1 border-t border-stone-100">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
            <span className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
              {outlet.alamat || 'Alamat belum diisi'}
            </span>
          </div>

          {outlet.telepon && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-stone-400 shrink-0" />
              <span className="text-xs text-stone-600 font-mono">{outlet.telepon}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-stone-400 shrink-0" />
            <span className="text-xs text-stone-600 font-medium">
              {ownerCount} Owner terdaftar
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons: Edit & Hapus */}
      <div className="flex items-center justify-end gap-2 pt-4 mt-3 border-t border-stone-100">
        <button
          type="button"
          onClick={() => onEdit(outlet)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors focus:outline-none focus:ring-2 focus:ring-stone-400"
          aria-label={`Edit ${outlet.nama}`}
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Edit</span>
        </button>

        <button
          type="button"
          onClick={() => onDelete(outlet)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-400"
          aria-label={`Hapus ${outlet.nama}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Hapus</span>
        </button>
      </div>
    </div>
  );
};
