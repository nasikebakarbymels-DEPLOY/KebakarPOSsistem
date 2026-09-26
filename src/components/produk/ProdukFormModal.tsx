import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Calculator,
  Utensils,
  Layers,
  Info,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  Produk,
  Resep,
  ItemResep,
  Bahan,
  KategoriProduk,
  JenisProduk,
  TipeItemResep,
} from '../../types';
import { formatRupiah, formatBiayaSatuan } from '../../utils/formatters';
import { resepService } from '../../services/resepService';
import { CreateProdukDTO } from '../../services/produkService';

interface ProdukFormModalProps {
  isOpen: boolean;
  produkToEdit?: Produk | null;
  resepToEdit?: Resep | null;
  availableBahan: Bahan[];
  allProduk: Produk[];
  allResep: Resep[];
  onClose: () => void;
  onSubmit: (produkData: CreateProdukDTO, itemsResep: ItemResep[]) => Promise<void>;
  onNavigateToBahanTab?: () => void;
}

export const ProdukFormModal: React.FC<ProdukFormModalProps> = ({
  isOpen,
  produkToEdit,
  resepToEdit,
  availableBahan,
  allProduk,
  allResep,
  onClose,
  onSubmit,
  onNavigateToBahanTab,
}) => {
  const [nama, setNama] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [kategori, setKategori] = useState<KategoriProduk>('Makanan');
  const [jenis, setJenis] = useState<JenisProduk>('menu_jual');
  const [hargaJual, setHargaJual] = useState<number | ''>('');
  const [aktif, setAktif] = useState<boolean>(true);
  const [catatan, setCatatan] = useState<string>('');

  const [itemsResep, setItemsResep] = useState<ItemResep[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter available component products (only jenis === 'komponen' and not editing self)
  const availableKomponen = useMemo(() => {
    return allProduk.filter(
      (p) => p.jenis === 'komponen' && (!produkToEdit || p.id !== produkToEdit.id)
    );
  }, [allProduk, produkToEdit]);

  // Pre-calculate HPP for each available component for live cost display
  const komponenHppMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const comp of availableKomponen) {
      const calc = resepService.hitungHPP(comp.id, allProduk, allResep, availableBahan);
      map.set(comp.id, calc.hpp);
    }
    return map;
  }, [availableKomponen, allProduk, allResep, availableBahan]);

  // Reset or populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSubmitting(false);

      if (produkToEdit) {
        setNama(produkToEdit.nama);
        setSku(produkToEdit.sku || '');
        setKategori((produkToEdit.kategori as KategoriProduk) || 'Makanan');
        setJenis((produkToEdit.jenis as JenisProduk) || 'menu_jual');
        setHargaJual(produkToEdit.hargaJual);
        setAktif(produkToEdit.aktif);
        setCatatan(produkToEdit.catatan || '');

        if (resepToEdit && resepToEdit.items) {
          setItemsResep([...resepToEdit.items]);
        } else {
          setItemsResep([]);
        }
      } else {
        setNama('');
        setSku('');
        setKategori('Makanan');
        setJenis('menu_jual');
        setHargaJual('');
        setAktif(true);
        setCatatan('');
        setItemsResep([]);
      }
    }
  }, [isOpen, produkToEdit, resepToEdit]);

  // Real-time recipe cost calculation
  const liveCalculation = useMemo(() => {
    let totalHpp = 0;
    let adaBahanTanpaBiaya = false;

    for (const it of itemsResep) {
      const q = it.qty ?? it.jumlah ?? 0;
      if (it.tipe === 'bahan' && it.bahanId) {
        const b = availableBahan.find((x) => x.id === it.bahanId);
        if (b && typeof b.biayaTerbaru === 'number' && b.biayaTerbaru >= 0) {
          totalHpp += q * b.biayaTerbaru;
        } else {
          adaBahanTanpaBiaya = true;
        }
      } else if (it.tipe === 'komponen' && it.produkId) {
        const compHpp = komponenHppMap.get(it.produkId) || 0;
        totalHpp += q * compHpp;
      }
    }

    const roundedHpp = Math.round(totalHpp);
    const numHargaJual = typeof hargaJual === 'number' ? hargaJual : 0;
    const margin =
      numHargaJual > 0 ? Number((((numHargaJual - roundedHpp) / numHargaJual) * 100).toFixed(1)) : 0;

    return {
      hpp: roundedHpp,
      margin,
      estimasiProfit: numHargaJual - roundedHpp,
      adaBahanTanpaBiaya,
    };
  }, [itemsResep, availableBahan, komponenHppMap, hargaJual]);

  // Recipe row handlers
  const handleAddItem = (tipe: TipeItemResep) => {
    if (tipe === 'bahan') {
      if (availableBahan.length === 0) {
        setErrorMsg('Belum ada bahan baku terdaftar. Tambahkan bahan terlebih dahulu.');
        return;
      }
      const firstBahan = availableBahan[0];
      const newItem: ItemResep = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tipe: 'bahan',
        bahanId: firstBahan.id,
        qty: 1,
        satuan: firstBahan.satuanDasar,
        namaSnapshot: firstBahan.nama,
      };
      setItemsResep([...itemsResep, newItem]);
    } else {
      if (availableKomponen.length === 0) {
        setErrorMsg('Belum ada produk komponen setengah jadi terdaftar.');
        return;
      }
      const firstKomponen = availableKomponen[0];
      const newItem: ItemResep = {
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        tipe: 'komponen',
        produkId: firstKomponen.id,
        qty: 1,
        satuan: 'pcs',
        namaSnapshot: firstKomponen.nama,
      };

      // Realtime validation
      const validation = resepService.validateResepStructure(
        produkToEdit?.id,
        [...itemsResep, newItem],
        allResep
      );
      if (!validation.valid) {
        setErrorMsg(validation.error || 'Komponen ini tidak dapat ditambahkan.');
        return;
      }

      setErrorMsg('');
      setItemsResep([...itemsResep, newItem]);
    }
  };

  const handleUpdateItem = (
    index: number,
    field: 'refId' | 'qty' | 'tipe',
    value: any
  ) => {
    const updated = [...itemsResep];
    const current = { ...updated[index] };

    if (field === 'tipe') {
      current.tipe = value;
      if (value === 'bahan') {
        const first = availableBahan[0];
        current.bahanId = first?.id || '';
        current.produkId = undefined;
        current.satuan = first?.satuanDasar || 'gram';
        current.namaSnapshot = first?.nama || '';
      } else {
        const first = availableKomponen[0];
        current.produkId = first?.id || '';
        current.bahanId = undefined;
        current.satuan = 'pcs';
        current.namaSnapshot = first?.nama || '';
      }
    } else if (field === 'refId') {
      if (current.tipe === 'bahan') {
        const b = availableBahan.find((x) => x.id === value);
        current.bahanId = value;
        current.satuan = b?.satuanDasar || '';
        current.namaSnapshot = b?.nama || '';
      } else {
        const k = availableKomponen.find((x) => x.id === value);
        current.produkId = value;
        current.satuan = 'pcs';
        current.namaSnapshot = k?.nama || '';
      }
    } else if (field === 'qty') {
      current.qty = Math.max(0, parseFloat(value) || 0);
    }

    updated[index] = current;

    // Realtime depth & cycle check
    const validation = resepService.validateResepStructure(
      produkToEdit?.id,
      updated,
      allResep
    );
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Struktur resep tidak valid.');
    } else {
      setErrorMsg('');
    }

    setItemsResep(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = itemsResep.filter((_, idx) => idx !== index);
    setItemsResep(updated);
    setErrorMsg('');
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedNama = nama.trim();
    if (!trimmedNama) {
      setErrorMsg('Nama produk wajib diisi.');
      return;
    }

    const numHargaJual = typeof hargaJual === 'number' ? hargaJual : parseFloat(hargaJual as any);
    if (isNaN(numHargaJual) || numHargaJual <= 0) {
      setErrorMsg('Harga jual wajib lebih besar dari 0.');
      return;
    }

    // Validate recipe items
    for (let i = 0; i < itemsResep.length; i++) {
      const it = itemsResep[i];
      if (it.tipe === 'bahan' && !it.bahanId) {
        setErrorMsg(`Item resep baris ke-${i + 1} belum memilih bahan.`);
        return;
      }
      if (it.tipe === 'komponen' && !it.produkId) {
        setErrorMsg(`Item resep baris ke-${i + 1} belum memilih komponen.`);
        return;
      }
      const itemQty = it.qty ?? it.jumlah ?? 0;
      if (itemQty <= 0) {
        setErrorMsg(`Jumlah (qty) pada item "${it.namaSnapshot}" harus lebih besar dari 0.`);
        return;
      }
    }

    // Full structural validation
    const validation = resepService.validateResepStructure(
      produkToEdit?.id,
      itemsResep,
      allResep
    );
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Struktur resep tidak valid.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(
        {
          nama: trimmedNama,
          sku: sku.trim() || undefined,
          kategori,
          hargaJual: numHargaJual,
          jenis,
          aktif,
          catatan: catatan.trim() || undefined,
        },
        itemsResep
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan produk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-600">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">
                {produkToEdit ? 'Edit Produk & Resep' : 'Tambah Produk Baru'}
              </h2>
              <p className="text-xs text-stone-500">
                Konfigurasi menu jual, komponen setengah jadi, dan resep HPP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <form onSubmit={handleSubmit} noValidate className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-medium">{errorMsg}</div>
            </div>
          )}

          {/* SECTION 1: INFORMASI PRODUK */}
          <div className="space-y-3 bg-stone-50/60 p-4 rounded-2xl border border-stone-200/60">
            <h3 className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-orange-600" />
              <span>Informasi Produk</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Nama */}
              <div className="sm:col-span-2">
                <label className="block text-stone-700 font-bold mb-1">
                  Nama Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="misal Kopi Susu Gula Aren, Espresso"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* SKU */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  SKU / Barcode <span className="text-stone-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="misal MNU-001"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Kategori */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Kategori <span className="text-rose-500">*</span>
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value as KategoriProduk)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Snack">Snack</option>
                  <option value="Paket">Paket</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              {/* Jenis Produk */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Jenis Produk <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setJenis('menu_jual')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition ${
                      jenis === 'menu_jual'
                        ? 'bg-blue-50 text-blue-700 border-blue-400 shadow-xs'
                        : 'bg-white text-stone-600 border-stone-200'
                    }`}
                  >
                    Menu Jual (POS)
                  </button>
                  <button
                    type="button"
                    onClick={() => setJenis('komponen')}
                    className={`py-2 px-3 rounded-xl border font-bold text-center transition ${
                      jenis === 'komponen'
                        ? 'bg-purple-50 text-purple-700 border-purple-400 shadow-xs'
                        : 'bg-white text-stone-600 border-stone-200'
                    }`}
                  >
                    Komponen (1/2 Jadi)
                  </button>
                </div>
              </div>

              {/* Harga Jual */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Harga Jual <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-stone-400 font-semibold text-xs">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={hargaJual}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                      setHargaJual(val);
                    }}
                    placeholder="misal 24000"
                    disabled={isSubmitting}
                    className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Status Aktif Switch */}
              <div className="sm:col-span-2 flex items-center justify-between pt-1">
                <div>
                  <span className="font-bold text-stone-800 block">Status Menu</span>
                  <span className="text-stone-500 text-[11px]">
                    Menu aktif dapat dipilih saat transaksi kasir POS
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aktif}
                    onChange={(e) => setAktif(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 2: RESEP & BUILDER MULTI-LEVEL */}
          <div className="space-y-3 bg-stone-50/60 p-4 rounded-2xl border border-stone-200/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-stone-800 text-xs flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-orange-600" />
                  <span>Resep Produk (Maksimal 3 Level)</span>
                </h3>
                <p className="text-[11px] text-stone-500">
                  Biaya bahan baku dan komponen setengah jadi pembentuk produk ini
                </p>
              </div>

              {/* Add item buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAddItem('bahan')}
                  className="px-2.5 py-1.5 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 font-bold hover:bg-orange-100 transition flex items-center gap-1 text-[11px]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Bahan Baku</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAddItem('komponen')}
                  disabled={availableKomponen.length === 0}
                  className="px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 transition flex items-center gap-1 text-[11px] disabled:opacity-40"
                  title={
                    availableKomponen.length === 0
                      ? 'Belum ada produk berjenis komponen'
                      : 'Tambah komponen setengah jadi'
                  }
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Komponen</span>
                </button>
              </div>
            </div>

            {/* Empty Recipe Prompt */}
            {itemsResep.length === 0 ? (
              <div className="p-4 bg-white rounded-xl border border-dashed border-stone-300 text-center space-y-1">
                <p className="font-semibold text-stone-600">Belum ada item dalam resep ini.</p>
                <p className="text-stone-400 text-[11px]">
                  Klik tombol <b>"+ Bahan Baku"</b> atau <b>"+ Komponen"</b> di atas untuk menyusun resep.
                </p>
              </div>
            ) : (
              /* Recipe Rows */
              <div className="space-y-2">
                {itemsResep.map((item, idx) => {
                  const isBahan = item.tipe === 'bahan';
                  let itemSubtotal = 0;
                  let hasCost = true;

                  const rowQty = item.qty ?? item.jumlah ?? 0;
                  if (isBahan) {
                    const b = availableBahan.find((x) => x.id === item.bahanId);
                    if (b && typeof b.biayaTerbaru === 'number' && b.biayaTerbaru >= 0) {
                      itemSubtotal = Math.round(rowQty * b.biayaTerbaru);
                    } else {
                      hasCost = false;
                    }
                  } else {
                    const compHpp = komponenHppMap.get(item.produkId || '') || 0;
                    itemSubtotal = Math.round(rowQty * compHpp);
                  }

                  return (
                    <div
                      key={item.id || idx}
                      className="bg-white p-3 rounded-xl border border-stone-200/80 shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        {/* Type Switcher Tag */}
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              isBahan
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {isBahan ? 'Bahan Baku' : 'Komponen'}
                          </span>
                          <span className="text-stone-400 text-[11px]">#{idx + 1}</span>
                        </div>

                        {/* Delete row */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        {/* Select Bahan or Komponen */}
                        <div className="sm:col-span-6">
                          {isBahan ? (
                            <select
                              value={item.bahanId || ''}
                              onChange={(e) => handleUpdateItem(idx, 'refId', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-800 bg-white font-medium text-xs focus:ring-1 focus:ring-orange-500"
                            >
                              {availableBahan.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.nama} (Satuan: {b.satuanDasar})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <select
                              value={item.produkId || ''}
                              onChange={(e) => handleUpdateItem(idx, 'refId', e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-stone-200 text-stone-800 bg-white font-medium text-xs focus:ring-1 focus:ring-purple-500"
                            >
                              {availableKomponen.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.nama} (Komponen)
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        {/* Qty Input */}
                        <div className="sm:col-span-3 flex items-center gap-1">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={item.qty || ''}
                            onChange={(e) => handleUpdateItem(idx, 'qty', e.target.value)}
                            placeholder="Qty"
                            className="w-full px-2 py-1.5 rounded-lg border border-stone-200 text-stone-900 font-bold text-xs"
                          />
                          <span className="text-[11px] text-stone-500 font-semibold shrink-0">
                            {item.satuan}
                          </span>
                        </div>

                        {/* Subtotal Biaya */}
                        <div className="sm:col-span-3 text-right">
                          {hasCost ? (
                            <span className="font-mono font-bold text-stone-900 text-xs">
                              {formatRupiah(itemSubtotal)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                              Belum ada biaya
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* LIVE HPP & MARGIN SUMMARY BOX */}
            <div className="p-3.5 bg-orange-50/80 rounded-2xl border border-orange-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-orange-950 font-bold flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-orange-600" />
                  Kalkulasi HPP & Margin Real-time
                </span>
                {liveCalculation.adaBahanTanpaBiaya && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Bahan tanpa biaya
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                <div className="bg-white/80 p-2 rounded-xl border border-orange-100">
                  <span className="text-[10px] text-stone-400 block font-semibold uppercase">
                    Total HPP
                  </span>
                  <span className="font-extrabold text-stone-900 text-sm font-mono">
                    {formatRupiah(liveCalculation.hpp)}
                  </span>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-orange-100">
                  <span className="text-[10px] text-stone-400 block font-semibold uppercase">
                    Margin Produk
                  </span>
                  <span
                    className={`font-extrabold text-sm ${
                      liveCalculation.margin >= 50
                        ? 'text-emerald-600'
                        : liveCalculation.margin >= 30
                        ? 'text-amber-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {liveCalculation.margin}%
                  </span>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-orange-100">
                  <span className="text-[10px] text-stone-400 block font-semibold uppercase">
                    Estimasi Profit
                  </span>
                  <span className="font-bold text-stone-800 text-xs font-mono">
                    {formatRupiah(liveCalculation.estimasiProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 rounded-2xl border border-stone-200 text-stone-700 font-bold hover:bg-stone-50 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !!errorMsg}
              className="flex-1 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>{produkToEdit ? 'Simpan Perubahan' : 'Tambah Produk'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
