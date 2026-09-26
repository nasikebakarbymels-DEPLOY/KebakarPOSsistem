import { OpenBill, DrafKeranjang } from '../types';

const STORAGE_PREFIX = 'pos_fnb_openbill_outlet_';

function getStorageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

export interface CreateOpenBillPayload {
  label: string;
  draf: DrafKeranjang;
  kasirId: string;
  kasirNama: string;
}

export const openBillService = {
  // Ambil semua open bill per outlet (terurut updatedAt descending)
  getOpenBillByOutlet: async (outletId: string): Promise<OpenBill[]> => {
    if (!outletId) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(outletId));
      if (!raw) return [];
      const list: OpenBill[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.sort(
        (a, b) => new Date(String(b.updatedAt)).getTime() - new Date(String(a.updatedAt)).getTime()
      );
    } catch (err) {
      console.error(`Gagal membaca open bill outlet ${outletId}:`, err);
      return [];
    }
  },

  // Ambil single open bill berdasarkan ID
  getOpenBillById: async (outletId: string, id: string): Promise<OpenBill | null> => {
    const list = await openBillService.getOpenBillByOutlet(outletId);
    return list.find((b) => b.id === id) || null;
  },

  // Buat open bill baru dari draf keranjang
  createOpenBill: async (
    outletId: string,
    payload: CreateOpenBillPayload
  ): Promise<OpenBill> => {
    if (!outletId) {
      throw new Error('Outlet ID tidak valid.');
    }

    const trimmedLabel = (payload.label || '').trim();
    if (!trimmedLabel) {
      throw new Error('Label pesanan (nomor meja atau nama pelanggan) wajib diisi.');
    }

    if (!payload.draf.items || payload.draf.items.length === 0) {
      throw new Error('Keranjang pesanan masih kosong, tidak dapat membuat open bill.');
    }

    const list = await openBillService.getOpenBillByOutlet(outletId);

    // Validasi duplikasi label open bill (case-insensitive & trim)
    const existingBill = list.find(
      (b) => b.label.trim().toLowerCase() === trimmedLabel.toLowerCase()
    );
    if (existingBill) {
      throw new Error(
        `Label "${trimmedLabel}" sudah memiliki open bill aktif. Gunakan label lain atau selesaikan bill sebelumnya.`
      );
    }

    const nowIso = new Date().toISOString();

    const newBill: OpenBill = {
      id: `bill-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      outletId,
      label: trimmedLabel,
      tipe: 'dine_in',
      meta: {},
      orders: [],
      status: 'open',
      openedAt: nowIso,
      draf: JSON.parse(JSON.stringify(payload.draf)), // Salin utuh draf
      kasirId: payload.kasirId,
      kasirNama: payload.kasirNama,
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedList = [newBill, ...list];
    try {
      localStorage.setItem(getStorageKey(outletId), JSON.stringify(updatedList));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId } })
        );
      }
    } catch (err) {
      console.error('Gagal menyimpan open bill:', err);
      throw new Error('Gagal menyimpan open bill ke penyimpanan lokal.');
    }

    return newBill;
  },

  // Hapus open bill
  deleteOpenBill: async (outletId: string, id: string): Promise<boolean> => {
    if (!outletId || !id) return false;
    const list = await openBillService.getOpenBillByOutlet(outletId);
    const filtered = list.filter((b) => b.id !== id);

    try {
      localStorage.setItem(getStorageKey(outletId), JSON.stringify(filtered));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pos_fnb_openbill_updated', { detail: { outletId } })
        );
      }
      return true;
    } catch (err) {
      console.error('Gagal menghapus open bill:', err);
      throw new Error('Gagal menghapus open bill.');
    }
  },
};
