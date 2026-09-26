import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SyncOperation, LocalDraft, SyncQueueStatus } from '../types';

/**
 * Skema Database Lokal IndexedDB
 */
interface PosLocalDbSchema extends DBSchema {
  sync_queue: {
    key: string;
    value: SyncOperation;
    indexes: {
      status: SyncQueueStatus;
      createdAt: string;
    };
  };
  local_drafts: {
    key: string;
    value: LocalDraft;
  };
}

const DB_NAME = 'pos_fnb_local_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PosLocalDbSchema>> | null = null;

export function getLocalDb(): Promise<IDBPDatabase<PosLocalDbSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PosLocalDbSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store 1: sync_queue untuk offline-first sync operations
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
          syncStore.createIndex('status', 'status');
          syncStore.createIndex('createdAt', 'createdAt');
        }

        // Store 2: local_drafts untuk draf lokal
        if (!db.objectStoreNames.contains('local_drafts')) {
          db.createObjectStore('local_drafts', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Helper untuk dispatch custom event sinkronisasi ke window
 */
function notifySyncQueueUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pos_fnb_sync_queue_updated'));
  }
}

/**
 * Service untuk mengelola antrean sinkronisasi (sync_queue)
 */
export const syncQueueService = {
  // Tambah operasi baru ke antrean
  async addOperation(operation: SyncOperation): Promise<void> {
    const db = await getLocalDb();
    await db.put('sync_queue', operation);
    notifySyncQueueUpdated();
  },

  // Hitung jumlah dokumen dengan status 'pending'
  async getPendingCount(): Promise<number> {
    try {
      const db = await getLocalDb();
      const tx = db.transaction('sync_queue', 'readonly');
      const index = tx.store.index('status');
      return await index.count('pending');
    } catch (err) {
      console.error('[IndexedDB] Gagal menghitung pending sync count:', err);
      return 0;
    }
  },

  // Ambil semua operasi pending, diurutkan berdasarkan createdAt ascending
  async getPendingOperations(): Promise<SyncOperation[]> {
    try {
      const db = await getLocalDb();
      const tx = db.transaction('sync_queue', 'readonly');
      const index = tx.store.index('status');
      const items = await index.getAll('pending');
      return items.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    } catch (err) {
      console.error('[IndexedDB] Gagal mengambil pending operations:', err);
      return [];
    }
  },

  // Update status operasi (misal menjadi processing, synced, atau failed)
  async updateOperationStatus(
    id: string,
    status: SyncQueueStatus,
    error?: string
  ): Promise<void> {
    const db = await getLocalDb();
    const existing = await db.get('sync_queue', id);
    if (!existing) return;

    existing.status = status;
    if (error !== undefined) {
      existing.error = error;
    }
    if (status === 'failed') {
      existing.retryCount = (existing.retryCount || 0) + 1;
    }

    await db.put('sync_queue', existing);
    notifySyncQueueUpdated();
  },

  // Hapus operasi dari queue
  async removeOperation(id: string): Promise<void> {
    const db = await getLocalDb();
    await db.delete('sync_queue', id);
    notifySyncQueueUpdated();
  },

  // Hapus seluruh data di sync_queue
  async clearAll(): Promise<void> {
    const db = await getLocalDb();
    await db.clear('sync_queue');
    notifySyncQueueUpdated();
  },

  // --- Helper / Backward Compatibility Aliases ---
  async enqueue(
    item: Omit<SyncOperation, 'id' | 'createdAt' | 'retryCount' | 'status'> & {
      status?: SyncQueueStatus;
    }
  ): Promise<SyncOperation> {
    const id = `sync-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const newOp: SyncOperation = {
      id,
      entityType: item.entityType,
      entityId: item.entityId,
      operation: item.operation,
      payload: item.payload,
      status: item.status || 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
    };
    await this.addOperation(newOp);
    return newOp;
  },

  async getPendingItems(): Promise<SyncOperation[]> {
    return this.getPendingOperations();
  },

  async getAll(): Promise<SyncOperation[]> {
    const db = await getLocalDb();
    return await db.getAll('sync_queue');
  },

  async updateStatus(id: string, status: SyncQueueStatus, errorMsg?: string): Promise<void> {
    return this.updateOperationStatus(id, status, errorMsg);
  },

  async remove(id: string): Promise<void> {
    return this.removeOperation(id);
  },

  async clear(): Promise<void> {
    return this.clearAll();
  },
};

/**
 * Service untuk mengelola draf lokal (local_drafts)
 */
export const localDraftService = {
  // Simpan draf dengan timestamp updatedAt otomatis
  async saveDraft(key: string, data: any): Promise<void> {
    const db = await getLocalDb();
    const record: LocalDraft = {
      key,
      data,
      updatedAt: new Date().toISOString(),
    };
    await db.put('local_drafts', record);
  },

  // Ambil draf berdasarkan key
  async getDraft(key: string): Promise<any | null> {
    try {
      const db = await getLocalDb();
      const record = await db.get('local_drafts', key);
      return record ? record.data : null;
    } catch (err) {
      console.error('[IndexedDB] Gagal membaca draf lokal:', err);
      return null;
    }
  },

  // Hapus draf berdasarkan key
  async removeDraft(key: string): Promise<void> {
    const db = await getLocalDb();
    await db.delete('local_drafts', key);
  },

  // Hapus semua draf lokal
  async clearAll(): Promise<void> {
    const db = await getLocalDb();
    await db.clear('local_drafts');
  },

  // Alias untuk kompatibilitas
  async setDraft<T = unknown>(key: string, data: T): Promise<void> {
    return this.saveDraft(key, data);
  },
};

// Ekspor alias localDraftsService agar kompatibel
export const localDraftsService = localDraftService;
