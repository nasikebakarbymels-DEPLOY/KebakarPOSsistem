import { Produk, Resep, ItemResep, KategoriProduk, JenisProduk } from '../types';
import { resepService } from './resepService';
import { bahanService } from './bahanService';

const STORAGE_PREFIX = 'pos_fnb_produk_outlet_';

function getStorageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

export interface CreateProdukDTO {
  nama: string;
  sku?: string;
  kategori: KategoriProduk;
  hargaJual: number;
  jenis: JenisProduk;
  aktif?: boolean;
  catatan?: string;
}

export interface UpdateProdukDTO {
  nama?: string;
  sku?: string;
  kategori?: KategoriProduk;
  hargaJual?: number;
  jenis?: JenisProduk;
  aktif?: boolean;
  catatan?: string;
}

export const produkService = {
  // Get all products for an outlet
  async getProdukByOutlet(outletId: string): Promise<Produk[]> {
    if (!outletId) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(outletId));
      if (!raw) return [];
      const list: Produk[] = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  // Create new product + save recipe
  async createProduk(
    outletId: string,
    data: CreateProdukDTO,
    itemsResep: ItemResep[] = []
  ): Promise<{ produk: Produk; resep: Resep }> {
    if (!outletId) throw new Error('Outlet ID tidak valid.');
    const trimmedNama = data.nama.trim();
    if (!trimmedNama) {
      throw new Error('Nama produk wajib diisi.');
    }

    if (data.hargaJual === undefined || isNaN(data.hargaJual) || data.hargaJual <= 0) {
      throw new Error('Harga jual wajib lebih dari 0.');
    }

    // Name uniqueness per outlet
    const existing = await this.getProdukByOutlet(outletId);
    const isDuplicate = existing.some(
      (p) => p.nama.trim().toLowerCase() === trimmedNama.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`Nama produk "${trimmedNama}" sudah terdaftar di outlet ini.`);
    }

    // Validate recipe cycle and max 3 levels
    const allResep = await resepService.getResepByOutlet(outletId);
    const validation = resepService.validateResepStructure(undefined, itemsResep, allResep);
    if (!validation.valid) {
      throw new Error(validation.error || 'Struktur resep tidak valid.');
    }

    const now = new Date().toISOString();
    const newProduk: Produk = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      outletId,
      nama: trimmedNama,
      sku: data.sku?.trim() || undefined,
      kategori: data.kategori,
      hargaJual: Number(data.hargaJual),
      jenis: data.jenis,
      aktif: data.aktif !== undefined ? data.aktif : true,
      resepItems: itemsResep.map((i) => ({
        ...i,
        jumlah: i.jumlah !== undefined ? i.jumlah : (i.qty || 0),
        satuan: i.satuan || 'pcs',
      })),
      catatan: data.catatan?.trim() || undefined,
      isDeleted: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };

    const updatedProdukList = [newProduk, ...existing];
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(updatedProdukList));

    // Save recipe
    const savedResep = await resepService.saveResep(outletId, newProduk.id, itemsResep);

    return { produk: newProduk, resep: savedResep };
  },

  // Update product + optionally update recipe
  async updateProduk(
    outletId: string,
    produkId: string,
    data: UpdateProdukDTO,
    itemsResep?: ItemResep[]
  ): Promise<{ produk: Produk; resep?: Resep }> {
    const existing = await this.getProdukByOutlet(outletId);
    const targetIdx = existing.findIndex((p) => p.id === produkId);
    if (targetIdx === -1) {
      throw new Error('Produk tidak ditemukan.');
    }

    const current = existing[targetIdx];

    // Name uniqueness check if changed
    if (data.nama !== undefined) {
      const trimmedNama = data.nama.trim();
      if (!trimmedNama) throw new Error('Nama produk wajib diisi.');
      const isDuplicate = existing.some(
        (p) => p.id !== produkId && p.nama.trim().toLowerCase() === trimmedNama.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`Nama produk "${trimmedNama}" sudah terdaftar di outlet ini.`);
      }
    }

    if (data.hargaJual !== undefined && (isNaN(data.hargaJual) || data.hargaJual <= 0)) {
      throw new Error('Harga jual wajib lebih dari 0.');
    }

    // If updating recipe, validate cycle and max 3 levels
    let savedResep: Resep | undefined;
    if (itemsResep !== undefined) {
      const allResep = await resepService.getResepByOutlet(outletId);
      const validation = resepService.validateResepStructure(produkId, itemsResep, allResep);
      if (!validation.valid) {
        throw new Error(validation.error || 'Struktur resep tidak valid.');
      }
      savedResep = await resepService.saveResep(outletId, produkId, itemsResep);
    }

    const updatedProduk: Produk = {
      ...current,
      nama: data.nama !== undefined ? data.nama.trim() : current.nama,
      sku: data.sku !== undefined ? data.sku.trim() || undefined : current.sku,
      kategori: data.kategori !== undefined ? data.kategori : current.kategori,
      hargaJual: data.hargaJual !== undefined ? Number(data.hargaJual) : current.hargaJual,
      jenis: data.jenis !== undefined ? data.jenis : current.jenis,
      aktif: data.aktif !== undefined ? data.aktif : current.aktif,
      catatan: data.catatan !== undefined ? data.catatan.trim() || undefined : current.catatan,
      updatedAt: new Date().toISOString(),
    };

    existing[targetIdx] = updatedProduk;
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(existing));

    return { produk: updatedProduk, resep: savedResep };
  },

  // Toggle active status
  async toggleStatusProduk(outletId: string, produkId: string): Promise<Produk> {
    const existing = await this.getProdukByOutlet(outletId);
    const targetIdx = existing.findIndex((p) => p.id === produkId);
    if (targetIdx === -1) throw new Error('Produk tidak ditemukan.');

    existing[targetIdx].aktif = !existing[targetIdx].aktif;
    existing[targetIdx].updatedAt = new Date().toISOString();
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(existing));

    return existing[targetIdx];
  },

  // Delete product with usage guard
  async deleteProduk(outletId: string, produkId: string): Promise<void> {
    const existing = await this.getProdukByOutlet(outletId);
    const target = existing.find((p) => p.id === produkId);
    if (!target) throw new Error('Produk tidak ditemukan.');

    // Check if used as component in another product's recipe
    const usageCheck = await resepService.checkProductUsedInRecipes(outletId, produkId, existing);
    if (usageCheck.isUsed) {
      throw new Error(
        `Produk "${target.nama}" tidak dapat dihapus karena sedang digunakan sebagai komponen dalam resep "${usageCheck.usedByProdukNama}". Hapus atau ganti komponen tersebut terlebih dahulu.`
      );
    }

    // Delete product and its recipe
    const filtered = existing.filter((p) => p.id !== produkId);
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(filtered));
    await resepService.deleteResep(outletId, produkId);
  },

  // Seed example data (Espresso as component + Kopi Susu Gula Aren as menu_jual)
  async seedExampleData(
    outletId: string
  ): Promise<{ produkList: Produk[]; resepList: Resep[] }> {
    if (!outletId) throw new Error('Outlet ID tidak valid.');

    // 1. Ensure required example ingredients exist
    let allBahan = await bahanService.getBahanByOutlet(outletId);

    let kopi = allBahan.find((b) => b.nama.trim().toLowerCase() === 'kopi');
    if (!kopi) {
      kopi = await bahanService.createBahan(outletId, {
        nama: 'Kopi',
        satuanDasar: 'gram',
        biayaTerbaru: 300,
        catatan: 'Biji kopi blend arabika robusta',
        kemasanList: [{ id: `kem-${Date.now()}-1`, nama: 'Pack 1 kg', netto: 1000 }],
      });
    }

    let air = allBahan.find((b) => b.nama.trim().toLowerCase() === 'air');
    if (!air) {
      air = await bahanService.createBahan(outletId, {
        nama: 'Air Mineral',
        satuanDasar: 'ml',
        biayaTerbaru: 5,
        catatan: 'Air mineral galon filtrasi',
        kemasanList: [{ id: `kem-${Date.now()}-2`, nama: 'Galon 19 L', netto: 19000 }],
      });
    }

    let susu = allBahan.find((b) => b.nama.trim().toLowerCase() === 'susu');
    if (!susu) {
      susu = await bahanService.createBahan(outletId, {
        nama: 'Susu Fresh Milk',
        satuanDasar: 'ml',
        biayaTerbaru: 22,
        catatan: 'Susu sapi pasteurisasi cair',
        kemasanList: [{ id: `kem-${Date.now()}-3`, nama: 'Tetra Pack 1 L', netto: 1000 }],
      });
    }

    let gulaAren = allBahan.find((b) => b.nama.trim().toLowerCase().includes('gula aren'));
    if (!gulaAren) {
      gulaAren = await bahanService.createBahan(outletId, {
        nama: 'Gula Aren Cair',
        satuanDasar: 'gram',
        biayaTerbaru: 40,
        catatan: 'Sirup gula aren organik',
        kemasanList: [{ id: `kem-${Date.now()}-4`, nama: 'Botol 1 kg', netto: 1000 }],
      });
    }

    // 2. Create component "Espresso"
    const espressoItems: ItemResep[] = [
      {
        id: `it-${Date.now()}-1`,
        tipe: 'bahan',
        bahanId: kopi.id,
        qty: 18,
        satuan: kopi.satuanDasar,
        namaSnapshot: kopi.nama,
      },
      {
        id: `it-${Date.now()}-2`,
        tipe: 'bahan',
        bahanId: air.id,
        qty: 30,
        satuan: air.satuanDasar,
        namaSnapshot: air.nama,
      },
    ];

    const { produk: espressoProd, resep: espressoResep } = await this.createProduk(
      outletId,
      {
        nama: 'Espresso',
        sku: 'CMP-ESP-01',
        kategori: 'Minuman',
        jenis: 'komponen',
        hargaJual: 10000,
        aktif: true,
        catatan: 'Single shot espresso 30ml untuk campuran minuman',
      },
      espressoItems
    );

    // 3. Create menu_jual "Kopi Susu Gula Aren"
    const kopiSusuItems: ItemResep[] = [
      {
        id: `it-${Date.now()}-3`,
        tipe: 'komponen',
        produkId: espressoProd.id,
        qty: 1,
        satuan: 'pcs',
        namaSnapshot: espressoProd.nama,
      },
      {
        id: `it-${Date.now()}-4`,
        tipe: 'bahan',
        bahanId: susu.id,
        qty: 120,
        satuan: susu.satuanDasar,
        namaSnapshot: susu.nama,
      },
      {
        id: `it-${Date.now()}-5`,
        tipe: 'bahan',
        bahanId: gulaAren.id,
        qty: 20,
        satuan: gulaAren.satuanDasar,
        namaSnapshot: gulaAren.nama,
      },
    ];

    const { produk: kopiSusuProd, resep: kopiSusuResep } = await this.createProduk(
      outletId,
      {
        nama: 'Kopi Susu Gula Aren',
        sku: 'MNU-KSG-01',
        kategori: 'Minuman',
        jenis: 'menu_jual',
        hargaJual: 24000,
        aktif: true,
        catatan: 'Signature iced coffee with palm sugar and fresh milk',
      },
      kopiSusuItems
    );

    const allProduk = await this.getProdukByOutlet(outletId);
    const allResep = await resepService.getResepByOutlet(outletId);

    return { produkList: allProduk, resepList: allResep };
  },
};
