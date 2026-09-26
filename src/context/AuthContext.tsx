import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { syncQueueService } from '../services/localDb';
import { User, UserRole, Outlet, UserStatus } from '../types';

export interface AuthContextType {
  user: User | null;
  currentOutlet: Outlet | null;
  availableOutlets: Outlet[];
  isLoading: boolean;
  isOnline: boolean;
  pendingSyncCount: number;
  login: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  selectOutlet: (outletOrId: string | Outlet) => void;
  refreshUserData: () => Promise<void>;
  refreshPendingSyncCount: () => Promise<void>;
  unauthorizedAttemptMessage: string | null;
  setUnauthorizedAttemptMessage: (msg: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'pos_fnb_user_session';
const STORAGE_KEY_OUTLET_ID = 'pos_fnb_active_outlet_id';
const STORAGE_KEY_OUTLETS_CACHE = 'pos_fnb_outlets_cache';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [availableOutlets, setAvailableOutlets] = useState<Outlet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_OUTLETS_CACHE);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(() => {
    try {
      const savedOutletsStr = localStorage.getItem(STORAGE_KEY_OUTLETS_CACHE);
      const savedOutletId = localStorage.getItem(STORAGE_KEY_OUTLET_ID);
      if (savedOutletsStr && savedOutletId) {
        const outlets: Outlet[] = JSON.parse(savedOutletsStr);
        return outlets.find((o) => o.id === savedOutletId) || null;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
  const [unauthorizedAttemptMessage, setUnauthorizedAttemptMessage] = useState<string | null>(null);

  // Monitor jumlah pending sync dari IndexedDB
  const refreshPendingSyncCount = useCallback(async () => {
    try {
      const count = await syncQueueService.getPendingCount();
      setPendingSyncCount(count);
    } catch (err) {
      console.warn('[AuthContext] Gagal memeriksa pending sync count:', err);
    }
  }, []);

  // Ambil data profil user dari Firestore
  const fetchUserProfileAndOutlets = useCallback(
    async (fbUser: FirebaseUser): Promise<{ user: User; outlets: Outlet[]; activeOutlet: Outlet | null }> => {
      const userDocRef = doc(db, 'users', fbUser.uid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        throw new Error(
          'Profil pengguna belum terdaftar di Firestore (users/' + fbUser.uid + '). Hubungi Super Admin.'
        );
      }

      const rawData = userSnap.data();
      const status: UserStatus = rawData.status === 'disabled' ? 'disabled' : 'active';
      if (status === 'disabled') {
        throw new Error('Akun Anda dinonaktifkan oleh administrator.');
      }

      const role: UserRole = rawData.role || 'kasir';
      const outletIds: string[] = Array.isArray(rawData.outletIds) ? rawData.outletIds : [];

      // Ambil daftar outlet yang dapat diakses oleh user ini
      let outlets: Outlet[] = [];
      if (role === 'super_admin') {
        try {
          const outletsSnap = await getDocs(collection(db, 'outlets'));
          outlets = outletsSnap.docs.map((dSnap) => {
            const oData = dSnap.data();
            return {
              id: dSnap.id,
              nama: oData.nama || 'Outlet Tanpa Nama',
              alamat: oData.alamat,
              telepon: oData.telepon,
              ownerIds: Array.isArray(oData.ownerIds) ? oData.ownerIds : [],
              createdAt: oData.createdAt || new Date().toISOString(),
              updatedAt: oData.updatedAt || new Date().toISOString(),
            } as Outlet;
          });
        } catch (e) {
          console.warn('[AuthContext] Gagal mengambil daftar seluruh outlet untuk super_admin:', e);
        }
      } else if (outletIds.length > 0) {
        const outletPromises = outletIds.map(async (oid: string) => {
          try {
            const oSnap = await getDoc(doc(db, 'outlets', oid));
            if (oSnap.exists()) {
              const oData = oSnap.data();
              return {
                id: oSnap.id,
                nama: oData.nama || 'Outlet Tanpa Nama',
                alamat: oData.alamat,
                telepon: oData.telepon,
                ownerIds: Array.isArray(oData.ownerIds) ? oData.ownerIds : [],
                createdAt: oData.createdAt || new Date().toISOString(),
                updatedAt: oData.updatedAt || new Date().toISOString(),
              } as Outlet;
            }
          } catch (e) {
            console.warn(`[AuthContext] Gagal mengambil dokumen outlets/${oid}:`, e);
          }
          return null;
        });

        const resolved = await Promise.all(outletPromises);
        outlets = resolved.filter((o): o is Outlet => o !== null);
      }

      // Tentukan outlet aktif
      let activeOutlet: Outlet | null = null;
      if (role === 'super_admin') {
        activeOutlet = null;
      } else if (outlets.length > 0) {
        const savedActiveOutletId = localStorage.getItem(STORAGE_KEY_OUTLET_ID);
        if (savedActiveOutletId && outlets.some((o) => o.id === savedActiveOutletId)) {
          activeOutlet = outlets.find((o) => o.id === savedActiveOutletId) || null;
        } else {
          activeOutlet = outlets[0];
        }
      }

      const appUser: User = {
        id: fbUser.uid,
        email: fbUser.email || rawData.email || '',
        nama: rawData.nama || fbUser.displayName || 'Pengguna',
        role,
        outletIds,
        activeOutletId: activeOutlet?.id,
        outletId: activeOutlet?.id,
        outletName: activeOutlet?.nama,
        status,
        createdAt: rawData.createdAt || new Date().toISOString(),
        updatedAt: rawData.updatedAt || new Date().toISOString(),
      };

      return { user: appUser, outlets, activeOutlet };
    },
    []
  );

  // Monitor sesi autentikasi Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          const { user: appUser, outlets, activeOutlet } = await fetchUserProfileAndOutlets(fbUser);

          // Cek jika status user dinonaktifkan
          if (appUser.status === 'disabled') {
            await signOut(auth);
            setUser(null);
            setCurrentOutlet(null);
            setAvailableOutlets([]);
            localStorage.removeItem(STORAGE_KEY_USER);
            localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
            localStorage.removeItem(STORAGE_KEY_OUTLETS_CACHE);
            setIsLoading(false);
            return;
          }

          setUser(appUser);
          setAvailableOutlets(outlets);
          setCurrentOutlet(activeOutlet);

          localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(appUser));
          localStorage.setItem(STORAGE_KEY_OUTLETS_CACHE, JSON.stringify(outlets));
          if (activeOutlet) {
            localStorage.setItem(STORAGE_KEY_OUTLET_ID, activeOutlet.id);
          } else {
            localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
          }
        } catch (err) {
          console.error('[AuthContext] Gagal sinkronisasi data user dari Firestore:', err);
          const errMsg = err instanceof Error ? err.message : String(err || '');
          if (errMsg.toLowerCase().includes('dinonaktifkan')) {
            localStorage.removeItem(STORAGE_KEY_USER);
            localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
            localStorage.removeItem(STORAGE_KEY_OUTLETS_CACHE);
            setUser(null);
            setCurrentOutlet(null);
            setAvailableOutlets([]);
            try {
              await signOut(auth);
            } catch (soErr) {
              console.warn('[AuthContext] Error signOut disabled user:', soErr);
            }
          } else {
            // Fallback ke cache localStorage HANYA boleh jika navigator.onLine === false DAN id user cache sama dengan fbUser.uid
            let restored = false;
            if (navigator.onLine === false) {
              const cachedUserStr = localStorage.getItem(STORAGE_KEY_USER);
              if (cachedUserStr) {
                try {
                  const cachedUser = JSON.parse(cachedUserStr) as User;
                  if (cachedUser && cachedUser.id === fbUser.uid) {
                    setUser(cachedUser);
                    restored = true;
                  }
                } catch {
                  // abaikan parse error
                }
              }
            }
            if (!restored) {
              setUser(null);
              setCurrentOutlet(null);
              setAvailableOutlets([]);
            }
          }
        }
      } else {
        setUser(null);
        setCurrentOutlet(null);
        setAvailableOutlets([]);
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
        localStorage.removeItem(STORAGE_KEY_OUTLETS_CACHE);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [fetchUserProfileAndOutlets]);

  // Revalidasi senyap: tiap 5 menit, plus event window 'online' dan 'focus' (maksimal sekali per 60 detik)
  const lastRevalidateRef = useRef<number>(0);

  useEffect(() => {
    const performSilentRevalidation = async () => {
      const now = Date.now();
      if (now - lastRevalidateRef.current < 60000) {
        return;
      }
      lastRevalidateRef.current = now;

      if (!auth.currentUser) return;

      try {
        const { user: appUser, outlets, activeOutlet } = await fetchUserProfileAndOutlets(
          auth.currentUser
        );
        if (appUser.status === 'disabled') {
          throw new Error('Akun Anda dinonaktifkan oleh administrator.');
        }
        setUser(appUser);
        setAvailableOutlets(outlets);
        setCurrentOutlet(activeOutlet);
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(appUser));
        localStorage.setItem(STORAGE_KEY_OUTLETS_CACHE, JSON.stringify(outlets));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || '');
        if (msg.toLowerCase().includes('dinonaktifkan')) {
          console.warn('[AuthContext] Sesi dinonaktifkan terdeteksi saat revalidasi senyap.');
          localStorage.removeItem(STORAGE_KEY_USER);
          localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
          localStorage.removeItem(STORAGE_KEY_OUTLETS_CACHE);
          setUser(null);
          setCurrentOutlet(null);
          setAvailableOutlets([]);
          try {
            await signOut(auth);
          } catch (soErr) {
            console.warn('[AuthContext] Error signOut saat revalidasi:', soErr);
          }
        } else {
          console.warn('[AuthContext] Revalidasi senyap gagal (kendala jaringan/offline):', err);
        }
      }
    };

    const intervalId = setInterval(() => {
      performSilentRevalidation();
    }, 5 * 60 * 1000); // 5 menit

    const handleWindowFocus = () => {
      performSilentRevalidation();
    };

    const handleWindowOnline = () => {
      performSilentRevalidation();
    };

    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleWindowOnline);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleWindowOnline);
    };
  }, [fetchUserProfileAndOutlets]);

  // Pantau status koneksi online / offline dan event sync queue
  useEffect(() => {
    refreshPendingSyncCount();

    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingSyncCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingSyncCount();
    };
    const handleSyncQueueUpdated = () => {
      refreshPendingSyncCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('pos_fnb_sync_queue_updated', handleSyncQueueUpdated);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('pos_fnb_sync_queue_updated', handleSyncQueueUpdated);
    };
  }, [refreshPendingSyncCount]);

  /**
   * Fungsi untuk memilih outlet aktif
   * Mendukung parameter outletId (string) atau Objek Outlet
   */
  const selectOutlet = (outletOrId: string | Outlet) => {
    const targetId = typeof outletOrId === 'string' ? outletOrId : outletOrId.id;

    if (!user) return;
    if (user.role === 'super_admin') {
      setCurrentOutlet(null);
      localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
      return;
    }
    if (user.role === 'kasir') {
      setUnauthorizedAttemptMessage(
        'Kasir tidak dapat mengganti outlet aktif. Hubungi owner atau Super Admin untuk pemindahan penugasan.'
      );
      return;
    }

    // Validasi bahwa outletId ada di dalam user.outletIds
    if (!user.outletIds.includes(targetId)) {
      setUnauthorizedAttemptMessage('Akses ditolak: Anda tidak memiliki akses ke outlet ini.');
      return;
    }

    const matched = availableOutlets.find((o) => o.id === targetId);
    if (!matched) {
      setUnauthorizedAttemptMessage('Outlet tidak ditemukan dalam daftar outlet Anda.');
      return;
    }

    setCurrentOutlet(matched);
    localStorage.setItem(STORAGE_KEY_OUTLET_ID, matched.id);

    // Update activeOutletId di state dan localStorage
    const updatedUser: User = {
      ...user,
      activeOutletId: matched.id,
      outletId: matched.id,
      outletName: matched.nama,
    };
    setUser(updatedUser);
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser));
  };

  /**
   * Login via Firebase Authentication (Email & Password)
   */
  const login = async (
    emailInput: string,
    passInput: string
  ): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    setUnauthorizedAttemptMessage(null);

    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail) {
      setIsLoading(false);
      return { success: false, message: 'Alamat email wajib diisi.' };
    }
    if (!passInput) {
      setIsLoading(false);
      return { success: false, message: 'Kata sandi wajib diisi.' };
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, passInput);
      const { user: appUser, outlets, activeOutlet } = await fetchUserProfileAndOutlets(
        userCredential.user
      );

      if (appUser.status === 'disabled') {
        await signOut(auth);
        setUser(null);
        setCurrentOutlet(null);
        setAvailableOutlets([]);
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
        localStorage.removeItem(STORAGE_KEY_OUTLETS_CACHE);
        setIsLoading(false);
        return { success: false, message: 'Akun Anda telah dinonaktifkan. Hubungi Super Admin.' };
      }

      setUser(appUser);
      setAvailableOutlets(outlets);
      setCurrentOutlet(activeOutlet);

      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(appUser));
      localStorage.setItem(STORAGE_KEY_OUTLETS_CACHE, JSON.stringify(outlets));
      if (activeOutlet) {
        localStorage.setItem(STORAGE_KEY_OUTLET_ID, activeOutlet.id);
      } else {
        localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
      }

      await refreshPendingSyncCount();
      setIsLoading(false);
      window.history.pushState(null, '', '/');
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      console.error('[AuthContext] Login error:', err);

      let friendlyMessage = 'Gagal masuk. Terjadi kendala pada sistem.';
      const code = err?.code || '';

      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        friendlyMessage = 'Email atau kata sandi tidak cocok. Silakan periksa kembali.';
      } else if (code === 'auth/invalid-email') {
        friendlyMessage = 'Format alamat email tidak valid.';
      } else if (code === 'auth/user-disabled') {
        friendlyMessage = 'Akun pengguna ini telah dinonaktifkan.';
      } else if (code === 'auth/too-many-requests') {
        friendlyMessage = 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat lagi.';
      } else if (code === 'auth/network-request-failed') {
        friendlyMessage = 'Gagal terhubung ke server Firebase. Periksa koneksi internet Anda.';
      } else if (err instanceof Error && err.message) {
        friendlyMessage = err.message;
      }

      if (friendlyMessage.toLowerCase().includes('dinonaktifkan')) {
        try {
          await signOut(auth);
        } catch (signOutErr) {
          console.warn('[AuthContext] Gagal signOut saat login akun nonaktif:', signOutErr);
        }
        setUser(null);
        setCurrentOutlet(null);
        setAvailableOutlets([]);
        localStorage.removeItem(STORAGE_KEY_USER);
        localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
        localStorage.removeItem(STORAGE_KEY_OUTLETS_CACHE);
      }

      setIsLoading(false);
      return {
        success: false,
        message: friendlyMessage,
      };
    }
  };

  /**
   * Logout dari Firebase Auth dan bersihkan sesi lokal
   */
  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn('[AuthContext] Kesalahan saat sign out Firebase:', err);
    } finally {
      setUser(null);
      setCurrentOutlet(null);
      setAvailableOutlets([]);
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem(STORAGE_KEY_OUTLET_ID);
      localStorage.removeItem(STORAGE_KEY_OUTLETS_CACHE);
      setUnauthorizedAttemptMessage(null);
      setIsLoading(false);
      window.history.pushState(null, '', '/');
    }
  };

  /**
   * Muat ulang data user & outlet secara on-demand
   */
  const refreshUserData = async (): Promise<void> => {
    if (!auth.currentUser) return;
    try {
      const { user: appUser, outlets, activeOutlet } = await fetchUserProfileAndOutlets(
        auth.currentUser
      );
      setUser(appUser);
      setAvailableOutlets(outlets);
      setCurrentOutlet(activeOutlet);

      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(appUser));
      localStorage.setItem(STORAGE_KEY_OUTLETS_CACHE, JSON.stringify(outlets));
      if (activeOutlet) {
        localStorage.setItem(STORAGE_KEY_OUTLET_ID, activeOutlet.id);
      }
    } catch (err) {
      console.error('[AuthContext] Gagal memuat ulang data user:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        currentOutlet,
        availableOutlets,
        isLoading,
        isOnline,
        pendingSyncCount,
        login,
        logout,
        selectOutlet,
        refreshUserData,
        refreshPendingSyncCount,
        unauthorizedAttemptMessage,
        setUnauthorizedAttemptMessage,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
