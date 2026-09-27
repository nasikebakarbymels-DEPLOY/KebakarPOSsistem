import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { BottomNavigation } from '../components/BottomNavigation';
import { PlaceholderPage } from '../components/PlaceholderPage';
import { ProdukHubPage } from './ProdukHubPage';
import { PosKasirPage } from './PosKasirPage';
import { OpenBillPage } from './OpenBillPage';
import { RiwayatTransaksiPage } from './RiwayatTransaksiPage';
import { LaporanPage } from './LaporanPage';
import { SyncPage } from './SyncPage';
import { BerandaOwnerPage } from './BerandaOwnerPage';
import { DashboardSuperAdminPage } from './DashboardSuperAdminPage';
import { LainnyaPage } from './LainnyaPage';
import { OutletListPage } from './OutletListPage';
import { UserListPage } from './UserListPage';
import { OutletSelectorModal } from '../components/OutletSelectorModal';
import { AccessDeniedToast } from '../components/AccessDeniedToast';
import { PWAInstallBanner } from '../components/PWAInstallBanner';
import { ActiveTab, UserRole } from '../types';

export const MainLayout: React.FC = () => {
  const { user, unauthorizedAttemptMessage, setUnauthorizedAttemptMessage } = useAuth();
  const [isOutletModalOpen, setIsOutletModalOpen] = useState(false);

  // Determine initial tab based on role
  const getDefaultTab = (role?: UserRole): ActiveTab => {
    switch (role) {
      case 'super_admin':
        return 'dashboard';
      case 'owner':
        return 'beranda';
      case 'kasir':
      default:
        return 'kasir';
    }
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (path === '/outlets' || hash === '#/outlets' || hash === '#outlets') {
      if (user?.role === 'super_admin') {
        return 'outlet';
      }
    }
    if (path === '/users' || hash === '#/users' || hash === '#users') {
      if (user?.role === 'super_admin') {
        return 'users';
      }
    }
    if (
      path === '/promo' ||
      path === '/promo_biaya' ||
      hash === '#/promo' ||
      hash === '#/promo_biaya' ||
      hash === '#promo'
    ) {
      return 'lainnya';
    }
    return getDefaultTab(user?.role);
  });

  // Role Access Guard
  const isTabAllowedForRole = (tab: ActiveTab, role: UserRole): boolean => {
    if (role === 'kasir') {
      return ['kasir', 'open_bill', 'riwayat', 'sync', 'lainnya'].includes(tab);
    }
    if (role === 'owner') {
      return ['beranda', 'produk', 'kasir', 'open_bill', 'riwayat', 'laporan', 'lainnya'].includes(tab);
    }
    if (role === 'super_admin') {
      return ['dashboard', 'outlet', 'users', 'laporan', 'lainnya'].includes(tab);
    }
    return false;
  };

  // Check URL routing and enforce strict role guard on mount & navigation
  useEffect(() => {
    if (!user) return;

    const path = window.location.pathname;
    const hash = window.location.hash;

    // Alihkan promo (sesi lama / URL lama) langsung ke tab lainnya tanpa error
    if (
      (activeTab as string) === 'promo' ||
      (activeTab as string) === 'promo_biaya' ||
      path === '/promo' ||
      path === '/promo_biaya' ||
      hash === '#/promo' ||
      hash === '#/promo_biaya' ||
      hash === '#promo'
    ) {
      setActiveTab('lainnya');
      return;
    }

    if (path === '/outlets' || hash === '#/outlets' || hash === '#outlets') {
      if (user.role === 'super_admin') {
        setActiveTab('outlet');
      } else {
        setUnauthorizedAttemptMessage('Akses ditolak: Halaman manajemen outlet hanya dapat diakses oleh Super Admin.');
        setActiveTab(getDefaultTab(user.role));
      }
    } else if (path === '/users' || hash === '#/users' || hash === '#users') {
      if (user.role === 'super_admin') {
        setActiveTab('users');
      } else {
        setUnauthorizedAttemptMessage('Akses ditolak: Halaman manajemen pengguna hanya dapat diakses oleh Super Admin.');
        setActiveTab(getDefaultTab(user.role));
      }
    } else if (!isTabAllowedForRole(activeTab, user.role)) {
      setUnauthorizedAttemptMessage('Anda tidak memiliki akses ke halaman ini.');
      setActiveTab(getDefaultTab(user.role));
    }
  }, [user, activeTab, setUnauthorizedAttemptMessage]);

  if (!user) return null;

  const handleTabChange = (targetTab: ActiveTab) => {
    if (!isTabAllowedForRole(targetTab, user.role)) {
      setUnauthorizedAttemptMessage('Anda tidak memiliki akses ke halaman ini.');
      setActiveTab(getDefaultTab(user.role));
      return;
    }
    setActiveTab(targetTab);
    if (targetTab === 'outlet') {
      window.history.pushState(null, '', '/outlets');
    } else if (targetTab === 'users') {
      window.history.pushState(null, '', '/users');
    } else if (window.location.pathname === '/outlets' || window.location.pathname === '/users') {
      window.history.pushState(null, '', '/');
    }
  };

  // Simulated unauthorized action trigger for testing requirement 8
  const handleAttemptUnauthorizedAction = (featureName: string) => {
    setUnauthorizedAttemptMessage(`Anda tidak memiliki akses ke halaman ini (${featureName}).`);
    setActiveTab(getDefaultTab(user.role));
  };

  // Content configuration for each placeholder page
  const getTabConfig = (tab: ActiveTab) => {
    switch (tab) {
      case 'beranda':
        return {
          title: 'Beranda Owner Outlet',
          description:
            'Ringkasan performa operasional harian outlet aktif, omzet terkini, margin laba kotor, dan tren transaksi.',
          roadmap: [
            'Penjualan dan jumlah transaksi hari ini',
            'Profit kotor & persentase margin secara real-time',
            'Grafik tren penjualan 7 hari terakhir',
            'Daftar produk terlaris & produk dengan margin terbaik',
            'Ringkasan pengeluaran operasional outlet hari ini',
          ],
        };
      case 'produk':
        return {
          title: 'Manajemen Produk & Resep HPP',
          description:
            'Katalog produk F&B, kategori, harga jual, serta perhitungan HPP otomatis berbasis resep multi-level dari biaya bahan terbaru.',
          roadmap: [
            'Daftar menu produk dengan status aktif/non-aktif',
            'Struktur resep multi-level (maksimal 2–3 level resep)',
            'Konversi kemasan bahan (misal botol, pouch, pack, kg ke ml/gram)',
            'Biaya bahan otomatis dari pembelian terakhir (total harga / total netto)',
            'Perhitungan margin produk: (Harga Jual - HPP) / Harga Jual x 100%',
            'Peringatan resep belum lengkap / belum memiliki biaya bahan',
          ],
        };
      case 'kasir':
        return {
          title: 'POS Kasir F&B',
          description:
            'Antarmuka kasir cepat untuk memilih pesanan menu, nomor meja atau takeaway, diskon, dan transaksi pembayaran.',
          roadmap: [
            'Katalog menu berbentuk grid & list dengan filter kategori dan pencarian cepat',
            'Pilihan tipe pesanan: Dine-in (nomor meja) atau Takeaway',
            'Catatan item pesanan dan input item dadakan',
            'Diskon per item maupun diskon total transaksi',
            'Metode pembayaran: Tunai (hitung kembalian), QRIS/Transfer manual, dan Piutang',
            'Fungsi Open Bill untuk tamu yang memesan bertahap',
          ],
        };
      case 'open_bill':
        return {
          title: 'Open Bill & Meja',
          description:
            'Kelola pesanan aktif yang belum diselesaikan untuk tamu dine-in sebelum proses pembayaran.',
          roadmap: [
            'Daftar bill yang masih terbuka berdasarkan nomor meja / pelanggan',
            'Tambah menu ke bill yang sedang berjalan',
            'Rincian tagihan sementara sebelum cetak tagihan final',
            'Penyelesaian pembayaran open bill langsung ke kasir',
          ],
        };
      case 'riwayat':
        return {
          title: 'Riwayat Transaksi',
          description:
            'Daftar transaksi kasir hari ini, status pembayaran, serta pencetakan ulang struk belanja.',
          roadmap: [
            'Daftar transaksi hari ini terurut dari yang terbaru',
            'Status pembayaran (Lunas, Hutang/Piutang, atau Sebagian)',
            'Detail ringkasan item yang dibeli pelanggan',
            'Cetak ulang struk digital atau cetak ke printer Bluetooth',
          ],
        };
      case 'sync':
        return {
          title: 'Sinkronisasi Offline',
          description:
            'Penyelarasan antrean transaksi yang tersimpan di perangkat lokal saat koneksi internet terputus.',
          roadmap: [
            'Monitoring antrean transaksi offline yang belum terkirim',
            'Penyelarasan otomatis saat koneksi kembali online',
            'Tombol pemicu sinkronisasi manual',
            'Idempotensi data transaksi agar tidak terjadi duplikasi penjualan',
          ],
        };
      case 'dashboard':
        return {
          title: 'Dashboard Super Admin',
          description:
            'Ringkasan agregat seluruh outlet jaringan bisnis secara konsolidasi dan read-only.',
          roadmap: [
            'Total konsolidasi omzet seluruh outlet',
            'Total laba & rata-rata margin kotor semua cabang',
            'Total volume transaksi jaringan',
            'Tabel ringkasan performa per outlet (read-only)',
            'Tidak memiliki hak mengubah menu, resep, atau transaksi harian outlet',
          ],
        };
      case 'outlet':
        return {
          title: 'Manajemen Outlet Jaringan',
          description:
            'Kelola cabang outlet yang beroperasi, pendaftaran outlet baru, dan undang owner outlet.',
          roadmap: [
            'Daftar seluruh cabang outlet beserta alamat dan kontak',
            'Formulir pendaftaran outlet baru',
            'Penugasan & undangan untuk Owner Outlet',
            'Isolasi penuh data operasional antar-outlet',
          ],
        };
      case 'users':
        return {
          title: 'Manajemen Pengguna & Peran',
          description:
            'Kelola akun Owner Outlet dan Kasir, otorisasi peran, dan asosiasi cabang.',
          roadmap: [
            'Daftar seluruh pengguna beserta peran dan status',
            'Pendaftaran akun pengguna baru beserta kata sandi awal',
            'Penugasan cabang outlet per pengguna',
            'Pengaturan status aktif/nonaktif akun',
          ],
        };
      case 'laporan':
        return {
          title: user.role === 'super_admin' ? 'Laporan Konsolidasi Grup' : 'Laporan Penjualan & Laba/Rugi',
          description:
            'Laporan finansial F&B: omzet, HPP resep, laba kotor, pengeluaran operasional, dan laba bersih.',
          roadmap: [
            'Laporan Omzet, Total HPP, dan Margin Kotor',
            'Pencatatan Biaya Pembelian Bahan & Pengeluaran (sewa, listrik, gaji, air)',
            'Laba Bersih & Margin Bersih',
            'Filter periode: Hari ini, 7 hari, 30 hari, bulan ini, atau tanggal kustom',
            'Laporan performa per produk & export data sederhana ke CSV',
          ],
        };
      case 'lainnya':
      default:
        return {
          title: 'Pengaturan & Lainnya',
          description:
            'Pengaturan akun, koneksi printer thermal Bluetooth, buku piutang pelanggan, dan info aplikasi.',
          roadmap: [
            'Pengaturan profil outlet dan informasi operasional',
            'Koneksi & uji cetak printer thermal Bluetooth',
            'Buku piutang pelanggan & pencatatan pembayaran cicilan',
            'Pemeriksaan status PWA dan versi rilis aplikasi',
          ],
        };
    }
  };

  const currentTabConfig = getTabConfig(activeTab);

  return (
    <div className="h-dvh w-full flex flex-col bg-stone-100 overflow-hidden">
      {/* PWA Install Notification if available */}
      <PWAInstallBanner />

      {/* Access Denied Warning Toast */}
      <AccessDeniedToast
        message={unauthorizedAttemptMessage}
        onDismiss={() => setUnauthorizedAttemptMessage(null)}
      />

      {/* Satu-satunya scroll container: <main> */}
      <main
        className="flex-1 w-full overflow-y-auto overscroll-contain scroll-pt-[60px]"
        style={{
          scrollPaddingTop: '60px',
          paddingBottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Global Sticky Header dengan solid background */}
        <Header onOpenOutletSelector={() => setIsOutletModalOpen(true)} />

        {/* Container Konten Utama: Lebar 100% di mobile, max-w-[1200px] di layar ≥1024px */}
        <div className="w-full lg:max-w-[1200px] mx-auto">
          {activeTab === 'beranda' && user.role === 'owner' ? (
            <BerandaOwnerPage
              onNavigateToKasir={() => setActiveTab('kasir')}
              onNavigateToLaporan={() => setActiveTab('laporan')}
            />
          ) : activeTab === 'dashboard' && user.role === 'super_admin' ? (
            <DashboardSuperAdminPage />
          ) : activeTab === 'kasir' && (user.role === 'kasir' || user.role === 'owner') ? (
            <PosKasirPage onNavigateToProdukTab={() => setActiveTab('produk')} />
          ) : activeTab === 'open_bill' && (user.role === 'kasir' || user.role === 'owner') ? (
            <OpenBillPage onNavigateToKasir={() => setActiveTab('kasir')} />
          ) : activeTab === 'riwayat' && (user.role === 'kasir' || user.role === 'owner') ? (
            <RiwayatTransaksiPage />
          ) : activeTab === 'laporan' && (user.role === 'owner' || user.role === 'super_admin') ? (
            <LaporanPage />
          ) : activeTab === 'sync' && user.role === 'kasir' ? (
            <SyncPage />
          ) : activeTab === 'produk' && user.role === 'owner' ? (
            <ProdukHubPage
              onBackToHome={() => setActiveTab(getDefaultTab(user.role))}
              onAttemptUnauthorizedAction={handleAttemptUnauthorizedAction}
            />
          ) : activeTab === 'lainnya' ? (
            <LainnyaPage />
          ) : activeTab === 'outlet' && user.role === 'super_admin' ? (
            <OutletListPage />
          ) : activeTab === 'users' && user.role === 'super_admin' ? (
            <UserListPage />
          ) : (
            <PlaceholderPage
              title={currentTabConfig.title}
              tabKey={activeTab}
              userRole={user.role}
              description={currentTabConfig.description}
              roadmapDetails={currentTabConfig.roadmap}
              onBackToHome={
                activeTab !== getDefaultTab(user.role)
                  ? () => setActiveTab(getDefaultTab(user.role))
                  : undefined
              }
              onAttemptUnauthorizedAction={handleAttemptUnauthorizedAction}
            />
          )}
        </div>
      </main>

      {/* Role-Based Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Modal Switch Outlet */}
      <OutletSelectorModal
        isOpen={isOutletModalOpen}
        onClose={() => setIsOutletModalOpen(false)}
      />
    </div>
  );
};
