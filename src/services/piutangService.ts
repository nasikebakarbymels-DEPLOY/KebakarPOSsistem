import {
  Transaksi,
  CatatanCicilanPiutang,
  RingkasanPiutangPelanggan,
  StatusPembayaran,
} from '../types';

const PIUTANG_STORAGE_PREFIX = 'pos_fnb_piutang_bayar_outlet_';
const TRANSAKSI_STORAGE_PREFIX = 'pos_fnb_transaksi_outlet_';

function getPiutangStorageKey(outletId: string): string {
  return `${PIUTANG_STORAGE_PREFIX}${outletId}`;
}

function getTransaksiStorageKey(outletId: string): string {
  return `${TRANSAKSI_STORAGE_PREFIX}${outletId}`;
}

export interface CatatCicilanPayload {
  transaksiId: string;
  jumlah: number;
  metode: 'tunai' | 'transfer';
  tanggal: string; // YYYY-MM-DD
  catatan?: string;
}

export const piutangService = {
  // Ambil semua riwayat cicilan untuk outlet tertentu
  getCicilanByOutlet: async (outletId: string): Promise<CatatanCicilanPiutang[]> => {
    if (!outletId) return [];
    try {
      const raw = localStorage.getItem(getPiutangStorageKey(outletId));
      if (!raw) return [];
      const list: CatatanCicilanPiutang[] = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (err) {
      console.error(`Gagal membaca cicilan piutang outlet ${outletId}:`, err);
      return [];
    }
  },

  // Ambil cicilan untuk transaksi tertentu
  getCicilanByTransaksi: async (
    outletId: string,
    transaksiId: string
  ): Promise<CatatanCicilanPiutang[]> => {
    const list = await piutangService.getCicilanByOutlet(outletId);
    return list.filter((c) => c.transaksiId === transaksiId);
  },

  // Hitung sisa hutang hidup untuk satu transaksi spesifik
  getSisaHutangTransaksi: (
    transaksi: Transaksi,
    cicilanList: CatatanCicilanPiutang[]
  ): { sisaAwal: number; totalCicilan: number; sisaHutangHidup: number } => {
    // Sisa awal transaksi saat checkout
    const jumlahDibayarAwal = Number(transaksi.pembayaran?.jumlahDibayar || 0);
    const totalVal = typeof transaksi.totalAkhir === 'number' ? transaksi.totalAkhir : transaksi.total;
    const sisaAwal = Math.max(0, totalVal - jumlahDibayarAwal);

    // Filter cicilan yang milik transaksi ini
    const cicilanTrx = cicilanList.filter((c) => c.transaksiId === transaksi.id);
    const totalCicilan = cicilanTrx.reduce((sum, c) => sum + Number(c.jumlah || 0), 0);

    const sisaHutangHidup = Math.max(0, sisaAwal - totalCicilan);

    return { sisaAwal, totalCicilan, sisaHutangHidup };
  },

  // Ambil daftar rekap piutang per pelanggan (terurut sisa hutang terbesar)
  getRekapPiutangPelanggan: async (
    outletId: string
  ): Promise<RingkasanPiutangPelanggan[]> => {
    if (!outletId) return [];

    // Baca transaksi
    let allTransaksi: Transaksi[] = [];
    try {
      const rawTrx = localStorage.getItem(getTransaksiStorageKey(outletId));
      if (rawTrx) {
        allTransaksi = JSON.parse(rawTrx);
      }
    } catch (err) {
      console.error('Gagal membaca transaksi untuk buku piutang:', err);
      allTransaksi = [];
    }

    // Filter transaksi piutang
    const transaksiPiutang = allTransaksi.filter(
      (t) => t.pembayaran?.metode === 'piutang'
    );

    // Baca seluruh cicilan
    const allCicilan = await piutangService.getCicilanByOutlet(outletId);

    // Map pelanggan
    const pelangganMap = new Map<string, RingkasanPiutangPelanggan>();

    transaksiPiutang.forEach((trx) => {
      const nama = trx.pembayaran?.pelangganNama?.trim() || 'Pelanggan Umum';
      const key = nama.toLowerCase();

      const { sisaAwal, totalCicilan, sisaHutangHidup } =
        piutangService.getSisaHutangTransaksi(trx, allCicilan);

      // Snapshot transaksi dengan sisa hutang hidup terkini
      const trxCloned: Transaksi = {
        ...trx,
        pembayaran: trx.pembayaran
          ? {
              ...trx.pembayaran,
              sisaHutang: sisaHutangHidup,
            }
          : undefined,
        statusPembayaran:
          sisaHutangHidup === 0
            ? ('lunas' as StatusPembayaran)
            : (Number(trx.pembayaran?.jumlahDibayar || 0) > 0 || totalCicilan > 0)
            ? ('sebagian' as StatusPembayaran)
            : ('hutang' as StatusPembayaran),
      };

      const cicilanTrx = allCicilan.filter((c) => c.transaksiId === trx.id);

      if (!pelangganMap.has(key)) {
        pelangganMap.set(key, {
          pelangganNama: nama,
          totalHutangAwal: sisaAwal,
          totalSudahDibayar: totalCicilan,
          totalSisaHutang: sisaHutangHidup,
          transaksiList: [trxCloned],
          cicilanList: [...cicilanTrx],
          transaksiBelumLunasCount: sisaHutangHidup > 0 ? 1 : 0,
        });
      } else {
        const existing = pelangganMap.get(key)!;
        existing.totalHutangAwal += sisaAwal;
        existing.totalSudahDibayar += totalCicilan;
        existing.totalSisaHutang += sisaHutangHidup;
        existing.transaksiList.push(trxCloned);
        existing.cicilanList.push(...cicilanTrx);
        if (sisaHutangHidup > 0) {
          existing.transaksiBelumLunasCount += 1;
        }
      }
    });

    // Urutkan list pelanggan berdasarkan totalSisaHutang terbesar ke terkecil
    const result = Array.from(pelangganMap.values());
    result.sort((a, b) => {
      if (b.totalSisaHutang !== a.totalSisaHutang) {
        return b.totalSisaHutang - a.totalSisaHutang;
      }
      return a.pelangganNama.localeCompare(b.pelangganNama);
    });

    // Urutkan transaksi dan cicilan per pelanggan dari yang paling baru
    result.forEach((p) => {
      p.transaksiList.sort(
        (a, b) => new Date(String(b.tanggal || b.createdAt)).getTime() - new Date(String(a.tanggal || a.createdAt)).getTime()
      );
      p.cicilanList.sort(
        (a, b) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime()
      );
    });

    return result;
  },

  // Catat pembayaran cicilan
  catatPembayaranCicilan: async (
    outletId: string,
    payload: CatatCicilanPayload
  ): Promise<CatatanCicilanPiutang> => {
    if (!outletId) throw new Error('Outlet ID tidak valid.');
    const { transaksiId, jumlah, metode, tanggal, catatan } = payload;

    if (!transaksiId) {
      throw new Error('ID Transaksi piutang harus ditentukan.');
    }

    if (!jumlah || isNaN(jumlah) || jumlah <= 0) {
      throw new Error('Nominal pembayaran cicilan harus lebih dari Rp 0.');
    }

    if (!metode || !['tunai', 'transfer'].includes(metode)) {
      throw new Error('Metode pembayaran cicilan harus Tunai atau Transfer.');
    }

    if (!tanggal) {
      throw new Error('Tanggal pembayaran cicilan wajib diisi.');
    }

    // 1. Ambil transaksi dari storage
    const trxRaw = localStorage.getItem(getTransaksiStorageKey(outletId));
    if (!trxRaw) {
      throw new Error('Data transaksi outlet tidak ditemukan.');
    }

    let trxList: Transaksi[] = JSON.parse(trxRaw);
    const targetIdx = trxList.findIndex((t) => t.id === transaksiId);

    if (targetIdx === -1) {
      throw new Error('Transaksi piutang tidak ditemukan.');
    }

    const targetTrx = trxList[targetIdx];

    // 2. Cek riwayat cicilan sebelumnya untuk transaksi ini
    const existingCicilan = await piutangService.getCicilanByOutlet(outletId);
    const { sisaHutangHidup } = piutangService.getSisaHutangTransaksi(
      targetTrx,
      existingCicilan
    );

    if (sisaHutangHidup <= 0) {
      throw new Error('Transaksi ini sudah lunas sepenuhnya.');
    }

    if (jumlah > sisaHutangHidup) {
      throw new Error(
        `Nominal pembayaran (Rp ${jumlah.toLocaleString(
          'id-ID'
        )}) melebihi sisa hutang transaksi ini (Rp ${sisaHutangHidup.toLocaleString(
          'id-ID'
        )}).`
      );
    }

    // 3. Simpan record cicilan baru
    const nowIso = new Date().toISOString();
    const baru: CatatanCicilanPiutang = {
      id: `ccl-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      outletId,
      pelangganNama: targetTrx.pembayaran?.pelangganNama || 'Pelanggan',
      transaksiId,
      jumlah,
      metode,
      tanggal,
      catatan: catatan?.trim() || undefined,
      isDeleted: false,
      version: 1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const updatedCicilanList = [baru, ...existingCicilan];
    localStorage.setItem(
      getPiutangStorageKey(outletId),
      JSON.stringify(updatedCicilanList)
    );

    // 4. Perbarui dokumen transaksi terkait
    const sisaSetelahCicilan = Math.max(0, sisaHutangHidup - jumlah);
    const updatedStatus: StatusPembayaran =
      sisaSetelahCicilan === 0 ? 'lunas' : 'sebagian';

    const updatedTrx: Transaksi = {
      ...targetTrx,
      pembayaran: targetTrx.pembayaran
        ? {
            ...targetTrx.pembayaran,
            sisaHutang: sisaSetelahCicilan,
          }
        : undefined,
      statusPembayaran: updatedStatus,
    };

    trxList[targetIdx] = updatedTrx;
    localStorage.setItem(getTransaksiStorageKey(outletId), JSON.stringify(trxList));

    // 5. Dispatch event untuk merefresh UI, laporan, dan riwayat transaksi
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('pos_fnb_transaksi_updated', { detail: { outletId } })
      );
      window.dispatchEvent(
        new CustomEvent('pos_fnb_piutang_updated', { detail: { outletId } })
      );
    }

    return baru;
  },
};
