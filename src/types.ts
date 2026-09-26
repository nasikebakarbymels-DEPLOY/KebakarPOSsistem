import type { Timestamp } from 'firebase/firestore';

export type FirestoreTimestamp = Timestamp | string;

// Role & Autentikasi Pengguna
export type UserRole = 'super_admin' | 'owner' | 'kasir';
export type UserStatus = 'active' | 'disabled';

export interface User {
  id: string; // Firebase Auth UID
  email: string;
  nama: string;
  role: UserRole;
  outletIds: string[]; // ARRAY: owner/kasir bisa diasosiasikan ke banyak outlet
  activeOutletId?: string; // ID outlet aktif sesi berjalan
  outletId?: string; // Alias ke activeOutletId untuk backward compatibility
  outletName?: string; // Nama outlet aktif untuk tampilan cepat
  status: UserStatus;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface Outlet {
  id: string;
  nama: string;
  alamat?: string;
  telepon?: string;
  ownerIds: string[]; // UID pemilik outlet
  pinOwnerHash?: string; // SHA-256 + salt hash untuk approval biaya manual di kasir
  pinOwnerSetAt?: string; // ISO string
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

export interface UserOutletRelation {
  userId: string;
  outletId: string;
  role: UserRole;
  assignedAt: FirestoreTimestamp;
}

export type ViewState = 'loading' | 'empty' | 'error' | 'ready';

// Navigasi Berdasarkan Role
export type OwnerTab = 'beranda' | 'produk' | 'promo_biaya' | 'log_approval' | 'kasir' | 'laporan' | 'lainnya';
export type KasirTab = 'kasir' | 'open_bill' | 'riwayat' | 'sync' | 'lainnya';
export type SuperAdminTab = 'dashboard' | 'outlet' | 'users' | 'laporan' | 'lainnya';
export type ActiveTab = OwnerTab | KasirTab | SuperAdminTab;

export interface NavItemConfig {
  id: ActiveTab;
  label: string;
  iconName: string;
  allowedRoles: UserRole[];
}

/**
 * Base Interface untuk Semua Subcollections di bawah outlets/{outletId}/...
 * Wajib memuat outletId, isDeleted, version, createdBy, updatedBy, createdAt, updatedAt
 */
export interface BaseSubcollectionDoc {
  outletId: string;
  isDeleted: boolean; // Soft delete flag
  deletedAt?: FirestoreTimestamp | null;
  version: number; // Conflict resolution versi dokumen
  createdBy?: string; // UID pembuat
  updatedBy?: string; // UID pengedit terakhir
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// Master Bahan & Kemasan (Fase 2)
export type SatuanDasar = 'gram' | 'ml' | 'pcs';

export interface KemasanBahan {
  id: string;
  nama: string;
  netto: number; // Dalam satuan dasar bahan
  isi?: number; // Isi per kemasan dalam satuan dasar bahan (isi > 0)
  hargaPerKemasan?: number; // Harga pembelian kemasan (>= 0)
  acuan?: boolean; // Indikator kemasan acuan HPP (tepat 1 per bahan)
}

export interface RiwayatHargaBahan {
  tanggal: string;
  hargaPerSatuanDasar: number;
  pembelianId: string; // ID pembelian atau 'manual-edit' untuk perubahan manual
}

export interface Bahan extends BaseSubcollectionDoc {
  id: string;
  nama: string;
  sku?: string;
  satuanDasar: SatuanDasar;
  hargaPerSatuanDasar: number; // Biaya per satuan dasar dalam Rupiah (dihitung dari kemasan acuan)
  biayaAwal?: number; // @deprecated
  biayaTerbaru?: number; // @deprecated Biaya per satuan dasar dalam Rupiah
  sumberBiayaInfo?: string;
  catatan?: string;
  kemasanList: KemasanBahan[];
  riwayatHarga?: RiwayatHargaBahan[];
}

// Pembelian Bahan & HPP (Fase 3 Cloud)
export interface ItemPembelian {
  bahanId: string;
  kemasanId: string;
  namaBahanSnapshot: string;
  namaKemasanSnapshot: string;
  isiPerKemasanSnapshot: number;
  qty: number;
  hargaTotal: number;
  hargaPerUnit: number;
  isAcuanKemasan: boolean;
}

export interface PembelianBahan extends BaseSubcollectionDoc {
  id: string;
  tanggal: string; // ISO date string
  supplier: string;
  items: ItemPembelian[];
  totalPembelian: number;
  catatan?: string;
  // Field opsional untuk backward compatibility
  totalHarga?: number;
  bahanId?: string;
  bahanNama?: string;
  kemasanId?: string;
  kemasanNama?: string;
  nettoPerKemasan?: number;
  satuanDasar?: SatuanDasar;
  qty?: number;
  hargaPerKemasan?: number;
  totalNetto?: number;
  biayaPerSatuanDasar?: number;
  supplierCatatan?: string;
  kategori?: string;
}

// Produk & Resep Multi-Level (Fase 4 & Cloud Fase 2)
export type KategoriProduk = 'Makanan' | 'Minuman' | 'Snack' | 'Paket' | 'Lainnya';
export type JenisProduk = 'menu_jual' | 'komponen';
export type TipeItemResep = 'bahan' | 'komponen';

export interface ItemResep {
  id?: string;
  tipe?: TipeItemResep;
  bahanId?: string;
  subProdukId?: string;
  produkId?: string; // @deprecated alias untuk subProdukId
  jumlah?: number; // Jumlah pemakaian bahan (gram/ml/pcs) atau porsi sub-produk
  qty?: number; // @deprecated alias untuk jumlah pada implementasi lokal lama
  satuan: string; // Satuan dasar bahan (gram/ml/pcs) atau 'porsi' untuk sub-produk
  namaSnapshot?: string;
}

export interface Produk extends BaseSubcollectionDoc {
  id: string;
  nama: string;
  sku?: string;
  kategori?: string;
  hargaJual: number;
  jenis?: JenisProduk;
  aktif: boolean;
  resepItems: ItemResep[];
  catatan?: string;
  hasilProduksi?: { jumlah: number; satuan: 'gram' | 'ml' | 'pcs' | 'porsi' };
  diskonProduk?: { tipe: 'nominal' | 'persen'; nilai: number };
}

// Diskon & Voucher (Fase 6)
export interface Voucher extends BaseSubcollectionDoc {
  id: string;
  outletId: string;
  kode: string;
  tipe: 'nominal' | 'persen';
  nilai: number;
  aktif: boolean;
  minBelanja?: number;
  tanggalBerakhir?: string; // YYYY-MM-DD
  createdBy?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// Biaya Lain-lain (Fase 6)
export interface BiayaLain extends BaseSubcollectionDoc {
  id: string;
  outletId: string;
  nama: string;
  tipe: 'nominal' | 'persen';
  nilaiDefault: number;
  nilai?: number; // Alias untuk nilaiDefault
  aktif: boolean;
  createdBy?: string;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
}

// Approval Biaya Manual oleh Owner (Fase 6)
export interface ApprovalBiayaManual {
  biayaId: string;
  biayaNama: string;
  nilaiDefault: number;
  nilaiManual: number;
  tipe: 'nominal' | 'persen';
  kasirId: string;
  kasirNama: string;
  approvedAt: string; // ISO string
}

/** @deprecated Resep koleksi lokal terpisah lama. Pada Firestore Cloud Fase 2, resep disimpan langsung pada produk.resepItems */
export interface Resep extends BaseSubcollectionDoc {
  id: string;
  produkId: string;
  items: ItemResep[];
}

export interface ItemResepDetail {
  id: string;
  tipe: TipeItemResep;
  refId: string;
  nama: string;
  qty: number;
  satuan: string;
  biayaSatuan?: number;
  subtotalBiaya?: number;
  hasBiaya: boolean;
  level: number;
  subItems?: ItemResepDetail[];
}

export interface KalkulasiHPP {
  hpp: number;
  marginPersen: number;
  estimasiProfit: number;
  isResepKosong: boolean;
  adaBahanTanpaBiaya: boolean;
  bahanTanpaBiayaList: string[];
  itemsDetail: ItemResepDetail[];
  hasCycleError?: boolean;
  cycleErrorMessage?: string;
}

// POS Kasir & Keranjang (Fase 5)
export type TipePesanan = 'dine_in' | 'takeaway';
export type TipeDiskonTransaksi = 'persen' | 'nominal';
export type PosViewMode = 'grid' | 'list';

export interface ItemKeranjang {
  id: string;
  produkId?: string;
  nama: string;
  hargaJual: number;
  qty: number;
  catatan?: string;
  diskonItem: number;
  isDadakan: boolean;
}

export interface DrafKeranjang {
  items: ItemKeranjang[];
  tipePesanan: TipePesanan;
  nomorMeja?: string;
  catatanPesanan?: string;
  tipeDiskonTransaksi: TipeDiskonTransaksi;
  diskonTransaksiNilai: number;
  updatedAt: string;
}

export interface RingkasanKeranjang {
  totalItemCount: number;
  subtotalKotor: number;
  totalDiskonItem: number;
  subtotalBersih: number;
  diskonTransaksiNominal: number;
  totalAkhir: number;
}

// Pelanggan & Piutang (Fase 6)
export interface Pelanggan extends BaseSubcollectionDoc {
  id: string;
  nama: string;
  nomorHp?: string;
  catatan?: string;
}

// Pembayaran & Transaksi (Fase 6)
export type MetodePembayaran = 'tunai' | 'qris_transfer' | 'piutang';
export type StatusPembayaran = 'lunas' | 'sebagian' | 'hutang';
export type SyncStatus = 'pending' | 'synced';

// Status Persetujuan Pembatalan/Penghapusan Transaksi (Governance)
export type ApprovalStatus =
  | 'none'
  | 'pending_deletion'
  | 'approved_deletion'
  | 'rejected_deletion';

export interface ItemTransaksiSnapshot {
  id?: string;
  produkId?: string;
  nama: string;
  qty: number;
  hargaJual: number;
  hppSatuan: number;
  subtotal: number;
  // Field audit diskon (Fase 6)
  hargaAsli?: number;
  diskonProdukNominal?: number;
  hargaUnitNeto?: number;
  // Field opsional untuk backward compatibility
  catatan?: string;
  diskonItem?: number;
  isDadakan?: boolean;
  hppSatuanSnapshot?: number;
  hppSubtotalSnapshot?: number;
}

export interface RincianPembayaran {
  metode: MetodePembayaran;
  uangDiterima?: number;
  kembalian?: number;
  referensi?: string;
  pelangganId?: string;
  pelangganNama?: string;
  jumlahDibayar: number;
  sisaHutang: number;
}

export interface Transaksi extends BaseSubcollectionDoc {
  id: string;
  outletId: string;
  nomorTransaksi: string;
  kasirId: string;
  kasirNama: string;
  items: ItemTransaksiSnapshot[];
  total: number;
  metodeBayar: 'tunai' | 'qris' | 'transfer' | 'piutang';
  uangDiterima?: number;
  kembalian?: number;
  status: 'selesai';
  createdAt: string; // ISO string timestamp
  syncSource: 'online' | 'queue';

  // Field Integrasi Open Bill (Fase 7)
  openBillId?: string;
  pelangganId?: string;
  pelangganNama?: string;

  // Field opsional Diskon, Voucher & Biaya Lain (Fase 6)
  diskonProdukTotal?: number;
  voucherKode?: string;
  voucherNilai?: number;
  biayaLainList?: Array<{
    id?: string;
    nama: string;
    tipe: 'nominal' | 'persen';
    nilaiDefault?: number;
    nilaiDipakai?: number;
    nilai?: number; // kompatibilitas
    isManual?: boolean;
    subtotal: number;
  }>;
  approvalBiayaManual?: ApprovalBiayaManual[];

  // Field opsional untuk backward compatibility
  tanggal?: string; // ISO
  totalAkhir?: number;
  totalHppSnapshot?: number;
  tipePesanan?: TipePesanan;
  nomorMeja?: string;
  catatanPesanan?: string;
  subtotalKotor?: number;
  totalDiskonItem?: number;
  subtotalBersih?: number;
  diskonTransaksiTipe?: TipeDiskonTransaksi;
  diskonTransaksiNilai?: number;
  diskonTransaksiNominal?: number;
  pembayaran?: RincianPembayaran;
  statusPembayaran?: StatusPembayaran;
  syncStatus?: SyncStatus;
  isOfflineCreated?: boolean;

  // Field Persetujuan / Approval (Governance Multi-Outlet)
  approvalStatus?: ApprovalStatus;
  approvalRequestedBy?: string;
  approvalRequestedAt?: FirestoreTimestamp;
  approvedBy?: string;
  approvedAt?: FirestoreTimestamp;
}

// Open Bill Fleksibel Multi-Tipe (Fase 7)
export type TipeOpenBill =
  | 'dine_in'
  | 'takeaway'
  | 'delivery'
  | 'pre_order'
  | 'utang'
  | 'katering';

export type StatusOpenBill = 'open' | 'closed' | 'cancelled';

export interface ItemOrderBill {
  produkId?: string;
  nama: string;
  qty: number;
  hargaJual: number;
  catatan?: string;
}

export interface KoreksiItemOrder {
  waktu: string;
  dari: number;
  ke: number;
  alasan: string;
  oleh: string;
}

export interface OrderBill {
  id: string;
  waktu: string;
  items: ItemOrderBill[];
  sudahDicetakDapur: boolean;
  koreksi?: KoreksiItemOrder[];
}

export interface OpenBillMeta {
  nomorMeja?: string;
  alamat?: string;
  patokan?: string;
  ongkir?: number;
  tanggalAmbil?: string; // YYYY-MM-DD
  pelangganId?: string;
  pelangganNama?: string;
  tanggalAcara?: string; // YYYY-MM-DD
  jumlahPorsi?: number;
}

export interface OpenBill extends BaseSubcollectionDoc {
  id: string;
  outletId: string;
  label: string;
  tipe: TipeOpenBill;
  meta: OpenBillMeta;
  orders: OrderBill[];
  status: StatusOpenBill;
  groupId?: string;
  transaksiId?: string;
  alasanBatal?: string;
  kasirId: string;
  kasirNama: string;
  openedAt: string;
  closedAt?: string;

  // Backward compatibility
  draf?: DrafKeranjang;
}

// Pengeluaran Operasional & Laporan (Fase 8)
export type MetodePengeluaran = 'tunai' | 'transfer' | 'hutang';

export interface Pengeluaran extends BaseSubcollectionDoc {
  id: string;
  tanggal: string; // YYYY-MM-DD
  kategori: string;
  nominal: number;
  metode: MetodePengeluaran;
  catatan?: string;
}

export interface RingkasanLabaRugi {
  pendapatanKotor: number;
  totalDiskon: number;
  pendapatanBersih: number;
  totalHpp: number;
  labaKotor: number;
  marginKotor: number;
  totalPengeluaran: number;
  labaBersih: number;
  marginBersih: number;
  jumlahTransaksi: number;
  rataRataTransaksi: number;
}

export interface PerformaProdukItem {
  produkId?: string;
  nama: string;
  isDadakan: boolean;
  qtyTerjual: number;
  omzetBersih: number;
  totalHpp: number;
  profit: number;
  margin: number;
}

export type PeriodeLaporan = 'hari_ini' | '7_hari' | '30_hari' | 'bulan_ini' | 'custom';

// Dashboard Beranda & Konsolidasi (Fase 9)
export interface ChartHarianItem {
  dateStr: string;
  dayLabel: string;
  dateLabel: string;
  omzet: number;
  totalHpp: number;
  pengeluaran: number;
  labaBersih: number;
  jumlahTransaksi: number;
}

export interface AgregasiOutletItem {
  outlet: Outlet;
  ringkasan: RingkasanLabaRugi;
}

// Buku Piutang & Cicilan (Fase 10)
export interface CatatanCicilanPiutang extends BaseSubcollectionDoc {
  id: string;
  pelangganId?: string; // ID referensi ke pelanggan (opsional, untuk backward compatibility)
  pelangganNama: string;
  transaksiId: string;
  jumlah: number;
  metode: 'tunai' | 'transfer';
  tanggal: string; // YYYY-MM-DD
  catatan?: string;
}

export interface RingkasanPiutangPelanggan {
  pelangganNama: string;
  nomorHp?: string;
  totalHutangAwal: number;
  totalSudahDibayar: number;
  totalSisaHutang: number;
  transaksiList: Transaksi[];
  cicilanList: CatatanCicilanPiutang[];
  transaksiBelumLunasCount: number;
}

// IndexedDB Skema Data Lokal
export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncQueueStatus = 'pending' | 'processing' | 'failed';

export interface SyncOperation {
  id: string;
  entityType: string;
  entityId: string;
  operation: SyncOperationType;
  payload: any;
  status: SyncQueueStatus;
  retryCount: number;
  createdAt: string;
  error?: string;
}

export interface LocalDraft {
  key: string;
  data: any;
  updatedAt: string;
}
