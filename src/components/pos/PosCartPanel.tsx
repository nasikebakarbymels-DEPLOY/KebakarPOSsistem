import React, { useState } from 'react';
import {
  ItemKeranjang,
  DrafKeranjang,
  TipePesanan,
  TipeDiskonTransaksi,
} from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { keranjangService } from '../../services/keranjangService';
import {
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  MessageSquare,
  Sparkles,
  Percent,
  Banknote,
  Utensils,
  ShoppingBag as TakeawayIcon,
  X,
  AlertCircle,
  Tag,
  ChevronRight,
  Layers,
} from 'lucide-react';

interface PosCartPanelProps {
  draf: DrafKeranjang;
  onUpdateDraf: (newDraf: DrafKeranjang) => void;
  onClearCart: () => void;
  onOpenItemDadakan: () => void;
  onCheckoutClick: () => void;
  onOpenBillClick?: () => void;
  isBottomSheet?: boolean;
  onCloseBottomSheet?: () => void;
}

export const PosCartPanel: React.FC<PosCartPanelProps> = ({
  draf,
  onUpdateDraf,
  onClearCart,
  onOpenItemDadakan,
  onCheckoutClick,
  onOpenBillClick,
  isBottomSheet = false,
  onCloseBottomSheet,
}) => {
  const [activeNoteItemId, setActiveNoteItemId] = useState<string | null>(null);
  const [activeDiscountItemId, setActiveDiscountItemId] = useState<string | null>(null);
  const [discountError, setDiscountError] = useState<{ itemId?: string; message: string } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const ringkasan = keranjangService.kalkulasiRingkasan(draf);

  // Stepper Qty Handlers
  const handleUpdateQty = (itemId: string, newQty: number) => {
    const validQty = Math.max(1, Math.min(999, Math.floor(newQty)));
    const updatedItems = draf.items.map((it) => {
      if (it.id !== itemId) return it;
      const subtotalKotor = validQty * it.hargaJual;
      // Jika diskon item melebihi subtotal baru, kurangi diskon ke subtotal
      const adjustedDiskon = Math.min(it.diskonItem, subtotalKotor);
      return {
        ...it,
        qty: validQty,
        diskonItem: adjustedDiskon,
      };
    });
    onUpdateDraf({ ...draf, items: updatedItems });
  };

  const handleRemoveItem = (itemId: string) => {
    const updatedItems = draf.items.filter((it) => it.id !== itemId);
    if (activeNoteItemId === itemId) setActiveNoteItemId(null);
    if (activeDiscountItemId === itemId) setActiveDiscountItemId(null);
    onUpdateDraf({ ...draf, items: updatedItems });
  };

  const handleUpdateNote = (itemId: string, note: string) => {
    const updatedItems = draf.items.map((it) =>
      it.id === itemId ? { ...it, catatan: note } : it
    );
    onUpdateDraf({ ...draf, items: updatedItems });
  };

  const handleUpdateItemDiscount = (itemId: string, diskonInput: string) => {
    setDiscountError(null);
    const diskonNum = Math.max(0, parseInt(diskonInput, 10) || 0);
    const item = draf.items.find((it) => it.id === itemId);
    if (!item) return;

    const subtotalBaris = item.qty * item.hargaJual;
    if (diskonNum > subtotalBaris) {
      setDiscountError({
        itemId,
        message: `Diskon tidak boleh melebihi subtotal item (${formatRupiah(subtotalBaris)}).`,
      });
      return;
    }

    const updatedItems = draf.items.map((it) =>
      it.id === itemId ? { ...it, diskonItem: diskonNum } : it
    );
    onUpdateDraf({ ...draf, items: updatedItems });
  };

  const handleToggleTipePesanan = (tipe: TipePesanan) => {
    onUpdateDraf({
      ...draf,
      tipePesanan: tipe,
      nomorMeja: tipe === 'dine_in' ? draf.nomorMeja : '',
    });
  };

  const handleUpdateDiskonTransaksiNilai = (val: string) => {
    setDiscountError(null);
    const num = Math.max(0, parseFloat(val) || 0);

    if (draf.tipeDiskonTransaksi === 'persen' && num > 100) {
      setDiscountError({
        message: 'Diskon persen tidak boleh melebihi 100%.',
      });
      return;
    }

    if (draf.tipeDiskonTransaksi === 'nominal' && num > ringkasan.subtotalBersih) {
      setDiscountError({
        message: `Diskon nominal tidak boleh melebihi subtotal (${formatRupiah(ringkasan.subtotalBersih)}).`,
      });
      return;
    }

    onUpdateDraf({ ...draf, diskonTransaksiNilai: num });
  };

  const handleToggleTipeDiskonTransaksi = (tipe: TipeDiskonTransaksi) => {
    setDiscountError(null);
    onUpdateDraf({
      ...draf,
      tipeDiskonTransaksi: tipe,
      diskonTransaksiNilai: 0,
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header Keranjang */}
      <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-stone-900 text-sm flex items-center gap-1.5">
              Pesanan Kasir
              {draf.items.length > 0 && (
                <span className="text-[11px] font-bold bg-orange-600 text-white px-1.5 py-0.2 rounded-full">
                  {ringkasan.totalItemCount}
                </span>
              )}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {draf.items.length > 0 && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="text-xs text-red-600 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-1"
              title="Kosongkan Keranjang"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kosongkan</span>
            </button>
          )}

          {isBottomSheet && onCloseBottomSheet && (
            <button
              type="button"
              onClick={onCloseBottomSheet}
              className="w-8 h-8 rounded-full bg-stone-200/80 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tipe Pesanan Switch (Dine In / Takeaway) */}
      <div className="p-3 border-b border-stone-100 bg-stone-50/30 space-y-2 shrink-0">
        <div className="flex p-0.5 bg-stone-200/70 rounded-xl">
          <button
            type="button"
            onClick={() => handleToggleTipePesanan('dine_in')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              draf.tipePesanan === 'dine_in'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            Dine-in (Makan di Tempat)
          </button>
          <button
            type="button"
            onClick={() => handleToggleTipePesanan('takeaway')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              draf.tipePesanan === 'takeaway'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <TakeawayIcon className="w-3.5 h-3.5" />
            Takeaway (Bungkus)
          </button>
        </div>

        {/* Input Nomor Meja & Catatan Pesanan */}
        <div className="flex gap-2">
          {draf.tipePesanan === 'dine_in' && (
            <div className="w-28 shrink-0">
              <input
                type="text"
                placeholder="No. Meja"
                value={draf.nomorMeja || ''}
                onChange={(e) => onUpdateDraf({ ...draf, nomorMeja: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              placeholder="Catatan pesanan (opsional)..."
              value={draf.catatanPesanan || ''}
              onChange={(e) => onUpdateDraf({ ...draf, catatanPesanan: e.target.value })}
              className="w-full px-2.5 py-1.5 text-xs font-medium rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Tombol Item Dadakan Banner */}
      <div className="px-3 py-2 bg-orange-50/50 border-b border-orange-100/60 flex items-center justify-between shrink-0">
        <span className="text-xs text-orange-950 font-medium flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-orange-500" />
          Menu khusus di luar katalog?
        </span>
        <button
          type="button"
          onClick={onOpenItemDadakan}
          className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-white hover:bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200 shadow-xs transition-colors flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          Item Dadakan
        </button>
      </div>

      {/* Error Toast / Alert jika ada diskon yang tidak valid */}
      {discountError && (
        <div className="mx-3 mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>{discountError.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setDiscountError(null)}
            className="text-red-400 hover:text-red-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Daftar Item Keranjang */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[160px]">
        {draf.items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mb-2 text-stone-300">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="font-semibold text-stone-700 text-sm">Keranjang Masih Kosong</p>
            <p className="text-xs text-stone-400 mt-1 max-w-[220px]">
              Ketuk menu di katalog untuk mulai menambahkan pesanan pelanggan.
            </p>
          </div>
        ) : (
          draf.items.map((item) => {
            const barisKotor = item.qty * item.hargaJual;
            const barisBersih = Math.max(0, barisKotor - (item.diskonItem || 0));
            const isNoteOpen = activeNoteItemId === item.id;
            const isDiscountOpen = activeDiscountItemId === item.id;

            return (
              <div
                key={item.id}
                className="p-3 bg-stone-50/70 hover:bg-stone-50 rounded-2xl border border-stone-200/70 transition-colors"
              >
                {/* Baris Utama Item */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-stone-900 leading-snug">
                        {item.nama}
                      </span>
                      {item.isDadakan && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                          Dadakan
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                      {formatRupiah(item.hargaJual)} / porsi
                    </p>
                  </div>

                  {/* Tombol Hapus */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-stone-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
                    title="Hapus item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Baris Kontrol Qty & Subtotal */}
                <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-stone-100">
                  {/* Stepper Qty */}
                  <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, item.qty - 1)}
                      className="w-7 h-7 rounded-lg text-stone-600 hover:bg-stone-100 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={item.qty}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val)) handleUpdateQty(item.id, val);
                      }}
                      className="w-10 text-center text-xs font-bold text-stone-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, item.qty + 1)}
                      className="w-7 h-7 rounded-lg text-stone-600 hover:bg-stone-100 flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Nilai Subtotal */}
                  <div className="text-right">
                    {item.diskonItem > 0 && (
                      <span className="text-[10px] text-stone-400 line-through block">
                        {formatRupiah(barisKotor)}
                      </span>
                    )}
                    <span className="font-extrabold text-sm sm:text-base text-stone-900">
                      {formatRupiah(barisBersih)}
                    </span>
                  </div>
                </div>

                {/* Baris Tombol Aksi Tambahan: Catatan & Diskon Item */}
                <div className="mt-2 flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveNoteItemId(isNoteOpen ? null : item.id)}
                    className={`text-[11px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                      item.catatan || isNoteOpen
                        ? 'bg-orange-50 text-orange-700 font-semibold'
                        : 'text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" />
                    {item.catatan ? 'Edit Catatan' : '+ Catatan'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveDiscountItemId(isDiscountOpen ? null : item.id)}
                    className={`text-[11px] font-medium px-2 py-1 rounded-lg flex items-center gap-1 transition-colors ${
                      item.diskonItem > 0 || isDiscountOpen
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-stone-500 hover:bg-stone-100'
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {item.diskonItem > 0
                      ? `Diskon: ${formatRupiah(item.diskonItem)}`
                      : '+ Diskon Item'}
                  </button>
                </div>

                {/* Inline Catatan Box */}
                {isNoteOpen && (
                  <div className="mt-2 p-2 bg-white rounded-xl border border-stone-200 space-y-1">
                    <input
                      type="text"
                      maxLength={100}
                      placeholder="Catatan porsi (maks 100 char)..."
                      value={item.catatan || ''}
                      onChange={(e) => handleUpdateNote(item.id, e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setActiveNoteItemId(null)}
                        className="text-[10px] font-bold text-stone-500 hover:text-stone-900 px-2 py-0.5"
                      >
                        Selesai
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Diskon Item Box */}
                {isDiscountOpen && (
                  <div className="mt-2 p-2 bg-white rounded-xl border border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-stone-700">Potongan Diskon Item (Rp)</span>
                      <span className="text-stone-400">Maks {formatRupiah(barisKotor)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-400">Rp</span>
                      <input
                        type="number"
                        min="0"
                        max={barisKotor}
                        step="500"
                        placeholder="0"
                        value={item.diskonItem || ''}
                        onChange={(e) => handleUpdateItemDiscount(item.id, e.target.value)}
                        className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setActiveDiscountItemId(null)}
                        className="text-xs font-bold bg-emerald-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-emerald-700"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bagian Bawah: Diskon Transaksi & Ringkasan Pembayaran */}
      {draf.items.length > 0 && (
        <div className="border-t border-stone-200 p-3.5 bg-stone-50/70 space-y-3 shrink-0">
          {/* Diskon Transaksi Section */}
          <div className="p-2.5 bg-white rounded-2xl border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-800 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-orange-500" />
                Diskon Transaksi
              </span>

              {/* Switch Persen / Nominal */}
              <div className="flex p-0.5 bg-stone-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleToggleTipeDiskonTransaksi('nominal')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${
                    draf.tipeDiskonTransaksi === 'nominal'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500'
                  }`}
                >
                  <Banknote className="w-2.5 h-2.5" />
                  Rupiah
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleTipeDiskonTransaksi('persen')}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all flex items-center gap-1 ${
                    draf.tipeDiskonTransaksi === 'persen'
                      ? 'bg-white text-stone-900 shadow-2xs'
                      : 'text-stone-500'
                  }`}
                >
                  <Percent className="w-2.5 h-2.5" />
                  Persen
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1.5 text-xs font-bold text-stone-400">
                  {draf.tipeDiskonTransaksi === 'nominal' ? 'Rp' : '%'}
                </span>
                <input
                  type="number"
                  min="0"
                  max={draf.tipeDiskonTransaksi === 'persen' ? 100 : ringkasan.subtotalBersih}
                  placeholder="0"
                  value={draf.diskonTransaksiNilai || ''}
                  onChange={(e) => handleUpdateDiskonTransaksiNilai(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs font-bold rounded-xl border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              {ringkasan.diskonTransaksiNominal > 0 && draf.tipeDiskonTransaksi === 'persen' && (
                <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">
                  = {formatRupiah(ringkasan.diskonTransaksiNominal)}
                </span>
              )}
            </div>
          </div>

          {/* Rincian Finansial Tagihan */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal ({ringkasan.totalItemCount} item)</span>
              <span className="font-semibold text-stone-800">
                {formatRupiah(ringkasan.subtotalKotor)}
              </span>
            </div>

            {ringkasan.totalDiskonItem > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Total Diskon Item</span>
                <span>-{formatRupiah(ringkasan.totalDiskonItem)}</span>
              </div>
            )}

            {ringkasan.diskonTransaksiNominal > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Diskon Transaksi ({draf.tipeDiskonTransaksi === 'persen' ? `${draf.diskonTransaksiNilai}%` : 'Rp'})</span>
                <span>-{formatRupiah(ringkasan.diskonTransaksiNominal)}</span>
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
              <span className="font-bold text-stone-900 text-sm">Total Akhir</span>
              <span className="font-extrabold text-stone-900 text-lg sm:text-xl">
                {formatRupiah(ringkasan.totalAkhir)}
              </span>
            </div>
          </div>

          {/* Tombol Aksi Keranjang: Open Bill & Bayar */}
          <div className="flex gap-2">
            {onOpenBillClick && (
              <button
                type="button"
                id="pos-open-bill-button"
                onClick={onOpenBillClick}
                disabled={draf.items.length === 0}
                className={`py-3.5 px-3 rounded-2xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] touch-manipulation ${
                  draf.items.length > 0
                    ? 'border-orange-300 bg-orange-50/80 hover:bg-orange-100 text-orange-900'
                    : 'border-stone-200 bg-stone-100 text-stone-400 cursor-not-allowed'
                }`}
                title={
                  draf.items.length > 0
                    ? 'Simpan sebagai Open Bill (pesanan gantung)'
                    : 'Keranjang masih kosong'
                }
              >
                <Layers className="w-4 h-4" />
                <span className="whitespace-nowrap">Open Bill</span>
              </button>
            )}

            <button
              type="button"
              id="pos-bayar-button"
              onClick={onCheckoutClick}
              disabled={draf.items.length === 0}
              className={`flex-1 py-3.5 rounded-2xl font-extrabold text-base shadow-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] touch-manipulation ${
                draf.items.length > 0
                  ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-600/20'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <span>Bayar {draf.items.length > 0 && formatRupiah(ringkasan.totalAkhir)}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Kosongkan Keranjang */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full shadow-2xl border border-stone-200 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-stone-900 text-base mb-1">Kosongkan Keranjang?</h4>
            <p className="text-xs text-stone-500 mb-4">
              Seluruh pesanan aktif di keranjang saat ini akan dihapus.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirm(false);
                  onClearCart();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
              >
                Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
