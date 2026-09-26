import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, AlertCircle, Info, Calculator, Loader2 } from 'lucide-react';
import { Bahan, KemasanBahan } from '../../types';
import { formatRupiah, formatBiayaSatuan } from '../../utils/formatters';
import { CreatePembelianDTO } from '../../services/pembelianService';

interface PembelianModalProps {
  isOpen: boolean;
  availableBahan: Bahan[];
  onClose: () => void;
  onSubmit: (data: CreatePembelianDTO) => Promise<void>;
  onNavigateToBahanTab?: () => void;
}

export const PembelianModal: React.FC<PembelianModalProps> = ({
  isOpen,
  availableBahan,
  onClose,
  onSubmit,
  onNavigateToBahanTab,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [tanggal, setTanggal] = useState<string>(todayStr);
  const [selectedBahanId, setSelectedBahanId] = useState<string>('');
  const [selectedKemasanId, setSelectedKemasanId] = useState<string>('');
  const [qty, setQty] = useState<number | ''>(1);
  const [hargaPerKemasan, setHargaPerKemasan] = useState<number | ''>('');
  const [totalHargaManual, setTotalHargaManual] = useState<number | ''>('');
  const [isManualTotal, setIsManualTotal] = useState<boolean>(false);
  const [supplierCatatan, setSupplierCatatan] = useState<string>('');
  
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setTanggal(new Date().toISOString().split('T')[0]);
      setErrorMsg('');
      setIsSubmitting(false);
      setIsManualTotal(false);
      setSupplierCatatan('');

      if (availableBahan.length > 0) {
        const first = availableBahan[0];
        setSelectedBahanId(first.id);
        if (first.kemasanList && first.kemasanList.length > 0) {
          setSelectedKemasanId(first.kemasanList[0].id);
        } else {
          setSelectedKemasanId('');
        }
      } else {
        setSelectedBahanId('');
        setSelectedKemasanId('');
      }

      setQty(1);
      setHargaPerKemasan('');
      setTotalHargaManual('');
    }
  }, [isOpen, availableBahan]);

  // Selected bahan & kemasan lookup
  const selectedBahan = availableBahan.find((b) => b.id === selectedBahanId);
  const availableKemasan = selectedBahan?.kemasanList || [];
  const selectedKemasan = availableKemasan.find((k) => k.id === selectedKemasanId);

  // When selected bahan changes, update selected kemasan
  const handleBahanChange = (newBahanId: string) => {
    setSelectedBahanId(newBahanId);
    const targetBahan = availableBahan.find((b) => b.id === newBahanId);
    if (targetBahan && targetBahan.kemasanList && targetBahan.kemasanList.length > 0) {
      setSelectedKemasanId(targetBahan.kemasanList[0].id);
    } else {
      setSelectedKemasanId('');
    }
  };

  // Calculations
  const numericQty = typeof qty === 'number' ? qty : 0;
  const numericHargaKemasan = typeof hargaPerKemasan === 'number' ? hargaPerKemasan : 0;
  const nettoKemasan = selectedKemasan?.netto || 0;

  const calculatedTotalHarga = isManualTotal && typeof totalHargaManual === 'number'
    ? totalHargaManual
    : Math.round(numericQty * numericHargaKemasan);

  const totalNetto = Number((numericQty * nettoKemasan).toFixed(4));
  const biayaPerSatuan = totalNetto > 0 ? calculatedTotalHarga / totalNetto : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!tanggal) {
      setErrorMsg('Tanggal pembelian wajib diisi.');
      return;
    }

    if (!selectedBahanId) {
      setErrorMsg('Silakan pilih bahan baku.');
      return;
    }

    if (!selectedKemasanId || !selectedKemasan) {
      setErrorMsg('Silakan pilih kemasan pembelian.');
      return;
    }

    if (numericQty <= 0) {
      setErrorMsg('Jumlah (Qty) pembelian harus lebih dari 0.');
      return;
    }

    if (numericHargaKemasan <= 0 && calculatedTotalHarga <= 0) {
      setErrorMsg('Harga per kemasan harus lebih dari 0.');
      return;
    }

    if (nettoKemasan <= 0) {
      setErrorMsg('Netto kemasan tidak valid atau 0.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        bahanId: selectedBahanId,
        kemasanId: selectedKemasanId,
        qty: numericQty,
        hargaPerKemasan: numericHargaKemasan || Math.round(calculatedTotalHarga / numericQty),
        totalHarga: calculatedTotalHarga,
        supplierCatatan: supplierCatatan.trim(),
        tanggal,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan transaksi pembelian.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-orange-100 text-orange-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900">Catat Pembelian Bahan</h2>
              <p className="text-xs text-stone-500">
                Pencatatan biaya bahan baku untuk pembaruan HPP terbaru
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

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {availableBahan.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
              <p className="font-semibold text-amber-900">Belum ada bahan baku terdaftar.</p>
              <p className="text-amber-700">
                Daftarkan bahan baku terlebih dahulu di tab "Bahan & Kemasan" agar dapat mencatat pembelian.
              </p>
              {onNavigateToBahanTab && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onNavigateToBahanTab();
                  }}
                  className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-xl shadow-xs"
                >
                  Buka Master Bahan
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Row: Tanggal */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Tanggal Pembelian <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>

              {/* Row: Bahan */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Pilih Bahan Baku <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedBahanId}
                  onChange={(e) => handleBahanChange(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                >
                  {availableBahan.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.nama} (Satuan: {b.satuanDasar})
                    </option>
                  ))}
                </select>
              </div>

              {/* Row: Kemasan */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-stone-700 font-bold">
                    Pilih Kemasan Pembelian <span className="text-rose-500">*</span>
                  </label>
                  {selectedBahan && (
                    <span className="text-[11px] text-stone-500">
                      Satuan: <b className="text-stone-700">{selectedBahan.satuanDasar}</b>
                    </span>
                  )}
                </div>

                {availableKemasan.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                    <span className="text-amber-800 text-xs">
                      Bahan ini belum memiliki kemasan terdaftar.
                    </span>
                    {onNavigateToBahanTab && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onNavigateToBahanTab();
                        }}
                        className="text-xs text-orange-600 font-bold underline hover:text-orange-700"
                      >
                        Tambah Kemasan
                      </button>
                    )}
                  </div>
                ) : (
                  <select
                    value={selectedKemasanId}
                    onChange={(e) => setSelectedKemasanId(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    {availableKemasan.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama} — {k.netto.toLocaleString('id-ID')} {selectedBahan?.satuanDasar}
                      </option>
                    ))}
                  </select>
                )}

                {selectedKemasan && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-stone-500 bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200/50">
                    <Info className="w-3.5 h-3.5 text-stone-400" />
                    <span>
                      Netto Kemasan:{' '}
                      <b className="text-stone-800">
                        {selectedKemasan.netto.toLocaleString('id-ID')} {selectedBahan?.satuanDasar}
                      </b>{' '}
                      per {selectedKemasan.nama}
                    </span>
                  </div>
                )}
              </div>

              {/* Grid: Qty & Harga per Kemasan */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Qty Kemasan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="any"
                    value={qty}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                      setQty(val);
                      if (isManualTotal) {
                        setIsManualTotal(false);
                        setTotalHargaManual('');
                      }
                    }}
                    placeholder="misal 2"
                    disabled={isSubmitting}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-stone-700 font-bold mb-1">
                    Harga / Kemasan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-stone-400 font-semibold text-xs">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={hargaPerKemasan}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setHargaPerKemasan(val);
                        setIsManualTotal(false);
                      }}
                      placeholder="misal 14000"
                      disabled={isSubmitting}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Total Harga (calculated / manual option) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-stone-700 font-bold">Total Harga Pembelian</label>
                  <button
                    type="button"
                    onClick={() => setIsManualTotal(!isManualTotal)}
                    className="text-[11px] text-stone-500 hover:text-orange-600 underline font-medium"
                  >
                    {isManualTotal ? 'Hitung Otomatis' : 'Sesuaikan Manual'}
                  </button>
                </div>

                {isManualTotal ? (
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-stone-400 font-semibold text-xs">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={totalHargaManual}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setTotalHargaManual(val);
                      }}
                      placeholder="misal 28000"
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-orange-300 bg-orange-50/30 text-stone-900 font-bold"
                    />
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5 rounded-xl bg-stone-100 border border-stone-200 text-stone-900 font-bold text-sm">
                    {formatRupiah(calculatedTotalHarga)}
                  </div>
                )}
              </div>

              {/* Supplier / Catatan */}
              <div>
                <label className="block text-stone-700 font-bold mb-1">
                  Supplier / Catatan <span className="text-stone-400 font-normal">(opsional)</span>
                </label>
                <input
                  type="text"
                  value={supplierCatatan}
                  onChange={(e) => setSupplierCatatan(e.target.value)}
                  placeholder="misal Toko Barokah, Pasar Tradisional"
                  disabled={isSubmitting}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Live Calculation Box */}
              <div className="p-4 bg-orange-50/80 border border-orange-200/80 rounded-2xl space-y-2">
                <div className="flex items-center gap-1.5 text-orange-900 font-bold text-xs">
                  <Calculator className="w-4 h-4 text-orange-600" />
                  <span>Kalkulasi Biaya Satuan HPP Real-time</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-white/80 p-2 rounded-xl border border-orange-100">
                    <span className="text-[11px] text-stone-500 block">Total Netto Didapat:</span>
                    <span className="font-bold text-stone-900">
                      {totalNetto.toLocaleString('id-ID')} {selectedBahan?.satuanDasar || ''}
                    </span>
                    <span className="text-[10px] text-stone-400 block">
                      ({numericQty} x {nettoKemasan.toLocaleString('id-ID')} {selectedBahan?.satuanDasar})
                    </span>
                  </div>

                  <div className="bg-white/80 p-2 rounded-xl border border-orange-100">
                    <span className="text-[11px] text-stone-500 block">Biaya Per Satuan Dasar:</span>
                    <span className="font-extrabold text-orange-600 text-sm">
                      {formatBiayaSatuan(biayaPerSatuan, selectedBahan?.satuanDasar)}
                    </span>
                    <span className="text-[10px] text-stone-400 block">
                      (Total Rp / Total Netto)
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-orange-800 leading-snug pt-1">
                  💡 Nilai <b>{formatBiayaSatuan(biayaPerSatuan, selectedBahan?.satuanDasar)}</b> akan
                  langsung menggantikan biaya acuan HPP terbaru pada master bahan{' '}
                  <b>{selectedBahan?.nama || ''}</b>.
                </p>
              </div>
            </>
          )}

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
              disabled={isSubmitting || availableBahan.length === 0 || availableKemasan.length === 0}
              className="flex-1 py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-bold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Pembelian</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
