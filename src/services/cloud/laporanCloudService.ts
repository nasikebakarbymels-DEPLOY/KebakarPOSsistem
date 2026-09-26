import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Transaksi } from '../../types';
import { outletService } from '../outletService';

export type PeriodeLaporanCloud = 'hari' | '7hari' | '30hari' | 'bulan';

export interface ProdukPerformaItem {
  produkId?: string;
  nama: string;
  qty: number;
  omzet: number;
  hpp: number;
  laba: number;
  marginPersen: number;
}

export interface TrenHarianLokalItem {
  tanggalLokal: string; // YYYY-MM-DD
  tanggalLabel: string; // misal "25 Sep"
  omzet: number;
  totalTrx: number;
  hpp: number;
  laba: number;
}

export interface AgregasiTransaksi {
  omzet: number;
  totalTrx: number;
  totalHpp: number;
  labaKotor: number;
  marginPersen: number;
  perProduk: ProdukPerformaItem[];
  perHari: TrenHarianLokalItem[];
}

export interface TransaksiPeriodResult {
  list: Transaksi[];
  truncated: boolean;
}

export interface OutletKonsolidasiRow {
  outletId: string;
  nama: string;
  totalTrx: number;
  omzet: number;
  hpp: number;
  laba: number;
  marginPersen: number;
  truncated: boolean;
}

export interface KonsolidasiGrupResult {
  ringkasan: AgregasiTransaksi;
  perOutlet: OutletKonsolidasiRow[];
}

/**
 * Mendapatkan ISO string untuk awal periode dalam waktu lokal perangkat:
 * - 'hari': awal hari ini (00:00:00.000)
 * - '7hari': awal hari 6 hari sebelum hari ini (00:00:00.000)
 * - '30hari': awal hari 29 hari sebelum hari ini (00:00:00.000)
 * - 'bulan': awal bulan berjalan tanggal 1 (00:00:00.000)
 */
export function getStartOfPeriodISO(periode: PeriodeLaporanCloud): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (periode === '7hari') {
    d.setDate(d.getDate() - 6);
  } else if (periode === '30hari') {
    d.setDate(d.getDate() - 29);
  } else if (periode === 'bulan') {
    d.setDate(1);
  }
  return d.toISOString();
}

/**
 * Service agregasi laporan berbasis data langsung Firestore (Fase 5)
 */
export const laporanCloudService = {
  /**
   * Mengambil daftar transaksi pada periode tertentu untuk satu outlet,
   * dibatasi maksimal limitCount (default 500) dokumen.
   */
  async getTransaksiPeriod(
    outletId: string,
    periode: PeriodeLaporanCloud,
    limitCount: number = 500
  ): Promise<TransaksiPeriodResult> {
    if (!outletId) return { list: [], truncated: false };

    const startIso = getStartOfPeriodISO(periode);
    const colRef = collection(db, 'outlets', outletId, 'transaksi');
    const list: Transaksi[] = [];

    try {
      const q = query(
        colRef,
        where('createdAt', '>=', startIso),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Transaksi;
        if (!data.isDeleted) {
          list.push({ ...data, id: docSnap.id });
        }
      });
    } catch (err) {
      console.warn('[laporanCloudService] orderBy failed, fallback query without orderBy:', err);
      const fallbackQ = query(
        colRef,
        where('createdAt', '>=', startIso),
        limit(limitCount)
      );
      const snap = await getDocs(fallbackQ);
      snap.forEach((docSnap) => {
        const data = docSnap.data() as Transaksi;
        if (!data.isDeleted) {
          list.push({ ...data, id: docSnap.id });
        }
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    const truncated = list.length >= limitCount;
    return { list, truncated };
  },

  /**
   * Melakukan kalkulasi agregasi omzet, total transaksi, total HPP, laba kotor, margin,
   * performa per produk, dan tren harian langsung di perangkat.
   */
  aggregateTransaksi(list: Transaksi[]): AgregasiTransaksi {
    let omzet = 0;
    let totalHpp = 0;
    const produkMap = new Map<string, { nama: string; qty: number; omzet: number; hpp: number }>();
    const hariMap = new Map<string, { omzet: number; totalTrx: number; hpp: number; laba: number }>();

    for (const t of list) {
      const trxTotal = typeof t.total === 'number' ? t.total : 0;
      omzet += trxTotal;

      // Ambil tanggal lokal perangkat YYYY-MM-DD
      const d = new Date(t.createdAt);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const tglKey = `${yyyy}-${mm}-${dd}`;

      let trxHpp = 0;
      const items = Array.isArray(t.items) ? t.items : [];
      for (const it of items) {
        const q = typeof it.qty === 'number' ? it.qty : 1;
        const hppSat = typeof it.hppSatuan === 'number' ? it.hppSatuan : 0;
        const sub =
          typeof it.subtotal === 'number'
            ? it.subtotal
            : (typeof it.hargaJual === 'number' ? it.hargaJual * q : 0);
        const itemHpp = hppSat * q;
        trxHpp += itemHpp;

        // Group per produk
        const prodName = (it.nama || 'Item').trim();
        const existing = produkMap.get(prodName) || { nama: prodName, qty: 0, omzet: 0, hpp: 0 };
        existing.qty += q;
        existing.omzet += sub;
        existing.hpp += itemHpp;
        produkMap.set(prodName, existing);
      }

      totalHpp += trxHpp;

      // Group per hari
      const existingHari = hariMap.get(tglKey) || { omzet: 0, totalTrx: 0, hpp: 0, laba: 0 };
      existingHari.omzet += trxTotal;
      existingHari.totalTrx += 1;
      existingHari.hpp += trxHpp;
      existingHari.laba += trxTotal - trxHpp;
      hariMap.set(tglKey, existingHari);
    }

    const labaKotor = omzet - totalHpp;
    const marginPersen = omzet > 0 ? Number(((labaKotor / omzet) * 100).toFixed(1)) : 0;

    const perProduk: ProdukPerformaItem[] = Array.from(produkMap.values())
      .map((p) => {
        const pLaba = p.omzet - p.hpp;
        const pMargin = p.omzet > 0 ? Number(((pLaba / p.omzet) * 100).toFixed(1)) : 0;
        return {
          nama: p.nama,
          qty: p.qty,
          omzet: p.omzet,
          hpp: p.hpp,
          laba: pLaba,
          marginPersen: pMargin,
        };
      })
      .sort((a, b) => b.omzet - a.omzet);

    const perHari: TrenHarianLokalItem[] = Array.from(hariMap.entries())
      .map(([tanggalLokal, val]) => {
        const [year, month, day] = tanggalLokal.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const tglLabel = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        return {
          tanggalLokal,
          tanggalLabel: tglLabel,
          omzet: val.omzet,
          totalTrx: val.totalTrx,
          hpp: val.hpp,
          laba: val.laba,
        };
      })
      .sort((a, b) => a.tanggalLokal.localeCompare(b.tanggalLokal));

    return {
      omzet,
      totalTrx: list.length,
      totalHpp,
      labaKotor,
      marginPersen,
      perProduk,
      perHari,
    };
  },

  /**
   * Mengambil total belanja/pembelian bahan pada periode yang sama
   */
  async getBelanjaBahanPeriod(outletId: string, periode: PeriodeLaporanCloud): Promise<number> {
    if (!outletId) return 0;
    const startIso = getStartOfPeriodISO(periode);
    const startLocalYmd = startIso.split('T')[0];
    const colRef = collection(db, 'outlets', outletId, 'pembelianBahan');

    try {
      const snap = await getDocs(query(colRef, where('isDeleted', '==', false)));
      let total = 0;
      snap.forEach((d) => {
        const data = d.data();
        const tgl = typeof data.tanggal === 'string' ? data.tanggal : '';
        const cAt = typeof data.createdAt === 'string' ? data.createdAt : '';
        const inPeriod = (cAt && cAt >= startIso) || (tgl && tgl >= startLocalYmd);
        if (inPeriod) {
          const val =
            typeof data.totalPembelian === 'number'
              ? data.totalPembelian
              : (typeof data.totalHarga === 'number' ? data.totalHarga : 0);
          total += val;
        }
      });
      return total;
    } catch (err) {
      console.error('[laporanCloudService] Gagal memuat belanja bahan:', err);
      return 0;
    }
  },

  /**
   * Mengambil ringkasan konsolidasi grup dari seluruh outlet yang terdaftar
   */
  async getKonsolidasiGrup(periode: PeriodeLaporanCloud): Promise<KonsolidasiGrupResult> {
    const outlets = await outletService.getAll();
    const perOutlet: OutletKonsolidasiRow[] = [];
    const allTransactions: Transaksi[] = [];

    for (const outlet of outlets) {
      const { list, truncated } = await this.getTransaksiPeriod(outlet.id, periode, 500);
      allTransactions.push(...list);
      const agg = this.aggregateTransaksi(list);
      perOutlet.push({
        outletId: outlet.id,
        nama: outlet.nama || 'Outlet',
        totalTrx: agg.totalTrx,
        omzet: agg.omzet,
        hpp: agg.totalHpp,
        laba: agg.labaKotor,
        marginPersen: agg.marginPersen,
        truncated,
      });
    }

    const ringkasan = this.aggregateTransaksi(allTransactions);
    return { ringkasan, perOutlet };
  },

  /**
   * Ekspor daftar transaksi ke file CSV berformat Excel-compatible (UTF-8 with BOM)
   */
  exportCsvTransaksi(list: Transaksi[], namaOutlet: string, periode: string): void {
    const headers = ['Nomor', 'Waktu Lokal', 'Kasir', 'Metode', 'Jumlah Item', 'Omzet', 'HPP', 'Laba'];
    const rows = list.map((t) => {
      const nomor = t.nomorTransaksi || t.id;
      const waktuLokal = t.createdAt
        ? new Date(t.createdAt).toLocaleString('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '-';
      const kasir = t.kasirNama || '-';
      const metode = t.metodeBayar || 'tunai';
      const items = Array.isArray(t.items) ? t.items : [];
      const jmlItem = items.reduce((s, it) => s + (it.qty || 0), 0);
      const omzet = typeof t.total === 'number' ? t.total : 0;
      const hpp = items.reduce((s, it) => s + (it.hppSatuan || 0) * (it.qty || 0), 0);
      const laba = omzet - hpp;

      return [
        `"${String(nomor).replace(/"/g, '""')}"`,
        `"${String(waktuLokal).replace(/"/g, '""')}"`,
        `"${String(kasir).replace(/"/g, '""')}"`,
        `"${String(metode).replace(/"/g, '""')}"`,
        jmlItem,
        omzet,
        hpp,
        laba,
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const cleanOutletName = (namaOutlet || 'outlet').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const filename = `laporan_${cleanOutletName}_${periode}_${ymd}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * Helper menghasilkan array 7 hari terakhir yang kontinu untuk grafik batang
   */
  generateLast7DaysTrend(perHari: TrenHarianLokalItem[]): TrenHarianLokalItem[] {
    const map = new Map<string, TrenHarianLokalItem>();
    for (const h of perHari) {
      map.set(h.tanggalLokal, h);
    }

    const result: TrenHarianLokalItem[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      const shortLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

      if (map.has(key)) {
        const item = map.get(key)!;
        result.push({
          ...item,
          tanggalLabel: shortLabel,
        });
      } else {
        result.push({
          tanggalLokal: key,
          tanggalLabel: shortLabel,
          omzet: 0,
          totalTrx: 0,
          hpp: 0,
          laba: 0,
        });
      }
    }
    return result;
  },
};
