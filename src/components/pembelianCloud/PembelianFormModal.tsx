import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Calendar,
  Building2,
  FileText,
  AlertTriangle,
  Loader2,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeftRight,
} from 'lucide-react';
import { Bahan, KemasanBahan, PembelianBahan } from '../../types';
import { bahanCloudService } from '../../services/cloud/bahanCloudService';
import {
  pembelianCloudService,
  CreatePembelianItemInput,
  PerubahanHargaAcuanItem,
} from '../../services/cloud/pembelianCloudService';
import {
  formatRupiah,
  formatBiayaSatuan,
  getTodayDateString,
} from '../../utils/formatters';
import { ItemPickerSheet, ItemPickerOption } from '../common/ItemPickerSheet';

interface PembelianFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (
    pembelianId: string,
    hargaAcuanDiubah: PerubahanHargaAcuanItem[],
    gagalUpdate?: Array<{ bahanNama: string; alasan: string }>
  ) => void;
  outletId: string;
  userId: string;
  editingPembelian?: PembelianBahan | null;
}

interface FormRowItem {
  id: string; // row key
  bahanId: string;
  kemasanId: string;
  qtyInput: string;
  hargaInput: string;
}

interface CalonPerubahanHarga {
  bahanId: string;
  bahanNama: string;
  satuanDasar: string;
  hargaLama: number;
  hargaBaru: number;
  perubahanPersen: number;
  isPerubahanBesar: boolean;
}

export const PembelianFormModal: React.FC<PembelianFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  outletId,
  userId,
  editingPembelian,
}) => {
  const isEditMode = Boolean(editingPembelian);

  // Form states
  const [tanggal, setTanggal] = useState<string>(getTodayDateString());
  const [supplier, setSupplier] = useState<string>('');
  const [catatan, setCatatan] = useState<string>('');
  const [rowItems, setRowItems] = useState<FormRowItem[]>([]);

  // Master bahan aktif
  const [bahanList, setBahanList] = useState<Bahan[]>([]);
  const [loadingBahan, setLoadingBahan] = useState<boolean>(true);
  const [errorBahan, setErrorBahan] = useState<string | null>(null);

  // Validation & Submit State
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Dialog Konfirmasi Perubahan Harga Acuan (Create Mode Only)
  const [showConfirmHargaModal, setShowConfirmHargaModal] = useState<boolean>(false);
  const [daftarCalonPerubahan, setDaftarCalonPerubahan] = useState<CalonPerubahanHarga[]>([]);

  // Load master bahan aktif saat modal dibuka
  useEffect(() => {
    if (!isOpen || !outletId) return;

    let isMounted = true;
    const loadBahan = async () => {
      try {
        setLoadingBahan(true);
        setErrorBahan(null);
        const data = await bahanCloudService.getActiveBahan(outletId);
        if (!isMounted) return;
        setBahanList(data);
      } catch (err) {
        console.error('[PembelianFormModal] Gagal memuat bahan:', err);
        if (isMounted) setErrorBahan('Gagal memuat master bahan baku dari server.');
      } finally {
        if (isMounted) setLoadingBahan(false);
      }
    };

    loadBahan();
    return () => {
      isMounted = false;
    };
  }, [isOpen, outletId]);

  // Inisialisasi form saat modal terbuka atau editingPembelian berubah
  useEffect(() => {
    if (!isOpen) {
      setShowConfirmHargaModal(false);
      setDaftarCalonPerubahan([]);
      setFormErrors({});
      return;
    }

    if (editingPembelian) {
      setTanggal(editingPembelian.tanggal || getTodayDateString());
      setSupplier(editingPembelian.supplier || '');
      setCatatan(editingPembelian.catatan || '');

      const initialRows: FormRowItem[] = (editingPembelian.items || []).map((it, idx) => ({
        id: `row-${idx}-${Date.now()}`,
        bahanId: it.bahanId,
        kemasanId: it.kemasanId,
        qtyInput: it.qty !== undefined && it.qty !== null ? String(it.qty) : '1',
        hargaInput: it.hargaTotal !== undefined && it.hargaTotal !== null ? String(it.hargaTotal) : '',
      }));

      setRowItems(
        initialRows.length > 0
          ? initialRows
          : [{ id: `row-0-${Date.now()}`, bahanId: '', kemasanId: '', qtyInput: '1', hargaInput: '' }]
      );
    } else {
      // Create mode
      setTanggal(getTodayDateString());
      setSupplier('');
      setCatatan('');
      setRowItems([
        { id: `row-0-${Date.now()}`, bahanId: '', kemasanId: '', qtyInput: '1', hargaInput: '' },
      ]);
    }
  }, [isOpen, editingPembelian]);

  // Map bahan untuk lookup cepat
  const bahanMap = useMemo(() => {
    const map = new Map<string, Bahan>();
    for (const b of bahanList) {
      map.set(b.id, b);
    }
    return map;
  }, [bahanList]);

  // State ItemPickerSheet Bahan (Tugas 3)
  const [pickerState, setPickerState] = useState<{
    isOpen: boolean;
    rowId: string | null;
  }>({
    isOpen: false,
    rowId: null,
  });

  // Opsi Bahan untuk ItemPickerSheet (tab tidak perlu, duplikat tidak dilarang)
  const pickerBahanItems: ItemPickerOption[] = useMemo(() => {
    return bahanList.map((b) => ({
      id: b.id,
      label: b.nama,
      sublabel: `Satuan: ${b.satuanDasar} · Acuan: ${formatBiayaSatuan(b.hargaPerSatuanDasar, b.satuanDasar)}`,
      badge: b.satuanDasar,
      badgeColor: 'orange',
    }));
  }, [bahanList]);

  // Otomatis isi kemasan pertama jika belum dipilih saat bahan terpilih
  const handleBahanChange = (rowId: string, newBahanId: string) => {
    const selectedBahan = bahanMap.get(newBahanId);
    let defaultKemasanId = '';

    if (selectedBahan && selectedBahan.kemasanList && selectedBahan.kemasanList.length > 0) {
      const acuanKemasan = selectedBahan.kemasanList.find((k) => k.acuan);
      defaultKemasanId = acuanKemasan ? acuanKemasan.id : selectedBahan.kemasanList[0].id;
    }

    setRowItems((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          const kemasanObj = selectedBahan?.kemasanList?.find((k) => k.id === defaultKemasanId);
          const qtyNum = parseFloat(row.qtyInput) || 0;
          let newHargaInput = row.hargaInput;
          const isHargaEmptyOrZero =
            !row.hargaInput || row.hargaInput.trim() === '' || row.hargaInput.trim() === '0';
          if (
            isHargaEmptyOrZero &&
            kemasanObj &&
            typeof kemasanObj.hargaPerKemasan === 'number' &&
            kemasanObj.hargaPerKemasan > 0
          ) {
            const effectiveQty = qtyNum > 0 ? qtyNum : 1;
            newHargaInput = String(kemasanObj.hargaPerKemasan * effectiveQty);
          }
          return {
            ...row,
            bahanId: newBahanId,
            kemasanId: defaultKemasanId,
            hargaInput: newHargaInput,
          };
        }
        return row;
      })
    );
  };

  const handleKemasanChange = (rowId: string, newKemasanId: string) => {
    setRowItems((prev) =>
      prev.map((row) => {
        if (row.id === rowId) {
          const selectedBahan = bahanMap.get(row.bahanId);
          const kemasanObj = selectedBahan?.kemasanList?.find((k) => k.id === newKemasanId);
          const qtyNum = parseFloat(row.qtyInput) || 0;
          let newHargaInput = row.hargaInput;
          const isHargaEmptyOrZero =
            !row.hargaInput || row.hargaInput.trim() === '' || row.hargaInput.trim() === '0';
          if (
            isHargaEmptyOrZero &&
            kemasanObj &&
            typeof kemasanObj.hargaPerKemasan === 'number' &&
            kemasanObj.hargaPerKemasan > 0
          ) {
            const effectiveQty = qtyNum > 0 ? qtyNum : 1;
            newHargaInput = String(kemasanObj.hargaPerKemasan * effectiveQty);
          }
          return {
            ...row,
            kemasanId: newKemasanId,
            hargaInput: newHargaInput,
          };
        }
        return row;
      })
    );
  };

  const handleQtyInputChange = (rowId: string, val: string) => {
    setRowItems((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, qtyInput: val } : row))
    );
  };

  const handleHargaInputChange = (rowId: string, val: string) => {
    setRowItems((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, hargaInput: val } : row))
    );
  };

  const handleAddRow = () => {
    setRowItems((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bahanId: '',
        kemasanId: '',
        qtyInput: '1',
        hargaInput: '',
      },
    ]);
  };

  const handleRemoveRow = (rowId: string) => {
    if (rowItems.length <= 1) return;
    setRowItems((prev) => prev.filter((r) => r.id !== rowId));
  };

  // Kalkulasi total live
  const totalPembelianLive = useMemo(() => {
    return rowItems.reduce((sum, item) => {
      const qtyNum = parseFloat(item.qtyInput) || 0;
      if (qtyNum <= 0) return sum;
      const hargaNum = parseFloat(item.hargaInput) || 0;
      return sum + hargaNum;
    }, 0);
  }, [rowItems]);

  // Validasi form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!tanggal) {
      errors.tanggal = 'Tanggal pembelian wajib diisi.';
    }

    const trimmedSupplier = supplier.trim();
    if (trimmedSupplier.length > 0 && trimmedSupplier.length < 2) {
      errors.supplier = 'Nama supplier minimal 2 karakter jika diisi.';
    }

    if (rowItems.length === 0) {
      errors.items = 'Minimal harus ada 1 item pembelian.';
    } else {
      rowItems.forEach((row, idx) => {
        if (!row.bahanId) {
          errors[`item_${idx}_bahan`] = `Pilih bahan untuk item #${idx + 1}.`;
        }
        if (!row.kemasanId) {
          errors[`item_${idx}_kemasan`] = `Pilih kemasan untuk item #${idx + 1}.`;
        }
        const qtyNum = parseFloat(row.qtyInput) || 0;
        if (qtyNum <= 0) {
          errors[`item_${idx}_qty`] = `Qty item #${idx + 1} harus lebih dari 0.`;
        }
        const hargaNum = parseFloat(row.hargaInput) || 0;
        if (hargaNum <= 0) {
          errors[`item_${idx}_harga`] = `Total harga item #${idx + 1} harus lebih dari 0.`;
        }
      });
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Susun payload item yang siap dikirim
  const prepareItemsPayload = (): CreatePembelianItemInput[] => {
    return rowItems.map((row) => {
      const b = bahanMap.get(row.bahanId);
      const k = b?.kemasanList?.find((itemK) => itemK.id === row.kemasanId);

      const isi =
        typeof k?.isi === 'number' && k.isi > 0
          ? k.isi
          : (k?.netto && k.netto > 0 ? k.netto : 1);

      const qtyNum = parseFloat(row.qtyInput) || 0;
      const hargaNum = parseFloat(row.hargaInput) || 0;

      return {
        bahanId: row.bahanId,
        kemasanId: row.kemasanId,
        namaBahanSnapshot: b?.nama || 'Bahan',
        namaKemasanSnapshot: k?.nama || 'Kemasan',
        isiPerKemasanSnapshot: isi,
        qty: qtyNum,
        hargaTotal: hargaNum,
        isAcuanKemasan: Boolean(k?.acuan),
      };
    });
  };

  // Handler tombol "Simpan Pembelian"
  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    if (isEditMode) {
      // Mode edit: langsung simpan tanpa dialog konfirmasi perubahan harga acuan
      executeSave();
      return;
    }

    // Mode create: periksa apakah ada item berkemasan acuan
    const itemsPayload = prepareItemsPayload();
    const acuanItems = itemsPayload.filter((it) => it.isAcuanKemasan);

    if (acuanItems.length === 0) {
      // Tidak ada kemasan acuan yang tersentuh, langsung simpan
      executeSave();
      return;
    }

    // Ada item berkemasan acuan: hitung calon perubahan harga
    const calonList: CalonPerubahanHarga[] = [];

    for (const item of acuanItems) {
      const b = bahanMap.get(item.bahanId);
      if (!b) continue;

      const hargaLama = typeof b.hargaPerSatuanDasar === 'number' ? b.hargaPerSatuanDasar : 0;
      const hargaPerUnit = item.qty > 0 ? item.hargaTotal / item.qty : 0;
      const isi = item.isiPerKemasanSnapshot > 0 ? item.isiPerKemasanSnapshot : 1;
      const hargaBaru = Number((hargaPerUnit / isi).toFixed(4));

      let perubahanPersen = 0;
      if (hargaLama > 0) {
        perubahanPersen = Number((((hargaBaru - hargaLama) / hargaLama) * 100).toFixed(1));
      } else if (hargaBaru > 0) {
        perubahanPersen = 100;
      }

      const isPerubahanBesar = Math.abs(perubahanPersen) >= 50;

      calonList.push({
        bahanId: b.id,
        bahanNama: b.nama,
        satuanDasar: b.satuanDasar,
        hargaLama,
        hargaBaru,
        perubahanPersen,
        isPerubahanBesar,
      });
    }

    setDaftarCalonPerubahan(calonList);
    setShowConfirmHargaModal(true);
  };

  // Eksekusi penyimpanan ke Firestore Cloud
  const executeSave = async () => {
    try {
      setIsSubmitting(true);
      const itemsPayload = prepareItemsPayload();

      if (isEditMode && editingPembelian) {
        await pembelianCloudService.updatePembelian(
          outletId,
          editingPembelian.id,
          {
            tanggal,
            supplier: supplier.trim(),
            catatan: catatan.trim() || undefined,
            items: itemsPayload,
          },
          userId
        );

        onSuccess(editingPembelian.id, []);
      } else {
        const result = await pembelianCloudService.createPembelian(
          outletId,
          {
            tanggal,
            supplier: supplier.trim(),
            catatan: catatan.trim() || undefined,
            items: itemsPayload,
          },
          userId
        );

        setShowConfirmHargaModal(false);
        onSuccess(result.id, result.hargaAcuanDiubah, result.gagalUpdate);
      }
    } catch (err: unknown) {
      console.error('[PembelianFormModal] Gagal menyimpan pembelian:', err);
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan transaksi pembelian.';
      setFormErrors((prev) => ({ ...prev, submit: msg }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 flex items-center justify-between bg-stone-50/60 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-orange-600" />
              <span>{isEditMode ? 'Edit Catatan Pembelian' : 'Catat Pembelian Bahan Baru'}</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {isEditMode
                ? 'Perbarui data vendor, tanggal, atau kuantitas pembelian'
                : 'Mencatat pengeluaran belanja bahan dan auto-update harga acuan resep'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body Form */}
        <form onSubmit={handleSubmitClick} noValidate className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Banner Peringatan Mode Edit */}
          {isEditMode && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900 shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Kebijakan Audit:</strong> Mengubah pembelian lama tidak memundurkan harga
                acuan bahan baku agar resep produk terdahulu tetap konsisten.
              </div>
            </div>
          )}

          {/* Error Submit Banner */}
          {formErrors.submit && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2 text-xs font-semibold text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formErrors.submit}</span>
            </div>
          )}

          {/* Loading Master Bahan State */}
          {loadingBahan ? (
            <div className="py-12 text-center text-xs text-stone-500 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
              <span>Menyiapkan master bahan baku...</span>
            </div>
          ) : errorBahan ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {errorBahan}
            </div>
          ) : bahanList.length === 0 ? (
            <div className="p-6 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-2">
              <div className="text-xs font-bold text-amber-900">
                Belum ada master bahan baku di outlet ini.
              </div>
              <p className="text-[11px] text-amber-800 max-w-sm mx-auto">
                Silakan buat bahan baku terlebih dahulu di tab <strong>Bahan Baku</strong> sebelum
                mencatat pembelian.
              </p>
            </div>
          ) : (
            <>
              {/* Field Header: Tanggal & Supplier */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-500" />
                    <span>Tanggal Pembelian *</span>
                  </label>
                  <input
                    type="date"
                    value={tanggal}
                    disabled={isSubmitting}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-stone-50/50 disabled:bg-stone-100 disabled:text-stone-400"
                  />
                  {formErrors.tanggal && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      {formErrors.tanggal}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-stone-500" />
                    <span>Nama Supplier / Toko (Opsional)</span>
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    disabled={isSubmitting}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder="Contoh: Toko Bahan Makmur, Grosir Kopi, Tokopedia"
                    className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500 placeholder:text-stone-400 disabled:bg-stone-100 disabled:text-stone-400"
                  />
                  {formErrors.supplier && (
                    <p className="text-[11px] text-rose-600 font-semibold mt-1">
                      {formErrors.supplier}
                    </p>
                  )}
                </div>
              </div>

              {/* Baris Item Pembelian Dinamis */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-stone-900 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-orange-600" />
                    <span>Item Bahan yang Dibeli ({rowItems.length})</span>
                  </label>
                  <span className="text-[11px] text-stone-400">
                    Pilih bahan & kemasan pembelian
                  </span>
                </div>

                {formErrors.items && (
                  <p className="text-[11px] text-rose-600 font-semibold">{formErrors.items}</p>
                )}

                <div className="space-y-2.5">
                  {rowItems.map((row, idx) => {
                    const selectedBahan = bahanMap.get(row.bahanId);
                    const selectedKemasan = selectedBahan?.kemasanList?.find(
                      (k) => k.id === row.kemasanId
                    );

                    const isi =
                      typeof selectedKemasan?.isi === 'number' && selectedKemasan.isi > 0
                        ? selectedKemasan.isi
                        : (selectedKemasan?.netto && selectedKemasan.netto > 0
                            ? selectedKemasan.netto
                            : 1);

                    const qtyNum = parseFloat(row.qtyInput) || 0;
                    const hargaNum = parseFloat(row.hargaInput) || 0;
                    const hargaPerUnit = qtyNum > 0 ? hargaNum / qtyNum : 0;
                    const hargaPerSatuan = isi > 0 ? hargaPerUnit / isi : 0;
                    const isAcuan = Boolean(selectedKemasan?.acuan);
                    const isQtyInvalid = qtyNum <= 0;
                    const isHargaInvalid = hargaNum <= 0;

                    // Cek kombinasi bahan+kemasan sama di baris lain (duplikat tidak dilarang)
                    const isDuplicateCombination = Boolean(
                      row.bahanId &&
                        row.kemasanId &&
                        rowItems.some(
                          (other) =>
                            other.id !== row.id &&
                            other.bahanId === row.bahanId &&
                            other.kemasanId === row.kemasanId
                        )
                    );

                    return (
                      <div
                        key={row.id}
                        className={`p-3 rounded-2xl border transition ${
                          isAcuan
                            ? 'border-orange-300 bg-orange-50/20 shadow-2xs'
                            : 'border-stone-200 bg-white shadow-2xs'
                        } space-y-2 hover:border-stone-300`}
                      >
                        {/* Tingkat 1: Nama Bahan + Acuan + Chip Duplikat + Estimasi Biaya/Total */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                            <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>

                            <button
                              type="button"
                              onClick={() => setPickerState({ isOpen: true, rowId: row.id })}
                              className="text-left font-bold text-xs sm:text-sm text-stone-900 hover:text-orange-600 transition truncate max-w-[200px] sm:max-w-xs"
                              title="Klik untuk memilih atau mengganti bahan"
                            >
                              {selectedBahan ? (
                                selectedBahan.nama
                              ) : (
                                <span className="text-orange-600 font-semibold underline decoration-dashed">
                                  Pilih Bahan Baku...
                                </span>
                              )}
                            </button>

                            {selectedBahan && (
                              <span className="text-[10px] text-stone-400 font-medium shrink-0">
                                ({selectedBahan.satuanDasar})
                              </span>
                            )}

                            {isAcuan && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold shrink-0">
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                <span>Acuan</span>
                              </span>
                            )}

                            {/* Chip amber bila kombinasi bahan+kemasan sama sudah ada */}
                            {isDuplicateCombination && (
                              <span className="inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md shrink-0">
                                kombinasi sama sudah ada
                              </span>
                            )}
                          </div>

                          {/* Biaya hitung / subtotal di kanan tingkat 1 */}
                          <div className="text-right shrink-0">
                            <div className="text-xs sm:text-sm font-black text-stone-900 font-mono">
                              {formatRupiah(hargaNum)}
                            </div>
                            {hargaPerSatuan > 0 && selectedBahan && (
                              <div className="text-[10px] text-orange-700 font-bold">
                                {formatBiayaSatuan(hargaPerSatuan, selectedBahan.satuanDasar)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tingkat 2: Select Kemasan + Input Qty + Input Total Harga + Tombol Ganti + Tombol Hapus */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-stone-100">
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                            {/* Select Kemasan Native Kecil */}
                            <div className="min-w-[130px] flex-1 sm:flex-initial sm:w-44">
                              <select
                                value={row.kemasanId}
                                onChange={(e) => handleKemasanChange(row.id, e.target.value)}
                                disabled={!row.bahanId || isSubmitting}
                                className="w-full px-2 py-1 rounded-lg border border-stone-200 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-stone-50/70 disabled:bg-stone-100 disabled:text-stone-400"
                              >
                                <option value="">-- Kemasan --</option>
                                {(selectedBahan?.kemasanList || []).map((k) => (
                                  <option key={k.id} value={k.id}>
                                    {k.nama} ({k.isi || k.netto} {selectedBahan?.satuanDasar})
                                    {k.acuan ? ' (acuan)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Input Qty */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-stone-400 uppercase">Qty</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={isSubmitting}
                                value={row.qtyInput}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleQtyInputChange(row.id, e.target.value)}
                                placeholder="Qty"
                                className={`w-16 sm:w-20 px-2 py-1 rounded-lg border text-xs font-bold text-stone-900 text-center focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-stone-100 ${
                                  isQtyInvalid ? 'border-rose-300 bg-rose-50/50' : 'border-stone-200 bg-stone-50/70'
                                }`}
                              />
                            </div>

                            {/* Input Total Harga */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-stone-400 uppercase">Rp</span>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={isSubmitting}
                                value={row.hargaInput}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => handleHargaInputChange(row.id, e.target.value)}
                                placeholder="Total"
                                className={`w-24 sm:w-28 px-2 py-1 rounded-lg border text-xs font-bold text-stone-900 text-right focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-stone-100 ${
                                  isHargaInvalid ? 'border-rose-300 bg-rose-50/50' : 'border-stone-200 bg-stone-50/70'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Action Buttons: Ganti & Hapus */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPickerState({ isOpen: true, rowId: row.id });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 active:scale-95 transition"
                              title="Ganti bahan baku"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5 text-stone-500" />
                              <span>Ganti</span>
                            </button>

                            {rowItems.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveRow(row.id);
                                }}
                                disabled={isSubmitting}
                                className="text-stone-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition active:scale-95 disabled:opacity-50"
                                title="Hapus baris item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Pesan Error Validasi Row jika ada */}
                        {(formErrors[`item_${idx}_bahan`] ||
                          formErrors[`item_${idx}_kemasan`] ||
                          formErrors[`item_${idx}_qty`] ||
                          formErrors[`item_${idx}_harga`]) && (
                          <div className="text-[10px] text-rose-600 font-semibold space-y-0.5 pt-1">
                            {formErrors[`item_${idx}_bahan`] && <p>• {formErrors[`item_${idx}_bahan`]}</p>}
                            {formErrors[`item_${idx}_kemasan`] && <p>• {formErrors[`item_${idx}_kemasan`]}</p>}
                            {formErrors[`item_${idx}_qty`] && <p>• {formErrors[`item_${idx}_qty`]}</p>}
                            {formErrors[`item_${idx}_harga`] && <p>• {formErrors[`item_${idx}_harga`]}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Bilah Lengket Tombol Tambah Item */}
                <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-xs py-2 px-1 border-t border-stone-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={handleAddRow}
                    disabled={isSubmitting}
                    className="w-full py-2.5 rounded-xl border border-dashed border-orange-300 hover:border-orange-500 bg-orange-50/50 hover:bg-orange-100/60 text-orange-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-98 shadow-2xs"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Item Bahan Lainnya</span>
                  </button>
                </div>
              </div>

              {/* Catatan Tambahan */}
              <div className="pt-2 border-t border-stone-100">
                <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-500" />
                  <span>Catatan Pengeluaran (Opsional)</span>
                </label>
                <textarea
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  rows={2}
                  placeholder="Contoh: No faktur F-1029, beli saat promo diskon 10%"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500 resize-none"
                />
              </div>

              {/* Baris Total Live */}
              <div className="p-3.5 rounded-xl bg-stone-100/80 border border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-stone-900 block">Total Pengeluaran:</span>
                  <span className="text-[11px] text-stone-500">
                    Jumlah dari {rowItems.length} item bahan
                  </span>
                </div>
                <div className="text-base sm:text-lg font-black text-orange-700">
                  {formatRupiah(totalPembelianLive)}
                </div>
              </div>
            </>
          )}

          {/* Footer Submit Buttons */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || loadingBahan || bahanList.length === 0}
              className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>{isEditMode ? 'Simpan Perubahan' : 'Simpan Pembelian'}</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* DIALOG KONFIRMASI PERUBAHAN HARGA ACUAN BAHAN (CREATE MODE) */}
      {showConfirmHargaModal && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-5 sm:p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-stone-900 leading-snug">
                  Konfirmasi Perubahan Harga Acuan Bahan
                </h3>
                <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                  Pembelian ini memuat kemasan acuan yang akan memperbarui biaya acuan resep bahan baku
                  berikut:
                </p>
              </div>
            </div>

            {/* List Perubahan Harga Acuan */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {daftarCalonPerubahan.map((item) => {
                return (
                  <div
                    key={item.bahanId}
                    className="p-3 rounded-xl border border-stone-200 bg-stone-50 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900 text-xs">{item.bahanNama}</span>
                      {item.isPerubahanBesar && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-200">
                          Perubahan besar ({item.perubahanPersen > 0 ? '+' : ''}
                          {item.perubahanPersen}%)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-stone-700">
                      <span className="text-stone-500">
                        {formatBiayaSatuan(item.hargaLama, item.satuanDasar)}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                      <span className="text-orange-700 font-black">
                        {formatBiayaSatuan(item.hargaBaru, item.satuanDasar)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-[11px] text-stone-500 bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl">
              Harga acuan baru akan otomatis digunakan pada kalkulasi HPP resep menu produk aktif.
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setShowConfirmHargaModal(false)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={executeSave}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Ya, Simpan Pembelian</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ItemPickerSheet untuk Memilih / Mengganti Bahan Baku (Tugas 3) */}
      <ItemPickerSheet
        isOpen={pickerState.isOpen}
        onClose={() => setPickerState((prev) => ({ ...prev, isOpen: false }))}
        title="Pilih Bahan Baku"
        items={pickerBahanItems}
        onSelect={(selectedBahanId) => {
          if (pickerState.rowId) {
            handleBahanChange(pickerState.rowId, selectedBahanId);
          }
        }}
        searchPlaceholder="Cari nama bahan baku..."
      />
    </div>
  );
};
