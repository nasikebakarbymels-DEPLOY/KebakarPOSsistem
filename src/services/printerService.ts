import { Transaksi, Outlet } from '../types';
import { formatRupiah, formatDateTimeIndo } from '../utils/formatters';

// UUID Service Serial / ESC-POS BLE yang umum dipakai printer thermal portabel
const COMMON_PRINTER_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // ESC/POS Service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 / CC2541 / Standar Thermal Printer BLE
  '0000fff0-0000-1000-8000-00805f9b34fb', // POS Printer BLE
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC Transparent UART
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
];

export const PRINTER_STATUS_EVENT = 'pos_fnb_printer_status_changed';

class BluetoothPrinterService {
  private device: any = null;
  private server: any = null;
  private characteristic: any = null;
  private deviceName: string | null = null;

  // Cek apakah browser mendukung Web Bluetooth API
  public isBluetoothSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'bluetooth' in navigator &&
      typeof (navigator as any).bluetooth?.requestDevice === 'function'
    );
  }

  // Cek status koneksi secara sinkron untuk badge UI
  public isConnected(): boolean {
    return !!(
      this.device &&
      this.server &&
      this.server.connected &&
      this.characteristic
    );
  }

  // Ambil nama perangkat printer yang sedang terhubung
  public getConnectedDeviceName(): string | null {
    if (!this.isConnected()) return null;
    return this.deviceName || this.device?.name || 'Thermal Printer';
  }

  // Notifikasi perubahan status ke seluruh komponen UI
  private emitStatusChange() {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(PRINTER_STATUS_EVENT, {
          detail: {
            connected: this.isConnected(),
            deviceName: this.getConnectedDeviceName(),
          },
        })
      );
    }
  }

  // Hubungkan ke printer Bluetooth
  public async connect(): Promise<{ success: boolean; deviceName: string }> {
    if (!this.isBluetoothSupported()) {
      throw new Error(
        'Perangkat atau browser ini tidak mendukung Bluetooth Web. Gunakan struk digital atau cetak browser.'
      );
    }

    try {
      // Putuskan koneksi sebelumnya bila ada
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }

      const nav = navigator as any;
      // Request device dengan semua device BLE dan daftar UUID service serial umum
      const selectedDevice = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: COMMON_PRINTER_SERVICES,
      });

      if (!selectedDevice) {
        throw new Error('Tidak ada printer yang dipilih.');
      }

      // Pasang event listener saat koneksi terputus tiba-tiba
      selectedDevice.addEventListener('gattserverdisconnected', () => {
        this.characteristic = null;
        this.server = null;
        this.emitStatusChange();
      });

      const server = await selectedDevice.gatt.connect();

      // Cari characteristic yang mendukung operasi 'write' atau 'writeWithoutResponse'
      let writeChar: any = null;

      // Coba dari daftar service umum
      for (const serviceUuid of COMMON_PRINTER_SERVICES) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          const chars = await service.getCharacteristics();
          for (const c of chars) {
            if (c.properties.write || c.properties.writeWithoutResponse) {
              writeChar = c;
              break;
            }
          }
          if (writeChar) break;
        } catch {
          // Lanjut coba service berikutnya
        }
      }

      // Jika belum ditemukan, periksa semua primary services yang ada
      if (!writeChar && server.getPrimaryServices) {
        try {
          const allServices = await server.getPrimaryServices();
          for (const s of allServices) {
            try {
              const chars = await s.getCharacteristics();
              for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                  writeChar = c;
                  break;
                }
              }
              if (writeChar) break;
            } catch {
              // Abaikan kegagalan baca characteristic
            }
          }
        } catch {
          // Abaikan
        }
      }

      if (!writeChar) {
        throw new Error(
          'Printer terhubung tetapi tidak ditemukan saluran kirim data cetak (write characteristic). Pastikan printer dalam mode ESC/POS.'
        );
      }

      const finalName = selectedDevice.name || 'Thermal Printer';
      this.device = selectedDevice;
      this.server = server;
      this.characteristic = writeChar;
      this.deviceName = finalName;

      this.emitStatusChange();
      return { success: true, deviceName: finalName };
    } catch (err: any) {
      this.characteristic = null;
      this.server = null;
      this.emitStatusChange();

      if (err.name === 'NotFoundError') {
        throw new Error('Pencarian printer dibatalkan oleh pengguna.');
      }
      if (err.name === 'SecurityError') {
        throw new Error(
          'Akses Bluetooth diblokir oleh kebijakan keamanan browser. Jika Anda membuka aplikasi di dalam panel preview tertanam, buka aplikasi di tab terpisah lewat ikon layar penuh, lalu coba lagi.'
        );
      }
      throw new Error(err.message || 'Gagal menghubungkan ke printer Bluetooth.');
    }
  }

  // Putuskan koneksi Bluetooth secara aman
  public disconnect(): void {
    try {
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect();
      }
    } catch {
      // Disconnect error dapat diabaikan saat cleanup
    } finally {
      this.device = null;
      this.server = null;
      this.characteristic = null;
      this.deviceName = null;
      this.emitStatusChange();
    }
  }

  // Mengirim data teks ke printer secara bertahap menghormati batas MTU Bluetooth
  private async sendDataInChunks(text: string): Promise<void> {
    if (!this.isConnected() || !this.characteristic) {
      throw new Error(
        'Koneksi ke printer Bluetooth terputus. Silakan hubungkan ulang printer di tab Lainnya.'
      );
    }

    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(text);
    const CHUNK_SIZE = 20; // 20 bytes standar MTU BLE yang aman di semua perangkat

    try {
      for (let i = 0; i < dataBytes.length; i += CHUNK_SIZE) {
        if (!this.isConnected()) {
          throw new Error('Koneksi ke printer Bluetooth terputus di tengah proses pencetakan.');
        }

        const chunk = dataBytes.slice(i, i + CHUNK_SIZE);
        if (this.characteristic.writeValueWithResponse) {
          await this.characteristic.writeValueWithResponse(chunk);
        } else if (this.characteristic.writeValue) {
          await this.characteristic.writeValue(chunk);
        } else if (this.characteristic.writeValueWithoutResponse) {
          await this.characteristic.writeValueWithoutResponse(chunk);
          // Jeda singkat agar buffer hardware tidak overflow
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      }
    } catch (err: any) {
      console.error('Error saat transfer data Bluetooth:', err);
      throw new Error(
        err?.message || 'Gagal mengirim data ke printer Bluetooth. Periksa daya baterai atau jarak printer.'
      );
    }
  }

  // Helper formatting 32 kolom monospace (standar 58mm thermal paper)
  private center(str: string, width = 32): string {
    const trimmed = str.trim();
    if (trimmed.length >= width) return trimmed.slice(0, width) + '\n';
    const left = Math.floor((width - trimmed.length) / 2);
    const right = width - trimmed.length - left;
    return ' '.repeat(left) + trimmed + ' '.repeat(right) + '\n';
  }

  private justify(left: string, right: string, width = 32): string {
    const total = left.length + right.length;
    if (total >= width) {
      const allowedLeft = Math.max(1, width - right.length - 1);
      left = left.slice(0, allowedLeft);
    }
    const spaces = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(spaces) + right + '\n';
  }

  // Format teks struk 32 kolom persis sama dengan StrukPreviewModal
  public formatStruk32(transaksi: Transaksi, outlet: Outlet | null): string {
    const W = 32;
    const DASH = '-'.repeat(W) + '\n';
    const DOUBLE = '='.repeat(W) + '\n';

    let out = '';

    // ESC/POS Reset & Normal Font (opsional jika didukung, tetap aman sebagai ASCII)
    out += '\x1B\x40'; 

    // Header Outlet
    out += this.center(outlet?.nama || 'OUTLET F&B', W);
    if (outlet?.alamat) {
      out += this.center(outlet.alamat, W);
    }
    if (outlet?.telepon) {
      out += this.center(`Telp: ${outlet.telepon}`, W);
    }
    out += DASH;

    // Metadata Transaksi
    out += this.justify('No. Trx', transaksi.nomorTransaksi, W);
    out += this.justify('Waktu', formatDateTimeIndo(transaksi.tanggal), W);
    out += this.justify('Kasir', transaksi.kasirNama, W);
    const tipeOrderText =
      transaksi.tipePesanan === 'dine_in'
        ? `Dine-in (Meja ${transaksi.nomorMeja || '-'})`
        : 'Takeaway';
    out += this.justify('Tipe Order', tipeOrderText, W);
    out += DASH;

    // Items List
    transaksi.items.forEach((item) => {
      const subtotal = item.subtotal || (item.hargaJual - (item.diskonItem || 0)) * item.qty;
      out += this.justify(item.nama, formatRupiah(subtotal), W);

      let detailLine = `${item.qty} x @${formatRupiah(item.hargaJual)}`;
      if ((item.diskonItem || 0) > 0) {
        detailLine += ` (Disc -${formatRupiah(item.diskonItem || 0)})`;
      }
      out += `  ${detailLine}\n`;

      if (item.catatan) {
        out += `  * ${item.catatan}\n`;
      }
    });
    out += DASH;

    // Ringkasan Finansial
    out += this.justify('Subtotal', formatRupiah(transaksi.subtotalKotor || transaksi.total), W);
    if ((transaksi.totalDiskonItem || 0) > 0) {
      out += this.justify('Total Diskon Menu', `-${formatRupiah(transaksi.totalDiskonItem || 0)}`, W);
    }
    if ((transaksi.diskonProdukTotal || 0) > 0) {
      out += this.justify('Promo Diskon Menu', `-${formatRupiah(transaksi.diskonProdukTotal || 0)}`, W);
    }
    if ((transaksi.diskonTransaksiNominal || 0) > 0) {
      const labelDiskon =
        transaksi.diskonTransaksiTipe === 'persen'
          ? `Diskon Trx (${transaksi.diskonTransaksiNilai}%)`
          : 'Diskon Trx (Nominal)';
      out += this.justify(labelDiskon, `-${formatRupiah(transaksi.diskonTransaksiNominal || 0)}`, W);
    }
    if ((transaksi.voucherNilai || 0) > 0) {
      out += this.justify(
        `Voucher (${transaksi.voucherKode || 'PROMO'})`,
        `-${formatRupiah(transaksi.voucherNilai || 0)}`,
        W
      );
    }
    if (transaksi.biayaLainList && transaksi.biayaLainList.length > 0) {
      transaksi.biayaLainList.forEach((b) => {
        const label = `${b.nama}${b.isManual ? ' [M]' : ''}`;
        out += this.justify(label, `+${formatRupiah(b.subtotal)}`, W);
      });
    }
    out += this.justify('TOTAL AKHIR', formatRupiah(transaksi.totalAkhir || transaksi.total), W);
    out += DASH;

    // Rincian Pembayaran
    const metode = transaksi.pembayaran?.metode || (transaksi.metodeBayar as any) || 'tunai';
    const metodeLabel =
      metode === 'tunai'
        ? 'TUNAI'
        : metode === 'qris_transfer' || metode === 'qris'
        ? 'QRIS / TRANSFER'
        : 'PIUTANG';
    out += this.justify('Metode Pembayaran', metodeLabel, W);

    if (metode === 'tunai') {
      out += this.justify(
        'Uang Diterima',
        formatRupiah(transaksi.pembayaran?.uangDiterima || transaksi.uangDiterima || 0),
        W
      );
      out += this.justify(
        'Kembalian',
        formatRupiah(transaksi.pembayaran?.kembalian || transaksi.kembalian || 0),
        W
      );
    } else if (metode === 'qris_transfer' || metode === 'qris' || metode === 'transfer') {
      out += this.justify('Referensi / Bukti', transaksi.pembayaran?.referensi || '-', W);
    } else if (metode === 'piutang') {
      out += this.justify(
        'Nama Pelanggan',
        transaksi.pembayaran?.pelangganNama || 'Pelanggan',
        W
      );
      out += this.justify(
        'Dibayar Sekarang',
        formatRupiah(transaksi.pembayaran?.jumlahDibayar || 0),
        W
      );
      out += this.justify(
        'Sisa Hutang',
        formatRupiah(transaksi.pembayaran?.sisaHutang || 0),
        W
      );
    }

    const statusLabel =
      (transaksi.statusPembayaran || transaksi.status) === 'lunas' || transaksi.status === 'selesai'
        ? 'LUNAS'
        : transaksi.statusPembayaran === 'sebagian'
        ? 'DIBAYAR SEBAGIAN'
        : 'BELUM LUNAS (HUTANG)';
    out += this.justify('Status Tagihan', statusLabel, W);
    out += DOUBLE;

    // Footer Struk
    out += this.center('Terima Kasih Atas Kunjungan Anda', W);
    out += this.center('Layanan Pelanggan POS F&B', W);

    // Baris kosong pemotong kertas (paper feed cut)
    out += '\n\n\n\n\n';

    return out;
  }

  // Cetak struk transaksi asli ke printer Bluetooth
  public async printStruk(transaksi: Transaksi, outlet: Outlet | null): Promise<void> {
    if (!this.isConnected()) {
      throw new Error(
        'Printer Bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu di tab Lainnya.'
      );
    }

    const strukText = this.formatStruk32(transaksi, outlet);
    await this.sendDataInChunks(strukText);
  }

  // Uji cetak contoh struk (Test Print)
  public async testPrint(outletName = 'POS F&B Multi-Outlet'): Promise<void> {
    if (!this.isConnected()) {
      throw new Error(
        'Printer Bluetooth belum terhubung. Silakan hubungkan printer terlebih dahulu.'
      );
    }

    const W = 32;
    const DASH = '-'.repeat(W) + '\n';
    const DOUBLE = '='.repeat(W) + '\n';

    let out = '\x1B\x40';
    out += this.center('TEST PRINT BLUETOOTH', W);
    out += this.center(outletName, W);
    out += DOUBLE;
    out += this.justify('Status', 'BERHASIL TERHUBUNG', W);
    out += this.justify('Printer', (this.getConnectedDeviceName() || 'Thermal').slice(0, 16), W);
    out += this.justify('Format Kolom', '32 Karakter (58mm)', W);
    out += this.justify('Waktu Uji', formatDateTimeIndo(new Date().toISOString()), W);
    out += DASH;
    out += this.center('Koneksi Web Bluetooth Aktif', W);
    out += this.center('Printer siap digunakan!', W);
    out += DOUBLE;
    out += '\n\n\n\n\n';

    await this.sendDataInChunks(out);
  }
}

const defaultBleInstance = new BluetoothPrinterService();

export const printerService = {
  isBluetoothSupported: () => defaultBleInstance.isBluetoothSupported(),
  isConnected: () => defaultBleInstance.isConnected(),
  getConnectedDeviceName: () => defaultBleInstance.getConnectedDeviceName(),
  connect: () => defaultBleInstance.connect(),
  disconnect: () => defaultBleInstance.disconnect(),
  testPrint: (outletName?: string) => defaultBleInstance.testPrint(outletName),
  formatStruk32: (transaksi: Transaksi, outlet: Outlet | null) =>
    defaultBleInstance.formatStruk32(transaksi, outlet),

  /**
   * Cetak struk: jika printer Bluetooth tersambung pakai BLE ESC/POS,
   * selain itu fallback window.print()
   */
  async printStruk(transaksi: Transaksi, outlet?: Outlet | null): Promise<'ble' | 'browser'> {
    // Import dynamically / gunakan printerBleService
    const { printerBleService } = await import('./printerBleService');

    if (printerBleService.isConnected()) {
      await printerBleService.printTransaksi(transaksi, outlet);
      return 'ble';
    }

    if (typeof window !== 'undefined') {
      window.print();
      return 'browser';
    }

    throw new Error('Lingkungan tidak mendukung operasi cetak.');
  },
};

export const printService = printerService;
