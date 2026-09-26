import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  User,
  Plus,
  Printer,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Lock,
  Utensils,
  ShoppingBag,
  Bike,
  CalendarClock,
  UserCheck,
  PartyPopper,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  OpenBill,
  OrderBill,
  ItemOrderBill,
  Produk,
} from '../../types';
import { CartItemCheckout } from '../pos/CheckoutModal';
import { useAuth } from '../../context/AuthContext';
import { openBillCloudService } from '../../services/cloud/openBillCloudService';
import { produkCloudService, hitungHargaNeto } from '../../services/cloud/produkCloudService';
import { printerBleService } from '../../services/printerBleService';
import { pinOwnerCloudService } from '../../services/cloud/pinOwnerCloudService';
import { formatRupiah, formatDateTimeIndo } from '../../utils/formatters';

export interface OpenBillCheckoutContext {
  billIds: string[];
  itemsGabungan: CartItemCheckout[];
  ongkir?: number;
  pelangganId?: string;
  pelangganNama?: string;
  tipeUtang?: boolean;
}

interface OpenBillDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: OpenBill;
  onRefreshBill: (updatedBill: OpenBill) => void;
  onCheckout: (context: OpenBillCheckoutContext) => void;
  onBillCancelled?: () => void;
}

export const OpenBillDetailModal: React.FC<OpenBillDetailModalProps> = ({
  isOpen,
  onClose,
  bill,
  onRefreshBill,
  onCheckout,
  onBillCancelled,
}) => {
  const currentBill = bill;
  const { currentOutlet, user } = useAuth();

  // Timer berjalan sejak openedAt
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // State tambah order
  const [isAddingOrder, setIsAddingOrder] = useState<boolean>(false);
  const [activeCatalog, setActiveCatalog] = useState<Produk[]>([]);
  const [selectedKategori, setSelectedKategori] = useState<string>('semua');
  const [orderDraftItems, setOrderDraftItems] = useState<
    Array<{ produk: Produk; qty: number; catatan: string }>
  >([]);

  // State koreksi qty
  const [koreksiTarget, setKoreksiTarget] = useState<{
    orderId: string;
    itemIndex: number;
    currentQty: number;
    targetQty: number;
    itemName: string;
    sudahDicetakDapur: boolean;
  } | null>(null);
  const [alasanKoreksiInput, setAlasanKoreksiInput] = useState<string>('');
  const [isSubmittingKoreksi, setIsSubmittingKoreksi] = useState<boolean>(false);

  // State pembatalan bill ber-PIN
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [alasanBatalInput, setAlasanBatalInput] = useState<string>('');
  const [pinOwnerInput, setPinOwnerInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmittingBatal, setIsSubmittingBatal] = useState<boolean>(false);

  // PERBAIKAN 6: Pengunci percobaan PIN (5 kali gagal => kunci 10 menit)
  const [failedPinAttempts, setFailedPinAttempts] = useState<number>(0);
  const [pinLockUntil, setPinLockUntil] = useState<number | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number>(0);

  // State Toast Notifikasi
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast(text ? { text, type } : null);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Hitung mundur penguncian PIN
  useEffect(() => {
    if (!pinLockUntil) {
      setLockCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((pinLockUntil - now) / 1000));
      setLockCountdown(diff);
      if (diff <= 0) {
        setPinLockUntil(null);
        setFailedPinAttempts(0);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [pinLockUntil]);

  // Timer interval
  useEffect(() => {
    if (!isOpen || !currentBill?.openedAt) return;

    const calcElapsed = () => {
      const openedTime = new Date(currentBill.openedAt).getTime();
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - openedTime) / 1000));
      setElapsedSeconds(diffSec);
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 1000);
    return () => clearInterval(interval);
  }, [isOpen, currentBill?.openedAt]);

  const formattedTimer = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
      seconds
    ).padStart(2, '0')}`;
  }, [elapsedSeconds]);

  // PERBAIKAN 4: Muat produk dengan getActiveProduk(outletId, true) agar produk
  // yang dinonaktifkan di tengah umur bill tetap dihitung diskonnya sama seperti di CheckoutModal.
  useEffect(() => {
    if (isOpen && currentOutlet?.id) {
      produkCloudService
        .getActiveProduk(currentOutlet.id, true)
        .then((prods) => setActiveCatalog(prods || []))
        .catch((err) => console.warn('Gagal memuat produk:', err));
    }
  }, [isOpen, currentOutlet?.id]);

  // PERBAIKAN 1: useMemo kategoriList dan filteredProdukList di ATAS baris if (!isOpen || !currentBill) return null;
  // dengan guard aman bila activeCatalog kosong
  const kategoriList = useMemo(() => {
    if (!activeCatalog || activeCatalog.length === 0) return ['semua'];
    const setKat = new Set<string>();
    activeCatalog.forEach((p) => {
      if (p.kategori?.trim()) setKat.add(p.kategori.trim());
    });
    return ['semua', ...Array.from(setKat)];
  }, [activeCatalog]);

  const filteredProdukList = useMemo(() => {
    if (!activeCatalog || activeCatalog.length === 0) return [];
    const list = activeCatalog.filter((p) => p.aktif !== false);
    if (selectedKategori === 'semua') return list;
    return list.filter((p) => p.kategori?.trim() === selectedKategori);
  }, [activeCatalog, selectedKategori]);

  const filteredCatalog = filteredProdukList;

  // Kalkulasi Ringkasan Biaya Bill (dipindah ke atas sebelum return bersyarat)
  const ringkasanKalkulasi = useMemo(() => {
    let subtotalKotor = 0;
    let totalItems = 0;

    if (!currentBill) {
      return {
        subtotalKotor: 0,
        totalItems: 0,
        ongkir: 0,
        totalSementara: 0,
      };
    }

    (currentBill.orders || []).forEach((ord) => {
      (ord.items || []).forEach((it) => {
        subtotalKotor += it.hargaJual * it.qty;
        totalItems += it.qty;
      });
    });

    const ongkirVal = currentBill.meta?.ongkir || 0;
    const totalSementara = subtotalKotor + ongkirVal;

    return {
      subtotalKotor,
      totalItems,
      ongkir: ongkirVal,
      totalSementara,
    };
  }, [currentBill]);

  // Tambah item ke draf order baru
  const handleAddItemToDraft = (produk: Produk) => {
    setOrderDraftItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.produk.id === produk.id);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex].qty += 1;
        return next;
      }
      return [...prev, { produk, qty: 1, catatan: '' }];
    });
  };

  const handleUpdateDraftQty = (produkId: string, newQty: number) => {
    setOrderDraftItems((prev) => {
      if (newQty <= 0) {
        return prev.filter((it) => it.produk.id !== produkId);
      }
      return prev.map((it) => (it.produk.id === produkId ? { ...it, qty: newQty } : it));
    });
  };

  const handleUpdateDraftCatatan = (produkId: string, catatan: string) => {
    setOrderDraftItems((prev) =>
      prev.map((it) => (it.produk.id === produkId ? { ...it, catatan } : it))
    );
  };

  // Simpan Order Baru & Cetak Tiket Dapur dengan verifikasi jujur (PERBAIKAN 2)
  const handleSaveAddOrder = async () => {
    if (!currentOutlet?.id || orderDraftItems.length === 0 || !currentBill) return;

    try {
      const items: ItemOrderBill[] = orderDraftItems.map((it) => ({
        produkId: it.produk.id,
        nama: it.produk.nama,
        qty: it.qty,
        hargaJual: it.produk.hargaJual,
        catatan: it.catatan.trim() || undefined,
      }));

      // 1. Simpan order ke openBillCloudService dengan sudahDicetakDapur = false
      const newOrder = await openBillCloudService.addOrder(
        currentOutlet.id,
        currentBill.id,
        items,
        user?.id || 'kasir',
        false // Jangan menandai tercetak sebelum bukti cetak
      );

      // 2. Coba cetak tiket dapur
      let printSuccess = false;
      try {
        await printerBleService.printKitchenTicket({
          label: currentBill.label,
          tipe: currentBill.tipe,
          nomorOrder: newOrder.id.slice(-6).toUpperCase(),
          waktu: newOrder.waktu,
          items: items.map((it) => ({
            nama: it.nama,
            qty: it.qty,
            catatan: it.catatan,
          })),
          catatan: currentBill.meta.patokan || currentBill.meta.alamat,
        });
        printSuccess = true;
      } catch (printErr) {
        console.warn('[OpenBillDetail] Gagal cetak tiket dapur otomatis:', printErr);
      }

      // 3. BILA cetak sukses panggil openBillCloudService.markOrderPrinted
      // BILA cetak gagal biarkan false dan tampilkan toast info
      if (printSuccess) {
        try {
          await openBillCloudService.markOrderPrinted(currentOutlet.id, currentBill.id, newOrder.id);
        } catch (markErr) {
          console.warn('[OpenBillDetail] Gagal menandai tiket tercetak:', markErr);
        }
        const updated = await openBillCloudService.getOpenBillById(currentOutlet.id, currentBill.id);
        if (updated) onRefreshBill(updated);
        showToast('Order berhasil ditambahkan & tiket dapur tercetak.', 'success');
      } else {
        const updated = await openBillCloudService.getOpenBillById(currentOutlet.id, currentBill.id);
        if (updated) onRefreshBill(updated);
        showToast('Order tersimpan tetapi tiket dapur gagal dicetak. Silakan cetak ulang.', 'info');
      }

      setIsAddingOrder(false);
      setOrderDraftItems([]);
    } catch (err: unknown) {
      console.error('Gagal menambah order:', err);
      showToast(err instanceof Error ? err.message : 'Gagal menambah order.', 'error');
    }
  };

  const handleSaveNewOrder = handleSaveAddOrder;

  // Cetak Ulang Tiket Dapur per Order
  const handlePrintUlangTiketDapur = async (order: OrderBill) => {
    try {
      await printerBleService.printKitchenTicket({
        label: bill.label,
        tipe: bill.tipe,
        nomorOrder: order.id.slice(-6).toUpperCase(),
        waktu: order.waktu,
        items: order.items.map((it) => ({
          nama: it.nama,
          qty: it.qty,
          catatan: it.catatan,
        })),
        catatan: bill.meta.patokan || bill.meta.alamat,
      });
      showToast('Tiket dapur berhasil dikirim ke printer.', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal mencetak tiket dapur.', 'error');
    }
  };

  // Trigger Koreksi Qty
  const handleTriggerQtyChange = (
    order: OrderBill,
    itemIndex: number,
    item: ItemOrderBill,
    delta: number
  ) => {
    const targetQty = item.qty + delta;
    if (targetQty < 0) return;

    if (order.sudahDicetakDapur) {
      // Wajib modal alasan koreksi
      setKoreksiTarget({
        orderId: order.id,
        itemIndex,
        currentQty: item.qty,
        targetQty,
        itemName: item.nama,
        sudahDicetakDapur: true,
      });
      setAlasanKoreksiInput('');
    } else {
      // Belum dicetak dapur, langsung update tanpa alasan
      executeQtyUpdate(order.id, itemIndex, targetQty, '');
    }
  };

  const executeQtyUpdate = async (
    orderId: string,
    itemIndex: number,
    targetQty: number,
    alasan: string
  ) => {
    if (!currentOutlet?.id) return;

    try {
      setIsSubmittingKoreksi(true);
      const res = await openBillCloudService.updateItemQty(
        currentOutlet.id,
        bill.id,
        orderId,
        itemIndex,
        targetQty,
        alasan,
        user?.id || 'kasir'
      );

      const updated = await openBillCloudService.getOpenBillById(currentOutlet.id, bill.id);
      if (updated) onRefreshBill(updated);

      // Jika sudah pernah dicetak dapur, kirim tiket koreksi
      if (res.koreksi) {
        try {
          await printerBleService.printCorrectionTicket({
            label: bill.label,
            tipe: bill.tipe,
            nomorOrder: orderId.slice(-6).toUpperCase(),
            waktu: new Date().toISOString(),
            items: res.order.items.map((it) => ({
              nama: it.nama,
              qty: it.qty,
              catatan: it.catatan,
            })),
            alasan: res.koreksi.alasan,
          });
        } catch (printErr) {
          console.warn('[OpenBillDetail] Gagal cetak tiket koreksi:', printErr);
        }
      }

      showToast('Kuantitas berhasil diperbarui.', 'success');
      setKoreksiTarget(null);
      setAlasanKoreksiInput('');
    } catch (err: unknown) {
      console.error('Gagal update kuantitas:', err);
      showToast(err instanceof Error ? err.message : 'Gagal memperbarui kuantitas.', 'error');
    } finally {
      setIsSubmittingKoreksi(false);
    }
  };

  // Batalkan Bill dengan Verifikasi PIN Owner (PERBAIKAN 2)
  const handleConfirmCancelBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || !currentBill) return;

    if (lockCountdown > 0) {
      const remainingMinutes = Math.ceil(lockCountdown / 60);
      setPinError(`Akses tombol dibekukan selama ${remainingMinutes} menit karena 5 kali salah PIN.`);
      return;
    }

    setPinError(null);
    const trimmedAlasan = alasanBatalInput.trim();
    if (!trimmedAlasan) {
      setPinError('Alasan pembatalan bill wajib diisi.');
      return;
    }

    const cleanPin = pinOwnerInput.trim();
    if (!cleanPin) {
      setPinError('PIN Owner wajib diisi.');
      return;
    }

    try {
      setIsSubmittingBatal(true);

      // 1. Simpan hasil verifikasi PIN Owner (PERBAIKAN 1)
      const pinRes = await pinOwnerCloudService.verifyPinOwner(currentOutlet.id, cleanPin);

      // 2. Bila PIN belum diatur, tampilkan error TANPA menambah penghitung gagal
      if (!pinRes.hasPinConfigured) {
        setPinError('PIN Owner belum diatur pada outlet ini. Hubungi Owner.');
        setIsSubmittingBatal(false);
        return;
      }

      // Bila PIN salah: jalankan logika penghitung gagal + lockout 10 menit dan setPinError(pinRes.message)
      if (!pinRes.valid) {
        const nextAttempts = failedPinAttempts + 1;
        setFailedPinAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          const lockTime = Date.now() + 10 * 60 * 1000; // 10 menit
          setPinLockUntil(lockTime);
          setPinError('Percobaan PIN salah 5 kali berturut-turut. Tombol dibekukan selama 10 menit.');
        } else {
          setPinError(pinRes.message || 'PIN Owner yang dimasukkan salah.');
        }
        setIsSubmittingBatal(false);
        return;
      }

      // 3. Panggil openBillCloudService.cancelBill HANYA setelah pinRes.valid === true
      await openBillCloudService.cancelBill(
        currentOutlet.id,
        currentBill.id,
        trimmedAlasan,
        user?.id || 'kasir',
        cleanPin
      );

      // Verifikasi sukses: reset penghitung gagal
      setFailedPinAttempts(0);
      setPinLockUntil(null);
      setPinError(null);

      showToast(`Bill "${currentBill.label}" berhasil dibatalkan.`, 'success');
      setIsCancelModalOpen(false);
      onBillCancelled?.();
      onClose();
    } catch (err: unknown) {
      console.error('Gagal membatalkan bill:', err);
      const errorMsg = err instanceof Error ? err.message : 'Gagal membatalkan bill.';
      setPinError(errorMsg);
    } finally {
      setIsSubmittingBatal(false);
    }
  };

  // Siapkan Data untuk Tutup & Bayar (Gabungkan grup bill jika ada)
  const handleProceedCheckout = async () => {
    if (!currentOutlet?.id || !currentBill) return;

    try {
      let targetBills: OpenBill[] = [currentBill];

      // Jika bill memiliki groupId, gabungkan seluruh bill dalam grup yang sama
      if (currentBill.groupId?.trim()) {
        const groupList = await openBillCloudService.getBillsByGroup(
          currentOutlet.id,
          currentBill.groupId.trim()
        );
        if (groupList.length > 0) {
          targetBills = groupList;
        }
      }

      // PERBAIKAN 5: Pagar grup beda tipe
      if (targetBills.length > 1) {
        const firstType = targetBills[0].tipe;
        const hasDifferentType = targetBills.some((b) => b.tipe !== firstType);
        if (hasDifferentType) {
          showToast('Bill dalam satu grup harus memiliki tipe pesanan yang sama.', 'error');
          return;
        }
      }

      const billIds = targetBills.map((b) => b.id);

      // Kumpulkan item gabungan
      const itemsMap = new Map<string, CartItemCheckout>();
      let totalOngkir = 0;

      targetBills.forEach((b) => {
        if (b.meta?.ongkir) {
          totalOngkir += b.meta.ongkir;
        }

        (b.orders || []).forEach((ord) => {
          (ord.items || []).forEach((it) => {
            const key = `${it.produkId || it.nama}_${it.catatan || ''}`;
            if (itemsMap.has(key)) {
              const exist = itemsMap.get(key)!;
              exist.qty += it.qty;
              exist.subtotal = exist.qty * exist.hargaJual;
            } else {
              itemsMap.set(key, {
                id: `ci-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                produkId: it.produkId,
                nama: it.nama,
                qty: it.qty,
                hargaJual: it.hargaJual,
                subtotal: it.qty * it.hargaJual,
                catatan: it.catatan,
              });
            }
          });
        });
      });

      const itemsGabungan = Array.from(itemsMap.values());

      onCheckout({
        billIds,
        itemsGabungan,
        ongkir: totalOngkir > 0 ? totalOngkir : undefined,
        pelangganId: currentBill.meta.pelangganId,
        pelangganNama: currentBill.meta.pelangganNama,
        tipeUtang: currentBill.tipe === 'utang',
      });

      onClose();
    } catch (err: unknown) {
      console.error('Gagal menyusun data checkout:', err);
      showToast('Gagal memproses penutupan bill.', 'error');
    }
  };

  if (!isOpen || !currentBill) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Toast Notifikasi */}
        {toast && (
          <div
            className={`px-4 py-2.5 text-xs font-bold flex items-center justify-between border-b ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : toast.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200'
                : 'bg-blue-50 text-blue-800 border-blue-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
              <span>{toast.text}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-[11px] underline opacity-80 hover:opacity-100"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
              {bill.tipe === 'dine_in' && <Utensils className="w-5 h-5" />}
              {bill.tipe === 'takeaway' && <ShoppingBag className="w-5 h-5" />}
              {bill.tipe === 'delivery' && <Bike className="w-5 h-5" />}
              {bill.tipe === 'pre_order' && <CalendarClock className="w-5 h-5" />}
              {bill.tipe === 'utang' && <UserCheck className="w-5 h-5" />}
              {bill.tipe === 'katering' && <PartyPopper className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                  {bill.label}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-100 text-orange-700">
                  {bill.tipe.replace('_', ' ')}
                </span>
                {bill.groupId && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    <span>{bill.groupId}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500 mt-0.5">
                <span className="flex items-center gap-1 text-stone-700 font-semibold font-mono">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>{formattedTimer}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-stone-400" />
                  <span>{bill.kasirNama || 'Kasir'}</span>
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Metadata Chips Bar */}
        <div className="px-5 py-2.5 bg-stone-100/60 border-b border-stone-200/70 flex flex-wrap gap-2 text-xs">
          {bill.meta.nomorMeja && (
            <div className="px-2.5 py-1 bg-white rounded-lg border border-stone-200 font-medium">
              <span className="text-stone-400 font-normal">Meja:</span>{' '}
              <strong className="text-stone-800">{bill.meta.nomorMeja}</strong>
            </div>
          )}
          {bill.meta.alamat && (
            <div className="px-2.5 py-1 bg-white rounded-lg border border-stone-200 font-medium">
              <span className="text-stone-400 font-normal">Alamat:</span>{' '}
              <span className="text-stone-800">{bill.meta.alamat}</span>
            </div>
          )}
          {bill.meta.ongkir !== undefined && bill.meta.ongkir > 0 && (
            <div className="px-2.5 py-1 bg-white rounded-lg border border-stone-200 font-medium text-emerald-700">
              <span className="text-stone-400 font-normal">Ongkir:</span>{' '}
              <strong>{formatRupiah(bill.meta.ongkir)}</strong>
            </div>
          )}
          {bill.meta.tanggalAmbil && (
            <div className="px-2.5 py-1 bg-white rounded-lg border border-stone-200 font-medium">
              <span className="text-stone-400 font-normal">Ambil:</span>{' '}
              <strong className="text-stone-800">{bill.meta.tanggalAmbil}</strong>
            </div>
          )}
          {bill.meta.pelangganNama && (
            <div className="px-2.5 py-1 bg-white rounded-lg border border-stone-200 font-medium">
              <span className="text-stone-400 font-normal">Pelanggan:</span>{' '}
              <strong className="text-stone-800">{bill.meta.pelangganNama}</strong>
            </div>
          )}
          {bill.meta.tanggalAcara && (
            <div className="px-2.5 py-1 bg-white rounded-lg border border-stone-200 font-medium">
              <span className="text-stone-400 font-normal">Acara:</span>{' '}
              <strong className="text-stone-800">{bill.meta.tanggalAcara}</strong>
            </div>
          )}
          {bill.meta.jumlahPorsi !== undefined && (
            <div className="px-2.5 py-1 bg-white rounded-lg border border-stone-200 font-medium">
              <span className="text-stone-400 font-normal">Porsi:</span>{' '}
              <strong className="text-stone-800">{bill.meta.jumlahPorsi} pax</strong>
            </div>
          )}
          {bill.meta.patokan && (
            <div className="px-2.5 py-1 bg-white rounded-lg border border-stone-200 font-medium">
              <span className="text-stone-400 font-normal">Catatan:</span>{' '}
              <span className="text-stone-700">{bill.meta.patokan}</span>
            </div>
          )}
        </div>

        {/* Content Body: Daftar Orders & Action Button */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Tombol Tambah Order */}
          {!isAddingOrder && (
            <button
              type="button"
              onClick={() => setIsAddingOrder(true)}
              className="w-full py-2.5 px-4 rounded-2xl border-2 border-dashed border-orange-300 hover:border-orange-500 bg-orange-50/50 hover:bg-orange-50 text-orange-700 text-xs font-black transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Order / Item Pesanan Baru</span>
            </button>
          )}

          {/* Form Picker Tambah Order Baru */}
          {isAddingOrder && (
            <div className="p-4 bg-orange-50/60 rounded-3xl border border-orange-200 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold text-orange-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <span>Tambah Item ke Tiket Dapur Baru</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingOrder(false);
                    setOrderDraftItems([]);
                  }}
                  className="text-xs font-bold text-stone-500 hover:text-stone-800"
                >
                  Batal
                </button>
              </div>

              {/* Kategori Filter Tabs */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {kategoriList.map((kat) => (
                  <button
                    key={kat}
                    type="button"
                    onClick={() => setSelectedKategori(kat)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold capitalize shrink-0 transition ${
                      selectedKategori === kat
                        ? 'bg-orange-600 text-white shadow-xs'
                        : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {kat}
                  </button>
                ))}
              </div>

              {/* Grid Menu Produk */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 bg-white rounded-2xl border border-orange-100">
                {filteredCatalog.map((prod) => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAddItemToDraft(prod)}
                    className="p-2 rounded-xl text-left hover:bg-orange-50 border border-stone-100 hover:border-orange-200 transition flex flex-col justify-between"
                  >
                    <div className="text-xs font-bold text-stone-900 line-clamp-1">{prod.nama}</div>
                    <div className="text-[11px] font-bold text-orange-600 mt-1">
                      {formatRupiah(prod.hargaJual)}
                    </div>
                  </button>
                ))}
              </div>

              {/* List Item Yang Akan Dipesan */}
              {orderDraftItems.length > 0 && (
                <div className="p-3 bg-white rounded-2xl border border-orange-200 space-y-2">
                  <div className="text-[11px] font-extrabold text-stone-800 uppercase tracking-wider">
                    Draf Item Baru ({orderDraftItems.reduce((acc, it) => acc + it.qty, 0)} item):
                  </div>
                  {orderDraftItems.map((it) => (
                    <div
                      key={it.produk.id}
                      className="p-2 rounded-xl bg-stone-50 border border-stone-200/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-800">{it.produk.nama}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateDraftQty(it.produk.id, it.qty - 1)}
                            className="w-6 h-6 rounded-lg bg-stone-200 text-stone-700 font-black text-xs flex items-center justify-center hover:bg-stone-300"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-xs font-extrabold">{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateDraftQty(it.produk.id, it.qty + 1)}
                            className="w-6 h-6 rounded-lg bg-orange-600 text-white font-black text-xs flex items-center justify-center hover:bg-orange-700"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        value={it.catatan}
                        onChange={(e) => handleUpdateDraftCatatan(it.produk.id, e.target.value)}
                        placeholder="Catatan porsi (mis: pedas, tanpa seledri)..."
                        className="w-full px-2.5 py-1 text-[11px] rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500 bg-white"
                      />
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleSaveNewOrder}
                    className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-black text-xs shadow-md transition flex items-center justify-center gap-1.5 mt-2"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Kirim Pesanan & Cetak Tiket Dapur</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Daftar Orders Berurutan */}
          <div className="space-y-3">
            <div className="text-xs font-extrabold text-stone-700 uppercase tracking-wider">
              Daftar Order Masuk ({bill.orders?.length || 0}):
            </div>

            {(!bill.orders || bill.orders.length === 0) && (
              <div className="p-8 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-stone-400 text-xs">
                Belum ada pesanan masuk. Klik tombol "+ Tambah Order" di atas.
              </div>
            )}

            {(bill.orders || []).map((order, orderIdx) => (
              <div
                key={order.id}
                className="p-4 rounded-2xl bg-white border border-stone-200 shadow-xs space-y-3"
              >
                {/* Header Order */}
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-stone-100 text-stone-700 font-mono font-bold text-xs flex items-center justify-center">
                      #{orderIdx + 1}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-stone-800">
                        Order {order.id.slice(-6).toUpperCase()}
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {formatDateTimeIndo(order.waktu)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {order.sudahDicetakDapur && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Tercetak Dapur
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handlePrintUlangTiketDapur(order)}
                      title="Cetak Ulang Tiket Dapur"
                      className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition flex items-center gap-1 text-[11px] font-bold"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Cetak Ulang</span>
                    </button>
                  </div>
                </div>

                {/* Items dalam Order */}
                <div className="space-y-1.5">
                  {order.items.map((it, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-xl hover:bg-stone-50"
                    >
                      <div className="flex-1 pr-2">
                        <div className="font-bold text-stone-800">{it.nama}</div>
                        {it.catatan && (
                          <div className="text-[10px] text-stone-500 italic">
                            * {it.catatan}
                          </div>
                        )}
                        <div className="text-[11px] text-stone-400">
                          {formatRupiah(it.hargaJual)}
                        </div>
                      </div>

                      {/* Tombol Kontrol Kuantitas */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleTriggerQtyChange(order, itemIdx, it, -1)}
                            className="w-5 h-5 rounded bg-white text-stone-700 font-bold hover:bg-stone-200 flex items-center justify-center shadow-2xs"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-black">{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => handleTriggerQtyChange(order, itemIdx, it, 1)}
                            className="w-5 h-5 rounded bg-white text-stone-700 font-bold hover:bg-stone-200 flex items-center justify-center shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                        <div className="w-20 text-right font-black text-stone-900">
                          {formatRupiah(it.hargaJual * it.qty)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Riwayat Koreksi jika ada */}
                {order.koreksi && order.koreksi.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] space-y-1">
                    <div className="font-bold text-amber-900">Riwayat Koreksi Dapur:</div>
                    {order.koreksi.map((kor, kIdx) => (
                      <div key={kIdx} className="text-amber-800">
                        • Qty: <strong>{kor.dari}</strong> → <strong>{kor.ke}</strong> • <em>"{kor.alasan}"</em>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Ringkasan Biaya Bill */}
          <div className="p-4 bg-stone-900 text-white rounded-3xl space-y-2">
            <div className="flex justify-between text-xs text-stone-300">
              <span>Subtotal Item ({ringkasanKalkulasi.totalItems} item):</span>
              <span>{formatRupiah(ringkasanKalkulasi.subtotalKotor)}</span>
            </div>
            {ringkasanKalkulasi.ongkir > 0 && (
              <div className="flex justify-between text-xs text-stone-300">
                <span>Ongkir Pengiriman:</span>
                <span>{formatRupiah(ringkasanKalkulasi.ongkir)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-stone-800 flex justify-between items-baseline">
              <span className="text-xs font-bold text-stone-300">TOTAL SEMENTARA</span>
              <span className="text-lg font-black text-orange-400">
                {formatRupiah(ringkasanKalkulasi.totalSementara)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsCancelModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Batalkan Bill</span>
          </button>

          <button
            type="button"
            onClick={handleProceedCheckout}
            disabled={ringkasanKalkulasi.totalItems === 0}
            className="flex-1 py-3 px-5 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white text-xs sm:text-sm font-black shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>Tutup & Bayar</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Modal Wajib Alasan Koreksi */}
      {koreksiTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-sm text-stone-900">
                Alasan Koreksi Pesanan Dapur
              </h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Pesanan <strong>{koreksiTarget.itemName}</strong> sudah pernah dicetak ke dapur.
              Perubahan kuantitas dari <strong>{koreksiTarget.currentQty}</strong> ke{' '}
              <strong>{koreksiTarget.targetQty}</strong> akan memicu cetak tiket koreksi.
            </p>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Alasan Koreksi <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={alasanKoreksiInput}
                onChange={(e) => setAlasanKoreksiInput(e.target.value)}
                autoFocus
                placeholder="Contoh: Salah dengar, pelanggan batalkan porsi..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setKoreksiTarget(null)}
                className="flex-1 py-2 rounded-xl border border-stone-200 font-bold text-xs text-stone-600 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!alasanKoreksiInput.trim() || isSubmittingKoreksi}
                onClick={() =>
                  executeQtyUpdate(
                    koreksiTarget.orderId,
                    koreksiTarget.itemIndex,
                    koreksiTarget.targetQty,
                    alasanKoreksiInput
                  )
                }
                className="flex-1 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isSubmittingKoreksi ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Koreksi & Cetak</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Batalkan Bill Ber-PIN Owner */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmCancelBill}
            className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center gap-2 text-red-600">
              <Lock className="w-5 h-5 shrink-0" />
              <h3 className="font-extrabold text-sm text-stone-900">
                Otorisasi Pembatalan Open Bill
              </h3>
            </div>
            <p className="text-xs text-stone-600">
              Pembatalan bill <strong>{currentBill.label}</strong> wajib diverifikasi menggunakan PIN Owner
              dan alasan tertulis.
            </p>

            {lockCountdown > 0 && (
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-900 text-xs font-bold flex items-center gap-2 border border-amber-300">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  PIN dibekukan sementara selama {Math.floor(lockCountdown / 60)}m {lockCountdown % 60}s karena 5 kali salah berturut-turut.
                </span>
              </div>
            )}

            {pinError && (
              <div className="p-2.5 rounded-xl bg-red-50 text-red-800 text-xs font-semibold flex items-center gap-1.5 border border-red-200">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Alasan Pembatalan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                disabled={lockCountdown > 0}
                value={alasanBatalInput}
                onChange={(e) => setAlasanBatalInput(e.target.value)}
                placeholder="Pelanggan walk out / salah buka meja..."
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-stone-100"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                PIN Owner <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                maxLength={6}
                disabled={lockCountdown > 0}
                value={pinOwnerInput}
                onChange={(e) => setPinOwnerInput(e.target.value)}
                placeholder="6 digit PIN"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-center font-mono tracking-widest text-lg font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:bg-stone-100"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="flex-1 py-2 rounded-xl border border-stone-200 font-bold text-xs text-stone-600 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingBatal || !pinOwnerInput.trim() || lockCountdown > 0}
                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isSubmittingBatal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Konfirmasi Batal</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
