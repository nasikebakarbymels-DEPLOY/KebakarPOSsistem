import { Bahan, KemasanBahan, SatuanDasar } from '../types';

const STORAGE_PREFIX = 'pos_fnb_bahan_outlet_';

function getStorageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

export const DEMO_EXAMPLE_BAHAN: Omit<Bahan, 'id' | 'outletId' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'version'>[] = [
  {
    nama: 'Kecap Manis',
    satuanDasar: 'ml',
    hargaPerSatuanDasar: 104,
    biayaTerbaru: 104,
    catatan: 'Kecap manis bumbu dasar olahan',
    kemasanList: [
      { id: 'kem-1', nama: 'Botol kecil', netto: 135, isi: 135, hargaPerKemasan: 14000, acuan: true },
      { id: 'kem-2', nama: 'Pouch', netto: 520, isi: 520, hargaPerKemasan: 45000, acuan: false },
    ],
  },
  {
    nama: 'Ayam',
    satuanDasar: 'gram',
    hargaPerSatuanDasar: 40,
    biayaTerbaru: 40,
    catatan: 'Daging ayam segar fillet / potong',
    kemasanList: [
      { id: 'kem-3', nama: '1 kg', netto: 1000, isi: 1000, hargaPerKemasan: 40000, acuan: true },
      { id: 'kem-4', nama: 'Potong', netto: 100, isi: 100, hargaPerKemasan: 4500, acuan: false },
    ],
  },
  {
    nama: 'Cup Minuman',
    satuanDasar: 'pcs',
    hargaPerSatuanDasar: 700,
    biayaTerbaru: 700,
    catatan: 'Cup plastik ukuran 16 oz + seal',
    kemasanList: [
      { id: 'kem-5', nama: 'Pack', netto: 50, isi: 50, hargaPerKemasan: 35000, acuan: true },
      { id: 'kem-6', nama: 'Renceng', netto: 100, isi: 100, hargaPerKemasan: 70000, acuan: false },
    ],
  },
];

export interface CreateBahanDTO {
  nama: string;
  satuanDasar: SatuanDasar;
  biayaTerbaru?: number;
  catatan?: string;
  kemasanList?: KemasanBahan[];
}

export interface UpdateBahanDTO {
  nama?: string;
  satuanDasar?: SatuanDasar;
  biayaTerbaru?: number;
  catatan?: string;
}

export const bahanService = {
  // Get all bahan for an outlet
  async getBahanByOutlet(outletId: string): Promise<Bahan[]> {
    if (!outletId) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(outletId));
      if (!raw) return [];
      const list: Bahan[] = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  // Seed 3 example bahan
  async seedExampleData(outletId: string): Promise<Bahan[]> {
    if (!outletId) throw new Error('Outlet ID wajib disertakan.');
    const now = new Date().toISOString();
    const existing = await this.getBahanByOutlet(outletId);

    const newItems: Bahan[] = [];
    for (const example of DEMO_EXAMPLE_BAHAN) {
      const isDuplicate = existing.some(
        (b) => b.nama.trim().toLowerCase() === example.nama.trim().toLowerCase()
      );
      if (!isDuplicate) {
        newItems.push({
          id: `bahan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          outletId,
          nama: example.nama,
          satuanDasar: example.satuanDasar,
          hargaPerSatuanDasar: example.hargaPerSatuanDasar || example.biayaTerbaru || 0,
          biayaAwal: example.biayaTerbaru,
          biayaTerbaru: example.biayaTerbaru,
          sumberBiayaInfo: 'Biaya acuan awal',
          catatan: example.catatan,
          kemasanList: example.kemasanList.map((k, idx) => ({
            ...k,
            id: `kem-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          })),
          isDeleted: false,
          version: 1,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const updated = [...existing, ...newItems];
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(updated));
    return updated;
  },

  // Create new bahan
  async createBahan(outletId: string, data: CreateBahanDTO): Promise<Bahan> {
    if (!outletId) throw new Error('Outlet ID tidak valid.');
    const trimmedNama = data.nama.trim();
    if (!trimmedNama) {
      throw new Error('Nama bahan wajib diisi.');
    }

    const existing = await this.getBahanByOutlet(outletId);
    const isDuplicate = existing.some(
      (b) => b.nama.trim().toLowerCase() === trimmedNama.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`Nama bahan "${trimmedNama}" sudah terdaftar di outlet ini.`);
    }

    const now = new Date().toISOString();
    const parsedBiaya =
      data.biayaTerbaru !== undefined && !isNaN(data.biayaTerbaru) && data.biayaTerbaru >= 0
        ? Number(data.biayaTerbaru)
        : undefined;

    const newBahan: Bahan = {
      id: `bahan-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      outletId,
      nama: trimmedNama,
      satuanDasar: data.satuanDasar,
      hargaPerSatuanDasar: parsedBiaya || 0,
      biayaAwal: parsedBiaya,
      biayaTerbaru: parsedBiaya,
      sumberBiayaInfo: parsedBiaya !== undefined ? 'Biaya acuan awal' : undefined,
      catatan: data.catatan?.trim() || undefined,
      kemasanList: data.kemasanList || [],
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [newBahan, ...existing];
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(updated));
    return newBahan;
  },

  // Update biaya terbaru from pembelian or rollback
  async updateBiayaTerbaruFromPembelian(
    outletId: string,
    bahanId: string,
    biayaTerbaru?: number,
    sumberBiayaInfo?: string
  ): Promise<Bahan | undefined> {
    const existing = await this.getBahanByOutlet(outletId);
    const targetIdx = existing.findIndex((b) => b.id === bahanId);
    if (targetIdx === -1) return undefined;

    existing[targetIdx].biayaTerbaru = biayaTerbaru;
    existing[targetIdx].sumberBiayaInfo = sumberBiayaInfo;
    existing[targetIdx].updatedAt = new Date().toISOString();

    localStorage.setItem(getStorageKey(outletId), JSON.stringify(existing));
    return existing[targetIdx];
  },

  // Update existing bahan
  async updateBahan(outletId: string, bahanId: string, data: UpdateBahanDTO): Promise<Bahan> {
    const existing = await this.getBahanByOutlet(outletId);
    const targetIdx = existing.findIndex((b) => b.id === bahanId);
    if (targetIdx === -1) {
      throw new Error('Data bahan tidak ditemukan.');
    }

    if (data.nama) {
      const trimmed = data.nama.trim();
      const isDuplicate = existing.some(
        (b) => b.id !== bahanId && b.nama.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`Nama bahan "${trimmed}" sudah digunakan bahan lain di outlet ini.`);
      }
    }

    const current = existing[targetIdx];
    const isBiayaValid =
      data.biayaTerbaru !== undefined && !isNaN(data.biayaTerbaru) && data.biayaTerbaru >= 0;
    const newBiayaTerbaru = isBiayaValid
      ? Number(data.biayaTerbaru)
      : data.biayaTerbaru === undefined
      ? current.biayaTerbaru
      : undefined;

    const updatedBahan: Bahan = {
      ...current,
      nama: data.nama !== undefined ? data.nama.trim() : current.nama,
      satuanDasar: data.satuanDasar !== undefined ? data.satuanDasar : current.satuanDasar,
      biayaAwal: isBiayaValid ? newBiayaTerbaru : current.biayaAwal,
      biayaTerbaru: newBiayaTerbaru,
      sumberBiayaInfo: isBiayaValid ? 'Biaya acuan manual' : current.sumberBiayaInfo,
      catatan: data.catatan !== undefined ? data.catatan.trim() : current.catatan,
      updatedAt: new Date().toISOString(),
    };

    existing[targetIdx] = updatedBahan;
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(existing));
    return updatedBahan;
  },

  // Delete bahan (checks if used by recipes in later phases)
  async deleteBahan(outletId: string, bahanId: string): Promise<void> {
    const existing = await this.getBahanByOutlet(outletId);
    const target = existing.find((b) => b.id === bahanId);
    if (!target) {
      throw new Error('Bahan tidak ditemukan.');
    }

    // Safety check for recipes in future phases
    // If a recipe store exists in localStorage and references this bahan, we can guard it:
    try {
      const recipesRaw = localStorage.getItem(`pos_fnb_resep_outlet_${outletId}`);
      if (recipesRaw) {
        const recipes = JSON.parse(recipesRaw);
        const isUsed = Array.isArray(recipes) && recipes.some((r: any) =>
          r.items?.some((item: any) => item.bahanId === bahanId)
        );
        if (isUsed) {
          throw new Error(`Bahan "${target.nama}" tidak dapat dihapus karena sedang digunakan dalam resep produk.`);
        }
      }
    } catch (err: any) {
      if (err.message.includes('karena sedang digunakan')) throw err;
    }

    const filtered = existing.filter((b) => b.id !== bahanId);
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(filtered));
  },

  // Add kemasan to bahan
  async addKemasan(
    outletId: string,
    bahanId: string,
    kemasan: { nama: string; netto: number }
  ): Promise<KemasanBahan> {
    const trimmedNama = kemasan.nama.trim();
    if (!trimmedNama) {
      throw new Error('Nama kemasan wajib diisi.');
    }
    if (!kemasan.netto || kemasan.netto <= 0) {
      throw new Error('Netto kemasan harus lebih besar dari 0.');
    }

    const existing = await this.getBahanByOutlet(outletId);
    const target = existing.find((b) => b.id === bahanId);
    if (!target) {
      throw new Error('Bahan tidak ditemukan.');
    }

    const newKemasan: KemasanBahan = {
      id: `kem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      nama: trimmedNama,
      netto: Number(kemasan.netto),
    };

    target.kemasanList = [...(target.kemasanList || []), newKemasan];
    target.updatedAt = new Date().toISOString();

    localStorage.setItem(getStorageKey(outletId), JSON.stringify(existing));
    return newKemasan;
  },

  // Update kemasan
  async updateKemasan(
    outletId: string,
    bahanId: string,
    kemasanId: string,
    data: { nama: string; netto: number }
  ): Promise<KemasanBahan> {
    const trimmedNama = data.nama.trim();
    if (!trimmedNama) {
      throw new Error('Nama kemasan wajib diisi.');
    }
    if (!data.netto || data.netto <= 0) {
      throw new Error('Netto kemasan harus lebih besar dari 0.');
    }

    const existing = await this.getBahanByOutlet(outletId);
    const target = existing.find((b) => b.id === bahanId);
    if (!target) {
      throw new Error('Bahan tidak ditemukan.');
    }

    const kemasanIndex = (target.kemasanList || []).findIndex((k) => k.id === kemasanId);
    if (kemasanIndex === -1) {
      throw new Error('Kemasan tidak ditemukan.');
    }

    const updatedKemasan: KemasanBahan = {
      id: kemasanId,
      nama: trimmedNama,
      netto: Number(data.netto),
    };

    target.kemasanList[kemasanIndex] = updatedKemasan;
    target.updatedAt = new Date().toISOString();

    localStorage.setItem(getStorageKey(outletId), JSON.stringify(existing));
    return updatedKemasan;
  },

  // Delete kemasan
  async deleteKemasan(outletId: string, bahanId: string, kemasanId: string): Promise<void> {
    const existing = await this.getBahanByOutlet(outletId);
    const target = existing.find((b) => b.id === bahanId);
    if (!target) {
      throw new Error('Bahan tidak ditemukan.');
    }

    target.kemasanList = (target.kemasanList || []).filter((k) => k.id !== kemasanId);
    target.updatedAt = new Date().toISOString();

    localStorage.setItem(getStorageKey(outletId), JSON.stringify(existing));
  },
};
