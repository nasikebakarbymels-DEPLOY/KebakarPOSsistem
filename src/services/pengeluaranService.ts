import { Pengeluaran, MetodePengeluaran } from '../types';

const STORAGE_PREFIX = 'pos_fnb_pengeluaran_outlet_';

function getStorageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

export const KATEGORI_PENGELUARAN_PRESET = [
  'Sewa',
  'Listrik',
  'Air',
  'Gaji',
  'Marketing',
  'Kemasan',
  'Lain-lain',
] as const;

export interface CreatePengeluaranDTO {
  tanggal: string; // YYYY-MM-DD
  kategori: string;
  nominal: number;
  metode: MetodePengeluaran;
  catatan?: string;
}

export const pengeluaranService = {
  // Ambil semua pengeluaran per outlet (urut tanggal desc, createdAt desc)
  getPengeluaranByOutlet: async (outletId: string): Promise<Pengeluaran[]> => {
    if (!outletId) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(outletId));
      if (!raw) return [];
      const list: Pengeluaran[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];
      return list.sort((a, b) => {
        const dateCompare = b.tanggal.localeCompare(a.tanggal);
        if (dateCompare !== 0) return dateCompare;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
    } catch (err) {
      console.error(`Gagal membaca pengeluaran outlet ${outletId}:`, err);
      return [];
    }
  },

  // Tambah pengeluaran baru
  createPengeluaran: async (
    outletId: string,
    payload: CreatePengeluaranDTO
  ): Promise<Pengeluaran> => {
    if (!outletId) {
      throw new Error('Outlet ID tidak valid.');
    }

    const tanggal = (payload.tanggal || '').trim();
    if (!tanggal) {
      throw new Error('Tanggal pengeluaran wajib diisi.');
    }

    const kategori = (payload.kategori || '').trim();
    if (!kategori) {
      throw new Error('Kategori pengeluaran wajib dipilih atau diisi.');
    }

    const nominal = Number(payload.nominal);
    if (isNaN(nominal) || nominal <= 0) {
      throw new Error('Nominal pengeluaran harus lebih besar dari 0.');
    }

    const metode = payload.metode;
    if (!['tunai', 'transfer', 'hutang'].includes(metode)) {
      throw new Error('Metode pengeluaran tidak valid.');
    }

    const list = await pengeluaranService.getPengeluaranByOutlet(outletId);
    const nowIso = new Date().toISOString();

    const newDoc: Pengeluaran = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      outletId,
      tanggal,
      kategori,
      nominal: Math.round(nominal),
      metode,
      catatan: payload.catatan?.trim() || undefined,
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedList = [newDoc, ...list];
    try {
      localStorage.setItem(getStorageKey(outletId), JSON.stringify(updatedList));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pos_fnb_pengeluaran_updated', { detail: { outletId } })
        );
      }
    } catch (err) {
      console.error('Gagal menyimpan pengeluaran:', err);
      throw new Error('Gagal menyimpan pengeluaran ke penyimpanan lokal.');
    }

    return newDoc;
  },

  // Perbarui pengeluaran
  updatePengeluaran: async (
    outletId: string,
    id: string,
    payload: Partial<CreatePengeluaranDTO>
  ): Promise<Pengeluaran> => {
    if (!outletId || !id) {
      throw new Error('Parameter update pengeluaran tidak valid.');
    }

    const list = await pengeluaranService.getPengeluaranByOutlet(outletId);
    const index = list.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error('Data pengeluaran tidak ditemukan.');
    }

    const current = list[index];

    let tanggal = current.tanggal;
    if (payload.tanggal !== undefined) {
      const t = payload.tanggal.trim();
      if (!t) throw new Error('Tanggal pengeluaran wajib diisi.');
      tanggal = t;
    }

    let kategori = current.kategori;
    if (payload.kategori !== undefined) {
      const k = payload.kategori.trim();
      if (!k) throw new Error('Kategori pengeluaran wajib dipilih atau diisi.');
      kategori = k;
    }

    let nominal = current.nominal;
    if (payload.nominal !== undefined) {
      const n = Number(payload.nominal);
      if (isNaN(n) || n <= 0) {
        throw new Error('Nominal pengeluaran harus lebih besar dari 0.');
      }
      nominal = Math.round(n);
    }

    let metode = current.metode;
    if (payload.metode !== undefined) {
      if (!['tunai', 'transfer', 'hutang'].includes(payload.metode)) {
        throw new Error('Metode pengeluaran tidak valid.');
      }
      metode = payload.metode;
    }

    const nowIso = new Date().toISOString();
    const updatedDoc: Pengeluaran = {
      ...current,
      tanggal,
      kategori,
      nominal,
      metode,
      catatan:
        payload.catatan !== undefined
          ? payload.catatan.trim() || undefined
          : current.catatan,
      updatedAt: nowIso,
    };

    list[index] = updatedDoc;

    try {
      localStorage.setItem(getStorageKey(outletId), JSON.stringify(list));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pos_fnb_pengeluaran_updated', { detail: { outletId } })
        );
      }
    } catch (err) {
      console.error('Gagal memperbarui pengeluaran:', err);
      throw new Error('Gagal memperbarui pengeluaran.');
    }

    return updatedDoc;
  },

  // Hapus pengeluaran
  deletePengeluaran: async (outletId: string, id: string): Promise<boolean> => {
    if (!outletId || !id) return false;
    const list = await pengeluaranService.getPengeluaranByOutlet(outletId);
    const filtered = list.filter((item) => item.id !== id);

    try {
      localStorage.setItem(getStorageKey(outletId), JSON.stringify(filtered));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pos_fnb_pengeluaran_updated', { detail: { outletId } })
        );
      }
      return true;
    } catch (err) {
      console.error('Gagal menghapus pengeluaran:', err);
      throw new Error('Gagal menghapus data pengeluaran.');
    }
  },
};
