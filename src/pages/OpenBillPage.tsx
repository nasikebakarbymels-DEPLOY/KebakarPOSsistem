import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Layers,
  Search,
  Plus,
  Clock,
  User,
  Utensils,
  ShoppingBag,
  Bike,
  CalendarClock,
  UserCheck,
  PartyPopper,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  FolderPlus,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { OpenBill, TipeOpenBill, Transaksi } from '../types';
import { openBillCloudService } from '../services/cloud/openBillCloudService';
import { formatRupiah, formatDateTimeIndo } from '../utils/formatters';
import { BukaBillModal } from '../components/openBill/BukaBillModal';
import {
  OpenBillDetailModal,
  OpenBillCheckoutContext,
} from '../components/openBill/OpenBillDetailModal';
import { CheckoutModal } from '../components/pos/CheckoutModal';
import { StrukModal } from '../components/pos/StrukModal';

interface OpenBillPageProps {
  onNavigateToKasir: () => void;
}

type TipeFilter = 'semua' | TipeOpenBill;

const TIPE_TABS: Array<{ id: TipeFilter; label: string; icon?: React.ComponentType<{ className?: string }> }> = [
  { id: 'semua', label: 'Semua' },
  { id: 'dine_in', label: 'Dine-In', icon: Utensils },
  { id: 'takeaway', label: 'Takeaway', icon: ShoppingBag },
  { id: 'delivery', label: 'Delivery', icon: Bike },
  { id: 'pre_order', label: 'Pre-Order', icon: CalendarClock },
  { id: 'utang', label: 'Utang', icon: UserCheck },
  { id: 'katering', label: 'Katering', icon: PartyPopper },
];

export const OpenBillPage: React.FC<OpenBillPageProps> = ({ onNavigateToKasir }) => {
  const { currentOutlet, user } = useAuth();

  const [openBills, setOpenBills] = useState<OpenBill[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter & Search
  const [activeTipe, setActiveTipe] = useState<TipeFilter>('semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isBukaModalOpen, setIsBukaModalOpen] = useState<boolean>(false);
  const [selectedBillForDetail, setSelectedBillForDetail] = useState<OpenBill | null>(null);

  // Group Modal (Gabung / Pisah Grup)
  const [groupTargetBill, setGroupTargetBill] = useState<OpenBill | null>(null);
  const [newGroupIdInput, setNewGroupIdInput] = useState<string>('');
  const [isSubmittingGroup, setIsSubmittingGroup] = useState<boolean>(false);

  // Checkout Modal Integration
  const [checkoutContext, setCheckoutContext] = useState<OpenBillCheckoutContext | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [completedTrx, setCompletedTrx] = useState<Transaksi | null>(null);

  // Toast
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(
    null
  );

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ text, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load Realtime Data dari Firestore
  const loadData = useCallback(() => {
    if (!currentOutlet?.id) return;
    setLoading(true);
    setErrorMessage(null);

    const unsubscribe = openBillCloudService.subscribeActiveOpenBills(
      currentOutlet.id,
      (bills) => {
        setOpenBills(bills);
        setLoading(false);
        // Sinkronisasi bill detail yang sedang terbuka jika ada
        setSelectedBillForDetail((prev) => {
          if (!prev) return null;
          return bills.find((b) => b.id === prev.id) || null;
        });
      },
      (err) => {
        console.error('[OpenBillPage] Gagal melacak open bills:', err);
        setErrorMessage('Gagal memuat daftar open bill dari database.');
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [currentOutlet?.id]);

  useEffect(() => {
    const unsub = loadData();
    return () => {
      if (unsub) unsub();
    };
  }, [loadData]);

  // Filter & Search computation
  const filteredBills = useMemo(() => {
    return openBills.filter((bill) => {
      // 1. Tipe
      if (activeTipe !== 'semua' && bill.tipe !== activeTipe) {
        return false;
      }
      // 2. Search label / nomorMeja / pelanggan
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchLabel = bill.label.toLowerCase().includes(query);
        const matchMeja = bill.meta.nomorMeja?.toLowerCase().includes(query);
        const matchPlg = bill.meta.pelangganNama?.toLowerCase().includes(query);
        const matchGroup = bill.groupId?.toLowerCase().includes(query);
        return matchLabel || matchMeja || matchPlg || matchGroup;
      }
      return true;
    });
  }, [openBills, activeTipe, searchQuery]);

  // Daftar grup yang sudah ada untuk saran
  const existingGroupIds = useMemo(() => {
    const setGroups = new Set<string>();
    openBills.forEach((b) => {
      if (b.groupId?.trim()) setGroups.add(b.groupId.trim());
    });
    return Array.from(setGroups);
  }, [openBills]);

  // Helper kalkulasi bill card
  const getBillSummary = (bill: OpenBill) => {
    let totalItems = 0;
    let subtotal = 0;

    (bill.orders || []).forEach((ord) => {
      (ord.items || []).forEach((it) => {
        totalItems += it.qty;
        subtotal += it.hargaJual * it.qty;
      });
    });

    const isOld = Date.now() - new Date(bill.openedAt).getTime() > 24 * 3600 * 1000;

    return { totalItems, subtotal, isOld };
  };

  const getTipeBadge = (tipe: TipeOpenBill) => {
    switch (tipe) {
      case 'dine_in':
        return { label: 'Dine-In', icon: Utensils, color: 'bg-amber-100 text-amber-800' };
      case 'takeaway':
        return { label: 'Takeaway', icon: ShoppingBag, color: 'bg-orange-100 text-orange-800' };
      case 'delivery':
        return { label: 'Delivery', icon: Bike, color: 'bg-blue-100 text-blue-800' };
      case 'pre_order':
        return { label: 'Pre-Order', icon: CalendarClock, color: 'bg-purple-100 text-purple-800' };
      case 'utang':
        return { label: 'Utang', icon: UserCheck, color: 'bg-rose-100 text-rose-800' };
      case 'katering':
        return { label: 'Katering', icon: PartyPopper, color: 'bg-emerald-100 text-emerald-800' };
    }
  };

  // Handler Buka Modal Gabung / Pisah Grup
  const handleOpenGroupModal = (bill: OpenBill, e: React.MouseEvent) => {
    e.stopPropagation();
    setGroupTargetBill(bill);
    setNewGroupIdInput(bill.groupId || '');
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id || !groupTargetBill) return;

    try {
      setIsSubmittingGroup(true);
      await openBillCloudService.setGroupBills(
        currentOutlet.id,
        [groupTargetBill.id],
        newGroupIdInput.trim() || undefined,
        user?.id || 'kasir'
      );

      showToast(
        newGroupIdInput.trim()
          ? `Bill berhasil dimasukkan ke grup "${newGroupIdInput.trim()}".`
          : 'Bill berhasil dipisahkan dari grup.',
        'success'
      );
      setGroupTargetBill(null);
    } catch (err: unknown) {
      console.error('Gagal memperbarui grup bill:', err);
      showToast('Gagal mengubah grup bill.', 'error');
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  // Handler Checkout dari Detail Modal
  const handleStartCheckoutFromDetail = (context: OpenBillCheckoutContext) => {
    setCheckoutContext(context);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = async (transaksi: Transaksi) => {
    if (currentOutlet?.id && checkoutContext?.billIds && checkoutContext.billIds.length > 0) {
      try {
        await openBillCloudService.closeBills(
          currentOutlet.id,
          checkoutContext.billIds,
          transaksi.id,
          user?.id || 'kasir'
        );
      } catch (errClose) {
        console.warn('[OpenBillPage] Gagal menutup open bill terintegrasi:', errClose);
      }
    }
    setIsCheckoutOpen(false);
    setCheckoutContext(null);
    setSelectedBillForDetail(null);
    setCompletedTrx(transaksi);
    showToast('Transaksi berhasil diselesaikan & open bill ditutup.', 'success');
  };

  return (
    <div className="p-4 sm:p-6 pb-28 space-y-4 max-w-5xl mx-auto">
      {/* Toast Notifikasi */}
      {toast && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between border shadow-sm animate-in fade-in ${
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

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight flex items-center gap-2">
            <span>Open Bill & Antrean Meja</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-700">
              {openBills.length} Aktif
            </span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Kelola pesanan gantung fleksibel untuk 6 tipe pesanan dengan rute dapur otomatis.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsBukaModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.99] text-white font-extrabold text-xs shadow-md transition flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>+ Buka Bill Baru</span>
        </button>
      </div>

      {/* Search Bar & Tipe Filter Segmented */}
      <div className="space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nama bill, nomor meja, pelanggan, atau grup..."
            className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-stone-200 bg-white text-xs font-medium placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-500 shadow-2xs"
          />
        </div>

        {/* Segmented Filter Tipe */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {TIPE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTipe === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTipe(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-stone-900 text-white shadow-xs'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error Panel */}
      {errorMessage && (
        <div className="p-4 rounded-3xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-800 font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Coba Lagi</span>
          </button>
        </div>
      )}

      {/* Skeleton Loading State */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-4 rounded-3xl bg-white border border-stone-200 shadow-xs space-y-3 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <div className="w-24 h-4 bg-stone-200 rounded-lg"></div>
                <div className="w-16 h-4 bg-stone-200 rounded-lg"></div>
              </div>
              <div className="w-36 h-6 bg-stone-200 rounded-lg"></div>
              <div className="w-full h-8 bg-stone-100 rounded-xl"></div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredBills.length === 0 && (
        <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-stone-200 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-stone-900 text-sm">
              Tidak Ada Open Bill Aktif
            </h3>
            <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
              {searchQuery || activeTipe !== 'semua'
                ? 'Tidak ada open bill yang sesuai dengan filter atau kata kunci pencarian.'
                : 'Belum ada pesanan yang digantung. Buat open bill baru untuk menampung pesanan pelanggan.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsBukaModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buka Bill Baru</span>
          </button>
        </div>
      )}

      {/* Grid Card Bill Aktif */}
      {!loading && filteredBills.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBills.map((bill) => {
            const { totalItems, subtotal, isOld } = getBillSummary(bill);
            const badge = getTipeBadge(bill.tipe);
            const BadgeIcon = badge.icon;

            return (
              <div
                key={bill.id}
                onClick={() => setSelectedBillForDetail(bill)}
                className={`p-4 rounded-3xl bg-white border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden group ${
                  isOld
                    ? 'border-red-300 ring-1 ring-red-400/40 bg-red-50/10'
                    : 'border-stone-200 hover:border-orange-300'
                }`}
              >
                {/* Header Card */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${badge.color}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>

                    {/* Badge Umur > 24 Jam */}
                    {isOld && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-red-100 text-red-700 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        <span>&gt; 24 Jam</span>
                      </span>
                    )}

                    {/* Badge Grup bila ada */}
                    {bill.groupId && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5" />
                        <span>{bill.groupId}</span>
                      </span>
                    )}
                  </div>

                  {/* Label Utama Bill */}
                  <h3 className="font-black text-stone-900 text-base leading-tight group-hover:text-orange-600 transition">
                    {bill.label}
                  </h3>

                  {/* Info Meta Ringkas */}
                  <div className="text-[11px] text-stone-500 mt-1 line-clamp-1">
                    {bill.meta.nomorMeja && <span>Meja {bill.meta.nomorMeja} • </span>}
                    {bill.meta.pelangganNama && <span>{bill.meta.pelangganNama} • </span>}
                    {bill.meta.tanggalAmbil && <span>Ambil {bill.meta.tanggalAmbil} • </span>}
                    {bill.meta.tanggalAcara && <span>Acara {bill.meta.tanggalAcara} ({bill.meta.jumlahPorsi} pax) • </span>}
                    <span className="font-mono">{formatDateTimeIndo(bill.openedAt)}</span>
                  </div>
                </div>

                {/* Subtotal & Orders Info */}
                <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-stone-400 font-bold block uppercase">
                      Subtotal ({totalItems} item)
                    </span>
                    <span className="font-black text-stone-900 text-sm">
                      {formatRupiah(subtotal + (bill.meta.ongkir || 0))}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 block font-bold uppercase">
                      Orders Masuk
                    </span>
                    <span className="font-extrabold text-orange-600">
                      {bill.orders?.length || 0} Tiket
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-1 flex items-center justify-between gap-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={(e) => handleOpenGroupModal(bill, e)}
                    className="px-2.5 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-[11px] font-bold text-stone-600 flex items-center gap-1 transition"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-stone-400" />
                    <span>{bill.groupId ? 'Atur Grup' : 'Gabung Grup'}</span>
                  </button>

                  <div className="flex items-center gap-1 text-xs font-bold text-orange-600 group-hover:translate-x-0.5 transition">
                    <span>Lihat Detail</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (Mobile) */}
      <div className="fixed bottom-20 right-4 sm:hidden z-30">
        <button
          type="button"
          onClick={() => setIsBukaModalOpen(true)}
          className="w-14 h-14 rounded-full bg-orange-600 text-white shadow-xl shadow-orange-600/40 flex items-center justify-center active:scale-95 transition"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Modal Buka Bill Baru */}
      {isBukaModalOpen && (
        <BukaBillModal
          isOpen={isBukaModalOpen}
          onClose={() => setIsBukaModalOpen(false)}
          onCreated={(newBill) => {
            setSelectedBillForDetail(newBill);
            showToast(`Bill "${newBill.label}" berhasil dibuka.`, 'success');
          }}
        />
      )}

      {/* Modal Detail Open Bill */}
      {selectedBillForDetail && (
        <OpenBillDetailModal
          isOpen={Boolean(selectedBillForDetail)}
          onClose={() => setSelectedBillForDetail(null)}
          bill={selectedBillForDetail}
          onRefreshBill={(updated) => setSelectedBillForDetail(updated)}
          onCheckout={handleStartCheckoutFromDetail}
          onBillCancelled={() => {
            setSelectedBillForDetail(null);
            loadData();
          }}
        />
      )}

      {/* Modal Gabungkan / Pisahkan Grup Bill */}
      {groupTargetBill && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleSaveGroup}
            className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-stone-900">
                  Pengelompokan Bill Rombongan
                </h3>
                <p className="text-[11px] text-stone-500">Bill: {groupTargetBill.label}</p>
              </div>
            </div>

            <p className="text-xs text-stone-600">
              Bill dengan ID grup yang sama akan disatukan keranjangnya saat melakukan pembayaran.
            </p>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                Nama / ID Grup
              </label>
              <input
                type="text"
                value={newGroupIdInput}
                onChange={(e) => setNewGroupIdInput(e.target.value)}
                placeholder="Misal: ROMBONGAN-A (Kosongkan untuk pisah)"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-bold uppercase focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {existingGroupIds.length > 0 && (
              <div>
                <span className="text-[10px] font-bold text-stone-400 block mb-1">
                  Pilih Grup Aktif yang Tersedia:
                </span>
                <div className="flex flex-wrap gap-1">
                  {existingGroupIds.map((grp) => (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => setNewGroupIdInput(grp)}
                      className="px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-purple-100 text-stone-700 text-[10px] font-semibold transition"
                    >
                      {grp}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setGroupTargetBill(null)}
                className="flex-1 py-2 rounded-xl border border-stone-200 text-xs font-bold text-stone-600 hover:bg-stone-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingGroup}
                className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-xs transition disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {isSubmittingGroup ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <span>Simpan Grup</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Integrasi Checkout Fase 6 */}
      {isCheckoutOpen && checkoutContext && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => {
            setIsCheckoutOpen(false);
            setCheckoutContext(null);
          }}
          items={checkoutContext.itemsGabungan}
          total={checkoutContext.itemsGabungan.reduce((a, b) => a + b.subtotal, 0)}
          openBillContext={checkoutContext}
          onSuccess={handleCheckoutSuccess}
        />
      )}

      {/* Struk Instan Sukses */}
      {completedTrx && (
        <StrukModal
          isOpen={Boolean(completedTrx)}
          onClose={() => setCompletedTrx(null)}
          transaksi={completedTrx}
        />
      )}
    </div>
  );
};
