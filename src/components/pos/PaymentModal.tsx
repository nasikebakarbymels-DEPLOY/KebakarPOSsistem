import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  UserCheck,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  DrafKeranjang,
  Pelanggan,
  MetodePembayaran,
  RincianPembayaran,
  Transaksi,
} from '../../types';
import { keranjangService } from '../../services/keranjangService';
import { pelangganService } from '../../services/pelangganService';
import { transaksiService } from '../../services/transaksiService';
import { formatRupiah } from '../../utils/formatters';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  draf: DrafKeranjang;
  outletId: string;
  kasirId: string;
  kasirNama: string;
  isOnline: boolean;
  onPaymentSuccess: (transaksi: Transaksi) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  draf,
  outletId,
  kasirId,
  kasirNama,
  isOnline,
  onPaymentSuccess,
}) => {
  const ringkasan = keranjangService.kalkulasiRingkasan(draf);
  const totalAkhir = ringkasan.totalAkhir;

  const [metode, setMetode] = useState<MetodePembayaran>('tunai');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // State Tunai
  const [uangDiterima, setUangDiterima] = useState<string>('');

  // State QRIS / Transfer
  const [referensi, setReferensi] = useState<string>('');

  // State Piutang
  const [pelangganList, setPelangganList] = useState<Pelanggan[]>([]);
  const [selectedPelangganId, setSelectedPelangganId] = useState<string>('');
  const [isNewPelanggan, setIsNewPelanggan] = useState<boolean>(false);
  const [newPelangganNama, setNewPelangganNama] = useState<string>('');
  const [newPelangganHp, setNewPelangganHp] = useState<string>('');
  const [jumlahDibayarPiutang, setJumlahDibayarPiutang] = useState<string>('0');

  // State Hasil Sukses Transaksi
  const [transaksiSukses, setTransaksiSukses] = useState<Transaksi | null>(null);

  // Load daftar pelanggan
  useEffect(() => {
    if (isOpen && outletId) {
      pelangganService.getPelangganByOutlet(outletId).then((list) => {
        setPelangganList(list);
        if (list.length > 0 && !selectedPelangganId) {
          setSelectedPelangganId(list[0].id);
        }
      });
      // Set default uang tunai pas
      setUangDiterima(String(totalAkhir));
      setJumlahDibayarPiutang('0');
      setErrorMessage(null);
      setTransaksiSukses(null);
    }
  }, [isOpen, outletId, totalAkhir]);

  if (!isOpen) return null;

  // Nilai Uang Diterima & Kembalian (Tunai)
  const uangDiterimaNum = Number(uangDiterima) || 0;
  const kembalianTunai = Math.max(0, uangDiterimaNum - totalAkhir);
  const isUangKurang = uangDiterimaNum < totalAkhir;

  // Nilai Piutang & Sisa Hutang
  const dibayarPiutangNum = Number(jumlahDibayarPiutang) || 0;
  const sisaHutang = Math.max(0, totalAkhir - dibayarPiutangNum);

  // Tombol Nominal Cepat untuk Tunai
  const quickCashOptions = [
    { label: 'Uang Pas', value: totalAkhir },
    { label: '50.000', value: 50000 },
    { label: '100.000', value: 100000 },
  ];

  const handleSubmitPembayaran = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    let pembayaranPayload: RincianPembayaran;

    if (metode === 'tunai') {
      if (isUangKurang) {
        setErrorMessage(
          `Uang yang diterima kurang dari total belanja (${formatRupiah(totalAkhir)}). Kurang ${formatRupiah(
            totalAkhir - uangDiterimaNum
          )}.`
        );
        return;
      }
      pembayaranPayload = {
        metode: 'tunai',
        uangDiterima: uangDiterimaNum,
        kembalian: kembalianTunai,
        jumlahDibayar: totalAkhir,
        sisaHutang: 0,
      };
    } else if (metode === 'qris_transfer') {
      pembayaranPayload = {
        metode: 'qris_transfer',
        referensi: referensi.trim() || undefined,
        jumlahDibayar: totalAkhir,
        sisaHutang: 0,
      };
    } else {
      // Metode Piutang
      let targetPelangganId = selectedPelangganId;
      let targetPelangganNama = '';

      if (isNewPelanggan) {
        const trimmedNama = newPelangganNama.trim();
        if (!trimmedNama) {
          setErrorMessage('Nama pelanggan baru wajib diisi untuk pembayaran piutang.');
          return;
        }
        try {
          const created = await pelangganService.createPelanggan(outletId, {
            nama: trimmedNama,
            nomorHp: newPelangganHp.trim() || undefined,
          });
          targetPelangganId = created.id;
          targetPelangganNama = created.nama;
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : 'Gagal membuat data pelanggan.');
          return;
        }
      } else {
        const found = pelangganList.find((p) => p.id === selectedPelangganId);
        if (!found) {
          setErrorMessage('Pilih pelanggan yang terdaftar atau buat pelanggan baru.');
          return;
        }
        targetPelangganNama = found.nama;
      }

      if (dibayarPiutangNum < 0) {
        setErrorMessage('Jumlah dibayar sekarang tidak boleh bernilai negatif.');
        return;
      }
      if (dibayarPiutangNum > totalAkhir) {
        setErrorMessage('Jumlah dibayar sekarang tidak boleh melebihi total belanja.');
        return;
      }

      pembayaranPayload = {
        metode: 'piutang',
        pelangganId: targetPelangganId,
        pelangganNama: targetPelangganNama,
        jumlahDibayar: dibayarPiutangNum,
        sisaHutang,
      };
    }

    try {
      setSubmitting(true);
      const trx = await transaksiService.createTransaksi(outletId, {
        draf,
        kasirId,
        kasirNama,
        pembayaran: pembayaranPayload,
        isOnline,
      });

      // Tampilkan layar sukses
      setTransaksiSukses(trx);
      onPaymentSuccess(trx);
    } catch (err: unknown) {
      console.error('Transaksi gagal:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses pembayaran.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-stone-900/60 backdrop-blur-xs">
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] animate-in slide-in-from-bottom duration-200">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">
                {draf.tipePesanan === 'dine_in'
                  ? `Dine-in ${draf.nomorMeja ? `• Meja ${draf.nomorMeja}` : ''}`
                  : 'Takeaway'}
              </span>
              <span
                className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-800'
                }`}
              >
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {isOnline ? 'Online' : 'Offline (Antrean)'}
              </span>
            </div>
            <h3 className="font-extrabold text-stone-900 text-lg sm:text-xl mt-1">
              Pembayaran Pesanan
            </h3>
          </div>
          {!transaksiSukses && (
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-stone-200/70 text-stone-600 hover:text-stone-900 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* TAMPILAN SUKSES SETELAH TRANSAKSI SELESAI */}
        {transaksiSukses ? (
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Transaksi Berhasil
              </p>
              <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-0.5">
                {transaksiSukses.nomorTransaksi}
              </h2>
              <p className="text-xs text-stone-500 mt-1">
                {new Date(String(transaksiSukses.tanggal || transaksiSukses.createdAt)).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                • Kasir: {transaksiSukses.kasirNama}
              </p>
            </div>

            {/* Rincian Finansial Transaksi Sukses */}
            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 text-left space-y-2">
              <div className="flex justify-between items-baseline text-xs text-stone-600">
                <span>Total Tagihan:</span>
                <span className="font-extrabold text-base text-stone-900">
                  {formatRupiah(transaksiSukses.totalAkhir || transaksiSukses.total)}
                </span>
              </div>
              <div className="flex justify-between text-xs text-stone-600">
                <span>Metode Pembayaran:</span>
                <span className="font-bold uppercase text-stone-900">
                  {transaksiSukses.pembayaran?.metode === 'tunai'
                    ? 'Tunai'
                    : transaksiSukses.pembayaran?.metode === 'qris_transfer'
                    ? 'QRIS / Transfer'
                    : 'Piutang Pelanggan'}
                </span>
              </div>

              {transaksiSukses.pembayaran?.metode === 'tunai' && (
                <>
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>Uang Diterima:</span>
                    <span className="font-semibold text-stone-800">
                      {formatRupiah(transaksiSukses.pembayaran.uangDiterima || 0)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-stone-900">Kembalian:</span>
                    <span className="text-lg font-black text-emerald-600">
                      {formatRupiah(transaksiSukses.pembayaran.kembalian || 0)}
                    </span>
                  </div>
                </>
              )}

              {transaksiSukses.pembayaran?.metode === 'piutang' && (
                <>
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>Pelanggan:</span>
                    <span className="font-bold text-stone-900">
                      {transaksiSukses.pembayaran.pelangganNama}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>Dibayar Sekarang:</span>
                    <span className="font-semibold text-emerald-600">
                      {formatRupiah(transaksiSukses.pembayaran.jumlahDibayar)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-stone-200 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-stone-900">Sisa Hutang:</span>
                    <span className="text-lg font-black text-rose-600">
                      {formatRupiah(transaksiSukses.pembayaran.sisaHutang)}
                    </span>
                  </div>
                </>
              )}

              {transaksiSukses.pembayaran?.metode === 'qris_transfer' &&
                transaksiSukses.pembayaran?.referensi && (
                  <div className="flex justify-between text-xs text-stone-600">
                    <span>Referensi:</span>
                    <span className="font-mono text-stone-800">
                      {transaksiSukses.pembayaran.referensi}
                    </span>
                  </div>
                )}
            </div>

            {/* Indikator Status Sinkronisasi */}
            <div
              className={`p-3 rounded-xl text-xs flex items-center justify-center gap-2 border ${
                transaksiSukses.syncStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {transaksiSukses.syncStatus === 'synced' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Transaksi telah disinkronkan secara online.</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Transaksi tersimpan lokal (offline) & masuk antrean sinkronisasi.
                  </span>
                </>
              )}
            </div>

            <button
              type="button"
              id="pos-transaksi-selesai-button"
              onClick={onClose}
              className="w-full py-3.5 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-sm font-bold shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <span>Transaksi Baru</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* FORM PEMBAYARAN */
          <form onSubmit={handleSubmitPembayaran} className="p-4 sm:p-5 overflow-y-auto space-y-4">
            {/* Total Tagihan Banner */}
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-orange-800">Total Tagihan</span>
                <p className="text-2xl sm:text-3xl font-black text-orange-950 leading-tight">
                  {formatRupiah(totalAkhir)}
                </p>
              </div>
              <div className="text-right text-xs text-stone-500 font-medium">
                <p>{ringkasan.totalItemCount} item pesanan</p>
                {ringkasan.diskonTransaksiNominal > 0 && (
                  <p className="text-emerald-700 font-semibold">
                    Hemat {formatRupiah(ringkasan.diskonTransaksiNominal)}
                  </p>
                )}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* TAB METODE PEMBAYARAN */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-2">
                Pilih Metode Pembayaran
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMetode('tunai')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                    metode === 'tunai'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                  <span>Tunai</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetode('qris_transfer')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                    metode === 'qris_transfer'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                  <span>QRIS / TF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetode('piutang')}
                  className={`p-3 rounded-2xl border text-xs font-bold transition-all flex flex-col items-center gap-1.5 ${
                    metode === 'piutang'
                      ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  <span>Piutang</span>
                </button>
              </div>
            </div>

            {/* KONTEN TAB: TUNAI */}
            {metode === 'tunai' && (
              <div className="space-y-3 bg-stone-50 p-3.5 sm:p-4 rounded-2xl border border-stone-200">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Uang Diterima (Rp) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-stone-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={uangDiterima}
                      onChange={(e) => setUangDiterima(e.target.value)}
                      placeholder="0"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-base font-extrabold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Tombol Nominal Cepat */}
                <div className="flex gap-2">
                  {quickCashOptions.map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setUangDiterima(String(opt.value))}
                      className="flex-1 py-1.5 px-2 bg-white hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 transition-colors"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Tampilan Kembalian Real-time */}
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between ${
                    isUangKurang
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <span className="text-xs font-bold">
                    {isUangKurang ? 'Uang Kurang:' : 'Kembalian:'}
                  </span>
                  <span className="text-base sm:text-lg font-black">
                    {isUangKurang
                      ? formatRupiah(totalAkhir - uangDiterimaNum)
                      : formatRupiah(kembalianTunai)}
                  </span>
                </div>
              </div>
            )}

            {/* KONTEN TAB: QRIS / TRANSFER */}
            {metode === 'qris_transfer' && (
              <div className="space-y-3 bg-stone-50 p-3.5 sm:p-4 rounded-2xl border border-stone-200">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <p className="font-semibold">Pencatatan Pembayaran Non-Tunai Manual</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Pastikan pelanggan telah melakukan scan QRIS outlet atau transfer bank sebelum mengonfirmasi.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Nomor Referensi / Catatan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={referensi}
                    onChange={(e) => setReferensi(e.target.value)}
                    placeholder="Contoh: BCA Ref 92831 / DANA QRIS"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
              </div>
            )}

            {/* KONTEN TAB: PIUTANG */}
            {metode === 'piutang' && (
              <div className="space-y-3 bg-stone-50 p-3.5 sm:p-4 rounded-2xl border border-stone-200">
                {/* Pemilih Pelanggan Existing vs Baru */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700">Data Pelanggan</label>
                  <button
                    type="button"
                    onClick={() => setIsNewPelanggan(!isNewPelanggan)}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    {isNewPelanggan ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Pilih Pelanggan Terdaftar</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Pelanggan Baru</span>
                      </>
                    )}
                  </button>
                </div>

                {isNewPelanggan ? (
                  /* Form Pelanggan Baru Inline */
                  <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Nama Lengkap <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={newPelangganNama}
                        onChange={(e) => setNewPelangganNama(e.target.value)}
                        placeholder="Nama pelanggan..."
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                        Nomor HP / WhatsApp (Opsional)
                      </label>
                      <input
                        type="tel"
                        value={newPelangganHp}
                        onChange={(e) => setNewPelangganHp(e.target.value)}
                        placeholder="Contoh: 08123456789"
                        className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      />
                    </div>
                  </div>
                ) : (
                  /* Dropdown Pelanggan Existing */
                  <div>
                    {pelangganList.length === 0 ? (
                      <div className="p-3 bg-white rounded-xl border border-dashed border-stone-300 text-center">
                        <p className="text-xs text-stone-500">Belum ada pelanggan terdaftar.</p>
                        <button
                          type="button"
                          onClick={() => setIsNewPelanggan(true)}
                          className="mt-1 text-xs font-bold text-orange-600 hover:underline"
                        >
                          Daftarkan Pelanggan Baru
                        </button>
                      </div>
                    ) : (
                      <select
                        value={selectedPelangganId}
                        onChange={(e) => setSelectedPelangganId(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                      >
                        {pelangganList.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nama} {p.nomorHp ? `(${p.nomorHp})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Input Dibayar Sekarang */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">
                      Dibayar Sekarang (DP / Sebagian)
                    </label>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setJumlahDibayarPiutang('0')}
                        className="text-[10px] font-bold text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200 hover:bg-stone-50"
                      >
                        Rp 0 (Hutang Penuh)
                      </button>
                      <button
                        type="button"
                        onClick={() => setJumlahDibayarPiutang(String(Math.round(totalAkhir / 2)))}
                        className="text-[10px] font-bold text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200 hover:bg-stone-50"
                      >
                        DP 50%
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-stone-400">
                      Rp
                    </span>
                    <input
                      type="number"
                      min="0"
                      max={totalAkhir}
                      step="any"
                      value={jumlahDibayarPiutang}
                      onChange={(e) => setJumlahDibayarPiutang(e.target.value)}
                      placeholder="0"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Sisa Hutang Banner */}
                <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-semibold text-stone-500">Sisa Hutang:</span>
                    <p className="text-base font-extrabold text-rose-600 leading-tight">
                      {formatRupiah(sisaHutang)}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-1 rounded-md bg-stone-100 text-stone-700">
                    {dibayarPiutangNum === 0
                      ? 'Hutang Penuh'
                      : dibayarPiutangNum >= totalAkhir
                      ? 'Lunas'
                      : 'Bayar Sebagian'}
                  </span>
                </div>
              </div>
            )}

            {/* Tombol Aksi Batal / Konfirmasi */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                id="pos-konfirmasi-pembayaran-button"
                disabled={submitting || (metode === 'tunai' && isUangKurang)}
                className="flex-2 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <span>Konfirmasi Pembayaran</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
