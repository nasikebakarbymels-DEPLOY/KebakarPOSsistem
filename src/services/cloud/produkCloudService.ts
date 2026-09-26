import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { getOutletSubcollectionRef, getOutletDocRef } from '../firebase';
import { Produk, ItemResep, JenisProduk } from '../../types';
import { sanitizePayload } from './cloudUtils';

export interface CreateProdukInput {
  nama: string;
  kategori?: string;
  hargaJual: number;
  jenis?: JenisProduk;
  aktif?: boolean;
  resepItems?: ItemResep[];
  catatan?: string;
  sku?: string;
  hasilProduksi?: { jumlah: number; satuan: 'gram' | 'ml' | 'pcs' | 'porsi' };
  diskonProduk?: { tipe: 'nominal' | 'persen'; nilai: number } | null;
}

export interface UpdateProdukInput {
  nama?: string;
  kategori?: string;
  hargaJual?: number;
  jenis?: JenisProduk;
  aktif?: boolean;
  resepItems?: ItemResep[];
  catatan?: string;
  sku?: string;
  hasilProduksi?: { jumlah: number; satuan: 'gram' | 'ml' | 'pcs' | 'porsi' };
  diskonProduk?: { tipe: 'nominal' | 'persen'; nilai: number } | null;
}

/**
 * Helper untuk menghitung harga neto setelah diskon produk
 * Guard: tidak boleh negatif, persen maks 90%, nominal maks hargaJual
 */
export function hitungHargaNeto(
  hargaJual: number,
  diskonProduk?: { tipe: 'nominal' | 'persen'; nilai: number } | null
): { hargaNeto: number; diskonNominal: number } {
  const safeHarga = typeof hargaJual === 'number' && !isNaN(hargaJual) ? Math.max(0, hargaJual) : 0;
  if (!diskonProduk || !diskonProduk.nilai || diskonProduk.nilai <= 0 || safeHarga <= 0) {
    return { hargaNeto: safeHarga, diskonNominal: 0 };
  }

  let diskonNominal = 0;
  if (diskonProduk.tipe === 'persen') {
    const persen = Math.min(Math.max(0, Number(diskonProduk.nilai)), 90);
    diskonNominal = Math.round((safeHarga * persen) / 100);
  } else {
    diskonNominal = Math.min(Math.max(0, Number(diskonProduk.nilai)), safeHarga);
  }

  const hargaNeto = Math.max(0, safeHarga - diskonNominal);
  return { hargaNeto, diskonNominal };
}

/**
 * Auto-generate SKU produk format MNU-YYYYMMDD-XXX (menu_jual) atau KMP-YYYYMMDD-XXX (komponen)
 * (XXX = urutan produk hari itu + 1, query count dokumen produk dengan createdAt hari ini)
 */
export async function generateSkuProduk(outletId: string, jenis: JenisProduk = 'menu_jual'): Promise<string> {
  if (!outletId) return `${jenis === 'komponen' ? 'KMP' : 'MNU'}-${Date.now()}`;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const todayPrefix = `${yyyy}-${mm}-${dd}`;
  const prefix = jenis === 'komponen' ? 'KMP' : 'MNU';

  const produkCol = getOutletSubcollectionRef(outletId, 'produk');
  const snapshot = await getDocs(produkCol);

  let countToday = 0;
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const createdAtStr = typeof data.createdAt === 'string' ? data.createdAt : '';
    if (createdAtStr.startsWith(todayPrefix)) {
      countToday++;
    }
  });

  const nextSeq = String(countToday + 1).padStart(3, '0');
  return `${prefix}-${dateStr}-${nextSeq}`;
}

/**
 * Helper untuk membersihkan array resepItems dari nilai undefined bersarang.
 * Firestore melarang field bernilai undefined di dalam array dokumen.
 */
export function cleanResepItems(items?: ItemResep[]): Array<Record<string, unknown>> {
  if (!items || !Array.isArray(items)) return [];

  return items.map((item, idx) => {
    const isSub = Boolean(item.subProdukId || item.produkId);
    const cleaned: Record<string, unknown> = {
      id: item.id || `item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      tipe: item.tipe || (isSub ? 'sub_produk' : 'bahan'),
      jumlah: typeof item.jumlah === 'number' ? item.jumlah : (item.qty || 0),
      satuan: item.satuan || (isSub ? 'porsi' : (item.bahanId ? 'gram' : 'pcs')),
    };

    if (item.namaSnapshot) {
      cleaned.namaSnapshot = item.namaSnapshot;
    }

    if (item.bahanId) {
      cleaned.bahanId = item.bahanId;
    }

    const subId = item.subProdukId || item.produkId;
    if (subId) {
      cleaned.subProdukId = subId;
    }

    return cleaned;
  });
}

export const produkCloudService = {
  /**
   * Mengambil semua produk aktif (tidak terhapus) pada outlet tertentu.
   * Secara default mengambil produk aktif dan nonaktif (asalkan isDeleted === false).
   * Bila includeInactive === false, hanya mengembalikan produk dengan status aktif === true.
   */
  async getActiveProduk(outletId: string, includeInactive: boolean = true): Promise<Produk[]> {
    if (!outletId) return [];

    const produkCol = getOutletSubcollectionRef<Omit<Produk, 'id'>>(outletId, 'produk');
    const q = query(produkCol, where('isDeleted', '==', false));
    const snapshot = await getDocs(q);

    const list: Produk[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        outletId: data.outletId || outletId,
        nama: data.nama || '',
        kategori: data.kategori || 'Umum',
        hargaJual: typeof data.hargaJual === 'number' ? data.hargaJual : 0,
        jenis: (data.jenis === 'komponen' || data.jenis === 'menu_jual') ? data.jenis : 'menu_jual',
        aktif: data.aktif !== undefined ? data.aktif : true,
        resepItems: Array.isArray(data.resepItems) ? data.resepItems : [],
        catatan: data.catatan || undefined,
        sku: data.sku || undefined,
        hasilProduksi: data.hasilProduksi && typeof data.hasilProduksi.jumlah === 'number'
          ? {
              jumlah: data.hasilProduksi.jumlah,
              satuan: data.hasilProduksi.satuan,
            }
          : undefined,
        diskonProduk: data.diskonProduk && typeof data.diskonProduk.nilai === 'number'
          ? {
              tipe: data.diskonProduk.tipe === 'persen' ? 'persen' : 'nominal',
              nilai: Number(data.diskonProduk.nilai),
            }
          : undefined,
        isDeleted: false,
        deletedAt: data.deletedAt || null,
        version: typeof data.version === 'number' ? data.version : 1,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    // Urutkan secara alfabetis berdasarkan nama
    list.sort((a, b) => a.nama.localeCompare(b.nama));

    if (!includeInactive) {
      return list.filter((p) => p.aktif);
    }

    return list;
  },

  /**
   * Mengambil satu dokumen produk berdasarkan ID
   */
  async getProdukById(outletId: string, produkId: string): Promise<Produk | null> {
    if (!outletId || !produkId) return null;

    const docRef = getOutletDocRef<Omit<Produk, 'id'>>(outletId, 'produk', produkId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    if (data.isDeleted) return null;

    return {
      id: docSnap.id,
      outletId: data.outletId || outletId,
      nama: data.nama || '',
      kategori: data.kategori || 'Umum',
      hargaJual: typeof data.hargaJual === 'number' ? data.hargaJual : 0,
      jenis: (data.jenis === 'komponen' || data.jenis === 'menu_jual') ? data.jenis : 'menu_jual',
      aktif: data.aktif !== undefined ? data.aktif : true,
      resepItems: Array.isArray(data.resepItems) ? data.resepItems : [],
      catatan: data.catatan || undefined,
      sku: data.sku || undefined,
      hasilProduksi: data.hasilProduksi && typeof data.hasilProduksi.jumlah === 'number'
        ? {
            jumlah: data.hasilProduksi.jumlah,
            satuan: data.hasilProduksi.satuan,
          }
        : undefined,
      diskonProduk: data.diskonProduk && typeof data.diskonProduk.nilai === 'number'
        ? {
            tipe: data.diskonProduk.tipe === 'persen' ? 'persen' : 'nominal',
            nilai: Number(data.diskonProduk.nilai),
          }
        : undefined,
      isDeleted: false,
      deletedAt: data.deletedAt || null,
      version: typeof data.version === 'number' ? data.version : 1,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  },

  /**
   * Helper auto-generate SKU produk format MNU-YYYYMMDD-XXX (menu_jual) atau KMP-YYYYMMDD-XXX (komponen)
   */
  async generateSkuProduk(outletId: string, jenis: JenisProduk = 'menu_jual'): Promise<string> {
    return generateSkuProduk(outletId, jenis);
  },

  /**
   * Memeriksa berapa banyak produk aktif lain yang menggunakan produkId ini sebagai sub-resep
   */
  async checkProdukUsedAsSubResep(outletId: string, produkId: string): Promise<number> {
    if (!outletId || !produkId) return 0;
    const allProduk = await this.getActiveProduk(outletId, true);
    const dependentProduk = allProduk.filter((p) => {
      if (p.id === produkId) return false;
      return (p.resepItems || []).some(
        (item) => item.subProdukId === produkId || item.produkId === produkId
      );
    });
    return dependentProduk.length;
  },

  /**
   * Menambahkan produk baru ke Firestore subcollection outlets/{outletId}/produk
   */
  async createProduk(outletId: string, data: CreateProdukInput, uid: string): Promise<Produk> {
    if (!outletId) throw new Error('Outlet ID wajib disertakan.');
    const trimmedNama = data.nama.trim();
    if (!trimmedNama || trimmedNama.length < 2) {
      throw new Error('Nama produk minimal 2 karakter.');
    }

    const jenis: JenisProduk = data.jenis === 'komponen' ? 'komponen' : 'menu_jual';

    if (jenis !== 'komponen') {
      if (data.hargaJual === undefined || isNaN(data.hargaJual) || data.hargaJual < 0) {
        throw new Error('Harga jual wajib diisi dan tidak boleh negatif.');
      }
    }

    const effectiveHargaJual = jenis === 'komponen' ? 0 : Number(data.hargaJual || 0);

    // Validasi diskon promo produk
    if (data.diskonProduk && data.diskonProduk.nilai > 0) {
      if (data.diskonProduk.tipe === 'persen') {
        if (data.diskonProduk.nilai < 0 || data.diskonProduk.nilai > 90) {
          throw new Error('Diskon persen maksimal 90%.');
        }
      } else {
        if (data.diskonProduk.nilai < 0 || data.diskonProduk.nilai > effectiveHargaJual) {
          throw new Error(`Diskon nominal tidak boleh melebihi harga jual (maks Rp${effectiveHargaJual.toLocaleString('id-ID')}).`);
        }
      }
    }

    // Auto-generate SKU jika input.sku kosong atau undefined
    const finalSku = data.sku && data.sku.trim()
      ? data.sku.trim()
      : await generateSkuProduk(outletId, jenis);

    const now = new Date().toISOString();
    const sanitizedResepItems = cleanResepItems(data.resepItems);

    const newDocData: Omit<Produk, 'id'> = {
      outletId,
      nama: trimmedNama,
      kategori: data.kategori?.trim() || 'Umum',
      hargaJual: jenis === 'komponen' ? 0 : Number(data.hargaJual),
      jenis,
      aktif: data.aktif !== undefined ? data.aktif : true,
      resepItems: sanitizedResepItems as unknown as ItemResep[],
      catatan: data.catatan?.trim() || undefined,
      sku: finalSku,
      hasilProduksi: data.hasilProduksi
        ? {
            jumlah: Number(data.hasilProduksi.jumlah),
            satuan: data.hasilProduksi.satuan,
          }
        : undefined,
      diskonProduk: data.diskonProduk && data.diskonProduk.nilai > 0
        ? {
            tipe: data.diskonProduk.tipe === 'persen' ? 'persen' : 'nominal',
            nilai: Number(data.diskonProduk.nilai),
          }
        : undefined,
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: uid,
      updatedBy: uid,
      createdAt: now,
      updatedAt: now,
    };

    const payload = sanitizePayload(newDocData as unknown as Record<string, unknown>);
    const docRef = await addDoc(getOutletSubcollectionRef(outletId, 'produk'), payload);

    return {
      id: docRef.id,
      ...newDocData,
    };
  },

  /**
   * Memperbarui dokumen produk di Firestore
   */
  async updateProduk(outletId: string, produkId: string, data: UpdateProdukInput, uid: string): Promise<void> {
    if (!outletId || !produkId) throw new Error('Parameter outletId dan produkId wajib diisi.');

    const docRef = getOutletDocRef(outletId, 'produk', produkId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      throw new Error('Produk tidak ditemukan di server.');
    }
    const currentData = existingSnap.data();

    const now = new Date().toISOString();
    const nextVersion = (typeof currentData.version === 'number' ? currentData.version : 1) + 1;

    const updatePayload: Record<string, unknown> = {
      version: nextVersion,
      updatedAt: now,
      updatedBy: uid,
    };

    if (data.nama !== undefined) {
      const trimmedNama = data.nama.trim();
      if (!trimmedNama || trimmedNama.length < 2) {
        throw new Error('Nama produk minimal 2 karakter.');
      }
      updatePayload.nama = trimmedNama;
    }

    if (data.kategori !== undefined) {
      updatePayload.kategori = data.kategori.trim() || 'Umum';
    }

    if (data.jenis !== undefined) {
      updatePayload.jenis = data.jenis;
      if (data.jenis === 'komponen') {
        updatePayload.hargaJual = 0;
      }
    }

    if (data.hargaJual !== undefined && data.jenis !== 'komponen') {
      if (isNaN(data.hargaJual) || data.hargaJual < 0) {
        throw new Error('Harga jual tidak boleh negatif.');
      }
      updatePayload.hargaJual = Number(data.hargaJual);
    }

    if (data.aktif !== undefined) {
      updatePayload.aktif = Boolean(data.aktif);
    }

    if (data.catatan !== undefined) {
      updatePayload.catatan = data.catatan.trim() || undefined;
    }

    if (data.sku !== undefined) {
      updatePayload.sku = data.sku.trim() || undefined;
    }

    if (data.hasilProduksi !== undefined) {
      updatePayload.hasilProduksi = data.hasilProduksi
        ? {
            jumlah: Number(data.hasilProduksi.jumlah),
            satuan: data.hasilProduksi.satuan,
          }
        : undefined;
    }

    if (data.diskonProduk !== undefined) {
      if (data.diskonProduk && data.diskonProduk.nilai > 0) {
        const checkHarga = data.hargaJual !== undefined ? Number(data.hargaJual) : Number(currentData.hargaJual || 0);
        if (data.diskonProduk.tipe === 'persen') {
          if (data.diskonProduk.nilai < 0 || data.diskonProduk.nilai > 90) {
            throw new Error('Diskon persen maksimal 90%.');
          }
        } else {
          if (data.diskonProduk.nilai < 0 || (checkHarga > 0 && data.diskonProduk.nilai > checkHarga)) {
            throw new Error(`Diskon nominal tidak boleh melebihi harga jual (maks Rp${checkHarga.toLocaleString('id-ID')}).`);
          }
        }
        updatePayload.diskonProduk = {
          tipe: data.diskonProduk.tipe === 'persen' ? 'persen' : 'nominal',
          nilai: Number(data.diskonProduk.nilai),
        };
      } else {
        updatePayload.diskonProduk = null;
      }
    }

    if (data.resepItems !== undefined) {
      updatePayload.resepItems = cleanResepItems(data.resepItems);
    }

    await updateDoc(docRef, sanitizePayload(updatePayload));
  },

  /**
   * Menghapus produk secara soft-delete.
   * GUARD: Jika produk ini masih dipakai sebagai subProduk di resep produk aktif lain, operasi dibatalkan.
   */
  async softDeleteProduk(outletId: string, produkId: string, uid: string): Promise<void> {
    if (!outletId || !produkId) throw new Error('Parameter outletId dan produkId wajib diisi.');

    // Ambil semua produk aktif di outlet ini
    const allProduk = await this.getActiveProduk(outletId, true);

    // Cari produk aktif lain yang menggunakan produkId ini sebagai subProdukId
    const dependentProduk = allProduk.filter((p) => {
      if (p.id === produkId) return false;
      return (p.resepItems || []).some(
        (item) => item.subProdukId === produkId || item.produkId === produkId
      );
    });

    if (dependentProduk.length > 0) {
      const namaList = dependentProduk.map((p) => p.nama).join(', ');
      throw new Error(
        `Produk masih dipakai sebagai sub-resep di ${dependentProduk.length} produk lain (${namaList}).`
      );
    }

    const docRef = getOutletDocRef(outletId, 'produk', produkId);
    const now = new Date().toISOString();

    await updateDoc(
      docRef,
      sanitizePayload({
        isDeleted: true,
        deletedAt: now,
        updatedAt: now,
        updatedBy: uid,
      })
    );
  },
};
