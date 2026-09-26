import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Outlet } from '../../types';
import { sanitizePayload } from './cloudUtils';

/**
 * Hash PIN 4-6 digit menggunakan Web Crypto API (SHA-256 + salt outlet)
 */
export async function hashPin(pin: string, salt: string = 'pos-fnb-salt'): Promise<string> {
  const cleanPin = pin.trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(`pos-pin:${salt}:${cleanPin}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface VerifyPinResult {
  valid: boolean;
  outletData?: Outlet;
  message?: string;
  hasPinConfigured: boolean;
}

export const pinOwnerCloudService = {
  /**
   * Menghasilkan hash SHA-256 dari PIN
   */
  async hashPin(pin: string, salt: string = 'pos-fnb-salt'): Promise<string> {
    return hashPin(pin, salt);
  },

  /**
   * Cek apakah outlet sudah mengonfigurasi PIN Owner
   */
  async checkPinStatus(outletId: string): Promise<{ hasPin: boolean; pinSetAt?: string }> {
    if (!outletId) return { hasPin: false };

    const outletRef = doc(db, 'outlets', outletId);
    const snap = await getDoc(outletRef);
    if (!snap.exists()) return { hasPin: false };

    const data = snap.data();
    return {
      hasPin: Boolean(data.pinOwnerHash),
      pinSetAt: data.pinOwnerSetAt || undefined,
    };
  },

  /**
   * Menyimpan PIN Owner baru untuk outlet
   */
  async setPinOwner(outletId: string, pin: string, uid: string): Promise<void> {
    if (!outletId) throw new Error('Parameter outletId wajib diisi.');
    const cleanPin = pin.trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      throw new Error('PIN harus berupa 4 hingga 6 digit angka.');
    }

    const hashed = await hashPin(cleanPin, outletId);
    const nowIso = new Date().toISOString();
    const outletRef = doc(db, 'outlets', outletId);

    await updateDoc(
      outletRef,
      sanitizePayload({
        pinOwnerHash: hashed,
        pinOwnerSetAt: nowIso,
        updatedAt: nowIso,
      })
    );
  },

  /**
   * Memverifikasi input PIN dengan hash tersimpan di outlet
   */
  async verifyPinOwner(outletId: string, pin: string): Promise<VerifyPinResult> {
    if (!outletId) {
      return { valid: false, hasPinConfigured: false, message: 'Outlet tidak valid.' };
    }

    const cleanPin = pin.trim();
    if (!cleanPin) {
      return { valid: false, hasPinConfigured: false, message: 'Masukkan PIN Owner.' };
    }

    const outletRef = doc(db, 'outlets', outletId);
    const snap = await getDoc(outletRef);
    if (!snap.exists()) {
      return { valid: false, hasPinConfigured: false, message: 'Outlet tidak ditemukan.' };
    }

    const data = snap.data() as Outlet;
    if (!data.pinOwnerHash) {
      return {
        valid: false,
        hasPinConfigured: false,
        outletData: { ...data, id: snap.id },
        message: 'PIN Owner belum diatur pada outlet ini. Hubungi Owner untuk mengatur PIN.',
      };
    }

    const hashedInput = await hashPin(cleanPin, outletId);
    if (hashedInput === data.pinOwnerHash) {
      return {
        valid: true,
        hasPinConfigured: true,
        outletData: { ...data, id: snap.id },
      };
    }

    return {
      valid: false,
      hasPinConfigured: true,
      outletData: { ...data, id: snap.id },
      message: 'PIN Owner salah. Pastikan PIN 4-6 digit yang dimasukkan benar.',
    };
  },

  /**
   * Mengubah PIN Owner (wajib verifikasi PIN lama terlebih dahulu)
   */
  async changePinOwner(
    outletId: string,
    pinLama: string,
    pinBaru: string,
    uid: string
  ): Promise<void> {
    if (!outletId) throw new Error('Parameter outletId wajib diisi.');

    // Cek apakah sudah ada PIN lama
    const status = await this.checkPinStatus(outletId);
    if (status.hasPin) {
      const verify = await this.verifyPinOwner(outletId, pinLama);
      if (!verify.valid) {
        throw new Error(verify.message || 'PIN lama yang Anda masukkan salah.');
      }
    }

    const cleanPinBaru = pinBaru.trim();
    if (!/^\d{4,6}$/.test(cleanPinBaru)) {
      throw new Error('PIN baru harus berupa 4 hingga 6 digit angka.');
    }

    await this.setPinOwner(outletId, cleanPinBaru, uid);
  },
};
