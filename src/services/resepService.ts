import { Resep, ItemResep, ItemResepDetail, KalkulasiHPP, Produk, Bahan } from '../types';

const STORAGE_PREFIX = 'pos_fnb_resep_outlet_';

function getStorageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

export const resepService = {
  // Get all recipes for an outlet
  async getResepByOutlet(outletId: string): Promise<Resep[]> {
    if (!outletId) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(outletId));
      if (!raw) return [];
      const list: Resep[] = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  },

  // Get recipe for a specific product
  async getResepByProduk(outletId: string, produkId: string): Promise<Resep | null> {
    const list = await this.getResepByOutlet(outletId);
    return list.find((r) => r.produkId === produkId) || null;
  },

  // Save (create or update) recipe for a product
  async saveResep(outletId: string, produkId: string, items: ItemResep[]): Promise<Resep> {
    if (!outletId) throw new Error('Outlet ID tidak valid.');
    if (!produkId) throw new Error('Produk ID tidak valid.');

    const list = await this.getResepByOutlet(outletId);

    // Benteng terakhir: validasi struktur resep sebelum menulis ke localStorage
    const otherResep = list.filter((r) => r.produkId !== produkId);
    const validation = this.validateResepStructure(produkId, items, otherResep);
    if (!validation.valid) {
      throw new Error(validation.error || 'Struktur resep tidak valid.');
    }

    const now = new Date().toISOString();

    const existingIdx = list.findIndex((r) => r.produkId === produkId);

    const resepDoc: Resep = {
      id: existingIdx !== -1 ? list[existingIdx].id : `resep-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      outletId,
      produkId,
      items: items.map((it) => ({
        ...it,
        id: it.id || `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      })),
      isDeleted: false,
      version: 1,
      createdAt: existingIdx !== -1 ? list[existingIdx].createdAt : now,
      updatedAt: now,
    };

    if (existingIdx !== -1) {
      list[existingIdx] = resepDoc;
    } else {
      list.push(resepDoc);
    }

    localStorage.setItem(getStorageKey(outletId), JSON.stringify(list));
    return resepDoc;
  },

  // Delete recipe for a product
  async deleteResep(outletId: string, produkId: string): Promise<void> {
    const list = await this.getResepByOutlet(outletId);
    const filtered = list.filter((r) => r.produkId !== produkId);
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(filtered));
  },

  // Check if a product is used as a component in any other product's recipe
  async checkProductUsedInRecipes(
    outletId: string,
    produkId: string,
    allProduk: Produk[]
  ): Promise<{ isUsed: boolean; usedByProdukNama?: string }> {
    const allResep = await this.getResepByOutlet(outletId);
    for (const r of allResep) {
      if (r.produkId === produkId) continue;
      const match = r.items.find((it) => it.tipe === 'komponen' && it.produkId === produkId);
      if (match) {
        const parentProd = allProduk.find((p) => p.id === r.produkId);
        return {
          isUsed: true,
          usedByProdukNama: parentProd?.nama || r.produkId,
        };
      }
    }
    return { isUsed: false };
  },

  // Calculate maximum tree depth of a component recipe (1 if direct ingredients only)
  calculateMaxDepth(
    produkId: string,
    allResep: Resep[],
    visited = new Set<string>()
  ): { depth: number; hasCycle: boolean } {
    if (visited.has(produkId)) {
      return { depth: 0, hasCycle: true };
    }

    const resep = allResep.find((r) => r.produkId === produkId);
    if (!resep || resep.items.length === 0) {
      return { depth: 1, hasCycle: false };
    }

    let maxChildDepth = 0;
    const newVisited = new Set(visited).add(produkId);

    for (const item of resep.items) {
      if (item.tipe === 'komponen' && item.produkId) {
        const childResult = this.calculateMaxDepth(item.produkId, allResep, newVisited);
        if (childResult.hasCycle) {
          return { depth: 0, hasCycle: true };
        }
        if (childResult.depth > maxChildDepth) {
          maxChildDepth = childResult.depth;
        }
      }
    }

    return { depth: 1 + maxChildDepth, hasCycle: false };
  },

  // Validate if adding a list of items to currentProdukId would exceed 3 levels or cause cycles
  validateResepStructure(
    currentProdukId: string | undefined,
    items: ItemResep[],
    allResep: Resep[]
  ): { valid: boolean; error?: string } {
    const visited = new Set<string>();
    if (currentProdukId) visited.add(currentProdukId);

    for (const item of items) {
      if (item.tipe === 'komponen' && item.produkId) {
        if (currentProdukId && item.produkId === currentProdukId) {
          return {
            valid: false,
            error: `Komponen "${item.namaSnapshot}" tidak boleh memilih dirinya sendiri (siklus).`,
          };
        }

        const depthInfo = this.calculateMaxDepth(item.produkId, allResep, visited);
        if (depthInfo.hasCycle) {
          return {
            valid: false,
            error: `Terdeteksi siklus resep pada komponen "${item.namaSnapshot}". Resep tidak boleh saling mengacu.`,
          };
        }

        // Current item is level 1 in current product.
        // If the component already has depth D, then total depth becomes 1 + D.
        // If 1 + D > 3, it violates max 3 levels!
        if (1 + depthInfo.depth > 3) {
          return {
            valid: false,
            error: `Maksimal kedalaman resep adalah 3 level. Komponen "${item.namaSnapshot}" sudah memiliki ${depthInfo.depth} level turunan.`,
          };
        }
      }
    }

    return { valid: true };
  },

  // Calculate LIVE HPP and margin for a product
  hitungHPP(
    produkId: string,
    allProduk: Produk[],
    allResep: Resep[],
    allBahan: Bahan[],
    currentLevel = 1,
    visited = new Set<string>()
  ): KalkulasiHPP {
    const targetProduct = allProduk.find((p) => p.id === produkId);
    const hargaJual = targetProduct?.hargaJual || 0;

    // Cycle check
    if (visited.has(produkId)) {
      return {
        hpp: 0,
        marginPersen: 0,
        estimasiProfit: 0,
        isResepKosong: false,
        adaBahanTanpaBiaya: false,
        bahanTanpaBiayaList: [],
        itemsDetail: [],
        hasCycleError: true,
        cycleErrorMessage: `Terdeteksi siklus resep pada produk "${targetProduct?.nama || produkId}".`,
      };
    }

    // Depth check (max 3 levels)
    if (currentLevel > 3) {
      return {
        hpp: 0,
        marginPersen: 0,
        estimasiProfit: 0,
        isResepKosong: false,
        adaBahanTanpaBiaya: false,
        bahanTanpaBiayaList: [],
        itemsDetail: [],
        hasCycleError: true,
        cycleErrorMessage: `Kedalaman resep melebihi batas maksimal 3 level.`,
      };
    }

    const resep = allResep.find((r) => r.produkId === produkId);
    if (!resep || resep.items.length === 0) {
      return {
        hpp: 0,
        marginPersen: 0,
        estimasiProfit: 0,
        isResepKosong: true,
        adaBahanTanpaBiaya: false,
        bahanTanpaBiayaList: [],
        itemsDetail: [],
      };
    }

    const newVisited = new Set(visited).add(produkId);
    let totalHpp = 0;
    let adaBahanTanpaBiaya = false;
    const bahanTanpaBiayaList: string[] = [];
    const itemsDetail: ItemResepDetail[] = [];

    for (const item of resep.items) {
      if (item.tipe === 'bahan') {
        const bahan = allBahan.find((b) => b.id === item.bahanId);
        const nama = bahan?.nama || item.namaSnapshot || 'Bahan Tidak Diketahui';
        const satuan = bahan?.satuanDasar || item.satuan || '';
        const biayaSatuan = bahan?.biayaTerbaru;
        const hasBiaya = typeof biayaSatuan === 'number' && !isNaN(biayaSatuan) && biayaSatuan >= 0;

        const itemQty = item.qty ?? item.jumlah ?? 0;
        const itemId = item.id || `item-${Math.random().toString(36).substring(2, 7)}`;

        let subtotal = 0;
        if (hasBiaya) {
          subtotal = Number((itemQty * (biayaSatuan as number)).toFixed(2));
          totalHpp += subtotal;
        } else {
          adaBahanTanpaBiaya = true;
          if (!bahanTanpaBiayaList.includes(nama)) {
            bahanTanpaBiayaList.push(nama);
          }
        }

        itemsDetail.push({
          id: itemId,
          tipe: 'bahan',
          refId: item.bahanId || '',
          nama,
          qty: itemQty,
          satuan,
          biayaSatuan: hasBiaya ? biayaSatuan : undefined,
          subtotalBiaya: hasBiaya ? subtotal : undefined,
          hasBiaya,
          level: currentLevel,
        });
      } else if (item.tipe === 'komponen' && item.produkId) {
        const subProd = allProduk.find((p) => p.id === item.produkId);
        const nama = subProd?.nama || item.namaSnapshot || 'Komponen Tidak Diketahui';

        // Recursive call
        const subKalkulasi = this.hitungHPP(
          item.produkId,
          allProduk,
          allResep,
          allBahan,
          currentLevel + 1,
          newVisited
        );

        if (subKalkulasi.hasCycleError) {
          return {
            ...subKalkulasi,
            cycleErrorMessage: `Siklus pada komponen "${nama}": ${subKalkulasi.cycleErrorMessage}`,
          };
        }

        if (subKalkulasi.adaBahanTanpaBiaya) {
          adaBahanTanpaBiaya = true;
          for (const b of subKalkulasi.bahanTanpaBiayaList) {
            if (!bahanTanpaBiayaList.includes(b)) {
              bahanTanpaBiayaList.push(b);
            }
          }
        }

        const isKomponenTanpaResep = subKalkulasi.isResepKosong || !subProd;
        if (isKomponenTanpaResep) {
          adaBahanTanpaBiaya = true;
          const labelPeringatan = `${nama} (komponen tanpa resep)`;
          if (!bahanTanpaBiayaList.includes(labelPeringatan)) {
            bahanTanpaBiayaList.push(labelPeringatan);
          }
        }

        const itemQty = item.qty ?? item.jumlah ?? 0;
        const itemId = item.id || `item-${Math.random().toString(36).substring(2, 7)}`;
        const subtotal = Number((itemQty * subKalkulasi.hpp).toFixed(2));
        totalHpp += subtotal;

        itemsDetail.push({
          id: itemId,
          tipe: 'komponen',
          refId: item.produkId,
          nama,
          qty: itemQty,
          satuan: 'pcs',
          biayaSatuan: subKalkulasi.hpp,
          subtotalBiaya: subtotal,
          hasBiaya: !subKalkulasi.adaBahanTanpaBiaya && !isKomponenTanpaResep,
          level: currentLevel,
          subItems: subKalkulasi.itemsDetail,
        });
      }
    }

    const roundedHpp = Math.round(totalHpp);
    const estimasiProfit = hargaJual - roundedHpp;
    const marginPersen =
      hargaJual > 0 ? Number((((hargaJual - roundedHpp) / hargaJual) * 100).toFixed(1)) : 0;

    return {
      hpp: roundedHpp,
      marginPersen,
      estimasiProfit,
      isResepKosong: false,
      adaBahanTanpaBiaya,
      bahanTanpaBiayaList,
      itemsDetail,
    };
  },
};
