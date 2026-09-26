import { useState, useEffect, useCallback } from 'react';
import { transaksiService } from '../services/transaksiService';
import { transaksiCloudService } from '../services/cloud/transaksiCloudService';

export function usePendingSyncCount(outletId?: string): number {
  const [count, setCount] = useState<number>(0);

  const updateCount = useCallback(async () => {
    if (!outletId) {
      setCount(0);
      return;
    }

    try {
      // 1. Hitung dari pending queue cloud IndexedDB
      const queueItems = await transaksiCloudService.getPendingQueueItems(outletId);
      // 2. Hitung dari legacy transaksiService untuk backward-compatibility
      const legacyCount = transaksiService.getPendingCountSync(outletId);
      setCount(queueItems.length + legacyCount);
    } catch {
      setCount(0);
    }
  }, [outletId]);

  useEffect(() => {
    updateCount();

    const handleCustomEvent = () => {
      updateCount();
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (outletId && e.key === `pos_fnb_transaksi_outlet_${outletId}`) {
        updateCount();
      }
    };

    // Auto-flush queue saat event 'online' tiba
    const handleOnline = async () => {
      if (outletId) {
        try {
          await transaksiCloudService.flushQueue(outletId);
        } catch (err) {
          console.warn('[usePendingSyncCount] Auto-flush saat online gagal:', err);
        }
      }
      updateCount();
    };

    const handleOffline = () => {
      updateCount();
    };

    window.addEventListener('pos_fnb_transaksi_updated', handleCustomEvent);
    window.addEventListener('pos_fnb_sync_queue_updated', handleCustomEvent);
    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('pos_fnb_transaksi_updated', handleCustomEvent);
      window.removeEventListener('pos_fnb_sync_queue_updated', handleCustomEvent);
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [outletId, updateCount]);

  return count;
}
