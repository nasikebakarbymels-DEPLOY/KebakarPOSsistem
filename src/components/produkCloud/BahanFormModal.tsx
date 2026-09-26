import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, Check, AlertCircle, Loader2, Sparkles, HelpCircle } from 'lucide-react';
import { Bahan, KemasanBahan, SatuanDasar } from '../../types';
import { bahanCloudService, hitungHargaPerSatuanDasar } from '../../services/cloud/bahanCloudService';
import { formatBiayaSatuan } from '../../utils/formatters';

interface BahanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedBahan: Bahan) => void;
  bahanToEdit?: Bahan | null;
  outletId: string;
  userId: string;
}

interface FormKemasanItem {
  id: string;
  nama: string;
  isi: string | number;
  hargaPerKemasan: string | number;
  acuan: boolean;
}

export const BahanFormModal: React.FC<BahanFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  bahanToEdit,
  outletId,
  userId,
}) => {
  const [nama, setNama] = useState('');
  const [sku, setSku] = useState('');
  const [satuanDasar, setSatuanDasar] = useState<SatuanDasar>('gram');
  const [catatan, setCatatan] = useState('');
  const [kemasanList, setKemasanList] = useState<FormKemasanItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inisialisasi form saat modal terbuka atau bahanToEdit berubah
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setIsSubmitting(false);

      if (bahanToEdit) {
        setNama(bahanToEdit.nama);
        setSku(bahanToEdit.sku || '');
        setSatuanDasar(bahanToEdit.satuanDasar);
        setCatatan(bahanToEdit.catatan || '');

        const mapped: FormKemasanItem[] = (bahanToEdit.kemasanList || []).map((k) => ({
          id: k.id || `k-${Math.random().toString(36).substring(2, 7)}`,
          nama: k.nama,
          isi: k.isi ?? k.netto ?? '',
          hargaPerKemasan: k.hargaPerKemasan ?? 0,
          acuan: Boolean(k.acuan),
        }));

        // Pastikan minimal ada 1 kemasan
        if (mapped.length === 0) {
          mapped.push({
            id: `k-${Date.now()}`,
            nama: 'Kemasan Standar',
            isi: 1000,
            hargaPerKemasan: 0,
            acuan: true,
          });
        } else {
          // Pastikan tepat ada 1 acuan
          const acuanCount = mapped.filter((k) => k.acuan).length;
          if (acuanCount === 0) {
            mapped[0].acuan = true;
          }
        }

        setKemasanList(mapped);
      } else {
        // Mode create: set default kemasan awal
        setNama('');
        setSku('');
        setSatuanDasar('gram');
        setCatatan('');
        setKemasanList([
          {
            id: `k-${Date.now()}`,
            nama: 'Pack 1 kg',
            isi: 1000,
            hargaPerKemasan: '',
            acuan: true,
          },
        ]);
      }
    }
  }, [isOpen, bahanToEdit]);

  // Kalkulasi live biaya acuan per satuan dasar
  const liveHargaPerSatuan = useMemo(() => {
    const acuanItem = kemasanList.find((k) => k.acuan) || kemasanList[0];
    if (!acuanItem) return 0;
    const isiNum = typeof acuanItem.isi === 'number' ? acuanItem.isi : parseFloat(String(acuanItem.isi));
    const hargaNum =
      typeof acuanItem.hargaPerKemasan === 'number'
        ? acuanItem.hargaPerKemasan
        : parseFloat(String(acuanItem.hargaPerKemasan));

    if (isNaN(isiNum) || isiNum <= 0 || isNaN(hargaNum) || hargaNum < 0) {
      return 0;
    }
    return Number((hargaNum / isiNum).toFixed(4));
  }, [kemasanList]);

  // Tambah baris kemasan baru
  const handleAddKemasan = () => {
    const newId = `k-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const defaultIsi = satuanDasar === 'pcs' ? 1 : 100;
    setKemasanList((prev) => [
      ...prev,
      {
        id: newId,
        nama: '',
        isi: defaultIsi,
        hargaPerKemasan: '',
        acuan: prev.length === 0, // Jika belum ada, otomatis jadi acuan
      },
    ]);
  };

  // Hapus baris kemasan
  const handleRemoveKemasan = (index: number) => {
    if (kemasanList.length <= 1) {
      setErrorMsg('Minimal harus ada satu kemasan pembelian untuk bahan baku.');
      return;
    }
    const itemToRemove = kemasanList[index];
    const updated = kemasanList.filter((_, idx) => idx !== index);

    // Jika yang dihapus adalah acuan, pindahkan acuan ke baris pertama
    if (itemToRemove.acuan && updated.length > 0) {
      updated[0].acuan = true;
    }

    setKemasanList(updated);
  };

  // Ubah radio acuan
  const handleSetAcuan = (index: number) => {
    setKemasanList((prev) =>
      prev.map((k, idx) => ({
        ...k,
        acuan: idx === index,
      }))
    );
  };

  // Update nilai kemasan
  const handleUpdateKemasanField = (
    index: number,
    field: 'nama' | 'isi' | 'hargaPerKemasan',
    value: string
  ) => {
    setKemasanList((prev) =>
      prev.map((k, idx) => {
        if (idx !== index) return k;
        return {
          ...k,
          [field]: value,
        };
      })
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedNama = nama.trim();
    if (!trimmedNama || trimmedNama.length < 2) {
      setErrorMsg('Nama bahan wajib diisi minimal 2 karakter.');
      return;
    }

    if (kemasanList.length === 0) {
      setErrorMsg('Wajib menambahkan minimal satu kemasan pembelian.');
      return;
    }

    // Validasi setiap kemasan
    const preparedKemasan: KemasanBahan[] = [];
    for (let i = 0; i < kemasanList.length; i++) {
      const k = kemasanList[i];
      const kNama = k.nama.trim();
      if (!kNama) {
        setErrorMsg(`Nama kemasan pada baris ke-${i + 1} tidak boleh kosong.`);
        return;
      }

      const isiNum = typeof k.isi === 'number' ? k.isi : parseFloat(String(k.isi));
      if (isNaN(isiNum) || isiNum <= 0) {
        setErrorMsg(
          `Isi/netto pada kemasan "${kNama}" harus berupa angka lebih besar dari 0 (${satuanDasar}).`
        );
        return;
      }

      const hargaNum =
        k.hargaPerKemasan === '' || k.hargaPerKemasan === undefined
          ? 0
          : typeof k.hargaPerKemasan === 'number'
          ? k.hargaPerKemasan
          : parseFloat(String(k.hargaPerKemasan));

      if (isNaN(hargaNum) || hargaNum < 0) {
        setErrorMsg(`Harga pembelian pada kemasan "${kNama}" tidak boleh bernilai minus.`);
        return;
      }

      preparedKemasan.push({
        id: k.id,
        nama: kNama,
        isi: isiNum,
        netto: isiNum,
        hargaPerKemasan: hargaNum,
        acuan: k.acuan,
      });
    }

    // Validasi tepat satu acuan
    const acuanCount = preparedKemasan.filter((k) => k.acuan).length;
    if (acuanCount !== 1) {
      // Fallback set kemasan pertama
      preparedKemasan[0].acuan = true;
    }

    try {
      setIsSubmitting(true);
      const finalSku = sku.trim() || undefined;

      if (bahanToEdit) {
        await bahanCloudService.updateBahan(
          outletId,
          bahanToEdit.id,
          {
            nama: trimmedNama,
            sku: finalSku,
            satuanDasar,
            kemasanList: preparedKemasan,
            catatan: catatan.trim() || undefined,
          },
          userId
        );

        const updatedBahan: Bahan = {
          ...bahanToEdit,
          nama: trimmedNama,
          sku: finalSku,
          satuanDasar,
          kemasanList: preparedKemasan,
          hargaPerSatuanDasar: hitungHargaPerSatuanDasar(preparedKemasan),
          catatan: catatan.trim() || undefined,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        };

        onSuccess(updatedBahan);
      } else {
        const created = await bahanCloudService.createBahan(
          outletId,
          {
            nama: trimmedNama,
            sku: finalSku,
            satuanDasar,
            kemasanList: preparedKemasan,
            catatan: catatan.trim() || undefined,
          },
          userId
        );

        onSuccess(created);
      }
    } catch (err: unknown) {
      console.error('[BahanFormModal] Gagal menyimpan bahan:', err);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan bahan.';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-black text-stone-900">
              {bahanToEdit ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Kelola satuan dasar, kemasan beli, dan acuan HPP resep outlet
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Nama Bahan */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              Nama Bahan Baku <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Biji Kopi Robusta, Kecap Manis, Fresh Milk"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition disabled:bg-stone-50"
            />
          </div>

          {/* SKU Bahan (Override Manual Opsional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-stone-700">
                SKU Bahan <span className="text-[11px] font-normal text-stone-400">(Opsional)</span>
              </label>
              <span className="text-[10px] text-stone-400">
                Kosongkan untuk generate otomatis
              </span>
            </div>
            <input
              type="text"
              disabled={isSubmitting}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Auto: BHN-YYYYMMDD-XXX"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition disabled:bg-stone-50"
            />
            <p className="text-[11px] text-stone-400 mt-1">
              Biarkan kosong jika ingin sistem membuat SKU unik otomatis saat disimpan (format: BHN-YYYYMMDD-XXX).
            </p>
          </div>

          {/* Satuan Dasar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-stone-700">
                Satuan Dasar <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-stone-400">
                Satuan terkecil untuk takaran resep
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['gram', 'ml', 'pcs'] as SatuanDasar[]).map((satuan) => (
                <button
                  key={satuan}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSatuanDasar(satuan)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                    satuanDasar === satuan
                      ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                      : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {satuanDasar === satuan && <Check className="w-3.5 h-3.5 text-orange-600" />}
                  <span className="capitalize">{satuan}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Section Kemasan Pembelian */}
          <div className="pt-2 border-t border-stone-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                  <span>Kemasan Pembelian & Biaya Acuan</span>
                  <span className="text-[10px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded font-normal">
                    {kemasanList.length} kemasan
                  </span>
                </h3>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Pilih tepat 1 kemasan sebagai <strong>Acuan HPP</strong> untuk takaran resep
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddKemasan}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Kemasan</span>
              </button>
            </div>

            {/* List Kemasan Dinamis */}
            <div className="space-y-2.5">
              {kemasanList.map((kemasan, idx) => {
                const isiNum =
                  typeof kemasan.isi === 'number'
                    ? kemasan.isi
                    : parseFloat(String(kemasan.isi)) || 0;
                const hargaNum =
                  typeof kemasan.hargaPerKemasan === 'number'
                    ? kemasan.hargaPerKemasan
                    : parseFloat(String(kemasan.hargaPerKemasan)) || 0;
                const unitCost = isiNum > 0 && hargaNum > 0 ? hargaNum / isiNum : 0;

                return (
                  <div
                    key={kemasan.id || idx}
                    className={`p-3 rounded-xl border transition relative ${
                      kemasan.acuan
                        ? 'border-amber-300 bg-amber-50/40 shadow-2xs'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {/* Radio Acuan */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="radio"
                          name="kemasan-acuan"
                          checked={kemasan.acuan}
                          onChange={() => handleSetAcuan(idx)}
                          disabled={isSubmitting}
                          className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-stone-300 accent-orange-600"
                        />
                        <span
                          className={`text-xs font-bold flex items-center gap-1 ${
                            kemasan.acuan ? 'text-amber-900' : 'text-stone-700'
                          }`}
                        >
                          {kemasan.acuan && <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
                          <span>{kemasan.acuan ? 'Acuan HPP Resep' : 'Kemasan Alternatif'}</span>
                        </span>
                      </label>

                      {/* Tombol Hapus */}
                      {kemasanList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveKemasan(idx)}
                          disabled={isSubmitting}
                          className="p-1 rounded-md text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Hapus kemasan ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Nama Kemasan */}
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1">
                          Nama Kemasan
                        </label>
                        <input
                          type="text"
                          required
                          disabled={isSubmitting}
                          value={kemasan.nama}
                          onChange={(e) => handleUpdateKemasanField(idx, 'nama', e.target.value)}
                          placeholder="Misal: Botol 500ml, 1 kg"
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                        />
                      </div>

                      {/* Isi per kemasan (satuan dasar) */}
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1">
                          Netto / Isi ({satuanDasar})
                        </label>
                        <input
                          type="number"
                          required
                          min="0.01"
                          step="any"
                          disabled={isSubmitting}
                          value={kemasan.isi}
                          onChange={(e) => handleUpdateKemasanField(idx, 'isi', e.target.value)}
                          placeholder="Misal: 1000"
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                        />
                      </div>

                      {/* Harga Beli Kemasan */}
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-500 mb-1">
                          Harga Beli (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          disabled={isSubmitting}
                          value={kemasan.hargaPerKemasan}
                          onChange={(e) =>
                            handleUpdateKemasanField(idx, 'hargaPerKemasan', e.target.value)
                          }
                          placeholder="Misal: 45000"
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-stone-200 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                        />
                      </div>
                    </div>

                    {/* Estimasi Biaya Satuan Baris */}
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500 px-1">
                      <span>Biaya per {satuanDasar}:</span>
                      <span className="font-semibold text-stone-800">
                        {unitCost > 0 ? formatBiayaSatuan(unitCost, satuanDasar) : 'Rp0 / ' + satuanDasar}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Card: Biaya Acuan Dasar Aktif */}
            <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-orange-950">
                    Biaya Satuan Acuan HPP Resep
                  </div>
                  <div className="text-[10px] text-orange-800/80">
                    Dihitung otomatis dari kemasan acuan terpilih
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm sm:text-base font-black text-orange-700">
                  {formatBiayaSatuan(liveHargaPerSatuan, satuanDasar)}
                </div>
              </div>
            </div>
          </div>

          {/* Catatan */}
          <div className="pt-2 border-t border-stone-100">
            <label className="block text-xs font-bold text-stone-700 mb-1">
              Catatan Bahan (Opsional)
            </label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan merek, supplier, atau karakteristik bahan..."
              className="w-full px-3 py-2 rounded-xl text-xs border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition resize-none disabled:bg-stone-50"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-stone-100 bg-stone-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{bahanToEdit ? 'Simpan Perubahan' : 'Simpan Bahan'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
