import React, { useState, useMemo, useEffect, Component, ErrorInfo } from 'react';
import {
  X,
  Banknote,
  QrCode,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Receipt,
  TicketPercent,
  Tag,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Lock,
  UserCheck,
} from 'lucide-react';
import { Transaksi, ItemTransaksiSnapshot, Produk, Voucher, BiayaLain, ApprovalBiayaManual } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { transaksiCloudService } from '../../services/cloud/transaksiCloudService';
import { openBillCloudService } from '../../services/cloud/openBillCloudService';
import { produkCloudService, hitungHargaNeto } from '../../services/cloud/produkCloudService';
import { voucherCloudService } from '../../services/cloud/voucherCloudService';
import { biayaLainCloudService, hitungSubtotalBiaya } from '../../services/cloud/biayaLainCloudService';
import { hppCloudService, HppCalculationCache } from '../../services/cloud/hppCloudService';
import { formatRupiah } from '../../utils/formatters';
import { PinOwnerApprovalModal } from './PinOwnerApprovalModal';

export interface CartItemCheckout {
  id: string;
  produkId?: string;
  nama: string;
  qty: number;
  hargaJual: number;
  subtotal: number;
  catatan?: string;
  diskonProduk?: { tipe: 'nominal' | 'persen'; nilai: number } | null;
}

export interface OpenBillCheckoutContext {
  billIds: string[];
  itemsGabungan: CartItemCheckout[];
  ongkir?: number;
  pelangganId?: string;
  pelangganNama?: string;
  tipeUtang?: boolean;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItemCheckout[];
  total: number;
  onSuccess: (transaksi: Transaksi, id: string) => void;
  openBillContext?: OpenBillCheckoutContext | null;
}

const CheckoutModalContent: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  items,
  total: initialTotal,
  onSuccess,
  openBillContext,
}) => {
  const { currentOutlet, user } = useAuth();

  const [metodeBayar, setMetodeBayar] = useState<'tunai' | 'qris' | 'transfer' | 'piutang'>(() => {
    return openBillContext?.tipeUtang ? 'piutang' : 'tunai';
  });
  const [uangDiterimaInput, setUangDiterimaInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Map cache produk outlet untuk memastikan diskon promo produk termutakhir
  const [outletProdukMap, setOutletProdukMap] = useState<Map<string, Produk>>(new Map());

  // State Voucher
  const [voucherInput, setVoucherInput] = useState<string>('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState<boolean>(false);

  // State Biaya Lain
  const [availableBiayaLain, setAvailableBiayaLain] = useState<BiayaLain[]>([]);
  const [selectedBiayaIds, setSelectedBiayaIds] = useState<Set<string>>(new Set());

  // State Biaya Manual (Approval dengan PIN Owner)
  const [manualBiayaMap, setManualBiayaMap] = useState<
    Record<string, { manualNilai: number; approval: ApprovalBiayaManual }>
  >({});
  const [biayaForPinApproval, setBiayaForPinApproval] = useState<BiayaLain | null>(null);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);

  // Muat data produk dan biaya lain saat modal dibuka
  useEffect(() => {
    if (!isOpen || !currentOutlet?.id) return;

    // Reset input setiap modal dibuka ulang
    setSubmitError(null);
    setVoucherError(null);
    setVoucherInput('');
    setAppliedVoucher(null);
    setSelectedBiayaIds(new Set());
    setManualBiayaMap({});
    setBiayaForPinApproval(null);
    setIsPinModalOpen(false);
    setUangDiterimaInput('');
    if (openBillContext?.tipeUtang) {
      setMetodeBayar('piutang');
    } else {
      setMetodeBayar('tunai');
    }

    // Fetch produk outlet untuk sinkronisasi diskon
    produkCloudService
      .getActiveProduk(currentOutlet.id, true)
      .then((prods) => {
        setOutletProdukMap(new Map(prods.map((p) => [p.id, p])));
      })
      .catch((err) => {
        console.warn('[CheckoutModal] Gagal memuat katalog produk:', err);
      });

    // Fetch daftar biaya lain aktif
    biayaLainCloudService
      .getActiveBiayaLain(currentOutlet.id, false)
      .then((list) => {
        setAvailableBiayaLain(list);
      })
      .catch((err) => {
        console.warn('[CheckoutModal] Gagal memuat biaya lain:', err);
      });
  }, [isOpen, currentOutlet?.id, openBillContext?.tipeUtang]);

  const safeItems = useMemo(() => {
    if (openBillContext?.itemsGabungan && openBillContext.itemsGabungan.length > 0) {
      return openBillContext.itemsGabungan;
    }
    return Array.isArray(items) ? items : [];
  }, [items, openBillContext?.itemsGabungan]);

  const ongkirBill = useMemo(() => {
    return openBillContext?.ongkir && openBillContext.ongkir > 0 ? openBillContext.ongkir : 0;
  }, [openBillContext?.ongkir]);

  // 1. Per item di keranjang: kalkulasi hargaUnitNeto dan diskonProdukNominal
  // PERBAIKAN 8: bila openBillContext aktif, gunakan it.hargaJual (snapshot harga saat order) sebagai hargaAsli,
  // JANGAN harga katalog terkini; diskon produk tetap diambil dari katalog terkini agar konsisten dengan ringkasan di layar detail bill.
  const calculatedItems = useMemo(() => {
    const isOpenBill = Boolean(openBillContext?.billIds && openBillContext.billIds.length > 0);

    return safeItems.map((it) => {
      const matched = it.produkId ? outletProdukMap.get(it.produkId) : undefined;
      const diskon = it.diskonProduk !== undefined ? it.diskonProduk : matched?.diskonProduk;
      const hargaAsli = isOpenBill
        ? it.hargaJual
        : (matched?.hargaJual && matched.hargaJual > 0 ? matched.hargaJual : it.hargaJual);
      const { hargaNeto, diskonNominal } = hitungHargaNeto(hargaAsli, diskon);
      const qty = it.qty || 1;

      return {
        ...it,
        hargaAsli,
        hargaUnitNeto: hargaNeto,
        diskonProdukNominal: diskonNominal,
        subtotalKotorItem: hargaAsli * qty,
        subtotalNetoItem: hargaNeto * qty,
      };
    });
  }, [safeItems, outletProdukMap, openBillContext]);

  // 2. Hitung subtotalKotor, diskonProdukTotal, dan subtotalNeto
  const subtotalKotor = useMemo(() => {
    return calculatedItems.reduce((acc, it) => acc + it.subtotalKotorItem, 0);
  }, [calculatedItems]);

  const diskonProdukTotal = useMemo(() => {
    return calculatedItems.reduce(
      (acc, it) => acc + it.diskonProdukNominal * (it.qty || 1),
      0
    );
  }, [calculatedItems]);

  const subtotalNeto = useMemo(() => {
    return Math.max(0, subtotalKotor - diskonProdukTotal);
  }, [subtotalKotor, diskonProdukTotal]);

  // 4. Kalkulasi nilai voucher diskon
  const voucherNilai = useMemo(() => {
    if (!appliedVoucher) return 0;
    if (appliedVoucher.tipe === 'persen') {
      return Math.round((appliedVoucher.nilai / 100) * subtotalNeto);
    }
    return Math.min(appliedVoucher.nilai, subtotalNeto);
  }, [appliedVoucher, subtotalNeto]);

  // 5. netoSetelahVoucher = subtotalNeto - voucherNilai
  const netoSetelahVoucher = useMemo(() => {
    return Math.max(0, subtotalNeto - voucherNilai);
  }, [subtotalNeto, voucherNilai]);

  // 6. Subtotal biaya lain aktif yang dipilih (default atau manual yang disetujui PIN Owner)
  const selectedBiayaBreakdown = useMemo(() => {
    return availableBiayaLain
      .filter((b) => selectedBiayaIds.has(b.id))
      .map((b) => {
        const manualData = manualBiayaMap[b.id];
        const isManual = Boolean(manualData);
        const defaultValue =
          typeof b.nilaiDefault === 'number'
            ? b.nilaiDefault
            : typeof b.nilai === 'number'
            ? b.nilai
            : 0;

        const nilaiDipakai = isManual ? manualData.manualNilai : defaultValue;
        const subtotal = hitungSubtotalBiaya(b, netoSetelahVoucher, nilaiDipakai);

        return {
          id: b.id,
          nama: b.nama,
          tipe: b.tipe,
          nilaiDefault: defaultValue,
          nilaiDipakai,
          nilai: nilaiDipakai,
          isManual,
          subtotal,
          approval: manualData?.approval,
        };
      });
  }, [availableBiayaLain, selectedBiayaIds, manualBiayaMap, netoSetelahVoucher]);

  const totalBiayaLain = useMemo(() => {
    return selectedBiayaBreakdown.reduce((acc, b) => acc + b.subtotal, 0);
  }, [selectedBiayaBreakdown]);

  // 7. TOTAL AKHIR = netoSetelahVoucher + Σ subtotalBiayaLain + ongkirBill (bulat rupiah)
  const totalAkhir = useMemo(() => {
    return Math.round(netoSetelahVoucher + totalBiayaLain + ongkirBill);
  }, [netoSetelahVoucher, totalBiayaLain, ongkirBill]);

  // 8. Perhitungan uang diterima & kembalian live berdasarkan TOTAL AKHIR
  const uangDiterimaNum = useMemo(() => {
    const parsed = parseFloat(uangDiterimaInput.replace(/[^0-9]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }, [uangDiterimaInput]);

  const kembalian = useMemo(() => {
    return Math.max(0, uangDiterimaNum - totalAkhir);
  }, [uangDiterimaNum, totalAkhir]);

  const isUangKurang = useMemo(() => {
    if (metodeBayar !== 'tunai') return false;
    if (!uangDiterimaInput.trim()) return true;
    return uangDiterimaNum < totalAkhir;
  }, [metodeBayar, uangDiterimaInput, uangDiterimaNum, totalAkhir]);

  // Shortcut nominal uang tunai cepat
  const quickCashOptions = useMemo(() => {
    const list = [totalAkhir];
    const rounded50k = Math.ceil(totalAkhir / 50000) * 50000;
    const rounded100k = Math.ceil(totalAkhir / 100000) * 100000;

    if (rounded50k > totalAkhir && !list.includes(rounded50k)) list.push(rounded50k);
    if (rounded100k > totalAkhir && !list.includes(rounded100k)) list.push(rounded100k);
    if (!list.includes(50000) && 50000 > totalAkhir) list.push(50000);
    if (!list.includes(100000) && 100000 > totalAkhir) list.push(100000);

    return list.sort((a, b) => a - b).slice(0, 4);
  }, [totalAkhir]);

  // Validasi & Terapkan Voucher
  const handleApplyVoucher = async () => {
    if (!currentOutlet?.id) return;
    const cleanKode = voucherInput.trim().toUpperCase();
    if (!cleanKode) {
      setVoucherError('Ketik kode voucher terlebih dahulu.');
      return;
    }

    setIsValidatingVoucher(true);
    setVoucherError(null);

    try {
      const res = await voucherCloudService.validateVoucherWithReason(
        currentOutlet.id,
        cleanKode,
        subtotalNeto
      );

      if (!res.valid || !res.voucher) {
        setVoucherError(res.error || 'Voucher tidak valid.');
        setAppliedVoucher(null);
      } else {
        setAppliedVoucher(res.voucher);
        setVoucherError(null);
      }
    } catch (err: unknown) {
      console.error('[CheckoutModal] Validasi voucher error:', err);
      setVoucherError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memeriksa voucher.'
      );
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherInput('');
    setVoucherError(null);
  };

  // Toggle Checkbox Biaya Lain
  const handleToggleBiaya = (biayaId: string) => {
    setSelectedBiayaIds((prev) => {
      const copy = new Set(prev);
      if (copy.has(biayaId)) {
        copy.delete(biayaId);
      } else {
        copy.add(biayaId);
      }
      return copy;
    });
  };

  // Buka modal PIN Owner untuk persetujuan biaya manual
  const handleOpenPinApproval = (biaya: BiayaLain) => {
    setBiayaForPinApproval(biaya);
    setIsPinModalOpen(true);
  };

  // Callback persetujuan PIN Owner sukses
  const handlePinApproved = (manualValue: number, approval: ApprovalBiayaManual) => {
    if (!biayaForPinApproval) return;
    setManualBiayaMap((prev) => ({
      ...prev,
      [biayaForPinApproval.id]: {
        manualNilai: manualValue,
        approval,
      },
    }));
    // Pastikan biaya otomatis dicentang/aktif
    setSelectedBiayaIds((prev) => {
      const copy = new Set(prev);
      copy.add(biayaForPinApproval.id);
      return copy;
    });
  };

  // Reset nilai biaya manual kembali ke nilai default
  const handleResetBiayaToDefault = (biayaId: string) => {
    setManualBiayaMap((prev) => {
      const copy = { ...prev };
      delete copy[biayaId];
      return copy;
    });
  };

  if (!isOpen) return null;

  // 9 & 10. Proses Checkout dan Simpan Transaksi
  const handleProsesCheckout = async () => {
    if (!currentOutlet?.id) {
      setSubmitError('Outlet aktif tidak ditemukan.');
      return;
    }

    if (calculatedItems.length === 0) {
      setSubmitError('Keranjang pesanan masih kosong.');
      return;
    }

    if (metodeBayar === 'tunai' && isUangKurang) {
      setSubmitError('Nominal uang diterima kurang dari total tagihan.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // 1. Ambil snapshot HPP menggunakan shared cache
      const hppCache: HppCalculationCache = {
        bahanMap: new Map(),
        produkMap: new Map(),
      };

      const itemSnapshots: ItemTransaksiSnapshot[] = await Promise.all(
        calculatedItems.map(async (it) => {
          let hppSatuan = 0;
          if (it.produkId) {
            try {
              const resHpp = await hppCloudService.hitungHppProduk(
                currentOutlet.id,
                it.produkId,
                hppCache
              );
              hppSatuan = resHpp.hpp || 0;
            } catch {
              hppSatuan = 0;
            }
          }

          return {
            produkId: it.produkId,
            nama: it.nama || 'Item',
            qty: it.qty || 1,
            hargaJual: it.hargaUnitNeto, // harga neto unit untuk kompatibilitas
            hargaAsli: it.hargaAsli, // audit harga asli sebelum diskon
            diskonProdukNominal: it.diskonProdukNominal, // audit nominal diskon promo per unit
            hargaUnitNeto: it.hargaUnitNeto, // audit harga neto
            hppSatuan,
            subtotal: it.subtotalNetoItem,
            catatan: it.catatan,
          };
        })
      );

      // 2. Susun payload pembayaran
      const uangDiterimaFinal = metodeBayar === 'tunai' ? uangDiterimaNum : totalAkhir;
      const kembalianFinal = metodeBayar === 'tunai' ? kembalian : 0;

      const baseBiayaList =
        selectedBiayaBreakdown.length > 0
          ? selectedBiayaBreakdown.map((b) => ({
              id: b.id,
              nama: b.nama,
              tipe: b.tipe,
              nilaiDefault: b.nilaiDefault,
              nilaiDipakai: b.nilaiDipakai,
              nilai: b.nilaiDipakai,
              isManual: b.isManual,
              subtotal: b.subtotal,
            }))
          : [];

      if (ongkirBill > 0) {
        baseBiayaList.push({
          id: 'ongkir-bill',
          nama: 'Ongkir (bill)',
          tipe: 'nominal',
          nilaiDefault: ongkirBill,
          nilaiDipakai: ongkirBill,
          nilai: ongkirBill,
          isManual: false,
          subtotal: ongkirBill,
        });
      }

      const finalizedBiayaLainList = baseBiayaList.length > 0 ? baseBiayaList : undefined;

      const manualApprovals = selectedBiayaBreakdown
        .filter((b) => b.isManual && b.approval)
        .map((b) => b.approval!);

      // 3. Simpan transaksi (online langsung atau queue IndexedDB saat offline)
      const resTrx = await transaksiCloudService.createTransaksi(
        currentOutlet.id,
        {
          items: itemSnapshots,
          total: totalAkhir, // TOTAL AKHIR
          metodeBayar,
          uangDiterima: uangDiterimaFinal,
          kembalian: kembalianFinal,
          openBillId:
            openBillContext?.billIds && openBillContext.billIds.length > 0
              ? openBillContext.billIds.join(',')
              : undefined,
          pelangganId: openBillContext?.pelangganId,
          pelangganNama: openBillContext?.pelangganNama,
          diskonProdukTotal: diskonProdukTotal > 0 ? diskonProdukTotal : undefined,
          voucherKode: appliedVoucher ? appliedVoucher.kode : undefined,
          voucherNilai: voucherNilai > 0 ? voucherNilai : undefined,
          biayaLainList: finalizedBiayaLainList,
          approvalBiayaManual: manualApprovals.length > 0 ? manualApprovals : undefined,
        },
        user?.id || 'kasir',
        user?.nama || 'Kasir'
      );

      const trxId = typeof resTrx === 'object' && resTrx ? resTrx.id : String(resTrx);
      const trxNomor =
        typeof resTrx === 'object' && resTrx?.nomorTransaksi
          ? resTrx.nomorTransaksi
          : `TRX-${Date.now().toString().slice(-6)}`;

      // 4. Tutup Open Bill jika berasal dari open bill context
      if (openBillContext?.billIds && openBillContext.billIds.length > 0) {
        try {
          await openBillCloudService.closeBills(
            currentOutlet.id,
            openBillContext.billIds,
            trxId,
            user?.id || 'kasir'
          );
        } catch (errClose) {
          console.warn('[CheckoutModal] Gagal menutup open bill terintegrasi:', errClose);
        }
      }

      // Objek transaksi lengkap untuk struk instan
      const completedTrx: Transaksi = {
        id: trxId,
        outletId: currentOutlet.id,
        nomorTransaksi: trxNomor,
        kasirId: user?.id || 'kasir',
        kasirNama: user?.nama || 'Kasir',
        items: itemSnapshots,
        total: totalAkhir,
        metodeBayar,
        uangDiterima: uangDiterimaFinal,
        kembalian: kembalianFinal,
        openBillId:
          openBillContext?.billIds && openBillContext.billIds.length > 0
            ? openBillContext.billIds.join(',')
            : undefined,
        pelangganId: openBillContext?.pelangganId,
        pelangganNama: openBillContext?.pelangganNama,
        diskonProdukTotal: diskonProdukTotal > 0 ? diskonProdukTotal : undefined,
        voucherKode: appliedVoucher ? appliedVoucher.kode : undefined,
        voucherNilai: voucherNilai > 0 ? voucherNilai : undefined,
        biayaLainList: finalizedBiayaLainList,
        approvalBiayaManual: manualApprovals.length > 0 ? manualApprovals : undefined,
        status: 'selesai',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncSource: navigator.onLine ? 'online' : 'queue',
        isDeleted: false,
        version: 1,
      };

      onSuccess(completedTrx, trxId);
    } catch (err: unknown) {
      console.error('[CheckoutModal] Gagal memproses transaksi:', err);
      setSubmitError(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses pembayaran.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-stone-900 leading-tight">
                Pembayaran Transaksi
              </h2>
              <p className="text-[11px] text-stone-500">{calculatedItems.length} item pesanan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Banner Total Akhir */}
          <div className="p-4 rounded-2xl bg-stone-900 text-white flex items-center justify-between shadow-xs">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-stone-400 font-bold block">
                Total Akhir
              </span>
              <span className="text-2xl font-black text-white">{formatRupiah(totalAkhir)}</span>
            </div>
            <div className="text-right text-xs text-stone-400">
              <span>{calculatedItems.reduce((acc, it) => acc + (it.qty || 0), 0)} porsi/item</span>
            </div>
          </div>

          {/* Rincian Bertingkat Biaya */}
          <div className="p-3.5 rounded-2xl border border-stone-200 bg-stone-50/70 space-y-2 text-xs">
            <div className="font-bold text-stone-700 text-[11px] uppercase tracking-wider mb-1">
              Rincian Perhitungan Tagihan
            </div>

            {/* Subtotal Kotor */}
            <div className="flex justify-between items-center text-stone-600">
              <span>Subtotal Kotor</span>
              <span className="font-mono font-semibold">{formatRupiah(subtotalKotor)}</span>
            </div>

            {/* Diskon Promo Produk */}
            {diskonProdukTotal > 0 && (
              <div className="flex justify-between items-center text-rose-600 font-medium">
                <span className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-rose-500" />
                  <span>Diskon promo produk</span>
                </span>
                <span className="font-mono font-bold">- {formatRupiah(diskonProdukTotal)}</span>
              </div>
            )}

            {/* Subtotal Neto */}
            <div className="flex justify-between items-center text-stone-900 font-bold pt-1 border-t border-stone-200/60">
              <span>Subtotal Neto</span>
              <span className="font-mono">{formatRupiah(subtotalNeto)}</span>
            </div>

            {/* Diskon Voucher */}
            {appliedVoucher && (
              <div className="flex justify-between items-center text-emerald-700 font-bold bg-emerald-50/80 px-2 py-1 rounded-lg">
                <span className="flex items-center gap-1.5">
                  <TicketPercent className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Voucher ({appliedVoucher.kode})</span>
                </span>
                <span className="font-mono">- {formatRupiah(voucherNilai)}</span>
              </div>
            )}

            {/* Rincian Biaya Lain */}
            {selectedBiayaBreakdown.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-stone-200/60 text-stone-700">
                {selectedBiayaBreakdown.map((b) => (
                  <div key={b.id} className="flex justify-between items-center">
                    <span>
                      {b.nama} {b.tipe === 'persen' ? `(${b.nilai}%)` : ''}
                    </span>
                    <span className="font-mono font-semibold text-stone-800">
                      + {formatRupiah(b.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Ongkir (bill) */}
            {ongkirBill > 0 && (
              <div className="flex justify-between items-center text-stone-700 pt-1 border-t border-stone-200/60">
                <span>Ongkir (bill)</span>
                <span className="font-mono font-semibold text-stone-800">
                  + {formatRupiah(ongkirBill)}
                </span>
              </div>
            )}

            {/* Total Akhir Rincian */}
            <div className="flex justify-between items-center text-stone-900 font-black text-sm pt-2 border-t-2 border-stone-300">
              <span>TOTAL AKHIR</span>
              <span className="font-mono text-orange-600">{formatRupiah(totalAkhir)}</span>
            </div>
          </div>

          {/* Section: Voucher Diskon */}
          <div className="p-3.5 rounded-2xl border border-stone-200 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                <TicketPercent className="w-4 h-4 text-orange-600" />
                <span>Gunakan Voucher Diskon</span>
              </label>
              {appliedVoucher && (
                <button
                  type="button"
                  onClick={handleRemoveVoucher}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Hapus Voucher</span>
                </button>
              )}
            </div>

            {appliedVoucher ? (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-emerald-600 text-white uppercase tracking-wider">
                    {appliedVoucher.kode}
                  </span>
                  <span className="text-xs font-bold text-emerald-900">
                    Hemat {formatRupiah(voucherNilai)} ({appliedVoucher.tipe === 'persen' ? `${appliedVoucher.nilai}%` : 'Nominal'})
                  </span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    disabled={isValidatingVoucher || isSubmitting}
                    value={voucherInput}
                    onChange={(e) => {
                      setVoucherInput(e.target.value.toUpperCase());
                      setVoucherError(null);
                    }}
                    placeholder="Masukkan kode voucher (misal: PROMO10)"
                    className="flex-1 px-3 py-2 rounded-xl text-xs sm:text-sm font-mono uppercase font-bold border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  />
                  <button
                    type="button"
                    disabled={isValidatingVoucher || isSubmitting || !voucherInput.trim()}
                    onClick={handleApplyVoucher}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isValidatingVoucher ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>Pakai</span>
                    )}
                  </button>
                </div>
                {voucherError && (
                  <p className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 animate-in fade-in">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{voucherError}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section: Biaya Tambahan Lainnya (Checkbox List + Opsi Manual PIN) */}
          {availableBiayaLain.length > 0 && (
            <div className="p-3.5 rounded-2xl border border-stone-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-700 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-orange-600" />
                  <span>Biaya Lain (Delivery, Service, dll)</span>
                </label>
                <span className="text-[10px] text-stone-400">
                  Ubah nilai biaya memerlukan PIN Owner
                </span>
              </div>

              <div className="space-y-2">
                {availableBiayaLain.map((biaya) => {
                  const isChecked = selectedBiayaIds.has(biaya.id);
                  const manualData = manualBiayaMap[biaya.id];
                  const isManual = Boolean(manualData);
                  const defaultValue =
                    typeof biaya.nilaiDefault === 'number'
                      ? biaya.nilaiDefault
                      : typeof biaya.nilai === 'number'
                      ? biaya.nilai
                      : 0;
                  const nilaiDipakai = isManual ? manualData.manualNilai : defaultValue;
                  const subtotalPreview = hitungSubtotalBiaya(biaya, netoSetelahVoucher, nilaiDipakai);

                  return (
                    <div
                      key={biaya.id}
                      className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition ${
                        isChecked
                          ? 'bg-orange-50/50 border-orange-300 shadow-2xs'
                          : 'bg-stone-50/70 border-stone-200 text-stone-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          id={`biaya-${biaya.id}`}
                          checked={isChecked}
                          onChange={() => handleToggleBiaya(biaya.id)}
                          className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-stone-300 shrink-0 cursor-pointer"
                        />
                        <label
                          htmlFor={`biaya-${biaya.id}`}
                          className="truncate cursor-pointer flex items-center gap-1.5"
                        >
                          <span className="font-bold text-stone-900">{biaya.nama}</span>
                          {isManual ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-700 text-[10px] font-bold border border-purple-200">
                              Manual: {biaya.tipe === 'persen' ? `${nilaiDipakai}%` : formatRupiah(nilaiDipakai)}
                            </span>
                          ) : (
                            <span className="text-[10px] text-stone-400 font-mono">
                              ({biaya.tipe === 'persen' ? `${nilaiDipakai}%` : formatRupiah(nilaiDipakai)})
                            </span>
                          )}
                        </label>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 pl-6 sm:pl-0">
                        <span className="font-mono font-bold text-stone-800 text-[11px]">
                          +{formatRupiah(subtotalPreview)}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenPinApproval(biaya)}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-stone-100 text-stone-700 font-bold text-[10px] border border-stone-300 shadow-2xs transition flex items-center gap-1"
                            title="Ubah nilai biaya (memerlukan PIN Owner)"
                          >
                            <ShieldCheck className="w-3 h-3 text-orange-600" />
                            <span>{isManual ? 'Ganti' : 'Ubah (PIN)'}</span>
                          </button>

                          {isManual && (
                            <button
                              type="button"
                              onClick={() => handleResetBiayaToDefault(biaya.id)}
                              className="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-[10px] border border-rose-200 transition"
                              title="Kembalikan ke nilai default"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Daftar Ringkas Item */}
          <div className="p-3 rounded-2xl border border-stone-200 bg-stone-50/60 max-h-36 overflow-y-auto space-y-1.5 text-xs">
            {calculatedItems.map((it, idx) => (
              <div key={idx} className="flex justify-between items-center text-stone-700">
                <div className="min-w-0 pr-2">
                  <div className="truncate font-medium">
                    {it.qty}x {it.nama}
                  </div>
                  {it.diskonProdukNominal > 0 && (
                    <div className="text-[10px] text-rose-600 font-medium">
                      Diskon promo {formatRupiah(it.diskonProdukNominal)}/unit (Asli {formatRupiah(it.hargaAsli)})
                    </div>
                  )}
                </div>
                <span className="font-semibold shrink-0 text-stone-900 font-mono">
                  {formatRupiah(it.subtotalNetoItem)}
                </span>
              </div>
            ))}
          </div>

          {/* Pilih Metode Pembayaran Segmented */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-stone-700">
                Pilih Metode Pembayaran
              </label>
              {openBillContext?.tipeUtang && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  Terkunci: Bill Tipe Utang
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                disabled={isSubmitting || Boolean(openBillContext?.tipeUtang)}
                onClick={() => setMetodeBayar('tunai')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition ${
                  metodeBayar === 'tunai'
                    ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                } ${openBillContext?.tipeUtang ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <Banknote className="w-5 h-5" />
                <span>Tunai</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || Boolean(openBillContext?.tipeUtang)}
                onClick={() => setMetodeBayar('qris')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition ${
                  metodeBayar === 'qris'
                    ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                } ${openBillContext?.tipeUtang ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <QrCode className="w-5 h-5" />
                <span>QRIS</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting || Boolean(openBillContext?.tipeUtang)}
                onClick={() => setMetodeBayar('transfer')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition ${
                  metodeBayar === 'transfer'
                    ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                } ${openBillContext?.tipeUtang ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                <CreditCard className="w-5 h-5" />
                <span>Transfer</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setMetodeBayar('piutang')}
                className={`py-3 px-2 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-bold transition ${
                  metodeBayar === 'piutang'
                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <UserCheck className="w-5 h-5" />
                <span>Piutang</span>
              </button>
            </div>
          </div>

          {/* Form Pembayaran Piutang */}
          {metodeBayar === 'piutang' && (
            <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-rose-800 font-extrabold">
                <UserCheck className="w-4 h-4 text-rose-600" />
                <span>Pencatatan Piutang / Kasbon Pelanggan</span>
              </div>
              <div className="p-3 bg-white rounded-xl border border-rose-100 space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Nama Pelanggan:</span>
                  <strong className="text-stone-900">
                    {openBillContext?.pelangganNama || 'Pelanggan Terdaftar'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Nominal Piutang:</span>
                  <strong className="text-rose-600">{formatRupiah(totalAkhir)}</strong>
                </div>
              </div>
              <p className="text-[11px] text-stone-500">
                Tagihan ini akan dicatat sebagai piutang terbuka untuk diselesaikan di masa mendatang.
              </p>
            </div>
          )}

          {/* Form Pembayaran Tunai */}
          {metodeBayar === 'tunai' && (
            <div className="p-4 rounded-2xl bg-orange-50/40 border border-orange-200/80 space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Uang Diterima (Rp) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={isSubmitting}
                  placeholder="0"
                  value={uangDiterimaInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setUangDiterimaInput(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                    isUangKurang && uangDiterimaInput.trim()
                      ? 'border-rose-300 bg-rose-50/30'
                      : 'border-stone-300'
                  }`}
                />

                {isUangKurang && uangDiterimaInput.trim() && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    Uang diterima kurang Rp{(totalAkhir - uangDiterimaNum).toLocaleString('id-ID')}
                  </p>
                )}
              </div>

              {/* Shortcut Uang Pas & Nominal Cepat */}
              <div>
                <span className="text-[11px] font-bold text-stone-500 block mb-1.5">
                  Pilihan Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUangDiterimaInput(totalAkhir.toLocaleString('id-ID'))}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-orange-600 text-white hover:bg-orange-700 transition"
                  >
                    Uang Pas ({formatRupiah(totalAkhir)})
                  </button>
                  {quickCashOptions.map((nominal) => {
                    if (nominal === totalAkhir) return null;
                    return (
                      <button
                        key={nominal}
                        type="button"
                        onClick={() => setUangDiterimaInput(nominal.toLocaleString('id-ID'))}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 transition"
                      >
                        {formatRupiah(nominal)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Display Kembalian */}
              <div className="pt-2 border-t border-orange-200/60 flex items-center justify-between">
                <span className="text-xs font-bold text-stone-600">Kembalian:</span>
                <span
                  className={`text-base font-black ${
                    kembalian > 0 ? 'text-emerald-700' : 'text-stone-700'
                  }`}
                >
                  {formatRupiah(kembalian)}
                </span>
              </div>
            </div>
          )}

          {/* Feedback Submit Error */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Footer Tombol Selesaikan Pembayaran */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-700 text-xs font-bold hover:bg-stone-50 transition"
          >
            Batal
          </button>

          <button
            type="button"
            disabled={isSubmitting || (metodeBayar === 'tunai' && isUangKurang)}
            onClick={handleProsesCheckout}
            className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Memproses Pembayaran...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Selesaikan & Cetak ({formatRupiah(totalAkhir)})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal Otorisasi PIN Owner untuk Perubahan Biaya Manual */}
      {isPinModalOpen && currentOutlet && (
        <PinOwnerApprovalModal
          isOpen={isPinModalOpen}
          onClose={() => {
            setIsPinModalOpen(false);
            setBiayaForPinApproval(null);
          }}
          outletId={currentOutlet.id}
          biaya={biayaForPinApproval}
          netoSetelahVoucher={netoSetelahVoucher}
          initialValue={
            biayaForPinApproval && manualBiayaMap[biayaForPinApproval.id]
              ? manualBiayaMap[biayaForPinApproval.id].manualNilai
              : undefined
          }
          currentKasir={{
            id: user?.id || 'kasir',
            nama: user?.nama || 'Kasir',
          }}
          onApproved={handlePinApproved}
        />
      )}
    </div>
  );
};

// Error Boundary wrapper agar CheckoutModal aman dari runtime error tak terduga
interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class CheckoutModal extends Component<CheckoutModalProps, ErrorBoundaryState> {
  constructor(props: CheckoutModalProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CheckoutModal ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (!this.props.isOpen) return null;
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <h3 className="text-sm font-bold text-stone-900">Gagal Membuka Kasir Checkout</h3>
            <p className="text-xs text-stone-500">{this.state.errorMessage}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                this.props.onClose();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-900 text-white font-bold text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      );
    }
    return <CheckoutModalContent {...this.props} />;
  }
}
