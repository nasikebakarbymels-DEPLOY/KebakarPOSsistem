import {
  Transaksi,
  Pengeluaran,
  RingkasanLabaRugi,
  PerformaProdukItem,
  PeriodeLaporan,
  Outlet,
  ChartHarianItem,
  AgregasiOutletItem,
} from '../types';
import { transaksiService } from './transaksiService';
import { pengeluaranService } from './pengeluaranService';

export interface CustomDateRange {
  dari: string; // YYYY-MM-DD
  sampai: string; // YYYY-MM-DD
}

export interface TrenHarianItem {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // "Sen", "Sel", dst
  dateLabel: string; // "22/09"
  omzet: number;
  totalHpp: number;
  pengeluaran: number;
  labaBersih: number;
  jumlahTransaksi: number;
}

// Helper untuk mendapatkan tanggal lokal format YYYY-MM-DD
export function getLocalTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateDaysAgoString(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFirstDayOfMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export const laporanService = {
  // 1. Filter periode serbaguna untuk list apapun yang memiliki field `tanggal` atau `createdAt`
  filterPeriode: <T extends { tanggal?: string; createdAt?: any }>(
    list: T[],
    periode: PeriodeLaporan,
    customRange?: CustomDateRange
  ): T[] => {
    if (!Array.isArray(list)) return [];

    const todayStr = getLocalTodayString();

    return list.filter((item) => {
      const rawDate = item.tanggal || (typeof item.createdAt === 'string' ? item.createdAt : '');
      if (!rawDate) return false;
      // Normalisasi tanggal YYYY-MM-DD dari string ISO atau YYYY-MM-DD
      const itemDateStr = rawDate.substring(0, 10);

      switch (periode) {
        case 'hari_ini':
          return itemDateStr === todayStr;
        case '7_hari': {
          const sevenDaysAgo = getDateDaysAgoString(6); // 7 hari termasuk hari ini
          return itemDateStr >= sevenDaysAgo && itemDateStr <= todayStr;
        }
        case '30_hari': {
          const thirtyDaysAgo = getDateDaysAgoString(29); // 30 hari termasuk hari ini
          return itemDateStr >= thirtyDaysAgo && itemDateStr <= todayStr;
        }
        case 'bulan_ini': {
          const firstDay = getFirstDayOfMonthString();
          return itemDateStr >= firstDay && itemDateStr <= todayStr;
        }
        case 'custom': {
          if (!customRange?.dari || !customRange?.sampai) return true;
          return (
            itemDateStr >= customRange.dari && itemDateStr <= customRange.sampai
          );
        }
        default:
          return true;
      }
    });
  },

  // 2. Hitung Laba Rugi dari list Transaksi & Pengeluaran
  hitungLabaRugi: (
    transaksiList: Transaksi[],
    pengeluaranList: Pengeluaran[]
  ): RingkasanLabaRugi => {
    let pendapatanKotor = 0;
    let totalDiskon = 0;
    let pendapatanBersih = 0;
    let totalHpp = 0;

    for (const tx of transaksiList) {
      pendapatanKotor += Number(tx.subtotalKotor) || 0;
      totalDiskon +=
        (Number(tx.totalDiskonItem) || 0) + (Number(tx.diskonTransaksiNominal) || 0);
      pendapatanBersih += Number(tx.totalAkhir) || 0;
      totalHpp += Number(tx.totalHppSnapshot) || 0;
    }

    let totalPengeluaran = 0;
    for (const exp of pengeluaranList) {
      totalPengeluaran += Number(exp.nominal) || 0;
    }

    const labaKotor = pendapatanBersih - totalHpp;
    const marginKotor =
      pendapatanBersih > 0 ? (labaKotor / pendapatanBersih) * 100 : 0;

    const labaBersih = labaKotor - totalPengeluaran;
    const marginBersih =
      pendapatanBersih > 0 ? (labaBersih / pendapatanBersih) * 100 : 0;

    const jumlahTransaksi = transaksiList.length;
    const rataRataTransaksi =
      jumlahTransaksi > 0 ? Math.round(pendapatanBersih / jumlahTransaksi) : 0;

    return {
      pendapatanKotor: Math.round(pendapatanKotor),
      totalDiskon: Math.round(totalDiskon),
      pendapatanBersih: Math.round(pendapatanBersih),
      totalHpp: Math.round(totalHpp),
      labaKotor: Math.round(labaKotor),
      marginKotor: Number(marginKotor.toFixed(1)),
      totalPengeluaran: Math.round(totalPengeluaran),
      labaBersih: Math.round(labaBersih),
      marginBersih: Number(marginBersih.toFixed(1)),
      jumlahTransaksi,
      rataRataTransaksi,
    };
  },

  // 3. Ringkasan performa per produk (urut profit menurun)
  ringkasanPerProduk: (transaksiList: Transaksi[]): PerformaProdukItem[] => {
    const map = new Map<
      string,
      {
        produkId?: string;
        nama: string;
        isDadakan: boolean;
        qtyTerjual: number;
        omzetBersih: number;
        totalHpp: number;
      }
    >();

    for (const tx of transaksiList) {
      if (!Array.isArray(tx.items)) continue;

      for (const item of tx.items) {
        const key = item.isDadakan
          ? `dadakan_${item.nama}`
          : item.produkId || item.nama;

        const current = map.get(key) || {
          produkId: item.produkId,
          nama: item.nama,
          isDadakan: Boolean(item.isDadakan),
          qtyTerjual: 0,
          omzetBersih: 0,
          totalHpp: 0,
        };

        const itemQty = Number(item.qty) || 0;
        const hargaJual = Number(item.hargaJual) || 0;
        const diskonItem = Number(item.diskonItem) || 0;
        const hppSubtotal = item.isDadakan
          ? 0
          : Number(item.hppSubtotalSnapshot) ||
            (Number(item.hppSatuanSnapshot) || 0) * itemQty;

        const itemOmzetBersih = (hargaJual - diskonItem) * itemQty;

        current.qtyTerjual += itemQty;
        current.omzetBersih += itemOmzetBersih;
        current.totalHpp += hppSubtotal;

        map.set(key, current);
      }
    }

    const result: PerformaProdukItem[] = [];

    for (const val of map.values()) {
      const omzetBersih = Math.round(val.omzetBersih);
      const totalHpp = Math.round(val.totalHpp);
      const profit = omzetBersih - totalHpp;
      const margin =
        omzetBersih > 0 ? Number(((profit / omzetBersih) * 100).toFixed(1)) : 0;

      result.push({
        produkId: val.produkId,
        nama: val.nama,
        isDadakan: val.isDadakan,
        qtyTerjual: val.qtyTerjual,
        omzetBersih,
        totalHpp,
        profit,
        margin,
      });
    }

    // Urut profit menurun
    return result.sort((a, b) => b.profit - a.profit);
  },

  // 4. Hitung tren harian 7 hari terakhir untuk chart
  hitungTren7Hari: (
    transaksiList: Transaksi[],
    pengeluaranList: Pengeluaran[]
  ): TrenHarianItem[] => {
    const hariIndo = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    const result: TrenHarianItem[] = [];

    // H-6 sampai H-0 (Hari Ini)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayLabel = hariIndo[d.getDay()];
      const dateLabel = `${day}/${month}`;

      // Filter data spesifik tanggal ini
      const txHariIni = transaksiList.filter(
        (t) => t.tanggal && t.tanggal.substring(0, 10) === dateStr
      );
      const expHariIni = pengeluaranList.filter(
        (e) => e.tanggal && e.tanggal.substring(0, 10) === dateStr
      );

      const rk = laporanService.hitungLabaRugi(txHariIni, expHariIni);

      result.push({
        dateStr,
        dayLabel,
        dateLabel,
        omzet: rk.pendapatanBersih,
        totalHpp: rk.totalHpp,
        pengeluaran: rk.totalPengeluaran,
        labaBersih: rk.labaBersih,
        jumlahTransaksi: rk.jumlahTransaksi,
      });
    }

    return result;
  },

  // 5. Hitung konsolidasi / agregasi multi-outlet (Super Admin)
  hitungAgregasiMultiOutlet: (
    outletsData: { outlet: Outlet; transaksi: Transaksi[]; pengeluaran: Pengeluaran[] }[],
    periode: PeriodeLaporan = 'bulan_ini'
  ) => {
    let totalOmzetGrup = 0;
    let totalHppGrup = 0;
    let totalPengeluaranGrup = 0;
    let totalLabaBersihGrup = 0;
    let totalTransaksiGrup = 0;

    const perOutlet = outletsData.map(({ outlet, transaksi, pengeluaran }) => {
      const fTx = laporanService.filterPeriode(transaksi, periode);
      const fExp = laporanService.filterPeriode(pengeluaran, periode);
      const ringkasan = laporanService.hitungLabaRugi(fTx, fExp);

      totalOmzetGrup += ringkasan.pendapatanBersih;
      totalHppGrup += ringkasan.totalHpp;
      totalPengeluaranGrup += ringkasan.totalPengeluaran;
      totalLabaBersihGrup += ringkasan.labaBersih;
      totalTransaksiGrup += ringkasan.jumlahTransaksi;

      return {
        outlet,
        ringkasan,
      };
    });

    const marginGrup =
      totalOmzetGrup > 0
        ? Number(((totalLabaBersihGrup / totalOmzetGrup) * 100).toFixed(1))
        : 0;

    return {
      totalOmzetGrup,
      totalHppGrup,
      totalPengeluaranGrup,
      totalLabaBersihGrup,
      totalTransaksiGrup,
      marginGrup,
      perOutlet,
    };
  },

  // 6. Unduh File CSV Client-Side
  downloadCsv: (filename: string, csvContent: string): void => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
