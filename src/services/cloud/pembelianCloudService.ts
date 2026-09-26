import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import {
  getOutletSubcollectionRef,
  getOutletDocRef,
  handleFirestoreError,
  OperationType,
} from '../firebase';
import {
  PembelianBahan,
  ItemPembelian,
  Bahan,
  KemasanBahan,
  RiwayatHargaBahan,
} from '../../types';
import { sanitizePayload } from './cloudUtils';

export interface CreatePembelianItemInput {
  bahanId: string;
  kemasanId: string;
  namaBahanSnapshot: string;
  namaKemasanSnapshot: string;
  isiPerKemasanSnapshot: number;
  qty: number;
  hargaTotal: number;
  isAcuanKemasan: boolean;
}

export interface CreatePembelianInput {
  tanggal: string; // ISO date string (YYYY-MM-DD)
  supplier: string;
  items: CreatePembelianItemInput[];
  catatan?: string;
}

export interface UpdatePembelianInput {
  tanggal?: string;
  supplier?: string;
  items?: CreatePembelianItemInput[];
  catatan?: string;
}

export interface PerubahanHargaAcuanItem {
  bahanNama: string;
  lama: number;
  baru: number;
  perubahanPersen: number;
}

export interface GagalUpdateHargaItem {
  bahanNama: string;
  alasan: string;
}

export const pembelianCloudService = {
  /**
   * Mengambil semua pembelian bahan aktif (isDeleted === false) pada suatu outlet,
   * diurutkan berdasarkan tanggal secara descending.
   */
  async getActivePembelian(outletId: string): Promise<PembelianBahan[]> {
    if (!outletId) return [];

    const path = `outlets/${outletId}/pembelianBahan`;
    try {
      const colRef = getOutletSubcollectionRef<Omit<PembelianBahan, 'id'>>(
        outletId,
        'pembelianBahan'
      );
      const q = query(colRef, where('isDeleted', '==', false));
      const snapshot = await getDocs(q);

      const list: PembelianBahan[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const items: ItemPembelian[] = rawItems.map((it) => {
          const qty = Number(it.qty) || 1;
          const hargaTotal = Number(it.hargaTotal) || 0;
          const hargaPerUnit =
            typeof it.hargaPerUnit === 'number' && it.hargaPerUnit >= 0
              ? it.hargaPerUnit
              : (qty > 0 ? Number((hargaTotal / qty).toFixed(2)) : 0);

          return {
            bahanId: it.bahanId || '',
            kemasanId: it.kemasanId || '',
            namaBahanSnapshot: it.namaBahanSnapshot || 'Bahan',
            namaKemasanSnapshot: it.namaKemasanSnapshot || 'Kemasan',
            isiPerKemasanSnapshot: Number(it.isiPerKemasanSnapshot) || 1,
            qty,
            hargaTotal,
            hargaPerUnit,
            isAcuanKemasan: Boolean(it.isAcuanKemasan),
          };
        });

        const totalPembelian =
          typeof data.totalPembelian === 'number'
            ? data.totalPembelian
            : (typeof data.totalHarga === 'number'
                ? data.totalHarga
                : items.reduce((sum, item) => sum + item.hargaTotal, 0));

        return {
          id: docSnap.id,
          outletId: data.outletId || outletId,
          tanggal: data.tanggal || new Date().toISOString().split('T')[0],
          supplier: data.supplier || 'Supplier Umum',
          items,
          totalPembelian,
          totalHarga: totalPembelian,
          catatan: data.catatan || undefined,
          isDeleted: false,
          deletedAt: data.deletedAt || null,
          version: typeof data.version === 'number' ? data.version : 1,
          createdBy: data.createdBy,
          updatedBy: data.updatedBy,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      });

      // Urutkan tanggal descending, lalu createdAt descending
      return list.sort((a, b) => {
        const dateCompare = String(b.tanggal).localeCompare(String(a.tanggal));
        if (dateCompare !== 0) return dateCompare;
        return String(b.createdAt).localeCompare(String(a.createdAt));
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  /**
   * Mengambil satu dokumen pembelian bahan berdasarkan ID
   */
  async getPembelianById(outletId: string, id: string): Promise<PembelianBahan | null> {
    if (!outletId || !id) return null;

    const path = `outlets/${outletId}/pembelianBahan/${id}`;
    try {
      const docRef = getOutletDocRef<Omit<PembelianBahan, 'id'>>(
        outletId,
        'pembelianBahan',
        id
      );
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) return null;
      const data = docSnap.data();
      if (data.isDeleted) return null;

      const rawItems = Array.isArray(data.items) ? data.items : [];
      const items: ItemPembelian[] = rawItems.map((it) => {
        const qty = Number(it.qty) || 1;
        const hargaTotal = Number(it.hargaTotal) || 0;
        const hargaPerUnit =
          typeof it.hargaPerUnit === 'number' && it.hargaPerUnit >= 0
            ? it.hargaPerUnit
            : (qty > 0 ? Number((hargaTotal / qty).toFixed(2)) : 0);

        return {
          bahanId: it.bahanId || '',
          kemasanId: it.kemasanId || '',
          namaBahanSnapshot: it.namaBahanSnapshot || 'Bahan',
          namaKemasanSnapshot: it.namaKemasanSnapshot || 'Kemasan',
          isiPerKemasanSnapshot: Number(it.isiPerKemasanSnapshot) || 1,
          qty,
          hargaTotal,
          hargaPerUnit,
          isAcuanKemasan: Boolean(it.isAcuanKemasan),
        };
      });

      const totalPembelian =
        typeof data.totalPembelian === 'number'
          ? data.totalPembelian
          : (typeof data.totalHarga === 'number'
              ? data.totalHarga
              : items.reduce((sum, item) => sum + item.hargaTotal, 0));

      return {
        id: docSnap.id,
        outletId: data.outletId || outletId,
        tanggal: data.tanggal || new Date().toISOString().split('T')[0],
        supplier: data.supplier || 'Supplier Umum',
        items,
        totalPembelian,
        totalHarga: totalPembelian,
        catatan: data.catatan || undefined,
        isDeleted: false,
        deletedAt: data.deletedAt || null,
        version: typeof data.version === 'number' ? data.version : 1,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  /**
   * Mencatat transaksi pembelian bahan baru:
   * 1. Hitung totalPembelian & hargaPerUnit tiap item.
   * 2. Simpan dokumen pembelian ke Firestore subcollection.
   * 3. Untuk setiap item dengan isAcuanKemasan true:
   *    - Hitung hargaPerSatuanDasar baru = hargaPerUnit / isiPerKemasanSnapshot.
   *    - Perbarui hargaPerSatuanDasar bahan dan tambahkan riwayatHarga (truncate 50).
   * 4. Kembalikan id dan daftar perubahan harga acuan.
   */
  async createPembelian(
    outletId: string,
    input: CreatePembelianInput,
    uid: string
  ): Promise<{
    id: string;
    hargaAcuanDiubah: PerubahanHargaAcuanItem[];
    gagalUpdate: GagalUpdateHargaItem[];
  }> {
    if (!outletId) throw new Error('Outlet ID wajib disertakan.');
    const rawSupplier = (input.supplier || '').trim();
    const trimmedSupplier = rawSupplier || 'Umum';
    if (!input.items || input.items.length === 0) {
      throw new Error('Minimal harus ada 1 item pembelian.');
    }

    const items: ItemPembelian[] = input.items.map((it) => {
      const qty = Number(it.qty) || 1;
      const hargaTotal = Number(it.hargaTotal) || 0;
      const isi = Number(it.isiPerKemasanSnapshot) || 1;
      const hargaPerUnit = qty > 0 ? Number((hargaTotal / qty).toFixed(2)) : 0;

      return {
        bahanId: it.bahanId,
        kemasanId: it.kemasanId,
        namaBahanSnapshot: it.namaBahanSnapshot.trim(),
        namaKemasanSnapshot: it.namaKemasanSnapshot.trim(),
        isiPerKemasanSnapshot: isi,
        qty,
        hargaTotal,
        hargaPerUnit,
        isAcuanKemasan: Boolean(it.isAcuanKemasan),
      };
    });

    const totalPembelian = items.reduce((sum, item) => sum + item.hargaTotal, 0);
    const now = new Date().toISOString();

    const newDocData: Omit<PembelianBahan, 'id'> = {
      outletId,
      tanggal: input.tanggal || now.split('T')[0],
      supplier: trimmedSupplier,
      items,
      totalPembelian,
      totalHarga: totalPembelian,
      catatan: input.catatan?.trim() || undefined,
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: uid,
      updatedBy: uid,
      createdAt: now,
      updatedAt: now,
    };

    const path = `outlets/${outletId}/pembelianBahan`;
    let idPembelian = '';

    try {
      const payload = sanitizePayload(newDocData as unknown as Record<string, unknown>);
      const docRef = await addDoc(
        getOutletSubcollectionRef<Omit<PembelianBahan, 'id'>>(outletId, 'pembelianBahan'),
        payload
      );
      idPembelian = docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }

    const hargaAcuanDiubah: PerubahanHargaAcuanItem[] = [];
    const gagalUpdate: GagalUpdateHargaItem[] = [];

    // Proses item berkemasan acuan untuk memperbarui harga acuan bahan & riwayat
    for (const item of items) {
      if (!item.isAcuanKemasan) continue;

      const bahanDocPath = `outlets/${outletId}/bahan/${item.bahanId}`;
      try {
        const bahanDocRef = getOutletDocRef<Omit<Bahan, 'id'>>(
          outletId,
          'bahan',
          item.bahanId
        );
        const bahanSnap = await getDoc(bahanDocRef);

        if (bahanSnap.exists()) {
          const bahanData = bahanSnap.data();
          if (!bahanData.isDeleted) {
            const hargaLama =
              typeof bahanData.hargaPerSatuanDasar === 'number'
                ? bahanData.hargaPerSatuanDasar
                : 0;

            const isi = item.isiPerKemasanSnapshot > 0 ? item.isiPerKemasanSnapshot : 1;
            const hargaBaru = Number((item.hargaPerUnit / isi).toFixed(4));

            let perubahanPersen = 0;
            if (hargaLama > 0) {
              perubahanPersen = Number(
                (((hargaBaru - hargaLama) / hargaLama) * 100).toFixed(1)
              );
            } else if (hargaBaru > 0) {
              perubahanPersen = 100;
            }

            // Perbarui daftar kemasan: HANYA kemasan yang dibeli yang harganya diperbarui
            const rawKemasan = Array.isArray(bahanData.kemasanList)
              ? [...bahanData.kemasanList]
              : [];
            const updatedKemasanList: KemasanBahan[] = rawKemasan.map((k) => {
              if (k.id === item.kemasanId) {
                return {
                  ...k,
                  hargaPerKemasan: item.hargaPerUnit,
                  acuan: true,
                };
              }
              return k;
            });

            // Perbarui riwayat harga bahan
            const currentRiwayat: RiwayatHargaBahan[] = Array.isArray(
              bahanData.riwayatHarga
            )
              ? [...bahanData.riwayatHarga]
              : [];

            currentRiwayat.unshift({
              tanggal: now,
              hargaPerSatuanDasar: hargaBaru,
              pembelianId: idPembelian,
            });

            // Truncate maksimal 50 entri riwayat
            const truncatedRiwayat = currentRiwayat.slice(0, 50);

            const nextVersion =
              (typeof bahanData.version === 'number' ? bahanData.version : 1) + 1;

            await updateDoc(
              bahanDocRef,
              sanitizePayload({
                hargaPerSatuanDasar: hargaBaru,
                biayaTerbaru: hargaBaru,
                kemasanList: updatedKemasanList,
                riwayatHarga: truncatedRiwayat,
                version: nextVersion,
                updatedBy: uid,
                updatedAt: now,
              })
            );

            hargaAcuanDiubah.push({
              bahanNama: item.namaBahanSnapshot,
              lama: hargaLama,
              baru: hargaBaru,
              perubahanPersen,
            });
          }
        }
      } catch (error) {
        console.error(
          `[pembelianCloudService] Gagal memperbarui harga acuan bahan ${item.bahanId}:`,
          error
        );
        const alasan = error instanceof Error ? error.message : 'Gagal memperbarui harga di Firestore.';
        gagalUpdate.push({
          bahanNama: item.namaBahanSnapshot,
          alasan,
        });
      }
    }

    return {
      id: idPembelian,
      hargaAcuanDiubah,
      gagalUpdate,
    };
  },

  /**
   * Memperbarui dokumen pembelian bahan.
   * ATURAN: Hanya memperbarui dokumen pembelian (tanggal, supplier, items, totalPembelian, version +1).
   * DILARANG menyentuh harga acuan maupun riwayatHarga bahan (edit pembelian lama tidak memundurkan harga).
   */
  async updatePembelian(
    outletId: string,
    id: string,
    input: UpdatePembelianInput,
    uid: string
  ): Promise<void> {
    if (!outletId || !id) throw new Error('Parameter outletId dan id wajib diisi.');

    const path = `outlets/${outletId}/pembelianBahan/${id}`;
    try {
      const docRef = getOutletDocRef<Omit<PembelianBahan, 'id'>>(
        outletId,
        'pembelianBahan',
        id
      );
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error('Dokumen pembelian tidak ditemukan.');
      }
      const existing = snap.data();

      const now = new Date().toISOString();
      const nextVersion =
        (typeof existing.version === 'number' ? existing.version : 1) + 1;

      const updatePayload: Record<string, unknown> = {
        version: nextVersion,
        updatedAt: now,
        updatedBy: uid,
      };

      if (input.tanggal !== undefined) {
        updatePayload.tanggal = input.tanggal;
      }

      if (input.supplier !== undefined) {
        const rawSupplier = input.supplier.trim();
        updatePayload.supplier = rawSupplier || 'Umum';
      }

      if (input.catatan !== undefined) {
        updatePayload.catatan = input.catatan.trim() || undefined;
      }

      if (input.items !== undefined) {
        if (input.items.length === 0) {
          throw new Error('Minimal harus ada 1 item pembelian.');
        }

        const items: ItemPembelian[] = input.items.map((it) => {
          const qty = Number(it.qty) || 1;
          const hargaTotal = Number(it.hargaTotal) || 0;
          const isi = Number(it.isiPerKemasanSnapshot) || 1;
          const hargaPerUnit =
            qty > 0 ? Number((hargaTotal / qty).toFixed(2)) : 0;

          return {
            bahanId: it.bahanId,
            kemasanId: it.kemasanId,
            namaBahanSnapshot: it.namaBahanSnapshot.trim(),
            namaKemasanSnapshot: it.namaKemasanSnapshot.trim(),
            isiPerKemasanSnapshot: isi,
            qty,
            hargaTotal,
            hargaPerUnit,
            isAcuanKemasan: Boolean(it.isAcuanKemasan),
          };
        });

        const totalPembelian = items.reduce((sum, item) => sum + item.hargaTotal, 0);
        updatePayload.items = items;
        updatePayload.totalPembelian = totalPembelian;
        updatePayload.totalHarga = totalPembelian;
      }

      await updateDoc(docRef, sanitizePayload(updatePayload));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  /**
   * Menghapus dokumen pembelian bahan secara soft-delete (isDeleted: true).
   * ATURAN: DILARANG memundurkan harga acuan bahan.
   */
  async softDeletePembelian(
    outletId: string,
    id: string,
    uid: string
  ): Promise<void> {
    if (!outletId || !id) throw new Error('Parameter outletId dan id wajib diisi.');

    const path = `outlets/${outletId}/pembelianBahan/${id}`;
    try {
      const docRef = getOutletDocRef<Omit<PembelianBahan, 'id'>>(
        outletId,
        'pembelianBahan',
        id
      );
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
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },
};
