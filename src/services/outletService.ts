import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { Outlet } from '../types';

/**
 * Helper internal untuk membuang semua properti bernilai undefined
 * agar Firestore addDoc / updateDoc tidak melempar error "Unsupported field value: undefined".
 */
function sanitizePayload<T extends Record<string, any>>(data: T): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Service untuk mengelola CRUD Outlet di collection 'outlets' (Super Admin)
 */
export const outletService = {
  // Ambil semua outlet (tanpa filter, karena hanya super_admin yang bisa akses)
  async getAll(): Promise<Outlet[]> {
    const snapshot = await getDocs(collection(db, 'outlets'));
    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        nama: data.nama || '',
        alamat: data.alamat || '',
        telepon: data.telepon || '',
        ownerIds: Array.isArray(data.ownerIds) ? data.ownerIds : [],
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      } as Outlet;
    });
  },

  // Tambah outlet baru
  async create(data: Omit<Outlet, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = new Date().toISOString();
    const payload = sanitizePayload({
      ...data,
      ownerIds: data.ownerIds || [],
      createdAt: now,
      updatedAt: now,
    });
    const docRef = await addDoc(collection(db, 'outlets'), payload);
    return docRef.id;
  },

  // Update outlet
  async update(id: string, data: Partial<Omit<Outlet, 'id' | 'createdAt'>>): Promise<void> {
    const payload = sanitizePayload({
      ...data,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, 'outlets', id), payload);
  },

  // Hapus outlet (hard delete, karena tidak ada subcollection yang perlu dipertahankan)
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(db, 'outlets', id));
  },

  // Hitung jumlah user yang tertaut ke outlet tertentu
  async countAssignedUsers(outletId: string): Promise<number> {
    const q = query(collection(db, 'users'), where('outletIds', 'array-contains', outletId));
    const snapshot = await getDocs(q);
    return snapshot.size;
  },
};
