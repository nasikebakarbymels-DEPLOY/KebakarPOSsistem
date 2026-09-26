import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { getOutletSubcollectionRef, getOutletDocRef } from '../firebase';
import { BiayaLain } from '../../types';
import { sanitizePayload } from './cloudUtils';

export interface CreateBiayaLainInput {
  nama: string;
  tipe: 'nominal' | 'persen';
  nilaiDefault?: number;
  nilai?: number; // alias
  aktif?: boolean;
}

export interface UpdateBiayaLainInput {
  nama?: string;
  tipe?: 'nominal' | 'persen';
  nilaiDefault?: number;
  nilai?: number; // alias
  aktif?: boolean;
}

/**
 * Helper untuk menghitung subtotal biaya lain berdasarkan neto setelah voucher
 * Jika tipe nominal return nilaiOverride ?? nilaiDefault; jika persen return (nilai / 100) × netoSetelahVoucher
 */
export function hitungSubtotalBiaya(
  biaya: { tipe: 'nominal' | 'persen'; nilaiDefault?: number; nilai?: number },
  netoSetelahVoucher: number,
  nilaiOverride?: number
): number {
  const safeNeto = Math.max(0, netoSetelahVoucher);
  const effectiveNilai =
    nilaiOverride !== undefined
      ? Number(nilaiOverride)
      : typeof biaya.nilaiDefault === 'number'
      ? biaya.nilaiDefault
      : typeof biaya.nilai === 'number'
      ? biaya.nilai
      : 0;

  if (effectiveNilai <= 0) {
    return 0;
  }

  if (biaya.tipe === 'nominal') {
    return Math.round(Math.max(0, effectiveNilai));
  }

  // persen
  const persen = Math.max(0, effectiveNilai);
  return Math.round((persen / 100) * safeNeto);
}

export const biayaLainCloudService = {
  /**
   * Mengambil semua biaya lain pada outlet tertentu
   * Default mengambil biaya lain aktif dan tidak terhapus, terurut berdasarkan nama
   */
  async getActiveBiayaLain(outletId: string, includeInactive = false): Promise<BiayaLain[]> {
    if (!outletId) return [];

    const colRef = getOutletSubcollectionRef<Omit<BiayaLain, 'id'>>(outletId, 'biaya_lain');
    const q = query(colRef, where('isDeleted', '==', false));
    const snapshot = await getDocs(q);

    const list: BiayaLain[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const val = typeof data.nilaiDefault === 'number' ? data.nilaiDefault : typeof data.nilai === 'number' ? data.nilai : 0;
      return {
        id: docSnap.id,
        outletId: data.outletId || outletId,
        nama: (data.nama || '').trim(),
        tipe: data.tipe === 'persen' ? 'persen' : 'nominal',
        nilaiDefault: val,
        nilai: val,
        aktif: data.aktif !== undefined ? data.aktif : true,
        isDeleted: false,
        deletedAt: data.deletedAt || null,
        version: typeof data.version === 'number' ? data.version : 1,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    // Urutkan nama secara alfabetis ascending
    list.sort((a, b) => a.nama.localeCompare(b.nama));

    if (!includeInactive) {
      return list.filter((b) => b.aktif);
    }

    return list;
  },

  /**
   * Membuat biaya lain baru
   */
  async createBiayaLain(
    outletId: string,
    data: CreateBiayaLainInput,
    uid: string
  ): Promise<BiayaLain> {
    if (!outletId) throw new Error('Parameter outletId wajib diisi.');
    const trimmedNama = data.nama.trim();
    if (!trimmedNama || trimmedNama.length < 2) {
      throw new Error('Nama biaya lain minimal 2 karakter.');
    }

    const numNilai =
      data.nilaiDefault !== undefined
        ? Number(data.nilaiDefault)
        : data.nilai !== undefined
        ? Number(data.nilai)
        : 0;

    if (numNilai <= 0) {
      throw new Error('Nilai biaya lain harus lebih dari 0.');
    }

    if (data.tipe === 'persen' && numNilai > 100) {
      throw new Error('Biaya persen maksimal 100%.');
    }

    const now = new Date().toISOString();
    const newDocData: Omit<BiayaLain, 'id'> = {
      outletId,
      nama: trimmedNama,
      tipe: data.tipe,
      nilaiDefault: numNilai,
      nilai: numNilai,
      aktif: data.aktif !== undefined ? data.aktif : true,
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: uid,
      updatedBy: uid,
      createdAt: now,
      updatedAt: now,
    };

    const payload = sanitizePayload(newDocData as unknown as Record<string, unknown>);
    const docRef = await addDoc(getOutletSubcollectionRef(outletId, 'biaya_lain'), payload);

    return {
      id: docRef.id,
      ...newDocData,
    };
  },

  /**
   * Memperbarui biaya lain
   */
  async updateBiayaLain(
    outletId: string,
    biayaId: string,
    data: UpdateBiayaLainInput,
    uid: string
  ): Promise<void> {
    if (!outletId || !biayaId) throw new Error('Parameter outletId dan biayaId wajib diisi.');

    const docRef = getOutletDocRef(outletId, 'biaya_lain', biayaId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      throw new Error('Biaya lain tidak ditemukan di server.');
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
      const trimmed = data.nama.trim();
      if (!trimmed || trimmed.length < 2) {
        throw new Error('Nama biaya lain minimal 2 karakter.');
      }
      updatePayload.nama = trimmed;
    }

    if (data.tipe !== undefined) {
      updatePayload.tipe = data.tipe;
    }

    const valInput = data.nilaiDefault !== undefined ? data.nilaiDefault : data.nilai;
    if (valInput !== undefined) {
      const numVal = Number(valInput);
      if (numVal <= 0) {
        throw new Error('Nilai biaya lain harus lebih dari 0.');
      }
      if (data.tipe === 'persen' && numVal > 100) {
        throw new Error('Biaya persen maksimal 100%.');
      }
      updatePayload.nilaiDefault = numVal;
      updatePayload.nilai = numVal;
    }

    if (data.aktif !== undefined) {
      updatePayload.aktif = Boolean(data.aktif);
    }

    await updateDoc(docRef, sanitizePayload(updatePayload));
  },

  /**
   * Menghapus biaya lain secara soft-delete
   */
  async softDeleteBiayaLain(outletId: string, biayaId: string, uid: string): Promise<void> {
    if (!outletId || !biayaId) throw new Error('Parameter outletId dan biayaId wajib diisi.');

    const docRef = getOutletDocRef(outletId, 'biaya_lain', biayaId);
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
