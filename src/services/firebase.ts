import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore,
  enableIndexedDbPersistence,
  Firestore,
  collection,
  doc,
  getDocFromServer,
  CollectionReference,
  DocumentReference,
  DocumentData,
} from 'firebase/firestore';

/**
 * Konfigurasi Firebase dari Environment Variables
 * Catatan Keamanan: Semua konfigurasi diambil melalui Vite env vars (import.meta.env).
 * Tidak ada kredensial yang di-hardcode.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

// Inisialisasi Firebase App (Singleton Pattern)
const app: FirebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inisialisasi Firebase Auth
export const auth: Auth = getAuth(app);

// Inisialisasi Cloud Firestore
export const db: Firestore = getFirestore(app);

/**
 * Mengaktifkan offline persistence IndexedDb untuk Firestore.
 * Kasir tetap bisa membaca dan menulis data saat koneksi offline.
 * Data akan otomatis tersinkronisasi saat koneksi internet online kembali.
 */
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Terjadi jika membuka beberapa tab aplikasi sekaligus
      console.warn(
        '[Firebase] Offline persistence dibatasi ke satu tab aktif:',
        err.message
      );
    } else if (err.code === 'unimplemented') {
      // Browser tidak mendukung fitur IndexedDB yang dibutuhkan
      console.warn(
        '[Firebase] Browser tidak mendukung offline persistence Firestore:',
        err.message
      );
    } else {
      console.warn('[Firebase] Gagal mengaktifkan offline persistence:', err);
    }
  });
}

/**
 * Standard Error Handler untuk Operasi Firestore
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
    },
  };
  console.error('[Firestore Error]', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Helper untuk mendapatkan referensi subcollection di dalam outlet
 * Path: outlets/{outletId}/{subcollectionName}
 */
export function getOutletSubcollectionRef<T = DocumentData>(
  outletId: string,
  subcollectionName: string
): CollectionReference<T> {
  return collection(db, 'outlets', outletId, subcollectionName) as CollectionReference<T>;
}

/**
 * Helper untuk mendapatkan referensi dokumen di dalam subcollection outlet
 * Path: outlets/{outletId}/{subcollectionName}/{docId}
 */
export function getOutletDocRef<T = DocumentData>(
  outletId: string,
  subcollectionName: string,
  docId: string
): DocumentReference<T> {
  return doc(db, 'outlets', outletId, subcollectionName, docId) as DocumentReference<T>;
}

/**
 * Uji koneksi aktif ke Firestore Server
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, '_connection_test', 'ping'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firebase] Client sedang offline. Memakai cache lokal.');
      return false;
    }
    // Jika hanya permission denied pada koleksi ping, artinya jaringan terhubung ke Firebase
    return true;
  }
}

export default app;
