import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  OpenBill,
  TipeOpenBill,
  OpenBillMeta,
  OrderBill,
  ItemOrderBill,
  KoreksiItemOrder,
} from '../../types';
import { sanitizePayload } from './cloudUtils';
import { pinOwnerCloudService } from './pinOwnerCloudService';

export interface CreateOpenBillInput {
  label: string;
  tipe: TipeOpenBill;
  meta: OpenBillMeta;
  initialItems?: ItemOrderBill[];
  groupId?: string;
}

export const openBillCloudService = {
  /**
   * 1. createOpenBill
   * Validasi label >= 2 karakter dan field meta wajib sesuai tipe:
   * - dine_in: nomorMeja
   * - delivery: alamat
   * - pre_order: tanggalAmbil
   * - utang: pelangganId
   * - katering: tanggalAcara + jumlahPorsi
   */
  async createOpenBill(
    outletId: string,
    input: CreateOpenBillInput,
    uid: string,
    kasirNama: string
  ): Promise<OpenBill> {
    if (!outletId) throw new Error('Outlet ID wajib diisi.');

    const trimmedLabel = (input.label || '').trim();
    if (trimmedLabel.length < 2) {
      throw new Error('Label open bill minimal 2 karakter.');
    }

    const meta = input.meta || {};

    // Validasi meta wajib sesuai tipe pesanan
    if (input.tipe === 'dine_in') {
      if (!meta.nomorMeja?.trim()) {
        throw new Error('Nomor meja wajib diisi untuk pesanan Dine-in.');
      }
    } else if (input.tipe === 'delivery') {
      if (!meta.alamat?.trim()) {
        throw new Error('Alamat pengiriman wajib diisi untuk pesanan Delivery.');
      }
    } else if (input.tipe === 'pre_order') {
      if (!meta.tanggalAmbil?.trim()) {
        throw new Error('Tanggal ambil wajib diisi untuk Pre-Order.');
      }
    } else if (input.tipe === 'utang') {
      if (!meta.pelangganId?.trim()) {
        throw new Error('Pelanggan wajib dipilih untuk transaksi Utang/Piutang.');
      }
    } else if (input.tipe === 'katering') {
      if (!meta.tanggalAcara?.trim()) {
        throw new Error('Tanggal acara wajib diisi untuk pesanan Katering.');
      }
      if (!meta.jumlahPorsi || Number(meta.jumlahPorsi) <= 0) {
        throw new Error('Jumlah porsi wajib lebih dari 0 untuk pesanan Katering.');
      }
    }

    const id = `bill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const initialOrders: OrderBill[] = [];
    if (input.initialItems && input.initialItems.length > 0) {
      initialOrders.push({
        id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        waktu: nowIso,
        items: input.initialItems,
        sudahDicetakDapur: false,
      });
    }

    const newBill: OpenBill = {
      id,
      outletId,
      label: trimmedLabel,
      tipe: input.tipe,
      meta: {
        nomorMeja: meta.nomorMeja?.trim(),
        alamat: meta.alamat?.trim(),
        patokan: meta.patokan?.trim(),
        ongkir: meta.ongkir !== undefined ? Number(meta.ongkir) : undefined,
        tanggalAmbil: meta.tanggalAmbil?.trim(),
        pelangganId: meta.pelangganId?.trim(),
        pelangganNama: meta.pelangganNama?.trim(),
        tanggalAcara: meta.tanggalAcara?.trim(),
        jumlahPorsi: meta.jumlahPorsi !== undefined ? Number(meta.jumlahPorsi) : undefined,
      },
      orders: initialOrders,
      status: 'open',
      groupId: input.groupId?.trim() || undefined,
      kasirId: uid,
      kasirNama: kasirNama || 'Kasir',
      openedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
      isDeleted: false,
      version: 1,
    };

    const docRef = doc(db, 'outlets', outletId, 'openBills', id);
    const sanitized = sanitizePayload(newBill as unknown as Record<string, unknown>);
    await setDoc(docRef, sanitized);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId, billId: id } })
      );
    }

    return newBill;
  },

  /**
   * 2. getActiveOpenBills
   * Query status open, urutkan openedAt desc
   */
  async getActiveOpenBills(outletId: string): Promise<OpenBill[]> {
    if (!outletId) return [];

    try {
      const colRef = collection(db, 'outlets', outletId, 'openBills');
      const q = query(
        colRef,
        where('status', '==', 'open'),
        orderBy('openedAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as OpenBill);
    } catch (err) {
      console.warn('[openBillCloudService] Query with orderBy failed, fallback to client sort:', err);
      // Fallback query tanpa orderBy jika index belum selesai
      const colRef = collection(db, 'outlets', outletId, 'openBills');
      const qFallback = query(colRef, where('status', '==', 'open'));
      const snap = await getDocs(qFallback);
      const list = snap.docs.map((d) => d.data() as OpenBill);
      return list.sort(
        (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
      );
    }
  },

  /**
   * Subscribe Real-time untuk open bills aktif
   */
  subscribeActiveOpenBills(
    outletId: string,
    onSuccess: (bills: OpenBill[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!outletId) {
      onSuccess([]);
      return () => {};
    }

    const colRef = collection(db, 'outlets', outletId, 'openBills');
    const q = query(colRef, where('status', '==', 'open'));

    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as OpenBill);
        list.sort(
          (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
        );
        onSuccess(list);
      },
      (err) => {
        console.error('[openBillCloudService] Real-time error:', err);
        onError?.(err);
      }
    );
  },

  /**
   * 3. getOpenBillById
   */
  async getOpenBillById(outletId: string, billId: string): Promise<OpenBill | null> {
    if (!outletId || !billId) return null;
    const docRef = doc(db, 'outlets', outletId, 'openBills', billId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as OpenBill;
  },

  /**
   * getBillsByGroup
   * Ambil semua bill dalam group yang sama
   */
  async getBillsByGroup(outletId: string, groupId: string): Promise<OpenBill[]> {
    if (!outletId || !groupId) return [];
    const colRef = collection(db, 'outlets', outletId, 'openBills');
    const q = query(
      colRef,
      where('groupId', '==', groupId),
      where('status', '==', 'open')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as OpenBill);
  },

  /**
   * 4. addOrder
   * Push OrderBill baru dengan sudahDicetakDapur flag secara atomik menggunakan arrayUnion
   */
  async addOrder(
    outletId: string,
    billId: string,
    items: ItemOrderBill[],
    uid: string,
    sudahDicetakDapur: boolean = false
  ): Promise<OrderBill> {
    if (!items || items.length === 0) {
      throw new Error('Pesanan order tidak boleh kosong.');
    }

    const bill = await this.getOpenBillById(outletId, billId);
    if (!bill) throw new Error('Open bill tidak ditemukan.');
    if (bill.status !== 'open') throw new Error('Open bill sudah tidak aktif.');

    const newOrder: OrderBill = {
      id: `ord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      waktu: new Date().toISOString(),
      items,
      sudahDicetakDapur,
    };

    const docRef = doc(db, 'outlets', outletId, 'openBills', billId);
    const sanitizedOrder = sanitizePayload(newOrder as unknown as Record<string, unknown>);
    await updateDoc(docRef, {
      orders: arrayUnion(sanitizedOrder),
      updatedAt: new Date().toISOString(),
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId, billId } })
      );
    }

    return newOrder;
  },

  /**
   * Tandai status order sudah dicetak dapur setelah bukti cetak sukses
   */
  async markOrderPrinted(
    outletId: string,
    billId: string,
    orderId: string
  ): Promise<void> {
    await this.setOrderDicetakDapur(outletId, billId, orderId, true);
  },

  /**
   * Tandai status order sudah dicetak dapur
   */
  async setOrderDicetakDapur(
    outletId: string,
    billId: string,
    orderId: string,
    sudahDicetak: boolean = true
  ): Promise<void> {
    const bill = await this.getOpenBillById(outletId, billId);
    if (!bill) return;

    const updatedOrders = (bill.orders || []).map((ord) => {
      if (ord.id === orderId) {
        return { ...ord, sudahDicetakDapur: sudahDicetak };
      }
      return ord;
    });

    const docRef = doc(db, 'outlets', outletId, 'openBills', billId);
    const sanitized = sanitizePayload({
      orders: updatedOrders,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(docRef, sanitized);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId, billId } })
      );
    }
  },

  /**
   * 5. updateItemQty
   * Wajib alasanKoreksi tidak kosong bila order sudah dicetak dapur.
   * Simpan riwayat koreksi pada order: { waktu, dari, ke, alasan, oleh }
   */
  async updateItemQty(
    outletId: string,
    billId: string,
    orderId: string,
    itemIndex: number,
    qtyBaru: number,
    alasanKoreksi: string,
    uid: string
  ): Promise<{ order: OrderBill; koreksi: KoreksiItemOrder | null }> {
    const bill = await this.getOpenBillById(outletId, billId);
    if (!bill) throw new Error('Open bill tidak ditemukan.');
    if (bill.status !== 'open') throw new Error('Open bill sudah ditutup atau dibatalkan.');

    const targetOrderIndex = (bill.orders || []).findIndex((o) => o.id === orderId);
    if (targetOrderIndex === -1) throw new Error('Order tidak ditemukan pada open bill ini.');

    const order = bill.orders[targetOrderIndex];
    const targetItem = order.items[itemIndex];
    if (!targetItem) throw new Error('Item tidak ditemukan pada order ini.');

    const oldQty = targetItem.qty;
    if (oldQty === qtyBaru) {
      return { order, koreksi: null };
    }

    // Validasi alasan koreksi jika sudah pernah dicetak dapur
    let koreksiData: KoreksiItemOrder | null = null;
    if (order.sudahDicetakDapur) {
      const trimmedAlasan = (alasanKoreksi || '').trim();
      if (!trimmedAlasan) {
        throw new Error('Alasan koreksi wajib diisi karena tiket dapur sudah dicetak.');
      }
      koreksiData = {
        waktu: new Date().toISOString(),
        dari: oldQty,
        ke: qtyBaru,
        alasan: trimmedAlasan,
        oleh: uid,
      };
    }

    // Perbarui array items dalam order
    let updatedItems = [...order.items];
    if (qtyBaru <= 0) {
      // Hapus item dari order
      updatedItems.splice(itemIndex, 1);
    } else {
      updatedItems[itemIndex] = {
        ...targetItem,
        qty: qtyBaru,
      };
    }

    const updatedOrder: OrderBill = {
      ...order,
      items: updatedItems,
      koreksi: koreksiData
        ? [...(order.koreksi || []), koreksiData]
        : order.koreksi,
    };

    const updatedOrders = [...bill.orders];
    updatedOrders[targetOrderIndex] = updatedOrder;

    const docRef = doc(db, 'outlets', outletId, 'openBills', billId);
    const sanitized = sanitizePayload({
      orders: updatedOrders,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(docRef, sanitized);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId, billId } })
      );
    }

    return { order: updatedOrder, koreksi: koreksiData };
  },

  /**
   * 6. closeBills
   * Set status closed + closedAt + transaksiId untuk semua bill dalam array
   */
  async closeBills(
    outletId: string,
    billIds: string[],
    transaksiId: string,
    uid?: string
  ): Promise<void> {
    if (!outletId || !Array.isArray(billIds) || billIds.length === 0) return;

    const nowIso = new Date().toISOString();

    for (const bId of billIds) {
      try {
        const docRef = doc(db, 'outlets', outletId, 'openBills', bId);
        const payload = sanitizePayload({
          status: 'closed',
          transaksiId,
          closedAt: nowIso,
          updatedAt: nowIso,
          closedBy: uid || 'kasir',
        });
        await updateDoc(docRef, payload);
      } catch (err) {
        console.error(`[openBillCloudService] Gagal menutup bill ${bId}:`, err);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId, closedIds: billIds } })
      );
    }
  },

  /**
   * 7. cancelBill
   * Verifikasi PIN Owner sebelum membatalkan bill (wajib di tingkat service).
   * Set status cancelled + alasanBatal
   */
  async cancelBill(
    outletId: string,
    billId: string,
    alasan: string,
    uid: string,
    pinOwner: string
  ): Promise<void> {
    if (!outletId || !billId) throw new Error('ID open bill tidak valid.');

    const trimmedAlasan = (alasan || '').trim();
    if (!trimmedAlasan) {
      throw new Error('Alasan pembatalan bill wajib disertakan.');
    }

    const cleanPin = (pinOwner || '').trim();
    if (!cleanPin) {
      throw new Error('PIN Owner wajib diisi untuk membatalkan open bill.');
    }

    // Verifikasi PIN Owner sebelum menulis status cancelled
    const verifyResult = await pinOwnerCloudService.verifyPinOwner(outletId, cleanPin);
    if (!verifyResult.hasPinConfigured) {
      throw new Error('PIN Owner belum diatur pada outlet ini.');
    }
    if (!verifyResult.valid) {
      throw new Error(verifyResult.message || 'PIN Owner salah.');
    }

    const docRef = doc(db, 'outlets', outletId, 'openBills', billId);
    const nowIso = new Date().toISOString();
    const payload = sanitizePayload({
      status: 'cancelled',
      alasanBatal: trimmedAlasan,
      closedAt: nowIso,
      updatedAt: nowIso,
      cancelledBy: uid,
    });
    await updateDoc(docRef, payload);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId, billId } })
      );
    }
  },

  /**
   * 8. setGroupBills
   * Tulis groupId sama ke semua bill
   */
  async setGroupBills(
    outletId: string,
    billIds: string[],
    groupId: string | undefined,
    uid: string
  ): Promise<void> {
    if (!outletId || !Array.isArray(billIds) || billIds.length === 0) return;

    const nowIso = new Date().toISOString();
    const cleanGroupId = groupId?.trim() || null;

    for (const bId of billIds) {
      const docRef = doc(db, 'outlets', outletId, 'openBills', bId);
      const payload: Record<string, unknown> = {
        updatedAt: nowIso,
        updatedBy: uid,
      };
      if (cleanGroupId) {
        payload.groupId = cleanGroupId;
      } else {
        // Hapus grup
        payload.groupId = null;
      }
      await updateDoc(docRef, sanitizePayload(payload));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId, groupIds: billIds } })
      );
    }
  },
};
