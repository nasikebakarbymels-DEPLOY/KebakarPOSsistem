import {
  Transaksi,
  DrafKeranjang,
  RincianPembayaran,
  StatusPembayaran,
  SyncStatus,
  ItemTransaksiSnapshot,
} from '../types';
import { produkService } from './produkService';
import { resepService } from './resepService';
import { bahanService } from './bahanService';
import { keranjangService } from './keranjangService';

const STORAGE_PREFIX = 'pos_fnb_transaksi_outlet_';
const LAST_SYNC_PREFIX = 'pos_fnb_lastsync_outlet_';

function getStorageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

function getLastSyncKey(outletId: string): string {
  return `${LAST_SYNC_PREFIX}${outletId}`;
}

export interface CreateTransaksiPayload {
  draf: DrafKeranjang;
  kasirId: string;
  kasirNama: string;
  pembayaran: RincianPembayaran;
  isOnline: boolean;
}

export const transaksiService = {
  // Ambil semua transaksi per outlet
  getTransaksiByOutlet: async (outletId: string): Promise<Transaksi[]> => {
    if (!outletId) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(outletId));
      if (!raw) return [];
      const list: Transaksi[] = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.error(`Gagal membaca transaksi outlet ${outletId}:`, err);
      return [];
    }
  },

  // Ambil transaksi yang statusnya pending sync
  getPendingByOutlet: async (outletId: string): Promise<Transaksi[]> => {
    const list = await transaksiService.getTransaksiByOutlet(outletId);
    return list.filter((t) => t.syncStatus === 'pending');
  },

  // Jumlah transaksi pending (baca sinkron untuk performa badge)
  getPendingCountSync: (outletId: string): number => {
    if (!outletId) return 0;
    try {
      const raw = localStorage.getItem(getStorageKey(outletId));
      if (!raw) return 0;
      const list: Transaksi[] = JSON.parse(raw);
      return Array.isArray(list) ? list.filter((t) => t.syncStatus === 'pending').length : 0;
    } catch {
      return 0;
    }
  },

  // Waktu sinkronisasi terakhir
  getLastSyncAt: (outletId: string): string | null => {
    if (!outletId) return null;
    try {
      return localStorage.getItem(getLastSyncKey(outletId));
    } catch {
      return null;
    }
  },

  // Buat transaksi baru
  createTransaksi: async (
    outletId: string,
    payload: CreateTransaksiPayload
  ): Promise<Transaksi> => {
    if (!outletId) throw new Error('Outlet ID tidak valid.');
    const { draf, kasirId, kasirNama, pembayaran, isOnline } = payload;

    if (!draf.items || draf.items.length === 0) {
      throw new Error('Keranjang pesanan masih kosong.');
    }

    // 1. Validasi katalog produk saat checkout:
    // Pastikan item non-dadakan produknya masih ada dan aktif di katalog
    const allProduk = await produkService.getProdukByOutlet(outletId);
    for (const item of draf.items) {
      if (!item.isDadakan && item.produkId) {
        const found = allProduk.find((p) => p.id === item.produkId);
        if (!found || !found.aktif) {
          throw new Error(
            `Menu "${item.nama}" sudah tidak aktif atau telah dihapus dari katalog. Harap hapus item ini dari keranjang sebelum membayar.`
          );
        }
      }
    }

    // 2. Snapshot HPP (hitung sekali per produkId unik)
    const allResep = await resepService.getResepByOutlet(outletId);
    const allBahan = await bahanService.getBahanByOutlet(outletId);
    const hppCache = new Map<string, number>();

    const itemsSnapshot: ItemTransaksiSnapshot[] = [];
    let totalHppSnapshot = 0;

    for (const item of draf.items) {
      let hppSatuan = 0;
      if (!item.isDadakan && item.produkId) {
        if (hppCache.has(item.produkId)) {
          hppSatuan = hppCache.get(item.produkId)!;
        } else {
          try {
            const hppResult = resepService.hitungHPP(item.produkId, allProduk, allResep, allBahan);
            hppSatuan = Math.max(0, hppResult.hpp || 0);
          } catch {
            hppSatuan = 0;
          }
          hppCache.set(item.produkId, hppSatuan);
        }
      }

      const hppSubtotal = Number((hppSatuan * item.qty).toFixed(2));
      totalHppSnapshot += hppSubtotal;

      itemsSnapshot.push({
        id: item.id,
        produkId: item.produkId,
        nama: item.nama,
        hargaJual: item.hargaJual,
        qty: item.qty,
        hppSatuan,
        subtotal: item.hargaJual * item.qty,
        catatan: item.catatan,
        diskonItem: item.diskonItem,
        isDadakan: item.isDadakan,
        hppSatuanSnapshot: hppSatuan,
        hppSubtotalSnapshot: hppSubtotal,
      });
    }

    // 3. Kalkulasi ringkasan keuangan dari draf
    const ringkasan = keranjangService.kalkulasiRingkasan(draf);

    // 4. Validasi & Normalisasi Pembayaran Secara Otoritatif (Benteng Terakhir Service)
    let normalizedPembayaran: RincianPembayaran;
    let statusPembayaran: StatusPembayaran = 'lunas';

    if (pembayaran.metode === 'tunai') {
      const uangDiterima = Number(pembayaran.uangDiterima);
      if (isNaN(uangDiterima) || uangDiterima < ringkasan.totalAkhir) {
        throw new Error('Uang diterima kurang dari total tagihan.');
      }
      const kembalian = uangDiterima - ringkasan.totalAkhir;
      normalizedPembayaran = {
        metode: 'tunai',
        uangDiterima,
        kembalian,
        jumlahDibayar: ringkasan.totalAkhir,
        sisaHutang: 0,
      };
      statusPembayaran = 'lunas';
    } else if (pembayaran.metode === 'piutang') {
      const jumlahDibayar = Number(pembayaran.jumlahDibayar);
      if (isNaN(jumlahDibayar) || jumlahDibayar < 0) {
        throw new Error('Jumlah pembayaran piutang tidak boleh bernilai negatif.');
      }
      if (jumlahDibayar > ringkasan.totalAkhir) {
        throw new Error('Jumlah yang dibayar tidak boleh melebihi total tagihan.');
      }
      const sisaHutang = ringkasan.totalAkhir - jumlahDibayar;
      normalizedPembayaran = {
        metode: 'piutang',
        pelangganId: pembayaran.pelangganId,
        pelangganNama: pembayaran.pelangganNama,
        jumlahDibayar,
        sisaHutang,
      };
      if (jumlahDibayar >= ringkasan.totalAkhir) {
        statusPembayaran = 'lunas';
      } else if (jumlahDibayar > 0) {
        statusPembayaran = 'sebagian';
      } else {
        statusPembayaran = 'hutang';
      }
    } else if (pembayaran.metode === 'qris_transfer') {
      normalizedPembayaran = {
        metode: 'qris_transfer',
        referensi: pembayaran.referensi?.trim() || undefined,
        jumlahDibayar: ringkasan.totalAkhir,
        sisaHutang: 0,
      };
      statusPembayaran = 'lunas';
    } else {
      throw new Error('Metode pembayaran tidak valid.');
    }

    // 5. Generate Nomor Transaksi: format TRX-YYYYMMDD-001 per outlet per hari
    const existingList = await transaksiService.getTransaksiByOutlet(outletId);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `TRX-${yyyy}${mm}${dd}-`;

    let maxSeq = 0;
    for (const trx of existingList) {
      if (trx.nomorTransaksi && trx.nomorTransaksi.startsWith(datePrefix)) {
        const part = trx.nomorTransaksi.substring(datePrefix.length);
        const parsedSeq = parseInt(part, 10);
        if (!isNaN(parsedSeq) && parsedSeq > maxSeq) {
          maxSeq = parsedSeq;
        }
      }
    }
    const nextSeq = maxSeq + 1;
    const nomorTransaksi = `${datePrefix}${String(nextSeq).padStart(3, '0')}`;

    const syncStatus: SyncStatus = isOnline ? 'synced' : 'pending';
    const isOfflineCreated = !isOnline;
    const nowIso = now.toISOString();

    const newTransaksi: Transaksi = {
      id: `trx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      outletId,
      kasirId,
      kasirNama,
      nomorTransaksi,
      tanggal: nowIso,
      items: itemsSnapshot,
      totalHppSnapshot: Number(totalHppSnapshot.toFixed(2)),
      tipePesanan: draf.tipePesanan,
      nomorMeja: draf.tipePesanan === 'dine_in' ? draf.nomorMeja : undefined,
      catatanPesanan: draf.catatanPesanan,
      subtotalKotor: ringkasan.subtotalKotor,
      totalDiskonItem: ringkasan.totalDiskonItem,
      subtotalBersih: ringkasan.subtotalBersih,
      diskonTransaksiTipe: draf.tipeDiskonTransaksi,
      diskonTransaksiNilai: draf.diskonTransaksiNilai,
      diskonTransaksiNominal: ringkasan.diskonTransaksiNominal,
      totalAkhir: ringkasan.totalAkhir,
      total: ringkasan.totalAkhir,
      metodeBayar: (pembayaran.metode === 'tunai' ? 'tunai' : pembayaran.metode === 'qris_transfer' ? 'qris' : 'transfer') as 'tunai' | 'qris' | 'transfer',
      uangDiterima: pembayaran.uangDiterima,
      kembalian: pembayaran.kembalian,
      status: 'selesai',
      syncSource: isOnline ? 'online' : 'queue',
      pembayaran: normalizedPembayaran,
      statusPembayaran,
      syncStatus,
      isOfflineCreated,
      approvalStatus: 'none',
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedList = [newTransaksi, ...existingList];
    try {
      localStorage.setItem(getStorageKey(outletId), JSON.stringify(updatedList));
      // Dispatch custom event untuk reaktivitas UI & header badge
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pos_fnb_transaksi_updated', { detail: { outletId } })
        );
      }
    } catch (err) {
      console.error('Gagal menyimpan transaksi:', err);
      throw new Error('Gagal menyimpan transaksi ke penyimpanan lokal.');
    }

    return newTransaksi;
  },

  // Sinkronisasi transaksi pending
  syncNow: async (
    outletId: string,
    isOnline: boolean
  ): Promise<{ syncedCount: number; lastSyncAt: string }> => {
    if (!outletId) throw new Error('Outlet ID tidak valid.');

    if (!isOnline) {
      throw new Error(
        'Perangkat sedang offline. Sambungkan koneksi internet untuk melakukan sinkronisasi.'
      );
    }

    const list = await transaksiService.getTransaksiByOutlet(outletId);
    let syncedCount = 0;

    const updatedList = list.map((trx) => {
      if (trx.syncStatus === 'pending') {
        syncedCount += 1;
        return {
          ...trx,
          syncStatus: 'synced' as SyncStatus,
        };
      }
      return trx;
    });

    const nowIso = new Date().toISOString();
    try {
      localStorage.setItem(getStorageKey(outletId), JSON.stringify(updatedList));
      localStorage.setItem(getLastSyncKey(outletId), nowIso);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('pos_fnb_transaksi_updated', { detail: { outletId } })
        );
      }
    } catch (err) {
      console.error('Gagal memperbarui status sinkronisasi:', err);
      throw new Error('Gagal memperbarui data sinkronisasi.');
    }

    return { syncedCount, lastSyncAt: nowIso };
  },
};
