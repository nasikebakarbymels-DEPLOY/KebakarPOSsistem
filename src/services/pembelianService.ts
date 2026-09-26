import { PembelianBahan, Bahan } from '../types';
import { bahanService } from './bahanService';
import { formatTanggalSlash } from '../utils/formatters';

const STORAGE_PREFIX = 'pos_fnb_pembelian_outlet_';

function getStorageKey(outletId: string): string {
  return `${STORAGE_PREFIX}${outletId}`;
}

export interface CreatePembelianDTO {
  bahanId: string;
  kemasanId: string;
  qty: number;
  hargaPerKemasan: number;
  totalHarga?: number;
  supplierCatatan?: string;
  tanggal: string; // YYYY-MM-DD
}

export const pembelianService = {
  // Get all pembelian for an outlet, sorted by tanggal desc then createdAt desc
  async getPembelianByOutlet(outletId: string): Promise<PembelianBahan[]> {
    if (!outletId) return [];
    try {
      const raw = localStorage.getItem(getStorageKey(outletId));
      if (!raw) return [];
      const list: PembelianBahan[] = JSON.parse(raw);
      if (!Array.isArray(list)) return [];

      return list.sort((a, b) => {
        const dateCompare = b.tanggal.localeCompare(a.tanggal);
        if (dateCompare !== 0) return dateCompare;
        return String(b.createdAt).localeCompare(String(a.createdAt));
      });
    } catch {
      return [];
    }
  },

  // Recalculate and update latest cost for a specific bahan
  async recalculateBahanCost(outletId: string, bahanId: string): Promise<void> {
    const allPembelian = await this.getPembelianByOutlet(outletId);
    const bahanPembelian = allPembelian.filter((p) => p.bahanId === bahanId);

    const allBahan = await bahanService.getBahanByOutlet(outletId);
    const targetBahan = allBahan.find((b) => b.id === bahanId);
    if (!targetBahan) return;

    if (bahanPembelian.length > 0) {
      // Latest purchase by date & createdAt
      const latest = bahanPembelian[0];
      const sumberInfo = `Biaya terakhir dari pembelian ${formatTanggalSlash(latest.tanggal)}`;
      await bahanService.updateBiayaTerbaruFromPembelian(
        outletId,
        bahanId,
        latest.biayaPerSatuanDasar,
        sumberInfo
      );
    } else {
      // Rollback to initial cost or none
      const biayaAwal = targetBahan.biayaAwal;
      const sumberInfo = biayaAwal !== undefined ? 'Biaya acuan awal' : undefined;
      await bahanService.updateBiayaTerbaruFromPembelian(
        outletId,
        bahanId,
        biayaAwal,
        sumberInfo
      );
    }
  },

  // Create new pembelian
  async createPembelian(outletId: string, data: CreatePembelianDTO): Promise<PembelianBahan> {
    if (!outletId) throw new Error('Outlet ID wajib disertakan.');
    if (!data.bahanId) throw new Error('Bahan wajib dipilih.');
    if (!data.kemasanId) throw new Error('Kemasan wajib dipilih.');
    if (!data.tanggal) throw new Error('Tanggal pembelian wajib diisi.');
    if (!data.qty || data.qty <= 0) throw new Error('Qty pembelian harus lebih dari 0.');
    if (data.hargaPerKemasan === undefined || data.hargaPerKemasan <= 0) {
      throw new Error('Harga per kemasan harus lebih dari 0.');
    }

    // Fetch master bahan & kemasan
    const bahanList = await bahanService.getBahanByOutlet(outletId);
    const targetBahan = bahanList.find((b) => b.id === data.bahanId);
    if (!targetBahan) {
      throw new Error('Data bahan tidak ditemukan.');
    }

    const targetKemasan = targetBahan.kemasanList.find((k) => k.id === data.kemasanId);
    if (!targetKemasan) {
      throw new Error('Kemasan yang dipilih tidak ditemukan pada bahan ini.');
    }

    if (!targetKemasan.netto || targetKemasan.netto <= 0) {
      throw new Error('Netto kemasan tidak valid atau bernilai 0.');
    }

    const totalNetto = Number((data.qty * targetKemasan.netto).toFixed(4));
    const totalHarga = data.totalHarga !== undefined && data.totalHarga > 0
      ? data.totalHarga
      : Math.round(data.qty * data.hargaPerKemasan);

    const biayaPerSatuanDasar = totalNetto > 0 ? totalHarga / totalNetto : 0;

    const nowIso = new Date().toISOString();
    const newPembelian: PembelianBahan = {
      id: `pemb-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      outletId,
      tanggal: data.tanggal,
      supplier: data.supplierCatatan?.trim() || 'Supplier Umum',
      items: [
        {
          bahanId: targetBahan.id,
          kemasanId: targetKemasan.id,
          namaBahanSnapshot: targetBahan.nama,
          namaKemasanSnapshot: targetKemasan.nama,
          isiPerKemasanSnapshot: targetKemasan.netto,
          qty: data.qty,
          hargaTotal: totalHarga,
          hargaPerUnit: data.hargaPerKemasan,
          isAcuanKemasan: Boolean(targetKemasan.acuan),
        },
      ],
      totalPembelian: totalHarga,
      catatan: data.supplierCatatan?.trim() || undefined,
      bahanId: targetBahan.id,
      bahanNama: targetBahan.nama,
      kemasanId: targetKemasan.id,
      kemasanNama: targetKemasan.nama,
      nettoPerKemasan: targetKemasan.netto,
      satuanDasar: targetBahan.satuanDasar,
      qty: data.qty,
      hargaPerKemasan: data.hargaPerKemasan,
      totalHarga,
      totalNetto,
      biayaPerSatuanDasar,
      supplierCatatan: data.supplierCatatan?.trim() || undefined,
      kategori: 'Pembelian Bahan Baku',
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const existing = await this.getPembelianByOutlet(outletId);
    const updatedList = [newPembelian, ...existing];
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(updatedList));

    // Recalculate latest cost for this bahan
    await this.recalculateBahanCost(outletId, targetBahan.id);

    return newPembelian;
  },

  // Delete a pembelian record
  async deletePembelian(outletId: string, pembelianId: string): Promise<void> {
    const existing = await this.getPembelianByOutlet(outletId);
    const target = existing.find((p) => p.id === pembelianId);
    if (!target) {
      throw new Error('Data pembelian tidak ditemukan.');
    }

    const filtered = existing.filter((p) => p.id !== pembelianId);
    localStorage.setItem(getStorageKey(outletId), JSON.stringify(filtered));

    // Recalculate cost for affected bahan
    if (target.bahanId) {
      await this.recalculateBahanCost(outletId, target.bahanId);
    }
  },

  // Seed example pembelian data
  async seedExamplePembelian(outletId: string): Promise<PembelianBahan> {
    if (!outletId) throw new Error('Outlet ID tidak valid.');

    let allBahan = await bahanService.getBahanByOutlet(outletId);
    if (allBahan.length === 0) {
      allBahan = await bahanService.seedExampleData(outletId);
    }

    // Find Kecap Manis or create one
    let kecap = allBahan.find(
      (b) => b.nama.trim().toLowerCase() === 'kecap manis'
    );

    if (!kecap) {
      kecap = await bahanService.createBahan(outletId, {
        nama: 'Kecap Manis',
        satuanDasar: 'ml',
        biayaTerbaru: 104,
        catatan: 'Kecap manis bumbu dasar olahan',
        kemasanList: [
          { id: `kem-${Date.now()}-1`, nama: 'Botol kecil', netto: 135 },
          { id: `kem-${Date.now()}-2`, nama: 'Pouch', netto: 520 },
        ],
      });
    }

    // Find "Botol kecil" kemasan or add it
    let botolKecil = kecap.kemasanList.find(
      (k) => k.nama.toLowerCase().includes('botol kecil') || k.netto === 135
    );

    if (!botolKecil) {
      botolKecil = {
        id: `kem-${Date.now()}-135`,
        nama: 'Botol kecil',
        netto: 135,
      };
      await bahanService.addKemasan(outletId, kecap.id, {
        nama: botolKecil.nama,
        netto: botolKecil.netto,
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Create example purchase:
    // Kecap Manis, Botol kecil (135 ml), qty: 2, harga per kemasan: 14000 (total 28000), total netto: 270ml
    // Biaya per satuan dasar = 28000 / 270 = 103.7037...
    const pembelian = await this.createPembelian(outletId, {
      bahanId: kecap.id,
      kemasanId: botolKecil.id,
      qty: 2,
      hargaPerKemasan: 14000,
      totalHarga: 28000,
      supplierCatatan: 'Toko Bumbu Barokah - Stok Dapur',
      tanggal: todayStr,
    });

    return pembelian;
  },
};
