import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaksi, ItemTransaksiSnapshot, ApprovalBiayaManual } from '../../types';
import { sanitizePayload } from './cloudUtils';
import { syncQueueService } from '../localDb';

export interface CreateTransaksiCloudInput {
  items: ItemTransaksiSnapshot[];
  total: number;
  metodeBayar: 'tunai' | 'qris' | 'transfer' | 'piutang';
  uangDiterima?: number;
  kembalian?: number;
  openBillId?: string;
  pelangganId?: string;
  pelangganNama?: string;
  diskonProdukTotal?: number;
  voucherKode?: string;
  voucherNilai?: number;
  biayaLainList?: Array<{
    id?: string;
    nama: string;
    tipe: 'nominal' | 'persen';
    nilaiDefault?: number;
    nilaiDipakai?: number;
    nilai?: number;
    isManual?: boolean;
    subtotal: number;
  }>;
  approvalBiayaManual?: ApprovalBiayaManual[];
}

export type PeriodeFilter = 'hari' | '7hari' | '30hari';

/**
 * Mendapatkan ISO string untuk awal periode dalam waktu lokal perangkat:
 * - 'hari': awal hari ini (00:00:00.000)
 * - '7hari': awal hari 6 hari sebelum hari ini (00:00:00.000)
 * - '30hari': awal hari 29 hari sebelum hari ini (00:00:00.000)
 */
export function getStartOfPeriodISO(periode: PeriodeFilter = 'hari'): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (periode === '7hari') {
    d.setDate(d.getDate() - 6);
  } else if (periode === '30hari') {
    d.setDate(d.getDate() - 29);
  }
  return d.toISOString();
}

/**
 * Mendapatkan ISO string untuk awal hari lokal (00:00:00.000)
 */
export function getLocalStartOfDayISO(): string {
  return getStartOfPeriodISO('hari');
}

/**
 * Mendapatkan format tanggal YYYYMMDD untuk nomor transaksi
 */
function getLocalDateStringYMD(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export const transaksiCloudService = {
  /**
   * Menghitung perkiraan urutan harian transaksi untuk nomor transaksi TRX-YYYYMMDD-XXX
   */
  async getCountTransaksiHariIni(outletId: string): Promise<number> {
    try {
      const startOfDay = getLocalStartOfDayISO();
      const colRef = collection(db, 'outlets', outletId, 'transaksi');
      const q = query(colRef, where('createdAt', '>=', startOfDay));
      const snap = await getDocs(q);
      const cloudCount = snap.size;

      // Gabungkan dengan item yang ada di pending queue IndexedDB
      const pendingQueue = await this.getPendingQueueItems();
      const pendingCount = pendingQueue.filter(
        (t) => t.outletId === outletId && t.createdAt >= startOfDay
      ).length;

      return cloudCount + pendingCount;
    } catch {
      // Fallback jika offline
      try {
        const pendingQueue = await this.getPendingQueueItems();
        return pendingQueue.filter((t) => t.outletId === outletId).length;
      } catch {
        return 0;
      }
    }
  },

  /**
   * 1. createTransaksi(outletId, input, uid, kasirNama): Promise<{ id: string; nomorTransaksi: string }>
   * - Generate id klien dengan crypto.randomUUID()
   * - Format nomorTransaksi TRX-YYYYMMDD-XXX
   * - Jika online: setDoc langsung ke outlets/{outletId}/transaksi/{id} dengan syncSource 'online'
   * - Jika offline / setDoc gagal jaringan: masukkan ke syncQueue IndexedDB dan kembalikan { id, nomorTransaksi } segera
   */
  async createTransaksi(
    outletId: string,
    input: CreateTransaksiCloudInput,
    uid: string,
    kasirNama: string
  ): Promise<{ id: string; nomorTransaksi: string }> {
    if (!outletId) throw new Error('Outlet ID wajib disertakan.');
    if (!input.items || input.items.length === 0) {
      throw new Error('Keranjang pesanan tidak boleh kosong.');
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const nowIso = now.toISOString();
    const ymd = getLocalDateStringYMD();

    // Hitung urutan transaksi harian
    const countToday = await this.getCountTransaksiHariIni(outletId);
    const seq = String(countToday + 1).padStart(3, '0');
    const nomorTransaksi = `TRX-${ymd}-${seq}`;

    // Buat data dokumen transaksi snapshot
    const docData: Transaksi = {
      id,
      outletId,
      nomorTransaksi,
      kasirId: uid,
      kasirNama: kasirNama || 'Kasir',
      items: input.items.map((it) => ({
        produkId: it.produkId,
        nama: it.nama,
        qty: it.qty,
        hargaJual: it.hargaJual,
        hppSatuan: it.hppSatuan,
        subtotal: it.subtotal,
        catatan: it.catatan,
        hargaAsli: it.hargaAsli,
        diskonProdukNominal: it.diskonProdukNominal,
        hargaUnitNeto: it.hargaUnitNeto,
        hppSatuanSnapshot: it.hppSatuan,
        hppSubtotalSnapshot: it.hppSatuan * it.qty,
      })),
      total: input.total,
      metodeBayar: input.metodeBayar,
      uangDiterima: input.uangDiterima,
      kembalian: input.kembalian,
      openBillId: input.openBillId,
      pelangganId: input.pelangganId,
      pelangganNama: input.pelangganNama,
      diskonProdukTotal: input.diskonProdukTotal,
      voucherKode: input.voucherKode,
      voucherNilai: input.voucherNilai,
      biayaLainList: input.biayaLainList,
      approvalBiayaManual: input.approvalBiayaManual,
      status: 'selesai',
      createdAt: nowIso,
      updatedAt: nowIso,
      syncSource: 'online',
      isDeleted: false,
      deletedAt: null,
      version: 1,
      createdBy: uid,
      updatedBy: uid,
      // Field opsional backward compatibility
      tanggal: nowIso,
      totalAkhir: input.total,
      syncStatus: 'synced',
      isOfflineCreated: !navigator.onLine,
    };

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (isOnline) {
      try {
        const sanitized = sanitizePayload(docData as unknown as Record<string, unknown>);
        const docRef = doc(db, 'outlets', outletId, 'transaksi', id);
        await setDoc(docRef, sanitized);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('pos_fnb_transaksi_updated'));
        }
        return { id, nomorTransaksi };
      } catch (err) {
        console.warn('[transaksiCloudService] setDoc Firestore gagal (mungkin jaringan terputus), masuk ke antrean offline:', err);
        // Fallthrough ke offline queue
      }
    }

    // Masuk antrean IndexedDB offline
    const offlineDocData: Transaksi = {
      ...docData,
      syncSource: 'queue',
      syncStatus: 'pending',
      isOfflineCreated: true,
    };

    const sanitizedOffline = sanitizePayload(offlineDocData as unknown as Record<string, unknown>);

    const opId = `op-trx-${id}`;
    await syncQueueService.addOperation({
      id: opId,
      entityType: 'transaksi',
      entityId: id,
      operation: 'create',
      payload: sanitizedOffline,
      status: 'pending',
      retryCount: 0,
      createdAt: nowIso,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos_fnb_transaksi_updated'));
      window.dispatchEvent(new CustomEvent('pos_fnb_sync_queue_updated'));
    }

    return { id, nomorTransaksi };
  },

  /**
   * 2. getTransaksiHariIni(outletId): query where createdAt >= awal hari lokal, urutkan desc
   */
  async getTransaksiHariIni(outletId: string): Promise<Transaksi[]> {
    if (!outletId) return [];
    try {
      const startOfDay = getLocalStartOfDayISO();
      const colRef = collection(db, 'outlets', outletId, 'transaksi');
      const q = query(
        colRef,
        where('createdAt', '>=', startOfDay),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      const list: Transaksi[] = [];
      snap.forEach((d) => {
        const data = d.data() as Transaksi;
        if (!data.isDeleted) {
          list.push({ ...data, id: d.id });
        }
      });
      return list;
    } catch (err) {
      console.warn('[transaksiCloudService] Gagal fetch transaksi hari ini dari cloud:', err);
      // Fallback tanpa orderBy jika Firestore butuh composite index
      try {
        const startOfDay = getLocalStartOfDayISO();
        const colRef = collection(db, 'outlets', outletId, 'transaksi');
        const qFallback = query(colRef, where('createdAt', '>=', startOfDay));
        const snap = await getDocs(qFallback);
        const list: Transaksi[] = [];
        snap.forEach((d) => {
          const data = d.data() as Transaksi;
          if (!data.isDeleted) {
            list.push({ ...data, id: d.id });
          }
        });
        return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } catch (err2) {
        console.error('[transaksiCloudService] Fallback fetch gagal:', err2);
        return [];
      }
    }
  },

  /**
   * Listener onSnapshot untuk transaksi pada periode tertentu ('hari' | '7hari' | '30hari')
   * dengan fallback getDocs bila onSnapshot gagal.
   */
  subscribeTransaksi(
    outletId: string,
    periode: PeriodeFilter = 'hari',
    onSuccess: (transaksi: Transaksi[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    if (!outletId) {
      onSuccess([]);
      return () => {};
    }

    const startIso = getStartOfPeriodISO(periode);
    const colRef = collection(db, 'outlets', outletId, 'transaksi');
    const q = query(
      colRef,
      where('createdAt', '>=', startIso),
      orderBy('createdAt', 'desc')
    );

    let isUnsubscribed = false;

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed) return;
        const list: Transaksi[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as Transaksi;
          if (!data.isDeleted) {
            list.push({ ...data, id: d.id });
          }
        });
        onSuccess(list);
      },
      async (err) => {
        if (isUnsubscribed) return;
        console.warn('[transaksiCloudService] onSnapshot listener error (coba fallback getDocs):', err);
        try {
          // Fallback getDocs tanpa orderBy jika Firestore butuh composite index atau listener realtime bermasalah
          const fallbackQ = query(colRef, where('createdAt', '>=', startIso));
          const snap = await getDocs(fallbackQ);
          if (isUnsubscribed) return;
          const list: Transaksi[] = [];
          snap.forEach((d) => {
            const data = d.data() as Transaksi;
            if (!data.isDeleted) {
              list.push({ ...data, id: d.id });
            }
          });
          list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          onSuccess(list);
        } catch (fallbackErr: unknown) {
          if (isUnsubscribed) return;
          console.error('[transaksiCloudService] onSnapshot dan fallback getDocs keduanya gagal:', fallbackErr);
          if (onError) {
            onError(fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr)));
          }
        }
      }
    );

    return () => {
      isUnsubscribed = true;
      unsub();
    };
  },

  /**
   * Listener onSnapshot untuk transaksi hari ini agar UI riwayat live (alias backward-compatible)
   */
  subscribeTransaksiHariIni(
    outletId: string,
    onSuccess: (transaksi: Transaksi[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    return this.subscribeTransaksi(outletId, 'hari', onSuccess, onError);
  },

  /**
   * 3. getPendingQueueItems(): baca isi syncQueue untuk tipe create_transaksi agar UI riwayat bisa menampilkan entri antre
   */
  async getPendingQueueItems(outletId?: string): Promise<Transaksi[]> {
    try {
      const ops = await syncQueueService.getPendingOperations();
      const trxOps = ops.filter(
        (op) =>
          op.entityType === 'transaksi' ||
          op.entityType === 'create_transaksi' ||
          (op as unknown as { tipe?: string }).tipe === 'create_transaksi'
      );

      const items: Transaksi[] = trxOps
        .map((op) => {
          const t = op.payload as Transaksi;
          return {
            ...t,
            id: t.id || op.entityId,
            syncSource: 'queue' as const,
            syncStatus: 'pending' as const,
          };
        })
        .filter((t) => (outletId ? t.outletId === outletId : true));

      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      console.error('[transaksiCloudService] Gagal membaca pending queue items:', err);
      return [];
    }
  },

  /**
   * 4. flushQueue(): panggil prosesor syncQueue yang sudah ada untuk menulis entri antre ke Firestore saat online;
   * pastikan id dokumen sama dengan id klien sehingga retry tidak menduplikasi (upsert idempoten).
   */
  async flushQueue(outletId?: string): Promise<{ syncedCount: number; errors: number }> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { syncedCount: 0, errors: 0 };
    }

    let syncedCount = 0;
    let errors = 0;

    try {
      const ops = await syncQueueService.getPendingOperations();
      const trxOps = ops.filter(
        (op) =>
          op.entityType === 'transaksi' ||
          op.entityType === 'create_transaksi' ||
          (op as unknown as { tipe?: string }).tipe === 'create_transaksi'
      );

      for (const op of trxOps) {
        const payload = op.payload as Transaksi;
        if (outletId && payload.outletId !== outletId) {
          continue;
        }

        try {
          const docId = payload.id || op.entityId;
          const targetOutletId = payload.outletId;
          if (!targetOutletId || !docId) {
            continue;
          }

          // Persiapkan payload tersinkronisasi
          const syncedDocData: Transaksi = {
            ...payload,
            id: docId,
            syncSource: 'online',
            syncStatus: 'synced',
            updatedAt: new Date().toISOString(),
          };

          const sanitized = sanitizePayload(syncedDocData as unknown as Record<string, unknown>);
          const docRef = doc(db, 'outlets', targetOutletId, 'transaksi', docId);

          // Gunakan setDoc (upsert idempoten) dengan ID dokumen yang persis sama
          await setDoc(docRef, sanitized, { merge: true });

          // Hapus dari antrean IndexedDB setelah sukses
          await syncQueueService.removeOperation(op.id);
          syncedCount++;
        } catch (opErr: unknown) {
          errors++;
          console.error(`[transaksiCloudService] Gagal sync transaksi ${op.id}:`, opErr);
          const errMsg = opErr instanceof Error ? opErr.message : String(opErr);
          await syncQueueService.updateOperationStatus(op.id, 'failed', errMsg);
        }
      }

      if (syncedCount > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('pos_fnb_transaksi_updated'));
        window.dispatchEvent(new CustomEvent('pos_fnb_sync_queue_updated'));
      }
    } catch (err) {
      console.error('[transaksiCloudService] Gagal menjalankan flushQueue:', err);
    }

    return { syncedCount, errors };
  },
};
