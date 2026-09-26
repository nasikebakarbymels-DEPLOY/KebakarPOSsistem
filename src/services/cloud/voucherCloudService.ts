import {
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
} from 'firebase/firestore';
import { getOutletSubcollectionRef, getOutletDocRef } from '../firebase';
import { Voucher } from '../../types';
import { sanitizePayload } from './cloudUtils';

export interface CreateVoucherInput {
  kode?: string;
  tipe: 'nominal' | 'persen';
  nilai: number;
  aktif?: boolean;
  minBelanja?: number;
  tanggalBerakhir?: string; // YYYY-MM-DD
}

export function generateRandomVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface UpdateVoucherInput {
  kode?: string;
  tipe?: 'nominal' | 'persen';
  nilai?: number;
  aktif?: boolean;
  minBelanja?: number | null;
  tanggalBerakhir?: string | null;
}

export interface ValidateVoucherResult {
  valid: boolean;
  voucher: Voucher | null;
  error?: string;
}

export const voucherCloudService = {
  /**
   * Mengambil semua voucher pada outlet tertentu (termasuk inaktif)
   */
  async getAllVoucher(outletId: string): Promise<Voucher[]> {
    return this.getActiveVoucher(outletId, true);
  },

  /**
   * Mengambil semua voucher pada outlet tertentu
   * Default mengambil voucher aktif dan tidak terhapus, terurut berdasarkan kode
   */
  async getActiveVoucher(outletId: string, includeInactive = false): Promise<Voucher[]> {
    if (!outletId) return [];

    const colRef = getOutletSubcollectionRef<Omit<Voucher, 'id'>>(outletId, 'voucher');
    const q = query(colRef, where('isDeleted', '==', false));
    const snapshot = await getDocs(q);

    const list: Voucher[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        outletId: data.outletId || outletId,
        kode: (data.kode || '').toUpperCase().trim(),
        tipe: data.tipe === 'persen' ? 'persen' : 'nominal',
        nilai: typeof data.nilai === 'number' ? data.nilai : 0,
        aktif: data.aktif !== undefined ? data.aktif : true,
        minBelanja: typeof data.minBelanja === 'number' ? data.minBelanja : undefined,
        tanggalBerakhir: data.tanggalBerakhir || undefined,
        isDeleted: false,
        deletedAt: data.deletedAt || null,
        version: typeof data.version === 'number' ? data.version : 1,
        createdBy: data.createdBy,
        updatedBy: data.updatedBy,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    // Urutkan kode secara alfabetis ascending
    list.sort((a, b) => a.kode.localeCompare(b.kode));

    if (!includeInactive) {
      return list.filter((v) => v.aktif);
    }

    return list;
  },

  /**
   * Validasi voucher dengan alasan error lengkap untuk feedback kasir
   */
  async validateVoucherWithReason(
    outletId: string,
    kode: string,
    subtotalNeto: number
  ): Promise<ValidateVoucherResult> {
    if (!outletId || !kode || !kode.trim()) {
      return { valid: false, voucher: null, error: 'Masukkan kode voucher.' };
    }

    const cleanKode = kode.trim().toUpperCase();
    const activeVouchers = await this.getActiveVoucher(outletId, true);

    const voucher = activeVouchers.find(
      (v) => v.kode.toUpperCase() === cleanKode && !v.isDeleted
    );

    if (!voucher || !voucher.aktif) {
      return {
        valid: false,
        voucher: null,
        error: `Kode voucher "${cleanKode}" tidak ditemukan atau tidak aktif.`,
      };
    }

    // 1. Cek tanggal kedaluwarsa
    if (voucher.tanggalBerakhir) {
      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;

      if (voucher.tanggalBerakhir < todayStr) {
        return {
          valid: false,
          voucher: null,
          error: `Voucher "${cleanKode}" telah kedaluwarsa pada ${voucher.tanggalBerakhir}.`,
        };
      }
    }

    // 2. Cek minimum belanja
    if (voucher.minBelanja !== undefined && voucher.minBelanja > 0) {
      if (subtotalNeto < voucher.minBelanja) {
        return {
          valid: false,
          voucher: null,
          error: `Minimum belanja Rp${voucher.minBelanja.toLocaleString('id-ID')}.`,
        };
      }
    }

    return { valid: true, voucher };
  },

  /**
   * Validasi voucher: return Voucher jika valid, null jika tidak valid
   */
  async validateVoucher(
    outletId: string,
    kode: string,
    subtotalNeto: number
  ): Promise<Voucher | null> {
    const res = await this.validateVoucherWithReason(outletId, kode, subtotalNeto);
    return res.valid ? res.voucher : null;
  },

  /**
   * Membuat voucher baru
   */
  async createVoucher(
    outletId: string,
    data: CreateVoucherInput,
    uid: string
  ): Promise<Voucher> {
    if (!outletId) throw new Error('Parameter outletId wajib diisi.');
    const rawKode = data.kode && data.kode.trim() ? data.kode.trim() : generateRandomVoucherCode();
    const trimmedKode = rawKode.toUpperCase();
    if (trimmedKode.length < 2) {
      throw new Error('Kode voucher minimal 2 karakter.');
    }

    if (data.nilai <= 0) {
      throw new Error('Nilai diskon voucher harus lebih dari 0.');
    }

    if (data.tipe === 'persen' && data.nilai > 100) {
      throw new Error('Diskon persen maksimal 100%.');
    }

    // Cek duplikasi kode aktif di outlet ini
    const existing = await this.getActiveVoucher(outletId, true);
    if (existing.some((v) => v.kode.toUpperCase() === trimmedKode)) {
      throw new Error(`Voucher dengan kode "${trimmedKode}" sudah ada di outlet ini.`);
    }

    const now = new Date().toISOString();
    const newDocData: Omit<Voucher, 'id'> = {
      outletId,
      kode: trimmedKode,
      tipe: data.tipe,
      nilai: Number(data.nilai),
      aktif: data.aktif !== undefined ? data.aktif : true,
      minBelanja: data.minBelanja ? Number(data.minBelanja) : undefined,
      tanggalBerakhir: data.tanggalBerakhir ? data.tanggalBerakhir.trim() : undefined,
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: uid,
      updatedBy: uid,
      createdAt: now,
      updatedAt: now,
    };

    const payload = sanitizePayload(newDocData as unknown as Record<string, unknown>);
    const docRef = await addDoc(getOutletSubcollectionRef(outletId, 'voucher'), payload);

    return {
      id: docRef.id,
      ...newDocData,
    };
  },

  /**
   * Memperbarui voucher yang ada
   */
  async updateVoucher(
    outletId: string,
    voucherId: string,
    data: UpdateVoucherInput,
    uid: string
  ): Promise<void> {
    if (!outletId || !voucherId) throw new Error('Parameter outletId dan voucherId wajib diisi.');

    const docRef = getOutletDocRef(outletId, 'voucher', voucherId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      throw new Error('Voucher tidak ditemukan di server.');
    }
    const currentData = existingSnap.data();

    const now = new Date().toISOString();
    const nextVersion = (typeof currentData.version === 'number' ? currentData.version : 1) + 1;

    const updatePayload: Record<string, unknown> = {
      version: nextVersion,
      updatedAt: now,
      updatedBy: uid,
    };

    if (data.kode !== undefined) {
      const trimmed = data.kode.trim().toUpperCase();
      if (!trimmed || trimmed.length < 2) {
        throw new Error('Kode voucher minimal 2 karakter.');
      }
      updatePayload.kode = trimmed;
    }

    if (data.tipe !== undefined) {
      updatePayload.tipe = data.tipe;
    }

    if (data.nilai !== undefined) {
      if (data.nilai <= 0) {
        throw new Error('Nilai diskon harus lebih dari 0.');
      }
      if (data.tipe === 'persen' && data.nilai > 100) {
        throw new Error('Diskon persen maksimal 100%.');
      }
      updatePayload.nilai = Number(data.nilai);
    }

    if (data.aktif !== undefined) {
      updatePayload.aktif = Boolean(data.aktif);
    }

    if (data.minBelanja !== undefined) {
      updatePayload.minBelanja = data.minBelanja && data.minBelanja > 0 ? Number(data.minBelanja) : null;
    }

    if (data.tanggalBerakhir !== undefined) {
      updatePayload.tanggalBerakhir = data.tanggalBerakhir ? data.tanggalBerakhir.trim() : null;
    }

    await updateDoc(docRef, sanitizePayload(updatePayload));
  },

  /**
   * Menghapus voucher secara soft-delete
   */
  async softDeleteVoucher(outletId: string, voucherId: string, uid: string): Promise<void> {
    if (!outletId || !voucherId) throw new Error('Parameter outletId dan voucherId wajib diisi.');

    const docRef = getOutletDocRef(outletId, 'voucher', voucherId);
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
