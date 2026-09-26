import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  CreditCard,
  Printer,
  Bluetooth,
  RefreshCw,
  UtensilsCrossed,
  X,
  ChevronUp,
  AlertCircle,
  Tag,
  Store,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Produk, Transaksi } from '../types';
import { produkCloudService, hitungHargaNeto } from '../services/cloud/produkCloudService';
import { printerBleService, BLE_PRINTER_STATUS_EVENT } from '../services/printerBleService';
import { PrinterSettingsModal } from '../components/pos/PrinterSettingsModal';
import { CheckoutModal, CartItemCheckout } from '../components/pos/CheckoutModal';
import { StrukModal } from '../components/pos/StrukModal';
import { formatRupiah } from '../utils/formatters';
import { usePendingSyncCount } from '../hooks/usePendingSyncCount';

interface PosKasirPageProps {
  onNavigateToProdukTab?: () => void;
}

export const PosKasirPage: React.FC<PosKasirPageProps> = ({ onNavigateToProdukTab }) => {
  const { currentOutlet, user, isOnline } = useAuth();
  const pendingSyncCount = usePendingSyncCount(currentOutlet?.id);

  // State Katalog Produk
  const [produkList, setProdukList] = useState<Produk[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedKategori, setSelectedKategori] = useState<string>('Semua');

  // State Keranjang
  const [cartItems, setCartItems] = useState<CartItemCheckout[]>([]);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);

  // State Modals
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState<boolean>(false);
  const [completedTransaksi, setCompletedTransaksi] = useState<Transaksi | null>(null);

  // State Bluetooth Printer Header Chip
  const [isBleConnected, setIsBleConnected] = useState<boolean>(printerBleService.isConnected());
  const [bleDeviceName, setBleDeviceName] = useState<string | null>(
    printerBleService.getConnectedDeviceName()
  );

  // Storage key untuk draft keranjang per outlet & user
  const draftKey = useMemo(() => {
    if (!currentOutlet?.id) return null;
    const uid = user?.id || 'kasir';
    return `pos_draft_cart_${currentOutlet.id}_${uid}`;
  }, [currentOutlet?.id, user?.id]);

  // 1. Pulihkan keranjang dari localStorage saat outlet/user siap
  useEffect(() => {
    if (!draftKey) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCartItems(parsed);
        }
      }
    } catch (err) {
      console.warn('[PosKasir] Gagal memulihkan draf keranjang:', err);
    }
  }, [draftKey]);

  // 2. Simpan draft keranjang ke localStorage setiap berubah
  useEffect(() => {
    if (!draftKey) return;
    try {
      if (cartItems.length > 0) {
        localStorage.setItem(draftKey, JSON.stringify(cartItems));
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch (err) {
      console.warn('[PosKasir] Gagal menyimpan draf keranjang:', err);
    }
  }, [cartItems, draftKey]);

  // 3. Listener Status Bluetooth Printer & Silent Auto-Reconnect
  useEffect(() => {
    const handleBleChange = () => {
      setIsBleConnected(printerBleService.isConnected());
      setBleDeviceName(printerBleService.getConnectedDeviceName());
    };

    window.addEventListener(BLE_PRINTER_STATUS_EVENT, handleBleChange);
    handleBleChange();

    // Auto-reconnect senyap jika ada printer tersimpan
    printerBleService.connectSavedPrinter().catch(() => {});

    return () => {
      window.removeEventListener(BLE_PRINTER_STATUS_EVENT, handleBleChange);
    };
  }, []);

  // 4. Muat Produk Aktif dari Cloud Firestore (HANYA jenis 'menu_jual' & aktif)
  const fetchProduk = async () => {
    if (!currentOutlet?.id) return;
    setLoading(true);
    setError(null);
    try {
      // Ambil seluruh produk aktif
      const list = await produkCloudService.getActiveProduk(currentOutlet.id, false);
      // Filter ketat: jenis menu_jual DAN aktif
      const menuJual = list.filter((p) => p.jenis === 'menu_jual' && p.aktif);
      setProdukList(menuJual);
    } catch (err: unknown) {
      console.error('[PosKasir] Gagal memuat produk:', err);
      setError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat menu kasir.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProduk();
  }, [currentOutlet?.id]);

  // Kategori unik dari produk yang tersedia
  const kategoriList = useMemo(() => {
    const set = new Set<string>();
    produkList.forEach((p) => {
      if (p.kategori?.trim()) set.add(p.kategori.trim());
    });
    return ['Semua', ...Array.from(set)];
  }, [produkList]);

  // Filter pencarian dan kategori
  const filteredProduk = useMemo(() => {
    return produkList.filter((p) => {
      const matchSearch = p.nama.toLowerCase().includes(searchQuery.toLowerCase());
      const matchKategori =
        selectedKategori === 'Semua' || p.kategori?.trim() === selectedKategori;
      return matchSearch && matchKategori;
    });
  }, [produkList, searchQuery, selectedKategori]);

  // Operasi Keranjang
  const handleAddToCart = (produk: Produk) => {
    const { hargaNeto } = hitungHargaNeto(produk.hargaJual, produk.diskonProduk);

    setCartItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.produkId === produk.id);
      if (existingIdx >= 0) {
        const copy = [...prev];
        const target = copy[existingIdx];
        const newQty = target.qty + 1;
        copy[existingIdx] = {
          ...target,
          qty: newQty,
          subtotal: hargaNeto * newQty,
        };
        return copy;
      }
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          produkId: produk.id,
          nama: produk.nama,
          qty: 1,
          hargaJual: produk.hargaJual,
          subtotal: hargaNeto,
          diskonProduk: produk.diskonProduk,
        },
      ];
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCartItems((prev) => {
      return prev
        .map((it) => {
          if (it.id === itemId) {
            const nextQty = it.qty + delta;
            if (nextQty <= 0) return null;
            const { hargaNeto } = hitungHargaNeto(it.hargaJual, it.diskonProduk);
            return {
              ...it,
              qty: nextQty,
              subtotal: hargaNeto * nextQty,
            };
          }
          return it;
        })
        .filter((it): it is CartItemCheckout => it !== null);
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
  };

  // Perhitungan Total
  const totalItemCount = useMemo(() => {
    return cartItems.reduce((acc, it) => acc + it.qty, 0);
  }, [cartItems]);

  const totalTagihan = useMemo(() => {
    return cartItems.reduce((acc, it) => acc + it.subtotal, 0);
  }, [cartItems]);

  // Handler Checkout Sukses
  const handleCheckoutSuccess = (transaksi: Transaksi) => {
    setIsCheckoutOpen(false);
    setIsMobileCartOpen(false);
    handleClearCart();
    setCompletedTransaksi(transaksi);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] p-3 sm:p-5 max-w-7xl mx-auto space-y-4">
      {/* Top Bar POS: Info Outlet, Chip Printer & Sync Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-stone-200">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-stone-900 leading-tight">
            Kasir Penjualan
          </h1>
          <p className="text-xs text-stone-500">
            {currentOutlet?.nama || 'Outlet'} • Pilih pesanan menu untuk transaksi
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Chip Printer Bluetooth */}
          <button
            type="button"
            onClick={() => setIsPrinterModalOpen(true)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 transition ${
              isBleConnected
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                : 'bg-stone-100 text-stone-600 border-stone-200 hover:bg-stone-200'
            }`}
            title="Klik untuk pengaturan printer thermal"
          >
            <Printer
              className={`w-3.5 h-3.5 ${
                isBleConnected ? 'text-emerald-600' : 'text-stone-400'
              }`}
            />
            <span className="hidden xs:inline">
              {isBleConnected ? `🖨️ Terhubung: ${bleDeviceName}` : '🖨️ Belum terhubung'}
            </span>
            <span className="xs:hidden">
              {isBleConnected ? 'Printer OK' : 'No Printer'}
            </span>
          </button>

          {/* Pending Sync Indicator */}
          {pendingSyncCount > 0 && (
            <div
              className="px-2.5 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5"
              title={`${pendingSyncCount} transaksi menunggu sinkronisasi`}
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-700 animate-spin" />
              <span>{pendingSyncCount} pending</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Layout: Desktop 2 Columns (Kiri: Katalog, Kanan: Keranjang) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
        {/* KOLOM KIRI: KATALOG MENU */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          {/* Baris Pencarian & Kategori */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari menu pesanan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm font-semibold text-stone-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Tabs Kategori */}
            {kategoriList.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {kategoriList.map((kat) => (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => setSelectedKategori(kat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      selectedKategori === kat
                        ? 'bg-stone-900 text-white shadow-xs'
                        : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {kat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Grid Katalog Produk */}
          {loading ? (
            /* Skeleton Loading Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-4 border border-stone-200 animate-pulse space-y-3 shadow-2xs"
                >
                  <div className="h-4 bg-stone-200 rounded-md w-3/4" />
                  <div className="h-3 bg-stone-100 rounded-md w-1/2" />
                  <div className="h-5 bg-stone-200 rounded-md w-2/3 pt-2" />
                  <div className="h-8 bg-stone-200 rounded-xl w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            /* Error State */
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="text-xs font-semibold text-rose-800">{error}</p>
              <button
                type="button"
                onClick={fetchProduk}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Coba Lagi
              </button>
            </div>
          ) : filteredProduk.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-2xl p-8 border border-stone-200 text-center space-y-3 shadow-2xs">
              <UtensilsCrossed className="w-12 h-12 text-stone-300 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-stone-800">
                  {searchQuery || selectedKategori !== 'Semua'
                    ? 'Tidak ada menu yang sesuai filter'
                    : 'Belum ada menu aktif'}
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  {searchQuery || selectedKategori !== 'Semua'
                    ? 'Coba gunakan kata kunci pencarian atau kategori lain.'
                    : 'Aktifkan produk jenis "menu_jual" di manajemen produk terlebih dahulu.'}
                </p>
              </div>
              {onNavigateToProdukTab && (
                <button
                  type="button"
                  onClick={onNavigateToProdukTab}
                  className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-xs transition"
                >
                  Ke Manajemen Produk
                </button>
              )}
            </div>
          ) : (
            /* Product Cards Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProduk.map((p) => {
                const inCart = cartItems.find((it) => it.produkId === p.id);
                const { hargaNeto, diskonNominal } = hitungHargaNeto(p.hargaJual, p.diskonProduk);
                const hasPromo = Boolean(p.diskonProduk && diskonNominal > 0);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    className="bg-white rounded-2xl p-3.5 sm:p-4 border border-stone-200 hover:border-orange-500 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between group active:scale-[0.98]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                        {p.kategori && (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px]">
                            {p.kategori}
                          </span>
                        )}
                        {hasPromo && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-bold">
                            {p.diskonProduk?.tipe === 'persen' ? `-${p.diskonProduk.nilai}%` : 'PROMO'}
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-xs sm:text-sm text-stone-900 group-hover:text-orange-600 line-clamp-2 leading-snug">
                        {p.nama}
                      </h4>
                    </div>

                    <div className="pt-3 flex items-center justify-between">
                      {hasPromo ? (
                        <div className="space-y-0.5">
                          <span className="text-xs sm:text-sm font-black text-stone-900 block font-mono">
                            {formatRupiah(hargaNeto)}
                          </span>
                          <span className="text-[10px] text-stone-400 line-through font-mono block">
                            {formatRupiah(p.hargaJual)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs sm:text-sm font-black text-stone-900 font-mono">
                          {formatRupiah(p.hargaJual)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(p);
                        }}
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-bold transition shadow-2xs ${
                          inCart
                            ? 'bg-orange-600 text-white'
                            : 'bg-stone-100 group-hover:bg-orange-600 group-hover:text-white text-stone-700'
                        }`}
                        title="Tambah ke pesanan"
                      >
                        {inCart ? inCart.qty : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* KOLOM KANAN: PANEL KERANJANG (DESKTOP) */}
        <div className="hidden lg:block lg:col-span-4 sticky top-20">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden flex flex-col max-h-[calc(100vh-6.5rem)]">
            {/* Header Keranjang */}
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-orange-600" />
                <h3 className="font-bold text-sm text-stone-900">Pesanan Aktif</h3>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold">
                  {totalItemCount}
                </span>
              </div>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700"
                >
                  Kosongkan
                </button>
              )}
            </div>

            {/* List Item Keranjang */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-stone-100">
              {cartItems.length === 0 ? (
                <div className="py-12 text-center text-stone-400 space-y-2">
                  <ShoppingBag className="w-10 h-10 mx-auto text-stone-300" />
                  <p className="text-xs font-semibold text-stone-500">Keranjang masih kosong</p>
                  <p className="text-[11px] text-stone-400">
                    Klik menu pada katalog untuk menambahkan pesanan
                  </p>
                </div>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-xs text-stone-900 truncate">{item.nama}</h5>
                      <span className="text-[11px] text-stone-500">
                        {formatRupiah(item.hargaJual)} / item
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, -1)}
                        className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition"
                      >
                        <Minus className="w-3 h-3" />
                      </button>

                      <span className="w-6 text-center text-xs font-bold text-stone-900">
                        {item.qty}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleUpdateQty(item.id, 1)}
                        className="w-6 h-6 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center transition"
                      >
                        <Plus className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="w-6 h-6 rounded-lg text-stone-300 hover:text-rose-600 flex items-center justify-center transition ml-1"
                        title="Hapus item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer Total & Tombol Bayar */}
            {cartItems.length > 0 && (
              <div className="p-4 border-t border-stone-100 bg-stone-50/50 space-y-3">
                <div className="flex justify-between items-center text-stone-900">
                  <span className="text-xs font-bold text-stone-600">Total Tagihan:</span>
                  <span className="text-lg font-black text-stone-900">
                    {formatRupiah(totalTagihan)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCheckoutOpen(true)}
                  className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 font-bold text-white text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99]"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>BAYAR ({formatRupiah(totalTagihan)})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE FLOATING CART BAR (Muncul di layar HP jika ada item di keranjang) */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-16 left-3 right-3 z-30 animate-in slide-in-from-bottom-2">
          <div
            onClick={() => setIsMobileCartOpen(true)}
            className="bg-stone-900 text-white rounded-2xl p-3.5 shadow-xl flex items-center justify-between cursor-pointer border border-stone-800"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center font-bold text-xs text-white">
                {totalItemCount}
              </div>
              <div>
                <span className="text-xs text-stone-300 block font-medium">Total Pesanan</span>
                <span className="text-sm font-black text-white">{formatRupiah(totalTagihan)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 px-3.5 py-2 rounded-xl transition">
              <span>Buka Keranjang</span>
              <ChevronUp className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* MOBILE CART BOTTOM SHEET */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-t-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border-t border-stone-200">
            {/* Header Sheet */}
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold text-sm text-stone-900">Rincian Keranjang</h3>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                  {totalItemCount} item
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body Sheet Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-stone-100">
              {cartItems.map((item) => (
                <div key={item.id} className="pt-3 first:pt-0 flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h5 className="font-bold text-xs text-stone-900 truncate">{item.nama}</h5>
                    <span className="text-[11px] text-stone-500">
                      {formatRupiah(item.hargaJual)} / item
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, -1)}
                      className="w-7 h-7 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold text-stone-900">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(item.id, 1)}
                      className="w-7 h-7 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      className="w-7 h-7 rounded-xl text-stone-300 hover:text-rose-600 flex items-center justify-center ml-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Sheet */}
            <div className="p-4 border-t border-stone-100 bg-stone-50/50 space-y-3 pb-8">
              <div className="flex justify-between items-center text-stone-900">
                <span className="text-xs font-bold text-stone-600">Total Tagihan:</span>
                <span className="text-xl font-black text-stone-900">
                  {formatRupiah(totalTagihan)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleClearCart}
                  className="py-2.5 px-3 rounded-xl bg-stone-200 hover:bg-stone-300 font-bold text-stone-700 text-xs transition"
                >
                  Kosongkan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 font-bold text-white text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Bayar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT PEMBAYARAN */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cartItems}
        total={totalTagihan}
        onSuccess={handleCheckoutSuccess}
      />

      {/* MODAL STRUK DIGITAL / ESC-POS */}
      <StrukModal
        isOpen={!!completedTransaksi}
        onClose={() => setCompletedTransaksi(null)}
        transaksi={completedTransaksi}
        onOpenPrinterSettings={() => setIsPrinterModalOpen(true)}
      />

      {/* MODAL PENGATURAN PRINTER BLUETOOTH */}
      <PrinterSettingsModal
        isOpen={isPrinterModalOpen}
        onClose={() => setIsPrinterModalOpen(false)}
      />
    </div>
  );
};
