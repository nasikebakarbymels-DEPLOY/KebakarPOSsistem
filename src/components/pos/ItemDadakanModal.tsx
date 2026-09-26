import React, { useState } from 'react';
import { X, Sparkles, Plus, Minus, AlertCircle } from 'lucide-react';
import { ItemKeranjang } from '../../types';

interface ItemDadakanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: Omit<ItemKeranjang, 'id'>) => void;
}

export const ItemDadakanModal: React.FC<ItemDadakanModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
}) => {
  const [nama, setNama] = useState('');
  const [hargaJual, setHargaJual] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [catatan, setCatatan] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedNama = nama.trim();
    if (!trimmedNama) {
      setErrorMessage('Nama item dadakan wajib diisi.');
      return;
    }

    const hargaNum = Number(hargaJual);
    if (!hargaJual || isNaN(hargaNum) || hargaNum <= 0) {
      setErrorMessage('Harga jual harus lebih dari 0.');
      return;
    }

    if (qty < 1 || isNaN(qty)) {
      setErrorMessage('Jumlah (qty) minimal 1.');
      return;
    }

    onAddItem({
      produkId: undefined,
      nama: trimmedNama,
      hargaJual: Math.round(hargaNum),
      qty: Math.min(999, Math.max(1, Math.floor(qty))),
      catatan: catatan.trim() || undefined,
      diskonItem: 0,
      isDadakan: true,
    });

    // Reset & close
    setNama('');
    setHargaJual('');
    setQty(1);
    setCatatan('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">Tambah Item Dadakan</h3>
              <p className="text-xs text-stone-500">Menu non-katalog khusus pesanan saat ini</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-stone-100 text-stone-500 hover:text-stone-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Nama Item Dadakan <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Es Teh Manis Jumbo, Request Khusus"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Harga Jual Satuan (Rp) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs font-bold text-stone-400">Rp</span>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={hargaJual}
                onChange={(e) => setHargaJual(e.target.value)}
                placeholder="0"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 text-stone-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
          </div>

          {/* Stepper Qty */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Jumlah (Qty)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold transition-colors active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min="1"
                max="999"
                step="1"
                value={qty}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setQty(isNaN(val) ? 1 : Math.max(1, Math.min(999, val)));
                }}
                className="w-20 text-center py-2 rounded-xl border border-stone-300 text-stone-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setQty((prev) => Math.min(999, prev + 1))}
                className="w-10 h-10 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center font-bold transition-colors active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Catatan Khusus (Opsional)
            </label>
            <input
              type="text"
              maxLength={100}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: Tanpa gula, ekstra es"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-300 text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-sm transition-colors active:scale-[0.98]"
            >
              Tambah ke Keranjang
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
