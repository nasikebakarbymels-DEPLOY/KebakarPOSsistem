import { DrafKeranjang, ItemKeranjang, PosViewMode, RingkasanKeranjang } from '../types';

const CART_STORAGE_PREFIX = 'pos_fnb_cart_outlet_';
const VIEW_STORAGE_PREFIX = 'pos_fnb_posview_';

function getCartStorageKey(outletId: string): string {
  return `${CART_STORAGE_PREFIX}${outletId}`;
}

function getViewStorageKey(outletId: string): string {
  return `${VIEW_STORAGE_PREFIX}${outletId}`;
}

export const defaultDrafKeranjang: DrafKeranjang = {
  items: [],
  tipePesanan: 'dine_in',
  nomorMeja: '',
  catatanPesanan: '',
  tipeDiskonTransaksi: 'nominal',
  diskonTransaksiNilai: 0,
  updatedAt: new Date().toISOString(),
};

export const keranjangService = {
  // Mendapatkan draf keranjang dari localStorage
  getDrafKeranjang(outletId: string): DrafKeranjang {
    if (!outletId) return { ...defaultDrafKeranjang };
    try {
      const raw = localStorage.getItem(getCartStorageKey(outletId));
      if (!raw) return { ...defaultDrafKeranjang };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) {
        return { ...defaultDrafKeranjang };
      }
      return {
        items: parsed.items,
        tipePesanan: parsed.tipePesanan === 'takeaway' ? 'takeaway' : 'dine_in',
        nomorMeja: parsed.nomorMeja || '',
        catatanPesanan: parsed.catatanPesanan || '',
        tipeDiskonTransaksi: parsed.tipeDiskonTransaksi === 'persen' ? 'persen' : 'nominal',
        diskonTransaksiNilai: Number(parsed.diskonTransaksiNilai) || 0,
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    } catch {
      return { ...defaultDrafKeranjang };
    }
  },

  // Menyimpan draf keranjang ke localStorage
  saveDrafKeranjang(outletId: string, draf: DrafKeranjang): void {
    if (!outletId) return;
    try {
      const payload: DrafKeranjang = {
        ...draf,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(getCartStorageKey(outletId), JSON.stringify(payload));
    } catch (err) {
      console.error('Gagal menyimpan draf keranjang:', err);
    }
  },

  // Mengosongkan draf keranjang
  clearDrafKeranjang(outletId: string): void {
    if (!outletId) return;
    try {
      localStorage.removeItem(getCartStorageKey(outletId));
    } catch (err) {
      console.error('Gagal menghapus draf keranjang:', err);
    }
  },

  // Mendapatkan pilihan mode tampilan (grid/list)
  getViewMode(outletId: string): PosViewMode {
    if (!outletId) return 'grid';
    try {
      const saved = localStorage.getItem(getViewStorageKey(outletId));
      return saved === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  },

  // Menyimpan pilihan mode tampilan
  saveViewMode(outletId: string, mode: PosViewMode): void {
    if (!outletId) return;
    try {
      localStorage.setItem(getViewStorageKey(outletId), mode);
    } catch (err) {
      console.error('Gagal menyimpan preferensi tampilan:', err);
    }
  },

  // Menghitung ringkasan kalkulasi keranjang
  kalkulasiRingkasan(draf: DrafKeranjang): RingkasanKeranjang {
    let totalItemCount = 0;
    let subtotalKotor = 0;
    let totalDiskonItem = 0;

    for (const item of draf.items) {
      const qty = Math.max(1, Math.min(999, Math.floor(item.qty || 1)));
      const harga = Math.max(0, item.hargaJual || 0);
      const barisKotor = qty * harga;
      const diskon = Math.max(0, Math.min(barisKotor, item.diskonItem || 0));

      totalItemCount += qty;
      subtotalKotor += barisKotor;
      totalDiskonItem += diskon;
    }

    const subtotalBersih = Math.max(0, subtotalKotor - totalDiskonItem);

    let diskonTransaksiNominal = 0;
    const nilaiDiskonInput = Math.max(0, draf.diskonTransaksiNilai || 0);

    if (draf.tipeDiskonTransaksi === 'persen') {
      // Pembulatan Rupiah
      const persen = Math.min(100, nilaiDiskonInput);
      diskonTransaksiNominal = Math.min(
        subtotalBersih,
        Math.round((persen / 100) * subtotalBersih)
      );
    } else {
      diskonTransaksiNominal = Math.min(
        subtotalBersih,
        Math.round(nilaiDiskonInput)
      );
    }

    const totalAkhir = Math.max(0, subtotalBersih - diskonTransaksiNominal);

    return {
      totalItemCount,
      subtotalKotor,
      totalDiskonItem,
      subtotalBersih,
      diskonTransaksiNominal,
      totalAkhir,
    };
  },
};
