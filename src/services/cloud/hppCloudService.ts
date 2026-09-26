import { Produk, Bahan, ItemResep } from '../../types';
import { produkCloudService } from './produkCloudService';
import { bahanCloudService } from './bahanCloudService';

export interface ItemHppDetail {
  id: string;
  tipe: 'bahan' | 'sub_produk';
  refId: string;
  nama: string;
  jumlah: number;
  satuan: string;
  biayaSatuan: number;
  subtotalBiaya: number;
  hasBiaya: boolean;
  level: number;
  subItems?: ItemHppDetail[];
}

export interface KalkulasiHPP {
  hpp: number;
  hargaJual: number;
  estimasiProfit: number;
  marginPersen: number;
  isResepKosong: boolean;
  adaBahanTanpaBiaya: boolean;
  bahanTanpaBiayaList: string[];
  itemsDetail: ItemHppDetail[];
  hasCycleError: boolean;
  cycleErrorMessage?: string;
}

export interface HppCalculationCache {
  bahanMap?: Map<string, Bahan>;
  produkMap?: Map<string, Produk>;
}

export const hppCloudService = {
  /**
   * Menghitung HPP untuk produk yang sudah tersimpan di Firestore secara rekursif,
   * mendukung resep multi-level (maksimal 3 level kedalaman) serta mendeteksi siklus.
   */
  async hitungHppProduk(
    outletId: string,
    produkId: string,
    cache?: HppCalculationCache,
    visited: Set<string> = new Set(),
    currentLevel: number = 1
  ): Promise<KalkulasiHPP> {
    // 1. Deteksi siklus resep
    if (visited.has(produkId)) {
      return {
        hpp: 0,
        hargaJual: 0,
        estimasiProfit: 0,
        marginPersen: 0,
        isResepKosong: false,
        adaBahanTanpaBiaya: true,
        bahanTanpaBiayaList: ['Siklus ketergantungan terdeteksi'],
        itemsDetail: [],
        hasCycleError: true,
        cycleErrorMessage: `Terjadi siklus ketergantungan melingkar pada produk "${produkId}".`,
      };
    }

    // 2. Cegah kedalaman lebih dari 3 level
    if (currentLevel > 3) {
      return {
        hpp: 0,
        hargaJual: 0,
        estimasiProfit: 0,
        marginPersen: 0,
        isResepKosong: false,
        adaBahanTanpaBiaya: true,
        bahanTanpaBiayaList: ['Batas kedalaman resep 3 level terlampaui'],
        itemsDetail: [],
        hasCycleError: true,
        cycleErrorMessage: 'Resep melebihi batas maksimal 3 tingkat kedalaman.',
      };
    }

    const nextVisited = new Set(visited);
    nextVisited.add(produkId);

    // Ambil data produk dari cache atau Firestore
    let produk: Produk | null = null;
    if (cache?.produkMap && cache.produkMap.has(produkId)) {
      produk = cache.produkMap.get(produkId)!;
    } else {
      produk = await produkCloudService.getProdukById(outletId, produkId);
      if (produk && cache?.produkMap) {
        cache.produkMap.set(produkId, produk);
      }
    }

    if (!produk) {
      return {
        hpp: 0,
        hargaJual: 0,
        estimasiProfit: 0,
        marginPersen: 0,
        isResepKosong: true,
        adaBahanTanpaBiaya: true,
        bahanTanpaBiayaList: [`Produk ${produkId} tidak ditemukan`],
        itemsDetail: [],
        hasCycleError: false,
      };
    }

    return this.hitungHppInternal(
      outletId,
      produk.resepItems || [],
      produk.hargaJual,
      cache,
      nextVisited,
      currentLevel
    );
  },

  /**
   * Menghitung HPP dari daftar item resep mentah secara langsung.
   * Sangat cocok untuk kalkulasi live preview pada saat form pembuatan / edit produk.
   */
  async hitungHppDariResepItems(
    outletId: string,
    resepItems: ItemResep[],
    hargaJual: number,
    cache?: HppCalculationCache,
    visited: Set<string> = new Set(),
    currentLevel: number = 1
  ): Promise<KalkulasiHPP> {
    return this.hitungHppInternal(
      outletId,
      resepItems,
      hargaJual,
      cache,
      visited,
      currentLevel
    );
  },

  /**
   * Implementasi perhitungan internal rekursif
   */
  async hitungHppInternal(
    outletId: string,
    resepItems: ItemResep[],
    hargaJual: number,
    cache?: HppCalculationCache,
    visited: Set<string> = new Set(),
    currentLevel: number = 1
  ): Promise<KalkulasiHPP> {
    if (!resepItems || resepItems.length === 0) {
      const numHarga = typeof hargaJual === 'number' && !isNaN(hargaJual) ? hargaJual : 0;
      return {
        hpp: 0,
        hargaJual: numHarga,
        estimasiProfit: numHarga,
        marginPersen: numHarga > 0 ? 100 : 0,
        isResepKosong: true,
        adaBahanTanpaBiaya: false,
        bahanTanpaBiayaList: [],
        itemsDetail: [],
        hasCycleError: false,
      };
    }

    let totalHpp = 0;
    let adaBahanTanpaBiaya = false;
    const bahanTanpaBiayaList: string[] = [];
    const itemsDetail: ItemHppDetail[] = [];

    for (let i = 0; i < resepItems.length; i++) {
      const item = resepItems[i];
      const rowJumlah = typeof item.jumlah === 'number' ? item.jumlah : (item.qty || 0);
      const rowSatuan = item.satuan || 'pcs';
      const rowId = item.id || `row-${i}-${Date.now()}`;

      // Kasus 1: Menggunakan Bahan Baku
      if (item.bahanId) {
        let bahan: Bahan | null = null;
        if (cache?.bahanMap && cache.bahanMap.has(item.bahanId)) {
          bahan = cache.bahanMap.get(item.bahanId)!;
        } else {
          bahan = await bahanCloudService.getBahanById(outletId, item.bahanId);
          if (bahan && cache?.bahanMap) {
            cache.bahanMap.set(item.bahanId, bahan);
          }
        }

        const namaBahan = bahan?.nama || item.namaSnapshot || `Bahan (${item.bahanId})`;
        const biayaSatuan = typeof bahan?.hargaPerSatuanDasar === 'number' ? bahan.hargaPerSatuanDasar : 0;
        const hasBiaya = biayaSatuan > 0;

        if (!hasBiaya) {
          adaBahanTanpaBiaya = true;
          if (!bahanTanpaBiayaList.includes(namaBahan)) {
            bahanTanpaBiayaList.push(namaBahan);
          }
        }

        const subtotalBiaya = Number((rowJumlah * biayaSatuan).toFixed(2));
        totalHpp += subtotalBiaya;

        itemsDetail.push({
          id: rowId,
          tipe: 'bahan',
          refId: item.bahanId,
          nama: namaBahan,
          jumlah: rowJumlah,
          satuan: bahan?.satuanDasar || rowSatuan,
          biayaSatuan,
          subtotalBiaya,
          hasBiaya,
          level: currentLevel,
        });
      }
      // Kasus 2: Menggunakan Sub-Produk (Komponen / Resep Bertingkat)
      else if (item.subProdukId || item.produkId) {
        const targetSubId = (item.subProdukId || item.produkId)!;

        // Ambil nama sub-produk
        let subProduk: Produk | null = null;
        if (cache?.produkMap && cache.produkMap.has(targetSubId)) {
          subProduk = cache.produkMap.get(targetSubId)!;
        } else {
          subProduk = await produkCloudService.getProdukById(outletId, targetSubId);
          if (subProduk && cache?.produkMap) {
            cache.produkMap.set(targetSubId, subProduk);
          }
        }

        const namaSub = subProduk?.nama || item.namaSnapshot || `Sub-Produk (${targetSubId})`;

        // Rekursif hitung HPP sub-produk
        const subKalkulasi = await this.hitungHppProduk(
          outletId,
          targetSubId,
          cache,
          visited,
          currentLevel + 1
        );

        if (subKalkulasi.hasCycleError) {
          return {
            ...subKalkulasi,
            cycleErrorMessage: `Siklus pada sub-produk "${namaSub}": ${subKalkulasi.cycleErrorMessage}`,
          };
        }

        if (subKalkulasi.adaBahanTanpaBiaya) {
          adaBahanTanpaBiaya = true;
          for (const b of subKalkulasi.bahanTanpaBiayaList) {
            if (!bahanTanpaBiayaList.includes(b)) {
              bahanTanpaBiayaList.push(b);
            }
          }
        }

        const isSubTanpaResep = subKalkulasi.isResepKosong || !subProduk;
        if (isSubTanpaResep) {
          adaBahanTanpaBiaya = true;
          const label = `${namaSub} (belum memiliki resep)`;
          if (!bahanTanpaBiayaList.includes(label)) {
            bahanTanpaBiayaList.push(label);
          }
        }

        // Menentukan biayaSatuan berdasarkan satuan baris dan hasilProduksi sub-produk
        let biayaSatuan = subKalkulasi.hpp;
        const hp = subProduk?.hasilProduksi;

        if (rowSatuan === 'porsi' || !hp || hp.satuan === 'porsi') {
          // Aturan 1: Satuan porsi atau output porsi / tidak ada hasilProduksi
          biayaSatuan = subKalkulasi.hpp;
        } else if (rowSatuan === hp.satuan) {
          // Aturan 2: Satuan baris sama dengan satuan hasilProduksi
          if (typeof hp.jumlah === 'number' && hp.jumlah > 0) {
            biayaSatuan = subKalkulasi.hpp / hp.jumlah;
          } else {
            // Guard: output batch tidak valid, fallback ke porsi
            biayaSatuan = subKalkulasi.hpp;
            adaBahanTanpaBiaya = true;
            const invalidOutputLabel = `${namaSub} (output batch tidak valid)`;
            if (!bahanTanpaBiayaList.includes(invalidOutputLabel)) {
              bahanTanpaBiayaList.push(invalidOutputLabel);
            }
          }
        } else {
          // Aturan 3: Satuan baris tidak cocok dengan output (misal data lama)
          biayaSatuan = subKalkulasi.hpp;
        }

        const subtotalBiaya = Number((rowJumlah * biayaSatuan).toFixed(2));
        totalHpp += subtotalBiaya;

        itemsDetail.push({
          id: rowId,
          tipe: 'sub_produk',
          refId: targetSubId,
          nama: namaSub,
          jumlah: rowJumlah,
          satuan: rowSatuan || 'porsi',
          biayaSatuan,
          subtotalBiaya,
          hasBiaya: !subKalkulasi.adaBahanTanpaBiaya && !isSubTanpaResep,
          level: currentLevel,
          subItems: subKalkulasi.itemsDetail,
        });
      }
    }

    const roundedHpp = Math.round(totalHpp);
    const numHarga = typeof hargaJual === 'number' && !isNaN(hargaJual) ? hargaJual : 0;
    const estimasiProfit = numHarga - roundedHpp;
    const marginPersen = numHarga > 0 ? Number((((numHarga - roundedHpp) / numHarga) * 100).toFixed(1)) : 0;

    return {
      hpp: roundedHpp,
      hargaJual: numHarga,
      estimasiProfit,
      marginPersen,
      isResepKosong: false,
      adaBahanTanpaBiaya,
      bahanTanpaBiayaList,
      itemsDetail,
      hasCycleError: false,
    };
  },
};
