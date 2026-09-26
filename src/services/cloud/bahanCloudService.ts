import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { getOutletSubcollectionRef, getOutletDocRef } from '../firebase';
import { Bahan, KemasanBahan, RiwayatHargaBahan, SatuanDasar } from '../../types';
import { sanitizePayload } from './cloudUtils';
import { produkCloudService } from './produkCloudService';

export interface CreateBahanInput {
  nama: string;
  satuanDasar: SatuanDasar;
  kemasanList: KemasanBahan[];
  catatan?: string;
  sku?: string;
}

export interface UpdateBahanInput {
  nama?: string;
  satuanDasar?: SatuanDasar;
  kemasanList?: KemasanBahan[];
  catatan?: string;
  sku?: string;
}

/**
 * Auto-generate SKU bahan format BHN-YYYYMMDD-XXX
 * (XXX = urutan bahan hari itu + 1, query count dokumen bahan dengan createdAt hari ini)
 */
export async function generateSkuBahan(outletId: string): Promise<string> {
  if (!outletId) return `BHN-${Date.now()}`;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yyyy}${mm}${dd}`;
  const todayPrefix = `${yyyy}-${mm}-${dd}`;

  const bahanCol = getOutletSubcollectionRef(outletId, 'bahan');
  const snapshot = await getDocs(bahanCol);

  let countToday = 0;
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const createdAtStr = typeof data.createdAt === 'string' ? data.createdAt : '';
    if (createdAtStr.startsWith(todayPrefix)) {
      countToday++;
    }
  });

  const nextSeq = String(countToday + 1).padStart(3, '0');
  return `BHN-${dateStr}-${nextSeq}`;
}

/**
 * Menghitung harga per satuan dasar dari kemasan yang bertanda acuan.
 * Bila tidak ada yang bertanda acuan, mengambil kemasan pertama.
 * Rumus: hargaPerKemasan / isiPerKemasan (dalam satuan dasar).
 */
export function hitungHargaPerSatuanDasar(kemasanList: KemasanBahan[]): number {
  if (!kemasanList || kemasanList.length === 0) return 0;

  const acuanKemasan = kemasanList.find((k) => k.acuan === true) || kemasanList[0];
  const isi = typeof acuanKemasan.isi === 'number' && acuanKemasan.isi > 0
    ? acuanKemasan.isi
    : (acuanKemasan.netto > 0 ? acuanKemasan.netto : 0);

  const harga = typeof acuanKemasan.hargaPerKemasan === 'number' && acuanKemasan.hargaPerKemasan >= 0
    ? acuanKemasan.hargaPerKemasan
    : 0;

  if (isi <= 0) return 0;
  return Number((harga / isi).toFixed(4));
}

export const bahanCloudService = {
  /**
   * Mengambil semua bahan aktif (isDeleted === false) pada suatu outlet,
   * diurutkan berdasarkan nama secara ascending.
   */
  async getActiveBahan(outletId: string): Promise<Bahan[]> {
    if (!outletId) return [];

    const bahanCol = getOutletSubcollectionRef<Omit<Bahan, 'id'>>(outletId, 'bahan');
    const q = query(bahanCol, where('isDeleted', '==', false));
    const snapshot = await getDocs(q);

    const list: Bahan[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const rawKemasan = Array.isArray(data.kemasanList) ? data.kemasanList : [];
      const kemasanList: KemasanBahan[] = rawKemasan.map((k) => ({
        id: k.id || `kem-${Math.random().toString(36).substring(2, 7)}`,
        nama: k.nama || '',
        netto: typeof k.netto === 'number' ? k.netto : (k.isi || 0),
        isi: typeof k.isi === 'number' ? k.isi : (k.netto || 0),
        hargaPerKemasan: typeof k.hargaPerKemasan === 'number' ? k.hargaPerKemasan : 0,
        acuan: Boolean(k.acuan),
      }));

      const hargaPerSatuan =
        typeof data.hargaPerSatuanDasar === 'number'
          ? data.hargaPerSatuanDasar
          : hitungHargaPerSatuanDasar(kemasanList);

      const rawRiwayat = Array.isArray(data.riwayatHarga) ? data.riwayatHarga : [];
      const riwayatHarga: RiwayatHargaBahan[] = rawRiwayat.map((r: { tanggal?: string; hargaPerSatuanDasar?: number; pembelianId?: string }) => ({
        tanggal: r.tanggal || '',
        hargaPerSatuanDasar: typeof r.hargaPerSatuanDasar === 'number' ? r.hargaPerSatuanDasar : 0,
        pembelianId: r.pembelianId || 'manual-edit',
      }));

      return {
        id: docSnap.id,
        outletId: data.outletId || outletId,
        nama: data.nama || '',
        sku: data.sku || undefined,
        satuanDasar: (data.satuanDasar as SatuanDasar) || 'gram',
        hargaPerSatuanDasar: hargaPerSatuan,
        biayaTerbaru: typeof data.biayaTerbaru === 'number' ? data.biayaTerbaru : hargaPerSatuan,
        catatan: data.catatan || undefined,
        kemasanList,
        riwayatHarga,
        isDeleted: false,
        deletedAt: data.deletedAt || null,
        version: typeof data.version === 'number' ? data.version : 1,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    list.sort((a, b) => a.nama.localeCompare(b.nama));
    return list;
  },

  /**
   * Mengambil satu dokumen bahan berdasarkan ID
   */
  async getBahanById(outletId: string, bahanId: string): Promise<Bahan | null> {
    if (!outletId || !bahanId) return null;

    const docRef = getOutletDocRef<Omit<Bahan, 'id'>>(outletId, 'bahan', bahanId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    if (data.isDeleted) return null;

    const rawKemasan = Array.isArray(data.kemasanList) ? data.kemasanList : [];
    const kemasanList: KemasanBahan[] = rawKemasan.map((k) => ({
      id: k.id || `kem-${Math.random().toString(36).substring(2, 7)}`,
      nama: k.nama || '',
      netto: typeof k.netto === 'number' ? k.netto : (k.isi || 0),
      isi: typeof k.isi === 'number' ? k.isi : (k.netto || 0),
      hargaPerKemasan: typeof k.hargaPerKemasan === 'number' ? k.hargaPerKemasan : 0,
      acuan: Boolean(k.acuan),
    }));

    const hargaPerSatuan =
      typeof data.hargaPerSatuanDasar === 'number'
        ? data.hargaPerSatuanDasar
        : hitungHargaPerSatuanDasar(kemasanList);

    const rawRiwayat = Array.isArray(data.riwayatHarga) ? data.riwayatHarga : [];
    const riwayatHarga: RiwayatHargaBahan[] = rawRiwayat.map((r: { tanggal?: string; hargaPerSatuanDasar?: number; pembelianId?: string }) => ({
      tanggal: r.tanggal || '',
      hargaPerSatuanDasar: typeof r.hargaPerSatuanDasar === 'number' ? r.hargaPerSatuanDasar : 0,
      pembelianId: r.pembelianId || 'manual-edit',
    }));

    return {
      id: docSnap.id,
      outletId: data.outletId || outletId,
      nama: data.nama || '',
      sku: data.sku || undefined,
      satuanDasar: (data.satuanDasar as SatuanDasar) || 'gram',
      hargaPerSatuanDasar: hargaPerSatuan,
      biayaTerbaru: typeof data.biayaTerbaru === 'number' ? data.biayaTerbaru : hargaPerSatuan,
      catatan: data.catatan || undefined,
      kemasanList,
      riwayatHarga,
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
   * Helper auto-generate SKU bahan format BHN-YYYYMMDD-XXX
   */
  async generateSkuBahan(outletId: string): Promise<string> {
    return generateSkuBahan(outletId);
  },

  /**
   * Memeriksa berapa banyak produk aktif yang menggunakan bahan ini di resepnya
   */
  async checkBahanUsedInProduk(outletId: string, bahanId: string): Promise<number> {
    if (!outletId || !bahanId) return 0;
    const allProduk = await produkCloudService.getActiveProduk(outletId, true);
    const dependentProduk = allProduk.filter((p) =>
      (p.resepItems || []).some((item) => item.bahanId === bahanId)
    );
    return dependentProduk.length;
  },

  /**
   * Membuat dokumen bahan baru di subcollection outlets/{outletId}/bahan
   */
  async createBahan(outletId: string, data: CreateBahanInput, uid: string): Promise<Bahan> {
    if (!outletId) throw new Error('Outlet ID wajib disertakan.');
    const trimmedNama = data.nama.trim();
    if (!trimmedNama || trimmedNama.length < 2) {
      throw new Error('Nama bahan minimal 2 karakter.');
    }

    // Auto-generate SKU jika input.sku kosong atau undefined
    const finalSku = data.sku && data.sku.trim()
      ? data.sku.trim()
      : await generateSkuBahan(outletId);

    const cleanedKemasanList: KemasanBahan[] = (data.kemasanList || []).map((k, idx) => {
      const isi = typeof k.isi === 'number' && k.isi > 0 ? k.isi : (k.netto > 0 ? k.netto : 1);
      return {
        id: k.id || `kem-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        nama: k.nama.trim() || `Kemasan ${idx + 1}`,
        isi,
        netto: isi,
        hargaPerKemasan: typeof k.hargaPerKemasan === 'number' && k.hargaPerKemasan >= 0 ? k.hargaPerKemasan : 0,
        acuan: Boolean(k.acuan),
      };
    });

    // Pastikan tepat ada satu acuan jika ada kemasan
    if (cleanedKemasanList.length > 0) {
      const hasAcuan = cleanedKemasanList.some((k) => k.acuan === true);
      if (!hasAcuan) {
        cleanedKemasanList[0].acuan = true;
      }
    }

    const hargaPerSatuanDasar = hitungHargaPerSatuanDasar(cleanedKemasanList);
    const now = new Date().toISOString();

    const initialRiwayat: RiwayatHargaBahan[] =
      hargaPerSatuanDasar > 0
        ? [
            {
              tanggal: now,
              hargaPerSatuanDasar,
              pembelianId: 'manual-edit',
            },
          ]
        : [];

    const newDocData: Omit<Bahan, 'id'> = {
      outletId,
      nama: trimmedNama,
      sku: finalSku,
      satuanDasar: data.satuanDasar,
      hargaPerSatuanDasar,
      biayaTerbaru: hargaPerSatuanDasar,
      kemasanList: cleanedKemasanList,
      riwayatHarga: initialRiwayat,
      catatan: data.catatan?.trim() || undefined,
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: uid,
      updatedBy: uid,
      createdAt: now,
      updatedAt: now,
    };

    const payload = sanitizePayload(newDocData as unknown as Record<string, unknown>);
    const docRef = await addDoc(getOutletSubcollectionRef(outletId, 'bahan'), payload);

    return {
      id: docRef.id,
      ...newDocData,
    };
  },

  /**
   * Memperbarui dokumen bahan di Firestore
   */
  async updateBahan(outletId: string, bahanId: string, data: UpdateBahanInput, uid: string): Promise<void> {
    if (!outletId || !bahanId) throw new Error('Parameter outletId dan bahanId wajib diisi.');

    const docRef = getOutletDocRef(outletId, 'bahan', bahanId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      throw new Error('Bahan tidak ditemukan di server.');
    }
    const currentData = existingSnap.data();

    const now = new Date().toISOString();
    const nextVersion = (typeof currentData.version === 'number' ? currentData.version : 1) + 1;

    const updatePayload: Record<string, unknown> = {
      version: nextVersion,
      updatedAt: now,
      updatedBy: uid,
    };

    if (data.sku !== undefined) {
      updatePayload.sku = data.sku.trim() || undefined;
    }

    if (data.nama !== undefined) {
      const trimmedNama = data.nama.trim();
      if (!trimmedNama || trimmedNama.length < 2) {
        throw new Error('Nama bahan minimal 2 karakter.');
      }
      updatePayload.nama = trimmedNama;
    }

    if (data.satuanDasar !== undefined) {
      updatePayload.satuanDasar = data.satuanDasar;
    }

    if (data.catatan !== undefined) {
      updatePayload.catatan = data.catatan.trim() || undefined;
    }

    if (data.kemasanList !== undefined) {
      const cleanedKemasanList: KemasanBahan[] = data.kemasanList.map((k, idx) => {
        const isi = typeof k.isi === 'number' && k.isi > 0 ? k.isi : (k.netto > 0 ? k.netto : 1);
        return {
          id: k.id || `kem-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          nama: k.nama.trim() || `Kemasan ${idx + 1}`,
          isi,
          netto: isi,
          hargaPerKemasan: typeof k.hargaPerKemasan === 'number' && k.hargaPerKemasan >= 0 ? k.hargaPerKemasan : 0,
          acuan: Boolean(k.acuan),
        };
      });

      if (cleanedKemasanList.length > 0) {
        const hasAcuan = cleanedKemasanList.some((k) => k.acuan === true);
        if (!hasAcuan) {
          cleanedKemasanList[0].acuan = true;
        }
      }

      const hargaPerSatuan = hitungHargaPerSatuanDasar(cleanedKemasanList);
      updatePayload.kemasanList = cleanedKemasanList;
      updatePayload.hargaPerSatuanDasar = hargaPerSatuan;
      updatePayload.biayaTerbaru = hargaPerSatuan;

      const hargaLama =
        typeof currentData.hargaPerSatuanDasar === 'number'
          ? currentData.hargaPerSatuanDasar
          : 0;

      if (Math.abs(hargaPerSatuan - hargaLama) > 0.0001) {
        const rawRiwayat = Array.isArray(currentData.riwayatHarga)
          ? [...currentData.riwayatHarga]
          : [];
        rawRiwayat.unshift({
          tanggal: now,
          hargaPerSatuanDasar: hargaPerSatuan,
          pembelianId: 'manual-edit',
        });
        updatePayload.riwayatHarga = rawRiwayat.slice(0, 50);
      }
    }

    await updateDoc(docRef, sanitizePayload(updatePayload));
  },

  /**
   * Menghapus bahan secara soft-delete.
   * GUARD: Jika ada produk aktif yang resepnya menggunakan bahan ini, operasi ditolak.
   */
  async softDeleteBahan(outletId: string, bahanId: string, uid: string): Promise<void> {
    if (!outletId || !bahanId) throw new Error('Parameter outletId dan bahanId wajib diisi.');

    // GUARD: Ambil semua produk aktif outlet ini
    const allProduk = await produkCloudService.getActiveProduk(outletId, true);

    const dependentProduk = allProduk.filter((p) =>
      (p.resepItems || []).some((item) => item.bahanId === bahanId)
    );

    if (dependentProduk.length > 0) {
      const namaList = dependentProduk.map((p) => p.nama).join(', ');
      throw new Error(
        `Bahan masih dipakai di ${dependentProduk.length} produk aktif (${namaList}). Ganti resep terlebih dahulu.`
      );
    }

    const docRef = getOutletDocRef(outletId, 'bahan', bahanId);
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
