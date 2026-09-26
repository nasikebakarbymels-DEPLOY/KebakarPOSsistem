import { Pelanggan } from '../types';

const STORAGE_PREFIX = 'pos_fnb_pelanggan_outlet_';

export const pelangganService = {
  getPelangganByOutlet: async (outletId: string): Promise<Pelanggan[]> => {
    if (!outletId) return [];
    try {
      const data = localStorage.getItem(`${STORAGE_PREFIX}${outletId}`);
      if (!data) return [];
      const parsed: Pelanggan[] = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error(`Gagal membaca pelanggan untuk outlet ${outletId}:`, err);
      return [];
    }
  },

  createPelanggan: async (
    outletId: string,
    data: { nama: string; nomorHp?: string; catatan?: string }
  ): Promise<Pelanggan> => {
    if (!outletId) {
      throw new Error('Outlet ID wajib disertakan.');
    }

    const trimmedNama = (data.nama || '').trim();
    if (!trimmedNama) {
      throw new Error('Nama pelanggan wajib diisi.');
    }

    const currentList = await pelangganService.getPelangganByOutlet(outletId);

    // Cek keunikan nama per outlet
    const isDuplicate = currentList.some(
      (p) => p.nama.trim().toLowerCase() === trimmedNama.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`Pelanggan dengan nama "${trimmedNama}" sudah terdaftar di outlet ini.`);
    }

    const nowIso = new Date().toISOString();
    const newPelanggan: Pelanggan = {
      id: `plg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      outletId,
      nama: trimmedNama,
      nomorHp: data.nomorHp?.trim() || undefined,
      catatan: data.catatan?.trim() || undefined,
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedList = [newPelanggan, ...currentList];
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${outletId}`, JSON.stringify(updatedList));
    } catch (err) {
      console.error('Gagal menyimpan pelanggan:', err);
      throw new Error('Gagal menyimpan data pelanggan ke penyimpanan lokal.');
    }

    return newPelanggan;
  },
};
