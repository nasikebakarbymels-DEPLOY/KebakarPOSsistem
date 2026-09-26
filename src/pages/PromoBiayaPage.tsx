import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TicketPercent,
  Receipt,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Calendar,
  DollarSign,
  Percent,
  Tag,
  Clock,
  ShieldAlert,
  ArrowRight,
  Info,
  KeyRound,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Voucher, BiayaLain } from '../types';
import { voucherCloudService, CreateVoucherInput } from '../services/cloud/voucherCloudService';
import { biayaLainCloudService, CreateBiayaLainInput } from '../services/cloud/biayaLainCloudService';
import { pinOwnerCloudService } from '../services/cloud/pinOwnerCloudService';
import { LogApprovalPage } from './LogApprovalPage';
import { formatRupiah, formatDateTimeIndo } from '../utils/formatters';

type PromoSegment = 'voucher' | 'biaya_lain' | 'pin_owner' | 'log_approval';

export const PromoBiayaPage: React.FC = () => {
  const { currentOutlet, user } = useAuth();

  const isOwner = user?.role === 'owner';

  const [activeSegment, setActiveSegment] = useState<PromoSegment>('voucher');

  // State Voucher
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loadingVoucher, setLoadingVoucher] = useState(true);
  const [errorVoucher, setErrorVoucher] = useState<string | null>(null);

  // State Biaya Lain
  const [biayaList, setBiayaList] = useState<BiayaLain[]>([]);
  const [loadingBiaya, setLoadingBiaya] = useState(true);
  const [errorBiaya, setErrorBiaya] = useState<string | null>(null);

  // State PIN Owner (Fase 6)
  const [hasPin, setHasPin] = useState(false);
  const [pinSetAt, setPinSetAt] = useState<string | undefined>(undefined);
  const [loadingPinStatus, setLoadingPinStatus] = useState(false);
  const [pinLama, setPinLama] = useState('');
  const [pinBaru, setPinBaru] = useState('');
  const [pinKonfirmasi, setPinKonfirmasi] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);

  // Modal Voucher Form State
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [voucherKode, setVoucherKode] = useState('');
  const [voucherTipe, setVoucherTipe] = useState<'nominal' | 'persen'>('persen');
  const [voucherNilai, setVoucherNilai] = useState<string | number>('');
  const [voucherAktif, setVoucherAktif] = useState(true);
  const [voucherMinBelanja, setVoucherMinBelanja] = useState<string | number>('');
  const [voucherTanggalBerakhir, setVoucherTanggalBerakhir] = useState('');
  const [voucherFormError, setVoucherFormError] = useState('');
  const [isSubmittingVoucher, setIsSubmittingVoucher] = useState(false);

  // Modal Biaya Lain Form State
  const [isBiayaModalOpen, setIsBiayaModalOpen] = useState(false);
  const [editingBiaya, setEditingBiaya] = useState<BiayaLain | null>(null);
  const [biayaNama, setBiayaNama] = useState('');
  const [biayaTipe, setBiayaTipe] = useState<'nominal' | 'persen'>('persen');
  const [biayaNilai, setBiayaNilai] = useState<string | number>('');
  const [biayaAktif, setBiayaAktif] = useState(true);
  const [biayaFormError, setBiayaFormError] = useState('');
  const [isSubmittingBiaya, setIsSubmittingBiaya] = useState(false);

  // Confirm Delete Modal State
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'voucher' | 'biaya';
    id: string;
    label: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // Fetch Vouchers
  const loadVouchers = useCallback(async () => {
    if (!currentOutlet?.id) {
      setLoadingVoucher(false);
      return;
    }
    setLoadingVoucher(true);
    setErrorVoucher(null);
    try {
      const data = await voucherCloudService.getActiveVoucher(currentOutlet.id, true);
      setVouchers(data);
    } catch (err: unknown) {
      console.error('[PromoBiayaPage] Gagal memuat voucher:', err);
      setErrorVoucher(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat daftar voucher.'
      );
    } finally {
      setLoadingVoucher(false);
    }
  }, [currentOutlet?.id]);

  // Fetch Biaya Lain
  const loadBiayaLain = useCallback(async () => {
    if (!currentOutlet?.id) {
      setLoadingBiaya(false);
      return;
    }
    setLoadingBiaya(true);
    setErrorBiaya(null);
    try {
      const data = await biayaLainCloudService.getActiveBiayaLain(currentOutlet.id, true);
      setBiayaList(data);
    } catch (err: unknown) {
      console.error('[PromoBiayaPage] Gagal memuat biaya lain:', err);
      setErrorBiaya(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat daftar biaya lain.'
      );
    } finally {
      setLoadingBiaya(false);
    }
  }, [currentOutlet?.id]);

  // Fetch Status PIN Owner
  const loadPinStatus = useCallback(async () => {
    if (!currentOutlet?.id) return;
    setLoadingPinStatus(true);
    try {
      const res = await pinOwnerCloudService.checkPinStatus(currentOutlet.id);
      setHasPin(res.hasPin);
      setPinSetAt(res.pinSetAt);
    } catch (err) {
      console.warn('[PromoBiayaPage] Gagal cek status PIN:', err);
    } finally {
      setLoadingPinStatus(false);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    if (isOwner) {
      loadVouchers();
      loadBiayaLain();
      loadPinStatus();
    }
  }, [isOwner, loadVouchers, loadBiayaLain, loadPinStatus]);

  // Handler Simpan PIN Owner
  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || !user?.id || !isOwner) return;

    setPinError('');

    if (hasPin) {
      if (!pinLama.trim()) {
        setPinError('Masukkan PIN lama untuk verifikasi.');
        return;
      }
    }

    const cleanBaru = pinBaru.trim();
    if (!/^\d{4,6}$/.test(cleanBaru)) {
      setPinError('PIN baru harus berupa 4 hingga 6 digit angka.');
      return;
    }

    if (cleanBaru !== pinKonfirmasi.trim()) {
      setPinError('Konfirmasi PIN tidak cocok dengan PIN baru.');
      return;
    }

    setIsSubmittingPin(true);
    try {
      if (hasPin) {
        await pinOwnerCloudService.changePinOwner(currentOutlet.id, pinLama, cleanBaru, user.id);
        showToast('PIN Owner berhasil diperbarui.', 'success');
      } else {
        await pinOwnerCloudService.setPinOwner(currentOutlet.id, cleanBaru, user.id);
        showToast('PIN Owner berhasil disimpan.', 'success');
      }

      setPinLama('');
      setPinBaru('');
      setPinKonfirmasi('');
      loadPinStatus();
    } catch (err: unknown) {
      console.error('[PromoBiayaPage] Gagal simpan PIN:', err);
      setPinError(err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan PIN.');
    } finally {
      setIsSubmittingPin(false);
    }
  };

  // Auto-generate 6-char uppercase voucher code
  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setVoucherKode(code);
  };

  // Open Voucher Modal (Create / Edit)
  const handleOpenVoucherModal = (voucher?: Voucher) => {
    setVoucherFormError('');
    if (voucher) {
      setEditingVoucher(voucher);
      setVoucherKode(voucher.kode);
      setVoucherTipe(voucher.tipe);
      setVoucherNilai(voucher.nilai);
      setVoucherAktif(voucher.aktif);
      setVoucherMinBelanja(voucher.minBelanja || '');
      setVoucherTanggalBerakhir(voucher.tanggalBerakhir || '');
    } else {
      setEditingVoucher(null);
      generateRandomCode();
      setVoucherTipe('persen');
      setVoucherNilai('');
      setVoucherAktif(true);
      setVoucherMinBelanja('');
      setVoucherTanggalBerakhir('');
    }
    setIsVoucherModalOpen(true);
  };

  // Save Voucher
  const handleSaveVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || !user?.id) return;

    const trimmedKode = voucherKode.trim().toUpperCase();
    if (!trimmedKode || trimmedKode.length < 2) {
      setVoucherFormError('Kode voucher minimal 2 karakter.');
      return;
    }

    const numNilai = typeof voucherNilai === 'number' ? voucherNilai : parseFloat(String(voucherNilai));
    if (isNaN(numNilai) || numNilai <= 0) {
      setVoucherFormError('Nilai diskon voucher harus lebih dari 0.');
      return;
    }

    if (voucherTipe === 'persen' && numNilai > 100) {
      setVoucherFormError('Diskon persen maksimal 100%.');
      return;
    }

    const numMinBelanja = voucherMinBelanja ? parseFloat(String(voucherMinBelanja)) : undefined;
    if (numMinBelanja !== undefined && (isNaN(numMinBelanja) || numMinBelanja < 0)) {
      setVoucherFormError('Minimum belanja tidak boleh negatif.');
      return;
    }

    setIsSubmittingVoucher(true);
    setVoucherFormError('');

    try {
      if (editingVoucher) {
        await voucherCloudService.updateVoucher(
          currentOutlet.id,
          editingVoucher.id,
          {
            kode: trimmedKode,
            tipe: voucherTipe,
            nilai: numNilai,
            aktif: voucherAktif,
            minBelanja: numMinBelanja || null,
            tanggalBerakhir: voucherTanggalBerakhir || null,
          },
          user.id
        );
        showToast(`Voucher "${trimmedKode}" berhasil diperbarui.`, 'success');
      } else {
        await voucherCloudService.createVoucher(
          currentOutlet.id,
          {
            kode: trimmedKode,
            tipe: voucherTipe,
            nilai: numNilai,
            aktif: voucherAktif,
            minBelanja: numMinBelanja,
            tanggalBerakhir: voucherTanggalBerakhir || undefined,
          },
          user.id
        );
        showToast(`Voucher "${trimmedKode}" berhasil dibuat.`, 'success');
      }

      setIsVoucherModalOpen(false);
      loadVouchers();
    } catch (err: unknown) {
      console.error('[PromoBiayaPage] Gagal menyimpan voucher:', err);
      setVoucherFormError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan voucher.'
      );
    } finally {
      setIsSubmittingVoucher(false);
    }
  };

  // Toggle Aktif Voucher
  const handleToggleVoucher = async (v: Voucher) => {
    if (!currentOutlet?.id || !user?.id) return;
    try {
      await voucherCloudService.updateVoucher(
        currentOutlet.id,
        v.id,
        { aktif: !v.aktif },
        user.id
      );
      setVouchers((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, aktif: !item.aktif } : item))
      );
      showToast(
        `Voucher "${v.kode}" ${!v.aktif ? 'diaktifkan' : 'dinonaktifkan'}.`,
        'info'
      );
    } catch (err: unknown) {
      showToast('Gagal mengubah status voucher.', 'error');
    }
  };

  // Open Biaya Lain Modal (Create / Edit)
  const handleOpenBiayaModal = (biaya?: BiayaLain) => {
    setBiayaFormError('');
    if (biaya) {
      setEditingBiaya(biaya);
      setBiayaNama(biaya.nama);
      setBiayaTipe(biaya.tipe);
      setBiayaNilai(biaya.nilai ?? biaya.nilaiDefault ?? '');
      setBiayaAktif(biaya.aktif);
    } else {
      setEditingBiaya(null);
      setBiayaNama('');
      setBiayaTipe('persen');
      setBiayaNilai('');
      setBiayaAktif(true);
    }
    setIsBiayaModalOpen(true);
  };

  // Save Biaya Lain
  const handleSaveBiaya = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || !user?.id) return;

    const trimmedNama = biayaNama.trim();
    if (!trimmedNama || trimmedNama.length < 2) {
      setBiayaFormError('Nama biaya lain minimal 2 karakter.');
      return;
    }

    const numNilai = typeof biayaNilai === 'number' ? biayaNilai : parseFloat(String(biayaNilai));
    if (isNaN(numNilai) || numNilai <= 0) {
      setBiayaFormError('Nilai biaya lain harus lebih dari 0.');
      return;
    }

    if (biayaTipe === 'persen' && numNilai > 100) {
      setBiayaFormError('Biaya persen maksimal 100%.');
      return;
    }

    setIsSubmittingBiaya(true);
    setBiayaFormError('');

    try {
      if (editingBiaya) {
        await biayaLainCloudService.updateBiayaLain(
          currentOutlet.id,
          editingBiaya.id,
          {
            nama: trimmedNama,
            tipe: biayaTipe,
            nilai: numNilai,
            aktif: biayaAktif,
          },
          user.id
        );
        showToast(`Biaya "${trimmedNama}" berhasil diperbarui.`, 'success');
      } else {
        await biayaLainCloudService.createBiayaLain(
          currentOutlet.id,
          {
            nama: trimmedNama,
            tipe: biayaTipe,
            nilai: numNilai,
            aktif: biayaAktif,
          },
          user.id
        );
        showToast(`Biaya "${trimmedNama}" berhasil ditambahkan.`, 'success');
      }

      setIsBiayaModalOpen(false);
      loadBiayaLain();
    } catch (err: unknown) {
      console.error('[PromoBiayaPage] Gagal menyimpan biaya lain:', err);
      setBiayaFormError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan biaya lain.'
      );
    } finally {
      setIsSubmittingBiaya(false);
    }
  };

  // Toggle Aktif Biaya Lain
  const handleToggleBiaya = async (b: BiayaLain) => {
    if (!currentOutlet?.id || !user?.id) return;
    try {
      await biayaLainCloudService.updateBiayaLain(
        currentOutlet.id,
        b.id,
        { aktif: !b.aktif },
        user.id
      );
      setBiayaList((prev) =>
        prev.map((item) => (item.id === b.id ? { ...item, aktif: !item.aktif } : item))
      );
      showToast(
        `Biaya "${b.nama}" ${!b.aktif ? 'diaktifkan' : 'dinonaktifkan'}.`,
        'info'
      );
    } catch (err: unknown) {
      showToast('Gagal mengubah status biaya lain.', 'error');
    }
  };

  // Confirm and Execute Delete
  const handleConfirmDelete = async () => {
    if (!itemToDelete || !currentOutlet?.id || !user?.id) return;
    setIsDeleting(true);
    try {
      if (itemToDelete.type === 'voucher') {
        await voucherCloudService.softDeleteVoucher(currentOutlet.id, itemToDelete.id, user.id);
        setVouchers((prev) => prev.filter((v) => v.id !== itemToDelete.id));
        showToast(`Voucher "${itemToDelete.label}" telah dihapus.`, 'info');
      } else {
        await biayaLainCloudService.softDeleteBiayaLain(currentOutlet.id, itemToDelete.id, user.id);
        setBiayaList((prev) => prev.filter((b) => b.id !== itemToDelete.id));
        showToast(`Biaya "${itemToDelete.label}" telah dihapus.`, 'info');
      }
      setItemToDelete(null);
    } catch (err: unknown) {
      showToast('Gagal menghapus item.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Guard role: bila role bukan owner, tampilkan panel akses ditolak dan hentikan render isi halaman
  if (!isOwner) {
    return (
      <div className="p-6 sm:p-8 max-w-lg mx-auto text-center space-y-4 my-8">
        <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-base sm:text-lg font-black text-stone-900">Akses Ditolak</h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
            Akses Ditolak — pengaturan promo, biaya, dan PIN Owner adalah wewenang Owner Outlet.
          </p>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div
            className={`px-4 py-3 rounded-2xl shadow-lg border text-xs font-bold flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : toastMessage.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-stone-900 border-stone-800 text-white'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            ) : (
              <Info className="w-4 h-4 text-orange-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <TicketPercent className="w-6 h-6 text-orange-600" />
            <span>Promo & Biaya Lain</span>
          </h1>
          <p className="text-xs text-stone-500 mt-1">
            Konfigurasi kode voucher diskon transaksi dan biaya tambahan (delivery, service charge, dll) per outlet.
          </p>
        </div>

        {/* Tombol Aksi Tambah */}
        <div>
          {activeSegment === 'voucher' ? (
            <button
              type="button"
              onClick={() => handleOpenVoucherModal()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Voucher</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenBiayaModal()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Biaya Lain</span>
            </button>
          )}
        </div>
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-stone-200/70 max-w-xl flex-wrap">
        <button
          type="button"
          onClick={() => setActiveSegment('voucher')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeSegment === 'voucher'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <TicketPercent className="w-4 h-4 text-orange-600" />
          <span>Voucher ({vouchers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment('biaya_lain')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeSegment === 'biaya_lain'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <Receipt className="w-4 h-4 text-orange-600" />
          <span>Biaya Lain ({biayaList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment('pin_owner')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeSegment === 'pin_owner'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <KeyRound className="w-4 h-4 text-orange-600" />
          <span>PIN Owner</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSegment('log_approval')}
          className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            activeSegment === 'log_approval'
              ? 'bg-white text-stone-900 shadow-xs'
              : 'text-stone-600 hover:text-stone-900'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-orange-600" />
          <span>Log Persetujuan</span>
        </button>
      </div>

      {/* TAB 1: DAFTAR VOUCHER */}
      {activeSegment === 'voucher' && (
        <div className="space-y-4">
          {loadingVoucher ? (
            /* Skeleton Loading State */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3 animate-pulse">
                  <div className="h-5 bg-stone-200 rounded-lg w-1/3" />
                  <div className="h-8 bg-stone-200 rounded-lg w-2/3" />
                  <div className="h-4 bg-stone-100 rounded-lg w-1/2" />
                </div>
              ))}
            </div>
          ) : errorVoucher ? (
            /* Panel Error + Coba Lagi */
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="text-xs font-semibold text-rose-800">{errorVoucher}</p>
              <button
                type="button"
                onClick={loadVouchers}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Coba Lagi
              </button>
            </div>
          ) : vouchers.length === 0 ? (
            /* Empty State Voucher */
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-3 shadow-2xs">
              <TicketPercent className="w-12 h-12 text-stone-300 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-stone-800">Belum Ada Voucher Diskon</h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Buat kode voucher pertama untuk memberikan potongan nominal atau persentase belanja bagi pelanggan kasir.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenVoucherModal()}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Voucher Pertama</span>
              </button>
            </div>
          ) : (
            /* List Voucher Cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {vouchers.map((v) => {
                const isExpired = v.tanggalBerakhir ? v.tanggalBerakhir < todayStr : false;

                return (
                  <div
                    key={v.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-2xs hover:shadow-md ${
                      !v.aktif
                        ? 'bg-stone-50/70 border-stone-200 text-stone-400 opacity-75'
                        : isExpired
                        ? 'bg-amber-50/40 border-amber-200 text-stone-700'
                        : 'bg-white border-stone-200 text-stone-800'
                    }`}
                  >
                    <div>
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-black tracking-wider px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 uppercase">
                            {v.kode}
                          </span>
                          {isExpired && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700">
                              Kedaluwarsa
                            </span>
                          )}
                        </div>

                        {/* Toggle Aktif */}
                        <button
                          type="button"
                          onClick={() => handleToggleVoucher(v)}
                          className={`p-1 rounded-lg transition ${
                            v.aktif
                              ? 'text-emerald-600 hover:bg-emerald-50'
                              : 'text-stone-400 hover:bg-stone-100'
                          }`}
                          title={v.aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                        >
                          {v.aktif ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      {/* Nilai Diskon Utama */}
                      <div className="my-2">
                        <span className="text-xl font-black text-stone-900">
                          {v.tipe === 'persen' ? `${v.nilai}% OFF` : `Potongan ${formatRupiah(v.nilai)}`}
                        </span>
                      </div>

                      {/* Detail Ketentuan Voucher */}
                      <div className="space-y-1 text-xs text-stone-600 pt-2 border-t border-stone-100">
                        {v.minBelanja ? (
                          <div className="flex items-center gap-1.5 text-stone-500">
                            <Tag className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                            <span>Min. belanja {formatRupiah(v.minBelanja)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-stone-400">
                            <Tag className="w-3.5 h-3.5 shrink-0" />
                            <span>Tanpa minimum belanja</span>
                          </div>
                        )}

                        {v.tanggalBerakhir ? (
                          <div
                            className={`flex items-center gap-1.5 ${
                              isExpired ? 'text-rose-600 font-bold' : 'text-stone-500'
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>Berakhir: {v.tanggalBerakhir}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-stone-400">
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>Berlaku selamanya</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Tombol Aksi */}
                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenVoucherModal(v)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition"
                        title="Edit voucher"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setItemToDelete({
                            type: 'voucher',
                            id: v.id,
                            label: v.kode,
                          })
                        }
                        className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Hapus voucher"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAFTAR BIAYA LAIN */}
      {activeSegment === 'biaya_lain' && (
        <div className="space-y-4">
          {loadingBiaya ? (
            /* Skeleton Loading State */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-2xl bg-white border border-stone-200 space-y-3 animate-pulse">
                  <div className="h-5 bg-stone-200 rounded-lg w-1/3" />
                  <div className="h-8 bg-stone-200 rounded-lg w-2/3" />
                  <div className="h-4 bg-stone-100 rounded-lg w-1/2" />
                </div>
              ))}
            </div>
          ) : errorBiaya ? (
            /* Panel Error + Coba Lagi */
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="text-xs font-semibold text-rose-800">{errorBiaya}</p>
              <button
                type="button"
                onClick={loadBiayaLain}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs"
              >
                Coba Lagi
              </button>
            </div>
          ) : biayaList.length === 0 ? (
            /* Empty State Biaya Lain */
            <div className="p-10 rounded-2xl bg-white border border-stone-200 text-center space-y-3 shadow-2xs">
              <Receipt className="w-12 h-12 text-stone-300 mx-auto" />
              <div>
                <h3 className="text-sm font-bold text-stone-800">Belum Ada Biaya Tambahan</h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Tambahkan komponen biaya operasional seperti Delivery Ongkir, Service Charge (%), Pajak Resto, atau Biaya Kemasan Takeaway.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenBiayaModal()}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Biaya Pertama</span>
              </button>
            </div>
          ) : (
            /* List Biaya Cards */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {biayaList.map((b) => (
                <div
                  key={b.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-2xs hover:shadow-md ${
                    !b.aktif
                      ? 'bg-stone-50/70 border-stone-200 text-stone-400 opacity-75'
                      : 'bg-white border-stone-200 text-stone-800'
                  }`}
                >
                  <div>
                    {/* Header Card */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="space-y-0.5">
                        <h4 className="font-bold text-sm text-stone-900 leading-snug">
                          {b.nama}
                        </h4>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                          {b.tipe === 'persen' ? 'Persentase Subtotal' : 'Nominal Flat'}
                        </span>
                      </div>

                      {/* Toggle Aktif */}
                      <button
                        type="button"
                        onClick={() => handleToggleBiaya(b)}
                        className={`p-1 rounded-lg transition ${
                          b.aktif
                            ? 'text-emerald-600 hover:bg-emerald-50'
                            : 'text-stone-400 hover:bg-stone-100'
                        }`}
                        title={b.aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                      >
                        {b.aktif ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Nilai Biaya */}
                    <div className="my-3">
                      <span className="text-xl font-black text-stone-900">
                        {b.tipe === 'persen' ? `+${b.nilai}%` : `+${formatRupiah(b.nilai)}`}
                      </span>
                      <p className="text-[11px] text-stone-400 mt-0.5">
                        {b.tipe === 'persen'
                          ? 'Dihitung dari subtotal neto setelah voucher'
                          : 'Ditambahkan ke total tagihan pesanan'}
                      </p>
                    </div>
                  </div>

                  {/* Footer Tombol Aksi */}
                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenBiayaModal(b)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100 transition"
                      title="Edit biaya"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setItemToDelete({
                          type: 'biaya',
                          id: b.id,
                          label: b.nama,
                        })
                      }
                      className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Hapus biaya"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PIN OWNER */}
      {activeSegment === 'pin_owner' && (
        <div className="max-w-xl mx-auto space-y-4">
          {/* Card Info Status PIN */}
          <div className="p-5 rounded-2xl bg-white border border-stone-200 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    hasPin
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">
                    {hasPin ? 'PIN Owner Sudah Diatur' : 'PIN Owner Belum Diatur'}
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {hasPin && pinSetAt
                      ? `Aktif sejak ${formatDateTimeIndo(pinSetAt)}`
                      : 'Buat PIN 4-6 digit untuk otorisasi perubahan biaya manual kasir.'}
                  </p>
                </div>
              </div>

              {hasPin && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Aktif</span>
                </span>
              )}
            </div>

            {/* Peringatan Banner */}
            <div className="p-3.5 rounded-xl bg-orange-50/70 border border-orange-200 text-xs text-stone-700 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="text-orange-950 font-bold block mb-0.5">Otorisasi Kasir Berbasis PIN:</strong>
                PIN Owner akan diminta setiap kali kasir ingin mengubah nominal atau persentase biaya operasional (seperti delivery, service charge, dll) dari nilai default saat checkout di POS.
              </div>
            </div>

            {/* Form Input PIN */}
            <form onSubmit={handleSavePin} className="space-y-4 pt-2">
              {pinError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* Input PIN Lama jika sudah pernah diatur */}
              {hasPin && (
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    PIN Lama <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={pinLama}
                    onChange={(e) => setPinLama(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Masukkan PIN lama (4-6 digit)"
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tracking-widest border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>
              )}

              {/* Input PIN Baru */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  {hasPin ? 'PIN Baru' : 'Buat PIN Owner'} <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={pinBaru}
                  onChange={(e) => setPinBaru(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Masukkan 4-6 digit angka (misal: 1234)"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tracking-widest border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  PIN harus terdiri dari 4 sampai 6 digit angka numerik rahasia.
                </span>
              </div>

              {/* Konfirmasi PIN Baru */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Konfirmasi PIN Baru <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={pinKonfirmasi}
                  onChange={(e) => setPinKonfirmasi(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Ketik ulang PIN baru"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono tracking-widest border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingPin}
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmittingPin && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{hasPin ? 'Perbarui PIN Owner' : 'Simpan PIN Owner'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 4: LOG PERSETUJUAN */}
      {activeSegment === 'log_approval' && (
        <div className="space-y-4">
          <LogApprovalPage />
        </div>
      )}

      {/* MODAL FORM VOUCHER */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <TicketPercent className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  {editingVoucher ? 'Edit Voucher Diskon' : 'Buat Voucher Diskon'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveVoucher} className="p-5 space-y-4 overflow-y-auto">
              {voucherFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{voucherFormError}</span>
                </div>
              )}

              {/* Kode Voucher */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-stone-700">
                    Kode Voucher <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="text-[11px] font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate Acak</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={voucherKode}
                  onChange={(e) => setVoucherKode(e.target.value.toUpperCase())}
                  placeholder="CONTOH: PROMO10"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold tracking-wider uppercase border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>

              {/* Tipe Diskon Segmented */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Tipe Potongan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVoucherTipe('persen')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      voucherTipe === 'persen'
                        ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>Persentase (%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVoucherTipe('nominal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      voucherTipe === 'nominal'
                        ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Nominal Rupiah</span>
                  </button>
                </div>
              </div>

              {/* Nilai Diskon */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Besar Potongan <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  {voucherTipe === 'nominal' ? (
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-stone-400 pointer-events-none">
                      Rp
                    </span>
                  ) : (
                    <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-stone-400 pointer-events-none">
                      %
                    </span>
                  )}
                  <input
                    type="number"
                    required
                    min="1"
                    max={voucherTipe === 'persen' ? 100 : undefined}
                    step="any"
                    value={voucherNilai}
                    onChange={(e) => setVoucherNilai(e.target.value)}
                    placeholder={voucherTipe === 'persen' ? '10' : '10000'}
                    className={`w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 ${
                      voucherTipe === 'nominal' ? 'pl-10 pr-3' : 'pl-3 pr-9'
                    }`}
                  />
                </div>
              </div>

              {/* Minimum Belanja (Opsional) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Minimum Belanja (Rp) <span className="text-[11px] font-normal text-stone-400">(Opsional)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-stone-400 pointer-events-none">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={voucherMinBelanja}
                    onChange={(e) => setVoucherMinBelanja(e.target.value)}
                    placeholder="Kosongkan jika tanpa minimum belanja"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl text-xs sm:text-sm border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Tanggal Berakhir (Opsional) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Tanggal Berakhir <span className="text-[11px] font-normal text-stone-400">(Opsional)</span>
                </label>
                <input
                  type="date"
                  value={voucherTanggalBerakhir}
                  onChange={(e) => setVoucherTanggalBerakhir(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
                <span className="text-[10px] text-stone-400 mt-1 block">
                  Kosongkan bila voucher berlaku tanpa batas waktu kedaluwarsa.
                </span>
              </div>

              {/* Toggle Aktif */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={voucherAktif}
                    onChange={(e) => setVoucherAktif(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-stone-300"
                  />
                  <span className="text-xs font-bold text-stone-700">Aktifkan voucher ini sekarang</span>
                </label>
              </div>

              {/* Footer Tombol Simpan */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsVoucherModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVoucher}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmittingVoucher && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingVoucher ? 'Simpan Perubahan' : 'Buat Voucher'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FORM BIAYA LAIN */}
      {isBiayaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-stone-900">
                  {editingBiaya ? 'Edit Biaya Lain' : 'Tambah Biaya Lain'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBiayaModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBiaya} className="p-5 space-y-4 overflow-y-auto">
              {biayaFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{biayaFormError}</span>
                </div>
              )}

              {/* Nama Biaya */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Nama Biaya <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={biayaNama}
                  onChange={(e) => setBiayaNama(e.target.value)}
                  placeholder="Contoh: Delivery, Service Charge, Pajak Resto"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                />
              </div>

              {/* Tipe Biaya Segmented */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Tipe Perhitungan <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBiayaTipe('persen')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      biayaTipe === 'persen'
                        ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>Persentase (%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBiayaTipe('nominal')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${
                      biayaTipe === 'nominal'
                        ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                        : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Nominal Tetap (Rp)</span>
                  </button>
                </div>
              </div>

              {/* Nilai Biaya */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Besar Biaya <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  {biayaTipe === 'nominal' ? (
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-stone-400 pointer-events-none">
                      Rp
                    </span>
                  ) : (
                    <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-stone-400 pointer-events-none">
                      %
                    </span>
                  )}
                  <input
                    type="number"
                    required
                    min="1"
                    max={biayaTipe === 'persen' ? 100 : undefined}
                    step="any"
                    value={biayaNilai}
                    onChange={(e) => setBiayaNilai(e.target.value)}
                    placeholder={biayaTipe === 'persen' ? '5' : '5000'}
                    className={`w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 ${
                      biayaTipe === 'nominal' ? 'pl-10 pr-3' : 'pl-3 pr-9'
                    }`}
                  />
                </div>
              </div>

              {/* Toggle Aktif */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={biayaAktif}
                    onChange={(e) => setBiayaAktif(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-stone-300"
                  />
                  <span className="text-xs font-bold text-stone-700">Aktifkan biaya ini saat kasir checkout</span>
                </label>
              </div>

              {/* Footer Tombol Simpan */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBiayaModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBiaya}
                  className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isSubmittingBiaya && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingBiaya ? 'Simpan Perubahan' : 'Tambah Biaya'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE DIALOG */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-stone-900">
                Hapus {itemToDelete.type === 'voucher' ? 'Voucher' : 'Biaya Lain'}?
              </h3>
              <p className="text-xs text-stone-500">
                Apakah Anda yakin ingin menghapus "{itemToDelete.label}"? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setItemToDelete(null)}
                className="py-2.5 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
