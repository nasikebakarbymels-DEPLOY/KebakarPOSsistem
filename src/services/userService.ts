import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import app, { auth, db } from './firebase';
import { User, UserRole, UserStatus } from '../types';

/**
 * Secondary Firebase App singleton untuk create user baru
 * agar sesi super_admin di tab utama tidak tertimpa/terganti.
 */
const SECONDARY_APP_NAME = 'user-admin-secondary';
const secondaryApp = getApps().some((a) => a.name === SECONDARY_APP_NAME)
  ? getApp(SECONDARY_APP_NAME)
  : initializeApp(app.options, SECONDARY_APP_NAME);
const secondaryAuth = getAuth(secondaryApp);

/**
 * Helper sanitasi wajib untuk membuang semua properti bernilai undefined
 * sebelum dikirim ke setDoc / updateDoc / addDoc Firestore.
 */
function sanitizePayload<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export interface CreateUserInput {
  nama: string;
  email: string;
  password: string;
  role: 'owner' | 'kasir';
  outletIds: string[];
}

export interface UpdateUserProfileInput {
  nama?: string;
  role?: UserRole;
  outletIds?: string[];
  status?: UserStatus;
}

export const userService = {
  /**
   * Mengambil semua user dari collection 'users', diurutkan berdasarkan nama
   */
  async getAllUsers(): Promise<User[]> {
    const snapshot = await getDocs(collection(db, 'users'));
    const users: User[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        email: data.email || '',
        nama: data.nama || '',
        role: (data.role as UserRole) || 'kasir',
        outletIds: Array.isArray(data.outletIds) ? data.outletIds : [],
        activeOutletId: data.activeOutletId || undefined,
        outletId: data.outletId || data.activeOutletId || undefined,
        outletName: data.outletName || undefined,
        status: (data.status as UserStatus) || 'active',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    });

    return users.sort((a, b) => a.nama.localeCompare(b.nama, 'id', { sensitivity: 'base' }));
  },

  /**
   * Membuat user baru via Firebase Auth (secondary app) dan menyimpan profil ke Firestore.
   * Dilengkapi mekanisme rollback otomatis jika terjadi kegagalan saat menulis ke Firestore.
   */
  async createUserWithAuth(input: CreateUserInput): Promise<string> {
    const { nama, email, password, role, outletIds } = input;
    const now = new Date().toISOString();

    // Validasi kebijakan 1 outlet untuk role kasir
    if (role === 'kasir' && (!Array.isArray(outletIds) || outletIds.length !== 1)) {
      throw new Error('Kasir hanya dapat ditugaskan ke tepat satu outlet.');
    }

    // 1. Buat user di secondary Auth
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(secondaryAuth, email.trim(), password);
    } catch (authErr: unknown) {
      const err = authErr as { code?: string; message?: string };
      if (err?.code === 'auth/email-already-in-use') {
        throw new Error('Email sudah terdaftar dalam sistem.');
      }
      if (err?.code === 'auth/weak-password') {
        throw new Error('Kata sandi terlalu lemah. Minimal 8 karakter.');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new Error('Format email tidak valid.');
      }
      throw new Error(err?.message || 'Gagal mendaftarkan autentikasi pengguna.');
    }

    const newUid = cred.user.uid;

    try {
      // 2. Tulis profil ke Firestore (Primary db) dengan sanitasi payload
      const userPayload = sanitizePayload({
        email: email.trim().toLowerCase(),
        nama: nama.trim(),
        role,
        outletIds: outletIds || [],
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'users', newUid), userPayload);

      // 3. Jika role === 'owner', tambahkan UID ke ownerIds di tiap outlet terkait
      if (role === 'owner' && Array.isArray(outletIds) && outletIds.length > 0) {
        for (const oId of outletIds) {
          try {
            await updateDoc(doc(db, 'outlets', oId), {
              ownerIds: arrayUnion(newUid),
              updatedAt: now,
            });
          } catch (outletErr) {
            console.warn(`[userService] Gagal menambahkan ownerId ke outlet ${oId}:`, outletErr);
          }
        }
      }

      return newUid;
    } catch (firestoreErr) {
      // 4. ROLLBACK: Hapus user di secondary Auth agar tidak ada akun yatim (orphan)
      console.error('[userService] Terjadi error penulisan Firestore. Memulai rollback...', firestoreErr);
      try {
        await deleteUser(cred.user);
      } catch (delErr) {
        console.error('[userService] Gagal menghapus akun secondary saat rollback:', delErr);
      }
      throw new Error('Gagal menyimpan profil pengguna ke database.');
    } finally {
      // 5. Pastikan selalu logout dari secondaryAuth
      try {
        await signOut(secondaryAuth);
      } catch (signOutErr) {
        console.warn('[userService] Gagal signOut secondaryAuth:', signOutErr);
      }
    }
  },

  /**
   * Memperbarui profil pengguna dan menyinkronkan status ownerIds pada outlet
   */
  async updateUserProfile(uid: string, data: UpdateUserProfileInput): Promise<void> {
    const now = new Date().toISOString();

    // 1. Ambil data profil lama terlebih dahulu
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error('Pengguna tidak ditemukan.');
    }

    const prevData = userSnap.data();
    if (prevData?.role === 'super_admin') {
      throw new Error('Akun Super Admin tidak dapat diubah dari aplikasi. Gunakan Firebase Console.');
    }
    const prevRole: UserRole = prevData?.role || 'kasir';
    const prevOutletIds: string[] = Array.isArray(prevData?.outletIds) ? prevData.outletIds : [];

    const finalRole = data.role || prevRole;
    const finalOutletIds = data.outletIds !== undefined ? data.outletIds : prevOutletIds;

    // Validasi kebijakan 1 outlet untuk role kasir
    if (finalRole === 'kasir' && finalOutletIds.length !== 1) {
      throw new Error('Kasir hanya dapat ditugaskan ke tepat satu outlet.');
    }

    // 2. Sanitasi payload dan simpan update ke Firestore
    const payload = sanitizePayload({
      nama: data.nama !== undefined ? data.nama.trim() : undefined,
      role: data.role !== undefined ? data.role : undefined,
      outletIds: data.outletIds !== undefined ? data.outletIds : undefined,
      status: data.status !== undefined ? data.status : undefined,
      updatedAt: now,
    });

    await updateDoc(userRef, payload);

    // 3. Sinkronisasi ownerIds pada outlets
    if (finalRole === 'owner') {
      // Masukkan UID ke seluruh outlet yang ditugaskan
      for (const oId of finalOutletIds) {
        try {
          await updateDoc(doc(db, 'outlets', oId), {
            ownerIds: arrayUnion(uid),
            updatedAt: now,
          });
        } catch (err) {
          console.warn(`[userService] Gagal update arrayUnion ownerIds pada outlet ${oId}:`, err);
        }
      }

      // Hapus UID dari outlet yang sebelumnya dimiliki namun sudah tidak ada di finalOutletIds
      const removedOutlets = prevOutletIds.filter((oId) => !finalOutletIds.includes(oId));
      for (const oId of removedOutlets) {
        try {
          await updateDoc(doc(db, 'outlets', oId), {
            ownerIds: arrayRemove(uid),
            updatedAt: now,
          });
        } catch (err) {
          console.warn(`[userService] Gagal update arrayRemove ownerIds pada outlet ${oId}:`, err);
        }
      }
    } else {
      // Jika peran akhir bukan owner (misal: kasir), hapus dari seluruh outlet yang sebelumnya dimiliki
      for (const oId of prevOutletIds) {
        try {
          await updateDoc(doc(db, 'outlets', oId), {
            ownerIds: arrayRemove(uid),
            updatedAt: now,
          });
        } catch (err) {
          console.warn(`[userService] Gagal menghapus ownerIds dari outlet ${oId}:`, err);
        }
      }
    }
  },

  /**
   * Mengirim email reset kata sandi melalui Firebase Auth utama
   */
  async sendPasswordResetEmailToUser(email: string): Promise<void> {
    if (!email || !email.trim()) {
      throw new Error('Alamat email tidak boleh kosong.');
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error?.code === 'auth/user-not-found' || error?.code === 'auth/invalid-email') {
        throw new Error('Alamat email tidak terdaftar di sistem autentikasi.');
      }
      throw new Error(error?.message || 'Gagal mengirim email reset kata sandi.');
    }
  },
};
